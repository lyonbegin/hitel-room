package app.hitel.speakeronly;

import java.io.IOException;
import java.util.Arrays;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Single-producer/single-consumer FIFO for exactly 32ms 16kHz mono PCM16.
 * Producer writes continuously without waiting for IXIO inference.
 * Consumer removes one frame with AudioRecord-compatible read().
 * At end of recording, finishInput() lets the consumer drain all queued frames.
 */
final class Pcm512Fifo {
  private final LinkedBlockingQueue<byte[]> frames=new LinkedBlockingQueue<>();
  private volatile boolean producerFinished;
  private volatile long produced, consumed;

  void put(byte[] pcm) throws IOException {
    if(producerFinished)throw new IOException("FIFO producer already finished");
    if(pcm==null || pcm.length!=Pcm512Chunker.BYTES)
      throw new IOException("FIFO requires exactly 512 PCM16 samples");
    frames.add(Arrays.copyOf(pcm,pcm.length)); // never lose input on temporary slow inference
    produced++;
  }

  int read(short[] dst,int offset,int count)throws InterruptedException,IOException {
    if(dst==null||count!=Pcm512Chunker.SAMPLES||offset<0||
       offset>dst.length-count)
      throw new IOException("IXIO read() requires 512 shorts");
    for(;;){
      byte[] pcm=frames.poll(250,TimeUnit.MILLISECONDS);
      if(pcm!=null){
        for(int i=0;i<Pcm512Chunker.SAMPLES;i++){
          int lo=pcm[i*2]&255,hi=pcm[i*2+1]&255;
          dst[offset+i]=(short)((hi<<8)|lo);
        }
        consumed++;
        return count; // frame removed from FIFO
      }
      if(producerFinished&&frames.isEmpty())return -1;
    }
  }

  void finishInput(){producerFinished=true;}
  boolean inputFinished(){return producerFinished;}
  int size(){return frames.size();}
  long producedFrames(){return produced;}
  long consumedFrames(){return consumed;}
}
