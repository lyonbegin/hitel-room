package com.hitel.zocbodiag;

import android.content.Context;
import org.json.JSONObject;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** App-scoped JSON processing of metadata already received by the normal
 * authorized viewer. Does not hold an Activity, invoke a service, or fetch images. */
final class NativeJsonJobs {
  private static final AtomicInteger completed = new AtomicInteger();
  private static final AtomicInteger failed = new AtomicInteger();
  private static final Map<String, String> statuses = new LinkedHashMap<>();
  private static synchronized void setStatus(String id, String state) {
    statuses.put(id, state);
    if (statuses.size() > 1024) {
      java.util.Iterator<Map.Entry<String, String>> it = statuses.entrySet().iterator();
      while (statuses.size() > 1024 && it.hasNext()) {
        String value = it.next().getValue();
        if (value.startsWith("COMPLETE") || value.startsWith("FAILED")) it.remove();
      }
    }
  }
  static synchronized String status(String owner, String exam) {
    if (owner == null || owner.isEmpty()) return "NO_ACCOUNT";
    String value = statuses.get(owner + ":" + exam);
    return value == null ? "UNKNOWN" : value;
  }

  static NativeWorkQueue.Result enqueue(Context context, String owner, String key,
      String exam, String title, List<JSONObject> rows) throws Exception {
    return enqueue(context, owner, key, exam, title, rows, null);
  }

  static NativeWorkQueue.Result enqueue(Context context, String owner, String key,
      String exam, String title, List<JSONObject> rows, JsonJobCompletion completion) throws Exception {
    if (owner == null || owner.isEmpty() || !owner.equals(PrivatePapers.account()))
      throw new IOException("account changed");
    if (exam == null || !exam.matches("[1-9][0-9]{0,9}") || key == null || key.isEmpty())
      throw new IOException("invalid exam");
    if (rows == null || rows.isEmpty()) throw new IOException("empty model");
    final Context app = context.getApplicationContext();
    final List<JSONObject> snapshot = new ArrayList<>(rows.size());
    for (JSONObject row : rows) snapshot.add(new JSONObject(row.toString()));
    final String statusId = owner + ":" + exam;
    synchronized (NativeJsonJobs.class) {
      String existing = statuses.get(statusId);
      if ("QUEUED".equals(existing) || "RUNNING".equals(existing))
        return NativeWorkQueue.Result.DUPLICATE;
      setStatus(statusId, "QUEUED");
      NativeWorkQueue.Result result = NativeWorkQueue.submit(owner + ":" + key, () -> {
        setStatus(statusId, "RUNNING");
        String terminal;
        int savedPaths = 0;
        try {
          if (!owner.equals(PrivatePapers.account())) throw new IOException("account changed");
          savedPaths = PaperFolders.saveQuestionPaths(app, title, exam, snapshot, owner);
          completed.incrementAndGet();
          terminal = "COMPLETE:" + savedPaths + "/" + snapshot.size();
          setStatus(statusId, terminal);
          Diag.log("JSON_WORK_COMPLETE", "exam=" + exam + " count=" + savedPaths + "/" + snapshot.size());
        } catch (Exception e) {
          failed.incrementAndGet();
          terminal = "FAILED:" + e.getClass().getSimpleName();
          setStatus(statusId, terminal);
          Diag.log("JSON_WORK_FAILED", "exam=" + exam + " " + e.getClass().getSimpleName());
        }
        // The callback is independent of ViewerActivity; it is fired only
        // after the actual save attempt, never on queue acceptance.
        if (completion != null) completion.finish(terminal, savedPaths, snapshot.size());
      });
      if (result != NativeWorkQueue.Result.ACCEPTED) {
        if (existing == null) statuses.remove(statusId);
        else setStatus(statusId, existing);
      }
      return result;
    }
  }
  static int completed() { return completed.get(); }
  static int failed() { return failed.get(); }
  private NativeJsonJobs() {}
}
