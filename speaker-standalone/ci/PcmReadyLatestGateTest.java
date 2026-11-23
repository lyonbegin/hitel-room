package app.hitel.speakeronly;

import java.util.concurrent.LinkedBlockingQueue;

/** Pure JVM regression: no Android services or IXIO models required. */
public final class PcmReadyLatestGateTest {
  private static byte[] pcm(int value) {
    byte[] b=new byte[1024];
    b[0]=(byte)value;
    return b;
  }
  private static void eq(long actual,long expected,String title){
    if(actual!=expected)throw new AssertionError(title+": "+actual+" != "+expected);
  }
  private static void check(LinkedBlockingQueue<byte[]> queue,int value,String where){
    byte[] got=queue.poll();
    if(got==null || (got[0]&255)!=value)
      throw new AssertionError(where+": expected "+value+" got "+(got==null?"NULL":got[0]&255));
  }
  public static void main(String[] args){
    LinkedBlockingQueue<byte[]> q=new LinkedBlockingQueue<>();
    for(int i=1;i<=8;i++)q.add(pcm(i));
    PcmReadyLatestGate.Snapshot s=PcmReadyLatestGate.trimPreReadyBacklog(q);
    eq(s.queuedAtReady,8,"initial");
    eq(s.discardedChunks,7,"discarded");
    eq(s.discardedSamples(),7*512,"discarded samples");
    eq(s.queuedAfterTrim,1,"kept newest");
    check(q,8,"first ready keeps newest");
    q.add(pcm(9));q.add(pcm(10));q.add(pcm(11));
    check(q,9,"later normal FIFO 9");
    check(q,10,"later normal FIFO 10");
    check(q,11,"later normal FIFO 11");
    eq(q.size(),0,"empty");

    LinkedBlockingQueue<byte[]> empty=new LinkedBlockingQueue<>();
    s=PcmReadyLatestGate.trimPreReadyBacklog(empty);
    eq(s.discardedChunks,0,"no pre-ready data never skipped");
    empty.add(pcm(1));check(empty,1,"first post-ready PCM");

    LinkedBlockingQueue<byte[]> one=new LinkedBlockingQueue<>();
    one.add(pcm(42));
    s=PcmReadyLatestGate.trimPreReadyBacklog(one);
    eq(s.discardedChunks,0,"one frame retained");
    check(one,42,"single frame");
    System.out.println("PASS_IXIO_FIRST_SDK_READY_DISCARD_OLD_KEEP_LATEST_ONCE_THEN_PURE_FIFO");
  }
}
