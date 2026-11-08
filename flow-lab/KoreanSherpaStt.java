package app.hitel.samsungprobe;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioRecordingConfiguration;
import android.media.MediaRecorder;
import android.os.Process;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

/**
 * HITEL Korean-only, on-device streaming STT. No OEM audio capture and no
 * interception of the remote party's call stream. User action starts AudioRecord.
 * Original OEM caption collection and Samsung TTS send are untouched.
 *
 * Engine: sherpa-onnx Android JNI, following VoxSherpa's published dependency
 * (but this is ASR; VoxSherpa itself implements TTS only).
 * Model: k2-fsa streaming Korean Zipformer 2024-06-16 INT8.
 */
public final class KoreanSherpaStt {
    // Retain model weights across microphone sessions in this process.
    private static OnlineRecognizer sharedRecognizer;
    private static synchronized OnlineRecognizer getSharedRecognizer(OnlineRecognizerConfig config) {
        if(sharedRecognizer==null) {
            sharedRecognizer=new OnlineRecognizer(null,config);
            LabStore.log("SHERPA_KO_MODEL_INITIALIZED","Native Korean Zipformer loaded once per process");
        } else {
            LabStore.log("SHERPA_KO_MODEL_REUSED","Reusing process-cached native Korean Zipformer");
        }
        return sharedRecognizer;
    }
    public interface Listener {
        void onState(String phase,String message);
        void onPartial(String text);
        void onFinal(String text);
    }
    private static final int RATE=16000;
    private static final String MODEL="sherpa-onnx-streaming-zipformer-korean-2024-06-16";
    private static final String ROOT="https://huggingface.co/k2-fsa/"+MODEL+
        "/resolve/ba6078bca4daf3f0dd37f79d0ab505af71df14a6/";
    private static final String ENC="encoder-epoch-99-avg-1.int8.onnx";
    private static final String DEC="decoder-epoch-99-avg-1.onnx";
    private static final String JOIN="joiner-epoch-99-avg-1.int8.onnx";
    private static final String TOK="tokens.txt";
    private static final String[] NAMES={ENC,DEC,JOIN,TOK};
    // Minimum sizes reject HTML error pages, missing files and truncated downloads.
    private static final long[] MINIMUM={115000000L,9500000L,2000000L,50000L};
    private final Context context;
    private final Listener listener;
    private volatile boolean running;
    private volatile boolean stopRequested;
    private volatile AudioRecord recorder;
    private Thread worker;
    public KoreanSherpaStt(Context c,Listener l){context=c.getApplicationContext();listener=l;}
    public synchronized boolean isRunning(){return running;}
    public synchronized void start(){
        if(running)return;
        running=true;stopRequested=false;
        worker=new Thread(this::run,"HITEL-KO-Sherpa-STT");
        worker.start();
    }
    public void stop(){
        stopRequested=true;
        AudioRecord r=recorder;
        if(r!=null){
            try{r.stop();}catch(Exception ignored){}
        }
    }
    private void state(String phase,String msg){listener.onState(phase,msg);}
    private void run(){
        OnlineRecognizer recognizer=null;
        OnlineStream stream=null;
        AudioRecord audio=null;
        try{
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
            if(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
                state("PERMISSION","마이크 권한이 없습니다. HITEL의 녹음 권한을 허용해 주십시오.");
                return;
            }
            File folder=new File(context.getFilesDir(),"sherpa-ko-v1");
            if(!folder.exists()&&!folder.mkdirs())throw new IllegalStateException("model folder create failed");
            ensureModel(folder);
            if(stopRequested)return;
            state("INITIALIZING","한국어 sherpa-onnx 모델을 메모리에 불러오는 중입니다.");
            OnlineTransducerModelConfig transducer=new OnlineTransducerModelConfig();
            transducer.setEncoder(new File(folder,ENC).getAbsolutePath());
            transducer.setDecoder(new File(folder,DEC).getAbsolutePath());
            transducer.setJoiner(new File(folder,JOIN).getAbsolutePath());
            OnlineModelConfig model=new OnlineModelConfig();
            model.setTransducer(transducer);
            model.setTokens(new File(folder,TOK).getAbsolutePath());
            model.setModelType("zipformer");
            model.setNumThreads(2);
            model.setProvider("cpu");
            OnlineRecognizerConfig config=new OnlineRecognizerConfig();
            config.setModelConfig(model);
            config.setEnableEndpoint(true);
            recognizer=getSharedRecognizer(config);
            stream=recognizer.createStream("");
            if(stopRequested)return;
            final int min=AudioRecord.getMinBufferSize(RATE,
                AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
            if(min<=0)throw new IllegalStateException("AudioRecord unsupported: "+min);
            int buffer=Math.max(8192,min*2);
            audio=new AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                .setAudioFormat(new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(RATE)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
                .setBufferSizeInBytes(buffer).build();
            recorder=audio;
            if(audio.getState()!=AudioRecord.STATE_INITIALIZED)
                throw new IllegalStateException("AudioRecord not initialized");
            audio.startRecording();
            if(audio.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING)
                throw new IllegalStateException("Microphone did not enter recording state");
            state("LISTENING","HITEL 한국어 STT 마이크 시작. 말씀해 주십시오. 실시간 PCM과 인식 결과를 기록합니다.");
            final short[] pcm=new short[1600];
            long totalSamples=0L, nonZero=0L,lastDiag=System.currentTimeMillis();
            long decodeMs=0L, firstAudioAt=android.os.SystemClock.elapsedRealtime(), lastPartialAt=0L;
            String lastPartial="",lastFinal="";
            while(!stopRequested){
                int n=audio.read(pcm,0,pcm.length,AudioRecord.READ_BLOCKING);
                if(n<0)throw new IllegalStateException("AudioRecord.read="+n);
                if(n==0)continue;
                float[] samples=new float[n];
                for(int i=0;i<n;i++){
                    short v=pcm[i];samples[i]=v/32768f;
                    if(Math.abs((int)v)>250)nonZero++;
                }
                totalSamples+=n;
                stream.acceptWaveform(samples,RATE);
                long decodeStarted=android.os.SystemClock.elapsedRealtime();
                while(recognizer.isReady(stream))recognizer.decode(stream);
                decodeMs+=android.os.SystemClock.elapsedRealtime()-decodeStarted;
                String partial=recognizer.getResult(stream).getText();
                long now=android.os.SystemClock.elapsedRealtime();
                // Do not wait for an endpoint: publish first partial immediately.
                // Throttle ONLY the UI updates, not neural inference.
                if(partial!=null&&!partial.isBlank()&&!partial.equals(lastPartial)
                      &&(lastPartialAt==0L||now-lastPartialAt>=120L)){
                    if(lastPartialAt==0L)
                        LabStore.log("SHERPA_KO_FIRST_PARTIAL_MS",
                            "latencyAfterMicStartMs="+(now-firstAudioAt));
                    lastPartialAt=now;
                    lastPartial=partial;
                    listener.onPartial(partial);
                }
                if(recognizer.isEndpoint(stream)){
                    String finalText=recognizer.getResult(stream).getText();
                    if(finalText!=null&&!finalText.isBlank()){
                        lastFinal=finalText;
                        listener.onFinal(finalText);
                    }
                    recognizer.reset(stream);
                    lastPartial="";
                }
                if(System.currentTimeMillis()-lastDiag>=3000L){
                    boolean silenced=false,found=false;
                    try{
                        AudioManager mgr=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
                        List<AudioRecordingConfiguration> list=mgr.getActiveRecordingConfigurations();
                        for(AudioRecordingConfiguration item:list){
                            if(item.getClientAudioSessionId()==audio.getAudioSessionId()){
                                found=true;silenced=item.isClientSilenced();break;
                            }
                        }
                    }catch(Exception e){LabStore.log("SHERPA_KO_AUDIO_POLICY_QUERY_FAIL",e.toString());}
                    double elapsed=(double)totalSamples/RATE;
                    String diag="seconds="+Math.round(elapsed)+
                        "; amplitudeAbove250="+nonZero+
                        "; audioSession="+audio.getAudioSessionId()+
                        "; configFound="+found+"; policySilenced="+silenced+
                        "; decodeMsLastWindow="+decodeMs;
                    LabStore.log("SHERPA_KO_PCM_EVIDENCE",diag);
                    if(silenced)state("LISTENING",
                        "Android가 HITEL 마이크를 무음 처리 중입니다. "+diag);
                    else if(nonZero==0)state("LISTENING",
                        "마이크 PCM의 유효 진폭이 아직 없습니다. 실제 무음과 통화 차단은 구분 필요. "+diag);
                    totalSamples=0;nonZero=0;decodeMs=0;lastDiag=System.currentTimeMillis();
                }
            }
            stream.inputFinished();
            while(recognizer.isReady(stream))recognizer.decode(stream);
            String tail=recognizer.getResult(stream).getText();
            if(tail!=null&&!tail.isBlank()&&!tail.equals(lastFinal))
                listener.onFinal(tail);
            state("STOP","한국어 STT 마이크가 중지되었습니다. 결과를 확인하고 삼성 TTS 전송을 선택하십시오.");
        }catch(Throwable error){
            LabStore.log("SHERPA_KO_FAILURE",error.toString());
            state("ERROR","한국어 STT 실행 실패: "+error.getClass().getSimpleName()+": "+error.getMessage());
        }finally{
            recorder=null;
            if(audio!=null){
                try{if(audio.getRecordingState()==AudioRecord.RECORDSTATE_RECORDING)audio.stop();}catch(Exception ignored){}
                try{audio.release();}catch(Exception ignored){}
            }
            if(stream!=null)try{stream.release();}catch(Throwable ignored){}
            // Process-scope native model stays resident for the next microphone tap.
            synchronized(this){running=false;worker=null;}
            if(stopRequested)state("STOP","한국어 음성인식 종료");
        }
    }
    private void ensureModel(File folder)throws Exception{
        for(int i=0;i<NAMES.length;i++){
            if(stopRequested)return;
            File target=new File(folder,NAMES[i]);
            if(target.exists()&&target.length()>=MINIMUM[i])continue;
            if(target.exists()&&!target.delete())throw new IllegalStateException("model replacement blocked");
            File tmp=new File(folder,NAMES[i]+".part");
            if(tmp.exists())tmp.delete();
            state("MODEL_DOWNLOAD","한국어 STT 모델 준비: "+(i+1)+"/"+NAMES.length+
                " · 최초 1회 다운로드, 이후 오프라인 사용");
            URL u=new URL(ROOT+NAMES[i]+"?download=true");
            HttpURLConnection c=(HttpURLConnection)u.openConnection();
            c.setConnectTimeout(30000);
            c.setReadTimeout(60000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent","HITEL-Android-Korean-STT/1");
            try{
                if(c.getResponseCode()!=200)
                    throw new IllegalStateException("HTTP "+c.getResponseCode()+" downloading "+NAMES[i]);
                try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(tmp)){
                    byte[] buf=new byte[131072];int n;long count=0,lastReport=0;
                    while((n=in.read(buf))!=-1){
                        if(stopRequested)return;
                        out.write(buf,0,n);
                        count+=n;
                        if(count-lastReport>=10000000L){
                            lastReport=count;
                            state("MODEL_DOWNLOAD","한국어 모델 "+(i+1)+"/"+NAMES.length+
                                " 다운로드 "+(count/1000000)+" MB");
                        }
                    }
                    out.getFD().sync();
                }
            }finally{c.disconnect();}
            if(tmp.length()<MINIMUM[i])
                throw new IllegalStateException("model file too small: "+NAMES[i]+" bytes="+tmp.length());
            if(!tmp.renameTo(target))
                throw new IllegalStateException("model save failed: "+NAMES[i]);
            LabStore.log("SHERPA_KO_MODEL_READY",NAMES[i]+" bytes="+target.length());
        }
        state("MODEL_READY","한국어 Zipformer INT8 모델 준비 완료 · 오프라인 STT");
    }
}
