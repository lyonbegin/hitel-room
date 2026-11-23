package app.hitel.speakeronly;

import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.Locale;

/**
 * A virtual incoming/outgoing call for emulator tests, NOT a synthetic STT.
 * Writes original M4A bytes to the same SAF directory observed by SpeakerEngine
 * with the original Samsung-like cadence of 4.5-5.2 KB / 300ms.
 *
 * The source is private to the emulator, adb-pushed into:
 *   run-as <package> .../files/virtual_call/original.m4a
 * Never uploads or checks the original call recording into public GitHub.
 */
final class VirtualCallReplay {
  private static volatile Thread current;
  private static final String TAG="IXIO_VIRTUAL_CALL";
  static synchronized void start(Context context,int firstWriteDelayMs,int periodMs,
                                  int bytesPerPeriod,int stopAfterMs) throws IOException {
    if(current!=null && current.isAlive())
      throw new IOException("Virtual call already running");
    Context app=context.getApplicationContext();
    File src=VirtualM4aDocumentsProvider.source(app);
    File dest=VirtualM4aDocumentsProvider.live(app);
    if(!src.isFile() || src.length()<4096)
      throw new IOException("Original M4A not staged privately: "+src);
    if(!dest.getParentFile().isDirectory() && !dest.getParentFile().mkdirs())
      throw new IOException("Cannot create virtual Samsung recording folder");
    if(dest.exists() && !dest.delete())
      throw new IOException("Cannot erase previous virtual recording");
    int delay=Math.max(0,Math.min(15000,firstWriteDelayMs));
    int every=Math.max(64,Math.min(1000,periodMs));
    int block=Math.max(1024,Math.min(32768,bytesPerPeriod));
    int cutoff=Math.max(0,stopAfterMs);
    Thread t=new Thread(()->replay(app,src,dest,delay,every,block,cutoff),
      "Virtual-Samsung-M4A-Growing-Writer");
    current=t;t.start();
  }
  private static void replay(Context app,File src,File dest,int delay,
                             int period,int block,int cutoff) {
    long callStart=SystemClock.elapsedRealtime();
    long wrote=0;
    boolean fullyCopied=false;
    String sha="";
    try {
      if(delay>0)SystemClock.sleep(delay);
      long afterDelay=SystemClock.elapsedRealtime();
      long next=afterDelay;
      byte[] buffer=new byte[block];
      MessageDigest hash=MessageDigest.getInstance("SHA-256");
      try(FileInputStream in=new FileInputStream(src);
          FileOutputStream out=new FileOutputStream(dest,false)) {
        int n;
        while((n=in.read(buffer))>=0){
          if(n==0)continue;
          if(cutoff>0 && SystemClock.elapsedRealtime()-callStart>=cutoff) break;
          // Pace by monotonic deadline, not loop overhead. Use original bytes.
          long now=SystemClock.elapsedRealtime();
          if(next>now)SystemClock.sleep(next-now);
          out.write(buffer,0,n);
          out.flush();
          hash.update(buffer,0,n);
          wrote+=n;
          long elapsed=SystemClock.elapsedRealtime()-callStart;
          Log.i(TAG,"VIRTUAL_M4A_WRITE audioBytes="+wrote+
            " tSinceCallMs="+elapsed+" sourceBytes="+src.length()+
            " writePeriodMs="+period+" sourcePath=virtual_samsung");
          VirtualM4aDocumentsProvider.changed(app);
          next+=period;
        }
        out.getFD().sync();
      }
      fullyCopied=wrote==src.length();
      StringBuilder hex=new StringBuilder();
      for(byte b:hash.digest())
        hex.append(String.format(Locale.US,"%02x",b&255));
      sha=hex.toString();
      Log.i(TAG,"VIRTUAL_CALL_AUDIO_EOF bytes="+wrote+" full="+fullyCopied+
        " sha256="+sha+" sinceCallMs="+(SystemClock.elapsedRealtime()-callStart));
      VirtualM4aDocumentsProvider.changed(app);
      // Allow the real original follower/decoder to drain trailing packets.
      SystemClock.sleep(2000);
    }catch(Throwable e){
      Log.e(TAG,"VIRTUAL_CALL_WRITER_ERROR bytes="+wrote,e);
    }finally {
      Intent end=new Intent(app,SpeakerService.class).setAction(SpeakerService.VIRTUAL_END);
      end.putExtra("virtualBytes",wrote);
      end.putExtra("virtualFullM4a",fullyCopied);
      end.putExtra("virtualSha256",sha);
      try{app.startService(end);}
      catch(Throwable e){Log.e(TAG,"VIRTUAL_END_DELIVERY_FAILED",e);}
      synchronized(VirtualCallReplay.class){current=null;}
    }
  }
}
