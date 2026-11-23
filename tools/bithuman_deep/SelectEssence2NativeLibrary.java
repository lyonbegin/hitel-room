import org.objectweb.asm.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.*;

/** Change only the NativeBridge le_jni loader string into a process-scoped loader callback. */
public final class SelectEssence2NativeLibrary {
  private static final String CLASS_NAME = "ai/bithuman/elevate/NativeBridge.class";
  private static int changes;
  private static byte[] patch(byte[] cls) {
    ClassReader reader = new ClassReader(cls);
    ClassWriter writer = new ClassWriter(0);
    reader.accept(new ClassVisitor(Opcodes.ASM9, writer) {
      @Override public MethodVisitor visitMethod(int access, String name, String desc,
        String signature, String[] exceptions) {
        MethodVisitor v = super.visitMethod(access, name, desc, signature, exceptions);
        if (!"<clinit>".equals(name)) return v;
        return new MethodVisitor(Opcodes.ASM9, v) {
          @Override public void visitLdcInsn(Object cst) {
            if ("le_jni".equals(cst)) {
              super.visitMethodInsn(Opcodes.INVOKESTATIC,
                "ai/bithuman/flutter/HitelSdkLoader", "libraryForProcess",
                "()Ljava/lang/String;", false);
              changes++;
            } else super.visitLdcInsn(cst);
          }
        };
      }
    }, 0);
    if (changes != 1) throw new IllegalStateException("Expected one native loader site, found "+changes);
    return writer.toByteArray();
  }
  private static byte[] rezip(byte[] zipped,String target,byte[] replacement) throws Exception {
    ByteArrayOutputStream out=new ByteArrayOutputStream();
    boolean found=false;
    try (ZipInputStream in=new ZipInputStream(new ByteArrayInputStream(zipped));
         ZipOutputStream z=new ZipOutputStream(out)) {
      ZipEntry e;
      while ((e=in.getNextEntry())!=null) {
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();
        in.transferTo(bytes);
        ZipEntry dst=new ZipEntry(e.getName());
        dst.setTime(e.getTime());
        z.putNextEntry(dst);
        z.write(e.getName().equals(target)?replacement:bytes.toByteArray());
        z.closeEntry();
        if(e.getName().equals(target))found=true;
      }
    }
    if(!found)throw new IllegalStateException("Missing "+target);
    return out.toByteArray();
  }
  private static byte[] fromZip(byte[] zip,String member) throws Exception {
    try(ZipInputStream in=new ZipInputStream(new ByteArrayInputStream(zip))) {
      ZipEntry e;
      while((e=in.getNextEntry())!=null)
        if(e.getName().equals(member))return in.readAllBytes();
    }
    throw new IllegalStateException("Missing "+member);
  }
  public static void main(String[] args) throws Exception {
    if(args.length!=2)throw new IllegalArgumentException("source.aar output.aar");
    byte[] aar=Files.readAllBytes(Path.of(args[0]));
    byte[] jar=fromZip(aar,"classes.jar");
    byte[] original=fromZip(jar,CLASS_NAME);
    byte[] modified=patch(original);
    byte[] replacedJar=rezip(jar,CLASS_NAME,modified);
    byte[] replacedAar=rezip(aar,"classes.jar",replacedJar);
    for(String lib:new String[]{"jni/arm64-v8a/lible_jni.so","jni/arm64-v8a/libonnxruntime.so"}) {
      try {
        if(!Arrays.equals(fromZip(aar,lib),fromZip(replacedAar,lib)))
          throw new AssertionError("Native asset mutated "+lib);
      } catch (IllegalStateException missing) {
        if(!missing.getMessage().startsWith("Missing "))throw missing;
      }
    }
    if(Arrays.equals(original,modified))throw new AssertionError("NativeBridge unchanged");
    Files.write(Path.of(args[1]),replacedAar);
    System.out.println("PASS_SINGLE_APK_ESSENCE2_DUAL_NATIVE_SELECTOR_ONE_LOADER_SITE");
    System.out.println("NativeBridge class changed only; both JNI exports untouched");
  }
}
