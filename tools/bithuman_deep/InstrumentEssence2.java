import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Label;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;

/** Instruments SDK-internal JVM call sites while keeping original JNI symbols and descriptors. */
public final class InstrumentEssence2 implements Opcodes {
    private static final String PACKAGE = "ai/bithuman/elevate/";
    private static final String NATIVE = PACKAGE + "NativeBridge";
    private static final String BRIDGE = PACKAGE + "HitelProbeBridge";
    private static final String PROBE = "ai/bithuman/flutter/HitelSdkProbe";
    private static final Set<String> CALLS = Set.of(
        "nativeCreate", "nativeDestroy", "nativeHwEnable", "nativeHwBuffer",
        "nativeHwLast", "nativeHwRelease", "nativeA2xCreate", "nativeA2xPush",
        "nativeA2xAvail", "nativeA2xPull", "nativeA2xFinish", "nativeA2xReset",
        "nativeA2xDestroy", "nativeRenderKpBorrow", "nativeRenderDriveBorrow",
        "nativeRenderStatus", "nativeRenderReason", "nativeTesseraStats", "nativeTesseraReason",
        "nativeTesseraAttachBundle", "nativeA2xTotal", "nativeA2xLastError",
        "nativeBorrowDrain", "nativeBorrowFlush", "nativeBorrowPurge", "nativePlayoutSet");

    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("input.aar output.aar");
        final var calls = new LinkedHashMap<String, String>();
        final byte[] output = rewriteZip(Files.readAllBytes(Path.of(args[0])), (name, content) ->
            name.equals("classes.jar") ? instrumentJar(content, calls) : content, Map.of());
        for (String required : Set.of("nativeA2xAvail", "nativeRenderKpBorrow", "nativeHwBuffer")) {
            if (!calls.containsKey(required)) throw new IllegalStateException("SDK call is missing: " + required);
        }
        Files.write(Path.of(args[1]), output);
        calls.forEach((name, desc) -> System.out.println("SDK_JNI_DESCRIPTOR " + name + " " + desc));
        System.out.println("PASS_ESSENCE2_SDK_INTERNAL_JNI_PROBES " + String.join(",", calls.keySet()));
    }

    private static byte[] instrumentJar(byte[] jar, Map<String, String> calls) throws Exception {
        final byte[] patched = rewriteZip(jar, (name, content) -> {
            if (name.equals(BRIDGE + ".class")) throw new IllegalStateException("SDK already instrumented");
            if (name.startsWith(PACKAGE + "Essence2Avatar") || name.startsWith(PACKAGE + "ElevateFrames")) {
                return instrumentClass(content, calls);
            }
            return content;
        }, Map.of());
        return rewriteZip(patched, (name, content) -> content, Map.of(BRIDGE + ".class", bridge(calls)));
    }

    private static byte[] instrumentClass(byte[] content, Map<String, String> calls) {
        final var reader = new ClassReader(content);
        final var writer = new ClassWriter(reader, 0);
        reader.accept(new ClassVisitor(ASM9, writer) {
            @Override public MethodVisitor visitMethod(int access, String name, String desc,
                                                        String signature, String[] exceptions) {
                final var method = super.visitMethod(access, name, desc, signature, exceptions);
                return new MethodVisitor(ASM9, method) {
                    @Override public void visitMethodInsn(int opcode, String owner, String name,
                                                          String descriptor, boolean isInterface) {
                        if (opcode == INVOKESTATIC && owner.equals(NATIVE) && CALLS.contains(name)) {
                            final String known = calls.putIfAbsent(name, descriptor);
                            if (known != null && !known.equals(descriptor)) {
                                throw new IllegalStateException("Unexpected SDK overload: " + name);
                            }
                            owner = BRIDGE;
                        }
                        super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
                    }
                };
            }
        }, 0);
        return writer.toByteArray();
    }

    private static byte[] bridge(Map<String, String> calls) {
        final var cls = new ClassWriter(ClassWriter.COMPUTE_FRAMES | ClassWriter.COMPUTE_MAXS);
        cls.visit(V1_8, ACC_FINAL | ACC_SUPER, BRIDGE, null, "java/lang/Object", null);
        calls.forEach((name, desc) -> {
            final var method = cls.visitMethod(ACC_STATIC, name, desc, null, null);
            method.visitCode();
            final Type[] args = Type.getArgumentTypes(desc);
            final Type result = Type.getReturnType(desc);
            int size = 0;
            for (Type arg : args) size += arg.getSize();
            final int start = size;
            final int cpu = start + 2;
            final int value = cpu + 2;
            final int failed = value + result.getSize();
            method.visitLdcInsn(name);
            method.visitMethodInsn(INVOKESTATIC, PROBE, "begin", "(Ljava/lang/String;)J", false);
            method.visitVarInsn(LSTORE, start);
            method.visitVarInsn(LLOAD, start);
            method.visitMethodInsn(INVOKESTATIC, PROBE, "cpuStart", "(J)J", false);
            method.visitVarInsn(LSTORE, cpu);
            final var from = new Label();
            final var to = new Label();
            final var handler = new Label();
            method.visitTryCatchBlock(from, to, handler, "java/lang/Throwable");
            method.visitLabel(from);
            // Audited SDK 0.9.5 JVM descriptors: argument 4 is the provider request;
            // never change it or any other creation arguments.
            if (name.equals("nativeCreate") || name.equals("nativeA2xCreate")) {
                final String expected = name.equals("nativeCreate")
                    ? "(Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;ZI)J"
                    : "(Ljava/lang/String;Ljava/lang/String;ILjava/lang/String;)J";
                if (!desc.equals(expected)) throw new IllegalStateException("Changed create ABI: " + desc);
                method.visitLdcInsn(name);
                method.visitVarInsn(ALOAD, 3);
                method.visitVarInsn(ILOAD, 2);
                if (name.equals("nativeCreate")) method.visitVarInsn(ILOAD, 5);
                else method.visitInsn(ICONST_M1);
                method.visitMethodInsn(INVOKESTATIC, PROBE, "observeCreateArgs",
                    "(Ljava/lang/String;Ljava/lang/String;II)V", false);
            }
            if (Set.of("nativeHwEnable", "nativeHwBuffer", "nativeHwRelease").contains(name)) {
                if (args.length != 2 || args[0].getSort() != Type.LONG || args[1].getSort() != Type.INT)
                    throw new IllegalStateException("Changed HardwareBuffer ABI: " + desc);
                method.visitLdcInsn(name);
                method.visitVarInsn(ILOAD, 2);
                method.visitMethodInsn(INVOKESTATIC, PROBE, "observeSlot", "(Ljava/lang/String;I)V", false);
            }
            int slot = 0;
            for (Type arg : args) {
                method.visitVarInsn(arg.getOpcode(ILOAD), slot);
                slot += arg.getSize();
            }
            method.visitMethodInsn(INVOKESTATIC, NATIVE, name, desc, false);
            if (result.getSort() != Type.VOID) method.visitVarInsn(result.getOpcode(ISTORE), value);
            method.visitLabel(to);
            finish(method, name, start, cpu, false);
            if (Set.of("nativeA2xAvail", "nativeA2xPull", "nativeRenderKpBorrow",
                       "nativeRenderDriveBorrow", "nativeHwEnable", "nativeHwBuffer", "nativeHwLast",
                       "nativeRenderStatus", "nativeRenderReason", "nativeTesseraStats", "nativeTesseraReason",
                       "nativeTesseraAttachBundle", "nativeA2xTotal", "nativeA2xLastError").contains(name)) {
                int sort = result.getSort();
                if (sort == Type.INT || sort == Type.LONG || sort == Type.BOOLEAN || sort == Type.ARRAY) {
                    method.visitLdcInsn(name);
                    if (sort == Type.ARRAY) {
                        method.visitVarInsn(ALOAD, value);
                        method.visitMethodInsn(INVOKESTATIC, PROBE, "arrayLength", "(Ljava/lang/Object;)J", false);
                    } else {
                        method.visitVarInsn(result.getOpcode(ILOAD), value);
                        if (sort != Type.LONG) method.visitInsn(I2L);
                    }
                    method.visitLdcInsn(result.getDescriptor());
                    method.visitMethodInsn(INVOKESTATIC, PROBE, "observeResult", "(Ljava/lang/String;JLjava/lang/String;)V", false);
                } else if (sort == Type.OBJECT) {
                    method.visitLdcInsn(name);
                    method.visitVarInsn(ALOAD, value);
                    method.visitMethodInsn(INVOKESTATIC, PROBE, "observeObject", "(Ljava/lang/String;Ljava/lang/Object;)V", false);
                }
            }
            // Query existing SDK status/reason getters after creation/attachment and
            // at a rate-limited render boundary on the same SDK caller thread.
            if (Set.of("nativeTesseraAttachBundle", "nativeHwEnable", "nativeRenderKpBorrow",
                       "nativeRenderDriveBorrow").contains(name)) {
                if (args.length == 0 || args[0].getSort() != Type.LONG)
                    throw new IllegalStateException("Changed render ABI: " + desc);
                method.visitLdcInsn(name);
                method.visitVarInsn(LLOAD, 0);
                method.visitMethodInsn(INVOKESTATIC, PROBE, "observeBackend",
                    "(Ljava/lang/String;J)V", false);
            }
            if (name.equals("nativeCreate") || name.equals("nativeA2xCreate")) {
                method.visitLdcInsn(name);
                method.visitVarInsn(LLOAD, value);
                method.visitMethodInsn(INVOKESTATIC, PROBE, "observeCreated",
                    "(Ljava/lang/String;J)V", false);
            }
            if (result.getSort() != Type.VOID) method.visitVarInsn(result.getOpcode(ILOAD), value);
            method.visitInsn(result.getOpcode(IRETURN));
            method.visitLabel(handler);
            method.visitVarInsn(ASTORE, failed);
            finish(method, name, start, cpu, true);
            method.visitVarInsn(ALOAD, failed);
            method.visitInsn(ATHROW);
            method.visitMaxs(0, 0);
            method.visitEnd();
        });
        cls.visitEnd();
        return cls.toByteArray();
    }

    private static void finish(MethodVisitor method, String name, int start, int cpu, boolean failed) {
        method.visitLdcInsn(name);
        method.visitVarInsn(LLOAD, start);
        method.visitVarInsn(LLOAD, cpu);
        method.visitInsn(failed ? ICONST_1 : ICONST_0);
        method.visitMethodInsn(INVOKESTATIC, PROBE, "finish", "(Ljava/lang/String;JJZ)V", false);
    }

    @FunctionalInterface private interface Transform {
        byte[] apply(String name, byte[] raw) throws Exception;
    }

    private static byte[] rewriteZip(byte[] input, Transform transform, Map<String, byte[]> extra) throws Exception {
        final var bytes = new ByteArrayOutputStream();
        try (var in = new ZipInputStream(new ByteArrayInputStream(input)); var out = new ZipOutputStream(bytes)) {
            for (ZipEntry entry; (entry = in.getNextEntry()) != null;) {
                out.putNextEntry(new ZipEntry(entry.getName()));
                out.write(transform.apply(entry.getName(), in.readAllBytes()));
                out.closeEntry();
            }
            for (var entry : extra.entrySet()) {
                out.putNextEntry(new ZipEntry(entry.getKey()));
                out.write(entry.getValue());
                out.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
}
