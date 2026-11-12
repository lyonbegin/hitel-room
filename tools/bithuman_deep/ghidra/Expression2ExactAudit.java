// @category bitHuman
// Expression2 function-body verification. No independent SDK algorithms are authored here.
// All machine instruction bytes come from the unmodified published libexpr2jni.so.
// Ghidra pseudocode is ANALYST OUTPUT, not the vendor's lost original C++ source.
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import ghidra.program.model.address.Address;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class Expression2ExactAudit extends GhidraScript {
    static class Pending {
        Function f;
        int depth;
        String root;
        Pending(Function f, int d, String r) {this.f=f;depth=d;root=r;}
    }
    static String clean(String s) {
        return s.replace('\t',' ').replace('\n',' ').replace('\r',' ');
    }
    static String hex(byte[] bytes) {
        StringBuilder b=new StringBuilder(bytes.length*2);
        for(byte v:bytes)b.append(String.format("%02x",v & 255));
        return b.toString();
    }
    static String sha(byte[] bytes) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
    static void write(File file,String value) throws Exception {
        try(BufferedWriter out=new BufferedWriter(new FileWriter(file,StandardCharsets.UTF_8))) {
            out.write(value);
        }
    }
    @Override public void run() throws Exception {
        String base=System.getenv("EXPR2_EXACT_AUDIT_DIR");
        if(base==null || base.isBlank())throw new IllegalArgumentException("EXPR2_EXACT_AUDIT_DIR required");
        File root=new File(base);
        File listingDir=new File(root,"native-instruction-bytes");
        File pseudoDir=new File(root,"decompiler-reconstruction-not-original");
        listingDir.mkdirs();pseudoDir.mkdirs();
        List<Function> roots=new ArrayList<>();
        for(Function f:currentProgram.getFunctionManager().getFunctions(true)) {
            if(f.getName().startsWith("Java_ai_bithuman_expression2_Native_"))roots.add(f);
        }
        roots.sort(Comparator.comparing(Function::getName));
        if(roots.size()<12) throw new IllegalStateException("Expected SDK JNI exports were not found: "+roots.size());
        final int maxFunctions=1200;
        ArrayDeque<Pending> queue=new ArrayDeque<>();
        for(Function f:roots)queue.addLast(new Pending(f,0,f.getName()));
        Set<String> seen=new HashSet<>();
        DecompInterface decompiler=new DecompInterface();
        decompiler.openProgram(currentProgram);
        decompiler.setSimplificationStyle("decompile");
        int decompiled=0,failed=0,instructions=0,indirect=0,maxDepth=0;
        Map<String,Integer> rootCoverage=new LinkedHashMap<>();
        int count=0;
        try(BufferedWriter manifest=new BufferedWriter(new FileWriter(new File(root,"functions.tsv"),StandardCharsets.UTF_8));
            BufferedWriter edges=new BufferedWriter(new FileWriter(new File(root,"call-edges.tsv"),StandardCharsets.UTF_8));
            BufferedWriter errors=new BufferedWriter(new FileWriter(new File(root,"problems.tsv"),StandardCharsets.UTF_8))) {
            manifest.write("address\tname\tdepth\troot\tbytes_sha256\tinstruction_count\tbyte_count\tdirect_calls\tdecompile\tpseudo_chars\n");
            edges.write("caller_address\tcallee_address\tcallee_name\n");
            errors.write("address\tname\tproblem\n");
            while(!queue.isEmpty() && count<maxFunctions && !monitor.isCancelled()) {
                Pending cur=queue.removeFirst();
                Function f=cur.f;
                String addr=f.getEntryPoint().toString();
                if(!seen.add(addr))continue;
                count++;
                maxDepth=Math.max(maxDepth,cur.depth);
                rootCoverage.put(cur.root,rootCoverage.getOrDefault(cur.root,0)+1);
                String id=String.format("%04d_%s",count,addr.replace(':','_'));
                MessageDigest digest=MessageDigest.getInstance("SHA-256");
                int nins=0,rawByteCount=0;
                StringBuilder asm=new StringBuilder();
                asm.append("# Function ").append(clean(f.getName())).append(" @").append(addr)
                    .append("\n# Exact instruction bytes from unmodified SDK .so\n");
                InstructionIterator it=currentProgram.getListing().getInstructions(f.getBody(),true);
                while(it.hasNext()) {
                    Instruction ins=it.next();
                    byte[] bytes=ins.getBytes();
                    digest.update(bytes);
                    nins++;rawByteCount+=bytes.length;
                    asm.append(ins.getAddress().toString()).append('\t')
                       .append(hex(bytes)).append('\t')
                       .append(clean(ins.toString())).append('\n');
                }
                write(new File(listingDir,id+".lst"),asm.toString());
                instructions+=nins;
                List<Function> next=new ArrayList<>(f.getCalledFunctions(monitor));
                next.sort(Comparator.comparing(Function::getName));
                for(Function target:next) {
                    edges.write(addr+"\t"+target.getEntryPoint().toString()+"\t"+clean(target.getName())+"\n");
                    if(!target.isExternal() && !seen.contains(target.getEntryPoint().toString()))
                        queue.addLast(new Pending(target,cur.depth+1,cur.root));
                }
                String decompResult="FAILED";
                int pseudoLength=0;
                // Decompiled C syntax is only recovered pseudocode, not the original developer source.
                DecompileResults d=decompiler.decompileFunction(f,25,monitor);
                if(d!=null && d.decompileCompleted() && d.getDecompiledFunction()!=null) {
                    String pseudo=d.getDecompiledFunction().getC();
                    pseudoLength=pseudo.length();
                    write(new File(pseudoDir,id+".c"),"/* Ghidra reconstruction, not original vendor C++ */\n"+
                          "/* "+clean(f.getName())+" @"+addr+" */\n"+pseudo);
                    decompResult="SUCCESS";decompiled++;
                } else {
                    failed++;
                    errors.write(addr+"\t"+clean(f.getName())+"\tDECOMPILER_FAILED_OR_TIMED_OUT\n");
                }
                manifest.write(addr+"\t"+clean(f.getName())+"\t"+cur.depth+"\t"+cur.root+"\t"+
                               hex(digest.digest())+"\t"+nins+"\t"+rawByteCount+"\t"+next.size()+"\t"+
                               decompResult+"\t"+pseudoLength+"\n");
                if(count%25==0) {
                    println("EXPR2_BODY_PROGRESS functions="+count+" decompiled="+decompiled+" queue="+queue.size());
                    manifest.flush();edges.flush();errors.flush();
                }
            }
        } finally {decompiler.dispose();}
        String summary="# Expression2 original instruction-level audit\n\n"+
          "- SDK: ai.bithuman:expression2-android:0.6.2\n"+
          "- JNI roots discovered: "+roots.size()+"\n"+
          "- Traversed distinct functions: "+count+"\n"+
          "- Successfully decompiled: "+decompiled+"\n"+
          "- Decompiler failures: "+failed+"\n"+
          "- Exact machine instructions indexed: "+instructions+"\n"+
          "- Maximum observed call depth: "+maxDepth+"\n"+
          "- Unvisited queued functions at stop: "+queue.size()+"\n"+
          "- Threshold of 1200 reached: "+(count>=maxFunctions)+"\n"+
          "- Original functions preserved as exact instruction bytes and hashes; C-like files are reconstructed approximations.\n"+
          "- Indirect calls/dynamic dispatch cannot be assumed resolved by the static call graph.\n"+
          "- This audit does not claim code equivalence or implement a new SDK.\n\n"+
          "## Reachability by root seed\n\n";
        for(Map.Entry<String,Integer> item:rootCoverage.entrySet())
            summary+="- "+item.getKey()+": "+item.getValue()+" visited functions assigned to this seed\n";
        write(new File(root,"SUMMARY.md"),summary);
        println("EXPR2_BODY_AUDIT_COMPLETE roots="+roots.size()+" visited="+count+
          " decompiled="+decompiled+" failures="+failed+" instructions="+instructions+
          " queued="+queue.size()+" maxDepth="+maxDepth);
        if(decompiled<roots.size() || count<=65)throw new IllegalStateException("Insufficient body coverage for expanded audit");
    }
}
