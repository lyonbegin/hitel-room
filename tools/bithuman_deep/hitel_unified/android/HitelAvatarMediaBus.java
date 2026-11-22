package com.cloudwebrtc.webrtc;

import ai.hitel.media.HitelPairedAvQueue;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.media.AudioFormat;
import android.os.Handler;
import android.util.Log;
import android.view.Surface;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayDeque;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.LockSupport;
import org.webrtc.CapturerObserver;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoFrame;
import org.webrtc.audio.JavaAudioDeviceModule;

/** Experimental local avatar source. Same 144 libwebrtc factory as camera.
 * Audio is injected only when its actual SDK frame has been GPU-composited.
 * No independent speaker and no microphone audio in avatar mode.
 */
public final class HitelAvatarMediaBus {
    private static final String TAG="HITEL_RTC_AV";
    private static final AtomicReference<Session> active=new AtomicReference<>();
    private static volatile JavaAudioDeviceModule adm;
    private HitelAvatarMediaBus(){}
    static void setAudioDevice(JavaAudioDeviceModule module){adm=module;}

    static Session open(SurfaceTextureHelper helper,CapturerObserver observer,int w,int h) {
        Session s=new Session(helper,observer,w,h);
        if(!active.compareAndSet(null,s)){s.close();throw new IllegalStateException("avatar RTC source already open");}
        try {
            if(adm==null)throw new IllegalStateException("WebRTC audio device not initialized");
            adm.setAudioRecordEnabled(false);
            s.start();return s;
        }catch(RuntimeException e){active.compareAndSet(s,null);s.close();if(adm!=null)adm.setAudioRecordEnabled(true);throw e;}
    }
    static void close(Session s){
        if(active.compareAndSet(s,null)){
            // While media tracks are still closing, keep the audio buffer callback silent.
            s.close();
            if(adm!=null)adm.setAudioRecordEnabled(true);
        }
    }
    public static boolean enabled(){return active.get()!=null;}
    public static void begin(long turn) { Session s=active.get();if(s==null)throw new IllegalStateException("RTC sink unavailable");s.begin(turn); }
    public static boolean append(long turn,long first,byte[] pcm) {
        Session s=active.get();return s!=null&&s.append(turn,first,pcm);
    }
    public static boolean live(long turn) {Session s=active.get();return s!=null&&s.live(turn);}
    public static boolean canPull(long turn){Session s=active.get();return s!=null&&s.canPull(turn);}
    public static boolean frame(long turn,long ordinal,Bitmap bitmap,Runnable release){
        Session s=active.get();return s!=null&&s.frame(turn,ordinal,new SourceFrame(bitmap,release));
    }
    public static void end(long turn,long total){Session s=active.get();if(s!=null)s.end(turn,total);}
    public static void cancel(long turn){Session s=active.get();if(s!=null)s.cancel(turn);}
    /** Called directly before nativeDataIsRecorded by pinned WebRtcAudioRecord. */
    public static long onAudioBuffer(ByteBuffer buffer,int format,int channels,int rate,int size,long captureTimeNs) {
        Session s=active.get();
        if(s==null)return captureTimeNs; // normal microphone calls unchanged
        // The pinned ADM reports bytesRead=0 when its microphone read is disabled.
        // Its direct buffer still holds one 10 ms audio block. Without a blocking
        // AudioRecord.read(), the callback loops at CPU speed unless paced here.
        if(size==0){
            final int blockBytes=(rate>0 && channels>0 && format==AudioFormat.ENCODING_PCM_16BIT)
                ? (rate/100)*channels*2 : 0;
            final long pacedTime=s.paceSyntheticAudio();
            return s.audio(buffer,format,channels,rate,
                blockBytes>0 && buffer.capacity()==blockBytes ? blockBytes : 0,pacedTime);
        }
        return s.audio(buffer,format,channels,rate,size,captureTimeNs);
    }
    private static final class SourceFrame {
        final Bitmap bitmap; final Runnable release;
        SourceFrame(Bitmap b,Runnable r){bitmap=b;release=r;}
    }
    private static final class Ready {
        final HitelPairedAvQueue.Pair<SourceFrame> pair;
        final VideoFrame video;
        long outputFrames;
        boolean sent;
        Ready(HitelPairedAvQueue.Pair<SourceFrame> p,VideoFrame v){pair=p;video=v;}
    }
    static final class Session {
        final SurfaceTextureHelper helper;
        final Handler handler;
        final CapturerObserver observer;
        final Surface surface;
        final int width,height;
        final Paint paint=new Paint(Paint.FILTER_BITMAP_FLAG);
        final ArrayDeque<HitelPairedAvQueue.Pair<SourceFrame>> held=new ArrayDeque<>();
        HitelPairedAvQueue<SourceFrame> queue;
        HitelPairedAvQueue.Pair<SourceFrame> inFlight;
        Ready ready,playing;
        volatile boolean closed;
        long turn,startedCaptureNs,lastCaptureNs,lastProgressNs;
        volatile boolean ended;
        Thread worker;
        int callbackRate, callbackChannels, pairsSent, silenceBuffers;
        private long nextAudioNs;
        private boolean callbackReported;
        Session(SurfaceTextureHelper h,CapturerObserver o,int w,int ht){
            helper=h;handler=h.getHandler();observer=o;width=w;height=ht;
            helper.setTextureSize(w,ht);surface=new Surface(h.getSurfaceTexture());
        }
        void start(){
            helper.startListening(this::captured);
            observer.onCapturerStarted(true);
            worker=new Thread(this::pump,"HITEL-avatar-rtc-gpu");
            worker.setDaemon(true);worker.start();
        }
        synchronized void begin(long generation){
            reset();turn=generation;ended=false;startedCaptureNs=0;pairsSent=0;silenceBuffers=0;
            queue=new HitelPairedAvQueue<>(4000,8,f->f.release.run());
            queue.begin(generation,0);lastProgressNs=System.nanoTime();notifyAll();
            Log.i(TAG,"PAIR_TURN_BEGIN "+generation);
        }
        synchronized boolean live(long t){return !closed&&queue!=null&&turn==t;}
        synchronized boolean canPull(long t){return live(t)&&queue.queuedFrames()<8;}
        synchronized boolean append(long t,long first,byte[] pcm){
            if(!live(t))return false;
            boolean ok=queue.tryAppend(t,first,pcm);if(ok)notifyAll();return ok;
        }
        synchronized boolean frame(long t,long ordinal,SourceFrame frame){
            if(!live(t))return false;
            boolean ok=queue.tryOfferFrame(t,ordinal,frame);if(ok)notifyAll();return ok;
        }
        synchronized void end(long t,long total){
            if(live(t)){queue.end(t,total);ended=true;notifyAll();}
        }
        synchronized void cancel(long t){if(live(t)){reset();notifyAll();}}
        /** Hold one WebRTC texture buffer until audio timestamp assignment. Never queue unbounded GPU textures. */
        void pump(){
            try{
                while(!closed){
                    HitelPairedAvQueue.Pair<SourceFrame> pair=null;
                    synchronized(this){
                        while(!closed&&(queue==null||inFlight!=null||ready!=null||(!ended&&pairsSent==0&&queue.queuedFrames()<3)))wait(20);
                        if(closed)break;
                        pair=queue.poll();
                        if(pair==null){
                            if(!queue.drained() && System.nanoTime()-lastProgressNs>15_000_000_000L){
                                Log.e(TAG,"PAIR_STALL missing ordinal="+queue.waitingOrdinal());reset();notifyAll();
                            }
                            wait(10);continue;
                        }
                        inFlight=pair;lastProgressNs=System.nanoTime();
                    }
                    try{
                        Canvas c=surface.lockHardwareCanvas();
                        try{
                            c.drawColor(Color.BLACK);
                            Bitmap b=pair.video.bitmap;
                            float scale=Math.min(width/(float)b.getWidth(),height/(float)b.getHeight());
                            int dw=Math.round(b.getWidth()*scale),dh=Math.round(b.getHeight()*scale);
                            int x=(width-dw)/2,y=(height-dh)/2;
                            c.drawBitmap(b,null,new Rect(x,y,x+dw,y+dh),paint);
                        }finally{surface.unlockCanvasAndPost(c);}
                    }catch(Throwable e){
                        synchronized(this){if(inFlight==pair){inFlight=null;pair.close();}reset();notifyAll();}
                        Log.e(TAG,"GPU frame output failed",e);
                    }
                }
            }catch(InterruptedException e){Thread.currentThread().interrupt();}
        }
        private synchronized void captured(VideoFrame video){
            HitelPairedAvQueue.Pair<SourceFrame> pair=inFlight;inFlight=null;
            if(pair==null){notifyAll();return;}
            if(closed||queue==null||pair.turn!=turn){pair.close();notifyAll();return;}
            video.retain();
            ready=new Ready(pair,video);
            notifyAll();
        }
        // Called only by WebRTC's single audio-record thread, outside the queue lock.
        long paceSyntheticAudio(){
            final long period=10_000_000L;
            long now=System.nanoTime();
            if(nextAudioNs==0 || now-nextAudioNs>=period) nextAudioNs=now;
            while(!closed && !Thread.currentThread().isInterrupted() && now<nextAudioNs){
                LockSupport.parkNanos(nextAudioNs-now);
                now=System.nanoTime();
            }
            nextAudioNs=Math.max(nextAudioNs+period,now);
            return now;
        }
        private static short sample(byte[] data,int i){int p=i*2;return(short)((data[p]&255)|(data[p+1]<<8));}
        synchronized long audio(ByteBuffer original,int format,int channels,int rate,int size,long captureTimeNs){
            ByteBuffer buffer=original.duplicate().order(ByteOrder.LITTLE_ENDIAN);buffer.clear();
            int n=Math.min(Math.max(size,0),buffer.capacity());
            // Always wipe actual microphone contents in avatar mode, including underflow.
            for(int i=0;i<buffer.capacity();i++)buffer.put(i,(byte)0);
            long now=captureTimeNs>0?captureTimeNs:System.nanoTime();
            if(now<=lastCaptureNs)now=lastCaptureNs+10_000_000L;
            lastCaptureNs=now;
            if(!callbackReported){
                callbackReported=true;
                Log.i(TAG,"RTC_PCM_CALLBACK rate="+rate+" channels="+channels+" bytes="+n+" capacity="+buffer.capacity());
            }
            if(closed||queue==null)return now;
            if(format!=AudioFormat.ENCODING_PCM_16BIT||channels<1||rate<8000||n<=0||n%(channels*2)!=0){
                Log.e(TAG,"unsupported capture PCM format "+format+" "+channels+" "+rate+" "+n);reset();return now;
            }
            if(callbackRate!=0&&(callbackRate!=rate||callbackChannels!=channels)){reset();return now;}
            callbackRate=rate;callbackChannels=channels;
            if(playing==null&&ready!=null){
                playing=ready;ready=null;
                final Ready start=playing;start.sent=true;
                final long timestamp=now;
                if(startedCaptureNs==0)startedCaptureNs=now;
                // Video and its first audio samples use the same sender capture time.
                // Never perform GPU work or encoding on the audio callback thread.
                handler.post(()->{
                    try{
                        synchronized(Session.this){
                            if(closed||queue==null||start.pair.turn!=turn)return;
                            start.video.getBuffer().retain();
                        }
                        VideoFrame outgoing=new VideoFrame(start.video.getBuffer(),0,timestamp);
                        try{observer.onFrameCaptured(outgoing);}finally{outgoing.release();}
                    }finally{start.video.release();}
                });
                pairsSent++;notifyAll();
                if(pairsSent==1||pairsSent%25==0)Log.i(TAG,"PAIR_SENT turn="+turn+" ordinal="+start.pair.ordinal+" samples="+start.pair.startSample+" captureNs="+timestamp);
            }
            final Ready p=playing;
            if(p==null){if(++silenceBuffers%100==0)Log.i(TAG,"PAIR_WAIT silentBlocks="+silenceBuffers);return now;}
            final int sourceSamples=p.pair.pcm16.length/2;
            int rows=n/(channels*2);
            for(int i=0;i<rows;i++){
                long scaled=p.outputFrames*16000L;
                int index=(int)(scaled/rate);
                if(index>=sourceSamples)break;
                short a=sample(p.pair.pcm16,index);
                short b=sample(p.pair.pcm16,Math.min(index+1,sourceSamples-1));
                short value=(short)(a+(b-a)*(scaled%rate)/rate);
                for(int ch=0;ch<channels;ch++)buffer.putShort((i*channels+ch)*2,value);
                p.outputFrames++;
            }
            if(p.outputFrames*16000L>=sourceSamples*(long)rate){
                held.addLast(p.pair);while(held.size()>4)held.removeFirst().close();
                playing=null;notifyAll();
                if(ended&&queue.drained()&&ready==null&&inFlight==null)Log.i(TAG,"PAIR_TURN_DRAINED turn="+turn+" pairs="+pairsSent+" silentBlocks="+silenceBuffers);
            }
            return now;
        }
        private synchronized void reset(){
            if(queue!=null){queue.close();queue=null;}
            // A GPU frame already posted must be released only when captured.
            if(ready!=null){ready.video.release();ready.pair.close();ready=null;}
            if(playing!=null){playing.pair.close();playing=null;}
            while(!held.isEmpty())held.removeFirst().close();
            turn=0;ended=false;callbackRate=callbackChannels=0;
        }
        void close(){
            synchronized(this){closed=true;reset();notifyAll();}
            if(worker!=null){worker.interrupt();try{worker.join(2000);}catch(InterruptedException e){Thread.currentThread().interrupt();}}
            helper.stopListening();
            synchronized(this){if(inFlight!=null){inFlight.close();inFlight=null;}}
            surface.release();
            observer.onCapturerStopped();
        }
    }
}
