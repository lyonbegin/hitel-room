package app.hitel.callnative;

import android.content.Context;
import android.content.ContextWrapper;
import android.media.AudioManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.MediaRecorder;
import android.os.Binder;
import android.os.Build;
import android.os.Parcel;
import android.os.ParcelFileDescriptor;
import android.os.Parcelable;
import android.os.Process;
import android.os.RemoteException;
import android.util.Log;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.lang.reflect.Method;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Runs in a Shizuku UserService uid=2000 or root.
 * No network, SIP, PBX, cloud, or disk recording.
 * Independent from SamsungAudioPath.
 * See upstream reference: sparkcyf/android-voice-sip-agent CallAudioTap.kt.
 */
public final class ShellAudioService extends Binder {
    public static final String DESCRIPTOR = "app.hitel.callnative.ShellAudioService";
    public static final int PING = 1;
    public static final int START = 2;
    public static final int STOP = 3;
    public static final int STATUS = 4;
    public static final int METHOD_OFFICIAL = 0;
    public static final int METHOD_DIRECT = 1;
    private static final String TAG = "HITEL_ANDROID_PCM";
    private static final int RATE = 16000;
    private static final int FRAME = 640;

    private final Context ctx;
    private final int ownerUid;
    private final AudioManager audio;
    private AudioRecord down;
    private AudioTrack up;
    private ParcelFileDescriptor shellEnd;
    private AtomicBoolean running = new AtomicBoolean(false);
    private Thread reader;
    private Thread writer;
    private long capturedFrames = 0;
    private long injectedFrames = 0;
    private int peakLevel = 0;
    private String status = "대기";

    // Shizuku API v13 creates a UserService with a Context constructor.
    public ShellAudioService(Context context) throws Exception {
        ownerUid = context.getApplicationInfo().uid;
        ctx = context;
        audio = makeAudioManager(context);
        Log.i(TAG, "Shizuku UserService uid=" + Process.myUid() + " appUid=" + ownerUid);
    }
    public ShellAudioService() throws Exception {
        this(resolveContext());
    }
    private static Context resolveContext() throws Exception {
        Class<?> at = Class.forName("android.app.ActivityThread");
        Object thread = at.getMethod("systemMain").invoke(null);
        return (Context) at.getMethod("getSystemContext").invoke(thread);
    }
    private AudioManager makeAudioManager(Context appContext) throws Exception {
        // Shizuku service owns uid=2000, never impersonates a different Android app UID.
        Context sys = resolveContext();
        Context attributed = new ContextWrapper(sys) {
            @Override public String getPackageName() { return "com.android.shell"; }
            @Override public String getOpPackageName() { return "com.android.shell"; }
            @Override public Context getApplicationContext() { return this; }
        };
        java.lang.reflect.Constructor<AudioManager> constructor = AudioManager.class.getDeclaredConstructor(Context.class);
        constructor.setAccessible(true);
        return constructor.newInstance(attributed);
    }

    public void destroy() {
        stopAudio();
        System.exit(0);
    }

    @Override protected boolean onTransact(int code, Parcel data, Parcel reply, int flags) throws RemoteException {
        if (code == INTERFACE_TRANSACTION) { reply.writeString(DESCRIPTOR); return true; }
        if (Binder.getCallingUid() != ownerUid && Binder.getCallingUid() != Process.myUid()) {
            throw new SecurityException("Unauthorized calling UID " + Binder.getCallingUid());
        }
        try {
            switch (code) {
                case PING:
                    reply.writeNoException();
                    reply.writeString("shell uid=" + Process.myUid() + ", audioMode=" + audio.getMode()
                            + ", sdk=" + Build.VERSION.SDK_INT);
                    return true;
                case START:
                    int method = data.readInt();
                    ParcelFileDescriptor pfd = startAudio(method);
                    reply.writeNoException();
                    reply.writeString(status);
                    reply.writeParcelable(pfd, Parcelable.PARCELABLE_WRITE_RETURN_VALUE);
                    pfd.close();
                    return true;
                case STOP:
                    stopAudio();
                    reply.writeNoException();
                    reply.writeString(status);
                    return true;
                case STATUS:
                    reply.writeNoException();
                    reply.writeString(status + " down=" + capturedFrames + " up=" + injectedFrames + " peak=" + peakLevel);
                    return true;
                default: return super.onTransact(code, data, reply, flags);
            }
        } catch (Throwable t) {
            status = "오디오 경로 실패: " + t.getClass().getSimpleName() + " " + t.getMessage();
            Log.e(TAG, status, t);
            reply.writeException(new IllegalStateException(status));
            return true;
        }
    }

    private static AudioFormat format(int channel) {
        return new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(RATE).setChannelMask(channel).build();
    }

