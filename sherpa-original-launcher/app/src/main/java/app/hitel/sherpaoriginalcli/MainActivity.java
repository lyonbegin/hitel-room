package app.hitel.sherpaoriginalcli;

import android.app.Activity;
import android.os.Bundle;
import android.media.MediaMetadataRetriever;
import android.os.SystemClock;
import android.os.Handler;
import android.os.Looper;
import android.content.Context;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;
import android.graphics.Typeface;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Button;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/*
 * This file is ONLY the Android launcher/reader of original CLI stderr.
 * All audio decoding, resampling and STT live in the untouched upstream ELF.
 */
public final class MainActivity extends Activity {
  static final String TAG = "SherpaOriginalLauncher";
  static final String[] MODEL={"model.int8.onnx","tokens.txt"};
  static final long[] MIN={1000000L,1000L};
  static final Pattern SEGMENT=Pattern.compile("^([0-9]+):(.*)$");
  static final int OPEN=31,SAVE=32,SAVE_LOG=33;
  final Handler main=new Handler(Looper.getMainLooper());
  volatile Process child;
  volatile boolean busy=false,stopRequested=false;
  Uri chosenUri;
  String chosenName="", recognized="";
  Button choose,execute,stop,save,copy,saveLog;
  volatile File fullLogFile;
  TextView status,result,diagnostic,filename;
  final ByteArrayOutputStream logBuffer=new ByteArrayOutputStream();
  long lastUi=0;

