// Read-only Dyninst ParseAPI ARM64 function and CFG audit (no original bytes modified).
#include <CodeObject.h>
#include <CFG.h>
#include <fstream>
#include <iostream>
#include <string>
#include <set>
using namespace Dyninst;
using namespace Dyninst::ParseAPI;
int main(int argc,char** argv){
 if(argc!=3)return 2;
 try{
  SymtabCodeSource source(argv[1]);CodeObject obj(&source);obj.parse();
  std::ofstream fs(std::string(argv[2])+"/dyninst_functions.tsv");
  std::ofstream es(std::string(argv[2])+"/dyninst_cfg_edges.tsv");
  fs<<"function\tname\tblock_start\tblock_end\tblock_bytes\n";
  es<<"function\tfrom\tto\ttype\tindirect\tinterprocedural\n";
  size_t nf=0,nb=0,ne=0,nc=0;std::set<Address> entries;
  for(auto* f:obj.funcs()){
   nf++;entries.insert(f->addr());
   for(auto* b:f->blocks()){
    nb++;
    fs<<std::hex<<f->addr()<<"\t"<<f->name()<<"\t"<<b->start()
      <<"\t"<<b->end()<<std::dec<<"\t"<<b->size()<<"\n";
    for(auto* e:b->targets()){
     if(!e)continue;ne++;if(e->type()==CALL)nc++;
     es<<std::hex<<f->addr()<<"\t"<<b->start()<<"\t"
       <<(e->trg()?e->trg()->start():0)<<std::dec
       <<"\t"<<static_cast<int>(e->type())<<"\t"<<e->sinkEdge()
       <<"\t"<<e->interproc()<<"\n";
    }
   }
  }
  std::ofstream sum(std::string(argv[2])+"/dyninst_summary.txt");
  sum<<"functions="<<nf<<"\nblocks="<<nb<<"\ncfg_edges="<<ne<<"\ncall_edges="<<nc<<"\n";
  std::cout<<"TOSS_DYNINST_ACTUAL_PASS funcs "<<nf<<" blocks "<<nb<<" edges "<<ne<<"\n";
  return (nf&&nb)?0:4;
 }catch(const std::exception& e){std::cerr<<"DYNINST_FAIL "<<e.what()<<"\n";return 5;}
}
