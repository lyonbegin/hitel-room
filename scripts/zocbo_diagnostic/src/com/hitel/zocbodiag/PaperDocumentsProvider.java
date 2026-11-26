package com.hitel.zocbodiag;

import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import org.json.JSONObject;
import java.io.File;
import java.io.FileNotFoundException;
import java.util.Locale;

/** Exposes the existing local folder through Android's system file picker. */
public final class PaperDocumentsProvider extends DocumentsProvider {
  private static final String DIRECTORY = "papers";
  private static final String[] ROOT_COLUMNS = {Root.COLUMN_ROOT_ID, Root.COLUMN_DOCUMENT_ID,
      Root.COLUMN_TITLE, Root.COLUMN_FLAGS, Root.COLUMN_MIME_TYPES, Root.COLUMN_ICON};
  private static final String[] DOCUMENT_COLUMNS = {Document.COLUMN_DOCUMENT_ID,
      Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE, Document.COLUMN_FLAGS,
      Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED};

  static String authority(Context context) { return context.getPackageName() + ".localpapers"; }
  static android.net.Uri folder(Context context) {
    return DocumentsContract.buildDocumentUri(authority(context), DIRECTORY);
  }
  static void changed(Context context) {
    context.getContentResolver().notifyChange(DocumentsContract.buildRootsUri(authority(context)), null);
    context.getContentResolver().notifyChange(
        DocumentsContract.buildChildDocumentsUri(authority(context), DIRECTORY), null);
  }
  @Override public boolean onCreate() { return true; }

  @Override public Cursor queryRoots(String[] projection) {
    MatrixCursor result = new MatrixCursor(projection == null ? ROOT_COLUMNS : projection);
    MatrixCursor.RowBuilder row = result.newRow();
    add(result, row, Root.COLUMN_ROOT_ID, DIRECTORY);
    add(result, row, Root.COLUMN_DOCUMENT_ID, DIRECTORY);
    add(result, row, Root.COLUMN_TITLE, "저장한 시험지");
    add(result, row, Root.COLUMN_FLAGS, Root.FLAG_LOCAL_ONLY | Root.FLAG_SUPPORTS_SEARCH);
    add(result, row, Root.COLUMN_MIME_TYPES, "application/pdf");
    add(result, row, Root.COLUMN_ICON, android.R.drawable.ic_menu_save);
    return result;
  }

  private static void add(MatrixCursor cursor, MatrixCursor.RowBuilder row, String key, Object value) {
    int column = cursor.getColumnIndex(key);
    if (column >= 0) row.add(key, value);
  }
  private String id(String owner, JSONObject row) { return owner + ":" + row.optString("key"); }
  private JSONObject resolve(String documentId) throws FileNotFoundException {
    String owner = PrivatePapers.account();
    if (owner.isEmpty() || !documentId.startsWith(owner + ":")) throw new FileNotFoundException();
    String key = documentId.substring(owner.length() + 1);
    if (!key.matches("[0-9a-f]{64}")) throw new FileNotFoundException();
    try {
      String raw = PrivatePapers.index(getContext(), owner).getString(key, null);
      if (raw == null) throw new FileNotFoundException();
      JSONObject row = new JSONObject(raw).put("key", key);
      if (PrivatePapers.resolveFile(getContext(), owner, row) == null) throw new FileNotFoundException();
      return row;
    } catch (Exception e) { throw new FileNotFoundException("document unavailable"); }
  }
  private void include(MatrixCursor result, String documentId, JSONObject paper) {
    MatrixCursor.RowBuilder row = result.newRow();
    boolean directory = paper == null;
    add(result, row, Document.COLUMN_DOCUMENT_ID, documentId);
    add(result, row, Document.COLUMN_DISPLAY_NAME,
        directory ? "저장한 시험지" : paper.optString("title") + ".pdf");
    add(result, row, Document.COLUMN_MIME_TYPE, directory ? Document.MIME_TYPE_DIR : "application/pdf");
    add(result, row, Document.COLUMN_FLAGS, 0);
    File file = directory ? null : PrivatePapers.resolveFile(getContext(), PrivatePapers.account(), paper);
    add(result, row, Document.COLUMN_SIZE, file == null ? 0L : file.length());
    add(result, row, Document.COLUMN_LAST_MODIFIED, directory ? 0L : paper.optLong("saved"));
  }
  @Override public Cursor queryDocument(String documentId, String[] projection) throws FileNotFoundException {
    MatrixCursor result = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
    include(result, documentId, DIRECTORY.equals(documentId) ? null : resolve(documentId));
    return result;
  }
  @Override public Cursor queryChildDocuments(String parentId, String[] projection, String sortOrder)
      throws FileNotFoundException {
    if (!DIRECTORY.equals(parentId)) throw new FileNotFoundException();
    return children(projection, null);
  }
  private Cursor children(String[] projection, String query) {
    MatrixCursor result = new MatrixCursor(projection == null ? DOCUMENT_COLUMNS : projection);
    String owner = PrivatePapers.account();
    for (JSONObject paper : PrivatePapers.list(getContext(), owner)) {
      if (query == null || paper.optString("title").toLowerCase(Locale.ROOT).contains(query.toLowerCase(Locale.ROOT)))
        include(result, id(owner, paper), paper);
    }
    result.setNotificationUri(getContext().getContentResolver(),
        DocumentsContract.buildChildDocumentsUri(authority(getContext()), DIRECTORY));
    return result;
  }
  @Override public Cursor querySearchDocuments(String rootId, String query, String[] projection)
      throws FileNotFoundException {
    if (!DIRECTORY.equals(rootId)) throw new FileNotFoundException();
    return children(projection, query);
  }
  @Override public ParcelFileDescriptor openDocument(String documentId, String mode, CancellationSignal signal)
      throws FileNotFoundException {
    if (!"r".equals(mode)) throw new FileNotFoundException("read only");
    if (signal != null) signal.throwIfCanceled();
    JSONObject row = resolve(documentId);
    File file = PrivatePapers.resolveFile(getContext(), PrivatePapers.account(), row);
    if (file == null) throw new FileNotFoundException();
    return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
  }
}
