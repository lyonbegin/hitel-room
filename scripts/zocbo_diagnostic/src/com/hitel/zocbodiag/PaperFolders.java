package com.hitel.zocbodiag;

import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.io.*;
import java.util.*;
import java.lang.reflect.Field;
import java.lang.annotation.Annotation;

/** Separates the two resources returned by the normal viewer. */
final class PaperFolders {
  static Object field(Object object, String name) throws Exception {
    if (object == null) return null;
    for (Field f : object.getClass().getDeclaredFields()) {
      for (Annotation a : f.getDeclaredAnnotations()) {
        if (!"com.google.gson.annotations.SerializedName".equals(a.annotationType().getName())) continue;
        if (name.equals(a.annotationType().getMethod("value").invoke(a))) {
          f.setAccessible(true);
          return f.get(object);
        }
      }
    }
    return null;
  }

  static List<JSONObject> questions(Object model) {
    List<JSONObject> rows = new ArrayList<>();
    try {
      Object list = field(model, "qst_list");
      if (list instanceof List<?>) {
        int position = 0;
        for (Object row : (List<?>)list) {
          Object path = field(row, "qst_img_path");
          Object seq = field(row, "qst_seq");
          rows.add(new JSONObject()
              .put("order", ++position)
              .put("qst_seq", seq == null ? JSONObject.NULL : seq)
              .put("qst_img_path", path instanceof String ? path : JSONObject.NULL));
        }
      }
    } catch (Exception e) {
      Diag.log("QUESTION_MODEL_ERROR", e.getClass().getSimpleName());
    }
    return rows;
  }

  static File examFolder(Context context, String title, String exam) throws IOException {
    File root = context.getExternalFilesDir(null);
    if (root == null) throw new IOException("external files unavailable");
    String name = (title == null ? "" : title).replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
    if (name.isEmpty() || name.equals(".") || name.equals("..")) name = "시험지";
    if (name.length() > 72) name = name.substring(0, 72);
    String id = exam == null ? "" : exam.replaceAll("[^0-9]", "");
    if (id.length() > 12) id = id.substring(0,12);
    File folder = new File(root, name + (id.isEmpty() ? "" : " [" + id + "]"));
    for (String child : new String[]{"문제", "시험지"}) {
      File dir = new File(folder, child);
      if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("folder unavailable");
    }
    return folder;
  }

  static String relative(Context context, File file) throws IOException {
    File root = context.getExternalFilesDir(null);
    if (root == null) throw new IOException("external files unavailable");
    String prefix = root.getCanonicalPath() + File.separator;
    String path = file.getCanonicalPath();
    if (!path.startsWith(prefix)) throw new IOException("outside app folder");
    return path.substring(prefix.length());
  }

  static File resolve(Context context, String name) {
    try {
      if (name == null || name.isEmpty()) return null;
      File root = context.getExternalFilesDir(null);
      if (root == null) return null;
      File file = new File(root, name);
      return relative(context,file).equals(name) && file.isFile() ? file : null;
    } catch (IOException e) { return null; }
  }

  // Save the metadata supplied by the normal viewer, without requesting images,
  // constructing URLs, or attempting to refresh or extend their validity.
  static int saveQuestionPaths(Context context, String title, String exam,
                         List<JSONObject> rows, String account) throws Exception {
    return saveQuestionPathsInFolder(context, examFolder(context,title,exam), rows, account);
  }

  static int saveQuestionPathsInFolder(Context context, File folder,
                         List<JSONObject> rows, String account) throws Exception {
    if (account.isEmpty() || !account.equals(PrivatePapers.account()))
      throw new IOException("account changed");
    File dir = new File(folder, "문제");
    if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("question folder unavailable");
    JSONArray questions = new JSONArray();
    int count = 0;
    for (JSONObject row : rows) {
      questions.put(row);
      if (!row.isNull("qst_img_path") && !row.optString("qst_img_path").trim().isEmpty()) count++;
    }
    JSONObject document = new JSONObject().put("question_count", rows.size())
        .put("image_path_count", count).put("questions", questions);
    File destination = new File(dir, "questions.json");
    AtomicFile atomic = new AtomicFile(destination);
    FileOutputStream out = null;
    try {
      out = atomic.startWrite();
      out.write(document.toString(2).getBytes(StandardCharsets.UTF_8));
      if (!account.equals(PrivatePapers.account())) throw new IOException("account changed");
      atomic.finishWrite(out);
      out = null;
    } finally {
      if (out != null) atomic.failWrite(out);
    }
    if (!destination.isFile() || destination.length()<=0) throw new IOException("JSON missing");
    Diag.log("QUESTION_JSON_SAVED", destination.getAbsolutePath()+" count="+count+"/"+rows.size());
    return count;
  }
}
