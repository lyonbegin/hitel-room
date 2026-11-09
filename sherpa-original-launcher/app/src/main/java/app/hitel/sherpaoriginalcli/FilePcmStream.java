package app.hitel.sherpaoriginalcli;

import android.content.Context;
import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/**
 * Real streaming file source, NOT a microphone:
 * ContentResolver URI -> MediaExtractor packets -> MediaCodec decoded PCM
 * -> stateful 16 kHz mono resampler -> short PCM chunks while file is read.
 * The callback is invoked before remaining file packets have been decoded.
 * No full-file PCM conversion or complete-file staging occurs.
 */
public final class FilePcmStream {
  private static final int TARGET_RATE=16000;
  public static final int SEGMENT_SECONDS=4;
  private static final int OUTPUT_SAMPLES=TARGET_RATE*SEGMENT_SECONDS;

  public interface Callback {
    boolean cancelled();
    void onStart(long durationMs,String mime,int sourceRate,int channels);
    void onProgress(long decodedMs,long totalMs);
    void onSegment(int seq,byte[] pcm16,long sourcePositionMs,long totalMs,boolean last) throws Exception;
  }
  private static final class PcmChunker {
    final Callback callback;
    final long totalMs;
    ByteArrayOutputStream buffer=new ByteArrayOutputStream(OUTPUT_SAMPLES*2+4096);
    long emittedSamples=0;
    int segmentSamples=0;
    int segmentCount=0;
    int rate=0;
    long sourceFrames=0;
    float previous;
    double nextSourcePosition=0;

    PcmChunker(Callback callback,long totalMs){this.callback=callback;this.totalMs=totalMs;}

    void emit(float sample) throws Exception {
      sample=Math.max(-1f,Math.min(1f,sample));
      int value=Math.round(sample*32767f);
      buffer.write(value&255);
      buffer.write((value>>8)&255);
      segmentSamples++;
      emittedSamples++;
      if(segmentSamples==OUTPUT_SAMPLES)flush(false);
    }

    void accept(float mono,int inputRate) throws Exception {
      if(rate==0)rate=inputRate;
      if(inputRate!=rate)throw new IOException("디코딩 중 표본화율 변경: "+rate+" -> "+inputRate);
      long index=sourceFrames;
      if(index==0){
        if(nextSourcePosition<=0){
          emit(mono);
          nextSourcePosition=rate/(double)TARGET_RATE;
        }
      }else{
        while(nextSourcePosition<=index+1e-8){
          double factor=nextSourcePosition-(index-1);
          factor=Math.max(0,Math.min(1,factor));
          emit((float)(previous+(mono-previous)*factor));
          nextSourcePosition+=rate/(double)TARGET_RATE;
        }
      }
      previous=mono;
      sourceFrames++;
    }

    void flush(boolean last) throws Exception {
      if(segmentSamples==0)return;
      segmentCount++;
      byte[] chunk=buffer.toByteArray();
      long currentMs=emittedSamples*1000/TARGET_RATE;
      callback.onSegment(segmentCount,chunk,currentMs,totalMs,last);
      buffer.reset();
      segmentSamples=0;
    }
  }

