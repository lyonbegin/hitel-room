package app.hitel.sherpafiletest;

import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Binder;
import android.os.IBinder;
import android.util.Log;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Isolated Android PROCESS (not a new recognizer): calls untouched upstream main(). */
public final class TranscribeWorkerService extends Service {
  public static final String ACTION_RUN="app.hitel.sherpafiletest.RUN_NATIVE_ORIGINAL";
  public static final String ACTION_LOG="app.hitel.sherpafiletest.NATIVE_ORIGINAL_LOG";
  public static final String ACTION_DONE="app.hitel.sherpafiletest.NATIVE_ORIGINAL_DONE";
  public static final String LOG_FILE="last-sherpa-upstream-stderr.txt";
  private static final String TAG="SherpaNativeWorker";
  private static boolean loaded=false;
  private static Throwable loadError=null;
  static{
    try{System.loadLibrary("sherpa-upstream-ffmpeg");loaded=true;}
    catch(Throwable e){loadError=e;Log.e(TAG,"Native library load failed",e);}
  }
  private native int nativeOriginal(String tok,String enc,String dec,String join,String file);
  private final IBinder binder=new Binder();
  private volatile boolean running=false;
  private FileOutputStream sink=null;
  @Override public IBinder onBind(Intent intent){return binder;}
  @Override public void onCreate(){super.onCreate();Log.i(TAG,"Started separate process");}
  @Override public int onStartCommand(Intent intent,int flags,int startId){
    if(intent==null||!ACTION_RUN.equals(intent.getAction())||running)return START_NOT_STICKY;
    running=true;
    new Thread(()->{
      int rc=-1;
      try{
        if(!loaded)throw new IllegalStateException("Native load failed",loadError);
        sink=new FileOutputStream(new File(getFilesDir(),LOG_FILE),false);
        String path=intent.getStringExtra("file");
        String tok=intent.getStringExtra("tokens");
        String enc=intent.getStringExtra("encoder");
        String dec=intent.getStringExtra("decoder");
        String join=intent.getStringExtra("joiner");
        if(path==null||tok==null||enc==null||dec==null||join==null)
          throw new IOException("Missing original model/audio path");
        Log.i(TAG,"Calling byte-identical upstream C engine; audioBytes="+new File(path).length());
        rc=nativeOriginal(tok,enc,dec,join,path);
        Log.i(TAG,"Upstream C main returned "+rc);
      }catch(Throwable e){
        Log.e(TAG,"Upstream bridge failure",e);
        byte[] bytes=("BRIDGE ERROR "+e+"\n").getBytes(StandardCharsets.UTF_8);
        onNativeBytes(bytes);
      }finally{
        try{if(sink!=null){sink.getFD().sync();sink.close();sink=null;}}catch(Exception ignored){}
        Intent result=new Intent(ACTION_DONE);
        result.setPackage(getPackageName());
        result.putExtra("code",rc);
        sendBroadcast(result);
        running=false;
        stopSelf(startId);
      }
    },"Unchanged-Upstream-Main").start();
    return START_NOT_STICKY;
  }
  @SuppressWarnings("unused") // Called only by the JNI output adapter, not by STT.
  private synchronized void onNativeBytes(byte[] bytes){
    try{
      if(sink!=null){sink.write(bytes);sink.flush();}
    }catch(IOException ioe){Log.e(TAG,"Could not persist original stderr",ioe);}
    String value=new String(bytes,StandardCharsets.UTF_8);
    Log.i(TAG,"UPSTREAM_STDERR: "+value.replace('\r',' ').replace('\n',' ').trim());
    Intent output=new Intent(ACTION_LOG);
    output.setPackage(getPackageName());
    output.putExtra("chunk",bytes);
    sendBroadcast(output);
  }
}
