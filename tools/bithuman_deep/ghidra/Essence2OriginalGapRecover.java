// @category bitHuman
// Recover original AArch64 instructions classified as undefined in Ghidra DB.
// This changes ONLY Ghidra's analysis database, never the original vendor ELF.
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;
import java.io.*;
import java.util.*;
public class Essence2OriginalGapRecover extends GhidraScript {
    public void run() throws Exception {
        String gaps=System.getenv("ESSENCE2_GAP_SITES");
        String fdes=System.getenv("ESSENCE2_GAP_FDES");
        String out=System.getenv("ESSENCE2_RECOVERED_OUT");
        if(gaps==null||fdes==null||out==null)throw new IllegalArgumentException("Missing Essence2 gap files and output");
        File output=new File(out);
        output.getParentFile().mkdirs();
        long imageBase=currentProgram.getImageBase().getOffset();
        int candidates=0,beforeUndefined=0,recovered=0,failed=0,afterMissing=0,covered=0,total=0;
        List<Long> locs=new ArrayList<>();
        try(BufferedReader in=new BufferedReader(new FileReader(gaps))){
            in.readLine();
            String line;
            while((line=in.readLine())!=null){
                if(line.isBlank())continue;
                String[] t=line.split("\t");
                if(t.length<5)throw new IllegalArgumentException("Bad gap TSV");
                locs.add(Long.parseUnsignedLong(t[1].replace("0x",""),16));
            }
        }
        Collections.sort(locs);
        try(PrintWriter o=new PrintWriter(output)){
            o.println("elf_va\toriginal_bytes\tdisassembly_attempted\tghidra_after\tinstruction");
            for(Long va:locs){
                Address addr=toAddr(imageBase+va);
                byte[] raw=new byte[4];
                currentProgram.getMemory().getBytes(addr,raw);
                String hex=String.format("%02x%02x%02x%02x",raw[0]&255,raw[1]&255,raw[2]&255,raw[3]&255);
                Instruction before=getInstructionAt(addr);
                ++candidates;
                if(before==null){
                    ++beforeUndefined;
                    // Branch and tail code has actual AArch64 opcode bytes.
                    // Never modify the input image, only Ghidra Listing classification.
                    boolean attempt=disassemble(addr);
                    Instruction after=getInstructionAt(addr);
                    if(attempt&&after!=null&&after.getLength()==4)++recovered;
                    if(after==null)++failed;
                }
                Instruction after=getInstructionAt(addr);
                o.printf("0x%x\t%s\t%s\t%s\t%s%n",va,hex,before==null,after==null?"UNDEFINED":"INSTRUCTION",
                    after==null?"":after.toString());
            }
        }
        try(BufferedReader in=new BufferedReader(new FileReader(fdes))){
            in.readLine();
            String line;
            while((line=in.readLine())!=null){
                if(line.isBlank())continue;
                String[] t=line.split("\t");
                long va=Long.parseUnsignedLong(t[0].replace("0x",""),16);
                int len=Integer.parseInt(t[1]);
                for(int off=0;off<len;off+=4){
                    ++total;
                    Address at=toAddr(imageBase+va+off);
                    if(getInstructionAt(at)!=null)++covered;
                    else ++afterMissing;
                }
            }
        }
        println("ESSENCE2_GHIDRA_ORIGINAL_INSTRUCTION_RECOVERY"+
            " candidates="+candidates+" before_undefined="+beforeUndefined+
            " recovered="+recovered+" still_undefined="+failed+
            " FDE_4BYTE_INSTRUCTIONS="+total+
            " after_recognized="+covered+" after_missing="+afterMissing+
            " original_machine_code_modified=false");
        if(candidates==0)throw new IllegalStateException("No targeted gaps");
        if(afterMissing>0)throw new IllegalStateException("Not all original FDE code classified after targeted disassembly: "+afterMissing);
    }
}
