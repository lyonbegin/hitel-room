package app.hitel.speakeronly;

import android.content.Context;
import android.media.*;
import android.net.Uri;
import android.os.SystemClock;
import java.io.*;
import java.nio.*;

/** Completed Samsung M4A -> 48kHz mono PCM16LE, independent of the live STT decoder. */
final class CallTxDecode {
  static final int RATE=48000;
  static final long MAX_BYTES=RATE*2L*600; // ten minute guard
  static long convert(Context c,Uri uri,File out)throws Exception {
    MediaExtractor ex=new MediaExtractor();
    MediaCodec codec=null;
    boolean started=false;
    long bytes=0;
    try {
      ex.setDataSource(c,uri,null);
      MediaFormat f=null;
      for(int i=0;i<ex.getTrackCount();i++){
        MediaFormat candidate=ex.getTrackFormat(i);
        if(MediaFormat.MIMETYPE_AUDIO_AAC.equals(candidate.getString(MediaFormat.KEY_MIME))){
          f=candidate;ex.selectTrack(i);break;
        }
      }
      if(f==null)throw new IOException("완료된 AAC M4A 파일이 아닙니다");
      if(f.getInteger(MediaFormat.KEY_SAMPLE_RATE)!=RATE)
        throw new IOException("이번 TX 시험본은 삼성 48kHz M4A만 지원합니다");
      int channels=f.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
      if(channels!=1&&channels!=2)throw new IOException("모노 또는 스테레오만 지원합니다");
      codec=MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
      codec.configure(f,null,null,0);codec.start();started=true;
      MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();
      boolean inputEnd=false,outputEnd=false;
      long progress=SystemClock.elapsedRealtime();
      try(OutputStream dst=new BufferedOutputStream(new FileOutputStream(out))){
        while(!outputEnd){
          if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("변환 취소");
          if(!inputEnd){
            int idx=codec.dequeueInputBuffer(5000);
            if(idx>=0){
              ByteBuffer b=codec.getInputBuffer(idx);
              if(b==null)throw new IOException("AAC 입력 버퍼 없음");
              b.clear();int n=ex.readSampleData(b,0);
              if(n<0){codec.queueInputBuffer(idx,0,0,0,MediaCodec.BUFFER_FLAG_END_OF_STREAM);inputEnd=true;}
              else{codec.queueInputBuffer(idx,0,n,ex.getSampleTime(),0);ex.advance();}
              progress=SystemClock.elapsedRealtime();
            }
          }
          int idx=codec.dequeueOutputBuffer(info,5000);
          if(idx==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){
            MediaFormat fmt=codec.getOutputFormat();
            int rate=fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            channels=fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            int encoding=fmt.containsKey(MediaFormat.KEY_PCM_ENCODING)?fmt.getInteger(MediaFormat.KEY_PCM_ENCODING):AudioFormat.ENCODING_PCM_16BIT;
            if(rate!=RATE||(channels!=1&&channels!=2)||encoding!=AudioFormat.ENCODING_PCM_16BIT)throw new IOException("지원하지 않는 디코더 PCM 형식");
            progress=SystemClock.elapsedRealtime();
          }else if(idx>=0){
            try{
              ByteBuffer b=codec.getOutputBuffer(idx);
              if(b!=null&&info.size>0){
                b.order(ByteOrder.LITTLE_ENDIAN);b.position(info.offset);b.limit(info.offset+info.size);
                if(b.remaining()%(channels*2)!=0)throw new IOException("PCM frame alignment");
                byte[] mono=new byte[b.remaining()/channels];int pos=0;
                while(b.remaining()>=channels*2){
                  int v=b.getShort();if(channels==2)v=(v+b.getShort())/2;
                  mono[pos++]=(byte)v;mono[pos++]=(byte)(v>>8);
                }
                bytes+=mono.length;if(bytes>MAX_BYTES)throw new IOException("10분 초과 파일");
                dst.write(mono);
              }
              outputEnd=(info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
            }finally{codec.releaseOutputBuffer(idx,false);}
            progress=SystemClock.elapsedRealtime();
          }
          if(SystemClock.elapsedRealtime()-progress>15000)throw new IOException("AAC decode timeout");
        }
      }
      if(bytes<=0)throw new IOException("PCM 데이터 없음");
      return bytes;
    }finally{
      if(codec!=null){if(started)try{codec.stop();}catch(Exception ignored){}codec.release();}
      ex.release();
    }
  }
}
