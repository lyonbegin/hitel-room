package app.hitel.speakeronly;

import java.io.IOException;
import java.util.Arrays;

/**
 * One producer only. Converts arbitrary PCM16LE input read lengths into exact
 * 1024-byte/512-sample (32ms at 16kHz) FIFO messages.
 *
 * No VAD, no silence gating, no clock based splitting, no data skipping.
 * Consumers may run independently and drain their own queue.
 */
final class Pcm512Chunker {
  static final int SAMPLES=512;
  static final int BYTES=SAMPLES*2;
  interface Sink { void put(byte[] ownedPcm512) throws IOException; }

  private final Sink sink;
  private final byte[] partial=new byte[BYTES];
  private int used;
  private long actualInputBytes, emittedFrames;
  private boolean finished;

  Pcm512Chunker(Sink sink){
    if(sink==null)throw new IllegalArgumentException("PCM sink required");
    this.sink=sink;
  }
  void write(byte[] src,int offset,int length)throws IOException {
    if(finished)throw new IOException("PCM producer already finished");
    if(src==null||offset<0||length<0||offset>src.length-length)
      throw new IOException("Invalid PCM input range");
    int at=offset;
    int end=offset+length;
    while(at<end){
      int n=Math.min(BYTES-used,end-at);
      System.arraycopy(src,at,partial,used,n);
      at+=n;
      used+=n;
      actualInputBytes+=n;
      if(used==BYTES){
        sink.put(Arrays.copyOf(partial,BYTES));
        emittedFrames++;
        used=0;
      }
    }
  }
  /**
   * Drain the final partial PCM frame, if any, with silence only at the end.
   * The input bytes are all preserved. The last chunk is still 512 samples.
   */
  void finish()throws IOException {
    if(finished)return;
    if((used&1)!=0)throw new IOException("PCM producer ended mid 16-bit sample");
    if(used>0){
      Arrays.fill(partial,used,BYTES,(byte)0);
      sink.put(Arrays.copyOf(partial,BYTES));
      emittedFrames++;
      used=0;
    }
    finished=true;
  }
  long inputBytes(){return actualInputBytes;}
  long frames(){return emittedFrames;}
  int remainderBytes(){return used;}
}