  public static void decode(Context context,Uri source,Callback callback) throws Exception {
    MediaExtractor extractor=new MediaExtractor();
    MediaCodec codec=null;
    try{
      extractor.setDataSource(context,source,null);
      int selected=-1;
      MediaFormat audio=null;
      for(int i=0;i<extractor.getTrackCount();i++){
        MediaFormat candidate=extractor.getTrackFormat(i);
        String m=candidate.getString(MediaFormat.KEY_MIME);
        if(m!=null && m.startsWith("audio/")){
          selected=i;audio=candidate;break;
        }
      }
      if(selected<0||audio==null)throw new IOException("녹음 파일에서 오디오 트랙을 찾지 못했습니다.");
      String mime=audio.getString(MediaFormat.KEY_MIME);
      if(mime==null||mime.equals("audio/raw"))
        throw new IOException("이 파일 형식은 Android MediaCodec 스트리밍 디코딩이 지원되지 않습니다: "+mime);
      int rate=audio.containsKey(MediaFormat.KEY_SAMPLE_RATE)?audio.getInteger(MediaFormat.KEY_SAMPLE_RATE):0;
      int channels=audio.containsKey(MediaFormat.KEY_CHANNEL_COUNT)?audio.getInteger(MediaFormat.KEY_CHANNEL_COUNT):1;
      long durationMs=audio.containsKey(MediaFormat.KEY_DURATION)?
        Math.max(0,audio.getLong(MediaFormat.KEY_DURATION)/1000):0;
      extractor.selectTrack(selected);
      codec=MediaCodec.createDecoderByType(mime);
      codec.configure(audio,null,null,0);
      codec.start();
      callback.onStart(durationMs,mime,rate,channels);
      PcmChunker chunks=new PcmChunker(callback,durationMs);
      MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();
      boolean inputEnded=false,outputEnded=false;
      long lastProgress=-1;
      int idle=0;
      while(!outputEnded){
        if(callback.cancelled())throw new InterruptedException("사용자께서 파일 스트리밍을 중지하셨습니다.");
        if(!inputEnded){
          int inputIndex=codec.dequeueInputBuffer(10000);
          if(inputIndex>=0){
            ByteBuffer input=codec.getInputBuffer(inputIndex);
            if(input==null)throw new IOException("디코더 입력 버퍼를 가져올 수 없습니다.");
            input.clear();
            int size=extractor.readSampleData(input,0);
            if(size<0){
              codec.queueInputBuffer(inputIndex,0,0,0,MediaCodec.BUFFER_FLAG_END_OF_STREAM);
              inputEnded=true;
            }else{
              long pts=Math.max(0,extractor.getSampleTime());
              codec.queueInputBuffer(inputIndex,0,size,pts,0);
              extractor.advance();
            }
          }
        }
        int outputIndex=codec.dequeueOutputBuffer(info,10000);
        if(outputIndex==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){
          MediaFormat decoded=codec.getOutputFormat();
          if(decoded.containsKey(MediaFormat.KEY_SAMPLE_RATE))rate=decoded.getInteger(MediaFormat.KEY_SAMPLE_RATE);
          if(decoded.containsKey(MediaFormat.KEY_CHANNEL_COUNT))channels=decoded.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
          continue;
        }
        if(outputIndex==MediaCodec.INFO_TRY_AGAIN_LATER){
          idle++;
          if(idle>2000)throw new IOException("오디오 디코더가 응답하지 않습니다.");
          continue;
        }
        if(outputIndex<0)continue;
        idle=0;
        if(info.size>0){
          ByteBuffer data=codec.getOutputBuffer(outputIndex);
          if(data==null)throw new IOException("디코더 PCM 출력 버퍼가 없습니다.");
          data.order(ByteOrder.LITTLE_ENDIAN);
          data.position(info.offset);
          data.limit(info.offset+info.size);
          MediaFormat fmt=codec.getOutputFormat(outputIndex);
          int actualRate=fmt.containsKey(MediaFormat.KEY_SAMPLE_RATE)?
            fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE):rate;
          int actualChannels=fmt.containsKey(MediaFormat.KEY_CHANNEL_COUNT)?
            fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT):channels;
          int encoding=fmt.containsKey(MediaFormat.KEY_PCM_ENCODING)?
            fmt.getInteger(MediaFormat.KEY_PCM_ENCODING):AudioFormat.ENCODING_PCM_16BIT;
          if(actualChannels<1||actualChannels>8)
            throw new IOException("지원되지 않는 채널 수: "+actualChannels);
          if(actualRate<8000||actualRate>192000)
            throw new IOException("지원되지 않는 표본화율: "+actualRate);
          int bytesPerSample=encoding==AudioFormat.ENCODING_PCM_FLOAT?4:
             encoding==AudioFormat.ENCODING_PCM_16BIT?2:0;
          if(bytesPerSample==0)throw new IOException("지원되지 않는 디코더 PCM 형식: "+encoding);
          int bytesPerFrame=actualChannels*bytesPerSample;
          int frames=data.remaining()/bytesPerFrame;
          for(int i=0;i<frames;i++){
            if(callback.cancelled())throw new InterruptedException("파일 스트리밍을 중지하셨습니다.");
            float mixed=0f;
            for(int j=0;j<actualChannels;j++){
              mixed+=(encoding==AudioFormat.ENCODING_PCM_FLOAT?
                 data.getFloat():data.getShort()/32768f);
            }
            chunks.accept(mixed/actualChannels,actualRate);
          }
          long decodedMs=chunks.emittedSamples*1000/TARGET_RATE;
          if(decodedMs-lastProgress>=500){
            callback.onProgress(decodedMs,durationMs);
            lastProgress=decodedMs;
          }
        }
        outputEnded=(info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
        codec.releaseOutputBuffer(outputIndex,false);
      }
      chunks.flush(true);
      callback.onProgress(chunks.emittedSamples*1000/TARGET_RATE,durationMs);
    }finally{
      if(codec!=null){
        try{codec.stop();}catch(Exception ignored){}
        try{codec.release();}catch(Exception ignored){}
      }
      extractor.release();
    }
  }
}
