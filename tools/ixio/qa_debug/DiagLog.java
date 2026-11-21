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
    private static final String IMPORTANT_FILE = "hitel_ixio_important.txt";
    private static final int MAX_BYTES = 2097152;
    private static volatile Context context;
    private static long sequence;

    private DiagLog() {}

    public static synchronized void initialize(Context app) {
        if (app == null) return;
        context = app.getApplicationContext();
        event("APP", "DIAGNOSTIC_READY build=ORIGINAL_FLOW_TRACE_20261122 sdk=" + Build.VERSION.SDK_INT);
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
        if (label.length() > 1200) label = label.substring(0, 1200);
        String time = new SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.KOREA)
                .format(new Date());
        String row = time + " #" + (++sequence) + " pid=" + android.os.Process.myPid()
                + " tid=" + android.os.Process.myTid() + " [" + group + "] " + label;
        Log.i(TAG, row);
        File f = file();
        if (f == null) return;
        try {
            append(f, row);
            if (important(group, label)) append(new File(f.getParentFile(), IMPORTANT_FILE), row);
        } catch (Exception e) {
            Log.w(TAG, "INTERNAL_LOG_FILE_WRITE_FAILED " + e.getClass().getSimpleName());
        }
    }

    private static boolean important(String group, String label) {
        if (group.equals("APP") || group.equals("UI") || group.equals("RECORD")
                || group.contains("RETRY_ERROR") || group.contains("RECORD_START")
                || group.equals("IXIO_QA_GATE") || group.equals("IXIO_MODEL_WIRE")) return true;
        if (!group.equals("FLOW")) return false;
        if (label.contains(" CATCH ") || label.contains(" THROW ") || label.contains("QA_VAS_GATE")
                || label.contains("recordingCallback") || label.contains("CallRecordingManager.")
                || label.contains("RecordRepository.switchRecord") || label.contains("SettingViewModel.onEvent")
                || label.contains("startDownloadMissingAiModels") || label.contains("DownloadViewModel.")
                || label.contains("DownloadWorker.buildWorkerResult") || label.contains("DownloadWorker.doWork RETURN")
                || label.contains("FileUnzipWorker.doWork") || label.contains("replaceTempFileWithFinalFile")
                || label.contains("getResponseCode") || label.contains("onError ARG")) return true;
        return label.contains(" RETURN ") && (label.contains("canStartDownload")
                || label.contains("checkDownloadAvailability") || label.contains("CheckAiModelAvailabilityUseCaseImpl")
                || label.contains("CheckRecordingAvailabilityUseCaseImpl"));
    }

    private static void append(File f, String row) throws java.io.IOException {
            if (f.exists() && f.length() > MAX_BYTES) {
                // bounded file rotation, never retain unbounded logs
                File previous = new File(f.getParentFile(), f.getName() + ".old");
                if (previous.exists()) previous.delete();
                f.renameTo(previous);
            }
            try (FileOutputStream os = new FileOutputStream(f, true)) {
                os.write((row + "\n").getBytes(StandardCharsets.UTF_8));
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
            File important = new File(f.getParentFile(), IMPORTANT_FILE);
            s.append("\n=== IMPORTANT ORIGINAL CALLS AND OUTCOMES ===\n");
            s.append(readFile(new File(f.getParentFile(), IMPORTANT_FILE + ".old")));
            s.append(readFile(important));
            s.append("\n=== RECENT FULL FUNCTION TRACE ===\n");
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
        boolean ok = true;
        for (String name : new String[]{FILE, FILE + ".old", IMPORTANT_FILE, IMPORTANT_FILE + ".old"}) {
            File item = new File(f.getParentFile(), name);
            if (item.exists() && !item.delete()) ok = false;
        }
        return ok;
    }

    public static synchronized String copySnapshot() {
        String text = snapshot();
        if (text.length() < 240000) return text;
        // A large uncompressed ClipData can exceed Android Binder's limit.
        // Preserve every available row in a reversible text representation.
        try {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            try (java.util.zip.GZIPOutputStream gzip = new java.util.zip.GZIPOutputStream(bytes)) {
                gzip.write(text.getBytes(StandardCharsets.UTF_8));
            }
            String encoded = android.util.Base64.encodeToString(bytes.toByteArray(), android.util.Base64.DEFAULT);
            return "HITEL IXIO QA / TRACE_ENCODING=GZIP_BASE64\nUNCOMPRESSED_CHARACTERS="
                    + text.length() + "\nTRACE_GZIP_BASE64=" + encoded;
        } catch (Exception ignored) { return text; }
    }
}

