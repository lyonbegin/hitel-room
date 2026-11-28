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

/** Minimum start-to-start cadence, rebased after starvation/overrun; no catch-up bursts. */
final class Pcm32Pacer {
  static final long PERIOD_NS=32_000_000L;
  interface Clock {long now();void sleep(long ns)throws InterruptedException;}
  private final Clock clock;
  private long previous=Long.MIN_VALUE;
  Pcm32Pacer(Clock clock){this.clock=clock;}
  long await()throws InterruptedException{
    long now=clock.now();
    if(previous!=Long.MIN_VALUE){
      long left=PERIOD_NS-(now-previous);
      while(left>0){clock.sleep(left);now=clock.now();left=PERIOD_NS-(now-previous);}
    }
    previous=now;
    return now;
  }
}
