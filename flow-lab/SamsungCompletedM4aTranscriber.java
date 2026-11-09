package app.hitel.samsungprobe;

import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.os.SystemClock;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

/**
 * Offline FILE input, using HITEL14's existing Korean sherpa-onnx Zipformer model.
 * Samsung M4A -> MediaExtractor AAC -> MediaCodec PCM16/float -> mono 16k
 * -> sherpa OnlineRecognizer (file-fed, not the microphone).
 */
final class SamsungCompletedM4aTranscriber {
    interface Progress {
        void onPhase(String text);
        void onSentence(String sentence);
    }
    private static final int RATE=16000;
    private static final long CODEC_TIMEOUT_US=10_000L;
    private static final double MIN_SPEECH_PEAK=0.008d;
    private static final long MIN_AUDIO_FRAMES=1600L;
    private SamsungCompletedM4aTranscriber(){}

    static String transcribe(File file,android.content.Context context,Progress progress)throws Exception{
        if(file==null||!file.isFile()||file.length()==0)
            throw new IOException("녹음 M4A 파일이 없습니다.");
        File dir=KoreanSherpaStt.prepareSharedModelsForFile(context,progress);
        // Native zipformer config mirrors HITEL14's existing microphone model
        // configuration, but allocates a separate stream/recognizer.
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
        MediaExtractor extractor=new MediaExtractor();
        MediaCodec codec=null;
        final StringBuilder transcript=new StringBuilder();
        String lastSentence="";
        String currentDraft="";
        long recoveredDrafts=0L;
        long decodedOutputFrames=0L;
        long pcmToAsrFrames=0L, audiblePcmFrames=0L;
        long recognizerHypothesisCount=0L;
        double peak=0d, squareSum=0d;
        int outputChannels=0, outputSampleRate=0, outputEncoding=0;
        boolean firstHypothesisLogged=false;
        int audioTrackInputSampleRate=0;
        long fileDurationUs=-1L;
        try{
            recognizer=new OnlineRecognizer(null,config);
            stream=recognizer.createStream("");
            extractor.setDataSource(file.getAbsolutePath());
            int track=-1;
            for(int t=0;t<extractor.getTrackCount();t++){
                String mime=extractor.getTrackFormat(t).getString(MediaFormat.KEY_MIME);
                if(mime!=null&&mime.startsWith("audio/")){track=t;break;}
            }
            if(track<0)throw new IOException("오디오 트랙을 찾지 못했습니다.");
            MediaFormat inputFormat=extractor.getTrackFormat(track);
            String mime=inputFormat.getString(MediaFormat.KEY_MIME);
            if(mime==null)throw new IOException("M4A MIME이 없습니다.");
            extractor.selectTrack(track);
            audioTrackInputSampleRate=inputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)?
                inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE):-1;
            fileDurationUs=inputFormat.containsKey(MediaFormat.KEY_DURATION)?
                inputFormat.getLong(MediaFormat.KEY_DURATION):-1L;
            LabStore.log("SAMSUNG_REC_M4A_TRACK",
                "mime="+mime+"; compressedBytes="+file.length()+
                "; sampleRate="+audioTrackInputSampleRate+
                "; durationUs="+fileDurationUs+
                "; channels="+(inputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)?
                    inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT):-1));
            progress.onPhase("M4A 오디오 트랙 확인: "+mime+" · 디코더 초기화");
            codec=MediaCodec.createDecoderByType(mime);
            codec.configure(inputFormat,null,null,0);
            codec.start();
            MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();
            boolean inputEos=false,outputEos=false;
            int idle=0, sampleRate=16000,channels=1,encoding=AudioFormat.ENCODING_PCM_16BIT;
            PcmResampler resampler=new PcmResampler();
            long lastReport=SystemClock.elapsedRealtime();
            while(!outputEos){
                boolean progressed=false;
                if(!inputEos){
                    int inputIndex=codec.dequeueInputBuffer(CODEC_TIMEOUT_US);
                    if(inputIndex>=0){
                        ByteBuffer in=codec.getInputBuffer(inputIndex);
                        if(in==null)throw new IOException("M4A 디코더 입력 버퍼가 없습니다.");
                        in.clear();
                        int size=extractor.readSampleData(in,0);
                        if(size<0){
                            codec.queueInputBuffer(inputIndex,0,0,0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputEos=true;
                        }else{
                            codec.queueInputBuffer(inputIndex,0,size,extractor.getSampleTime(),0);
                            extractor.advance();
                        }
                        progressed=true;
                    }
                }
                int outputIndex=codec.dequeueOutputBuffer(info,CODEC_TIMEOUT_US);
                if(outputIndex==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){
                    MediaFormat fmt=codec.getOutputFormat();
                    sampleRate=fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE);
                    channels=fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
                    encoding=fmt.containsKey(MediaFormat.KEY_PCM_ENCODING)?
                        fmt.getInteger(MediaFormat.KEY_PCM_ENCODING):AudioFormat.ENCODING_PCM_16BIT;
                    if(sampleRate<=0||sampleRate>192000||channels<1||channels>8)
                        throw new IOException("지원하지 않는 PCM 포맷: rate="+sampleRate+" channels="+channels);
                    if(encoding!=AudioFormat.ENCODING_PCM_16BIT&&encoding!=AudioFormat.ENCODING_PCM_FLOAT)
                        throw new IOException("지원하지 않는 PCM 인코딩: "+encoding);
                    resampler=new PcmResampler();
                    outputSampleRate=sampleRate;
                    outputChannels=channels;
                    outputEncoding=encoding;
                    LabStore.log("SAMSUNG_REC_PCM_FORMAT",
                        "sampleRate="+sampleRate+"; channels="+channels+"; pcmEncoding="+encoding);
                    progressed=true;
                }else if(outputIndex>=0){
                    if(info.size>0){
                        ByteBuffer output=codec.getOutputBuffer(outputIndex);
                        if(output==null)throw new IOException("M4A 디코더 출력 버퍼가 없습니다.");
                        output.position(info.offset);
                        output.limit(info.offset+info.size);
                        output.order(ByteOrder.LITTLE_ENDIAN);
                        float[] mono=toMono(output,encoding,channels);
                        float[] samples16k=resampler.to16k(mono,sampleRate);
                        decodedOutputFrames+=mono.length;
                        pcmToAsrFrames+=samples16k.length;
                        for(float v:mono){
                            double amplitude=Math.abs((double)v);
                            peak=Math.max(peak,amplitude);
                            squareSum+=((double)v)*v;
                            if(amplitude>=MIN_SPEECH_PEAK)audiblePcmFrames++;
                        }
                        if(samples16k.length>0){
                            stream.acceptWaveform(samples16k,RATE);
                            while(recognizer.isReady(stream))recognizer.decode(stream);
                            String hypothesis=recognizer.getResult(stream).getText();
                            if(hypothesis!=null&&!hypothesis.isBlank()){
                                currentDraft=hypothesis.trim();
                                recognizerHypothesisCount++;
                                if(!firstHypothesisLogged){
                                    firstHypothesisLogged=true;
                                    LabStore.log("SAMSUNG_REC_SHERPA_FIRST_TEXT",
                                        "chars="+hypothesis.length()+"; inputFrames="+pcmToAsrFrames);
                                }
                            }
                            if(recognizer.isEndpoint(stream)){
                                String raw=recognizer.getResult(stream).getText();
                                String sentence=raw==null?"":raw.trim();
                                if(sentence.isEmpty()&&!currentDraft.isEmpty()){
                                    sentence=currentDraft;
                                    recoveredDrafts++;
                                    LabStore.log("SAMSUNG_REC_ASR_RECOVER_DRAFT",
                                        "endpointHypothesisBlank=true; recoveredChars="+sentence.length());
                                }
                                if(!sentence.isEmpty()){
                                    if(transcript.length()>0)transcript.append('\n');
                                    transcript.append(sentence);
                                    lastSentence=sentence;
                                    progress.onSentence(sentence);
                                }
                                currentDraft="";
                                recognizer.reset(stream);
                            }
                        }
                    }
                    outputEos=(info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
                    codec.releaseOutputBuffer(outputIndex,false);
                    progressed=true;
                }
                idle=progressed?0:idle+1;
                if(idle>3000)throw new IOException("M4A 디코더 출력이 중단되었습니다.");
                if(SystemClock.elapsedRealtime()-lastReport>2000){
                    lastReport=SystemClock.elapsedRealtime();
                    progress.onPhase("삼성 녹음 파일 AAC→PCM→sherpa 인식 중 · "+decodedOutputFrames+" frames");
                }
            }
            double rms=decodedOutputFrames>0?
                Math.sqrt(squareSum/decodedOutputFrames):0d;
            double sourceSeconds=outputSampleRate>0?
                decodedOutputFrames/(double)outputSampleRate:0d;
            double asrSeconds=pcmToAsrFrames/(double)RATE;
            LabStore.log("SAMSUNG_REC_PCM_SUMMARY",
                "sourceFrames="+decodedOutputFrames+
                "; sampleRate="+outputSampleRate+
                "; channels="+outputChannels+
                "; pcmEncoding="+outputEncoding+
                "; audioSeconds="+String.format(java.util.Locale.US,"%.3f",sourceSeconds)+
                "; asrSeconds="+String.format(java.util.Locale.US,"%.3f",asrSeconds)+
                "; asrFrames="+pcmToAsrFrames+
                "; peak="+String.format(java.util.Locale.US,"%.5f",peak)+
                "; rms="+String.format(java.util.Locale.US,"%.5f",rms)+
                "; nonSilentFrames="+audiblePcmFrames+
                "; sherpaNonemptyHypotheses="+recognizerHypothesisCount);
            if(decodedOutputFrames<MIN_AUDIO_FRAMES||pcmToAsrFrames<MIN_AUDIO_FRAMES)
                throw new IOException("완료 M4A의 PCM 출력량이 부족합니다. 디코더/파일 확인 필요: frames="+decodedOutputFrames+
                    " asrFrames="+pcmToAsrFrames);
            if(peak<MIN_SPEECH_PEAK)
                throw new IOException("PCM은 디코딩되었으나 사실상 무음입니다. 녹음 내용 또는 AAC 출력 확인 필요: peak="+peak+
                    " rms="+rms);
            // Streaming models may not mark the final phrase complete until
            // trailing silence arrives. This is file-based flushing only.
            stream.acceptWaveform(new float[RATE],RATE);
            while(recognizer.isReady(stream))recognizer.decode(stream);
            if(recognizer.isEndpoint(stream)){
                String rawLast=recognizer.getResult(stream).getText();
                String last=rawLast==null?"":rawLast.trim();
                if(last.isEmpty()&&!currentDraft.isEmpty()){
                    last=currentDraft;
                    recoveredDrafts++;
                }
                if(!last.isEmpty()&&!last.equals(lastSentence)){
                    if(transcript.length()>0)transcript.append('\n');
                    transcript.append(last);
                    lastSentence=last;
                    progress.onSentence(last);
                }
                currentDraft="";
                recognizer.reset(stream);
            }
            stream.inputFinished();
            while(recognizer.isReady(stream))recognizer.decode(stream);
            String rawTail=recognizer.getResult(stream).getText();
            String tail=rawTail==null?"":rawTail.trim();
            if(tail.isEmpty()&&!currentDraft.isEmpty()){
                tail=currentDraft;
                recoveredDrafts++;
                LabStore.log("SAMSUNG_REC_ASR_RECOVER_DRAFT",
                    "finalHypothesisBlank=true; recoveredChars="+tail.length());
            }
            if(!tail.isEmpty()&&!tail.equals(lastSentence)){
                if(transcript.length()>0)transcript.append('\n');
                transcript.append(tail);
                progress.onSentence(tail);
            }
            LabStore.log("SAMSUNG_REC_ASR_FINAL_AUDIT",
                "finalCharacters="+transcript.length()+
                "; recoveredDrafts="+recoveredDrafts+
                "; nonemptyHypotheses="+recognizerHypothesisCount+
                "; pcmFrames="+pcmToAsrFrames);
            if(transcript.length()==0){
                LabStore.log("SAMSUNG_REC_SHERPA_EMPTY_WITH_PCM",
                    "peak="+peak+"; rms="+rms+
                    "; asrFrames="+pcmToAsrFrames+
                    "; sherpaNonemptyHypotheses="+recognizerHypothesisCount);
                throw new IOException("PCM 음성 데이터는 확보되었으나 sherpa 한국어 인식 결과가 비어 있습니다. PCM_SUMMARY를 확인하십시오.");
            }
            return transcript.toString();
        }finally{
            extractor.release();
            if(codec!=null){
                try{codec.stop();}catch(Exception ignored){}
                codec.release();
            }
            if(stream!=null)stream.release();
            if(recognizer!=null)recognizer.release();
        }
    }

    private static float[] toMono(ByteBuffer data,int encoding,int channels)throws IOException{
        int bytesPerSample=encoding==AudioFormat.ENCODING_PCM_FLOAT?4:2;
        int frameBytes=channels*bytesPerSample;
        if(data.remaining()%frameBytes!=0)throw new IOException("불완전한 PCM 프레임");
        float[] samples=new float[data.remaining()/frameBytes];
        for(int i=0;i<samples.length;i++){
            float sum=0f;
            for(int ch=0;ch<channels;ch++)
                sum+=encoding==AudioFormat.ENCODING_PCM_FLOAT?
                    data.getFloat():data.getShort()/32768f;
            samples[i]=Math.max(-1f,Math.min(1f,sum/channels));
        }
        return samples;
    }
    private static final class PcmResampler {
        private long sourceIndex=0L;
        private double next=0d;
        private float previous=0f;
        float[] to16k(float[] mono,int inputRate){
            if(inputRate<=0)throw new IllegalArgumentException("invalid input rate");
            int max=(int)Math.min(6_000_000L,
                (long)Math.ceil(mono.length*16000d/inputRate)+6L);
            float[] out=new float[max];
            int count=0;
            double step=inputRate/(double)RATE;
            for(float current:mono){
                while(next<=sourceIndex+1e-10){
                    if(count==out.length)out=Arrays.copyOf(out,out.length*2);
                    double offset=sourceIndex==0?1d:next-(sourceIndex-1d);
                    out[count++]=sourceIndex==0?current:
                        (float)(previous+(current-previous)*Math.max(0d,Math.min(1d,offset)));
                    next+=step;
                }
                previous=current;
                sourceIndex++;
            }
            return Arrays.copyOf(out,count);
        }
    }
}
