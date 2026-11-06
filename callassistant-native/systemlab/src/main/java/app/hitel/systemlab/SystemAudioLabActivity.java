package app.hitel.systemlab;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioTrack;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * Explicit system-integration test. Never stores or uploads incoming audio.
 * PCM returned in an emulator is NOT proof of an actual cellular caller.
 */
public final class SystemAudioLabActivity extends Activity {
    private static final String TAG = "HITEL_SYS_AUDIO";
    private final StringBuilder lines = new StringBuilder();
    private AudioManager audio;
    private TextView output;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        audio = getSystemService(AudioManager.class);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(22, 22, 22, 22);
        TextView title = new TextView(this);
        title.setText("HITEL 시스템 오디오 검증");
        title.setTextSize(24);
        root.addView(title);
        output = new TextView(this);
        root.addView(output);
        addButton(root, "권한 및 현재 통화 상태", this::permissions);
        addButton(root, "VOICE_DOWNLINK 추출", this::directDownlink);
        addButton(root, "AOSP Downlink 추출", this::aospDownlink);
        addButton(root, "AOSP Uplink 시험 PCM 주입", this::aospUplink);
        addButton(root, "전체 검증", this::runAll);
        ScrollView scroller = new ScrollView(this);
        scroller.addView(root);
        setContentView(scroller);
        if (getIntent().getBooleanExtra("run_all", false)) runWorker(this::runAll);
    }
    private void addButton(LinearLayout root, String label, Runnable callback) {
        Button button = new Button(this);
        button.setText(label);
        root.addView(button);
        button.setOnClickListener(v -> runWorker(callback));
    }
    private void runWorker(Runnable work) {
        new Thread(work, "system-audio-check").start();
    }
    private synchronized void log(String msg) {
        Log.i(TAG, msg);
        lines.append(msg).append('\n');
        runOnUiThread(() -> output.setText(lines.toString()));
    }
    private static AudioFormat fmt(int mask) {
        return new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(16000).setChannelMask(mask).build();
    }
    private static String failure(Throwable x) {
        Throwable cause = (x instanceof InvocationTargetException && x.getCause() != null) ? x.getCause() : x;
        String m = String.valueOf(cause.getMessage()).replace('\n', ' ');
        return cause.getClass().getSimpleName() + " " + m.substring(0, Math.min(150, m.length()));
    }
    private void permissions() {
        for (String n : new String[] {"CAPTURE_AUDIO_OUTPUT", "CALL_AUDIO_INTERCEPTION",
                "MODIFY_AUDIO_ROUTING", "MODIFY_PHONE_STATE", "RECORD_AUDIO"}) {
            int state = checkSelfPermission("android.permission." + n);
            log("PERMISSION " + n + "=" + (state == PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
        }
        log("CALL_AUDIO_MODE=" + audio.getMode() + " MODE_IN_CALL=" + AudioManager.MODE_IN_CALL);
        byte[] testPcm = PcmPipeline.tone(200, 800);
        log("SYNTHETIC_PCM bytes=" + testPcm.length + " peak=" + PcmPipeline.peak(testPcm, testPcm.length));
    }
    private void receive(AudioRecord record, String route) {
        if (record == null || record.getState() != AudioRecord.STATE_INITIALIZED) {
            log("RESULT " + route + "=UNINITIALIZED"); return;
        }
        try {
            record.startRecording();
            byte[] buf = new byte[640];
            long limit = SystemClock.elapsedRealtime() + 700;
            int total = 0, peak = 0;
            while (SystemClock.elapsedRealtime() < limit) {
                int n = record.read(buf, 0, buf.length, AudioRecord.READ_NON_BLOCKING);
                if (n < 0) throw new IllegalStateException("read=" + n);
                if (n == 0) { SystemClock.sleep(20); continue; }
                total += n;
                peak = Math.max(peak, PcmPipeline.peak(buf, n));
            }
            log("RESULT " + route + "=PCM bytes=" + total + " peak=" + peak + " REMOTE_VERIFIED=false");
        } catch (Throwable e) {
            log("RESULT " + route + "=FAIL " + failure(e));
        } finally {
            try { record.stop(); } catch (Throwable ignored) {}
        }
    }
    private void directDownlink() {
        AudioRecord r = null;
        log("ATTEMPT DIRECT_DOWNLINK");
        try {
            int min = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) throw new IllegalStateException("minBuffer=" + min);
            r = new AudioRecord.Builder()
                .setAudioSource(MediaRecorder.AudioSource.VOICE_DOWNLINK)
                .setAudioFormat(fmt(AudioFormat.CHANNEL_IN_MONO))
                .setBufferSizeInBytes(Math.max(4096, min)).build();
            receive(r, "DIRECT_DOWNLINK");
        } catch (Throwable e) {
            log("RESULT DIRECT_DOWNLINK=FAIL " + failure(e));
        } finally { if (r != null) r.release(); }
    }
    private void aospDownlink() {
        AudioRecord r = null;
        log("ATTEMPT AOSP_DOWNLINK");
        try {
            Method m = AudioManager.class.getMethod("getCallDownlinkExtractionAudioRecord", AudioFormat.class);
            r = (AudioRecord) m.invoke(audio, fmt(AudioFormat.CHANNEL_IN_MONO));
            receive(r, "AOSP_DOWNLINK");
        } catch (Throwable e) {
            log("RESULT AOSP_DOWNLINK=FAIL " + failure(e));
        } finally { if (r != null) r.release(); }
    }
    private void aospUplink() {
        AudioTrack track = null;
        log("ATTEMPT AOSP_UPLINK");
        try {
            Method m = AudioManager.class.getMethod("getCallUplinkInjectionAudioTrack", AudioFormat.class);
            track = (AudioTrack) m.invoke(audio, fmt(AudioFormat.CHANNEL_OUT_MONO));
            if (track == null || track.getState() != AudioTrack.STATE_INITIALIZED) {
                log("RESULT AOSP_UPLINK=UNINITIALIZED"); return;
            }
            track.play();
            byte[] pcm = PcmPipeline.tone(180, 800);
            int offset = 0;
            while (offset < pcm.length) {
                int n = track.write(pcm, offset, pcm.length - offset, AudioTrack.WRITE_BLOCKING);
                if (n <= 0) throw new IllegalStateException("track.write=" + n);
                offset += n;
            }
            log("RESULT AOSP_UPLINK=PCM_WRITTEN bytes=" + offset + " REMOTE_HEARD_VERIFIED=false");
        } catch (Throwable e) {
            log("RESULT AOSP_UPLINK=FAIL " + failure(e));
        } finally {
            if (track != null) {
                try { track.pause(); } catch (Throwable ignored) {}
                track.release();
            }
        }
    }
    private void runAll() {
        log("LAB_BEGIN");
        permissions();
        directDownlink();
        aospDownlink();
        aospUplink();
        log("LAB_COMPLETE real_sim_audio_not_verified");
    }
}
