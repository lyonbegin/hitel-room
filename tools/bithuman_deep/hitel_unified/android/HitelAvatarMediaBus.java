package com.cloudwebrtc.webrtc;

import ai.hitel.media.HitelRtcPcm;
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
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.LockSupport;
import org.webrtc.CapturerObserver;
import org.webrtc.SurfaceTextureHelper;
import org.webrtc.VideoFrame;
import org.webrtc.audio.JavaAudioDeviceModule;

public final class HitelAvatarMediaBus {
    private static final String TAG = "HITEL_RTC_AV";
    private static final AtomicReference<Session> active = new AtomicReference<>();
    private static volatile JavaAudioDeviceModule adm;
    private HitelAvatarMediaBus() {}
    static void setAudioDevice(JavaAudioDeviceModule module) { adm = module; }

    static Session open(SurfaceTextureHelper helper, CapturerObserver observer, int w, int h) {
        Session s = new Session(helper, observer, w, h);
        if (!active.compareAndSet(null, s)) {
            s.surface.release();
            throw new IllegalStateException("Avatar source already open");
        }
        try {
            if (adm == null) throw new IllegalStateException("WebRTC audio device unavailable");
            adm.setAudioRecordEnabled(false);
            helper.startListening(s::captured);
            observer.onCapturerStarted(true);
            return s;
        } catch (RuntimeException e) {
            close(s);
            throw e;
        }
    }

    static void close(Session s) {
        if (active.get() != s) return;
        s.stop();
        if (active.compareAndSet(s, null) && adm != null) adm.setAudioRecordEnabled(true);
    }

    public static boolean enabled() { return active.get() != null; }
    public static boolean begin(long t) {
        Session s = active.get();
        if (s == null) return false;
        synchronized (s) {
            if (s.closed) return false;
            s.clearTurn();
            s.turn = t;
            s.beganNs = System.nanoTime();
            return true;
        }
    }
    public static void cancel(long t) {
        Session s = active.get();
        if (s != null) synchronized (s) { if (s.turn == t) s.clearTurn(); }
    }
    public static boolean append(long t, byte[] pcm) {
        Session s = active.get();
        if (s == null) return false;
        synchronized (s) {
            if (s.closed || s.turn != t) return false;
            s.pcm.append(pcm);
            return true;
        }
    }
    public static void end(long t, long samples) {
        Session s = active.get();
        if (s != null) synchronized (s) {
            if (s.turn == t) { s.expected = samples; s.reportDrained(); }
        }
    }
    public static long consumed(long t) {
        Session s = active.get();
        if (s == null) return -1;
        synchronized (s) { return !s.closed && s.turn == t ? s.pcm.position() : -1; }
    }
    /** Consumes ownership on every path. Only the newest waiting bitmap is useful. */
    public static void frame(long t, Bitmap bitmap, Runnable release) {
        Session s = active.get();
        if (s == null) { release.run(); return; }
        Frame old;
        synchronized (s) {
            if (s.closed || s.turn != t) { release.run(); return; }
            old = s.pending;
            s.pending = new Frame(t, bitmap, release);
            s.scheduleDraw();
        }
        if (old != null) old.release.run();
    }

    public static long onAudioBuffer(ByteBuffer buffer, int format, int channels, int rate,
                                     int size, long captureTimeNs) {
        Session s = active.get();
        if (s == null) return captureTimeNs;
        long now = size == 0 ? s.pace() : captureTimeNs;
        synchronized (s) {
            long before = s.pcm.position();
            s.pcm.read(buffer, format == AudioFormat.ENCODING_PCM_16BIT ? rate : 0, channels);
            if (before == 0 && s.pcm.position() > 0)
                Log.i(TAG, "RTC_PCM_FIRST turn=" + s.turn + " latencyMs=" + (System.nanoTime()-s.beganNs)/1000000);
            s.reportDrained();
        }
        return now > 0 ? now : System.nanoTime();
    }

