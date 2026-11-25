package com.hitel.zocbodiag;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public final class OfflinePdfStoreTest {
    interface Checked { void run() throws Exception; }
    static void fails(Checked c) throws Exception {
        try { c.run(); } catch (IOException expected) { return; }
        throw new AssertionError("expected IOException");
    }
    static void check(boolean b) { if (!b) throw new AssertionError(); }
    public static void main(String[] args) throws Exception {
        File root = Files.createTempDirectory("r7-offline").toFile();
        OfflinePdfStore s = new OfflinePdfStore(root);
        byte[] a = "%PDF-1.4\\nfixture A".getBytes(StandardCharsets.US_ASCII);
        byte[] b = "%PDF-1.4\\nfixture B".getBytes(StandardCharsets.US_ASCII);
        OfflinePdfStore.Grant grant = new OfflinePdfStore.Grant("account1", "42", "시험지", 2000);
        fails(() -> s.save(null, new ByteArrayInputStream(a), 1000));
        fails(() -> s.save(grant, new ByteArrayInputStream(a), 2000));
        fails(() -> s.save(grant, new ByteArrayInputStream(new byte[10]), 1000));
        s.save(grant, new ByteArrayInputStream(a), 1000);
        OfflinePdfStore.Document d = s.open("account1", "42", 1001);
        check(java.util.Arrays.equals(a, Files.readAllBytes(d.pdf.toPath())));
        check(d.title.equals("시험지"));
        fails(() -> s.open("account2", "42", 1001));
        fails(() -> s.open("account1", "42", 2000));
        fails(() -> s.save(grant, new ByteArrayInputStream(new byte[2]), 1000));
        check(java.util.Arrays.equals(a, Files.readAllBytes(s.open("account1", "42", 1001).pdf.toPath())));
        s.save(grant, new ByteArrayInputStream(b), 1000);
        d = s.open("account1", "42", 1001);
        check(java.util.Arrays.equals(b, Files.readAllBytes(d.pdf.toPath())));
        final int[] renderCount = {0};
        OfflinePdfController c = new OfflinePdfController(s);
        OfflinePdfController.Renderer renderer = (file, title) -> {check(file.isFile()); renderCount[0]++;};
        c.received(grant, new ByteArrayInputStream(a), false, 1000, renderer);
        check(renderCount[0] == 0);
        c.received(grant, new ByteArrayInputStream(b), true, 1000, renderer);
        check(renderCount[0] == 1);
        c.reopen("account1", "42", 1001, renderer);
        check(renderCount[0] == 2);
        d = s.open("account1", "42", 1001);
        try (RandomAccessFile f = new RandomAccessFile(d.pdf, "rw")) { f.seek(7); f.write(12); }
        fails(() -> s.open("account1", "42", 1001));
        System.out.println("PASS authorized offline save, reopen, metadata, account isolation, expiry, invalid input, atomic replacement, tamper rejection");
    }
}
