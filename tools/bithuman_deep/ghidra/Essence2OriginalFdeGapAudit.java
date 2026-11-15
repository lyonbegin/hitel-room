// @category bitHuman
// Original Essence2 ARM64 FDE gaps: distinguish Ghidra instructions vs data vs
// unknown bytes without ever changing original ELF machine code.
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.Data;
import java.io.*;
public class Essence2OriginalFdeGapAudit extends GhidraScript {
    public void run() throws Exception {
        String input=System.getenv("ESSENCE2_GAP_INDEX");
        String output=System.getenv("ESSENCE2_GAP_OUT");
        if(input==null || output==null) throw new IllegalArgumentException("ESSENCE2_GAP_INDEX and OUT required");
        File f=new File(output);f.getParentFile().mkdirs();
        int fdes=0,missing=0,definedData=0,undef=0,recognized=0;
        long imageBase=currentProgram.getImageBase().getOffset();
        try(BufferedReader reader=new BufferedReader(new FileReader(input));
            PrintWriter out=new PrintWriter(f)){
            String line=reader.readLine();
            if(line==null || !line.startsWith("fde_va"))throw new IllegalArgumentException("invalid TSV");
            out.println("fde_va\tactual_elf_va\tghidra_address\tbytes_hex\tclassification\tdetails");
            while((line=reader.readLine())!=null){
                if(line.isBlank())continue;
                String[] t=line.split("\t");
                if(t.length<2)throw new IllegalArgumentException("missing row fields");
                long va=Long.parseUnsignedLong(t[0].replace("0x",""),16);
                int length=Integer.parseInt(t[1]);
                if((length%4)!=0)throw new IllegalStateException("AARCH64_FDE_SIZE_NOT_4_BYTE_MULTIPLE");
                ++fdes;
                for(int off=0;off<length;off+=4){
                    Address at=toAddr(imageBase+va+off);
                    Instruction ins=getInstructionAt(at);
                    if(ins!=null){++recognized;continue;}
                    ++missing;
                    Data data=getDataAt(at);
                    String cat=data!=null&&data.isDefined()?"DEFINED_DATA":"UNDEFINED";
                    if(cat.equals("DEFINED_DATA"))++definedData;else ++undef;
                    byte[] raw=new byte[4];
                    currentProgram.getMemory().getBytes(at,raw);
                    StringBuilder hex=new StringBuilder();
                    for(byte b:raw) hex.append(String.format("%02x",b&255));
                    out.printf("0x%x\t0x%x\t%s\t%s\t%s\t%s%n",
                        va,va+off,at,hex.toString(),cat,
                        ins==null && data!=null ? data.getDataType().getName() : "");
                }
            }
        }
        println("ESSENCE2_ORIGINAL_FDE_GAP_AUDIT_PASS FDE="+fdes+
          " MISSING_4BYTE_SLOTS="+missing+" DEFINED_DATA="+definedData+
          " UNDEFINED="+undef+" RECOGNIZED_4BYTE_SLOTS="+recognized+
          " ORIGINAL_ELF_PATCHED=false");
        if(fdes==0)throw new IllegalStateException("No FDEs inspected");
    }
}
