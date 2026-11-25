package com.hitel.zocbodiag;

import android.content.Context;
import android.graphics.BitmapFactory;
import java.io.*;
import java.net.*;
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

  static List<String> questions(Object model) {
    List<String> paths = new ArrayList<>();
    try {
      Object list = field(model, "qst_list");
      if (list instanceof List<?>) {
        for (Object row : (List<?>)list) {
          Object path = field(row, "qst_img_path");
          paths.add(path instanceof String ? (String)path : "");
        }
      }
    } catch (Exception e) {
      Diag.log("QUESTION_MODEL_ERROR", e.getClass().getSimpleName());
    }
    return paths;
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

  // Accept only the original model's HTTPS image URLs and normal successful
  // responses. Do not synthesize URLs, replay credentials or override no-store.
  static int saveImages(Context context, String title, String exam,
                        List<String> paths, String account) throws IOException {
    File dir = new File(examFolder(context,title,exam), "문제");
    int saved = 0;
    for (int i=0; i<paths.size(); i++) {
      if (!account.equals(PrivatePapers.account())) break;
      HttpURLConnection connection = null;
      File temporary = null;
      try {
        URL url = new URL(paths.get(i));
        if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getUserInfo()!=null) continue;
        connection = (HttpURLConnection)url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(7000);
        connection.setUseCaches(false);
        if (connection.getResponseCode()!=200) {
          Diag.log("QUESTION_IMAGE_HTTP", (i+1)+" status="+connection.getResponseCode());
          continue;
        }
        if (!PaperFreshness.mayStore(connection.getHeaderField("Cache-Control"))) {
          Diag.log("QUESTION_IMAGE_NO_STORE", String.valueOf(i+1));
          continue;
        }
        String type=connection.getContentType();
        if (type == null || !type.toLowerCase(Locale.ROOT).startsWith("image/")) continue;
        temporary=File.createTempFile(".question-", ".tmp", dir);
        try (InputStream in=connection.getInputStream(); FileOutputStream out=new FileOutputStream(temporary)) {
          byte[] buffer=new byte[16384]; int n; long size=0;
          while ((n=in.read(buffer))!=-1) {
            size+=n;
            if (size>24L*1024*1024) throw new IOException("image too large");
            out.write(buffer,0,n);
          }
          out.getFD().sync();
        }
        BitmapFactory.Options opts=new BitmapFactory.Options();
        opts.inJustDecodeBounds=true;
        BitmapFactory.decodeFile(temporary.getAbsolutePath(),opts);
        if (opts.outWidth<=0 || opts.outHeight<=0) throw new IOException("invalid image");
        String mime=opts.outMimeType;
        String ext="image/png".equals(mime)?".png":"image/jpeg".equals(mime)?".jpg":
                   "image/webp".equals(mime)?".webp":"image/gif".equals(mime)?".gif":null;
        if (ext==null) continue;
        if (!account.equals(PrivatePapers.account())) break;
        String stem=String.format(Locale.ROOT,"%03d", i+1);
        File destination=new File(dir,stem+ext);
        if (!temporary.renameTo(destination)) throw new IOException("image move failed");
        for (String old : new String[]{".png",".jpg",".webp",".gif"}) {
          if (!old.equals(ext)) new File(dir,stem+old).delete();
        }
        saved++;
      } catch (Exception e) {
        Diag.log("QUESTION_IMAGE_ERROR",(i+1)+" "+e.getClass().getSimpleName());
      } finally {
        if (temporary!=null) temporary.delete();
        if (connection!=null) connection.disconnect();
      }
    }
    Diag.log("QUESTION_IMAGE_COUNT",saved+"/"+paths.size());
    return saved;
  }
}
