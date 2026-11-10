package app.hitel.sherpaoriginalcli;

import android.content.Context;
import android.net.Uri;
import androidx.documentfile.provider.DocumentFile;
import java.io.*;

/** Reopens SAF URI and incrementally copies new bytes into a seekable private M4A. */
public final class GrowingFileMirror implements AutoCloseable {
  public final File file;
  private final Context app;
  private final TraceJournal journal;
  private final Uri uri;
  private volatile boolean stopped;
  private volatile long bytes;
  private volatile boolean moovDetected;
  private Thread thread;
  private long polls;
  private int openErrors;

  public GrowingFileMirror(Context c, TraceJournal t, Uri source){
    app=c.getApplicationContext();journal=t;uri=source;
    file=new File(app.getCacheDir(),"growing-audio-"+t.id()+".m4a");
  }
  public long count(){return bytes;}
  public boolean hasMoov(){return moovDetected;}
  public void start(){
    thread=new Thread(this::run,"Saf-Audio-File-Byte-Mirror");
    thread.start();
  }
  private void run(){
    journal.event("MIRROR","START","uri",uri.toString(),"privatePath",file.getAbsolutePath());
    while(!stopped){
      polls++;
      try{
        long advertised=-1;
        try{
          DocumentFile f=DocumentFile.fromSingleUri(app,uri);
          advertised=f==null?-1:f.length();
        }catch(Exception e){journal.error("MIRROR","STAT_FAILED",e);}
        int appended=appendNew(advertised);
        if(appended>0||polls%5==0){
          journal.event("MIRROR",appended>0?"GROWTH_COMMITTED":"POLL",
            "poll",polls,"advertisedSize",advertised,"mirroredSize",bytes,
            "appendedBytes",appended,"moovDetected",moovDetected,
            "openErrors",openErrors);
        }
      }catch(Throwable e){
        openErrors++;
        journal.error("MIRROR","COPY_FAILURE",e);
      }
      try{Thread.sleep(800);}catch(InterruptedException e){break;}
    }
    journal.event("MIRROR","STOPPED","copiedBytes",bytes,"moovDetected",moovDetected);
  }
  int appendNew(long advertised)throws Exception{
    InputStream in=app.getContentResolver().openInputStream(uri);
    if(in==null)throw new IOException("ContentResolver.openInputStream returned null");
    long sourceOffset=bytes;
    try(in){
      long remaining=sourceOffset;
      while(remaining>0){
        long advanced=in.skip(remaining);
        if(advanced>0){remaining-=advanced;continue;}
        int value=in.read();
        if(value<0){
          journal.event("MIRROR","URI_SNAPSHOT_SHORTER_THAN_ALREADY_COPIED",
            "expectedExisting",sourceOffset,"missingBytes",remaining,
            "advertisedSize",advertised);
          return 0;
        }
        remaining--;
      }
      try(FileOutputStream out=new FileOutputStream(file,true)){
        byte[] buffer=new byte[32768];
        int n,total=0;
        while((n=in.read(buffer))!=-1){
          if(stopped)break;
          if(n>0){out.write(buffer,0,n);total+=n;}
          if(total>50*1024*1024)throw new IOException("Diagnostic mirror per-pass 50MB cap");
        }
        if(total>0){
          out.getFD().sync();
          bytes+=total;
          checkTail();
        }
        return total;
      }
    }
  }
  private void checkTail(){
    long size=bytes;
    // Samsung M4A puts moov atom near the tail on finalization.
    try(RandomAccessFile raf=new RandomAccessFile(file,"r")){
      long start=Math.max(0,size-131072);
      int length=(int)Math.min(size-start,131072);
      byte[] data=new byte[length];
      raf.seek(start);raf.readFully(data);
      boolean found=false;
      long position=-1;
      for(int i=4;i+4<data.length;i++){
        if(data[i]=='m'&&data[i+1]=='o'&&data[i+2]=='o'&&data[i+3]=='v'){
          long n=GrowingCallEngine.u32(data,i-4);
          if(n>=8 && i-4+n<=data.length){
            found=true;position=start+i-4;
          }
        }
      }
      if(found&&!moovDetected){
        journal.event("FORMAT","MOOV_BOX_DETECTED",
          "fileBytes",size,"boxByteOffset",position,
          "note","Sample table may be present only after recorder finalized M4A");
      }
      moovDetected=found;
    }catch(Throwable e){journal.error("MIRROR","TAIL_SCAN_FAILED",e);}
  }
  @Override public void close(){
    stopped=true;
    if(thread!=null){
      thread.interrupt();
      try{thread.join(1200);}catch(InterruptedException ignored){}
    }
    journal.event("MIRROR","CLOSE","mirroredBytes",bytes,"fileExists",file.exists(),
      "deletedRawAudio",file.delete());
  }
}
