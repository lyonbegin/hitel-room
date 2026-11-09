package app.hitel.sherpaoriginalcli;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Continuous microphone capture with chunked offline SenseVoice inference.
 * Streaming CAPTURE is continuous; model inference works on sequential 4s windows.
 * This is not telecom downlink capture, and is not native token-by-token ASR.
 */
public final class LiveSttService extends Service {
  public static final String ACTION_START = "app.hitel.sherpaoriginalcli.LIVE_START";
  public static final String ACTION_STOP = "app.hitel.sherpaoriginalcli.LIVE_STOP";
  public static final String ACTION_UPDATE = "app.hitel.sherpaoriginalcli.LIVE_UPDATE";
  public static final String EXTRA_STATUS = "status";
  public static final String EXTRA_TEXT = "transcript";
  static final String TAG="LiveSenseVoice";
  static final int SAMPLE_RATE=16000;
  static final int CHUNK_SECONDS=4;
  static final int CHUNK_SAMPLES=SAMPLE_RATE*CHUNK_SECONDS;
  static final int NOTIFICATION_ID=1776;
  static final String CHANNEL="sensevoice_live_microphone";
  static final ArrayBlockingQueue<AudioChunk> chunks=new ArrayBlockingQueue<>(6);
  static volatile boolean isActive=false;

  volatile boolean recording=false;
  volatile boolean recorderDone=true;
  volatile boolean stopRequested=false;
  volatile AudioRecord recorder;
  volatile Process nativeProcess;
  Thread recordingThread, recognitionThread;
  StringBuilder transcript=new StringBuilder();
  int writtenChunks=0, processedChunks=0;

  static final class AudioChunk {
    final int seq;
    final byte[] pcm;
    final double rms;
    AudioChunk(int seq,byte[] pcm,double rms){
      this.seq=seq;this.pcm=pcm;this.rms=rms;
    }
  }
  public static boolean isActive(){return isActive;}

  @Override public IBinder onBind(Intent intent){return null;}

  @Override public int onStartCommand(Intent intent,int flags,int startId) {
    if(intent!=null && ACTION_STOP.equals(intent.getAction())){
      stopRequested=true;recording=false;
      AudioRecord r=recorder;
      if(r!=null){try{r.stop();}catch(Exception ignored){}}
      publish("마이크 스트리밍 중지 중…");
      if(!isActive)stopSelf();
      return START_NOT_STICKY;
    }
    if(isActive)return START_NOT_STICKY;
    try {
      startLiveForeground();
    }catch(Throwable e){
      Log.e(TAG,"Foreground microphone service start failed",e);
      publish("마이크 서비스 시작 실패: "+e.getMessage());
      stopSelf();
      return START_NOT_STICKY;
    }
    isActive=true;
    recording=true;
    recorderDone=false;
    stopRequested=false;
    writtenChunks=0;processedChunks=0;
    chunks.clear();
    transcript=new StringBuilder();
    getSharedPreferences("sensevoice_live",MODE_PRIVATE).edit()
        .putString(EXTRA_TEXT,"").putString(EXTRA_STATUS,"마이크 초기화 중…").apply();
    publish("마이크 초기화 중…");
    recognitionThread=new Thread(this::recognitionLoop,"SenseVoice-Live-Recognize");
    recordingThread=new Thread(this::recordingLoop,"SenseVoice-Live-Microphone");
    recognitionThread.start();
    recordingThread.start();
    return START_NOT_STICKY;
  }

