package app.hitel.speakeronly;

import java.io.IOException;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;

/** Run with javac/java on CI, no Android dependencies. */
public final class ArganoPcm512PipeTest {
  static void eq(boolean ok,String reason){if(!ok)throw new AssertionError(reason);}
  public static void main(String[] args)throws Exception {
    Pcm512Fifo fifo=new Pcm512Fifo();
    List<byte[]> emitted=new ArrayList<>();
    Pcm512Chunker chunker=new Pcm512Chunker(pcm->{
      emitted.add(pcm.clone());
      fifo.put(pcm);
    });
    // Source is 5 complete 32ms frames plus 74 bytes (37 final samples).
    byte[] source=new byte[5*1024+74];
    for(int i=0;i<source.length;i++)source[i]=(byte)((i*31+7)&255);
    // An InputStream may return ODD byte counts, including half a PCM sample.
    int[] uneven={1,2,3,9,1021,7,100,819,2048,99,407,5000};
    int off=0;
    for(int n:uneven){
      if(off>=source.length)break;
      int len=Math.min(n,source.length-off);
      chunker.write(source,off,len);
      off+=len;
    }
    if(off<source.length)chunker.write(source,off,source.length-off);
    chunker.finish();
    eq(chunker.frames()==6,"expected six exact 512-sample frames");
    eq(emitted.size()==6,"six enqueued frames");
    eq(chunker.inputBytes()==source.length,"all PCM source bytes accepted");
    eq(fifo.size()==6,"producer ahead of consumer");
    eq(fifo.producedFrames()==6,"producer counter");
    fifo.finishInput();
    short[] shorts=new short[512];
    byte[] reassembled=new byte[6*1024];
    int w=0;
    while(true){
      int got=fifo.read(shorts,0,512);
      if(got<0)break;
      eq(got==512,"read must be 512 samples");
      for(int i=0;i<got;i++){
        reassembled[w++]=(byte)(shorts[i]&255);
        reassembled[w++]=(byte)((shorts[i]>>>8)&255);
      }
    }
    eq(w==reassembled.length,"consume all six frames");
    eq(fifo.size()==0,"queue is empty after consumer");
    eq(fifo.consumedFrames()==6,"all frames consumed");
    eq(Arrays.equals(Arrays.copyOf(reassembled,source.length),source),
      "PCM must preserve exact bytes in order");
    for(int i=source.length;i<reassembled.length;i++)
      eq(reassembled[i]==0,"only final incomplete frame is padded");
    boolean rejected=false;
    try{fifo.put(new byte[1023]);}catch(IOException expected){rejected=true;}
    eq(rejected,"reject malformed PCM frame");
    boolean badRead=false;
    try{fifo.read(new short[512],0,511);}catch(IOException expected){badRead=true;}
    eq(badRead,"reject non-512-sample read()");
    Pcm512Chunker malformed=new Pcm512Chunker(pcm->{});
    malformed.write(new byte[]{1},0,1);
    boolean partialRejected=false;
    try{malformed.finish();}catch(IOException expected){partialRejected=true;}
    eq(partialRejected,"reject unfinished half of a 16-bit sample");
    System.out.println("PASS_EXTERNAL_ARGANO_PCM512_PRODUCER_CONSUMER_FIFO_DRAIN");
  }
}
