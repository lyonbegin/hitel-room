package app.hitel.callnative;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.telephony.TelephonyManager;
import android.util.Log;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Independent evidence-based test for remote PSTN PCM extraction.
 *
 * Does not use the microphone or playback capture as a stand-in for the far end.
 * Even initialized AudioRecord and nonzero PCM do not prove attribution to the caller.
 * No audio is saved, exported or transmitted.
 */
public final class CallAudioProbeActivity extends Activity {
    private static final String TAG = "HITEL_RX_PROBE";
    private static final String PRIVILEGED = "android.permission.CAPTURE_AUDIO_OUTPUT";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextView output;
    private final StringBuilder history = new StringBuilder();
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout p = Screen.vertical(this);
        Screen.title(this, p, "실제 상대방 통화 음성 추출 검사");
        Screen.note(this, p, "삼성 전용 코드, Shizuku, 루팅, 중계 서버 없이 일반 Android APK의 실제 권한과 음성 캡처 API를 검사합니다.");
        output = Screen.note(this, p, "검사 대기");
        Screen.button(this, p, "VOICE_DOWNLINK 추출 시도").setOnClickListener(v -> runProbe(MediaRecorder.AudioSource.VOICE_DOWNLINK));
        Screen.button(this, p, "VOICE_CALL 양방향 추출 시도").setOnClickListener(v -> runProbe(MediaRecorder.AudioSource.VOICE_CALL));
        Screen.button(this, p, "AOSP 시스템 통화 음성 API 확인").setOnClickListener(v -> checkSystemApi());
        Screen.button(this, p, "AOSP 다운링크 추출 실제 호출").setOnClickListener(v -> trySystemExtraction());
        Screen.note(this, p, "합격 기준: 실제 상대방이 말하는 기준 음원을 확보하여 통화 수신 PCM과 일치하는지 확인해야 합니다. 단순 통화 연결·오디오 객체 초기화·마이크 음성은 합격 처리하지 않습니다.");
        setContentView(Screen.scroll(this, p));
        checkSystemApi();
    }
    private void append(String event) {
        Log.i(TAG, event);
        runOnUiThread(() -> {
            history.insert(0, event + "\n");
            if (history.length() > 6500) history.setLength(6500);
            output.setText(history.toString());
        });
    }
    private void checkSystemApi() {
        executor.execute(() -> {
            AudioManager audio = getSystemService(AudioManager.class);
            int privilege = checkSelfPermission(PRIVILEGED);
            int mic = checkSelfPermission(Manifest.permission.RECORD_AUDIO);
            append("PERMISSION capture_audio_output=" + (privilege == PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED")
                    + " record_audio=" + (mic == PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
            append("AUDIO_MODE " + audio.getMode() + " (MODE_IN_CALL=" + AudioManager.MODE_IN_CALL + ")");
            try {
                Method m = AudioManager.class.getMethod("getCallDownlinkExtractionAudioRecord", AudioFormat.class);
                append("SYSTEM_API present=getCallDownlinkExtractionAudioRecord, access still requires CALL_AUDIO_INTERCEPTION");
            } catch (Throwable e) {
                append("SYSTEM_API unavailable=" + e.getClass().getSimpleName() + " (not a public third-party interface)");
            }
        });
    }
    private void trySystemExtraction() {
        executor.execute(() -> {
            AudioRecord record = null;
            append("ATTEMPT source=AOSP_DOWNLINK mode=" + getSystemService(AudioManager.class).getMode()
                    + " call_audio_interception_permission="
                    + (checkSelfPermission("android.permission.CALL_AUDIO_INTERCEPTION") == PackageManager.PERMISSION_GRANTED
                        ? "GRANTED" : "DENIED"));
            try {
                Method method = AudioManager.class.getMethod("getCallDownlinkExtractionAudioRecord", AudioFormat.class);
                AudioFormat format = new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(16000).setChannelMask(AudioFormat.CHANNEL_IN_MONO).build();
                record = (AudioRecord) method.invoke(getSystemService(AudioManager.class), format);
                if (record == null || record.getState() != AudioRecord.STATE_INITIALIZED) {
                    append("RESULT=UNAVAILABLE source=AOSP_DOWNLINK status=not_initialized");
                } else {
                    append("RESULT=PCM_UNATTRIBUTED source=AOSP_DOWNLINK status=initialized REMOTE_VOICE_VERIFIED=false");
                }
            } catch (InvocationTargetException e) {
                Throwable cause = e.getCause() != null ? e.getCause() : e;
                append("RESULT=DENIED_OR_UNAVAILABLE source=AOSP_DOWNLINK exception="
                        + cause.getClass().getSimpleName() + " message=" + safe(cause.getMessage()));
            } catch (Throwable e) {
                append("RESULT=DENIED_OR_UNAVAILABLE source=AOSP_DOWNLINK exception="
                        + e.getClass().getSimpleName() + " message=" + safe(e.getMessage()));
            } finally {
                if (record != null) try { record.release(); } catch (Throwable ignored) {}
                append("RELEASED source=AOSP_DOWNLINK");
            }
        });
    }
    private void runProbe(int source) {
        executor.execute(() -> capture(source));
    }
    private void capture(int source) {
        String name = source == MediaRecorder.AudioSource.VOICE_DOWNLINK ? "VOICE_DOWNLINK" : "VOICE_CALL";
        int mode = getSystemService(AudioManager.class).getMode();
        append("ATTEMPT source=" + name + " source_code=" + source + " mode=" + mode
                + " capture_output_permission=" + (checkSelfPermission(PRIVILEGED) == PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
        AudioRecord record = null;
        try {
            int rate = 16000;
            int min = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) throw new IllegalStateException("AudioRecord format unsupported: " + min);
            record = new AudioRecord.Builder()
                .setAudioSource(source)
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(rate)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
                .setBufferSizeInBytes(Math.max(4096, min)).build();
            if (record.getState() != AudioRecord.STATE_INITIALIZED) {
                append("RESULT=UNAVAILABLE source=" + name + " initialized=false");
                return;
            }
            record.startRecording();
            if (record.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                append("RESULT=UNAVAILABLE source=" + name + " startRecording failed");
                return;
            }
            byte[] frame = new byte[640];
            long deadline = android.os.SystemClock.elapsedRealtime() + 1000;
            int positiveReads = 0, nonzeroSamples = 0, bytes = 0;
            while (android.os.SystemClock.elapsedRealtime() < deadline && positiveReads < 50) {
                int n = record.read(frame, 0, frame.length, AudioRecord.READ_NON_BLOCKING);
                if (n < 0) { append("AUDIO_READ error=" + n); break; }
                if (n == 0) { android.os.SystemClock.sleep(20); continue; }
                positiveReads++; bytes += n;
                for (int i = 0; i + 1 < n; i += 2) if ((frame[i] | frame[i + 1]) != 0) nonzeroSamples++;
            }
            // Must never conclude remote capture from local PCM alone.
            append("RESULT=PCM_UNATTRIBUTED source=" + name + " bytes=" + bytes
                    + " samples_nonzero=" + nonzeroSamples + " REMOTE_VOICE_VERIFIED=false");
        } catch (SecurityException e) {
            append("RESULT=SECURITY_DENIED source=" + name + " exception=" + e.getClass().getSimpleName() + " message=" + safe(e.getMessage()));
        } catch (Throwable e) {
            append("RESULT=UNAVAILABLE source=" + name + " exception=" + e.getClass().getSimpleName() + " message=" + safe(e.getMessage()));
        } finally {
            if (record != null) {
                try { if (record.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) record.stop(); }
                catch (Throwable ignored) {}
                try { record.release(); } catch (Throwable ignored) {}
            }
            append("RELEASED source=" + name);
        }
    }
    private static String safe(String s) { return s == null ? "none" : s.replace('\n', ' ').replace('\r', ' ').substring(0, Math.min(160, s.length())); }
    @Override protected void onDestroy() { executor.shutdownNow(); super.onDestroy(); }
}
