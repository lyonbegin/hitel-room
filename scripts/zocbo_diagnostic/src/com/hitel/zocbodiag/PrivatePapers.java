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
  static final String REVALIDATE = "com.hitel.zocbodiag.REVALIDATE_SAVED_PAPER";
  static final String VALIDATED_FILE = "com.hitel.zocbodiag.VALIDATED_FILE";
  private static final String PREFS = "hitel_offline_papers_v1";
  private static final Handler main = new Handler(Looper.getMainLooper());
  private static final Map<Object, Job> jobs = new WeakHashMap<>();

  static final class ModelDecision {
    final long until;
    final boolean network, retain;
    ModelDecision(long until, boolean network, boolean retain) { this.until = until; this.network = network; this.retain = retain; }
  }
  private static final Map<String, ModelDecision> permits = new LinkedHashMap<String, ModelDecision>(32, 0.75f, true) {
    @Override protected boolean removeEldestEntry(Map.Entry<String, ModelDecision> eldest) { return size() > 128; }
  };

  static final class Job {
    final WeakReference<Activity> host;
    final String owner, key, exam;
    volatile String title;
    final boolean revalidation;
    volatile ModelDecision model;
    volatile boolean finished;
    Job(Activity host, String owner, String key, String exam) {
      this.host = new WeakReference<>(host);
      this.owner = owner;
      this.key = key;
      this.exam = exam;
      this.revalidation = host.getIntent().getBooleanExtra(REVALIDATE, false);
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
    if (host.getIntent().getBooleanExtra(REVALIDATE, false)) { host.finish(); return true; }
    Intent read = new Intent(host, NativePdfEntryActivity.class);
    String key = documentKey(host.getIntent());
    if (!key.isEmpty()) read.putExtra("paper", key);
    host.startActivity(read);
    host.finish();
    return true;
  }

  public static void begin(Activity host, Object vm) {
    if (Diag.showViewer(host) && !host.getIntent().getBooleanExtra(REVALIDATE, false)) return;
    String owner = account();
    String key = documentKey(host.getIntent());
    Job job = new Job(host, owner, key, host.getIntent().getStringExtra(EXAM));
    synchronized (jobs) { jobs.put(vm, job); }
    if (owner.isEmpty() || key.isEmpty()) {
      finish(job, owner.isEmpty() ? "로그인한 계정을 확인할 수 없습니다." : "시험지 번호를 확인할 수 없습니다.");
      return;
    }
    synchronized (permits) { permits.remove(owner + key); }
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

  private static boolean mayStore(Object response) throws Exception {
    Object headers = Class.forName("okhttp3.Response").getMethod("headers").invoke(response);
    String control = (String)headers.getClass().getMethod("get", String.class).invoke(headers, "Cache-Control");
    return PaperFreshness.mayStore(control);
  }

  private static boolean hasNetworkResponse(Object response) {
    try {
      return Class.forName("okhttp3.Response").getMethod("networkResponse").invoke(response) != null;
    } catch (Exception e) { return false; }
  }

  private static long responseDeadline(Object response) throws Exception {
    Class<?> type = Class.forName("okhttp3.Response");
    Object headers = type.getMethod("headers").invoke(response);
    java.lang.reflect.Method get = headers.getClass().getMethod("get", String.class);
    String control = (String)get.invoke(headers, "Cache-Control");
    String expires = (String)get.invoke(headers, "Expires");
    String date = (String)get.invoke(headers, "Date");
    String age = (String)get.invoke(headers, "Age");
    return PaperFreshness.deadline(control == null ? "" : control, expires, date, age, System.currentTimeMillis());
  }

  // Bind the service's original metadata decision to this account and this
  // document. Only its cache lifetime is kept, never its URL or response body.
  static synchronized void recordModel(Object response, Object request, String ownerAtRequest) {
    try {
      if (ownerAtRequest.isEmpty() || !ownerAtRequest.equals(account())) return;
      Class<?> invocationType = Class.forName("retrofit2.Invocation");
      Object tag = Class.forName("okhttp3.Request").getMethod("tag", Class.class).invoke(request, invocationType);
      List<?> args = (List<?>)invocationType.getMethod("arguments").invoke(tag);
      if (args.isEmpty() || !"v3.n".equals(args.get(0).getClass().getName())) return;
      Object original = args.get(0);
      JSONObject query = new JSONObject();
      for (java.lang.reflect.Field field : original.getClass().getDeclaredFields()) {
        for (java.lang.annotation.Annotation annotation : field.getDeclaredAnnotations()) {
          if (annotation.annotationType().getName().equals("com.google.gson.annotations.SerializedName")) {
            String name = (String)annotation.annotationType().getMethod("value").invoke(annotation);
            field.setAccessible(true); query.put(name, field.get(original));
          }
        }
      }
      String key = digest(query.getString("expapr_no") + "\n" + query.getString("file_type") + "\n"
          + (query.isNull("pk") ? "" : query.optString("pk", "")) + "\n"
          + (query.isNull("short_url") ? "" : query.optString("short_url", "")));
      int status = ((Number)Class.forName("okhttp3.Response").getMethod("code").invoke(response)).intValue();
      if (status >= 500) return;
      long until = 0;
      boolean valid = false;
      boolean retain = mayStore(response);
      if (status >= 200 && status < 300 && retain) {
        String modelText = (String)Class.forName("okhttp3.ResponseBody").getMethod("string").invoke(
            Class.forName("okhttp3.Response").getMethod("peekBody", long.class).invoke(response, 1024L * 1024L));
        String path = new JSONObject(modelText).optString("pdf_path", "");
        if (!path.isEmpty() && !"null".equals(path)) {
          valid = true;
          until = responseDeadline(response);
        }
      }
      String grantKey = ownerAtRequest + key;
      synchronized (permits) {
        permits.remove(grantKey);
        if (valid || !retain || status < 200 || status >= 300)
          permits.put(grantKey, new ModelDecision(until, valid && hasNetworkResponse(response), retain && status >= 200 && status < 300));
      }
      Context context = Diag.applicationContext();
      if (context != null) {
        SharedPreferences prefs = index(context, ownerAtRequest);
        String previous = prefs.getString(key, null);
        if (previous != null) {
          JSONObject saved = new JSONObject(previous);
          long limit = Math.min(until, saved.optLong("until", 0));
          if (limit != saved.optLong("until", 0)) prefs.edit().putString(key, saved.put("until", limit).toString()).commit();
        }
      }
    } catch (Exception ignored) { /* No reusable metadata for this request. */ }
  }

  public static boolean prepare(Object vm, String title, String pdfUrl) {
    Job job = job(vm);
    if (job == null) return false;
    job.title = title;
    synchronized (permits) {
      job.model = permits.remove(job.owner + job.key);
    }
    if (pdfUrl == null || pdfUrl.trim().isEmpty()) {
      finish(job, "이 시험지에는 저장할 PDF가 없습니다.");
    }
    return true;
  }

  static void finish(Job job, String message) {
    synchronized (job) { if (job.finished) return; job.finished = true; }
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
      ModelDecision model = job.model;
      if ((model != null && !model.retain) || !mayStore(response)) {
        finish(job, "이 PDF는 앱에 저장할 수 없습니다.");
        return;
      }
      long modelUntil = model == null ? 0 : model.until;
      if (modelUntil == Long.MAX_VALUE) {
        // A user download explicitly offered as an attachment is a standalone
        // document. Inline reading without a reusable model has no offline grant.
        Object headers = Class.forName("okhttp3.Response").getMethod("headers").invoke(response);
        String disposition = (String)headers.getClass().getMethod("get", String.class)
            .invoke(headers, "Content-Disposition");
        String kind = disposition == null ? "" : disposition.split(";", 2)[0].trim();
        if (!"attachment".equalsIgnoreCase(kind)) modelUntil = 0;
      }
      long until = Math.min(modelUntil, responseDeadline(response));
      // Retention and permission to reuse are separate. An expired or
      // no-cache response is retained but is never rendered without validation.
      if (job.revalidation && (model == null || !model.network || !hasNetworkResponse(response))) {
        finish(job, "서버 확인을 완료하지 못했습니다.");
        return;
      }
      if (job.owner.isEmpty() || !job.owner.equals(account())) throw new IOException("account changed");
      store(host, job.owner, job.key, job.title, job.exam, original, until);
      if (job.revalidation) {
        JSONObject saved = new JSONObject(index(host, job.owner).getString(job.key, "{}"));
        Intent result = new Intent().putExtra("paper", job.key)
            .putExtra(VALIDATED_FILE, saved.optString("file"));
        main.post(() -> {
          if (!host.isFinishing() && !host.isDestroyed()) host.setResult(Activity.RESULT_OK, result);
        });
        finish(job, "서버 확인을 완료했습니다.");
      } else finish(job, "앱에 저장했습니다.");
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
      try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(candidate, ParcelFileDescriptor.MODE_READ_ONLY);
           PdfRenderer renderer = new PdfRenderer(fd)) {
        if (renderer.getPageCount() < 1) throw new IOException("empty PDF");
      }
      SharedPreferences prefs = index(context, owner);
      String old = prefs.getString(key, null);
      JSONObject row = new JSONObject().put("file", candidate.getName()).put("exam", exam)
          .put("title", title == null || title.trim().isEmpty() ? "시험지 " + exam : title)
          .put("saved", System.currentTimeMillis()).put("until", until);
      published = prefs.edit().putString(key, row.toString()).commit();
      if (!published) throw new IOException("document index");
      if (old != null) {
        try { File previous = resolveFile(context, owner, new JSONObject(old));
          if (previous != null && !previous.equals(candidate)) previous.delete();
        } catch (Exception ignored) { }
      }
    } finally { if (!published) candidate.delete(); }
  }

  static File resolveFile(Context context, String owner, JSONObject row) {
    if (row == null || owner.isEmpty()) return null;
    String name = row.optString("file");
    if (!name.matches("[a-f0-9-]{36}\\.pdf")) return null;
    File file = new File(directory(context, owner), name);
    return file.isFile() ? file : null;
  }

  static boolean canRead(JSONObject row, String validatedFile) {
    return row != null && (row.optLong("until", 0) > System.currentTimeMillis()
        || (validatedFile != null && validatedFile.equals(row.optString("file"))));
  }

  static boolean startRevalidation(Activity host, String owner, JSONObject row, int requestCode) {
    try {
      if (!owner.equals(account()) || resolveFile(host, owner, row) == null || offline(host)) return false;
      String exam = row.optString("exam");
      if (!exam.matches("[1-9][0-9]{0,9}")) return false;
      // Only recreate the existing normal question-viewer intent when it
      // exactly matches the saved document. Other routes must use the original page.
      java.lang.reflect.Method factory = Class.forName("A3.L").getDeclaredMethod("c",
          Context.class, String.class, String.class, String.class, String.class,
          String.class, String.class, String.class, String.class, boolean.class,
          String.class, Integer.class, int.class);
      Intent viewer = (Intent)factory.invoke(null, host, exam, "Q", "", "", "", "", "", "", false, "", null, 0);
      if (viewer == null || viewer.getComponent() == null
          || !host.getPackageName().equals(viewer.getComponent().getPackageName())
          || !"com.eduzone.eduzoneviewer.ui.activities.ViewerActivity".equals(viewer.getComponent().getClassName())
          || !documentKey(viewer).equals(row.optString("key"))) return false;
      viewer.putExtra(REVALIDATE, true);
      host.startActivityForResult(viewer, requestCode);
      return true;
    } catch (Exception e) {
      Diag.log("PRIVATE_PAPER_REVALIDATION_ERROR", e.getClass().getSimpleName());
      return false;
    }
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
