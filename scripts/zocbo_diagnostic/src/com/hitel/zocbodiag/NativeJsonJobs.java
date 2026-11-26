package com.hitel.zocbodiag;

import android.content.Context;
import org.json.JSONObject;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** App-scoped JSON processing of metadata already received by the normal
 * authorized viewer. Does not hold an Activity, invoke a service, or fetch images. */
final class NativeJsonJobs {
  private static final AtomicInteger completed = new AtomicInteger();
  private static final AtomicInteger failed = new AtomicInteger();

  static NativeWorkQueue.Result enqueue(Context context, String owner, String key,
      String exam, String title, List<JSONObject> rows) throws Exception {
    if (owner == null || owner.isEmpty() || !owner.equals(PrivatePapers.account()))
      throw new IOException("account changed");
    if (exam == null || !exam.matches("[1-9][0-9]{0,9}") || key == null || key.isEmpty())
      throw new IOException("invalid exam");
    if (rows == null || rows.isEmpty()) throw new IOException("empty model");
    final Context app = context.getApplicationContext();
    final List<JSONObject> snapshot = new ArrayList<>(rows.size());
    for (JSONObject row : rows) snapshot.add(new JSONObject(row.toString()));
    return NativeWorkQueue.submit(owner + ":" + key, () -> {
      try {
        if (!owner.equals(PrivatePapers.account())) throw new IOException("account changed");
        int count = PaperFolders.saveQuestionPaths(app, title, exam, snapshot, owner);
        completed.incrementAndGet();
        Diag.log("JSON_WORK_COMPLETE", "exam=" + exam + " count=" + count + "/" + snapshot.size());
      } catch (Exception e) {
        failed.incrementAndGet();
        Diag.log("JSON_WORK_FAILED", "exam=" + exam + " " + e.getClass().getSimpleName());
      }
    });
  }
  static int completed() { return completed.get(); }
  static int failed() { return failed.get(); }
  private NativeJsonJobs() {}
}
