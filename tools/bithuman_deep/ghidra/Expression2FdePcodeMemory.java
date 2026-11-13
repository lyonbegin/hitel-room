// @category bitHuman
// Original SDK ARM64 FDE-first P-code LOAD/STORE/CALL memory reconstruction.
// Uses the ORIGINAL immutable AAR library; never patches any vendor instruction.
// Reports static memory-access sites, not actual runtime allocation addresses.
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.mem.MemoryBlock;
import ghidra.program.model.pcode.PcodeOp;
import ghidra.program.model.pcode.Varnode;
import ghidra.program.model.symbol.Reference;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.util.HashSet;
import java.util.Set;

public class Expression2FdePcodeMemory extends GhidraScript {
    private static final Set<String> FOCUS = new HashSet<>();
    static {
        String[] starts = {
            "001724d8","001a7fbc","001acf1c","001a77c0","001a7db0",
            "001a80dc","001a8500","001a9794","001a8230","001a8404",
            "001aa594","001a7a04","001aa40c","001a84cc","00172e7c"
        };
        for(String s:starts)FOCUS.add(s);
    }
    private static String clean(String s){
        if(s==null)return "";
        return s.replace('\t',' ').replace('\n',' ').replace('\r',' ');
    }
    private static String var(Varnode v){
        if(v==null)return "none";
        return clean(v.toString());
    }
    @Override public void run() throws Exception {
        String fdePath=System.getenv("EXPR2_FDE_MAP");
        String output=System.getenv("EXPR2_PCODE_OUT");
        if(fdePath==null || output==null)
            throw new IllegalArgumentException("EXPR2_FDE_MAP and EXPR2_PCODE_OUT required");
        new File(output).mkdirs();
        int ranges=0,decodedRanges=0,unrecognized=0,insTotal=0;
        int opTotal=0,loads=0,stores=0,calls=0,indirects=0,staticRefs=0;
        int focusCovered=0;
        File summaryFile=new File(output,"pcode-fde-coverage.tsv");
        File sitesFile=new File(output,"pcode-memory-sites.tsv");
        File callFile=new File(output,"pcode-call-edges.tsv");
        File refFile=new File(output,"pcode-data-references.tsv");
        try(BufferedReader in=new BufferedReader(new FileReader(fdePath));
            BufferedWriter summary=new BufferedWriter(new FileWriter(summaryFile));
            BufferedWriter sites=new BufferedWriter(new FileWriter(sitesFile));
            BufferedWriter edges=new BufferedWriter(new FileWriter(callFile));
            BufferedWriter refs=new BufferedWriter(new FileWriter(refFile))){
            summary.write("start_hex\tend_hex\tfde_bytes\tdecoded_instruction_bytes\tinstructions\tpcode_ops\tload\tstore\tcall\tcallind\tdata_refs\tghidra_exact_entry_function\tstatus\n");
            sites.write("fde_start\tinstruction_addr\tinstruction\tpcode_op\tspace\tpointer\tvalue\tinsn_repr\n");
            edges.write("caller_fde\tinstruction_addr\ttarget\tcall_kind\n");
            refs.write("owner_fde\tinstruction_addr\ttarget\tref_kind\ttarget_section\n");
            String line=in.readLine();
            if(line==null || !line.startsWith("start_hex"))
                throw new IllegalStateException("invalid original FDE manifest");
            while((line=in.readLine())!=null){
                if(monitor.isCancelled())throw new InterruptedException("cancelled");
                if(line.isBlank())continue;
                String[] parts=line.split("\t",-1);
                if(parts.length<8)throw new IllegalStateException("invalid FDE TSV line");
                String begin=parts[0],finish=parts[1];
                int length=Integer.parseInt(parts[2]);
                Address beginAddress=toAddr(Long.parseUnsignedLong(begin,16));
                Address endAddress=beginAddress.add(length-1);
                boolean focus=FOCUS.contains(begin);
                int n=0,decodedBytes=0,pOps=0,nLoad=0,nStore=0,nCall=0,nIndirect=0,nRefs=0;
                Function exact=currentProgram.getFunctionManager().getFunctionAt(beginAddress);
                InstructionIterator it=currentProgram.getListing()
                    .getInstructions(new AddressSet(beginAddress,endAddress),true);
                while(it.hasNext()){
                    Instruction ins=it.next();
                    int l=ins.getLength();
                    if(ins.getAddress().compareTo(beginAddress)<0 ||
                        ins.getAddress().compareTo(endAddress)>0)continue;
                    n++;decodedBytes+=l;
                    PcodeOp[] ops=ins.getPcode();
                    pOps+=ops.length;
                    for(PcodeOp op:ops){
                        int kind=op.getOpcode();
                        if(kind==PcodeOp.LOAD || kind==PcodeOp.STORE){
                            if(kind==PcodeOp.LOAD){nLoad++;loads++;}
                            else {nStore++;stores++;}
                            if(focus){
                                String space=op.getNumInputs()>0?var(op.getInput(0)):"none";
                                String pointer=op.getNumInputs()>1?var(op.getInput(1)):"none";
                                String value=kind==PcodeOp.STORE && op.getNumInputs()>2 ?
                                    var(op.getInput(2)):var(op.getOutput());
                                sites.write(begin+"\t"+ins.getAddress()+"\t"+
                                    clean(ins.getMnemonicString())+"\t"+
                                    op.getMnemonic()+"\t"+space+"\t"+pointer+
                                    "\t"+value+"\t"+clean(ins.toString())+"\n");
                            }
                        }else if(kind==PcodeOp.CALL || kind==PcodeOp.CALLIND){
                            if(kind==PcodeOp.CALL){nCall++;calls++;}
                            else {nIndirect++;indirects++;}
                            String target=op.getNumInputs()>0?var(op.getInput(0)):"unknown";
                            edges.write(begin+"\t"+ins.getAddress()+"\t"+target+
                                "\t"+op.getMnemonic()+"\n");
                        }
                    }
                    for(Reference r:getReferencesFrom(ins.getAddress())){
                        if(!r.isMemoryReference())continue;
                        Address target=r.getToAddress();
                        MemoryBlock block=currentProgram.getMemory().getBlock(target);
                        String sec=block==null?"unmapped":block.getName();
                        if(sec.startsWith(".text") || sec.startsWith(".plt"))continue;
                        nRefs++;staticRefs++;
                        refs.write(begin+"\t"+ins.getAddress()+"\t"+
                            target+"\t"+clean(r.getReferenceType().getName())+
                            "\t"+sec+"\n");
                    }
                }
                ranges++;
                if(n>0){decodedRanges++;insTotal+=n;opTotal+=pOps;}
                else unrecognized++;
                if(focus && n>0)focusCovered++;
                summary.write(begin+"\t"+finish+"\t"+length+"\t"+
                    decodedBytes+"\t"+n+"\t"+pOps+"\t"+nLoad+
                    "\t"+nStore+"\t"+nCall+"\t"+nIndirect+"\t"+nRefs+
                    "\t"+(exact!=null?"yes":"no")+"\t"+
                    (decodedBytes==length?"COMPLETE":n>0?"PARTIAL":"UNDECODED")+"\n");
                if(ranges%200==0){
                    summary.flush();sites.flush();edges.flush();refs.flush();
                    println("EXPR2_PCODE_PROGRESS fde="+ranges+" decoded="+decodedRanges+
                        " loads="+loads+" stores="+stores+" calls="+calls);
                }
            }
        }
        if(ranges!=2629)throw new IllegalStateException("missing original FDE functions "+ranges);
        if(focusCovered<8)throw new IllegalStateException("critical original call-path P-code missing: "+focusCovered);
        String result="{\n"+
            "  \"original_function_ranges\": "+ranges+",\n"+
            "  \"decoded_fde_ranges\": "+decodedRanges+",\n"+
            "  \"undecoded_fde_ranges\": "+unrecognized+",\n"+
            "  \"instructions\": "+insTotal+",\n"+
            "  \"pcode_ops\": "+opTotal+",\n"+
            "  \"pcode_load\": "+loads+",\n"+
            "  \"pcode_store\": "+stores+",\n"+
            "  \"pcode_call\": "+calls+",\n"+
            "  \"pcode_callind\": "+indirects+",\n"+
            "  \"noncode_static_references\": "+staticRefs+",\n"+
            "  \"focus_functions_decoded\": "+focusCovered+",\n"+
            "  \"static_not_runtime_memory_trace\": true,\n"+
            "  \"original_binary_modified\": false\n"+
            "}\n";
        try(BufferedWriter s=new BufferedWriter(new FileWriter(new File(output,"pcode-summary.json")))){
            s.write(result);
        }
        println("EXPR2_ORIGINAL_FDE_PCODE_MEMORY_PASS FDE="+ranges+
            " decoded="+decodedRanges+" loads="+loads+" stores="+stores+
            " calls="+calls+" indirect="+indirects+" focus="+focusCovered);
    }
}