    private static final class Frame {
        final long turn;
        final Bitmap bitmap;
        final Runnable release;
        Frame(long t, Bitmap b, Runnable r) { turn = t; bitmap = b; release = r; }
    }

    static final class Session {
        final HitelRtcPcm pcm = new HitelRtcPcm();
        final SurfaceTextureHelper helper;
        final CapturerObserver observer;
        final Handler handler;
        final Surface surface;
        final int width, height;
        final Rect dst = new Rect();
        final Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG);
        long turn, beganNs, nextAudioNs;
        long expected = -1;
        boolean posted;
        volatile boolean closed;
        Frame pending, submitted;
        int sent;
        Session(SurfaceTextureHelper h, CapturerObserver o, int w, int ht) {
            helper = h; observer = o; handler = h.getHandler(); width = w; height = ht;
            h.setTextureSize(w,ht);
            surface = new Surface(h.getSurfaceTexture());
        }
        long pace() {
            final long period = 10_000_000L;
            long now = System.nanoTime();
            if (nextAudioNs == 0 || now - nextAudioNs >= period) nextAudioNs = now;
            while (!closed && !Thread.currentThread().isInterrupted() && now < nextAudioNs) {
                LockSupport.parkNanos(nextAudioNs - now);
                now = System.nanoTime();
            }
            nextAudioNs += period;
            return now;
        }
        // All Canvas and SurfaceTexture work is serialized on the EGL handler.
        void scheduleDraw() {
            if (!closed && !posted && submitted == null && pending != null)
                posted = handler.post(this::draw);
        }
        void draw() {
            Frame f;
            synchronized (this) {
                posted = false;
                if (closed || pending == null || submitted != null) return;
                f = submitted = pending; pending = null;
            }
            long begin = System.nanoTime();
            try {
                Canvas c = surface.lockHardwareCanvas();
                try {
                    Bitmap b = f.bitmap;
                    float scale = Math.min(width/(float)b.getWidth(), height/(float)b.getHeight());
                    int w = Math.round(b.getWidth()*scale), h = Math.round(b.getHeight()*scale);
                    int x = (width-w)/2, y = (height-h)/2;
                    dst.set(x,y,x+w,y+h);
                    if (w != width || h != height) c.drawColor(Color.BLACK);
                    c.drawBitmap(b, null, dst, paint);
                } finally { surface.unlockCanvasAndPost(c); }
                if (sent % 25 == 0)
                    Log.i(TAG,"RTC_CANVAS turn="+f.turn+" submitUs="+(System.nanoTime()-begin)/1000);
            } catch (RuntimeException e) {
                synchronized (this) { submitted = null; scheduleDraw(); }
                f.release.run();
                Log.e(TAG, "RTC_CANVAS_ERROR", e);
            }
        }
        void captured(VideoFrame v) {
            Frame f;
            boolean deliver;
            synchronized (this) {
                f = submitted;
                deliver = f != null && f.turn == turn && !closed;
            }
            if (f == null) return;
            try {
                if (deliver) {
                    observer.onFrameCaptured(v);
                    if (++sent == 1) Log.i(TAG, "RTC_VIDEO_FIRST turn="+f.turn);
                }
            } finally {
                f.release.run();
                synchronized (this) { submitted = null; scheduleDraw(); }
            }
        }
        void reportDrained() {
            if (expected > 0 && pcm.position() == expected) {
                Log.i(TAG, "RTC_PCM_DRAINED turn=" + turn + " samples=" + expected
                    + " elapsedMs=" + (System.nanoTime()-beganNs)/1000000);
                expected = -1;
            }
        }
        void clearTurn() {
            expected = -1;
            turn = 0;
            pcm.clear();
            if (pending != null) { pending.release.run(); pending = null; }
        }
        void stop() {
            synchronized (this) { if (closed) return; closed = true; clearTurn(); }
            helper.stopListening();
            org.webrtc.ThreadUtils.invokeAtFrontUninterruptibly(handler, () -> {
                if (submitted != null) { submitted.release.run(); submitted = null; }
                surface.release();
            });
            observer.onCapturerStopped();
        }
    }
}
