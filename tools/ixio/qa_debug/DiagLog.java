package com.lguplus.aicallagent.hitelqa;

import android.content.Context;
import android.os.Build;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** HITEL QA only. Fixed diagnostic events, never account data, tokens or audio. */
public final class DiagLog {
    private static final String TAG = "HITEL_IXIO_DIAG";
    private static final String FILE = "hitel_ixio_diagnostic.txt";
    private static final int MAX_BYTES = 196608;
    private static volatile Context context;

    private DiagLog() {}

    public static synchronized void initialize(Context app) {
        if (app == null) return;
        context = app.getApplicationContext();
        event("APP", "DIAGNOSTIC_READY sdk=" + Build.VERSION.SDK_INT);
    }

    private static File file() {
        Context c = context;
        return c == null ? null : new File(c.getFilesDir(), FILE);
    }

    public static synchronized void event(String group, String label) {
        if (group == null || label == null) return;
        // Instrumentation calls this method only with hardcoded state labels,
        // fixed event names and boolean values. Reject control characters.
        group = group.replaceAll("[^A-Za-z0-9_]", "_");
        label = label.replaceAll("[\r\n\t]", " ");
        if (label.length() > 210) label = label.substring(0, 210);
        String time = new SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.KOREA)
                .format(new Date());
        String row = time + " [" + group + "] " + label;
        Log.i(TAG, row);
        File f = file();
        if (f == null) return;
        try {
            if (f.exists() && f.length() > MAX_BYTES) {
                // bounded file rotation, never retain unbounded logs
                File previous = new File(f.getParentFile(), FILE + ".old");
                if (previous.exists()) previous.delete();
                f.renameTo(previous);
            }
            try (FileOutputStream os = new FileOutputStream(f, true)) {
                os.write((row + "\n").getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            Log.w(TAG, "INTERNAL_LOG_FILE_WRITE_FAILED " + e.getClass().getSimpleName());
        }
    }

    private static String readFile(File f) {
        if (f == null || !f.exists()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            long len = Math.min(f.length(), MAX_BYTES + 4096);
            if (len > Integer.MAX_VALUE) len = Integer.MAX_VALUE;
            byte[] bytes = new byte[(int)len];
            int done = 0;
            while (done < bytes.length) {
                int n = in.read(bytes, done, bytes.length - done);
                if (n < 0) break;
                done += n;
            }
            return new String(bytes, 0, done, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "[LOG_READ_FAILED: " + e.getClass().getSimpleName() + "]\n";
        }
    }

    public static synchronized String snapshot() {
        File f = file();
        StringBuilder s = new StringBuilder();
        s.append("HITEL IXIO QA / 진단 로그\n");
        s.append("Android ").append(Build.VERSION.SDK_INT).append("\n");
        if (f != null) {
            File old = new File(f.getParentFile(), FILE + ".old");
            s.append(readFile(old));
            s.append(readFile(f));
        }
        if (s.length() < 70) s.append("\n로그가 없습니다. 로그 지우기 후 통화를 시험해 주십시오.\n");
        return s.toString();
    }

    public static synchronized boolean clear() {
        File f = file();
        if (f == null) return false;
        File old = new File(f.getParentFile(), FILE + ".old");
        return (!f.exists() || f.delete()) && (!old.exists() || old.delete());
    }
}
