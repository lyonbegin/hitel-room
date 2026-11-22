package ai.hitel.media;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.TreeMap;
import java.util.function.Consumer;

/** One source sample clock: 16 kHz PCM16 mono, 25 SDK frames/sec.
 * Frame ownership moves to this queue only when tryOfferFrame returns true.
 * PCM is never made available without its matching frame.
 *
 * This is an input alignment primitive, not a WebRTC encoder or player.
 * Do not set SDK skip-ahead from a separately running speaker clock.
 */
public final class HitelPairedAvQueue<F> implements AutoCloseable {
    public static final int RATE = 16000;
    public static final int HOP = 640;
    public static final int PCM_BYTES_PER_FRAME = HOP * 2;
    private static final class Chunk {
        final byte[] bytes;
        int at;
        Chunk(byte[] bytes) { this.bytes = bytes; }
    }
    public static final class Pair<F> {
        public final long turn, ordinal, startSample, endSample, captureTimeNs;
        public final F video;
        public final byte[] pcm16;
        private final Consumer<F> release;
        private boolean closed;
        Pair(long turn,long ordinal,long start,long end,long time,F video,byte[] pcm,Consumer<F> release) {
            this.turn=turn; this.ordinal=ordinal; startSample=start; endSample=end;
            captureTimeNs=time; this.video=video; pcm16=pcm; this.release=release;
        }
        public synchronized void close() { if(!closed) { closed=true; release.accept(video); } }
    }
    private final int maxPcmBytes, maxFrames;
    private final Consumer<F> release;
    private final ArrayDeque<Chunk> pcm = new ArrayDeque<>();
    private final TreeMap<Long,F> frames = new TreeMap<>();
    private long generation, accepted, emitted, next, timeOriginNs;
    private int queuedBytes;
    private boolean ended, closed;
    public HitelPairedAvQueue(int maxBufferedMs,int maxFrames, Consumer<F> release) {
        if(maxBufferedMs<40||maxFrames<1) throw new IllegalArgumentException("buffer too small");
        this.maxPcmBytes=Math.multiplyExact(maxBufferedMs, RATE*2/1000);
        this.maxFrames=maxFrames;
        this.release=release;
    }
    public synchronized void begin(long turn,long monotonicOriginNs) {
        if(closed||turn<=generation||monotonicOriginNs<0) throw new IllegalArgumentException("turn/time");
        clear();
        generation=turn; timeOriginNs=monotonicOriginNs;
        accepted=emitted=next=0; ended=false;
    }
    /** False is backpressure or stale turn; retry same chunk only if same turn. */
    public synchronized boolean tryAppend(long turn,long firstSample,byte[] input) {
        if(closed||turn!=generation||ended) return false;
        if((input.length&1)!=0||input.length==0) throw new IllegalArgumentException("PCM16");
        if(firstSample!=accepted) throw new IllegalArgumentException("PCM discontinuity");
        if(input.length>maxPcmBytes) throw new IllegalArgumentException("chunk exceeds queue");
        if(input.length>maxPcmBytes-queuedBytes) return false;
        pcm.addLast(new Chunk(Arrays.copyOf(input,input.length)));
        queuedBytes+=input.length; accepted+=input.length/2;
        return true;
    }
    /** Keep ordinals, including gaps. A missing ordinal blocks output; never shift audio. */
    public synchronized boolean tryOfferFrame(long turn,long ordinal,F frame) {
        if(closed||turn!=generation||ordinal<next||frame==null||frames.containsKey(ordinal)) return false;
        if(frames.size()>=maxFrames) return false;
        frames.put(ordinal,frame); return true;
    }
    public synchronized void end(long turn,long totalSamples) {
        if(closed||turn!=generation) return;
        if(totalSamples!=accepted) throw new IllegalArgumentException("end sample mismatch");
        ended=true;
    }
    public synchronized Pair<F> poll() {
        if(closed||(ended&&emitted==accepted)) return null;
        final long first=Math.multiplyExact(next,(long)HOP);
        if(first!=emitted) throw new IllegalStateException("timeline discontinuity");
        final long available=accepted-first;
        if(available<=0||(!ended&&available<HOP)||!frames.containsKey(next)) return null;
        final int bytes=(int)Math.min(available,HOP)*2;
        if(queuedBytes<bytes) throw new IllegalStateException("PCM missing");
        byte[] audio=new byte[bytes];
        int at=0;
        while(at<bytes) {
            Chunk c=pcm.peekFirst();
            int n=Math.min(bytes-at,c.bytes.length-c.at);
            System.arraycopy(c.bytes,c.at,audio,at,n);
            c.at+=n; at+=n;
            if(c.at==c.bytes.length) pcm.removeFirst();
        }
        queuedBytes-=bytes;
        F frame=frames.remove(next);
        long end=first+bytes/2;
        Pair<F> pair=new Pair<>(generation,next,first,end,timeOriginNs+first*62500L,frame,audio,release);
        next++; emitted=end;
        // Tail is terminal; no subsequent full frame can occur.
        if(ended&&emitted==accepted) { for(F f:frames.values()) release.accept(f); frames.clear(); }
        return pair;
    }
    public synchronized boolean drained() { return ended&&emitted==accepted; }
    public synchronized long acceptedSamples(){return accepted;}
    public synchronized long emittedSamples(){return emitted;}
    public synchronized int queuedFrames(){return frames.size();}
    public synchronized long waitingOrdinal(){return next;}
    private void clear() {
        for(F f:frames.values()) release.accept(f);
        frames.clear(); pcm.clear(); queuedBytes=0;
    }
    @Override public synchronized void close(){ if(!closed){clear();closed=true;} }
}
