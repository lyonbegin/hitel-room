package com.hitel.zocbodiag;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

/** App-private offline storage for documents independently authorized for offline use.
 * The trusted caller must supply the authorization and current account identity.
 * This class does not obtain authorization, access network data, or alter original viewer caches.
 */
public final class OfflinePdfStore {
    private static final long MAX_BYTES = 128L * 1024L * 1024L;
    private final File root;
    public OfflinePdfStore(File appFilesDir) throws IOException {
        root = new File(appFilesDir, "hitel_offline_pdf");
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("offline directory");
    }
    public static final class Grant {
        public final String account, id, title;
        public final long expiresAt;
        public Grant(String account, String id, String title, long expiresAt) {
            if (account == null || account.isEmpty() || id == null || id.isEmpty()
                || account.length() > 1024 || id.length() > 1024 || title == null || title.length() > 4096)
                throw new IllegalArgumentException("invalid document identity");
            this.account = account; this.id = id; this.title = title; this.expiresAt = expiresAt;
        }
    }
    public static final class Document {
        public final File pdf;
        public final String title;
        Document(File pdf, String title) { this.pdf = pdf; this.title = title; }
    }
    private static MessageDigest digest() throws IOException {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (Exception e) { throw new IOException(e); }
    }
    private static String hex(byte[] a) {
        StringBuilder s = new StringBuilder(a.length * 2);
        for (byte b : a) s.append(Character.forDigit((b >>> 4) & 15, 16)).append(Character.forDigit(b & 15, 16));
        return s.toString();
    }
    private static String hash(String s) throws IOException {
        return hex(digest().digest(s.getBytes(StandardCharsets.UTF_8)));
    }
    private File folder(String account, String id) throws IOException {
        if (account == null || account.isEmpty() || id == null || id.isEmpty())
            throw new IOException("document identity missing");
        return new File(new File(root, hash(account)), hash(id));
    }
    private static void validHeader(byte[] b) throws IOException {
        if (b[0] != 37 || b[1] != 80 || b[2] != 68 || b[3] != 70 || b[4] != 45)
            throw new IOException("not a PDF");
    }
    private static void removeStaging(File f) {
        File[] children = f.listFiles();
        if (children != null) for (File c : children) removeStaging(c);
        f.delete();
    }
    /** Ownership of input transfers to this method. No partial document is published. */
    public synchronized Document save(Grant grant, InputStream input, long now) throws IOException {
        if (input == null) throw new IOException("no input");
        try (InputStream in = input) {
            if (grant == null || grant.expiresAt <= now) throw new IOException("offline authorization absent or expired");
            File parent = folder(grant.account, grant.id);
            if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("document directory");
            File stage = new File(parent, ".stage-" + UUID.randomUUID());
            if (!stage.mkdir()) throw new IOException("staging directory");
            try {
                File pdf = new File(stage, "document.pdf");
                MessageDigest md = digest();
                long size = 0;
                try (FileOutputStream out = new FileOutputStream(pdf)) {
                    byte[] header = new byte[5];
                    new DataInputStream(in).readFully(header);
                    validHeader(header);
                    out.write(header); md.update(header); size = header.length;
                    byte[] buf = new byte[32768];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        if (n == 0) continue;
                        if (size + n > MAX_BYTES) throw new IOException("PDF exceeds limit");
                        out.write(buf, 0, n); md.update(buf, 0, n); size += n;
                    }
                    out.getFD().sync();
                }
                try (FileOutputStream file = new FileOutputStream(new File(stage, "metadata"));
                     DataOutputStream out = new DataOutputStream(file)) {
                    out.writeInt(1); out.writeUTF(grant.title); out.writeLong(grant.expiresAt);
                    out.writeLong(size); out.writeUTF(hex(md.digest())); out.flush(); file.getFD().sync();
                }
                File generation = new File(parent, "doc-" + UUID.randomUUID());
                if (!stage.renameTo(generation)) throw new IOException("publish document");
                File pointer = new File(parent, ".current-" + UUID.randomUUID());
                try {
                    try (FileOutputStream out = new FileOutputStream(pointer)) {
                        out.write(generation.getName().getBytes(StandardCharsets.UTF_8)); out.getFD().sync();
                    }
                    if (!pointer.renameTo(new File(parent, "current"))) throw new IOException("publish pointer");
                } finally { pointer.delete(); }
                return new Document(new File(generation, "document.pdf"), grant.title);
            } finally { removeStaging(stage); }
        }
    }
    /** Only previously authorized, unexpired documents belonging to this account. */
    public synchronized Document open(String account, String id, long now) throws IOException {
        File parent = folder(account, id);
        String generation;
        try (InputStream in = new FileInputStream(new File(parent, "current"))) {
            byte[] b = new byte[64]; int n = in.read(b);
            if (n < 0 || in.read() != -1) throw new IOException("invalid pointer");
            generation = new String(b, 0, n, StandardCharsets.UTF_8);
        }
        if (!generation.matches("doc-[0-9a-f-]{36}")) throw new IOException("invalid generation");
        File dir = new File(parent, generation);
        File pdf = new File(dir, "document.pdf");
        String title, expected; long length, expiration;
        try (DataInputStream in = new DataInputStream(new FileInputStream(new File(dir, "metadata")))) {
            if (in.readInt() != 1) throw new IOException("unsupported metadata");
            title = in.readUTF(); expiration = in.readLong(); length = in.readLong(); expected = in.readUTF();
        }
        if (expiration <= now || !pdf.isFile() || length < 5 || length > MAX_BYTES || pdf.length() != length)
            throw new IOException("offline document unavailable");
        MessageDigest md = digest();
        try (InputStream in = new FileInputStream(pdf)) {
            byte[] header = new byte[5]; new DataInputStream(in).readFully(header);
            validHeader(header); md.update(header);
            byte[] buf = new byte[32768]; int n;
            while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
        }
        if (!expected.equals(hex(md.digest()))) throw new IOException("PDF integrity check failed");
        return new Document(pdf, title);
    }
}
