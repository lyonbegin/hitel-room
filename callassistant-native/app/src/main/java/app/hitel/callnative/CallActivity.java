package app.hitel.callnative;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.telecom.Call;
import android.telecom.CallAudioState;
import android.content.Intent;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class CallActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView info, number;
    private Button answer, reject, end, hold, mute, speaker;
    private boolean muted = false;
    private boolean speakerOn = false;
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            update();
            handler.postDelayed(this, 450);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setShowWhenLocked(true);
        setTurnScreenOn(true);
        LinearLayout pane = Screen.vertical(this);
        Screen.title(this, pane, "HITEL 전화");
        number = Screen.note(this, pane, "상대방");
        info = Screen.note(this, pane, "통화 상태 확인 중");
        answer = Screen.button(this, pane, "전화 받기");
        answer.setOnClickListener(v -> NativeCallService.answer());
        reject = Screen.button(this, pane, "전화 거절");
        reject.setOnClickListener(v -> NativeCallService.reject());
        end = Screen.button(this, pane, "통화 종료");
        end.setOnClickListener(v -> {
            Call c = NativeCallService.current;
            if (c != null) c.disconnect();
        });
        hold = Screen.button(this, pane, "통화 보류 / 재개");
        hold.setOnClickListener(v -> {
            Call c = NativeCallService.current;
            if (c != null) {
                if (c.getState() == Call.STATE_ACTIVE) c.hold();
                else if (c.getState() == Call.STATE_HOLDING) c.unhold();
            }
        });
        mute = Screen.button(this, pane, "마이크 음소거");
        mute.setOnClickListener(v -> {
            NativeCallService svc = NativeCallService.instance;
            if (svc != null) { muted = !muted; svc.mute(muted); update(); }
        });
        speaker = Screen.button(this, pane, "스피커 전환");
        speaker.setOnClickListener(v -> {
            NativeCallService svc = NativeCallService.instance;
            if (svc != null) { speakerOn = !speakerOn; svc.speaker(speakerOn); update(); }
        });
        Screen.button(this, pane, "통화 중 DTMF 1 전송").setOnClickListener(v -> {
            Call c = NativeCallService.current;
            if (c != null) { c.playDtmfTone('1'); c.stopDtmfTone(); }
        });
        Screen.button(this, pane, "삼성 / Android 음성 경로 선택 및 시험").setOnClickListener(v ->
            startActivity(new Intent(this, AudioPathActivity.class)));
        Screen.button(this, pane, "마이크 자막 / TTS 시험").setOnClickListener(v ->
            startActivity(new Intent(this, VoiceLabActivity.class)));
        Screen.note(this, pane, "음소거는 일반 마이크 음소거만 제어합니다. AI 원음 차단과 번역 TTS의 통화 송신 경로는 구현되지 않았습니다.");
        setContentView(Screen.scroll(this, pane));
    }
    private void update() {
        Call c = NativeCallService.current;
        if (c == null) {
            info.setText("현재 통화 없음"); number.setText("통화 대기");
            answer.setEnabled(false); reject.setEnabled(false); end.setEnabled(false);
            hold.setEnabled(false); mute.setEnabled(false); speaker.setEnabled(false);
            return;
        }
        int state = c.getState();
        String s;
        switch (state) {
            case Call.STATE_RINGING: s = "수신 중"; break;
            case Call.STATE_DIALING: s = "발신 중"; break;
            case Call.STATE_ACTIVE: s = "통화 연결됨"; break;
            case Call.STATE_HOLDING: s = "통화 보류"; break;
            case Call.STATE_DISCONNECTED: s = "통화 종료"; break;
            case Call.STATE_CONNECTING: s = "연결 중"; break;
            default: s = "통화 상태: " + state;
        }
        info.setText(s);
        try {
            number.setText(c.getDetails().getHandle() == null ? "비공개 번호" : c.getDetails().getHandle().getSchemeSpecificPart());
        } catch (Exception e) { number.setText("전화 연결"); }
        answer.setEnabled(state == Call.STATE_RINGING);
        reject.setEnabled(state == Call.STATE_RINGING);
        end.setEnabled(state != Call.STATE_DISCONNECTED);
        hold.setEnabled(state == Call.STATE_ACTIVE || state == Call.STATE_HOLDING);
        mute.setEnabled(state == Call.STATE_ACTIVE);
        speaker.setEnabled(state == Call.STATE_ACTIVE);
        mute.setText(muted ? "마이크 음소거 해제" : "마이크 음소거");
        speaker.setText(speakerOn ? "수화기 전환" : "스피커 전환");
    }
    @Override protected void onResume() {
        super.onResume(); handler.post(refresh);
    }
    @Override protected void onPause() {
        handler.removeCallbacks(refresh); super.onPause();
    }
}
