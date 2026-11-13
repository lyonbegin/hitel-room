// Dyninst ParseAPI analysis of the unmodified ARM64 vendor ELF.
// This is an analysis program, NOT a rewriting or standalone-SDK module.
#include <CodeObject.h>
#include <CFG.h>
#include <algorithm>
#include <fstream>
#include <iostream>
#include <sstream>
#include <vector>
#include <map>
#include <set>
#include <string>
using namespace Dyninst;
using namespace Dyninst::ParseAPI;

int main(int argc,char** argv){
    if(argc!=4){std::cerr<<"Usage: dyninst_probe original.so outdir original-fde.tsv\n";return 2;}
    const std::string elf=argv[1], out=argv[2];
    try{
        SymtabCodeSource source(elf.c_str());
        CodeObject code(&source);
        code.parse();
        // Exhaustively seed the ORIGINAL 2,629 FDE entries. ParseAPI's
        // symbol-only discovery misses internal functions in stripped ELF.
        // This uses only the original ELF addresses, not reconstructed source.
        std::ifstream index(argv[3]);
        if(!index)throw std::runtime_error("Original FDE seed table missing");
        std::string line;
        std::getline(index,line); // header
        size_t seededFdes=0;
        while(std::getline(index,line)){
            if(line.empty())continue;
            std::istringstream row(line);
            std::vector<std::string> columns;
            std::string column;
            while(std::getline(row,column,'\t'))columns.push_back(column);
            if(columns.size()<11)throw std::runtime_error("Incomplete original FDE record");
            const Address address=std::stoull(columns[8],nullptr,16);
            code.parse(address,true);
            ++seededFdes;
        }
        if(seededFdes!=2629)throw std::runtime_error("2629 original FDE seeds required");
        std::ofstream funcs(out+"/dyninst-function-blocks.tsv");
        std::ofstream edges(out+"/dyninst-cfg-edges.tsv");
        if(!funcs || !edges)return 3;
        funcs<<"function_rva\tname\tblock_rva\tblock_end\tblock_bytes\tcalls\tout_edges\n";
        edges<<"function_rva\tfrom_block\tto_block\tedge_type\tindirect_sink\tinterprocedural\n";
        size_t nfunc=0,nblock=0,nedges=0,ncall=0,sinks=0;
        size_t zeroBlocks=0;
        std::set<Address> entrypoints;
        for(auto* f:code.funcs()){
            ++nfunc;
            entrypoints.insert(f->addr());
            size_t ownblocks=0;
            for(auto* b:f->blocks()){
                ++nblock;++ownblocks;
                auto outedges=b->targets();
                size_t calls=0;
                for(auto* edge:outedges){
                    if(!edge)continue;
                    ++nedges;
                    bool sink=edge->sinkEdge();
                    if(sink)++sinks;
                    if(edge->type()==CALL){++calls;++ncall;}
                    edges<<std::hex<<f->addr()<<"\t"<<b->start()<<"\t"
                         <<(edge->trg()?edge->trg()->start():0)
                         <<std::dec<<"\t"<<static_cast<int>(edge->type())<<"\t"
                         <<sink<<"\t"<<edge->interproc()<<"\n";
                }
                funcs<<std::hex<<f->addr()<<"\t"<<f->name()<<"\t"<<b->start()
                     <<"\t"<<b->end()<<std::dec<<"\t"<<b->size()<<"\t"
                     <<calls<<"\t"<<outedges.size()<<"\n";
            }
            if(!ownblocks)++zeroBlocks;
        }
        funcs.flush();edges.flush();
        std::ofstream summary(out+"/dyninst-summary.json");
        summary<<"{\n"
             <<"  \"tool\": \"Dyninst ParseAPI\",\n"
             <<"  \"original_fde_seeds\": "<<seededFdes<<",\n"
             <<"  \"found_functions\": "<<nfunc<<",\n"
             <<"  \"unique_function_start_addresses\": "<<entrypoints.size()<<",\n"
             <<"  \"function_block_memberships\": "<<nblock<<",\n"
             <<"  \"cfg_edges\": "<<nedges<<",\n"
             <<"  \"call_edges\": "<<ncall<<",\n"
             <<"  \"unresolved_or_sink_edges\": "<<sinks<<",\n"
             <<"  \"zero_block_functions\": "<<zeroBlocks<<",\n"
             <<"  \"modified_vendor_code\": false,\n"
             <<"  \"note\": \"Parser CFG is inferred and can differ from FDE and Ghidra; gaps and indirect edges are tracked, not assumed complete.\"\n"
             <<"}\n";
        std::cout<<"EXPR2_DYNINST_PARSEAPI_ACTUAL_ANALYSIS_PASS "
                 <<"FUNCTIONS "<<nfunc<<" BLOCKS "<<nblock
                 <<" CFG_EDGES "<<nedges<<" SINKS "<<sinks<<"\n";
        if(!nfunc || !nblock)return 4;
        return 0;
    }catch(const std::exception& ex){
        std::cerr<<"DYNINST_PARSE_ERROR "<<ex.what()<<"\n";return 5;
    }
}
