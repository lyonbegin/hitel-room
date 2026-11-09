package app.hitel.sherpafiletest;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegKitConfig;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import java.util.concurrent.atomic.AtomicReference;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.database.Cursor;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.Typeface;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.EditText;
import android.util.Log;

import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;

import java.io.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Standalone file STT test; no telephony, microphone, default dialer or accessibility.
 * Android SAF picker, upstream M4A MediaExtractor/MediaCodec decoder, sherpa-onnx 1.12.26
 * Korean streaming Zipformer INT8. All inference runs locally and offline.
 */
public final class MainActivity extends Activity {
  private static final String TAG="SherpaFileTest";
  private static final int OPEN_FILE=31, SAVE_TXT=32;
  private static final String[] MODEL_FILES = {
      "encoder-epoch-99-avg-1.int8.onnx",
      "decoder-epoch-99-avg-1.onnx",
      "joiner-epoch-99-avg-1.int8.onnx",
      "tokens.txt"
  };
  private static final long[] MODEL_MIN = {115000000L,9500000L,2000000L,50000L};
  private Uri selected;
  private String selectedName="";
  private TextView selectedView, status;
  private EditText transcript;
  private Button transcribe,save,copy,stop;
  private volatile boolean busy=false;
  private volatile boolean stopRequested=false;
  private final AtomicReference<FFmpegSession> activeFfmpeg=new AtomicReference<>();
  private volatile String activePipe=null;

