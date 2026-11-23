package app.hitel.speakeronly;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** JVM-only proof of original 16kHz PCM Flow contract with recording-file bytes. */
public final class FileBackedLocalAudioRecordSourceTest {
  private static void check(boolean ok,String why){
    if(!ok)throw new AssertionError(why);
  }
  private static byte[] pcm(short[] samples){
    byte[] b=new byte[samples.length*2];
    for(int i=0;i<samples.length;i++){
      b[i*2]=(byte)samples[i];
      b[i*2+1]=(byte)((samples[i]>>>8)&255);
    }
    return b;
  }
  private static void equal(float actual,float expected){
    if(Float.floatToIntBits(actual)!=Float.floatToIntBits(expected))
      throw new AssertionError("PCM amplitude mismatch "+actual+" != "+expected);
  }
  public static void main(String[] args) throws Exception {
    short[] source=new short[512*3+7];
    for(int i=0;i<source.length;i++)source[i]=(short)(i*41-32768);
    source[0]=Short.MIN_VALUE;
    source[1]=Short.MAX_VALUE;
    source[2]=-1;
    byte[] bytes=pcm(source);
    List<float[]> captured=new ArrayList<>();
    // Original CallScriptManager copies the reusable float[] before enqueue.
    FileBackedLocalAudioRecordSource bridge=
      new FileBackedLocalAudioRecordSource(frame->captured.add(frame.clone()));
    // Deliberately split between low/high bytes and across 512-sample frames.
    int[] sizes={1,2,101,17,2048,3,55,9,643,7,4097};
    int offset=0,step=0;
    while(offset<bytes.length){
      int count=Math.min(sizes[step++%sizes.length],bytes.length-offset);
      byte[] fragment=new byte[count];
      System.arraycopy(bytes,offset,fragment,0,count);
      bridge.accept(fragment);
      offset+=count;
    }
    bridge.finish();
    check(captured.size()==4,"expected three complete frames and one 7-sample tail");
    check(captured.get(0).length==512 && captured.get(1).length==512 &&
      captured.get(2).length==512 && captured.get(3).length==7,
      "incorrect frame lengths or padded final PCM");
    check(bridge.emittedSamples()==source.length,"PCM loss or duplication");
    check(bridge.emittedFrames()==4,"wrong frame count");
    int at=0;
    for(float[] frame:captured){
      for(float v:frame)equal(v,source[at++]/32768.0f);
    }
    check(at==source.length,"PCM transcription input count mismatch");
    // Feed full frames and then mutate original file buffer: queued frame is owned copy.
    float[] first=captured.get(0);
    check(first[0]==-1f && first[1]==Short.MAX_VALUE/32768.0f,
      "original sign/amplitude contract changed");
    boolean rejected=false;
    try{bridge.accept(new byte[2]);}catch(IOException expected){rejected=true;}
    check(rejected,"finished source accepted new PCM");

    FileBackedLocalAudioRecordSource truncated=
      new FileBackedLocalAudioRecordSource(frame->{});
    truncated.accept(new byte[]{0x55});
    rejected=false;
    try{truncated.finish();}catch(IOException expected){rejected=true;}
    check(rejected,"odd trailing PCM byte silently discarded");

    FileBackedLocalAudioRecordSource noData=
      new FileBackedLocalAudioRecordSource(frame->{throw new AssertionError("unexpected frame");});
    noData.finish();
    check(noData.emittedFrames()==0,"empty input emitted artificial silence");
    System.out.println("PASS_IXIO_ORIGINAL_LOCAL_AUDIO_SOURCE_FILE_BACKED_512_SAMPLES_EXACT_FLOAT_NO_DUPLICATION_NO_PADDING");
  }
}
