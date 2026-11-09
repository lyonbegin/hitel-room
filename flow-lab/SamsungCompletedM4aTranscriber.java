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
 * File STT adapter for HITEL14. NO MediaExtractor, MediaCodec, PCM conversion,
 * or custom resampler in this class. All M4A -> PCM is delegated to the
 * MIT-licensed TranscriberM4aDecoder (Majkey25/transcriber-android).
 *
 * The existing HITEL14 Korean Zipformer sherpa recognizer is used for ASR
 * because it is already installed; microphone never opens in this path.
 */
final class SamsungCompletedM4aTranscriber {
    interface Progress {
        void onPhase(String text);
        void onSentence(String sentence);
    }
    private static final int MODEL_RATE=16000;
    private static final int FINAL_SILENCE_SECONDS=2;
    private SamsungCompletedM4aTranscriber(){}

    static String transcribe(File file,Context context,Progress progress)throws Exception{
        if(file==null||!file.isFile()||file.length()==0)
            throw new IOException("완성된 M4A 파일이 없습니다.");
        if(context==null)throw new IOException("Android Context가 없습니다.");

        // Only the existing model files are prepared. Do not initialize AudioRecord.
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

        OnlineRecognizer recognizer=null;
        OnlineStream stream=null;
        final StringBuilder committed=new StringBuilder();
        final String[] liveDraft={""};
        final String[] lastCommitted={""};
        final long[] pcmFrames={0};
        final int[] sampleRate={-1};
        final long[] intermediateResults={0};
        final double[] energySquare={0}, peak={0};
        final long[] startNs={System.nanoTime()};
        try{
            recognizer=new OnlineRecognizer(null,config);
            stream=recognizer.createStream("");
            final OnlineRecognizer asr=recognizer;
            final OnlineStream s=stream;
            LabStore.log("SAMSUNG_REC_UPSTREAM_DECODER",
                "source=Majkey25/transcriber-android; decoder=TranscriberM4aDecoder;" +
                " file="+file.getName()+"; bytes="+file.length()+
                "; asr=existing HITEL14 Korean streaming Zipformer;" +
                " audioResample=sherpa native; userCallUnchanged=true");
            progress.onPhase("Transcriber 원본 M4A→PCM 디코딩 시작");
            // Upstream MediaExtractor/MediaCodec, exact full OUTPUT EOS drain,
            // PCM 16-bit/float mono mix and 25s chunking are preserved in Kotlin.
            TranscriberM4aDecoder.decode(context,Uri.fromFile(file),(samples,rate)->{
                if(rate<=0||samples==null||samples.length==0)return;
                if(sampleRate[0]>0&&sampleRate[0]!=rate)
                    LabStore.log("SAMSUNG_REC_PCM_SAMPLE_RATE_CHANGE",
                        "old="+sampleRate[0]+"; new="+rate);
                sampleRate[0]=rate;
                pcmFrames[0]+=samples.length;
                for(float x:samples){
                    double a=Math.abs((double)x);
                    if(a>peak[0])peak[0]=a;
                    energySquare[0]+=((double)x)*x;
                }
                // sherpa-onnx itself accepts the source rate and resamples
                // internally; no HITEL custom 48k->16k resampler.
                s.acceptWaveform(samples,rate);
                int n=0;
                while(asr.isReady(s)){
                    asr.decode(s);
                    if(++n>100000)throw new IllegalStateException("sherpa decoding loop exceeded limit");
                }
                String result=asr.getResult(s).getText();
                if(result!=null&&!result.trim().isEmpty()){
                    liveDraft[0]=result.trim();
                    intermediateResults[0]++;
                    LabStore.log("SAMSUNG_REC_ASR_HYPOTHESIS",
                        "chars="+liveDraft[0].length()+"; decodedFrames="+pcmFrames[0]);
                }
                if(asr.isEndpoint(s)){
                    String sentence=asr.getResult(s).getText();
                    if(sentence==null||sentence.trim().isEmpty())sentence=liveDraft[0];
                    if(sentence!=null&&!sentence.trim().isEmpty()){
                        appendSentence(committed,lastCommitted,sentence.trim(),progress);
                    }
                    liveDraft[0]="";
                    asr.reset(s);
                }
                LabStore.log("SAMSUNG_REC_DECODED_CHUNK",
                    "srcRate="+rate+"; monoFrames="+samples.length+
                    "; totalFrames="+pcmFrames[0]+
                    "; asrHypotheses="+intermediateResults[0]);
            });
            if(pcmFrames[0]==0)throw new IOException(
                "Transcriber 디코더가 M4A에서 PCM 데이터를 출력하지 않았습니다.");
            double seconds=sampleRate[0]>0?pcmFrames[0]/(double)sampleRate[0]:0d;
            double rms=Math.sqrt(energySquare[0]/pcmFrames[0]);
            LabStore.log("SAMSUNG_REC_UPSTREAM_PCM_SUMMARY",
                "file="+file.getName()+
                "; sampleRate="+sampleRate[0]+
                "; monoFrames="+pcmFrames[0]+
                "; duration="+String.format(Locale.US,"%.3f",seconds)+
                "; peak="+String.format(Locale.US,"%.6f",peak[0])+
                "; rms="+String.format(Locale.US,"%.6f",rms)+
                "; hypotheses="+intermediateResults[0]);
            if(peak[0]<0.0005)throw new IOException(
                "M4A는 디코딩되었으나 PCM이 사실상 무음입니다. rms="+rms);

            // Feed final trailing silence so this streaming ASR model can flush
            // its last utterance while keeping file-only processing independent.
            s.acceptWaveform(new float[MODEL_RATE*FINAL_SILENCE_SECONDS],MODEL_RATE);
            s.inputFinished();
            int finishSteps=0;
            while(asr.isReady(s)){
                asr.decode(s);
                if(++finishSteps>100000)
                    throw new IllegalStateException("sherpa final decode loop exceeded limit");
            }
            String tail=asr.getResult(s).getText();
            if(tail==null||tail.trim().isEmpty())tail=liveDraft[0];
            if(tail!=null&&!tail.trim().isEmpty())
                appendSentence(committed,lastCommitted,tail.trim(),progress);
            LabStore.log("SAMSUNG_REC_UPSTREAM_STT_COMPLETE",
                "chars="+committed.length()+"; pcmFrames="+pcmFrames[0]+
                "; rms="+rms+"; decodeTimeMs="+((System.nanoTime()-startNs[0])/1000000L));
            if(committed.length()==0)
                throw new IOException("M4A의 음성 PCM은 정상이나 한국어 Zipformer 인식 결과가 없습니다. " +
                    "입력 PCM과 인식기를 구분하는 진단 로그가 저장되었습니다.");
            return committed.toString();
        }finally{
            if(stream!=null)try{stream.release();}catch(Throwable ignored){}
            if(recognizer!=null)try{recognizer.release();}catch(Throwable ignored){}
        }
    }

    private static void appendSentence(StringBuilder output,String[] last,String sentence,Progress progress){
        if(sentence==null||sentence.isEmpty()||sentence.equals(last[0]))return;
        if(output.length()>0)output.append('\n');
        output.append(sentence);
        last[0]=sentence;
        progress.onSentence(sentence);
        LabStore.log("SAMSUNG_REC_UPSTREAM_ASR_SENTENCE","chars="+sentence.length()+"; text="+sentence);
    }
}
