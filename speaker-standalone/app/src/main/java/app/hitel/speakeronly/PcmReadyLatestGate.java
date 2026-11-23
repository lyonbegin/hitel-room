package app.hitel.speakeronly;

import java.util.concurrent.BlockingQueue;

/**
 * Consumer-only, one-shot operation at the instant the ORIGINAL IXIO SDK
 * becomes ready. Preserve the newest pre-ready PCM512 chunk and discard
 * the older pre-ready chunks. Never skip again during normal inference.
 *
 * Producer does not inspect readiness or consumer progress: it only enqueues.
 * We take a finite queue-size snapshot, not a while(!queue.isEmpty()) drain:
 * new frames produced concurrently remain in normal FIFO order.
 */
final class PcmReadyLatestGate {
  static final class Snapshot {
    final int queuedAtReady;
    final int discardedChunks;
    final long discardedBytes;
    final int queuedAfterTrim;
    Snapshot(int queuedAtReady,int discardedChunks,long discardedBytes,int queuedAfterTrim){
      this.queuedAtReady=queuedAtReady;
      this.discardedChunks=discardedChunks;
      this.discardedBytes=discardedBytes;
      this.queuedAfterTrim=queuedAfterTrim;
    }
    long discardedSamples(){return discardedBytes/2;}
  }

  static Snapshot trimPreReadyBacklog(BlockingQueue<byte[]> queue) {
    final int initial=queue.size();
    final int toDiscard=Math.max(0,initial-1);
    int discarded=0;
    long bytes=0;
    for(int i=0;i<toDiscard;i++){
      byte[] older=queue.poll();
      if(older==null)break;
      discarded++;
      bytes+=older.length;
    }
    return new Snapshot(initial,discarded,bytes,queue.size());
  }

  private PcmReadyLatestGate(){}
}
