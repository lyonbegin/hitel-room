// @category bitHuman
// Investigate four bytes of nonmatching Ghidra/Capstone instruction coverage.
// Read-only original vendor image. No function or original byte rewritten.
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.Data;
import java.io.File;
import java.io.PrintWriter;
public class Expression2InstructionGapAudit extends GhidraScript {
    public void run() throws Exception {
        String path=System.getenv("EXPR2_INSN_GAP_REPORT");
        if(path==null || path.isBlank())throw new IllegalArgumentException("report path");
        File dir=new File(path).getParentFile();
        if(dir!=null)dir.mkdirs();
        final long elfStart=0x112308L;
        final long ghidraBase=0x100000L;
        final int range=540;  // original EH-frame FDE length
        int valid=0,undefined=0,data=0;
        try(PrintWriter f=new PrintWriter(path)){
            f.println("elf_va\tghidra_va\tbytes\tghidra_category\tinstruction");
            for(int offset=0;offset<range;offset+=4){
                long rva=elfStart+offset;
                Address addr=toAddr(rva+ghidraBase);
                Instruction ins=getInstructionAt(addr);
                Data d=getDataAt(addr);
                byte[] bytes=new byte[4];
                currentProgram.getMemory().getBytes(addr,bytes);
                String hex=String.format("%02x%02x%02x%02x",
                    bytes[0]&255,bytes[1]&255,bytes[2]&255,bytes[3]&255);
                String category="UNDEFINED";
                String instruction="";
                if(ins!=null){category="INSTRUCTION";instruction=ins.toString();++valid;}
                else if(d!=null && d.isDefined()){category="DEFINED_DATA";++data;}
                else ++undefined;
                f.printf("0x%x\t%s\t%s\t%s\t%s%n",rva,addr,hex,category,instruction);
                if(ins==null)println("EXPR2_ORIGINAL_FDE_INSTRUCTION_GAP addr=0x"+
                    Long.toHexString(rva)+" bytes="+hex+" class="+category);
            }
        }
        // Disassemble in the ANALYSIS DATABASE only, never patch original SO.
        Address missing=toAddr(0x1124c8L+ghidraBase);
        if(getInstructionAt(missing)!=null)
            throw new IllegalStateException("Expected previously undefined 4-byte branch");
        if(!disassemble(missing))
            throw new IllegalStateException("Ghidra failed to define original AArch64 B branch");
        Instruction recovered=getInstructionAt(missing);
        if(recovered==null || recovered.getLength()!=4)
            throw new IllegalStateException("Original instruction not recognized after targeted disassembly");
        int after=0;
        for(int off=0;off<range;off+=4)
            if(getInstructionAt(toAddr(elfStart+ghidraBase+off))!=null)after++;
        println("EXPR2_ORIGINAL_GHIDRA_TARGETED_DISASSEMBLY_PASS "+
            "original_elf_va=0x1124c8 opcode=0c000014 "+
            "instruction="+recovered.toString()+" recognized="+after+"/135 "+
            "vendor_binary_modified=false");
        if(after!=135)throw new IllegalStateException("Remaining undecoded 4-byte slot");
        println("EXPR2_FDE_HOLE_AUDIT_PASS recognized="+valid+
            " unrecognized="+undefined+" defined_data="+data+
            " expected_capstone_instructions=135");
        if(valid+undefined+data!=135)throw new IllegalStateException("Incomplete 540B FDE");
    }
}
