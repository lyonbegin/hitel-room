package app.hitel.samsungprobe;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.projection.MediaProjection;
import android.os.Process;
import android.os.SystemClock;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
import java.io.File;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * ADDITIVE output-capture adapter. Original KoreanSherpaStt.java is NEVER modified.
 * Feeds allowed media/game playback PCM to the same official sherpa-onnx model.
 * Android AudioPlaybackCapture does not expose carrier telephony downlink audio.
 */
public final class SpeakerPlaybackStt {
    public interface Listener {
        void onStatus(String message);
        void onPartial(String text);
        void onFinal(String text);
    }
    private final Context context;
    private final MediaProjection projection;
    private final Listener listener;
    private final int targetUid;
    private final String targetName;
    private final AtomicBoolean active=new AtomicBoolean(false);
    private volatile boolean stopped=false;
    private volatile AudioRecord recorder;
    private Thread thread;
    private static final int RATE=16000;
    private static final String[] MODEL={
        "encoder-epoch-99-avg-1.int8.onnx",
        "decoder-epoch-99-avg-1.onnx",
        "joiner-epoch-99-avg-1.int8.onnx",
        "tokens.txt"
    };
    private static final long[] MINIMUM={115000000L,9500000L,2000000L,50000L};

    public SpeakerPlaybackStt(Context context,MediaProjection projection,
                              int targetUid,String targetName,Listener listener){
        this.context=context.getApplicationContext();
        this.projection=projection;
        this.targetUid=targetUid;
        this.targetName=targetName==null?"전체 앱":targetName;
        this.listener=listener;
    }
    public boolean isRunning(){return active.get();}
    public void start(){
        if(!active.compareAndSet(false,true))return;
        stopped=false;
        thread=new Thread(this::run,"HITEL-Speaker-Sherpa-STT");
        thread.start();
    }
    public void stop(){
        stopped=true;
        AudioRecord a=recorder;
        if(a!=null)try{a.stop();}catch(Throwable ignored){}
    }
    private void status(String message){listener.onStatus(message);}
    private static final Object MODEL_LOCK=new Object();
    private static final String MODEL_ROOT="https://huggingface.co/k2-fsa/"+
        "sherpa-onnx-streaming-zipformer-korean-2024-06-16"+
        "/resolve/ba6078bca4daf3f0dd37f79d0ab505af71df14a6/";
    /** Reuse original v14 model cache. If missing, download exact same pinned
     * files with a speaker-specific staging suffix. Original mic source is
     * untouched, and both flows use identical model weights. */
    private File ensureOriginalModel() throws Exception {
        synchronized(MODEL_LOCK){
            File dir=new File(context.getFilesDir(),"sherpa-ko-v1");
            if(!dir.exists()&&!dir.mkdirs())throw new IllegalStateException("model dir unavailable");
            for(int i=0;i<MODEL.length;i++){
                if(stopped)return dir;
                File target=new File(dir,MODEL[i]);
                if(target.length()>=MINIMUM[i])continue;
                status("원본 한국어 모델 다운로드 "+(i+1)+"/4: "+MODEL[i]);
                File tmp=new File(dir,MODEL[i]+".speaker.part");
                if(tmp.exists()&&!tmp.delete())
                    throw new IllegalStateException("stale speaker model temp file");
                java.net.HttpURLConnection connection=(java.net.HttpURLConnection)
                    new java.net.URL(MODEL_ROOT+MODEL[i]+"?download=true").openConnection();
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(60000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent","HITEL14-Speaker-STT/1");
                try{
                    if(connection.getResponseCode()!=200)
                        throw new IllegalStateException("model HTTP "+connection.getResponseCode());
                    try(java.io.InputStream input=connection.getInputStream();
                        java.io.FileOutputStream output=new java.io.FileOutputStream(tmp)){
                        byte[] bytes=new byte[131072];int n;
                        while((n=input.read(bytes))!=-1){
                            if(stopped)return dir;
                            if(n>0)output.write(bytes,0,n);
                        }
                        output.getFD().sync();
                    }
                }finally{connection.disconnect();}
                if(tmp.length()<MINIMUM[i])throw new IllegalStateException(
                    "incomplete Korean model download: "+MODEL[i]);
                if(target.exists()&&!target.delete())
                    throw new IllegalStateException("cannot replace incomplete model");
                if(!tmp.renameTo(target))
                    throw new IllegalStateException("cannot finalize Korean model");
            }
            return dir;
        }
    }
    private AudioRecord playbackRecorder(){
        final int min=AudioRecord.getMinBufferSize(RATE,AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT);
        if(min<=0)throw new IllegalStateException("PCM sample rate unsupported: "+min);
        // The framework allows only playback usages permitted by the SOURCE app.
        // USAGE_VOICE_COMMUNICATION is explicitly NOT capturable through this API.
        AudioPlaybackCaptureConfiguration.Builder builder=
            new AudioPlaybackCaptureConfiguration.Builder(projection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN);
        if(targetUid>=0)builder.addMatchingUid(targetUid);
        AudioPlaybackCaptureConfiguration config=builder.build();
        status("실제 오디오 캡처 필터: "+targetName+" · UID="+
            (targetUid<0?"전체":targetUid)+
            " · 허용 usage=MEDIA/GAME/UNKNOWN");
        AudioRecord a=new AudioRecord.Builder()
            .setAudioPlaybackCaptureConfig(config)
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(RATE)
                .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                .build())
            .setBufferSizeInBytes(Math.max(8192,min*2))
            .build();
        if(a.getState()!=AudioRecord.STATE_INITIALIZED){
            a.release();throw new IllegalStateException("Playback AudioRecord initialization failed");
        }
        return a;
    }
    private void run(){
        OnlineRecognizer asr=null;
        OnlineStream stream=null;
        AudioRecord audio=null;
        String failureDetail=null;
        try{
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
            if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                !=PackageManager.PERMISSION_GRANTED)
                throw new SecurityException("RECORD_AUDIO 권한이 없습니다.");
            status("출력음 STT 준비: 한국어 모델 확인 중 · 아직 오디오 캡처 시작 전");
            File dir=ensureOriginalModel();
            if(stopped)return;
            status("HITEL14 기존 한국어 모델 로딩 중 (마이크 엔진 변경 없음)");
            OnlineTransducerModelConfig transducer=new OnlineTransducerModelConfig();
            transducer.setEncoder(new File(dir,MODEL[0]).getAbsolutePath());
            transducer.setDecoder(new File(dir,MODEL[1]).getAbsolutePath());
            transducer.setJoiner(new File(dir,MODEL[2]).getAbsolutePath());
            OnlineModelConfig model=new OnlineModelConfig();
            model.setTransducer(transducer);
            model.setTokens(new File(dir,MODEL[3]).getAbsolutePath());
            model.setModelType("zipformer");
            model.setNumThreads(2);
            model.setProvider("cpu");
            OnlineRecognizerConfig cfg=new OnlineRecognizerConfig();
            cfg.setModelConfig(model);
            cfg.setEnableEndpoint(true);
            asr=new OnlineRecognizer(null,cfg);
            stream=asr.createStream("");
            if(stopped)return;
            audio=playbackRecorder();
            recorder=audio;
            audio.startRecording();
            if(audio.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)
                throw new IllegalStateException("시스템 출력 캡처 장치가 녹음 상태에 진입하지 못했습니다.");
            status("선택된 캡처 대상: "+targetName+
                " · UID="+(targetUid<0?"전체":targetUid)+
                " · 미디어/게임 출력음 캡처 시작" +
                " (전화 통화 수신음은 스피커폰에서도 보호됨)");
            short[] buffer=new short[1600];
            String lastPartial="",lastFinal="";
            long prevPartial=0,prevStats=SystemClock.elapsedRealtime();
            long signalSamples=0;
            double squares=0;
            while(!stopped){
                int n=audio.read(buffer,0,buffer.length,AudioRecord.READ_BLOCKING);
                if(n<0){
                    if(stopped)break;
                    throw new IllegalStateException("AudioRecord.read="+n);
                }
                if(n==0)continue;
                float[] samples=new float[n];
                for(int i=0;i<n;i++){
                    samples[i]=buffer[i]/32768f;
                    squares+=samples[i]*samples[i];
                }
                signalSamples+=n;
                stream.acceptWaveform(samples,RATE);
                while(asr.isReady(stream))asr.decode(stream);
                String partial=asr.getResult(stream).getText();
                long now=SystemClock.elapsedRealtime();
                if(partial!=null&&!partial.isBlank()&&!partial.equals(lastPartial)
                    &&now-prevPartial>=120){
                    lastPartial=partial;prevPartial=now;
                    listener.onPartial(partial);
                }
                if(asr.isEndpoint(stream)){
                    String text=asr.getResult(stream).getText();
                    if(text!=null&&!text.isBlank()){
                        lastFinal=text;
                        listener.onFinal(text);
                    }
                    asr.reset(stream);
                    lastPartial="";
                }
                if(now-prevStats>=3000){
                    double rms=signalSamples>0?Math.sqrt(squares/signalSamples):0;
                    String classification=rms>=0.0005?
                        "입력 신호 있음 · STT 처리 중":
                        "캡처 음성 없음 · 앱에 재생 중인 허용 미디어가 없거나 보호 오디오";
                    status("대상="+targetName+
                        " · 출력음 RMS="+String.format(Locale.US,"%.5f",rms)+
                        " · 상태="+classification+
                        (rms<0.0005?
                        " · 기본 전화앱의 통화 음성은 스피커폰에서도 이 API로 캡처할 수 없습니다."
                        :""));
                    signalSamples=0;squares=0;prevStats=now;
                }
            }
            if(asr!=null&&stream!=null){
                stream.inputFinished();
                while(asr.isReady(stream))asr.decode(stream);
                String tail=asr.getResult(stream).getText();
                if(tail!=null&&!tail.isBlank()&&!tail.equals(lastFinal))listener.onFinal(tail);
            }
        }catch(Throwable ex){
            if(!stopped){
                failureDetail=ex.getClass().getSimpleName()+": "+ex.getMessage();
                status("출력음 STT 실패: "+failureDetail);
            }
        }finally{
            recorder=null;
            if(audio!=null){
                try{if(audio.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING)audio.stop();}
                catch(Throwable ignored){}
                try{audio.release();}catch(Throwable ignored){}
            }
            if(stream!=null)try{stream.release();}catch(Throwable ignored){}
            if(asr!=null)try{asr.release();}catch(Throwable ignored){}
            active.set(false);
            status(failureDetail==null?"출력음 STT 세션 종료 (마이크 STT 세션과 무관)":
                "출력음 STT 종료 · 실패: "+failureDetail);
        }
    }
}
