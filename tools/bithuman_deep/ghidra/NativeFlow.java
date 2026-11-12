// @category bitHuman
// Ghidra headless script: emit a compact call graph and relevant semantic clues.
// NO raw model weights, no full decompiled functions, and no credentials are exported.
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

public class NativeFlow extends GhidraScript {
    private static class Entry {
        Function func;
        int depth;
        Entry(Function f, int d){func=f;depth=d;}
    }

    @Override
    public void run() throws Exception {
        String dest=System.getenv("BITHUMAN_JNI_REPORT");
        if(dest == null || dest.isEmpty()) throw new IllegalArgumentException("BITHUMAN_JNI_REPORT is not set");
        File output=new File(dest);
        File parent=output.getParentFile();
        if(parent!=null)parent.mkdirs();
        Pattern focus=Pattern.compile("(canon|decoder|dec16|dec8|tok14|step|history|motion|latent|signature|pump|feed|frame|model|chunk|overlap)",Pattern.CASE_INSENSITIVE);
        Set<String> selected=Set.of(
            "Java_ai_bithuman_expression2_Native_create",
            "Java_ai_bithuman_expression2_Native_pump",
            "Java_ai_bithuman_expression2_Native_pumpForPull",
            "Java_ai_bithuman_expression2_Native_feed",
            "Java_ai_bithuman_expression2_Native_stepHistoryInputIndex",
            "Java_ai_bithuman_expression2_Native_pullToBuffer",
            "Java_ai_bithuman_expression2_Native_beginSegment",
            "Java_ai_bithuman_expression2_Native_endSegment",
            "Java_ai_bithuman_expression2_Native_splitSignatures"
        );
        List<Function> funcs=new ArrayList<>();
        for(Function f:currentProgram.getFunctionManager().getFunctions(true)){
            if(selected.contains(f.getName())) funcs.add(f);
        }
        funcs.sort(Comparator.comparing(Function::getName));
        DecompInterface decoder=new DecompInterface();
        decoder.openProgram(currentProgram);
        decoder.setSimplificationStyle("decompile");
        ArrayDeque<Entry> queue=new ArrayDeque<>();
        for(Function f:funcs)queue.add(new Entry(f,0));
        Set<String> seen=new HashSet<>();
        int count=0,matchCount=0,ok=0;
        String extraDest=System.getenv("BITHUMAN_JNI_PSEUDOCODE_OUT");
        if(extraDest==null || extraDest.isEmpty())throw new IllegalArgumentException("BITHUMAN_JNI_PSEUDOCODE_OUT is missing");
        BufferedWriter extra=new BufferedWriter(new FileWriter(extraDest));
        try(BufferedWriter writer=new BufferedWriter(new FileWriter(output))){
            writer.write("# bitHuman Expression 2 ARM64 JNI call-flow probe\n\n");
            writer.write("This is static function metadata from the official distributed Android .so.\n");
            writer.write("No secret, no model execution, no source reconstruction claimed.\n\n");
            writer.write("Initial JNI functions found="+funcs.size()+"\n\n");
            while(!queue.isEmpty() && count<65 && !monitor.isCancelled()){
                Entry item=queue.removeFirst();
                Function f=item.func;
                String key=f.getEntryPoint().toString();
                if(!seen.add(key))continue;
                count++;
                writer.write("## Function "+count+" "+f.getName()+" @"+key+" depth="+item.depth+"\n");
                writer.write("- size_addresses="+f.getBody().getNumAddresses()+"\n");
                List<Function> callees=new ArrayList<>(f.getCalledFunctions(monitor));
                callees.sort(Comparator.comparing(Function::getName));
                writer.write("- direct_calls="+callees.size()+"\n");
                int listed=0;
                for(Function callee:callees){
                    if(listed++>=60)break;
                    writer.write("  - "+callee.getName()+" @"+callee.getEntryPoint()+"\n");
                }
                // Follow at most 2 local call levels, never huge system library tails.
                if(item.depth<2){
                    int enqueued=0;
                    for(Function callee:callees){
                        String name=callee.getName();
                        if(name.startsWith("FUN_") || name.toLowerCase().contains("expression2")){
                            if(enqueued++<20)queue.addLast(new Entry(callee,item.depth+1));
                        }
                    }
                }
                if(f.getName().equals("Java_ai_bithuman_expression2_Native_stepHistoryInputIndex")){
                    extra.write("## STEP_HISTORY_INDEX_DISASSEMBLY\n");
                    InstructionIterator it=currentProgram.getListing().getInstructions(f.getBody(),true);
                    while(it.hasNext()) {
                        Instruction instruction=it.next();
                        extra.write(instruction.getAddress()+" "+instruction.toString()+"\n");
                    }
                }
                DecompileResults decomp=decoder.decompileFunction(f,20,monitor);
                if(decomp!=null && decomp.decompileCompleted() && decomp.getDecompiledFunction()!=null){
                    ok++;
                    String source=decomp.getDecompiledFunction().getC();
                    if(f.getName().startsWith("Java_ai_bithuman_expression2_Native_") ||
                      Set.of("FUN_001a8404","FUN_001aa594","FUN_001a45a4","FUN_001a7fbc",
                        "FUN_001a7cfc","FUN_001a3608","FUN_001a62e0","FUN_001a5fdc",
                        "FUN_001a6804","FUN_001a2e60").contains(f.getName())) {
                      extra.write("\n\n#### "+f.getName()+" @"+key+"\n");
                      extra.write(source.substring(0,Math.min(110000,source.length())));
                      extra.flush();
                    }
                    String[] lines=source.split("\n");
                    int matched=0;
                    for(int i=0;i<lines.length;i++){
                        if(!focus.matcher(lines[i]).find())continue;
                        matched++;
                        if(matched>24)break;
                        String snippet=lines[i].trim();
                        if(snippet.length()>250)snippet=snippet.substring(0,250);
                        writer.write("  * clue-line-"+i+": "+snippet+"\n");
                    }
                    matchCount+=matched;
                    writer.write("- decompiler=SUCCESS clue_lines="+matched+"\n");
                } else {
                    writer.write("- decompiler=FAILED\n");
                }
                writer.write("\n");
                writer.flush();
            }
            writer.write("\n## Summary\n");
            writer.write("- visited_functions="+count+"\n");
            writer.write("- decompiled="+ok+"\n");
            writer.write("- matching_clue_lines="+matchCount+"\n");
            writer.write("- Note: call graph is not proof of decoder channel semantics.\n");
        } finally {
            extra.close();
            decoder.dispose();
        }
        println("BITHUMAN_JNI_GHIDRA_VISITED="+count+" DECOMPILED="+ok+" CLUES="+matchCount);
        if(count<2 || ok<1)throw new IllegalStateException("Native decompiler did not process expected JNI functions");
    }
}
