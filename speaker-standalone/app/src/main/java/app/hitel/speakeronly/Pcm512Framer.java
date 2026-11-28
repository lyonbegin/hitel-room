package app.hitel.speakeronly;

import java.util.Arrays;

/** One continuous PCM16 stream; no per-decoder-block padding or dropped remainder. */
final class Pcm512Framer {
  static final int SAMPLES=512, BYTES=SAMPLES*2;
  interface Sink { void frame(byte[] bytes); }
  private final byte[] pending=new byte[BYTES];
  private int used;
  void accept(byte[] input,Sink sink){
    if((input.length&1)!=0)throw new IllegalArgumentException("PCM16 alignment");
    for(int at=0;at<input.length;){
      int n=Math.min(BYTES-used,input.length-at);
      System.arraycopy(input,at,pending,used,n);
      used+=n;at+=n;
      if(used==BYTES){sink.frame(pending.clone());used=0;}
    }
  }
  int finish(Sink sink){
    if(used==0)return 0;
    int padding=BYTES-used;
    Arrays.fill(pending,used,BYTES,(byte)0);
    sink.frame(pending.clone());used=0;
    return padding/2;
  }
}
