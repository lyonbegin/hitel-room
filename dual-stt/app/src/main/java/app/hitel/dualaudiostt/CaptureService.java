package app.hitel.dualaudiostt;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

/** User-visible foreground capture service: microphone and permitted MEDIA audio only. */
public final class CaptureService extends Service implements KoreanStreamAsr.Listener {
    public static final String ACTION_START_MIC = "app.hitel.dual.START_MIC";
    public static final String ACTION_STOP_MIC = "app.hitel.dual.STOP_MIC";
    public static final String ACTION_START_PLAYBACK = "app.hitel.dual.START_PLAYBACK";
    public static final String ACTION_STOP_PLAYBACK = "app.hitel.dual.STOP_PLAYBACK";
    public static final String ACTION_EVENT = "app.hitel.dual.STT_EVENT";
    public static final String EXTRA_EVENT = "event";
    public static final String EXTRA_SOURCE = "source";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    private static final String CHANNEL = "hitel-dual-stt";
    private static final int NOTIFICATION_ID = 4001;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private KoreanStreamAsr mic;
    private KoreanStreamAsr playback;
    private MediaProjection projection;
    private boolean foreground = false;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL, "HITEL 실시간 한국어 STT", NotificationManager.IMPORTANCE_LOW));
    }
    private Notification notification() {
        Intent launch = new Intent(this, MainActivity.class);
        PendingIntent open = PendingIntent.getActivity(this, 1, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("HITEL 마이크 / 미디어 출력 STT")
            .setContentText("사용자가 시작한 음성인식이 실행 중입니다.")
            .setOngoing(true)
            .setContentIntent(open)
            .build();
    }
    private void ensureForeground(boolean needsMic, boolean needsMediaProjection) {
        int types = 0;
        if (needsMic) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        if (needsMediaProjection) types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION;
        if (types == 0) return;
        startForeground(NOTIFICATION_ID, notification(), types);
        foreground = true;
    }
    public static void command(Context ctx, String action) {
        Intent intent = new Intent(ctx, CaptureService.class);
        intent.setAction(action);
        ctx.startForegroundService(intent);
    }
    private void publish(String source, String event, String text) {
        Intent intent = new Intent(ACTION_EVENT);
        intent.setPackage(getPackageName());
        intent.putExtra(EXTRA_SOURCE, source);
        intent.putExtra(EXTRA_EVENT, event);
        intent.putExtra(EXTRA_TEXT, text);
        sendBroadcast(intent);
    }
    @Override public void onStatus(String source, String status) {
        publish(source, "STATUS", status);
    }
    @Override public void onPartial(String source, String text) {
        publish(source, "PARTIAL", text);
    }
    @Override public void onFinal(String source, String text) {
        publish(source, "FINAL", text);
    }
    private boolean micActive() { return mic != null && mic.isActive(); }
    private boolean playbackActive() { return playback != null && playback.isActive(); }
    private void startMic() {
        if (micActive()) { publish("MIC", "STATUS", "마이크 STT 이미 실행 중"); return; }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            publish("MIC", "STATUS", "마이크 권한 없음"); return;
        }
        mic = new KoreanStreamAsr(this, "MIC", null, this);
        mic.start();
        publish("MIC", "STATUS", "마이크 한국어 STT 시작");
    }
    private void stopMic() {
        if (mic != null) mic.stop();
        mic = null;
        publish("MIC", "STATUS", "마이크 종료 요청");
    }
    private void startPlayback(Intent command) {
        if (playbackActive()) {
            publish("PLAYBACK", "STATUS", "미디어 출력 STT 이미 실행 중"); return;
        }
        Intent consent = command.getParcelableExtra(EXTRA_RESULT_DATA);
        int resultCode = command.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED);
        if (resultCode != Activity.RESULT_OK || consent == null) {
            publish("PLAYBACK", "STATUS", "시스템 오디오 캡처 동의가 없습니다"); return;
        }
        try {
            MediaProjectionManager manager =
                (MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            if (manager == null) throw new IllegalStateException("MediaProjectionManager missing");
            projection = manager.getMediaProjection(resultCode, consent);
            if (projection == null) throw new IllegalStateException("MediaProjection unavailable");
            projection.registerCallback(new MediaProjection.Callback() {
                @Override public void onStop() {
                    ui.post(() -> {
                        publish("PLAYBACK", "STATUS", "시스템이 미디어 캡처를 종료했습니다");
                        stopPlayback(false);
                        refreshForegroundOrStop();
                    });
                }
            }, ui);
            playback = new KoreanStreamAsr(this, "PLAYBACK", projection, this);
            playback.start();
            publish("PLAYBACK", "STATUS", "허용된 미디어·게임 소리만 STT · 전화 수신음은 제외");
        } catch (Throwable error) {
            publish("PLAYBACK", "STATUS", "미디어 캡처 시작 실패: " + error);
            stopPlayback(true);
        }
    }
    private void stopPlayback(boolean revoke) {
        if (playback != null) playback.stop();
        playback = null;
        MediaProjection old = projection;
        projection = null;
        if (revoke && old != null) try { old.stop(); } catch (Throwable ignored) { }
        publish("PLAYBACK", "STATUS", "미디어 출력 STT 종료");
    }
    private void refreshForegroundOrStop() {
        boolean m = micActive(), p = playbackActive();
        if (m || p) {
            ensureForeground(m, p);
        } else {
            if (foreground) {
                stopForeground(STOP_FOREGROUND_REMOVE);
                foreground = false;
            }
            stopSelf();
        }
    }
    @Override public int onStartCommand(Intent command, int flags, int startId) {
        if (command == null || command.getAction() == null) {
            refreshForegroundOrStop();
            return START_NOT_STICKY;
        }
        String action = command.getAction();
        try {
            if (ACTION_START_MIC.equals(action)) {
                ensureForeground(true, playbackActive());
                startMic();
            } else if (ACTION_START_PLAYBACK.equals(action)) {
                // Android 14+: foreground service type must be active before getMediaProjection.
                ensureForeground(micActive(), true);
                startPlayback(command);
            } else if (ACTION_STOP_MIC.equals(action)) {
                stopMic();
                refreshForegroundOrStop();
            } else if (ACTION_STOP_PLAYBACK.equals(action)) {
                stopPlayback(true);
                refreshForegroundOrStop();
            }
        } catch (Throwable error) {
            publish("SYSTEM", "STATUS", "오디오 서비스 오류: " + error);
            refreshForegroundOrStop();
        }
        return START_NOT_STICKY;
    }
    @Override public void onDestroy() {
        stopMic();
        stopPlayback(true);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
