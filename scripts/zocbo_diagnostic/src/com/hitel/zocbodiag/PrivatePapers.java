package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.pdf.PdfRenderer;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.WeakHashMap;

/** Stores a document only after the application's normal online viewer received it. */
public final class PrivatePapers {
  static final String EXAM = "EXTRA_PDF_EX_PAPR_NO";
  static final String TYPE = "EXTRA_PDF_FILE_TYPE";
  private static final String PREFS = "hitel_offline_papers_v1";
  private static final Handler main = new Handler(Looper.getMainLooper());
  private static final Map<Object, Job> jobs = new WeakHashMap<>();

  static final class Job {
    final WeakReference<Activity> host;
    final String owner, key, exam;
    volatile String title;
    volatile boolean finished;
    Job(Activity host, String owner, String key, String exam) {
      this.host = new WeakReference<>(host);
      this.owner = owner;
      this.key = key;
      this.exam = exam;
    }
  }

  static String account() {
    try {
      Class<?> mineType = Class.forName("com.eduzone.eduzoneviewer.ui.networkmodels.ResMine");
      Object mine = Class.forName("com.eduzone.eduzoneviewer.repository.k")
          .getMethod("b", String.class, Object.class).invoke(null, "PREF_MINE", mineType.newInstance());
      Object member = mineType.getMethod("getMemberInfo").invoke(mine);
      int id = ((Number)member.getClass().getMethod("getUserId").invoke(member)).intValue();
      return id > 0 ? digest("account/" + id) : "";
    } catch (Exception e) {
      return "";
    }
  }

  static String digest(String text) {
    try {
      byte[] data = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
      StringBuilder result = new StringBuilder(64);
      for (byte b : data) result.append(String.format(Locale.ROOT, "%02x", b & 255));
      return result.toString();
    } catch (java.security.NoSuchAlgorithmException e) { throw new AssertionError(e); }
  }

  static String documentKey(Intent intent) {
    String exam = intent.getStringExtra(EXAM);
    String type = intent.getStringExtra(TYPE);
    if (exam == null || exam.isEmpty()) return "";
    String pk = intent.getStringExtra("EXTRA_PDF_PRIMARY_KEY"), shortUrl = intent.getStringExtra("EXTRA_PDF_SHORT_URL");
    return digest(exam + "\n" + (type == null ? "" : type) + "\n"
        + (pk == null ? "" : pk) + "\n" + (shortUrl == null ? "" : shortUrl));
  }