  void startLiveForeground(){
    NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
    NotificationChannel channel=new NotificationChannel(CHANNEL,"한국어 실시간 마이크 STT",NotificationManager.IMPORTANCE_LOW);
    channel.setDescription("마이크 녹음과 한국어 STT가 진행 중입니다.");
    manager.createNotificationChannel(channel);
    PendingIntent show=PendingIntent.getActivity(this,0,
       new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    PendingIntent stop=PendingIntent.getService(this,1,
       new Intent(this,LiveSttService.class).setAction(ACTION_STOP),
       PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification note=new Notification.Builder(this,CHANNEL)
      .setContentTitle("한국어 STT · 마이크 실시간 인식")
      .setContentText("마이크를 4초 구간으로 계속 인식하고 있습니다.")
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentIntent(show).setOngoing(true).setOnlyAlertOnce(true)
      .addAction(android.R.drawable.ic_media_pause,"인식 중지",stop)
      .build();
    if(Build.VERSION.SDK_INT>=29){
      startForeground(NOTIFICATION_ID,note,ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
    }else{
      startForeground(NOTIFICATION_ID,note);
    }
  }

  void publish(String status){
    getSharedPreferences("sensevoice_live",MODE_PRIVATE).edit()
      .putString(EXTRA_STATUS,status)
      .putString(EXTRA_TEXT,transcript.toString())
      .apply();
    Intent update=new Intent(ACTION_UPDATE);
    update.setPackage(getPackageName());
    update.putExtra(EXTRA_STATUS,status);
    update.putExtra(EXTRA_TEXT,transcript.toString());
    sendBroadcast(update);
    Log.i(TAG,status);
  }

  void recordingLoop(){
    AudioRecord local=null;
    ByteArrayOutputStream pcm=new ByteArrayOutputStream(CHUNK_SAMPLES*2+8192);
    double squareSum=0;
    int count=0;
    try {
      if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)
        throw new SecurityException("마이크 RECORD_AUDIO 권한이 없습니다.");
      int bufferSize=AudioRecord.getMinBufferSize(SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
      if(bufferSize<=0)throw new IOException("AudioRecord 버퍼 규격 오류="+bufferSize);
      local=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,
          SAMPLE_RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,
          Math.max(bufferSize*2,8192));
      if(local.getState()!=AudioRecord.STATE_INITIALIZED)
        throw new IOException("AudioRecord 초기화에 실패했습니다.");
      recorder=local;
      local.startRecording();
      if(local.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)
        throw new IOException("마이크 캡처가 시작되지 않았습니다.");
      publish("마이크 연결됨 · 4초마다 자막 변환 중 (백그라운드 유지)");
      short[] samples=new short[1600];
      while(recording){
        int n=local.read(samples,0,samples.length,AudioRecord.READ_BLOCKING);
        if(n<0)throw new IOException("AudioRecord.read 실패="+n);
        if(n==0)continue;
        byte[] data=new byte[n*2];
        for(int i=0;i<n;i++){
          short x=samples[i];
          data[i*2]=(byte)(x&255);
          data[i*2+1]=(byte)((x>>8)&255);
          double v=x/32768.0;
          squareSum+=v*v;
        }
        pcm.write(data,0,data.length);
        count+=n;
        if(count>=CHUNK_SAMPLES){
          writtenChunks++;
          enqueue(new AudioChunk(writtenChunks,pcm.toByteArray(),Math.sqrt(squareSum/count)));
          pcm.reset();squareSum=0;count=0;
        }
      }
      if(count>=SAMPLE_RATE && !stopRequested){
        writtenChunks++;
        enqueue(new AudioChunk(writtenChunks,pcm.toByteArray(),Math.sqrt(squareSum/count)));
      }
    }catch(Throwable e){
      Log.e(TAG,"Continuous microphone capture failed",e);
      publish("마이크 스트리밍 오류: "+e.getMessage());
    }finally{
      recording=false;
      recorderDone=true;
      recorder=null;
      if(local!=null){
        try{if(local.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING)local.stop();}
        catch(Exception ignored){}
        try{local.release();}catch(Exception ignored){}
      }
    }
  }

  void enqueue(AudioChunk chunk){
    if(!chunks.offer(chunk)){
      AudioChunk discarded=chunks.poll();
      chunks.offer(chunk);
      publish("처리 지연: 오래된 구간 "+(discarded==null?"?":discarded.seq)+" 건너뜀");
    }else{
      Log.i(TAG,"MIC_CHUNK_CAPTURED seq="+chunk.seq+" seconds="+(chunk.pcm.length/32000.0)+" rms="+chunk.rms);
    }
  }

  File extract(String name,long min) throws IOException {
    File dir=new File(getFilesDir(),"sensevoice-int8");
    if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("모델 저장 경로 생성 실패");
    File dest=new File(dir,name);
    if(dest.isFile()&&dest.length()>=min)return dest;
    File temp=new File(dir,name+".partial");
    if(temp.exists()&&!temp.delete())throw new IOException("모델 임시 파일 초기화 실패");
    try(InputStream in=getAssets().open("sensevoice/"+name);
        FileOutputStream out=new FileOutputStream(temp)){
      byte[] buf=new byte[65536];int n;
      while((n=in.read(buf))!=-1){if(n>0)out.write(buf,0,n);}
      out.getFD().sync();
    }
    if(temp.length()<min)throw new IOException("SenseVoice 모델 누락: "+name);
    if(dest.exists()&&!dest.delete())throw new IOException("모델 파일 교체 실패");
    if(!temp.renameTo(dest))throw new IOException("모델 파일 준비 실패");
    return dest;
  }

  static void put32(FileOutputStream out,int value)throws IOException{
    for(int i=0;i<4;i++)out.write((value>>(i*8))&255);
  }
  static void put16(FileOutputStream out,int value)throws IOException{
    out.write(value&255);out.write((value>>8)&255);
  }
  File writeChunkAsWave(AudioChunk chunk)throws IOException{
    File f=new File(getCacheDir(),"live-sensevoice-chunk-"+chunk.seq+".wav");
    try(FileOutputStream out=new FileOutputStream(f,false)){
      out.write(new byte[]{'R','I','F','F'});
      put32(out,36+chunk.pcm.length);
      out.write(new byte[]{'W','A','V','E','f','m','t',' '});
      put32(out,16);put16(out,1);put16(out,1);
      put32(out,SAMPLE_RATE);put32(out,SAMPLE_RATE*2);put16(out,2);put16(out,16);
      out.write(new byte[]{'d','a','t','a'});
      put32(out,chunk.pcm.length);
      out.write(chunk.pcm);
      out.flush();
    }
    return f;
  }

  String decode(File model,File tokens,File wav,int seq)throws Exception {
    File binary=new File(getApplicationInfo().nativeLibraryDir,"libsensevoice-cli.so");
    if(!binary.isFile()||!binary.canExecute())throw new IOException("ARM64 STT 실행 파일 누락");
    ProcessBuilder pb=new ProcessBuilder(binary.getAbsolutePath(),
       tokens.getAbsolutePath(),model.getAbsolutePath(),wav.getAbsolutePath());
    pb.redirectErrorStream(true);
    pb.directory(getFilesDir());
    String original=pb.environment().get("LD_LIBRARY_PATH");
    pb.environment().put("LD_LIBRARY_PATH",getApplicationInfo().nativeLibraryDir+(original==null?"":":"+original));
    Process p=pb.start();
    nativeProcess=p;
    // Native tool prints only small diagnostic output. Wait with hard timeout so
    // foreground microphone capture never hangs indefinitely.
    boolean finished=p.waitFor(75,TimeUnit.SECONDS);
    if(!finished){p.destroyForcibly();throw new IOException("STT 구간 "+seq+" 인식 75초 제한 초과");}
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();
    try(InputStream in=p.getInputStream()){
      byte[] b=new byte[2048];int n;
      while((n=in.read(b))!=-1 && bytes.size()<131072){if(n>0)bytes.write(b,0,n);}
    }
    nativeProcess=null;
    String logs=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
    Log.i(TAG,"CHUNK_RESULT seq="+seq+" rc="+p.exitValue()+" logs="+logs);
    if(p.exitValue()!=0)throw new IOException("구간 "+seq+" STT 종료코드="+p.exitValue()+" / "+logs);
    for(String line:logs.split("\\r?\\n")){
      if(line.startsWith("FULL_TRANSCRIPT:"))return line.substring("FULL_TRANSCRIPT:".length()).trim();
    }
    throw new IOException("구간 "+seq+" 에 FULL_TRANSCRIPT 결과 없음");
  }

  void recognitionLoop(){
    try{
      publish("SenseVoice 인식 모델 준비 중…");
      File model=extract("model.int8.onnx",1000000L);
      File tokens=extract("tokens.txt",1000L);
      while(recording||!recorderDone||!chunks.isEmpty()){
        AudioChunk chunk=chunks.poll(1,TimeUnit.SECONDS);
        if(chunk==null)continue;
        processedChunks++;
        if(chunk.rms<0.0005){
          publish("구간 "+chunk.seq+": 입력 음량 거의 없음 (마이크 신호 확인)");
          continue;
        }
        File wav=writeChunkAsWave(chunk);
        try{
          publish("구간 "+chunk.seq+" 한국어 인식 중 · 녹음은 계속 진행");
          String text=decode(model,tokens,wav,chunk.seq);
          if(!text.isEmpty()){
            if(transcript.length()>0)transcript.append('\n');
            transcript.append(text);
          }
          publish("구간 "+chunk.seq+" 처리 완료 · 인식 "+text.length()+"글자 · 누적 "+transcript.length()+"글자");
        }catch(Exception ex){
          Log.e(TAG,"SenseVoice chunk "+chunk.seq+" failed",ex);
          publish("구간 "+chunk.seq+" 인식 오류: "+ex.getMessage());
        }finally{
          if(wav.exists()&&!wav.delete())Log.w(TAG,"Failed to delete temp WAV");
        }
      }
    }catch(Throwable e){
      Log.e(TAG,"Live transcription worker failed",e);
      publish("인식 엔진 초기화 오류: "+e.getMessage());
      recording=false;stopRequested=true;
      AudioRecord r=recorder;
      if(r!=null){try{r.stop();}catch(Exception ignored){}}
    }finally{
      if(recordingThread!=null && recordingThread.isAlive()){
        try{recordingThread.join(2500);}catch(InterruptedException ignored){}
      }
      recording=false;
      isActive=false;
      publish("실시간 인식 종료 · 총 "+processedChunks+"구간 · 누적 "+transcript.length()+"글자");
      stopForeground(true);
      stopSelf();
    }
  }

  @Override public void onDestroy(){
    recording=false;stopRequested=true;
    AudioRecord r=recorder;
    if(r!=null){try{r.stop();}catch(Exception ignored){}}
    Process p=nativeProcess;
    if(p!=null)p.destroy();
    super.onDestroy();
  }
}
