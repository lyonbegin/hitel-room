package app.hitel.callnative;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.lang.reflect.Method;
import java.util.Locale;

/**
 * Samsung-specific backend based on the observed Call Assistant v15.1 DEX:
 *   l_call_translation_mode=on/off
 *   l_voice_tx_control_mode=0(normal)/1(mute)/2(down)
 *   semSetScreenCallEnabled(boolean)
 *   semAddAudioTag("VOICE_TX") / AudioTrack.write(PCM)
 *
 * This class never claims that a setParameters return proves telephony injection.
 * A Samsung platform-signed/privileged audio integration is required for that.
 */
final class SamsungAudioPath {
    private static final String TAG = "HITEL_SAMSUNG_AUDIO";
    static final int SAMPLE_RATE = 16000;
    private final AudioManager audio;
    private boolean enabled = false;
    private AudioTrack tx;
    private String state = "아직 시작하지 않았습니다.";

    SamsungAudioPath(Context context) {
        audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    }

    synchronized String probe() {
        if (!"samsung".equalsIgnoreCase(Build.MANUFACTURER)) {
            return "미지원 제조사: " + Build.MANUFACTURER + " (삼성 HAL이 아님)";
        }
        try {
            AudioAttributes.Builder.class.getMethod("semAddAudioTag", String.class);
            AudioManager.class.getMethod("semSetScreenCallEnabled", boolean.class);
        } catch (Exception e) {
            return "삼성 전용 API 없음/차단: " + e.getClass().getSimpleName();
        }
        return "삼성 API 존재 확인. 실행 권한 및 통화 주입 성공은 별도 검증 필요.";
    }

    synchronized String start() {
        String p = probe();
        if (!p.startsWith("삼성 API 존재")) return state = p;
        if (audio.getMode() != AudioManager.MODE_IN_CALL) {
            return state = "SIM 음성 통화 연결 후 실행해 주십시오. audioMode=" + audio.getMode();
        }
        try {
            // Reverse-engineered vendor controls; no replacement of Samsung packages.
            audio.setParameters("l_call_translation_mode=on");
            tx = newTaggedTrack("VOICE_TX", AudioAttributes.USAGE_VOICE_COMMUNICATION);
            tx.play();
            enabled = true;
            state = "삼성 제어값 요청 + VOICE_TX AudioTrack PLAYING; 상대방 송출은 미검증";
            Log.i(TAG, state);
        } catch (Throwable e) {
            state = "삼성 경로 시작 실패: " + e.getClass().getSimpleName() + " " + e.getMessage();
            stop();
        }
        return state;
    }

    private AudioTrack newTaggedTrack(String tag, int usage) throws Exception {
        AudioAttributes.Builder attrs = new AudioAttributes.Builder()
                .setUsage(usage).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH);
        Method m = AudioAttributes.Builder.class.getMethod("semAddAudioTag", String.class);
        m.invoke(attrs, tag);
        AudioFormat fmt = new AudioFormat.Builder().setSampleRate(SAMPLE_RATE)
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
        int minimum = AudioTrack.getMinBufferSize(SAMPLE_RATE,
                AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minimum <= 0) throw new IllegalStateException("invalid track buffer " + minimum);
        AudioTrack track = new AudioTrack.Builder().setAudioAttributes(attrs.build())
                .setAudioFormat(fmt)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(Math.max(minimum, 3200)).build();
        if (track.getState() != AudioTrack.STATE_INITIALIZED) {
            track.release(); throw new IllegalStateException("VOICE_TX AudioTrack not initialized");
        }
        return track;
    }

    synchronized String setTxMode(int code) {
        if (!enabled) return state = "먼저 삼성 경로를 시작하십시오.";
        if (code < 0 || code > 2) return "유효하지 않은 송신 제어 모드";
        try {
            audio.setParameters("l_voice_tx_control_mode=" + code);
            return state = "삼성 송신 제어값 " + code + " 요청 완료 (HAL 반영 미검증)";
        } catch (Throwable e) { return state = "송신 제어 실패: " + e.getMessage(); }
    }

    synchronized String playTone() {
        if (!enabled || tx == null) return "삼성 음성 경로가 아직 열리지 않았습니다.";
        final AudioTrack track = tx;
        new Thread(() -> {
            try {
                // Deterministic 800Hz PCM test signal; not an AI-generated speech claim.
                byte[] frame = new byte[640];
                for (int k = 0; k < 35; k++) {
                    for (int i = 0; i < frame.length / 2; i++) {
                        double t = (k * 320 + i) * 1.0 / SAMPLE_RATE;
                        short v = (short) (Math.sin(t * Math.PI * 2 * 800) * 4600);
                        frame[i * 2] = (byte) (v & 255);
                        frame[i * 2 + 1] = (byte) ((v >>> 8) & 255);
                    }
                    int written = track.write(frame, 0, frame.length, AudioTrack.WRITE_BLOCKING);
                    if (written < frame.length) throw new IllegalStateException("short write " + written);
                }
                Log.i(TAG, "VOICE_TX wrote 1.4 seconds PCM; REMOTE AUDIBILITY NOT VERIFIED");
            } catch (Throwable t) { Log.e(TAG, "VOICE_TX write failed", t); }
        }, "samsung-tx-test").start();
        return state = "VOICE_TX 테스트 PCM 전송 요청. 상대방 청취 여부를 반드시 검증하십시오.";
    }

    synchronized String getStatus() { return state; }

    synchronized String stop() {
        // Restore normal mic transmission even if a setup step failed.
        try { audio.setParameters("l_voice_tx_control_mode=0"); }
        catch (Throwable e) { Log.w(TAG, "TX normal restore failed", e); }
        try { audio.setParameters("l_call_translation_mode=off"); }
        catch (Throwable e) { Log.w(TAG, "translate mode restore failed", e); }
        if (tx != null) {
            try { tx.pause(); tx.flush(); tx.release(); }
            catch (Throwable e) { Log.w(TAG, "AudioTrack release", e); }
            tx = null;
        }
        enabled = false;
        state = "삼성 경로 종료, 일반 음성 모드 복원 요청";
        return state;
    }
}
