package app.hitel.sherpaoriginalcli;

import android.content.Context;
import android.os.SystemClock;
import java.io.*;
import java.util.concurrent.TimeUnit;

/**
 * One-process ASR warmup owned by the app, not the recording session.
 * Launches Korean Zipformer before the caller starts speaking.
 *
 * The child emits two tiny READY lines and then waits on stdin. The session
 * reader takes ownership of stdout/stderr only AFTER acquire(). No competing
 * readers, no duplicate recognizers, no pre-recording blank audio.
 */
public final class PrewarmedRecognizer {
  private static final Object LOCK=new Object();
  private static Thread loader;
  private static Process reserved;
  private static Throwable failure;
  private static boolean acquired;
  private static long launchedMs=0;
  private PrewarmedRecognizer(){}

  static File ensureAsset(Context context,String name,long minimum)throws IOException {
    File dir=new File(context.getFilesDir(),"sensevoice-int8");
    if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Cannot make STT model folder");
    File target=new File(dir,name);
    if(target.length()>=minimum)return target;
    File temporary=new File(dir,name+".warmup");
    try(InputStream in=context.getAssets().open("sensevoice/"+name);
        FileOutputStream out=new FileOutputStream(temporary,false)){
      byte[] buffer=new byte[256*1024];
      int n;
      while((n=in.read(buffer))!=-1)if(n>0)out.write(buffer,0,n);
      out.getFD().sync();
    }
    if(temporary.length()<minimum)throw new IOException("Incomplete Korean model asset "+name);
    if(target.exists()&&!target.delete())throw new IOException("Cannot replace "+name);
    if(!temporary.renameTo(target))throw new IOException("Cannot finish "+name);
    return target;
  }

  public static void warm(Context source){
    final Context context=source.getApplicationContext();
    synchronized(LOCK){
      if(loader!=null && loader.isAlive())return;
      if(reserved!=null&&reserved.isAlive())return;
      if(acquired)return; // active session owns the only 174M model.
      failure=null;
      loader=new Thread(()->{
        Process child=null;
        try{
          File executable=new File(context.getApplicationInfo().nativeLibraryDir,
                                   "libsensevoice-stream.so");
          if(!executable.canExecute())throw new IOException("Missing online Zipformer executable");
          File tokens=ensureAsset(context,"tokens.txt",1000);
          File encoder=ensureAsset(context,"encoder.int8.onnx",1000000);
          File decoder=ensureAsset(context,"decoder.int8.onnx",100000);
          File joiner=ensureAsset(context,"joiner.int8.onnx",100000);
          ProcessBuilder pb=new ProcessBuilder(executable.getAbsolutePath(),
               tokens.getAbsolutePath(),encoder.getAbsolutePath(),
               decoder.getAbsolutePath(),joiner.getAbsolutePath());
          String old=pb.environment().get("LD_LIBRARY_PATH");
          pb.environment().put("LD_LIBRARY_PATH",
             context.getApplicationInfo().nativeLibraryDir+
             (old==null?"":":"+old));
          pb.directory(context.getFilesDir());
          pb.redirectErrorStream(true);
          child=pb.start();
          synchronized(LOCK){
            launchedMs=SystemClock.elapsedRealtime();
            if(!acquired)reserved=child;
            LOCK.notifyAll();
          }
        }catch(Throwable e){
          synchronized(LOCK){failure=e;LOCK.notifyAll();}
          if(child!=null)child.destroy();
        }
      },"Korean-Zipformer-Eager-Prewarm");
      loader.setDaemon(true);
      loader.start();
    }
  }

  public static Process acquire(Context ctx,long maxWaitMs)throws InterruptedException{
    warm(ctx);
    final long deadline=SystemClock.elapsedRealtime()+maxWaitMs;
    synchronized(LOCK){
      while(reserved==null&&failure==null){
        long remaining=deadline-SystemClock.elapsedRealtime();
        if(remaining<=0)break;
        LOCK.wait(Math.min(remaining,400));
      }
      if(reserved!=null){
        Process p=reserved;reserved=null;
        if(p.isAlive()){
          acquired=true;
          return p;
        }
      }
      return null;
    }
  }

  public static String state(){
    synchronized(LOCK){
      if(reserved!=null&&reserved.isAlive())
        return "PROCESS_LAUNCHED:"+launchedMs;
      if(failure!=null)return "FAILED:"+failure.getClass().getSimpleName()+":"+failure.getMessage();
      if(acquired)return "OWNED_BY_SESSION";
      return "WARMING";
    }
  }
}
