package com.hitel.zocbodiag;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.AtomicFile;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Private offline library for PDFs explicitly supplied by the user using
 * Android's system document picker. Not connected to viewer temporary files,
 * WebView, exam-number requests, network, or entitlement checks.
 */
public final class LocalStudyCache {
  private static final String DIRECTORY = "local_study_pdf";
  private static final long MAX_BYTES = 128L * 1024L * 1024L;
  private static final byte[] PDF = {37,80,68,70,45};
  private LocalStudyCache() {}
  public static Intent documentPicker() {
    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    i.addCategory(Intent.CATEGORY_OPENABLE);
    i.setType("application/pdf");
    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    return i;
  }
  private static File target(Context ctx, String id) throws IOException {
    if (id == null || !id.matches("[A-Za-z0-9_-]{1,80}"))
      throw new IOException("INVALID_LOCAL_DOCUMENT_ID");
    File dir = new File(ctx.getFilesDir(), DIRECTORY);
    if (!dir.isDirectory() && !dir.mkdirs())
      throw new IOException("LOCAL_DIRECTORY_CREATE_FAILED");
    return new File(dir, id + ".pdf");
  }
  /**
   * Call off the UI thread, only with the result of an explicit successful
   * ACTION_OPEN_DOCUMENT selection of a lawfully retained document.
   * No file paths, raw URLs, or Javascript bridge entry points accepted.
   */
  public static synchronized long importSelection(Context ctx, String id,
      Intent result) throws IOException {
    Uri uri = result == null ? null : result.getData();
    if (uri == null || !"content".equals(uri.getScheme()) ||
        (result.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) == 0)
      throw new IOException("USER_DOCUMENT_GRANT_REQUIRED");
    // Do not import a private cache path exposed by this app's own provider.
    String auth = uri.getAuthority();
    if (auth == null || auth.startsWith(ctx.getPackageName()))
      throw new IOException("EXTERNAL_USER_DOCUMENT_REQUIRED");
    AtomicFile dst = new AtomicFile(target(ctx,id));
    FileOutputStream out = null;
    long total = 0;
    try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
      if (in == null) throw new IOException("LOCAL_DOCUMENT_OPEN_FAILED");
      for (byte b : PDF) if (in.read() != (b & 255))
        throw new IOException("INVALID_PDF_HEADER");
      out = dst.startWrite();
      out.write(PDF);
      total = PDF.length;
      byte[] buffer = new byte[65536];
      int n;
      while ((n = in.read(buffer)) != -1) {
        if (n == 0) continue;
        if (total + n > MAX_BYTES) throw new IOException("LOCAL_DOCUMENT_TOO_LARGE");
        out.write(buffer,0,n);
        total += n;
      }
      if (total <= PDF.length) throw new IOException("EMPTY_PDF");
      out.flush();
      out.getFD().sync();
      dst.finishWrite(out);
      out = null;
      return total;
    } finally {
      if (out != null) dst.failWrite(out);
    }
  }
  /** Open an explicitly imported local PDF; no network is used. */
  public static synchronized ParcelFileDescriptor open(Context ctx,String id)
      throws IOException {
    File f = target(ctx,id);
    AtomicFile atomic = new AtomicFile(f);
    try (FileInputStream in = atomic.openRead()) {
      for (byte b: PDF) if (in.read() != (b & 255))
        throw new IOException("INVALID_CACHED_PDF");
    }
    return ParcelFileDescriptor.open(f,ParcelFileDescriptor.MODE_READ_ONLY);
  }
  public static synchronized boolean remove(Context ctx,String id) throws IOException {
    AtomicFile atomic = new AtomicFile(target(ctx,id));
    atomic.delete();
    return !atomic.getBaseFile().exists();
  }
}
