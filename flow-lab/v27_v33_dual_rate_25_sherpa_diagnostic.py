#!/usr/bin/env python3
"""V33 diagnostic-only adaptive second Sherpa stream for abnormal slow/pitch-low calls.

The real user-provided M4A had no Korean ASR at native rate but reproduced
partial Korean speech when re-clocked 2-2.75x. Preserve original normal
16000Hz stream and proven AudioTrack; add a second 2.5x effective-rate
stream with FIR antialias filter, sharing the SAME recognizer weights.
Only show fallback after >=4s when original stream never found speech.
Do not publish a V33 APK until separate emulator tests pass.
"""
from pathlib import Path
src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
sink=src/"PcmDirectSherpaSink.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")
s=sink.read_text(encoding="utf-8")
def one(old,new,label):
    global s
    if s.count(old)!=1:
        raise AssertionError("V33 "+label+" anchor="+str(s.count(old))+" "+repr(old[:100]))
    s=s.replace(old,new,1)
one("    private OnlineStream stream;",
    """    private OnlineStream stream;
    private OnlineStream rate25Stream;
    private final float[] rate25History=new float[41];
    private int rate25Head,rate25Phase;
    private long rate25TotalSamples;
    private String lastRate25Partial="";
    private boolean normalEverRecognized,rate25Selected;
    private static final double[] RATE25_FIR=createRate25Fir();
    private static double[] createRate25Fir(){
        int n=41; double[] taps=new double[n];double total=0.0,cutoff=0.18;
        for(int i=0;i<n;i++){
            int d=i-(n-1)/2;
            double sinc=d==0?2*cutoff:Math.sin(2*Math.PI*cutoff*d)/(Math.PI*d);
            taps[i]=sinc*(0.54-0.46*Math.cos(2*Math.PI*i/(n-1)));
            total+=taps[i];
        }
        for(int i=0;i<n;i++)taps[i]/=total;
        return taps;
    }
    private float[] toRate25(float[] source){
        float[] result=new float[(source.length*2+rate25Phase)/5+2];
        int used=0;
        for(float sample:source){
            rate25History[rate25Head]=sample;
            rate25Head=(rate25Head+1)%rate25History.length;
            rate25Phase+=2;
            if(rate25Phase<5)continue;
            rate25Phase-=5;
            double value=0;
            for(int k=0;k<rate25History.length;k++)
                value+=rate25History[(rate25Head+k)%rate25History.length]*RATE25_FIR[k];
            result[used++]=(float)value;
        }
        rate25TotalSamples+=used;
        return java.util.Arrays.copyOf(result,used);
    }""","add filtered secondary stream")
one('            stream=recognizer.createStream("");',
    '''            stream=recognizer.createStream("");
            rate25Stream=recognizer.createStream("");
            log.event("STT","DIRECT_DUAL_RATE25_DIAGNOSTIC_READY",
                "normalSampleRate",16000,"rate25EffectiveInputHz",6400,
                "recognizerWeightsShared",true);''',"initialize second stream")
one('''        stream.acceptWaveform(samples,RATE);
        while(recognizer.isReady(stream))recognizer.decode(stream);
        totalSamples+=samples.length;
        String partial=recognizer.getResult(stream).getText();''',
    '''        stream.acceptWaveform(samples,RATE);
        float[] correctedSamples=toRate25(samples);
        if(correctedSamples.length>0)
            rate25Stream.acceptWaveform(correctedSamples,RATE);
        while(recognizer.isReady(stream))recognizer.decode(stream);
        while(recognizer.isReady(rate25Stream))recognizer.decode(rate25Stream);
        totalSamples+=samples.length;
        String partial=recognizer.getResult(stream).getText();
        if(partial!=null && !partial.isBlank())normalEverRecognized=true;
        String corrected=recognizer.getResult(rate25Stream).getText();
        if(!normalEverRecognized && totalSamples>=RATE*4
            && corrected!=null && corrected.length()>=4
            && !corrected.equals(lastRate25Partial)){
            rate25Selected=true;
            lastRate25Partial=corrected;
            log.event("STT","DIRECT_ASR_RATE25_PARTIAL",
                "text",corrected,"nativeSamples",totalSamples,
                "correctedSamples",rate25TotalSamples,
                "effectiveSpeed",2.5);
            callback.accept("DIRECT_PARTIAL|"+corrected);
        }''',"feed both recognizers")
