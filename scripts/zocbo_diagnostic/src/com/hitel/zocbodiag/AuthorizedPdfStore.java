package com.hitel.zocbodiag;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Storage component for an already authorized, separately exportable PDF.
 * Only a trusted native official-download or user-selected document flow
 * may supply the source URI. Not a JavascriptInterface; does not make HTTP
 * requests or read private viewer caches, or infer download rights from
 * a successful view. Android 10+.
 */
public final class AuthorizedPdfStore {
  private static final String DIRECTORY =
      Environment.DIRECTORY_DOWNLOADS + "/HITEL-Zocbo/";
  private static final byte[] MAGIC = new byte[]{37,80,68,70,45}; // %PDF-
  private AuthorizedPdfStore() {}

  public static final class Result {
    public final String examId;
    public final Uri uri;
    public final String relativePath;
    public final long bytes;
    private Result(String id, Uri uri, String relativePath, long bytes) {
      this.examId = id;
      this.uri = uri;
      this.relativePath = relativePath;
      this.bytes = bytes;
    }
  }

  /**
   * Call on a background thread. expectedBytes is -1 if unknown.
   * Never accepts an HTTP URL, a file URI, or a path to a viewer temp file.
   * Never overwrites a previously saved document.
   */
  public static synchronized Result save(Context context, String examId,
      Uri authorizedDocument, long expectedBytes) throws IOException {
    if (Build.VERSION.SDK_INT < 29)
      throw new IOException("ANDROID_10_REQUIRED");
    if (examId == null || !examId.matches("[1-9][0-9]{0,9}"))
      throw new IOException("INVALID_EXAM_ID");
    if (authorizedDocument == null ||
        !"content".equals(authorizedDocument.getScheme()))
      throw new IOException("AUTHORIZED_DOCUMENT_URI_REQUIRED");
    if (expectedBytes != -1 && expectedBytes < MAGIC.length)
      throw new IOException("INVALID_EXPECTED_LENGTH");

    ContentResolver resolver = context.getContentResolver();
    Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
    String filename = examId + ".pdf";
    String relativePath = DIRECTORY + filename;
    String[] projection = new String[]{
        MediaStore.MediaColumns._ID};
    String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " +
        MediaStore.MediaColumns.DISPLAY_NAME + "=?";
    try (Cursor existing = resolver.query(collection, projection, selection,
        new String[]{DIRECTORY, filename}, null)) {
      if (existing == null) throw new IOException("DESTINATION_QUERY_FAILED");
      if (existing.moveToFirst()) throw new IOException("DESTINATION_EXISTS");
    }

    Uri destination = null;
    boolean published = false;
    long written = 0;
    try (InputStream input = resolver.openInputStream(authorizedDocument)) {
      if (input == null) throw new IOException("DOCUMENT_OPEN_FAILED");
      for (byte expected : MAGIC) {
        if (input.read() != (expected & 0xff))
          throw new IOException("INVALID_PDF_HEADER");
      }

      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
      values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, DIRECTORY);
      values.put(MediaStore.MediaColumns.IS_PENDING, 1);
      destination = resolver.insert(collection, values);
      if (destination == null) throw new IOException("DESTINATION_INSERT_FAILED");

      try (OutputStream output = resolver.openOutputStream(destination, "w")) {
        if (output == null) throw new IOException("DESTINATION_OPEN_FAILED");
        output.write(MAGIC);
        written = MAGIC.length;
        byte[] buffer = new byte[64 * 1024];
        int n;
        while ((n = input.read(buffer)) != -1) {
          if (n == 0) continue;
          if (expectedBytes != -1 && n > expectedBytes - written)
            throw new IOException("SOURCE_LENGTH_MISMATCH");
          output.write(buffer, 0, n);
          written += n;
        }
        output.flush();
      }
      if (written <= MAGIC.length ||
          (expectedBytes != -1 && written != expectedBytes))
        throw new IOException("SOURCE_LENGTH_MISMATCH");

      try (ParcelFileDescriptor fd = resolver.openFileDescriptor(destination, "r")) {
        if (fd == null || fd.getStatSize() != written)
          throw new IOException("DESTINATION_LENGTH_MISMATCH");
      }
      // MediaStore may choose a different name on collision. Never silently
      // report the requested path when a provider actually chose another.
      try (Cursor row = resolver.query(destination, new String[]{
          MediaStore.MediaColumns.DISPLAY_NAME,
          MediaStore.MediaColumns.RELATIVE_PATH}, null, null, null)) {
        if (row == null || !row.moveToFirst() ||
            !filename.equals(row.getString(0)) ||
            !DIRECTORY.equals(row.getString(1)))
          throw new IOException("DESTINATION_NAME_MISMATCH");
      }

      ContentValues done = new ContentValues();
      done.put(MediaStore.MediaColumns.IS_PENDING, 0);
      if (resolver.update(destination, done, null, null) != 1)
        throw new IOException("DESTINATION_PUBLISH_FAILED");
      published = true;
      return new Result(examId, destination, relativePath, written);
    } finally {
      if (!published && destination != null) {
        try { resolver.delete(destination, null, null); }
        catch (RuntimeException ignored) {}
      }
    }
  }
}
