package app.hitel.callnative;

import android.app.Activity;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.telephony.TelephonyManager;
import android.content.pm.PackageManager;
import android.Manifest;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Cross-vendor PUBLIC API diagnostic only. No proprietary audio controls or
 * privileged capture attempt; never claims access to the remote SIM audio.
 */
public final class AudioDiagnosticsActivity extends Activity {
    private TextView state;
    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout root = Screen.vertical(this);
        Screen.title(this, root, "Android 공통 통화·오디오 점검");
        state = Screen.note(this, root, "검사 전");
        Screen.button(this, root, "실시간 공개 API 재검사").setOnClickListener(v -> inspect());
        Screen.note(this, root, "기존 전화 앱 변경 없이 사용 가능한 공개 정보만 검사합니다. 일반 APK는 상대방 SIM 음성을 읽거나 통화 회선으로 TTS를 직접 주입할 권한이 없습니다.");
        setContentView(Screen.scroll(this, root));
        inspect();
    }
    private void inspect() {
        AudioManager audio = getSystemService(AudioManager.class);
        StringBuilder b = new StringBuilder();
        b.append("기종: ").append(Build.MANUFACTURER).append(" / ").append(Build.MODEL).append("\n");
        b.append("Android API: ").append(Build.VERSION.SDK_INT).append("\n");
        b.append("AudioManager.mode: ").append(audio.getMode()).append("\n");
        b.append("통화 오디오 볼륨: ").append(audio.getStreamVolume(AudioManager.STREAM_VOICE_CALL)).append("\n");
        b.append("마이크 음소거 상태: ").append(audio.isMicrophoneMute()).append("\n");
        b.append("상대방 음성 PCM 접근: 일반 앱 권한으로는 사용할 수 없음\n");
        b.append("통화 송신 PCM 주입: 일반 앱 권한으로는 사용할 수 없음\n");
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            try {
                TelephonyManager phone = getSystemService(TelephonyManager.class);
                int call = phone.getCallState();
                b.append("기존 전화 앱의 SIM 통화 상태: ")
                    .append(call == TelephonyManager.CALL_STATE_IDLE ? "대기" :
                            call == TelephonyManager.CALL_STATE_RINGING ? "수신 중" : "통화 중").append("\n");
            } catch (Exception e) { b.append("통화 상태 조회 오류: ").append(e.getMessage()); }
        } else b.append("READ_PHONE_STATE 권한 미부여\n");
        state.setText(b.toString());
    }
}