  TextView text(String s,int size){
    TextView v=new TextView(this);
    v.setText(s);v.setTextSize(size);v.setPadding(0,10,0,10);
    return v;
  }
  Button button(LinearLayout root,String s){
    Button b=new Button(this);b.setText(s);root.addView(b);return b;
  }
  void status(String s){
    Log.i(TAG,s);
    main.post(()->status.setText(s));
  }
  @Override public void onCreate(Bundle saved){
    super.onCreate(saved);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    int pad=(int)(18*getResources().getDisplayMetrics().density);
    root.setPadding(pad,pad,pad,pad);
    scroll.addView(root);
    TextView head=text("한국어 통화 녹음 STT · SenseVoice",23);
    head.setTypeface(null,Typeface.BOLD);
    root.addView(head);
    root.addView(text("Sherpa-ONNX 공식 C API · SenseVoice 한국어 INT8\nFFmpegKit으로 AAC/M4A를 16kHz PCM으로 변환 후 인식\n오프라인 · ARM64 갤럭시 · ADB 불필요",13));
    choose=button(root,"1. M4A / 음성 파일 선택");
    filename=text("선택한 파일 없음",14);root.addView(filename);
    execute=button(root,"2. 한국어 SenseVoice STT 실행");execute.setEnabled(false);
    stop=button(root,"인식 중지");stop.setEnabled(false);
    status=text("준비됨",14);root.addView(status);
    TextView heading=text("인식 문장 (진행 중 계속 갱신)",18);
    heading.setTypeface(null,Typeface.BOLD);root.addView(heading);
    result=text("",17);result.setTextIsSelectable(true);root.addView(result);
    copy=button(root,"텍스트 복사");copy.setEnabled(false);
    save=button(root,"TXT 파일 저장");save.setEnabled(false);
    root.addView(text("FFmpeg / SenseVoice 전체 STT 로그",15));
    diagnostic=text("실행 전",12);diagnostic.setTextIsSelectable(true);root.addView(diagnostic);
    saveLog=button(root,"원본 실행 전체 로그 TXT 저장");saveLog.setEnabled(false);
    root.addView(text("엔진: Sherpa-ONNX v1.12.26 C API · SenseVoice 한국어 INT8.\n기존 삼성 기본 전화 앱은 변경하지 않습니다.\n통화 종료 후 저장된 녹음 파일을 선택하여 인식합니다.",11));
    setContentView(scroll);
    choose.setOnClickListener(v->{
      if(busy)return;
      Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("audio/*");
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivityForResult(i,OPEN);
    });
    execute.setOnClickListener(v->run());
    stop.setOnClickListener(v->{
      stopRequested=true;
      Process p=child;
      if(p!=null)p.destroy();
      stop.setEnabled(false);
      status("실행 중지 요청");
    });
    copy.setOnClickListener(v->{
      ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE))
        .setPrimaryClip(ClipData.newPlainText("Sherpa original STT",recognized));
      status("텍스트 복사 완료");
    });
    save.setOnClickListener(v->{
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TITLE,"sherpa-original-stt.txt");
      startActivityForResult(i,SAVE);
    });
    saveLog.setOnClickListener(v->{
      if(fullLogFile==null||!fullLogFile.isFile())return;
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TITLE,"sherpa-galaxy-full-diagnostic.txt");
      startActivityForResult(i,SAVE_LOG);
    });
    acceptIncomingAudio(getIntent());
  }
  /* Android's own content Uri entry point. It selects a file without touching the engine. */
  private void acceptAudioUri(Uri uri){
    if(uri==null)return;
    chosenUri=uri;
    chosenName="recording.m4a";
    try(Cursor c=getContentResolver().query(uri,
        new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(c!=null&&c.moveToFirst()&&!c.isNull(0))chosenName=c.getString(0);
    }catch(Exception ignored){}
    filename.setText("선택: "+chosenName);
    execute.setEnabled(true);
    status("파일 선택 완료");
    Log.i(TAG,"Accepted Android audio URI scheme="+uri.getScheme()+" name="+chosenName);
  }
  private void acceptIncomingAudio(Intent incoming){
    if(incoming==null)return;
    Uri uri=null;
    if(Intent.ACTION_VIEW.equals(incoming.getAction())) uri=incoming.getData();
    else if(Intent.ACTION_SEND.equals(incoming.getAction()))
      uri=incoming.getParcelableExtra(Intent.EXTRA_STREAM);
    acceptAudioUri(uri);
  }
  @Override public void onNewIntent(Intent incoming){
    super.onNewIntent(incoming);
    setIntent(incoming);
    acceptIncomingAudio(incoming);
  }
  @Override public void onActivityResult(int code,int resultCode,Intent data){
    super.onActivityResult(code,resultCode,data);
    if(resultCode!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();
    if(code==OPEN){
      acceptAudioUri(uri);
    }else if(code==SAVE){
      try(OutputStream out=getContentResolver().openOutputStream(uri)){
        if(out==null)throw new IOException("출력 스트림 없음");
        out.write(recognized.getBytes(StandardCharsets.UTF_8));
        out.flush();status("TXT 저장 완료");
      }catch(Exception e){status("TXT 저장 실패: "+e);}
    }else if(code==SAVE_LOG){
      try(InputStream in=new FileInputStream(fullLogFile);
          OutputStream out=getContentResolver().openOutputStream(uri)){
        if(out==null)throw new IOException("진단 로그 출력 스트림 없음");
        byte[] b=new byte[32768];int n;
        while((n=in.read(b))!=-1)if(n>0)out.write(b,0,n);
        out.flush();status("원본 전체 로그 저장 완료");
      }catch(Exception e){status("전체 로그 저장 실패: "+e);}
    }
  }
  File extractModels()throws IOException{
    File root=new File(getFilesDir(),"sensevoice-int8");
    if(!root.exists()&&!root.mkdirs())throw new IOException("모델 디렉터리 생성 실패");
    for(int i=0;i<MODEL.length;i++){
      File f=new File(root,MODEL[i]);
      if(f.length()>=MIN[i])continue;
      status("APK에 포함된 원본 모델 준비: "+MODEL[i]);
      File tmp=new File(root,MODEL[i]+".partial");
      try(InputStream in=getAssets().open("sensevoice/"+MODEL[i]);
          FileOutputStream out=new FileOutputStream(tmp)){
        byte[] buffer=new byte[131072];int n;
        while((n=in.read(buffer))!=-1)if(n>0)out.write(buffer,0,n);
        out.getFD().sync();
      }
      if(tmp.length()<MIN[i])throw new IOException("원본 모델 파일 누락: "+MODEL[i]);
      if(f.exists()&&!f.delete())throw new IOException("원본 모델 교체 실패");
      if(!tmp.renameTo(f))throw new IOException("원본 모델 저장 실패");
    }
    return root;
  }
  File stageAudio()throws IOException{
    File dest=new File(getCacheDir(),"selected-original-audio.m4a");
    try(InputStream in=getContentResolver().openInputStream(chosenUri);
        FileOutputStream out=new FileOutputStream(dest)){
      if(in==null)throw new IOException("녹음 파일을 열 수 없습니다");
      byte[] buffer=new byte[131072];int n;
      while((n=in.read(buffer))!=-1){
        if(stopRequested)throw new IOException("사용자 중지");
        if(n>0)out.write(buffer,0,n);
      }
    }
    if(dest.length()==0)throw new IOException("녹음 파일 길이가 0입니다");
    Log.i(TAG,"SOURCE_AUDIO_STAGED filename="+chosenName+" bytes="+dest.length());
    return dest;
  }
  // Pure instrumentation on FFmpeg's WAV output; it does not alter PCM or the original recognizer.
  static final class PcmAudit {
    final long samples;
    final double rms;
    final double peak;
    final long nonQuietSamples;
    PcmAudit(long samples,double rms,double peak,long nonQuietSamples){
      this.samples=samples;this.rms=rms;this.peak=peak;this.nonQuietSamples=nonQuietSamples;
    }
    long durationMs(){return samples*1000L/16000L;}
  }
  static int le16(RandomAccessFile in)throws IOException {
    return in.readUnsignedByte() | (in.readUnsignedByte()<<8);
  }
  static long le32(RandomAccessFile in)throws IOException {
    return ((long)in.readUnsignedByte()) | (((long)in.readUnsignedByte())<<8) |
           (((long)in.readUnsignedByte())<<16) | (((long)in.readUnsignedByte())<<24);
  }
  static PcmAudit inspectNormalizedWav(File wav)throws IOException {
    try(RandomAccessFile in=new RandomAccessFile(wav,"r")){
      byte[] hdr=new byte[12];in.readFully(hdr);
      if(hdr[0]!='R'||hdr[1]!='I'||hdr[2]!='F'||hdr[3]!='F'||
         hdr[8]!='W'||hdr[9]!='A'||hdr[10]!='V'||hdr[11]!='E')
        throw new IOException("RIFF/WAVE 형식이 아닙니다.");
      int format=-1,channels=-1,rate=-1,bits=-1;
      long dataStart=-1,dataBytes=-1;
      while(in.getFilePointer()+8<=in.length()){
        byte[] tag=new byte[4];in.readFully(tag);
        long size=le32(in),start=in.getFilePointer();
        if(size>in.length()-start)throw new IOException("WAV chunk 범위 초과");
        if(tag[0]=='f'&&tag[1]=='m'&&tag[2]=='t'&&tag[3]==' '){
          if(size<16)throw new IOException("WAV fmt 길이 오류");
          format=le16(in);channels=le16(in);rate=(int)le32(in);
          le32(in);le16(in);bits=le16(in);
        }else if(tag[0]=='d'&&tag[1]=='a'&&tag[2]=='t'&&tag[3]=='a'){
          dataStart=start;dataBytes=size;
        }
        if(dataStart>=0&&format>=0)break;
        long next=start+size+(size%2);
        if(next>in.length())next=in.length();
        in.seek(next);
      }
      if(format!=1||channels!=1||rate!=16000||bits!=16)
        throw new IOException("PCM WAV 규격 오류: fmt="+format+" ch="+channels+" rate="+rate+" bits="+bits);
      if(dataStart<0||dataBytes<3200||dataBytes%2!=0)
        throw new IOException("WAV data 샘플이 없거나 부족합니다: bytes="+dataBytes);
      in.seek(dataStart);
      byte[] buffer=new byte[16384];
      long left=dataBytes,samples=0,above=0;
      double sumSquares=0,peak=0;
      while(left>0){
        int take=(int)Math.min((long)buffer.length,left);
        in.readFully(buffer,0,take);
        for(int i=0;i<take;i+=2){
          int val=(short)((buffer[i]&255)|((buffer[i+1]&255)<<8));
          double a=Math.abs((double)val);
          sumSquares+=a*a;
          if(a>peak)peak=a;
          if(a>250)above++;
          samples++;
        }
        left-=take;
      }
      return new PcmAudit(samples,Math.sqrt(sumSquares/samples)/32768.0,peak/32768.0,above);
    }
  }

  /*
   * Keep upstream sherpa-onnx-ffmpeg.c UNTOUCHED.
   * Existing upstream FFmpegKit decodes AAC and normalizes only the input file
   * to fixed 16 kHz, signed 16-bit, mono WAV to avoid variable AAC frame
   * properties in the untouched example's abuffer.
   */
  File normalizeAudioWithOfficialFFmpeg(File compressed) throws IOException {
    if(stopRequested) throw new IOException("사용자 중지");
    File wav=new File(getCacheDir(),"sherpa-original-fixed-16k-mono.wav");
    if(wav.exists() && !wav.delete()) throw new IOException("이전 변환 파일 삭제 실패");
    status("FFmpeg 원본 모듈: 16kHz·16비트·모노 WAV로 입력 형식 정규화 중…");
    String[] args={
      "-hide_banner","-nostdin","-loglevel","warning","-y",
      "-i",compressed.getAbsolutePath(),
      "-map","0:a:0","-vn",
      "-ac","1","-ar","16000",
      "-c:a","pcm_s16le",
      wav.getAbsolutePath()
    };
    FFmpegSession session=FFmpegKit.executeWithArguments(args);
    if(!ReturnCode.isSuccess(session.getReturnCode())){
      String output=session.getAllLogsAsString();
      if(output!=null && output.length()>1400)output=output.substring(output.length()-1400);
      throw new IOException("FFmpeg 변환 실패 rc="+session.getReturnCode()+" / "+output);
    }
    if(wav.length()<44)throw new IOException("FFmpeg WAV 출력 크기가 비정상적입니다: "+wav.length());
    // Diagnostics only. Recognition and official C executable are untouched.
    long sourceDurationMs=-1;
    MediaMetadataRetriever mmr=new MediaMetadataRetriever();
    try{
      mmr.setDataSource(compressed.getAbsolutePath());
      String duration=mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
      if(duration!=null)sourceDurationMs=Long.parseLong(duration);
    }catch(Exception e){Log.w(TAG,"SOURCE_DURATION_UNAVAILABLE",e);}
    finally{try{mmr.release();}catch(Exception ignored){}}
    PcmAudit audit=inspectNormalizedWav(wav);
    long normalizedMs=audit.durationMs();
    Log.i(TAG,"NORMALIZED_WAV_AUDIT sourceDurationMs="+sourceDurationMs+
      " pcmDurationMs="+normalizedMs+" pcmSamples="+audit.samples+
      " rms="+audit.rms+" peak="+audit.peak+
      " nonQuietSamples="+audit.nonQuietSamples+
      " sourceBytes="+compressed.length()+" wavBytes="+wav.length());
    if(normalizedMs<200L)throw new IOException("FFmpeg 출력 PCM이 너무 짧습니다: "+normalizedMs+"ms");
    if(sourceDurationMs>=3000L && normalizedMs*100L<sourceDurationMs*95L)
      throw new IOException("FFmpeg 출력이 원본보다 짧습니다. originalMs="+sourceDurationMs+
        " decodedMs="+normalizedMs+"; 해당 녹음은 STT로 넘기지 않습니다.");
    if(audit.rms<0.0001)
      Log.w(TAG,"PCM_NEAR_SILENCE: 파일은 디코딩되었지만 음성 신호가 거의 없습니다. rms="+audit.rms);
    Log.i(TAG,"OFFICIAL_FFMPEG_PREPARED format=pcm_s16le rate=16000 channels=1 wavBytes="+wav.length());
    return wav;
  }
  void run(){
    if(chosenUri==null||busy)return;
    busy=true;stopRequested=false;recognized="";fullLogFile=null;
    execute.setEnabled(false);choose.setEnabled(false);saveLog.setEnabled(false);
    stop.setEnabled(true);save.setEnabled(false);copy.setEnabled(false);
    result.setText("");diagnostic.setText("원본 실행 파일 준비 중…");
    logBuffer.reset();
    new Thread(()->{
      try{
        File model=extractModels();
        status("M4A 파일 준비 중…");
        File selectedAudio=stageAudio();
        File audio=normalizeAudioWithOfficialFFmpeg(selectedAudio);
        if(stopRequested)throw new IOException("사용자 중지");
        File libDir=new File(getApplicationInfo().nativeLibraryDir);
        File original=new File(libDir,"libsensevoice-cli.so");
        if(!original.isFile()||!original.canExecute())
          throw new IOException("APK 원본 실행 파일을 실행할 수 없습니다: "+original);
        ProcessBuilder pb=new ProcessBuilder(
          original.getAbsolutePath(),
          new File(model,MODEL[1]).getAbsolutePath(),
          new File(model,MODEL[0]).getAbsolutePath(),
          audio.getAbsolutePath()
        );
        pb.redirectErrorStream(true);
        pb.directory(getFilesDir());
        String oldPath=pb.environment().get("LD_LIBRARY_PATH");
        pb.environment().put("LD_LIBRARY_PATH",libDir.getAbsolutePath()+
          (oldPath==null||oldPath.isEmpty()?"":":"+oldPath));
        Log.i(TAG,"Original executable="+original+" audioBytes="+audio.length());
        status("입력 정규화 완료 → 수정하지 않은 원본 STT 실행 중…");
        Process proc=pb.start();
        child=proc;
        fullLogFile=new File(getFilesDir(),"sherpa-last-full-native-output.txt");
        try(InputStream stdout=new BufferedInputStream(proc.getInputStream());
            FileOutputStream fullOut=new FileOutputStream(fullLogFile,false)){
          byte[] buffer=new byte[2048];int n;
          while((n=stdout.read(buffer))!=-1){
            if(n==0)continue;
            fullOut.write(buffer,0,n);
            logBuffer.write(buffer,0,n);
            if(logBuffer.size()>180000){
              byte[] bytes=logBuffer.toByteArray();
              logBuffer.reset();
              logBuffer.write(bytes,bytes.length-140000,140000);
            }
            long now=SystemClock.uptimeMillis();
            if(now-lastUi>120){lastUi=now;updateResult(false);}
          }
        }
        int code=proc.waitFor();
        updateResult(true);
        String text=toCaptions(new String(logBuffer.toByteArray(),StandardCharsets.UTF_8));
        Log.i(TAG,"Original CLI finished rc="+code+" recognizedChars="+text.length());
        if(stopRequested)status("작업을 중지했습니다.");
        else if(code!=0)status("원본 실행 오류 (종료코드 "+code+"). 아래 원본 로그를 확인하십시오.");
        else if(text.isEmpty())status("SenseVoice 종료코드 0이지만 인식된 문장이 없습니다. 전체 로그를 확인하십시오.");
        else status("원본 음성인식 완료. 자막과 TXT 저장을 확인하십시오.");
      }catch(Throwable e){
        Log.e(TAG,"Original process start/run failed",e);
        status("원본 실행 오류: "+e.getMessage());
        main.post(()->diagnostic.setText(e.toString()));
      }finally{
        child=null;busy=false;
        main.post(()->{
          execute.setEnabled(chosenUri!=null);
          choose.setEnabled(true);stop.setEnabled(false);
          saveLog.setEnabled(fullLogFile!=null&&fullLogFile.isFile()&&fullLogFile.length()>0);
        });
      }
    },"Launch-SenseVoice-CAPI-Korean").start();
  }
  /* Only interprets the original program's terminal output.
   * It does NOT recognize speech, parse audio, or run the model.
   */
  static String toCaptions(String raw){
    String noAnsi=raw.replaceAll("\\u001B\\\\[[0-9;]*[a-zA-Z]","");
    for(String line:noAnsi.split("[\\r\\n]")){
      if(line.startsWith("FULL_TRANSCRIPT:")){
        return line.substring("FULL_TRANSCRIPT:".length()).trim();
      }
    }
    return "";
  }

  void updateResult(boolean finished){
    String raw=new String(logBuffer.toByteArray(),StandardCharsets.UTF_8);
    String parsed=toCaptions(raw);
    String diag=raw.length()>2500?raw.substring(raw.length()-2500):raw;
    String clean=diag.replaceAll("\\u001B\\[[0-9;]*[a-zA-Z]","");
    main.post(()->{
      if(!parsed.isEmpty()){
        recognized=parsed;
        result.setText(parsed);
        copy.setEnabled(true);save.setEnabled(true);
      }else if(finished)result.setText("음성인식 문장이 출력되지 않았습니다.");
      diagnostic.setText(clean);
    });
  }
}
