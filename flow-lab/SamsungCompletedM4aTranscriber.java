package app.hitel.samsungprobe;

import android.content.Context;
import android.net.Uri;
import java.io.File;
import java.io.IOException;
import java.util.Locale;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

/**
 * M4A -> PCM: MIT-licensed Majkey25/transcriber-android's actual
 * MediaExtractor, MediaCodec and PcmChunker implementation, via
 * TranscriberM4aDecoder.kt.
 *
 * PCM -> Korean STT: SAME sherpa-onnx Korean streaming Zipformer INT8
 * model, tokens, OnlineRecognizer API and settings as HITEL14's existing
 * KoreanSherpaStt.java microphone recognizer. NO alternate ASR model,
 * NO new model download, NO custom PCM resampler.
 *
 * This file-only worker never starts/stops AudioRecord or the phone call.
 */
final class SamsungCompletedM4aTranscriber {
    interface Progress {
        void onPhase(String text);
        void onSentence(String sentence);
    }
    private static final int RATE=16000;
    private static final int TAIL_SILENCE_SECONDS=2;
    private static final int MAX_DECODE_STEPS=100000;
    private SamsungCompletedM4aTranscriber(){}

    static String transcribe(File file,Context context,Progress progress)throws Exception{
        if(file==null||!file.isFile()||file.length()==0||!file.canRead())
            throw new IOException("선택한 완료 M4A 파일을 읽을 수 없습니다.");
        if(context==null)throw new IOException("Android Context가 없습니다.");

        // Reuse the exact model download directory of the existing microphone
        // feature. This helper does not open AudioRecord and never changes
        // the microphone's running/stopped state.
        File dir=KoreanSherpaStt.prepareSharedModelsForFile(context,progress);
        OnlineTransducerModelConfig transducer=new OnlineTransducerModelConfig();
        transducer.setEncoder(new File(dir,"encoder-epoch-99-avg-1.int8.onnx").getAbsolutePath());
        transducer.setDecoder(new File(dir,"decoder-epoch-99-avg-1.onnx").getAbsolutePath());
        transducer.setJoiner(new File(dir,"joiner-epoch-99-avg-1.int8.onnx").getAbsolutePath());
        OnlineModelConfig model=new OnlineModelConfig();
        model.setTransducer(transducer);
        model.setTokens(new File(dir,"tokens.txt").getAbsolutePath());
        model.setModelType("zipformer");
        model.setNumThreads(2);
        model.setProvider("cpu");
        OnlineRecognizerConfig config=new OnlineRecognizerConfig();
        config.setModelConfig(model);
        config.setEnableEndpoint(true);

        final StringBuilder output=new StringBuilder();
        final String[] lastCommitted={""},hypothesis={""};
        final long[] frames={0L},recognizedPartials={0L},chunks={0L};
        final double[] peak={0d},energy={0d};
        final int[] audioRate={0};
        OnlineRecognizer recognizer=null;
        OnlineStream stream=null;
        try{
            recognizer=new OnlineRecognizer(null,config);
            stream=recognizer.createStream("");
            final OnlineRecognizer asr=recognizer;
            final OnlineStream channel=stream;
            LabStore.log("SAMSUNG_REC_ORIGINAL_KO_MODEL",
                "model=sherpa-onnx-streaming-zipformer-korean-2024-06-16"+
                "; recognizer=OnlineRecognizer; tokens=tokens.txt"+
                "; sourceDir=sherpa-ko-v1"+
                "; upstreamDecoder=Majkey25/transcriber-android"+
                "; file="+file.getName()+"; bytes="+file.length()+
                "; microphoneUnchanged=true; callUnchanged=true");
            progress.onPhase("Transcriber M4A 디코딩 → 기존 HITEL14 한국어 Zipformer 전사");
            // The original upstream decoder supplies source-rate, mono float
            // PCM blocks. sherpa-onnx handles resampling internally.
            TranscriberM4aDecoder.decode(context,Uri.fromFile(file),(samples,rate)->{
                if(samples==null||samples.length==0)return;
                if(rate<=0)throw new IllegalStateException("M4A PCM sampleRate="+rate);
                if(audioRate[0]!=0&&audioRate[0]!=rate)
                    throw new IllegalStateException("한 M4A 파일 안에서 샘플레이트가 변경되었습니다.");
                audioRate[0]=rate;
                frames[0]+=samples.length;
                chunks[0]++;
                for(float value:samples){
                    if(Float.isNaN(value)||Float.isInfinite(value))
                        throw new IllegalStateException("M4A PCM 유효하지 않은 샘플");
                    double v=value;
                    peak[0]=Math.max(peak[0],Math.abs(v));
                    energy[0]+=v*v;
                }

                // Transcriber emits a whole-file PCM block for recordings
                // shorter than 25 seconds. Feed its verified PCM into HITEL14's
                // existing streaming model in the SAME ~100ms cadence used by
                // KoreanSherpaStt's AudioRecord microphone, checking endpoints
                // after each increment rather than after 25 seconds at once.
                final int sampleWindow=Math.max(1,rate/10);
                for(int begin=0;begin<samples.length;begin+=sampleWindow){
                    final int end=Math.min(samples.length,begin+sampleWindow);
                    final float[] window=java.util.Arrays.copyOfRange(samples,begin,end);
                    channel.acceptWaveform(window,rate);
                    decodeAllReady(asr,channel);
                    captureHypothesis(asr,channel,hypothesis,recognizedPartials);
                    if(asr.isEndpoint(channel)){
                        String candidate=asr.getResult(channel).getText();
                        if(candidate==null||candidate.isBlank())candidate=hypothesis[0];
                        appendSentence(output,lastCommitted,candidate,progress);
                        asr.reset(channel);
                        hypothesis[0]="";
                    }
                }
                LabStore.log("SAMSUNG_REC_KO_INPUT_CHUNK",
                    "sourceRate="+rate+"; samples="+samples.length+
                    "; accumulatedFrames="+frames[0]+"; partials="+recognizedPartials[0]);
            });

            if(frames[0]==0L)throw new IOException(
                "Transcriber AAC 디코더가 M4A에서 PCM을 출력하지 않았습니다.");
            double rms=Math.sqrt(energy[0]/frames[0]);
            LabStore.log("SAMSUNG_REC_KO_PCM_SUMMARY",
                "sourceRate="+audioRate[0]+"; chunks="+chunks[0]+
                "; frames="+frames[0]+
                "; audioSeconds="+String.format(Locale.US,"%.3f",
                        frames[0]/(double)audioRate[0])+
                "; peak="+String.format(Locale.US,"%.6f",peak[0])+
                "; rms="+String.format(Locale.US,"%.6f",rms));
            if(peak[0]<0.0005)
                throw new IOException("M4A PCM은 디코딩되었으나 사실상 무음입니다. RMS="+rms);

            // The original microphone recognizer finishes its stream by
            // inputFinished() and decoding ready frames; file input also gets
            // trailing zero PCM to flush the right context of the Zipformer.
            channel.acceptWaveform(new float[audioRate[0]*TAIL_SILENCE_SECONDS],audioRate[0]);
            channel.inputFinished();
            decodeAllReady(asr,channel);
            captureHypothesis(asr,channel,hypothesis,recognizedPartials);
            String tail=asr.getResult(channel).getText();
            if(tail==null||tail.isBlank())tail=hypothesis[0];
            appendSentence(output,lastCommitted,tail,progress);
            LabStore.log("SAMSUNG_REC_KO_STT_RESULT",
                "characters="+output.length()+"; sourceFrames="+frames[0]+
                "; hypotheses="+recognizedPartials[0]+"; koreanZipformer=true");
            if(output.length()==0)
                throw new IOException("기존 한국어 Zipformer가 완료 M4A의 음성 문장을 반환하지 않았습니다. "+
                    "PCM_SUMMARY 및 KO_INPUT_CHUNK를 확인하십시오.");
            return output.toString();
        }finally{
            if(stream!=null)try{stream.release();}catch(Throwable ignored){}
            if(recognizer!=null)try{recognizer.release();}catch(Throwable ignored){}
        }
    }

    private static void decodeAllReady(OnlineRecognizer recognizer,OnlineStream stream){
        int steps=0;
        while(recognizer.isReady(stream)){
            if(++steps>MAX_DECODE_STEPS)throw new IllegalStateException(
                "Zipformer decode step upper bound exceeded");
            recognizer.decode(stream);
        }
    }
    private static void captureHypothesis(OnlineRecognizer recognizer,OnlineStream stream,
                                          String[] partial,long[] count){
        String text=recognizer.getResult(stream).getText();
        if(text!=null&&!text.isBlank()){
            partial[0]=text.trim();
            count[0]++;
            if(count[0]==1)
                LabStore.log("SAMSUNG_REC_KO_FIRST_TEXT",
                    "characters="+partial[0].length());
        }
    }
    private static void appendSentence(StringBuilder out,String[] last,String value,Progress progress){
        if(value==null||value.isBlank())return;
        String sentence=value.trim();
        if(sentence.equals(last[0]))return;
        if(out.length()>0)out.append('\n');
        out.append(sentence);
        last[0]=sentence;
        progress.onSentence(sentence);
        LabStore.log("SAMSUNG_REC_KO_SENTENCE",
            "characters="+sentence.length()+"; sentence="+sentence);
    }
}
