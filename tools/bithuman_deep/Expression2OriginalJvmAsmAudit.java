// Original bytecode ONLY. Uses ASM ClassReader + Tree API, never ClassWriter.
// Compiles with org.ow2.asm:asm, asm-tree version 9.7.1.
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;
import org.objectweb.asm.*;
import org.objectweb.asm.tree.*;

public final class Expression2OriginalJvmAsmAudit {
  static String safe(String s) {
    return s == null ? "" : s.replace('\t',' ').replace('\r',' ').replace('\n',' ');
  }
  static String handle(Handle h) {
    return h == null ? "" : h.getOwner()+"."+h.getName()+h.getDesc();
  }
  public static void main(String[] args) throws Exception {
    if(args.length != 2) throw new IllegalArgumentException("usage: original-classes.jar output-directory");
    Path root=Paths.get(args[1]); Files.createDirectories(root);
    int clsCount=0,methodCount=0,nativeCount=0,jvmCalls=0,indyCalls=0,
        jumpCount=0,exceptionBlocks=0,refusalStrings=0,loadLib=0;
    try (ZipFile jar=new ZipFile(args[0]);
         PrintWriter classes=new PrintWriter(Files.newBufferedWriter(root.resolve("jvm-classes.tsv")));
         PrintWriter methods=new PrintWriter(Files.newBufferedWriter(root.resolve("jvm-methods.tsv")));
         PrintWriter calls=new PrintWriter(Files.newBufferedWriter(root.resolve("jvm-calls.tsv")));
         PrintWriter strings=new PrintWriter(Files.newBufferedWriter(root.resolve("jvm-string-references.tsv")));
         PrintWriter natives=new PrintWriter(Files.newBufferedWriter(root.resolve("jvm-native-methods.tsv")))) {
      classes.println("internal_class\tsuperclass\tinterfaces\tfields\tmethods\tversion\taccess");
      methods.println("class\tname\tdescriptor\taccess\tnative\tinstructions\tinvoke_calls\tinvokedynamic\tjumps\ttrycatch_blocks");
      calls.println("class\tmethod\tdescriptor\tinstruction_index\topcode\ttarget_class\ttarget_method\ttarget_descriptor\tkind");
      strings.println("class\tmethod\tdescriptor\tinstruction_index\tliteral");
      natives.println("class\tname\tdescriptor\taccess");
      Enumeration<? extends ZipEntry> it=jar.entries();
      while(it.hasMoreElements()){
        ZipEntry entry=it.nextElement();
        if(!entry.getName().endsWith(".class")) continue;
        byte[] data;
        try(InputStream in=jar.getInputStream(entry)){data=in.readAllBytes();}
        ClassReader cr=new ClassReader(data);
        ClassNode cn=new ClassNode(Opcodes.ASM9);
        cr.accept(cn,0); // preserve/debug/frames parsed; no bytecode transform
        ++clsCount;
        classes.printf("%s\t%s\t%s\t%d\t%d\t%d\t%d%n",
            safe(cn.name),safe(cn.superName),safe(String.join(";",cn.interfaces)),
            cn.fields.size(),cn.methods.size(),cn.version,cn.access);
        for(MethodNode m:cn.methods){
          ++methodCount; boolean nativeMethod=(m.access & Opcodes.ACC_NATIVE)!=0;
          if(nativeMethod){++nativeCount;natives.printf("%s\t%s\t%s\t%d%n",cn.name,m.name,m.desc,m.access);}
          int invokes=0,indys=0,jumps=0,idx=0;
          for(AbstractInsnNode ins:m.instructions){
            if(ins instanceof MethodInsnNode){
              MethodInsnNode c=(MethodInsnNode)ins;
              calls.printf("%s\t%s\t%s\t%d\t%d\t%s\t%s\t%s\tMETHOD%n",
                  cn.name,m.name,m.desc,idx,ins.getOpcode(),c.owner,c.name,c.desc);
              ++jvmCalls;++invokes;
              if(c.owner.equals("java/lang/System") && c.name.equals("loadLibrary"))++loadLib;
            } else if(ins instanceof InvokeDynamicInsnNode){
              InvokeDynamicInsnNode c=(InvokeDynamicInsnNode)ins;
              calls.printf("%s\t%s\t%s\t%d\t%d\t%s\t%s\t%s\tINVOKEDYNAMIC%n",
                  cn.name,m.name,m.desc,idx,ins.getOpcode(),
                  c.bsm.getOwner(),c.name,c.desc);
              ++indyCalls;++indys;
            } else if(ins instanceof JumpInsnNode ||
                ins instanceof TableSwitchInsnNode ||
                ins instanceof LookupSwitchInsnNode){
              ++jumpCount;++jumps;
            } else if(ins instanceof LdcInsnNode){
              Object val=((LdcInsnNode)ins).cst;
              if(val instanceof String){
                String s=(String)val;
                strings.printf("%s\t%s\t%s\t%d\t%s%n",
                    cn.name,m.name,m.desc,idx,safe(s));
                if(s.contains("refusing to serve") || s.contains("no API secret")) ++refusalStrings;
              }
            }
            ++idx;
          }
          int catches=m.tryCatchBlocks==null?0:m.tryCatchBlocks.size();
          exceptionBlocks+=catches;
          methods.printf("%s\t%s\t%s\t%d\t%s\t%d\t%d\t%d\t%d\t%d%n",
             cn.name,m.name,m.desc,m.access,nativeMethod,
             m.instructions.size(),invokes,indys,jumps,catches);
        }
      }
    }
    String summary="{\n"+
      "  \"tool\": \"ASM 9.7.1 original JVM bytecode visitor\",\n"+
      "  \"jvm_classes\": "+clsCount+",\n"+
      "  \"jvm_methods\": "+methodCount+",\n"+
      "  \"native_method_declarations\": "+nativeCount+",\n"+
      "  \"method_invocation_sites\": "+jvmCalls+",\n"+
      "  \"invokedynamic_sites\": "+indyCalls+",\n"+
      "  \"branch_sites\": "+jumpCount+",\n"+
      "  \"trycatch_regions\": "+exceptionBlocks+",\n"+
      "  \"error_literal_sites\": "+refusalStrings+",\n"+
      "  \"system_loadLibrary_sites\": "+loadLib+",\n"+
      "  \"original_jvm_bytecode_rewritten\": false\n}\n";
    Files.writeString(root.resolve("jvm-asm-summary.json"),summary);
    if(clsCount<=20 || methodCount<=50)throw new IllegalStateException("Original classes.jar unexpectedly small");
    System.out.println("EXPR2_ORIGINAL_JVM_ASM_ALL_CLASSES_PASS classes="+clsCount+
        " methods="+methodCount+" native="+nativeCount+" callsites="+jvmCalls+
        " invokedynamic="+indyCalls+" literal_matches="+refusalStrings);
  }
}