  private TextView text(String s, int sp) {
    TextView v=new TextView(this);
    v.setText(s); v.setTextSize(sp); v.setPadding(0,12,0,12);
    return v;
  }
  private Button button(String caption,LinearLayout parent) {
    Button b=new Button(this);
    b.setText(caption);
    parent.addView(b,new LinearLayout.LayoutParams(-1,-2));
    return b;
  }
  @Override public void onCreate(Bundle state){
    super.onCreate(state);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int pad=(int)(18*getResources().getDisplayMetrics().density);
    root.setPadding(pad,pad,pad,pad);
    scroll.addView(root);
    TextView title=text("한국어 Sherpa 파일 STT",23);
    title.setTypeface(null,Typeface.BOLD);
    root.addView(title);
    root.addView(text("독립 테스트 앱 · 삼성 전화 앱 변경 없음\nFFmpeg PCM 파이프 0.1초 → sherpa-onnx 1.12.26\n한국어 Zipformer INT8 · 모델 APK 포함 · 진행 중 자막 표시",13));
    Button pick=button("1. M4A/WAV/MP3 파일 선택",root);
    selectedView=text("선택한 파일 없음",14);
    root.addView(selectedView);
    transcribe=button("2. 파일 STT 시작 (실시간 결과 표시)",root);
    transcribe.setEnabled(false);
    stop=button("인식 중지",root);
    stop.setEnabled(false);
    status=text("준비됨. 파일을 선택해 주십시오.",14);
    root.addView(status);
    TextView resultTitle=text("인식 결과",19);
    resultTitle.setTypeface(null,Typeface.BOLD);
    root.addView(resultTitle);
    transcript=new EditText(this);
    transcript.setTextSize(16);
    transcript.setMinLines(9);
    transcript.setGravity(android.view.Gravity.TOP);
    transcript.setHint("여기에 sherpa-onnx 인식 문장이 표시됩니다.");
    root.addView(transcript,new LinearLayout.LayoutParams(-1,(int)(240*getResources().getDisplayMetrics().density)));
    copy=button("텍스트 복사",root);
    save=button("3. TXT 저장 위치 직접 선택",root);
    copy.setEnabled(false);
    save.setEnabled(false);
    root.addView(text("진단: adb logcat -s SherpaFileTest\n원본 오디오는 외부 전송하지 않습니다. 결과를 다른 앱의 전용 폴더에 자동 저장하지 않습니다.",12));
    setContentView(scroll);
    pick.setOnClickListener(v->{
      if(busy)return;
      Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.setType("audio/*");
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
      i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"audio/mp4","audio/m4a","audio/mpeg","audio/wav","audio/x-wav","audio/aac","audio/*"});
      startActivityForResult(i,OPEN_FILE);
    });
    transcribe.setOnClickListener(v->runStt());
    stop.setOnClickListener(v->stopStreaming());
    copy.setOnClickListener(v->{
      ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("Sherpa Korean STT",transcript.getText().toString()));
      notifyStatus("텍스트를 복사했습니다.");
    });
    save.setOnClickListener(v->{
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TITLE, selectedName.replaceFirst("(?i)\\.[^.]+$","") + ".txt");
      startActivityForResult(i,SAVE_TXT);
    });
  }
  @Override public void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(result!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();
    if(request==OPEN_FILE){
      selected=uri;
      try {getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}
      catch(SecurityException ignored) {}
      selectedName=getFileName(uri);
      selectedView.setText("선택: "+selectedName);
      transcribe.setEnabled(true);
      notifyStatus("선택 완료. STT 실행을 누르십시오.");
    } else if(request==SAVE_TXT){
      try(OutputStream out=getContentResolver().openOutputStream(uri,"w")){
        if(out==null)throw new IOException("출력 스트림이 없습니다.");
        out.write(transcript.getText().toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        out.flush();
        notifyStatus("TXT 저장 완료: "+uri);
      }catch(Exception e){fail("TXT 저장 실패",e);}
    }
  }
  private String getFileName(Uri uri){
    String n="recording.m4a";
    try(Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(c!=null && c.moveToFirst()&&!c.isNull(0))n=c.getString(0);
    }catch(Exception ignored){}
    return n;
  }
  private void notifyStatus(String s){
    Log.i(TAG,s);
    runOnUiThread(()->status.setText(s));
  }
  private void fail(String stage,Throwable error){
    Log.e(TAG,stage,error);
    notifyStatus(stage+": "+error.getClass().getSimpleName()+" : "+error.getMessage());
  }
  private void stopStreaming(){
    if(!busy)return;
    stopRequested=true;
    notifyStatus("중지 요청: FFmpeg 스트림을 종료합니다. 지금까지 인식한 문장은 유지합니다.");
    FFmpegSession session=activeFfmpeg.get();
    if(session!=null)FFmpegKit.cancel(session.getSessionId());
    stop.setEnabled(false);
  }
  private static String displayText(StringBuilder committed,String partial){
    String fixed=committed.toString();
    return partial.isEmpty()?fixed:fixed.isEmpty()?partial:fixed+"\n"+partial;
  }
  private void showStreaming(String value,String stage){
    runOnUiThread(()->{
      transcript.setText(value);
      if(stage!=null)status.setText(stage);
      if(!value.isBlank()){copy.setEnabled(true);save.setEnabled(true);}
    });
  }
  private static int readWindow(InputStream in,byte[] buffer)throws IOException{
    int count=0;
    while(count<buffer.length){
      int n=in.read(buffer,count,buffer.length-count);
      if(n<0)break;
      if(n==0)continue;
      count+=n;
    }
    return count;
  }
  private void runStt(){
    final Uri uri=selected;
    if(uri==null||busy)return;
    busy=true;
    stopRequested=false;
    transcribe.setEnabled(false);
    stop.setEnabled(true);
    copy.setEnabled(false);
    save.setEnabled(false);
    transcript.setText("");
    new Thread(()->{
      OnlineRecognizer recognizer=null;
      OnlineStream stream=null;
      String pipePath=null;
      long lastUiAt=0L;
      long pcmSamples=0L,decodeSteps=0L,nonZero=0L;
      int endpoints=0;
      StringBuilder committed=new StringBuilder();
      String lastShown="";
      try{
        File modelDir=extractModels();
        notifyStatus("한국어 Zipformer 모델 초기화 중…");
        OnlineTransducerModelConfig tr=new OnlineTransducerModelConfig();
        tr.setEncoder(new File(modelDir,MODEL_FILES[0]).getAbsolutePath());
        tr.setDecoder(new File(modelDir,MODEL_FILES[1]).getAbsolutePath());
        tr.setJoiner(new File(modelDir,MODEL_FILES[2]).getAbsolutePath());
        OnlineModelConfig mc=new OnlineModelConfig();
        mc.setTransducer(tr);
        mc.setTokens(new File(modelDir,MODEL_FILES[3]).getAbsolutePath());
        mc.setModelType("zipformer");
        mc.setNumThreads(2);
        mc.setProvider("cpu");
        OnlineRecognizerConfig cfg=new OnlineRecognizerConfig();
        cfg.setModelConfig(mc);
        cfg.setEnableEndpoint(true);
        cfg.setDecodingMethod("greedy_search");
        recognizer=new OnlineRecognizer(null,cfg);
        stream=recognizer.createStream("");
        String saf=FFmpegKitConfig.getSafParameterForRead(this,uri);
        if(saf==null||saf.isBlank())throw new IOException("FFmpeg SAF 입력 주소 생성 실패");
        pipePath=FFmpegKitConfig.registerNewFFmpegPipe(this);
        if(pipePath==null)throw new IOException("FFmpeg named pipe 생성 실패");
        activePipe=pipePath;
        final String[] ffArgs={
          "-hide_banner","-loglevel","error","-nostdin",
          "-i",saf,"-map","0:a:0","-vn",
          "-ac","1","-ar","16000",
          "-c:a","pcm_s16le","-f","s16le",
          "-flush_packets","1","-y",pipePath
        };
        notifyStatus("FFmpeg 16kHz PCM 스트리밍 연결 중…");
        Log.i(TAG,"FFMPEG_START source="+selectedName+" outputPipe="+pipePath);
        final String[] ffError={""};
        FFmpegSession ff=FFmpegKit.executeWithArgumentsAsync(ffArgs,session->{
          ReturnCode code=session.getReturnCode();
          Log.i(TAG,"FFMPEG_EXIT rc="+code+" success="+ReturnCode.isSuccess(code));
          if(!ReturnCode.isSuccess(code))Log.e(TAG,"FFMPEG_FAILURE="+session.getFailStackTrace());
        });
        activeFfmpeg.set(ff);
        byte[] bytes=new byte[3200]; // 0.1 s @ 16000 Hz, signed 16 bit mono
        try(InputStream pcm=new BufferedInputStream(new FileInputStream(pipePath),3200*2)){
          while(!stopRequested){
            int count=readWindow(pcm,bytes);
            if(count==0)break;
            if((count&1)!=0)throw new IOException("FFmpeg PCM 바이트 수 홀수: "+count);
            float[] samples=new float[count/2];
            for(int i=0;i<samples.length;i++){
              int lo=bytes[i*2]&0xff;
              int hi=bytes[i*2+1];
              short s=(short)((hi<<8)|lo);
              samples[i]=s/32768f;
              if(Math.abs((int)s)>250)nonZero++;
            }
            stream.acceptWaveform(samples,16000);
            pcmSamples+=samples.length;
            while(recognizer.isReady(stream)){
              recognizer.decode(stream);
              decodeSteps++;
            }
            String partial=recognizer.getResult(stream).getText().trim();
            boolean endpoint=recognizer.isEndpoint(stream);
            if(endpoint){
              if(!partial.isEmpty()){
                if(committed.length()>0)committed.append("\n");
                committed.append(partial);
                endpoints++;
              }
              recognizer.reset(stream);
              partial="";
            }
            String shown=displayText(committed,partial);
            long now=SystemClock.elapsedRealtime();
            if(!shown.equals(lastShown)&&now-lastUiAt>=120){
              lastUiAt=now;
              lastShown=shown;
              showStreaming(shown,String.format(Locale.KOREA,
                "인식 중: 오디오 %.1f초 · 확정 %d문장",pcmSamples/16000.0,endpoints));
            }else if(now-lastUiAt>800){
              lastUiAt=now;
              notifyStatus(String.format(Locale.KOREA,
                "처리 중: 오디오 %.1f초 · PCM %d샘플 · decode %d회 · 유효진폭 %d",
                pcmSamples/16000.0,pcmSamples,decodeSteps,nonZero));
            }
          }
        }
        if(!stopRequested){
          // Official sherpa-onnx FFmpeg C example flushes input on EOF.
          stream.acceptWaveform(new float[4800],16000); // 0.3s tail
          stream.inputFinished();
          while(recognizer.isReady(stream)){
            recognizer.decode(stream);
            decodeSteps++;
          }
          String finalText=recognizer.getResult(stream).getText().trim();
          if(!finalText.isEmpty()){
            if(committed.length()>0)committed.append("\n");
            committed.append(finalText);
          }
        }
        String text=committed.toString().trim();
        Log.i(TAG,"FILE_ASR_RESULT model=streaming-zipformer-ko-2024-06-16;"
         +" source="+selectedName+"; pcmSamples="+pcmSamples+"; decodeSteps="+decodeSteps
         +"; amplitudeAbove250="+nonZero+"; endpoints="+endpoints
         +"; textLength="+text.length()+"; stopped="+stopRequested);
        if(!text.isEmpty()){
          showStreaming(text,null);
          notifyStatus(String.format(Locale.KOREA,
            "%s: 오디오 %.1f초 · 문장 %d개 · TXT 저장 가능",
            stopRequested?"중지":"완료",pcmSamples/16000.0,endpoints+(text.isEmpty()?0:1)));
        }else if(stopRequested){
          notifyStatus("사용자가 중지했습니다. 아직 확정된 문장이 없습니다.");
        }else{
          throw new IOException("결과 공백 · PCM샘플="+pcmSamples+
           ", decodeSteps="+decodeSteps+", 유효진폭="+nonZero+
           ". adb logcat -s SherpaFileTest 에서 원인을 확인하십시오.");
        }
      }catch(Throwable e){
        if(stopRequested)notifyStatus("인식 중지됨. 생성된 문장은 화면에 유지됩니다.");
        else fail("FFmpeg 스트리밍 STT 실패",e);
      }finally{
        FFmpegSession s=activeFfmpeg.getAndSet(null);
        if(s!=null && stopRequested)FFmpegKit.cancel(s.getSessionId());
        if(pipePath!=null)FFmpegKitConfig.closeFFmpegPipe(pipePath);
        activePipe=null;
        if(stream!=null)try{stream.release();}catch(Throwable ignore){}
        if(recognizer!=null)try{recognizer.release();}catch(Throwable ignore){}
        busy=false;
        runOnUiThread(()->{
          transcribe.setEnabled(selected!=null);
          stop.setEnabled(false);
        });
      }
    },"Sherpa-FFmpeg-File-STT").start();
  }
  private File extractModels()throws IOException {
    File dir=new File(getFilesDir(),"sherpa-ko-v1");
    if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create model dir");
    for(int i=0;i<MODEL_FILES.length;i++){
      String n=MODEL_FILES[i];
      File dest=new File(dir,n);
      if(dest.length()>=MODEL_MIN[i])continue;
      notifyStatus("APK 내 한국어 모델 준비: "+n);
      File tmp=new File(dir,n+".part");
      if(tmp.exists()&&!tmp.delete())throw new IOException("Old .part removal failed");
      try(InputStream in=getAssets().open("models/"+n);FileOutputStream out=new FileOutputStream(tmp)){
        byte[] b=new byte[1024*128];int read;
        while((read=in.read(b))!=-1)out.write(b,0,read);
        out.getFD().sync();
      }
      if(tmp.length()<MODEL_MIN[i])throw new IOException("Bundled model incomplete: "+n+", bytes="+tmp.length());
      if(dest.exists()&&!dest.delete())throw new IOException("Cannot replace "+n);
      if(!tmp.renameTo(dest))throw new IOException("Cannot finish "+n);
    }
    return dir;
  }
  static final class Resampler16k {
    private long index=0;
    private double next=0;
    private float previous=0;
    private int rate=0;
    float[] push(float[] pcm,int sourceRate){
      if(rate==0)rate=sourceRate;
      if(rate!=sourceRate)throw new IllegalStateException("Changing sample rate not supported");
      double step=sourceRate/16000.0;
      float[] out=new float[Math.max(8,(int)Math.ceil(pcm.length*16000.0/sourceRate)+8)];
      int n=0;
      for(float current:pcm){
        if(index==0){
          out[n++]=current; next=step;previous=current;index=1;continue;
        }
        while(next<=index+1e-10){
          if(n==out.length)out=Arrays.copyOf(out,out.length*2);
          float t=(float)(next-(index-1));
          out[n++]=previous+(current-previous)*t;
          next+=step;
        }
        previous=current;index++;
      }
      return Arrays.copyOf(out,n);
    }
  }
}