one('''            callback.accept("DIRECT_PARTIAL|"+partial);''',
    '''            if(!rate25Selected)callback.accept("DIRECT_PARTIAL|"+partial);''',
    "do not overwrite selected fallback")
one('''                callback.accept("DIRECT_FINAL|"+result);''',
    '''                if(!rate25Selected)callback.accept("DIRECT_FINAL|"+result);''',
    "normal final precedence")
one('''        if(totalSamples>0 && totalSamples%(RATE*10)<samples.length)''',
    '''        if(recognizer.isEndpoint(rate25Stream)){
            String result25=recognizer.getResult(rate25Stream).getText();
            if(rate25Selected && result25!=null && !result25.isBlank()){
                log.event("STT","DIRECT_ASR_RATE25_FINAL",
                    "text",result25,"nativeSamples",totalSamples);
                callback.accept("DIRECT_FINAL|"+result25);
            }
            recognizer.reset(rate25Stream);
            lastRate25Partial="";
        }
        if(totalSamples>0 && totalSamples%(RATE*10)<samples.length)''',
    "finish secondary endpoint")
one('''        if(stream!=null){try{stream.release();}catch(Throwable ignored){}stream=null;}''',
    '''        if(rate25Stream!=null){
            try{
                if(recognizer!=null){
                    rate25Stream.inputFinished();
                    while(recognizer.isReady(rate25Stream))
                        recognizer.decode(rate25Stream);
                    String end=recognizer.getResult(rate25Stream).getText();
                    if(rate25Selected && end!=null && !end.isBlank()){
                        log.event("STT","DIRECT_ASR_RATE25_TAIL","text",end);
                        callback.accept("DIRECT_FINAL|"+end);
                    }
                }
            }catch(Throwable err){log.error("STT","DIRECT_RATE25_FLUSH_FAILED",err);}
            try{rate25Stream.release();}catch(Throwable ignored){}
            rate25Stream=null;
        }
        if(stream!=null){try{stream.release();}catch(Throwable ignored){}stream=null;}''',
    "release independent stream")
sink.write_text(s,encoding="utf-8")
g=gradle.read_text(encoding="utf-8")
if g.count('applicationId = "app.hitel.callflowlab.v32.directasr"')!=1:raise AssertionError("V32 appid")
g=g.replace('applicationId = "app.hitel.callflowlab.v32.directasr"','applicationId = "app.hitel.callflowlab.v33.dualrate"')
if g.count('versionCode = 40')!=1:raise AssertionError("V32 code")
g=g.replace('versionCode = 40','versionCode = 41')
if g.count("0.14.26-live-m4a-pcm-direct-asr-v32")!=1:raise AssertionError("V32 version")
g=g.replace("0.14.26-live-m4a-pcm-direct-asr-v32","0.14.27-dualrate-diagnostic-v33")
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
if m.count("HITEL14 V32 실시간 PCM 직접 STT")!=1:raise AssertionError("V32 app label")
m=m.replace("HITEL14 V32 실시간 PCM 직접 STT","HITEL14 V33 이중 속도 STT 진단")
manifest.write_text(m,encoding="utf-8")
print("PASS_V33_ORIGINAL_NORMAL_STREAM_PRESERVED")
print("PASS_V33_FIR25_SECOND_STREAM_MODEL_WEIGHTS_SHARED")
print("PASS_V33_RATE25_PARTIAL_FINAL_UI_EVENTS_AND_LOGS")
print("PASS_V33_SEPARATE_APP_ID")
