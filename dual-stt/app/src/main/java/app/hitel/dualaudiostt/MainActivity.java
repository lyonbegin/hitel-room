package app.hitel.dualaudiostt;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Standalone source-specific STT UI. No call controls, no accessibility scraping. */
public final class MainActivity extends Activity {
    private static final int REQUEST_MIC = 501;
    private static final int REQUEST_PLAYBACK_MIC = 502;
    private static final int REQUEST_PROJECTION = 503;
    private TextView micLive, micHistory, micStatus, playbackLive, playbackHistory, playbackStatus;
    private boolean receiverRegistered;
    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!CaptureService.ACTION_EVENT.equals(intent.getAction())) return;
            String src = intent.getStringExtra(CaptureService.EXTRA_SOURCE);
            String event = intent.getStringExtra(CaptureService.EXTRA_EVENT);
            String text = intent.getStringExtra(CaptureService.EXTRA_TEXT);
            if (src == null || event == null || text == null) return;
            TextView status = "MIC".equals(src) ? micStatus : playbackStatus;
            TextView live = "MIC".equals(src) ? micLive : playbackLive;
            TextView history = "MIC".equals(src) ? micHistory : playbackHistory;
            if ("STATUS".equals(event)) status.setText(text);
            if ("PARTIAL".equals(event)) live.setText("실시간: " + text);
            if ("FINAL".equals(event)) {
                live.setText("확정: " + text);
                String old = history.getText().toString();
                history.setText((old.length() > 2800 ? old.substring(old.length()-1400) : old)
                    + "\n" + text);
            }
        }
    };
    private int dp(int v) {
        return (int)(v*getResources().getDisplayMetrics().density+0.5f);
    }
    private TextView text(String message, int size, boolean bold) {
        TextView view = new TextView(this);
        view.setText(message); view.setTextColor(Color.BLACK); view.setTextSize(size);
        if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD);
        view.setPadding(dp(8),dp(7),dp(8),dp(7));
        return view;
    }
    private Button button(String label, Runnable action) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setOnClickListener(v -> action.run());
        return b;
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12),dp(12),dp(12),dp(12));
        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
        root.addView(text("HITEL | 마이크 + 출력음 STT",22,true));
        root.addView(text("기존 한국어 sherpa-onnx Zipformer 모델 사용. 문자통화 및 접근성 기능 없음. "
            +"두 음원은 별도 STT 결과로 표시합니다.",13,false));
        root.addView(text("A · 마이크 수음 STT",19,true));
        root.addView(text("내 목소리를 인식합니다. 스피커폰 소리가 마이크에 실제로 들리면 "
            +"그 소리도 함께 인식될 수 있지만, 두 사람의 음성 분리는 보장되지 않습니다. "
            +"전화 통화 중에는 Android가 마이크 입력을 제한할 수 있습니다.",12,false));
        LinearLayout aButtons = new LinearLayout(this);
        aButtons.setOrientation(LinearLayout.HORIZONTAL);
        aButtons.addView(button("A 시작",this::startMic),
            new LinearLayout.LayoutParams(0,dp(56),1));
        aButtons.addView(button("A 중지",() -> CaptureService.command(
            this, CaptureService.ACTION_STOP_MIC)),
            new LinearLayout.LayoutParams(0,dp(56),1));
        root.addView(aButtons);
        micStatus = text("마이크 대기",12,false); root.addView(micStatus);
        micLive = text("실시간 자막 대기",16,true); root.addView(micLive);
        micHistory = text("A 확정 문장:",13,false); root.addView(micHistory);
        View divider = new View(this); divider.setBackgroundColor(0xffaaaaaa);
        root.addView(divider,new LinearLayout.LayoutParams(-1,dp(1)));
        root.addView(text("B · 미디어 출력음 STT",19,true));
        root.addView(text("시스템의 허용된 미디어·게임 출력 소리를 MediaProjection으로 직접 "
            +"가져옵니다. 첫 시작 시 Android 화면/오디오 캡처 동의를 요청합니다. "
            +"전화 상대방 음성(VOICE_COMMUNICATION)은 이 API로 캡처할 수 없습니다.",12,false));
        LinearLayout bButtons = new LinearLayout(this);
        bButtons.setOrientation(LinearLayout.HORIZONTAL);
        bButtons.addView(button("B 시작",this::startPlayback),
            new LinearLayout.LayoutParams(0,dp(56),1));
        bButtons.addView(button("B 중지",() -> CaptureService.command(
            this, CaptureService.ACTION_STOP_PLAYBACK)),
            new LinearLayout.LayoutParams(0,dp(56),1));
        root.addView(bButtons);
        playbackStatus = text("미디어 출력 대기",12,false); root.addView(playbackStatus);
        playbackLive = text("실시간 자막 대기",16,true); root.addView(playbackLive);
        playbackHistory = text("B 확정 문장:",13,false); root.addView(playbackHistory);
        root.addView(text("확인 기준: 각 입력의 RMS 신호 → sherpa 부분 자막 → 최종 자막. "
            +"RMS가 0에 가까우면 입력 권한·경로·무음 여부를 먼저 확인하십시오. "
            +"음성·문장은 서버로 업로드하지 않으며, STT 모델만 최초 다운로드합니다.",12,false));
        IntentFilter filter = new IntentFilter(CaptureService.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver, filter);
        receiverRegistered = true;
    }
    private boolean hasMicrophone() {
        return checkSelfPermission(Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
    }
    private void startMic() {
        if (!hasMicrophone()) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_MIC);
            return;
        }
        micStatus.setText("마이크 STT 시작 요청 중");
        CaptureService.command(this, CaptureService.ACTION_START_MIC);
    }
    private void startPlayback() {
        if (!hasMicrophone()) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_PLAYBACK_MIC);
            return;
        }
        MediaProjectionManager manager =
            (MediaProjectionManager)getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            playbackStatus.setText("MediaProjection 미지원 기기");
            return;
        }
        startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_PROJECTION);
    }
    @Override public void onRequestPermissionsResult(int requestCode,
            String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        if (requestCode == REQUEST_MIC) {
            if (granted) startMic(); else micStatus.setText("마이크 권한 거부");
        } else if (requestCode == REQUEST_PLAYBACK_MIC) {
            if (granted) startPlayback(); else playbackStatus.setText("캡처용 RECORD_AUDIO 권한 거부");
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_PROJECTION) return;
        if (resultCode != RESULT_OK || data == null) {
            playbackStatus.setText("사용자가 시스템 오디오 캡처를 취소했습니다");
            return;
        }
        Intent service = new Intent(this, CaptureService.class);
        service.setAction(CaptureService.ACTION_START_PLAYBACK);
        service.putExtra(CaptureService.EXTRA_RESULT_CODE, resultCode);
        service.putExtra(CaptureService.EXTRA_RESULT_DATA, data);
        playbackStatus.setText("미디어 출력 캡처 시작 요청 중");
        startForegroundService(service);
    }
    @Override protected void onDestroy() {
        if (receiverRegistered) unregisterReceiver(receiver);
        super.onDestroy();
    }
}
