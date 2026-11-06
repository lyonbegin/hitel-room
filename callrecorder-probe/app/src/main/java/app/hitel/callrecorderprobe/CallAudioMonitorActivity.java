package app.hitel.callrecorderprobe;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.telephony.TelephonyManager;
import android.util.Log;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Foreground, user-initiated audio capability test.
 * NEVER presents a local microphone signal as actual PSTN remote audio.
 * No default dialer role, network relay, Shizuku or root required.
 */
public class CallAudioMonitorActivity extends Activity {
    private static final String TAG = "HITEL_RX_RECORD";
    private static final int RATE = 16000;
    private static final int FORMAT = AudioFormat.ENCODING_PCM_16BIT;
    private static final int MONO = AudioFormat.CHANNEL_IN_MONO;
    private static final String RELATIVE_FOLDER = "Music/HITEL_Call_Test/";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView state, file, notes, recordings;
    private volatile boolean running;
    private volatile long bytes;
    private volatile int peak;
    private volatile String sourceName = "미선택";
    private volatile String recorderState = "대기";
    private volatile String lastError = "";
    private Thread thread;
    private AudioRecord record;
    private ParcelFileDescriptor descriptor;
    private FileOutputStream out;
    private Uri pendingUri, savedUri;
    private volatile String currentName = "";
    private MediaPlayer player;
    private boolean observedCall;
    private long started;
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            int call = callState();
            if (call == TelephonyManager.CALL_STATE_OFFHOOK) observedCall = true;
            if (running && observedCall && call == TelephonyManager.CALL_STATE_IDLE) {
                stopRecording("통화 종료 감지: 자동 파일 마감");
            }
            AudioManager am = getSystemService(AudioManager.class);
            String phoneState = call == TelephonyManager.CALL_STATE_OFFHOOK ? "OFFHOOK — 통화 연결" :
                    call == TelephonyManager.CALL_STATE_RINGING ? "RINGING — 수신 중" :
                    call == TelephonyManager.CALL_STATE_IDLE ? "IDLE — 통화 없음" : "권한 없음";
            state.setText("기존 전화 앱: 변경하지 않음\n통화: " + phoneState +
                    "\n오디오 모드: " + am.getMode() + " / MODE_IN_CALL=" + AudioManager.MODE_IN_CALL +
                    "\n관측 시간: " + (started == 0 ? "0" : (SystemClock.elapsedRealtime() - started) / 1000) + "초");
            file.setText("녹음 소스: " + sourceName + "\n상태: " + recorderState +
                    "\n파일: " + (currentName.isEmpty() ? "(없음)" : currentName) +
                    "\n저장 폴더: " + RELATIVE_FOLDER + "\n파일 증가량: " + (bytes + 44) +
                    "바이트\n신호 피크: " + peak + "\n" + lastError);
            handler.postDelayed(this, 450);
        }
    };

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout root = Screen.vertical(this);
        Screen.title(this, root, "HITEL 통화 음성 검증");
        Screen.note(this, root, "기존 전화 앱에서 통화를 연결한 후 이 화면을 앞으로 가져오십시오. 기본 전화 앱은 변경하지 않습니다.");
        state = Screen.note(this, root, "");
        file = Screen.note(this, root, "");
        Screen.button(this, root, "① 실제 상대방 음성 VOICE_DOWNLINK 추출 시도").setOnClickListener(v ->
                requestAndStart(MediaRecorder.AudioSource.VOICE_DOWNLINK, "상대방 통화 음성 (권한 필요)"));
        Screen.button(this, root, "② 기기 마이크 참고 녹음 시작").setOnClickListener(v ->
                requestAndStart(MediaRecorder.AudioSource.MIC, "기기 마이크 — 상대방 음성 아님"));
        Screen.button(this, root, "녹음 종료·WAV 저장 완료").setOnClickListener(v -> stopRecording("사용자 종료"));
        Screen.button(this, root, "완료된 녹음 재생").setOnClickListener(v -> play());
        Screen.button(this, root, "재생 중지").setOnClickListener(v -> stopPlayer());
        Screen.button(this, root, "최근 파일 조회").setOnClickListener(v -> listFiles());
        recordings = Screen.note(this, root, "저장 파일: 조회 전");
        notes = Screen.note(this, root, "실제 상대방 통화 음성을 얻으려면 시스템 권한이 필요합니다. 마이크 녹음은 통화 중 음소거될 수 있으므로, 파일 크기만 늘어도 실제 음성 녹음 성공으로 판정하지 않습니다.");
        setContentView(Screen.scroll(this, root));
        started = SystemClock.elapsedRealtime();
        askPermissions();
        listFiles();
    }

    private void askPermissions() {
        if (android.os.Build.VERSION.SDK_INT >= 23) {
            java.util.ArrayList<String> needed = new java.util.ArrayList<>();
            if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.READ_PHONE_STATE);
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
                needed.add(Manifest.permission.RECORD_AUDIO);
            if (!needed.isEmpty()) requestPermissions(needed.toArray(new String[0]), 770);
        }
    }
    private int callState() {
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) return -1;
        try { return getSystemService(TelephonyManager.class).getCallState(); }
        catch (Throwable e) { return -1; }
    }
    private void requestAndStart(int source, String label) {
        if (running || thread != null && thread.isAlive()) { notes.setText("이미 진행 중입니다. 먼저 종료하십시오."); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            askPermissions(); notes.setText("녹음 권한을 허용한 다음 다시 누르십시오."); return;
        }
        sourceName = label;
        lastError = "";
        bytes = 0; peak = 0;
        observedCall = callState() == TelephonyManager.CALL_STATE_OFFHOOK;
        recorderState = "오디오 소스 생성 중";
        running = true;
        thread = new Thread(() -> runCapture(source), "hitel-call-audio-probe");
        thread.start();
    }
    private void runCapture(int source) {
        AudioRecord local = null;
        boolean created = false;
        try {
            int minimum = AudioRecord.getMinBufferSize(RATE, MONO, FORMAT);
            if (minimum <= 0) throw new IllegalStateException("Unsupported PCM format");
            local = new AudioRecord.Builder().setAudioSource(source)
                .setAudioFormat(new AudioFormat.Builder().setSampleRate(RATE)
                    .setChannelMask(MONO).setEncoding(FORMAT).build())
                .setBufferSizeInBytes(Math.max(4096, minimum)).build();
            record = local;
            if (local.getState() != AudioRecord.STATE_INITIALIZED)
                throw new IllegalStateException("AudioRecord not initialized");
            local.startRecording();
            if (local.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING)
                throw new IllegalStateException("AudioRecord refused to start");
            openWav();
            created = true;
            recorderState = source == MediaRecorder.AudioSource.MIC ? "마이크 PCM 저장 중" :
                    "VOICE_DOWNLINK PCM 요청 중 (통화 음성 여부 미검증)";
            Log.i(TAG, "CAPTURE_START source=" + source + " uri=" + pendingUri);
            byte[] buffer = new byte[1280];
            while (running) {
                int got = local.read(buffer, 0, buffer.length, AudioRecord.READ_NON_BLOCKING);
                if (got < 0) throw new IllegalStateException("AudioRecord read error=" + got);
                if (got == 0) { SystemClock.sleep(20); continue; }
                out.write(buffer, 0, got);
                bytes += got;
                for (int i = 0; i + 1 < got; i += 2) {
                    short s = (short) ((buffer[i] & 0xff) | ((buffer[i + 1] & 0xff) << 8));
                    peak = Math.max(peak, Math.abs(s));
                }
            }
        } catch (Throwable e) {
            lastError = "실패: " + e.getClass().getSimpleName() + ": " + String.valueOf(e.getMessage());
            recorderState = "오디오 추출 실패";
            Log.e(TAG, "CAPTURE_FAIL source=" + source, e);
        } finally {
            running = false;
            if (local != null) {
                try { if (local.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) local.stop(); }
                catch (Throwable ignored) {}
                local.release();
            }
            record = null;
            if (created) closeWav();
            else discardWav();
        }
    }
    private void openWav() throws Exception {
        currentName = "HITEL_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()) + ".wav";
        ContentValues values = new ContentValues();
        values.put(MediaStore.Audio.Media.DISPLAY_NAME, currentName);
        values.put(MediaStore.Audio.Media.MIME_TYPE, "audio/wav");
        values.put(MediaStore.Audio.Media.RELATIVE_PATH, RELATIVE_FOLDER);
        values.put(MediaStore.Audio.Media.IS_PENDING, 1);
        pendingUri = getContentResolver().insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values);
        if (pendingUri == null) throw new IllegalStateException("MediaStore insert returned null");
        descriptor = getContentResolver().openFileDescriptor(pendingUri, "rw");
        if (descriptor == null) throw new IllegalStateException("Cannot open MediaStore WAV");
        out = new FileOutputStream(descriptor.getFileDescriptor());
        out.write(new byte[44]);
    }
    private void closeWav() {
        Uri uri = pendingUri;
        try {
            if (out != null) {
                FileChannel channel = out.getChannel();
                channel.position(0);
                byte[] header = wavHeader(bytes);
                java.nio.ByteBuffer hdr = java.nio.ByteBuffer.wrap(header);
                while (hdr.hasRemaining()) channel.write(hdr);
                channel.force(true);
                out.close();
            }
            if (descriptor != null) descriptor.close();
            if (uri != null) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Audio.Media.IS_PENDING, 0);
                getContentResolver().update(uri, v, null, null);
                savedUri = uri;
            }
            recorderState = "WAV 저장 완료";
            Log.i(TAG, "FINALIZED bytes=" + (bytes + 44) + " pcm=" + bytes + " peak=" + peak);
            runOnUiThread(this::listFiles);
        } catch (Throwable e) {
            lastError = "파일 마감 오류: " + e.getMessage();
            Log.e(TAG, "FINALIZE_ERROR", e);
        } finally {
            out = null; descriptor = null; pendingUri = null;
        }
    }
    private void discardWav() {
        try { if (out != null) out.close(); } catch (Throwable ignored) {}
        try { if (descriptor != null) descriptor.close(); } catch (Throwable ignored) {}
        if (pendingUri != null) try { getContentResolver().delete(pendingUri, null, null); }
        catch (Throwable ignored) {}
        out = null; descriptor = null; pendingUri = null;
    }
    private static byte[] wavHeader(long length) {
        int data = (int) Math.min(length, Integer.MAX_VALUE - 44);
        ByteBuffer b = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        b.put(new byte[]{'R','I','F','F'}); b.putInt(data + 36);
        b.put(new byte[]{'W','A','V','E','f','m','t',' '});
        b.putInt(16); b.putShort((short) 1); b.putShort((short) 1);
        b.putInt(RATE); b.putInt(RATE * 2); b.putShort((short) 2); b.putShort((short) 16);
        b.put(new byte[]{'d','a','t','a'}); b.putInt(data);
        return b.array();
    }
    private void stopRecording(String reason) {
        if (!running) return;
        recorderState = reason + " — 파일 마감 중";
        running = false;
        Log.i(TAG, "STOP reason=" + reason);
    }
    private void listFiles() {
        try {
            String selection = MediaStore.Audio.Media.RELATIVE_PATH + "=?";
            String[] args = {RELATIVE_FOLDER};
            Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            try (android.database.Cursor c = getContentResolver().query(collection,
                new String[]{MediaStore.Audio.Media._ID,MediaStore.Audio.Media.DISPLAY_NAME,MediaStore.Audio.Media.SIZE},
                selection, args, MediaStore.Audio.Media.DATE_ADDED + " DESC")) {
                if (c == null || !c.moveToFirst()) { recordings.setText("완료된 WAV 없음"); return; }
                long id = c.getLong(0);
                String title = c.getString(1);
                long size = c.getLong(2);
                savedUri = android.content.ContentUris.withAppendedId(collection, id);
                recordings.setText("최근 파일: " + title + "\n크기: " + size + "바이트\n위치: " + RELATIVE_FOLDER);
            }
        } catch (Throwable e) {
            recordings.setText("파일 조회 오류: " + e.getMessage());
        }
    }
    private void play() {
        if (running || thread != null && thread.isAlive()) { notes.setText("녹음을 마친 뒤 재생하십시오."); return; }
        if (savedUri == null) listFiles();
        if (savedUri == null) { notes.setText("재생할 파일이 없습니다."); return; }
        stopPlayer();
        try {
            player = new MediaPlayer();
            player.setDataSource(this, savedUri);
            player.prepare();
            player.start();
            recorderState = "저장된 WAV 스피커 재생 중";
            Log.i(TAG, "PLAYBACK_START uri=" + savedUri);
            notes.setText("재생 시작: " + savedUri);
            player.setOnCompletionListener(m -> {
                recorderState = "재생 완료";
                Log.i(TAG, "PLAYBACK_FINISHED");
                stopPlayer();
            });
        } catch (Throwable e) {
            lastError = "WAV 재생 실패: " + e.getMessage();
            Log.e(TAG, "PLAYBACK_FAIL", e);
        }
    }
    private void stopPlayer() {
        if (player != null) { try { player.stop(); } catch(Throwable ignored) {}
            player.release(); player = null; }
    }
    @Override protected void onResume() { super.onResume(); handler.post(refresh); }
    @Override protected void onPause() { handler.removeCallbacks(refresh); super.onPause(); }
    @Override protected void onDestroy() {
        running = false;
        if (thread != null) try { thread.join(700); } catch (InterruptedException ignored) {}
        stopPlayer(); super.onDestroy();
    }
}
