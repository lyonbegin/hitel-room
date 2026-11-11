package app.hitel.sherpaoriginalcli;

import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Process;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * User-initiated, on-device voice enrollment ONLY BEFORE making a phone call.
 * Saves 5 seconds of raw PCM16 mono 16kHz to app-private storage; it is never
 * uploaded, embedded in diagnostics, or captured during a phone call.
 *
 * The profile identifies the user's OWN voice. Without enrollment an
 * unsupervised speaker A/B label must NOT be presented as "me"/"other".
 */
final class SpeakerEnrollment {
  static final String FILE_NAME="self-16000.pcm";
  static final int RATE=16000;
  static final int SECONDS=5;
  interface Callback { void done(boolean success,String message); }
  static File output(Context context){
    return new File(new File(context.getFilesDir(),"speaker"),FILE_NAME);
  }
  static boolean exists(Context context){
    File f=output(context);
    return f.isFile()&&f.length()>=RATE*2*4 && f.length()<=RATE*2*10;
  }
  static void record(Context context,Callback cb){
    Context app=context.getApplicationContext();
    new Thread(()->{
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
      AudioRecord recorder=null;
      File temp=null;
      boolean ok=false;
      String result;
      try{
        int min=AudioRecord.getMinBufferSize(RATE,
          AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
        if(min<=0)throw new IOException("16kHz 단일 채널 마이크를 사용할 수 없습니다.");
        int bufferSize=Math.max(min,RATE*2/4);
        recorder=new AudioRecord(MediaRecorder.AudioSource.MIC,RATE,
          AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,bufferSize);
        if(recorder.getState()!=AudioRecord.STATE_INITIALIZED)
          throw new IOException("마이크 초기화에 실패했습니다.");
        File target=output(app);
        File dir=target.getParentFile();
        if(dir==null||(!dir.isDirectory()&&!dir.mkdirs()))
          throw new IOException("기기 내부 화자 저장 폴더를 만들 수 없습니다.");
        temp=new File(dir,FILE_NAME+".partial");
        recorder.startRecording();
        if(recorder.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)
          throw new IOException("마이크 녹음이 시작되지 않았습니다.");
        final int expected=RATE*2*SECONDS;
        int recorded=0;
        double energy=0;
        long energySamples=0;
        byte[] bytes=new byte[4096];
        try(FileOutputStream out=new FileOutputStream(temp,false)){
          while(recorded<expected){
            int want=Math.min(bytes.length,expected-recorded);
            int n=recorder.read(bytes,0,want);
            if(n<=0)throw new IOException("마이크 읽기 실패: "+n);
            out.write(bytes,0,n);
            for(int i=0;i+1<n;i+=2){
              int u=(bytes[i]&255)|((bytes[i+1]&255)<<8);
              short sample=(short)u;
              double value=sample/32768.0;
              energy+=value*value;
              energySamples++;
            }
            recorded+=n;
          }
          out.flush();out.getFD().sync();
        }
        if(temp.length()!=expected)throw new IOException("등록 음성 길이가 올바르지 않습니다.");
        if(energySamples==0 || Math.sqrt(energy/energySamples)<0.012)
          throw new IOException("목소리가 너무 작거나 무음입니다. 조용한 곳에서 다시 등록하십시오.");
        if(target.exists()&&!target.delete())
          throw new IOException("기존 음성 등록 파일을 교체할 수 없습니다.");
        if(!temp.renameTo(target))
          throw new IOException("음성 등록 파일 저장에 실패했습니다.");
        ok=true;
        result="내 목소리 5초 등록 완료 · 기기 내부에만 저장";
      }catch(Throwable error){
        result="내 목소리 등록 실패: "+error.getMessage();
      }finally{
        if(recorder!=null){
          try{recorder.stop();}catch(Exception ignored){}
          recorder.release();
        }
        if(temp!=null&&temp.exists()&&!ok)temp.delete();
      }
      cb.done(ok,result);
    },"Speaker-Enrollment-Only-Before-Call").start();
  }
  private SpeakerEnrollment(){}
}
