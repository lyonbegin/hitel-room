// @category TossAudit
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.pcode.PcodeOp;
import java.io.File;
import java.io.PrintWriter;
public class TossGhidraAudit extends GhidraScript {
 @Override public void run() throws Exception {
   String out=getScriptArgs()[0];
   File d=new File(out);d.mkdirs();
   int nfunc=0,ninst=0,nload=0,nstore=0,ncall=0,ncallind=0;
   try(PrintWriter funcs=new PrintWriter(new File(d,"ghidra_functions.tsv"));
       PrintWriter inst=new PrintWriter(new File(d,"ghidra_instructions.tsv"))) {
     funcs.println("entry\tname\tbody_bytes");
     inst.println("address\tmnemonic\tpcode_ops");
     FunctionIterator it=currentProgram.getFunctionManager().getFunctions(true);
     while(it.hasNext()) {
       Function fn=it.next(); nfunc++;
       funcs.printf("%s\t%s\t%d%n",fn.getEntryPoint(),fn.getName(),fn.getBody().getNumAddresses());
     }
     InstructionIterator instr=currentProgram.getListing().getInstructions(true);
     while(instr.hasNext()){
       Instruction i=instr.next(); ninst++;
       PcodeOp[] ops=i.getPcode();
       for(PcodeOp x:ops) {
         if(x.getOpcode()==PcodeOp.LOAD)nload++;
         if(x.getOpcode()==PcodeOp.STORE)nstore++;
         if(x.getOpcode()==PcodeOp.CALL)ncall++;
         if(x.getOpcode()==PcodeOp.CALLIND)ncallind++;
       }
       inst.printf("%s\t%s\t%d%n",i.getAddress(),i.getMnemonicString(),ops.length);
     }
   }
   try(PrintWriter w=new PrintWriter(new File(d,"ghidra_summary.txt"))) {
     w.printf("GHIDRA_REAL_PASS functions=%d instructions=%d LOAD=%d STORE=%d CALL=%d CALLIND=%d%n",nfunc,ninst,nload,nstore,ncall,ncallind);
   }
   println("TOSS_GHIDRA_ACTUAL_PASS "+nfunc+" "+ninst);
   if(nfunc==0||ninst==0)throw new IllegalStateException("NO_FUNCTIONS_OR_INSTRUCTIONS");
 }
}
