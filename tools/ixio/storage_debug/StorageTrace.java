package com.hitel.qa;
import android.util.Log;
import android.database.Cursor;
import android.os.ParcelFileDescriptor;
import android.net.Uri;
import java.io.File;
import java.util.Collection;
public final class StorageTrace {
  private static java.lang.reflect.Method sink;
  static { for(String[] q:new String[][]{{"com.lguplus.aicallagent.hitelqa.DiagTrace","flow"},{"com.lguplus.callrecorder.hitelqa.RecorderLog","mark"}}) {
    try {sink=Class.forName(q[0]).getMethod(q[1],String.class);break;} catch(Throwable e){}
  }}
  public static void mark(String s){try {Log.i("HITEL_FILE_TRACE",s);if(sink!=null)sink.invoke(null,s);}catch(Throwable e){}}
  public static void number(String s,int n){mark(s+" value="+n);}
  public static void wide(String s,long n){mark(s+" value="+n);}
  public static void object(String s,Object v) {
    try {
      String x;
      if(v==null)x="null";
      else if(v instanceof Throwable)x="exception="+v.getClass().getName();
      else if(v instanceof Enum)x="enum="+((Enum<?>)v).name();
      else if(v instanceof Boolean || v instanceof Number)x="value="+v;
      else if(v instanceof File){File f=(File)v;x="fileKey="+Integer.toHexString(f.getAbsolutePath().hashCode())+" exists="+f.exists()+" bytes="+f.length();}
      else if(v instanceof ParcelFileDescriptor)x="fdPresent=true statBytes="+((ParcelFileDescriptor)v).getStatSize();
      else if(v instanceof Uri){Uri u=(Uri)v;x="uriPresent=true authority="+u.getAuthority()+" uriKey="+Integer.toHexString(u.toString().hashCode());}
      else if(v instanceof Cursor)x="cursorPresent=true count="+((Cursor)v).getCount();
      else if(v instanceof Collection)x="count="+((Collection<?>)v).size();
      else if(v instanceof byte[])x="bytes="+((byte[])v).length;
      else if(v instanceof String)x="stringKey="+Integer.toHexString(v.hashCode())+" length="+((String)v).length();
      else x="type="+v.getClass().getName();
      mark(s+" "+x);
    } catch(Throwable e){mark(s+" valueInspectionError="+e.getClass().getSimpleName());}
  }
}