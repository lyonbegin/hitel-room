package com.hitel.zocbodiag;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.BufferedWriter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Metadata-only, app-private SQLite storage; does not store PDF/token/cookies. */
public final class ReadingCollectorStore extends SQLiteOpenHelper {
  public static final String DB_NAME="zocbo_exam_metadata_v1.db";
  private static final String[] COLS={
    "exam_no","title","school","school_id","city","district","grade",
    "exam_year","exam_term","subject_code","subject_name","course_name",
    "core_type","answer","source_scope","last_seen"
  };
  public ReadingCollectorStore(Context context){super(context.getApplicationContext(),DB_NAME,null,2);}
  @Override public void onCreate(SQLiteDatabase db){
    db.execSQL("CREATE TABLE IF NOT EXISTS exams ("+
      "exam_no TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL DEFAULT '',"+
      "school TEXT,school_id TEXT,city TEXT,district TEXT,grade TEXT,"+
      "exam_year TEXT,exam_term TEXT,subject_code TEXT,subject_name TEXT,"+
      "course_name TEXT,core_type TEXT,answer TEXT,source_scope TEXT,last_seen INTEGER)");
    db.execSQL("CREATE INDEX IF NOT EXISTS idx_exams_lookup ON exams(exam_year,school,grade,subject_code,exam_term)");
    db.execSQL("CREATE TABLE IF NOT EXISTS checkpoints ("+
      "run_key TEXT PRIMARY KEY NOT NULL,task_index INTEGER,page INTEGER,"+
      "pages_done INTEGER,rows_seen INTEGER,finished INTEGER,updated_at INTEGER)");
    createAreaTable(db);
  }
  @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){
    if(oldVersion<2)createAreaTable(db); // preserves v1 exams and checkpoints
  }
  private static void createAreaTable(SQLiteDatabase db){
    db.execSQL("CREATE TABLE IF NOT EXISTS area_scopes ("+
      "run_key TEXT NOT NULL,site TEXT NOT NULL,area_index INTEGER NOT NULL,"+
      "name TEXT NOT NULL,schools TEXT NOT NULL,city TEXT,district TEXT,"+
      "filter_value TEXT,paid TEXT,grade TEXT,year TEXT,term TEXT,subject TEXT,"+
      "first_page_json TEXT,updated_at INTEGER,"+
      "PRIMARY KEY(run_key,site,area_index))");
  }

  static String first(JSONObject o,String... names){
    for(String n:names){ if(o.has(n) && !o.isNull(n)){
      String v=o.optString(n,"").trim();
      if(v.length()>0 && !"null".equalsIgnoreCase(v))return v;
    }}
    return "";
  }
  static String sanitize(String v,int max){
    if(v==null)return "";
    v=v.replace('\u0000',' ').replace('\r',' ').replace('\n',' ').trim();
    if(v.length()>max)return v.substring(0,max);
    return v;
  }
  public synchronized int count(){
    Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM exams",null);
    try {return c.moveToFirst()?c.getInt(0):0;}finally{c.close();}
  }
  public static final class Progress {
    public int taskIndex,page,pagesDone,rowsSeen;
    public boolean finished;
    Progress(){taskIndex=0;page=1;}
  }
  public synchronized Progress load(String key){
    Progress p=new Progress();
    Cursor c=getReadableDatabase().rawQuery(
      "SELECT task_index,page,pages_done,rows_seen,finished FROM checkpoints WHERE run_key=?",
      new String[]{key});
    try{
      if(c.moveToFirst()){
        p.taskIndex=c.getInt(0);p.page=c.getInt(1);
        p.pagesDone=c.getInt(2);p.rowsSeen=c.getInt(3);p.finished=c.getInt(4)!=0;
      }
    }finally{c.close();}
    return p;
  }
  private void save(SQLiteDatabase db,String key,Progress p){
    ContentValues v=new ContentValues();
    v.put("run_key",key);v.put("task_index",p.taskIndex);v.put("page",p.page);
    v.put("pages_done",p.pagesDone);v.put("rows_seen",p.rowsSeen);
    v.put("finished",p.finished?1:0);v.put("updated_at",System.currentTimeMillis());
    db.insertWithOnConflict("checkpoints",null,v,SQLiteDatabase.CONFLICT_REPLACE);
  }

  /** Each page's metadata AND next checkpoint are committed atomically. */
  public synchronized int savePage(String key,Progress next,JSONArray list,
    String site,String grade,String year,String term,String subject,String scope){
    SQLiteDatabase db=getWritableDatabase();
    int found=0;
    db.beginTransaction();
    try{
      for(int i=0;i<list.length();i++){
        JSONObject j=list.optJSONObject(i);if(j==null)continue;
        String no=first(j,"expapr_no","exPapr_no","ExPapr_No","exPapr_No");
        if(!no.matches("[1-9][0-9]{0,12}"))continue;
        String school=sanitize(first(j,"scl_short_name","scl_sname","Scl_Name","scl_name"),180);
        String subjCode=sanitize(first(j,"Subj_Code","subj_code"),25);
        if(subjCode.isEmpty())subjCode=subject;
        String subjName=sanitize(first(j,"Subj_Name","subj_name","subj_txt"),90);
        if(subjName.isEmpty())subjName=subjectName(subjCode);
        String yr=sanitize(first(j,"ExPapr_TestYear","exPapr_testyear","exPapr_TestYear"),12);
        if(yr.isEmpty())yr=year;
        String course=sanitize(first(j,"CourseName","Course_Name","course_name"),160);
        String title=sanitize(first(j,"viewer_title","title","Title","EXAM_TITLE"),500);
        if(title.isEmpty())title=school+" "+grade+" "+term+" "+subjName+(course.isEmpty()?"":" "+course);
        ContentValues v=new ContentValues();
        v.put("exam_no",no);v.put("title",title);v.put("school",school);
        v.put("school_id",sanitize(first(j,"Scl_ID","scl_id"),32));
        v.put("city",sanitize(first(j,"Rg_City","Rg_CitiesProvinces","rg_CitiesProvinces"),70));
        v.put("district",sanitize(first(j,"Rg_District","rg_District"),70));
        v.put("grade",sanitize(first(j,"Grade","grade"),8).isEmpty()?grade:sanitize(first(j,"Grade","grade"),8));
        v.put("exam_year",yr);v.put("exam_term",term);
        v.put("subject_code",subjCode);v.put("subject_name",subjName);
        v.put("course_name",course);
        v.put("core_type",sanitize(first(j,"exPapr_CoreType","ExPapr_CoreType"),24));
        v.put("answer",sanitize(first(j,"EXAM_ANSWER","exam_answer"),32));
        v.put("source_scope",sanitize(scope,100));
        v.put("last_seen",System.currentTimeMillis());
        db.insertWithOnConflict("exams",null,v,SQLiteDatabase.CONFLICT_REPLACE);
        found++;
      }
      if(list.length()>0 && found==0)throw new IllegalStateException("No valid exam IDs in a nonempty server page");
      save(db,key,next);
      db.setTransactionSuccessful();
    }finally{db.endTransaction();}
    return found;
  }
  /** Persist each successfully discovered region immediately, not at nationwide completion. */
  public synchronized void saveArea(String key,int ordinal,ReadingCollectorController.AreaScope area){
    if(key==null||key.isEmpty()||ordinal<0||area==null||
       !("M".equals(area.site)||"H".equals(area.site))||
       area.schools==null||area.schools.isEmpty())
      throw new IllegalArgumentException("Invalid original region scope");
    SQLiteDatabase db=getWritableDatabase();
    ContentValues v=new ContentValues();
    v.put("run_key",key);v.put("site",area.site);v.put("area_index",ordinal);
    v.put("name",area.name);v.put("schools",area.schools);
    v.put("city",area.city);v.put("district",area.district);
    v.put("filter_value",area.filter);v.put("paid",area.paid);
    v.put("grade",area.grade);v.put("year",area.year);v.put("term",area.term);
    v.put("subject",area.subject);
    v.put("first_page_json",area.firstPage==null?"[]":area.firstPage.toString());
    v.put("updated_at",System.currentTimeMillis());
    if(db.insertWithOnConflict("area_scopes",null,v,SQLiteDatabase.CONFLICT_REPLACE)<0)
      throw new IllegalStateException("Region checkpoint not persisted");
  }

  public synchronized List<ReadingCollectorController.AreaScope> loadAreas(String key){
    ArrayList<ReadingCollectorController.AreaScope> result=new ArrayList<>();
    Cursor cursor=getReadableDatabase().rawQuery(
      "SELECT site,area_index,name,schools,city,district,filter_value,paid,"+
      "grade,year,term,subject,first_page_json FROM area_scopes WHERE run_key=? "+
      "ORDER BY CASE site WHEN 'M' THEN 0 ELSE 1 END, area_index",
      new String[]{key});
    try{
      while(cursor.moveToNext()){
        JSONArray rows;
        try{rows=new JSONArray(cursor.isNull(12)?"[]":cursor.getString(12));}
        catch(org.json.JSONException e){throw new IllegalStateException("Corrupt stored area snapshot",e);}
        ReadingCollectorController.AreaScope area=new ReadingCollectorController.AreaScope(
          cursor.getString(2),cursor.getString(0),cursor.getString(3),
          cursor.getString(4),cursor.getString(5),cursor.getString(6),
          cursor.getString(7),cursor.getString(8),cursor.getString(9),
          cursor.getString(10),cursor.getString(11),rows);
        area.ordinal=cursor.getInt(1);
        result.add(area);
      }
    }finally{cursor.close();}
    return result;
  }

  public synchronized int countAreas(String key){
    Cursor c=getReadableDatabase().rawQuery(
      "SELECT COUNT(*) FROM area_scopes WHERE run_key=?",new String[]{key});
    try{return c.moveToFirst()?c.getInt(0):0;}finally{c.close();}
  }

  public synchronized void saveProgress(String key,Progress progress){
    SQLiteDatabase db=getWritableDatabase();
    db.beginTransaction();
    try{save(db,key,progress);db.setTransactionSuccessful();}
    finally{db.endTransaction();}
  }
  static String subjectName(String code){
    if("KR".equals(code))return "국어";if("EG".equals(code))return "영어";
    if("MT".equals(code))return "수학";if("SC".equals(code))return "과학";
    if("LS".equals(code))return "사회";if("HI".equals(code))return "역사/한국사";
    if("ET".equals(code))return "도덕";if("TH".equals(code))return "기술가정/직탐";
    if("CH".equals(code))return "한문/제2외국어";
    return code;
  }

  private static String csv(String raw) {
    if(raw==null)return "";
    String s=raw;
    // Guard spreadsheet formula interpretation while preserving the information.
    if(s.startsWith("=")||s.startsWith("+")||s.startsWith("-")||s.startsWith("@"))s="'"+s;
    return "\""+s.replace("\"","\"\"")+"\"";
  }
  public synchronized int exportCsv(OutputStream out)throws IOException{
    BufferedWriter w=new BufferedWriter(new OutputStreamWriter(out,"UTF-8"),32768);
    w.write('\uFEFF'); // UTF-8 BOM so Korean labels are legible in Excel.
    for(int i=0;i<COLS.length;i++){if(i>0)w.write(',');w.write(COLS[i]);}w.write("\r\n");
    Cursor c=getReadableDatabase().rawQuery(
      "SELECT "+android.text.TextUtils.join(",",COLS)+" FROM exams ORDER BY exam_year,school,subject_code,exam_no",null);
    int n=0;
    try {
      while(c.moveToNext()){
        for(int i=0;i<COLS.length;i++){
          if(i>0)w.write(',');
          w.write(csv(c.isNull(i)?"":c.getString(i)));
        }
        w.write("\r\n");n++;
      }
    }finally{c.close();}
    w.flush();return n;
  }
  public synchronized int exportJson(OutputStream out)throws IOException{
    BufferedWriter w=new BufferedWriter(new OutputStreamWriter(out,"UTF-8"),32768);
    Cursor c=getReadableDatabase().rawQuery(
      "SELECT "+android.text.TextUtils.join(",",COLS)+" FROM exams ORDER BY exam_year,school,subject_code,exam_no",null);
    int n=0;w.write("{\"format\":\"zocbo-exam-metadata-v1\",\"items\":[\n");
    try{
      while(c.moveToNext()){
        JSONObject obj=new JSONObject();
        for(int i=0;i<COLS.length;i++){
          try{if("last_seen".equals(COLS[i]))obj.put(COLS[i],c.getLong(i));
              else obj.put(COLS[i],c.isNull(i)?"":c.getString(i));
          }catch(org.json.JSONException e){throw new IOException(e);}
        }
        if(n>0)w.write(",\n");
        w.write(obj.toString());n++;
      }
    }finally{c.close();}
    w.write("\n],\"count\":"+n+"}\n");
    w.flush();return n;
  }
}
