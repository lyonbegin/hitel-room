package app.hitel.samsungprobe;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioRecordingConfiguration;
import android.media.AudioTimestamp;
import android.media.audiofx.AudioEffect;
import android.os.Build;
import android.os.Debug;
import android.os.SystemClock;
import java.io.File;
import java.io.RandomAccessFile;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * HITEL microphone diagnostic probe for Korean on-device sherpa-onnx.
 *
 * All numeric PCM telemetry is computed from samples actually delivered to
 * OnlineStream, not from microphone UI state. Diagnostic audio is OFF by
 * default and records max 12s of the identical PCM only after a user tap.
 *
 * No second microphone is opened, no remote-call audio source is requested.
 * Events go through LabStore and are included in its existing W03 ZIP export.
 */
public final class KoreanSttTrace {
    private static final int RATE=16000;
    private static final long MAX_WAV_FRAMES=12L*RATE;
    private final Context context;
    private final AudioRecord record;
    private final AudioManager manager;
    private final String sid;
    private final long startedMs=SystemClock.elapsedRealtime();
    private long lastMeterMs=startedMs,lastRouteMs=0L,lastHypMs=0L;
    private long totalFrames=0L,winFrames=0L,zeros=0L,small=0L,clip=0L,high=0L,zc=0L;
    private long previous=0L,readMs=0L,decodeMs=0L,readMaxMs=0L,decodeMaxMs=0L;
    private long decodedCalls=0L,readCalls=0L,firstPartial=-1L,firstFinal=-1L;
    private int peak=0,prevSample=0,partialCount=0,finalCount=0,endpointCount=0;
    private double sumSquares=0d,sumAmplitudes=0d;
    private String lastRoute="";
    private final AtomicBoolean wavArmed=new AtomicBoolean(false);
    private RandomAccessFile wav=null;
    private String wavName="";
    private long wavFrames=0L;

    public KoreanSttTrace(Context context,AudioRecord record) {
        this.context=context.getApplicationContext();
        this.record=record;
        this.manager=(AudioManager)context.getSystemService(Context.AUDIO_SERVICE);
        this.sid="S"+System.currentTimeMillis()+"-"+record.getAudioSessionId();
        event("START","os="+Build.VERSION.SDK_INT+
            "; device="+Build.MANUFACTURER+"/"+Build.MODEL+
            "; captureSourceRequested="+record.getAudioSource()+
            "; sampleRateHz="+record.getSampleRate()+
            "; format="+record.getAudioFormat()+
            "; channels="+record.getChannelCount()+
            "; bufferFrames="+record.getBufferSizeInFrames()+
            "; audioSessionId="+record.getAudioSessionId()+
            "; appUid="+android.os.Process.myUid()+
            "; nativeHeapKB="+Debug.getNativeHeapAllocatedSize()/1024L);
        routingSnapshot("START");
    }

