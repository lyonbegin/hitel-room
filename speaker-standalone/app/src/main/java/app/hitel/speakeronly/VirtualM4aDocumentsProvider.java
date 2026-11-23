package app.hitel.speakeronly;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import java.io.File;
import java.io.FileNotFoundException;

/**
 * Test-only SAF-compatible tree on the SAME path consumed by SpeakerEngine.
 * Caller never passes a plain File to SpeakerEngine: that would skip the
 * original Samsung DocumentsProvider search/growth/seek/copy path.
 *
 * The content URI deliberately stays app-private. This does NOT intercept a
 * telephone call and is not Samsung's real DocumentsProvider.
 */
public final class VirtualM4aDocumentsProvider extends ContentProvider {
  static final String AUTHORITY="app.hitel.speakeronly.virtualm4a";
  static final Uri TREE=Uri.parse("content://"+AUTHORITY+"/tree/root");
  private static final String ROOT_ID="root", FILE_ID="file";
  private static final String TITLE="통화 녹음 100_261112_235500.m4a";
  private File live() {
    return new File(getContext().getFilesDir(),"virtual_call/Recordings/Call/"+TITLE);
  }
  static File source(android.content.Context c){
    return new File(c.getFilesDir(),"virtual_call/original.m4a");
  }
  static File live(android.content.Context c){
    return new File(c.getFilesDir(),"virtual_call/Recordings/Call/"+TITLE);
  }
  @Override public boolean onCreate() {return true;}
  private MatrixCursor table(String[] requested){
    String[] projection=requested!=null?requested:new String[]{
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED};
    return new MatrixCursor(projection);
  }
  private void row(MatrixCursor cursor,String id){
    boolean folder=ROOT_ID.equals(id);
    File file=live();
    Object[] values=new Object[cursor.getColumnCount()];
    for(int i=0;i<values.length;i++){
      String key=cursor.getColumnName(i);
      if(DocumentsContract.Document.COLUMN_DOCUMENT_ID.equals(key)) values[i]=id;
      else if(DocumentsContract.Document.COLUMN_DISPLAY_NAME.equals(key))
        values[i]=folder?"Call":TITLE;
      else if(DocumentsContract.Document.COLUMN_MIME_TYPE.equals(key))
        values[i]=folder?DocumentsContract.Document.MIME_TYPE_DIR:"audio/mp4";
      else if(DocumentsContract.Document.COLUMN_SIZE.equals(key))
        values[i]=folder?0L:file.length();
      else if(DocumentsContract.Document.COLUMN_LAST_MODIFIED.equals(key))
        values[i]=folder?0L:file.lastModified();
      else if(DocumentsContract.Document.COLUMN_FLAGS.equals(key)) values[i]=0;
    }
    cursor.addRow(values);
  }
  @Override public Cursor query(Uri uri,String[] projection,String selection,
                                String[] selectionArgs,String sortOrder) {
    MatrixCursor c=table(projection);
    String p=uri.getPath();
    if(p!=null && p.contains("/children/")){
      if(live().exists()) row(c,FILE_ID);
    }else{
      String id=uri.getLastPathSegment();
      if(FILE_ID.equals(id)) {if(live().exists()) row(c,FILE_ID);}
      else row(c,ROOT_ID);
    }
    c.setNotificationUri(getContext().getContentResolver(),TREE);
    return c;
  }
  static void changed(android.content.Context c){
    c.getContentResolver().notifyChange(TREE,null);
    c.getContentResolver().notifyChange(
      DocumentsContract.buildChildDocumentsUriUsingTree(TREE,ROOT_ID),null);
  }
  @Override public ParcelFileDescriptor openFile(Uri uri,String mode)
      throws FileNotFoundException {
    if(!"r".equals(mode)||!FILE_ID.equals(uri.getLastPathSegment()))
      throw new FileNotFoundException("Only virtual growing M4A can be read");
    return ParcelFileDescriptor.open(live(),ParcelFileDescriptor.MODE_READ_ONLY);
  }
  @Override public String getType(Uri uri){
    return FILE_ID.equals(uri.getLastPathSegment())?"audio/mp4":
      DocumentsContract.Document.MIME_TYPE_DIR;
  }
  @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
  @Override public int delete(Uri uri,String sel,String[] args){throw new UnsupportedOperationException();}
  @Override public int update(Uri uri,ContentValues values,String sel,String[] args){throw new UnsupportedOperationException();}
}