    private synchronized ParcelFileDescriptor startAudio(int method) throws Exception {
        stopAudio();
        if (Process.myUid() != 2000 && Process.myUid() != 0)
            throw new SecurityException("Shizuku shell/root uid required");
        if (audio.getMode() != AudioManager.MODE_IN_CALL && audio.getMode() != 5)
            throw new IllegalStateException("No cellular phone call; audio mode=" + audio.getMode());
        if (method != METHOD_OFFICIAL && method != METHOD_DIRECT)
            throw new IllegalArgumentException("Invalid route selection");
        try {
            if (method == METHOD_OFFICIAL) startOfficialAudio();
            else startDirectAudio();
            if (down.getState() != AudioRecord.STATE_INITIALIZED || up.getState() != AudioTrack.STATE_INITIALIZED)
                throw new IllegalStateException("PCM record / playback not initialized");
            ParcelFileDescriptor[] pair = ParcelFileDescriptor.createSocketPair();
            shellEnd = pair[0];
            ParcelFileDescriptor client = pair[1];
            down.startRecording();
            up.play();
            running.set(true);
            capturedFrames = 0; injectedFrames = 0; peakLevel = 0;
            startThreads(shellEnd);
            status = (method == METHOD_OFFICIAL ? "AOSP" : "VOICE_DOWNLINK")
                + ": PCM 파이프 시작 (상대 음성 확보·송신 청취는 별도 검증)";
            return client;
        } catch (Throwable error) {
            stopAudio();
            if (error instanceof Exception) throw (Exception) error;
            throw new IllegalStateException(error);
        }
    }

    private void startOfficialAudio() throws Exception {
        if (Build.VERSION.SDK_INT < 33) throw new IllegalStateException("AOSP redirection requires API 33+");
        Method rec = AudioManager.class.getMethod("getCallDownlinkExtractionAudioRecord", AudioFormat.class);
        Method trk = AudioManager.class.getMethod("getCallUplinkInjectionAudioTrack", AudioFormat.class);
        down = (AudioRecord) rec.invoke(audio, format(AudioFormat.CHANNEL_IN_MONO));
        up = (AudioTrack) trk.invoke(audio, format(AudioFormat.CHANNEL_OUT_MONO));
        if (down == null || up == null) throw new IllegalStateException("AOSP returned null PCM interface");
    }

    private void startDirectAudio() throws Exception {
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (min <= 0) throw new IllegalStateException("Unsupported downlink PCM format");
        down = new AudioRecord.Builder().setAudioSource(MediaRecorder.AudioSource.VOICE_DOWNLINK)
                .setAudioFormat(format(AudioFormat.CHANNEL_IN_MONO))
                .setBufferSizeInBytes(Math.max(min, FRAME * 10)).build();
        int trackMin = AudioTrack.getMinBufferSize(RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (trackMin <= 0) throw new IllegalStateException("Unsupported uplink PCM format");
        up = new AudioTrack.Builder()
                .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(format(AudioFormat.CHANNEL_OUT_MONO))
                .setBufferSizeInBytes(Math.max(trackMin, FRAME * 10))
                .setTransferMode(AudioTrack.MODE_STREAM).build();
        AudioDeviceInfo tel = null;
        for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            if (device.getType() == AudioDeviceInfo.TYPE_TELEPHONY) { tel = device; break; }
        }
        if (tel == null || !up.setPreferredDevice(tel))
            throw new IllegalStateException("TYPE_TELEPHONY output unavailable or rejected");
    }

    private void startThreads(ParcelFileDescriptor end) {
        FileInputStream incoming = new FileInputStream(end.getFileDescriptor());
        FileOutputStream outgoing = new FileOutputStream(end.getFileDescriptor());
        reader = new Thread(() -> {
            byte[] chunk = new byte[FRAME];
            try {
                while (running.get()) {
                    int offset = 0;
                    while (offset < FRAME && running.get()) {
                        int count = down.read(chunk, offset, FRAME - offset, AudioRecord.READ_BLOCKING);
                        if (count <= 0) throw new IllegalStateException("downlink read=" + count);
                        offset += count;
                    }
                    if (!running.get()) break;
                    // Fixed 20ms PCM frames for a local-only app↔shell socket.
                    outgoing.write(chunk, 0, FRAME);
                    capturedFrames++;
                    for (int i = 0; i < FRAME; i += 2) {
                        int sample = (short) ((chunk[i] & 255) | (chunk[i + 1] << 8));
                        peakLevel = Math.max(peakLevel, Math.abs(sample));
                    }
                }
            } catch (Throwable e) {
                if (running.get()) { status = "Downlink 끊김: " + e.getMessage(); Log.w(TAG, status); }
            } finally { stopAudio(); }
        }, "hitel-downlink");
        writer = new Thread(() -> {
            byte[] chunk = new byte[FRAME];
            try {
                while (running.get()) {
                    int offset = 0;
                    while (offset < FRAME && running.get()) {
                        int got = incoming.read(chunk, offset, FRAME - offset);
                        if (got <= 0) throw new IllegalStateException("uplink socket closed");
                        offset += got;
                    }
                    int position = 0;
                    while (position < FRAME && running.get()) {
                        int written = up.write(chunk, position, FRAME - position, AudioTrack.WRITE_BLOCKING);
                        if (written <= 0) throw new IllegalStateException("uplink write=" + written);
                        position += written;
                    }
                    injectedFrames++;
                }
            } catch (Throwable e) {
                if (running.get()) { status = "Uplink 끊김: " + e.getMessage(); Log.w(TAG, status); }
            } finally { stopAudio(); }
        }, "hitel-uplink");
        reader.start(); writer.start();
    }

    private synchronized void stopAudio() {
        running.set(false);
        if (shellEnd != null) { try { shellEnd.close(); } catch (Exception ignored){} shellEnd = null; }
        if (down != null) {
            try { down.stop(); } catch (Exception ignored){}
            try { down.release(); } catch (Exception ignored){} down = null;
        }
        if (up != null) {
            try { up.pause(); up.flush(); up.release(); } catch (Exception ignored){} up = null;
        }
        status = "Android PCM 경로 중단 · 오디오 객체 해제";
    }
}
