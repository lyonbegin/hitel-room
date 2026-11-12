package app.hitel.samsungprobe;

import android.content.Context;
import android.os.SystemClock;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.function.Consumer;

/**
 * Samsung M4A -> persistent AAC MediaCodec -> 16kHz PCM -> ONLINE SHERPA.
 * No AudioTrack, audio playback, MediaProjection, microphone, or loopback.
 * This is a separate third STT path; V22 microphone/output source stays intact.
 */
final class PcmDirectSherpaSink implements AutoCloseable {
    private static final int RATE=16000;
    private static final String[] MODEL={
        "encoder-epoch-99-avg-1.int8.onnx",
        "decoder-epoch-99-avg-1.onnx",
        "joiner-epoch-99-avg-1.int8.onnx",
        "tokens.txt"
    };
    private static final long[] MINIMUM={115000000L,9500000L,2000000L,50000L};
    private static final String ROOT="https://huggingface.co/k2-fsa/"+
        "sherpa-onnx-streaming-zipformer-korean-2024-06-16"+
        "/resolve/ba6078bca4daf3f0dd37f79d0ab505af71df14a6/";
    private final TraceJournal log;
    private final Consumer<String> callback;
    private OnlineRecognizer recognizer;
    private OnlineStream stream;
    private String lastPartial="";
    private long lastPartialAt;
    private long totalSamples;
    private boolean closed;

    PcmDirectSherpaSink(Context context,TraceJournal journal,int ignoredOutputDevice,
                        Consumer<String> events) throws Exception {
        log=journal;
        callback=events;
        File modelDir=new File(context.getFilesDir(),"sherpa-ko-v1");
        if(!modelDir.isDirectory()&&!modelDir.mkdirs())
            throw new IllegalStateException("한국어 모델 폴더 생성 실패");
        for(int i=0;i<MODEL.length;i++){
            File target=new File(modelDir,MODEL[i]);
            if(target.isFile()&&target.length()>=MINIMUM[i])continue;
            callback.accept("DIRECT_STATUS|한국어 모델 준비 "+(i+1)+"/4 · "+MODEL[i]);
            File temp=new File(modelDir,MODEL[i]+".direct.part");
            if(temp.exists()&&!temp.delete())throw new IllegalStateException("임시 모델 삭제 실패");
            HttpURLConnection c=(HttpURLConnection)new URL(ROOT+MODEL[i]+"?download=true").openConnection();
            c.setConnectTimeout(30000);
            c.setReadTimeout(60000);
            c.setInstanceFollowRedirects(true);
            try{
                if(c.getResponseCode()!=200)
                    throw new IllegalStateException("한국어 모델 HTTP "+c.getResponseCode());
                try(InputStream in=c.getInputStream(); FileOutputStream out=new FileOutputStream(temp)){
                    byte[] data=new byte[131072];int n;
                    while((n=in.read(data))!=-1)out.write(data,0,n);
                    out.getFD().sync();
                }
            }finally{c.disconnect();}
            if(temp.length()<MINIMUM[i])
                throw new IllegalStateException("한국어 모델 크기 부족: "+MODEL[i]);
            if(target.exists()&&!target.delete())throw new IllegalStateException("기존 모델 교체 실패");
            if(!temp.renameTo(target))throw new IllegalStateException("모델 저장 실패");
        }
        try{
            OnlineTransducerModelConfig transducer=new OnlineTransducerModelConfig();
            transducer.setEncoder(new File(modelDir,MODEL[0]).getAbsolutePath());
            transducer.setDecoder(new File(modelDir,MODEL[1]).getAbsolutePath());
            transducer.setJoiner(new File(modelDir,MODEL[2]).getAbsolutePath());
            OnlineModelConfig model=new OnlineModelConfig();
            model.setTransducer(transducer);
            model.setTokens(new File(modelDir,MODEL[3]).getAbsolutePath());
            model.setModelType("zipformer");
            model.setNumThreads(2);
            model.setProvider("cpu");
            OnlineRecognizerConfig config=new OnlineRecognizerConfig();
            config.setModelConfig(model);
            config.setEnableEndpoint(true);
            recognizer=new OnlineRecognizer(null,config);
            stream=recognizer.createStream("");
            log.event("STT","DIRECT_SHERPA_READY","rate",RATE,"outputAudioTrack",false);
            callback.accept("DIRECT_STATUS|16kHz PCM 직접 STT 준비 완료 · 스피커 재생 없음");
        }catch(Throwable ex){
            close();
            throw ex;
        }
    }
    void setOutputDevice(int ignored){
        callback.accept("DIRECT_STATUS|직접 STT 경로에는 스피커 출력 장치가 없습니다.");
    }
    void write(byte[] littleEndianPcm)throws Exception {
        if(closed||stream==null)throw new IllegalStateException("PCM 직접 STT가 종료되었습니다.");
        if(littleEndianPcm.length%2!=0)
            throw new IllegalArgumentException("PCM16 bytes must be even");
        float[] samples=new float[littleEndianPcm.length/2];
        for(int i=0;i<samples.length;i++){
            int p=i*2;
            short value=(short)((littleEndianPcm[p]&255)|((littleEndianPcm[p+1]&255)<<8));
            samples[i]=value/32768.0f;
        }
        stream.acceptWaveform(samples,RATE);
        while(recognizer.isReady(stream))recognizer.decode(stream);
        totalSamples+=samples.length;
        String partial=recognizer.getResult(stream).getText();
        long now=SystemClock.elapsedRealtime();
        if(partial!=null&&!partial.isBlank()&&!partial.equals(lastPartial)
                &&now-lastPartialAt>=125){
            lastPartial=partial;
            lastPartialAt=now;
            callback.accept("DIRECT_PARTIAL|"+partial);
        }
        if(recognizer.isEndpoint(stream)){
            String result=recognizer.getResult(stream).getText();
            if(result!=null&&!result.isBlank()){
                log.event("STT","DIRECT_ASR_FINAL","text",result,"pcmSamples",totalSamples);
                callback.accept("DIRECT_FINAL|"+result);
            }
            recognizer.reset(stream);
            lastPartial="";
        }
        if(totalSamples>0 && totalSamples%(RATE*10)<samples.length)
            log.event("STT","DIRECT_PCM_PROGRESS","samples",totalSamples,
                "audioSeconds",String.format(Locale.US,"%.2f",totalSamples/(double)RATE));
    }
    @Override public void close(){
        if(closed)return;
        closed=true;
        try{
            if(stream!=null && recognizer!=null){
                stream.inputFinished();
                while(recognizer.isReady(stream))recognizer.decode(stream);
                String tail=recognizer.getResult(stream).getText();
                if(tail!=null&&!tail.isBlank()){
                    log.event("STT","DIRECT_ASR_FINAL_TAIL","text",tail);
                    callback.accept("DIRECT_FINAL|"+tail);
                }
            }
        }catch(Throwable err){log.error("STT","DIRECT_ASR_FLUSH_FAILED",err);}
        if(stream!=null){try{stream.release();}catch(Throwable ignored){}stream=null;}
        if(recognizer!=null){try{recognizer.release();}catch(Throwable ignored){}recognizer=null;}
        log.event("STT","DIRECT_STT_RELEASED","pcmSamples",totalSamples);
    }
}