    private void event(String type,String details){
        LabStore.log("SHERPA_DIAG_"+type,"sid="+sid+"; elapsedMs="+
            (SystemClock.elapsedRealtime()-startedMs)+"; "+details);
    }
    public void armWav(){
        if(wav!=null){
            event("WAV_BUSY","WAV capture already in progress");
            return;
        }
        wavArmed.set(true);
        event("WAV_ARMED","Explicit user request; 12 seconds max; PCM16 mono 16000Hz; local-only until W03 ZIP export");
    }
    public void readFailure(int code){
        event("PCM_READ_ERROR","AudioRecord.readResult="+code);
    }
    public void chunk(short[] pcm,int n,long readTimeMs,long decodeTimeMs,int decodeSteps,
                      String hypothesis,boolean endpoint) {
        if(n<=0)return;
        long now=SystemClock.elapsedRealtime();
        readCalls++;
        readMs+=readTimeMs;
        decodeMs+=decodeTimeMs;
        decodedCalls+=decodeSteps;
        if(readTimeMs>readMaxMs)readMaxMs=readTimeMs;
        if(decodeTimeMs>decodeMaxMs)decodeMaxMs=decodeTimeMs;
        for(int i=0;i<n;i++){
            int value=pcm[i],absolute=Math.abs(value);
            winFrames++;totalFrames++;
            sumSquares+=(double)value*value;
            sumAmplitudes+=value;
            if(absolute>peak)peak=absolute;
            if(value==0)zeros++;
            if(absolute<=250)small++;
            if(absolute>250)high++;
            if(absolute>=32000)clip++;
            if((value>0&&prevSample<0)||(value<0&&prevSample>0))zc++;
            prevSample=value;
        }
        if(wavArmed.get()&&wav==null)openWav();
        if(wav!=null)writeWav(pcm,n);
        if(hypothesis!=null&&!hypothesis.isBlank()&&
                (firstPartial<0||now-lastHypMs>=500L)) {
            if(firstPartial<0) {
                firstPartial=now-startedMs;
                event("FIRST_PARTIAL","firstTextMs="+firstPartial+
                    "; inputAudioMs="+Math.round(totalFrames*1000d/RATE));
            }
            lastHypMs=now;partialCount++;
            event("PARTIAL","count="+partialCount+"; chars="+hypothesis.length()+
                "; text="+hypothesis.substring(0,Math.min(600,hypothesis.length()))+
                "; endpoint="+endpoint);
        }
        if(now-lastMeterMs>=1000L)meter(now);
        if(now-lastRouteMs>=3000L)routingSnapshot("PERIODIC");
    }
    public void endpoint(String text){
        endpointCount++;
        event("ENDPOINT","number="+endpointCount+
            "; nonEmpty="+(text!=null&&!text.isBlank())+
            "; text="+(text==null?"":text.substring(0,Math.min(600,text.length()))));
    }
    public void finalText(String text){
        finalCount++;
        if(firstFinal<0)firstFinal=SystemClock.elapsedRealtime()-startedMs;
        event("FINAL","number="+finalCount+"; firstFinalMs="+firstFinal+
            "; text="+(text==null?"":text.substring(0,Math.min(800,text.length()))));
    }
    private void meter(long now){
        long durationMs=now-lastMeterMs;
        double rms=winFrames==0?0:Math.sqrt(sumSquares/winFrames);
        double dbfs=rms<=0?-120.0:20*Math.log10(rms/32768.0);
        double collectedMs=totalFrames*1000.0/RATE;
        double wallMs=now-startedMs;
        event("PCM_1S",String.format(Locale.US,
            "windowMs=%d; frames=%d; rms=%.1f; rmsDbFS=%.2f; peak=%d; peakDbFS=%.2f; zeroPct=%.2f; nearZeroPct=%.2f; above250Pct=%.2f; clippingPct=%.3f; zeroCrossPct=%.2f; dcOffset=%.1f; readCalls=%d; readMsTotal=%d; readMaxMs=%d; decoderSteps=%d; decoderMsTotal=%d; decoderMaxMs=%d; decodeLoadPct=%.1f; totalAudioMs=%.0f; elapsedWallMs=%.0f; audioVsWallMs=%.0f; partialCount=%d; finalCount=%d; endpointCount=%d",
            durationMs,winFrames,rms,dbfs,peak,
            peak==0?-120:20*Math.log10(peak/32768.0),
            pct(zeros,winFrames),pct(small,winFrames),pct(high,winFrames),
            pct(clip,winFrames),pct(zc,winFrames),
            winFrames==0?0:sumAmplitudes/winFrames,
            readCalls,readMs,readMaxMs,decodedCalls,decodeMs,decodeMaxMs,
            durationMs>0?(100.0*decodeMs/durationMs):0,
            collectedMs,wallMs,collectedMs-wallMs,
            partialCount,finalCount,endpointCount));
        winFrames=zeros=small=clip=high=zc=0L;
        peak=prevSample=0;sumSquares=sumAmplitudes=0;
        readMs=decodeMs=readMaxMs=decodeMaxMs=decodedCalls=readCalls=0;
        lastMeterMs=now;
    }
    private static double pct(long x,long denom){
        return denom>0?100.0*x/denom:0.0;
    }
    private String describeDevice(AudioDeviceInfo d){
        if(d==null)return "null";
        return "id="+d.getId()+",type="+d.getType()+",name="+d.getProductName()+
            ",isSource="+d.isSource()+",rates="+java.util.Arrays.toString(d.getSampleRates());
    }
    private String describeFormat(AudioFormat f){
        if(f==null)return "null";
        return "rate="+f.getSampleRate()+",encoding="+f.getEncoding()+
            ",channels="+f.getChannelCount()+",mask="+f.getChannelMask();
    }
    private String describeEffects(List<AudioEffect.Descriptor> list) {
        if(list==null)return "null";
        StringBuilder out=new StringBuilder();
        for(AudioEffect.Descriptor d:list){
            if(out.length()>300)break;
            out.append(d.name).append('/').append(d.implementor).append(',');
        }
        return out.toString();
    }
    private void routingSnapshot(String why){
        long now=SystemClock.elapsedRealtime();
        lastRouteMs=now;
        try {
            AudioRecordingConfiguration c=record.getActiveRecordingConfiguration();
            if(c==null&&manager!=null){
                for(AudioRecordingConfiguration e:manager.getActiveRecordingConfigurations()){
                    if(e.getClientAudioSessionId()==record.getAudioSessionId()){c=e;break;}
                }
            }
            String detail="reason="+why+
                "; audioManagerMode="+(manager==null?"null":manager.getMode())+
                "; isMicrophoneMute="+(manager==null?"null":manager.isMicrophoneMute())+
                "; recordState="+record.getRecordingState()+
                "; recordSource="+record.getAudioSource()+
                "; routed="+describeDevice(record.getRoutedDevice())+
                "; clientConfig="+(c==null?"null":describeFormat(c.getClientFormat()))+
                "; serverConfig="+(c==null?"null":describeFormat(c.getFormat()))+
                "; requestedClientSource="+(c==null?"null":c.getClientAudioSource())+
                "; actualCaptureSource="+(c==null?"null":c.getAudioSource())+
                "; isClientSilenced="+(c==null?"unknown":c.isClientSilenced())+
                "; clientEffects="+(c==null?"null":describeEffects(c.getClientEffects()))+
                "; captureEffects="+(c==null?"null":describeEffects(c.getEffects()))+
                "; actualCaptureDevice="+(c==null?"null":describeDevice(c.getAudioDevice()))+
                "; nativeHeapKB="+Debug.getNativeHeapAllocatedSize()/1024L;
            String fingerprint=detail.replaceFirst("reason=[^;]+; ","")
                .replaceAll("; nativeHeapKB=[0-9]+","");
            if("START".equals(why)||!fingerprint.equals(lastRoute)) {
                event("AUDIO_ROUTE_CHANGE",detail);
                lastRoute=fingerprint;
            } else if(now-startedMs<3000||((now-startedMs)/3000)%3==0) {
                // An unchanged snapshot periodically proves the route was checked.
                event("AUDIO_ROUTE_HEARTBEAT",detail);
            }
            AudioTimestamp stamp=new AudioTimestamp();
            int code=record.getTimestamp(stamp,AudioTimestamp.TIMEBASE_MONOTONIC);
            event("AUDIO_TIMESTAMP","code="+code+
                "; framePosition="+(code==AudioRecord.SUCCESS?stamp.framePosition:"NA")+
                "; nanoTime="+(code==AudioRecord.SUCCESS?stamp.nanoTime:"NA"));
        }catch(Throwable error){
            event("AUDIO_ROUTE_QUERY_ERROR",error.toString());
        }
    }
    private void openWav(){
        wavArmed.set(false);
        try {
            File file=LabStore.diagnosticAudioFile("sherpa_mic_"+System.currentTimeMillis()+".wav");
            if(file==null) {
                event("WAV_UNAVAILABLE","No active W03 run folder");
                return;
            }
            wav=new RandomAccessFile(file,"rw");
            wav.setLength(0L);
            wav.write(new byte[44]);
            wavName=file.getName();
            wavFrames=0L;
            event("WAV_START","file=diagnostic_audio/"+wavName+
                "; maxSeconds=12; microphone PCM only; manual user consent");
        }catch(Throwable error){
            wav=null;
            event("WAV_ERROR",error.toString());
        }
    }
    private void writeWav(short[] pcm,int n){
        int allowed=(int)Math.min((long)n,MAX_WAV_FRAMES-wavFrames);
        try {
            byte[] bytes=new byte[allowed*2];
            for(int i=0;i<allowed;i++){
                bytes[i*2]=(byte)pcm[i];
                bytes[i*2+1]=(byte)(pcm[i]>>8);
            }
            wav.write(bytes);
            wavFrames+=allowed;
            if(wavFrames>=MAX_WAV_FRAMES)closeWav();
        }catch(Throwable error){
            event("WAV_ERROR",error.toString());
            closeWav();
        }
    }
    private void le16(RandomAccessFile f,int n)throws Exception {
        f.write(n&255);f.write((n>>8)&255);
    }
    private void le32(RandomAccessFile f,long n)throws Exception {
        f.write((int)(n&255));f.write((int)((n>>8)&255));
        f.write((int)((n>>16)&255));f.write((int)((n>>24)&255));
    }
    private void closeWav(){
        if(wav==null)return;
        try{
            long bytes=wavFrames*2L;
            wav.seek(0);
            wav.writeBytes("RIFF");le32(wav,36+bytes);wav.writeBytes("WAVE");
            wav.writeBytes("fmt ");le32(wav,16);le16(wav,1);le16(wav,1);
            le32(wav,RATE);le32(wav,RATE*2);le16(wav,2);le16(wav,16);
            wav.writeBytes("data");le32(wav,bytes);
            event("WAV_DONE","file=diagnostic_audio/"+wavName+
                "; frames="+wavFrames+"; bytes="+bytes+
                "; seconds="+String.format(Locale.US,"%.2f",wavFrames/(double)RATE));
        }catch(Throwable error){event("WAV_FINALIZE_ERROR",error.toString());}
        try{wav.close();}catch(Exception ignored){}
        wav=null;wavFrames=0L;
    }
    public void finish(){
        if(winFrames>0)meter(SystemClock.elapsedRealtime());
        closeWav();
        routingSnapshot("FINISH");
        event("END","audioFrames="+totalFrames+
            "; audioSeconds="+String.format(Locale.US,"%.3f",totalFrames/(double)RATE)+
            "; firstPartialMs="+firstPartial+
            "; firstFinalMs="+firstFinal+
            "; finalCount="+finalCount+
            "; endpointCount="+endpointCount+
            "; nativeHeapKB="+Debug.getNativeHeapAllocatedSize()/1024L);
    }
}
