package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.os.Build;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;

/** Emulator-only QA: inserts authentic exam metadata from user-provided previousExam HTML.
 * NEVER runs during normal user collection or on a physical device.
 * Source label CAPTURED_HTML_QA_ONLY makes this distinct from live server results.
 */
public final class ReadingCollectorQaProof {
  public static final String EXTRA="com.hitel.zocbodiag.QA_CAPTURE_BASE64";
  public static final String RUN="qa-captured-user-html-20261123-page1";
  public static final String SOURCE="CAPTURED_HTML_QA_ONLY";
  public static final String EXPECTED_SHA256="105e63ffe98c84f8c3dc61ee560e16ddaed266115afefec2d96d3b8c91cf7ab5";
  private ReadingCollectorQaProof(){}
  private static boolean emulator(){
    String fingerprint=Build.FINGERPRINT==null?"":Build.FINGERPRINT.toLowerCase();
    String model=Build.MODEL==null?"":Build.MODEL.toLowerCase();
    return fingerprint.startsWith("generic")||fingerprint.contains("emulator")||
      model.contains("sdk_gphone")||model.contains("android sdk");
  }
  private static String sha(String raw)throws Exception {
    MessageDigest md=MessageDigest.getInstance("SHA-256");
    byte[] digest=md.digest(raw.getBytes(StandardCharsets.UTF_8));
    StringBuilder b=new StringBuilder();
    for(byte value:digest)b.append(String.format(java.util.Locale.US,"%02x",value&0xff));
    return b.toString();
  }
  private static String joinSorted(ArrayList<String> values){
    Collections.sort(values);
    StringBuilder b=new StringBuilder();
    for(int i=0;i<values.size();i++){if(i>0)b.append(',');b.append(values.get(i));}
    return b.toString();
  }
  public static void runIfRequested(Activity a,Intent intent){
    if(intent==null||!intent.hasExtra(EXTRA))return;
    if(!emulator())throw new SecurityException("QA import prohibited on real devices");
    try{
      String encoded=intent.getStringExtra(EXTRA);
      if(encoded==null||encoded.length()>18000)throw new IllegalArgumentException("invalid QA payload");
      String raw=new String(Base64.decode(encoded,Base64.NO_WRAP),StandardCharsets.UTF_8);
      JSONArray rows=new JSONArray(raw);
      if(rows.length()!=10)throw new IllegalArgumentException("QA requires ten observed original rows");
      ArrayList<String> expected=new ArrayList<>();
      for(int i=0;i<rows.length();i++){
        JSONObject j=rows.getJSONObject(i);
        String no=j.getString("expapr_no");
        if(!no.matches("[1-9][0-9]{0,12}"))throw new IllegalArgumentException("invalid exam no");
        expected.add(no);
      }
      if(!EXPECTED_SHA256.equals(sha(joinSorted(expected))))
        throw new IllegalArgumentException("wrong observed original source IDs");

      ReadingCollectorStore store=new ReadingCollectorStore(a);
      try{
        ReadingCollectorStore.Progress p=new ReadingCollectorStore.Progress();
        p.taskIndex=0;p.page=2;p.pagesDone=1;p.rowsSeen=10;
        int inserted=store.savePage(RUN,p,rows,"H","1","2022","2E","HI",SOURCE);
        if(inserted!=10)throw new IllegalStateException("10 observed items not accepted");
      }finally{store.close();}
      // A separate SQLiteOpenHelper instance reads physically committed rows and checkpoint.
      ReadingCollectorStore verification=new ReadingCollectorStore(a);
      try{
        ArrayList<String> persisted=new ArrayList<>();
        Cursor c=verification.getReadableDatabase().rawQuery(
          "SELECT exam_no FROM exams WHERE source_scope=? ORDER BY exam_no",
          new String[]{SOURCE});
        try{while(c.moveToNext())persisted.add(c.getString(0));}finally{c.close();}
        ReadingCollectorStore.Progress p=verification.load(RUN);
        if(persisted.size()!=10||p.page!=2||p.pagesDone!=1||
           !EXPECTED_SHA256.equals(sha(joinSorted(persisted))))
          throw new IllegalStateException("persisted exam IDs or checkpoint mismatch");
        Diag.log("QA_ACTUAL_CAPTURE_SQLITE_PROOF",
          "origin=USER_PROVIDED_20261123_HTML live=false count=10 unique=10"+
          " checkpoint_page=2 sha256="+EXPECTED_SHA256+" sqlite_reopen=PASS");
      }finally{verification.close();}
    }catch(Throwable t){
      Diag.log("QA_CAPTURE_SQLITE_FAILURE",t.getClass().getName()+":"+t.getMessage());
      throw new IllegalStateException("QA captured metadata SQLite verification failed",t);
    }
  }
}