  static boolean offline(Context context) {
    try {
      ConnectivityManager cm = (ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
      if (cm == null) return false;
      if (Build.VERSION.SDK_INT >= 23) {
        Network network = cm.getActiveNetwork();
        NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
        return caps == null || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            || !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
      }
      android.net.NetworkInfo info = cm.getActiveNetworkInfo();
      return info == null || !info.isConnected();
    } catch (SecurityException e) { return false; }
  }

  public static boolean offlineLaunch(Activity host) {
    if (!offline(host)) return false;
    Intent read = new Intent(host, NativePdfEntryActivity.class);
    String key = documentKey(host.getIntent());
    if (!key.isEmpty()) read.putExtra("paper", key);
    host.startActivity(read);
    host.finish();
    return true;
  }

  public static void begin(Activity host, Object vm) {
    if (Diag.showViewer(host)) { Diag.log("PRIVATE_PAPER_TEST_MODE", "ON: original viewer"); return; }
    Diag.log("PRIVATE_PAPER_TEST_MODE", "OFF: file write");
    String owner = account();
    String key = documentKey(host.getIntent());
    Job job = new Job(host, owner, key, host.getIntent().getStringExtra(EXAM));
    synchronized (jobs) { jobs.put(vm, job); }
    if (owner.isEmpty() || key.isEmpty()) {
      finish(job, owner.isEmpty() ? "로그인한 계정을 확인할 수 없습니다." : "시험지 번호를 확인할 수 없습니다.");
      return;
    }
    host.setVisible(false);
    host.overridePendingTransition(0, 0);
    Toast.makeText(host, "시험지를 저장하고 있습니다.", Toast.LENGTH_SHORT).show();
    main.postDelayed(() -> {
      if (!host.isFinishing() && !host.isDestroyed() && job(vm) == job)
        finish(job, "저장이 완료되지 않았습니다. 연결 상태를 확인해 주세요.");
    }, 90000);
  }

  private static Job job(Object vm) { synchronized (jobs) { return jobs.get(vm); } }
  public static boolean saving(Object vm) { return job(vm) != null; }

  // Test build: the original viewer handles its own authenticated request.
  // Keep the diagnostic hook compatible, without maintaining a second local
  // metadata-based decision for file creation.
  static void recordModel(Object response, Object request, String ownerAtRequest) { }

  public static boolean prepare(Object vm, String title, String pdfUrl) {
    Job job = job(vm);
    if (job == null) return false;
    job.title = title;
    Diag.log("PRIVATE_PAPER_TEST_PREPARE", "exam=" + job.exam + " hasPdf=" + (pdfUrl != null && !pdfUrl.trim().isEmpty()));
    if (pdfUrl == null || pdfUrl.trim().isEmpty()) {
      finish(job, "이 시험지에는 저장할 PDF가 없습니다.");
    }
    return true;
  }

  static void finish(Job job, String message) {
    synchronized (job) { if (job.finished) return; job.finished = true; }
    Diag.log("PRIVATE_PAPER_TEST_FINISH", "exam=" + job.exam + " result=" + message);
    main.post(() -> {
      Activity a = job.host.get();
      if (a == null || a.isDestroyed() || a.isFinishing()) return;
      Toast.makeText(a, message, Toast.LENGTH_LONG).show();
      a.finish();
      a.overridePendingTransition(0, 0);
    });
  }

  private static File directory(Context context, String owner) {
    return new File(new File(context.getFilesDir(), "offline_papers"), owner);
  }
  static SharedPreferences index(Context context, String owner) {
    return context.getSharedPreferences(PREFS + "_" + owner, Context.MODE_PRIVATE);
  }

  // The original OkHttp callback invokes this on its worker thread after it has
  // closed the output stream and verified the PDF header. It makes no new request.
  public static void received(Object vm, File original, Object response) {
    Job job = job(vm);
    if (job == null) return;
    Activity host = job.host.get();
    if (job.finished || host == null || host.isFinishing() || host.isDestroyed()) return;
    try {
      // File-creation test: use only the file already obtained by the original
      // authenticated viewer. Do not make an additional network request.
      if (original == null || !original.isFile() || original.length() <= 0)
        throw new IOException("missing source PDF");
      Diag.log("PRIVATE_PAPER_TEST_RECEIVED", "exam=" + job.exam + " bytes=" + original.length());
      if (job.owner.isEmpty() || !job.owner.equals(account())) throw new IOException("account changed");
      store(host, job.owner, job.key, job.title, job.exam, original, Long.MAX_VALUE);
      finish(job, "앱에 저장했습니다.");
    } catch (Exception e) {
      Diag.log("PRIVATE_PAPER_SAVE_ERROR", e.getClass().getSimpleName());
      finish(job, "PDF를 저장하지 못했습니다.");
    }
  }

  static synchronized void store(Context context, String owner, String key, String title,
                                String exam, File source, long until) throws Exception {
    File dir = directory(context, owner);
    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("document directory");
    File candidate = new File(dir, UUID.randomUUID().toString() + ".pdf");
    boolean published = false;
    try {
      try (FileInputStream in = new FileInputStream(source);
           FileOutputStream out = new FileOutputStream(candidate)) {
        byte[] buffer = new byte[65536]; int count;
        while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
        out.getFD().sync();
      }
      if (candidate.length() != source.length() || candidate.length() <= 0)
        throw new IOException("copy length mismatch");
      try (FileInputStream check = new FileInputStream(candidate)) {
        byte[] header = new byte[5];
        if (check.read(header) != 5 || !"%PDF-".equals(new String(header, StandardCharsets.US_ASCII)))
          throw new IOException("invalid PDF header");
      }
      SharedPreferences prefs = index(context, owner);
      String old = prefs.getString(key, null);
      JSONObject row = new JSONObject().put("file", candidate.getName()).put("exam", exam)
          .put("title", title == null || title.trim().isEmpty() ? "시험지 " + exam : title)
          .put("saved", System.currentTimeMillis()).put("until", until);
      published = prefs.edit().putString(key, row.toString()).commit();
      if (!published) throw new IOException("document index");
      Diag.log("PRIVATE_PAPER_TEST_WRITE_OK", "exam=" + exam + " bytes=" + candidate.length() + " file=" + candidate.getAbsolutePath());
      if (old != null) {
        try { File previous = resolveFile(context, owner, new JSONObject(old));
          if (previous != null && !previous.equals(candidate)) previous.delete();
        } catch (Exception ignored) { }
      }
    } finally { if (!published) candidate.delete(); }
  }

  static File resolveFile(Context context, String owner, JSONObject row) {
    if (row == null || owner.isEmpty() || row.optLong("until", 0) <= System.currentTimeMillis()) return null;
    String name = row.optString("file");
    if (!name.matches("[a-f0-9-]{36}\\.pdf")) return null;
    File file = new File(directory(context, owner), name);
    return file.isFile() ? file : null;
  }

  static List<JSONObject> list(Context context, String owner) {
    List<JSONObject> rows = new ArrayList<>();
    if (owner.isEmpty()) return rows;
    for (Map.Entry<String, ?> entry : index(context, owner).getAll().entrySet()) {
      try {
        JSONObject row = new JSONObject(String.valueOf(entry.getValue())).put("key", entry.getKey());
        if (resolveFile(context, owner, row) != null) rows.add(row);
      } catch (Exception ignored) { }
    }
    Collections.sort(rows, (a, b) -> Long.compare(b.optLong("saved"), a.optLong("saved")));
    return rows;
  }
}
