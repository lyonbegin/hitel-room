package app.hitel.callnative;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.RadioGroup;
import android.widget.RadioButton;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Independent mode selection. NO automatic fallback from Samsung to Android or vice versa.
 * All tests require an active real SIM call. Status means commands executed, never "AI success".
 */
public final class AudioPathActivity extends Activity {
    private enum Method { NONE, SAMSUNG, ANDROID }
    private Method selected = Method.NONE;
    private SamsungAudioPath samsung;
    private ShizukuAudioBridge android;
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextView status, logs, selectedLabel;
    private Button begin, tone, stop, mute, normal, check, connect;
    private RadioGroup androidChoice;
    private int androidBackend = ShellAudioService.METHOD_OFFICIAL;
    private boolean started = false;
    private final StringBuilder history = new StringBuilder();
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            if (selected == Method.ANDROID && android != null) status.setText(android.getStatus());
            main.postDelayed(this, 1000);
        }
    };

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        samsung = new SamsungAudioPath(this);
        android = new ShizukuAudioBridge(this, this::log);
        android.attach();
        LinearLayout pane = Screen.vertical(this);
        Screen.title(this, pane, "통화 음성 경로 — 두 가지 독립 구현");
        Screen.note(this, pane, "실제 SIM 통화 연결 후 각 경로를 따로 선택·실행하십시오. 자동 대체 없이 사용자가 선택한 경로만 실행합니다.");
        selectedLabel = Screen.note(this, pane, "선택: 없음");
        Button samsungSelect = Screen.button(this, pane, "① 삼성 Call Assistant 방식 선택");
        Button androidSelect = Screen.button(this, pane, "② Android 로컬 음성 경로 선택");
        samsungSelect.setOnClickListener(v -> select(Method.SAMSUNG));
        androidSelect.setOnClickListener(v -> select(Method.ANDROID));
        androidChoice = new RadioGroup(this);
        androidChoice.setOrientation(RadioGroup.VERTICAL);
        RadioButton official = new RadioButton(this);
        official.setText("Android AOSP 통화 오디오 리디렉션 (Android 13 이상)");
        official.setId(View.generateViewId());
        androidChoice.addView(official);
        RadioButton direct = new RadioButton(this);
        direct.setText("Android 직접 VOICE_DOWNLINK / TYPE_TELEPHONY 방식");
        direct.setId(View.generateViewId());
        androidChoice.addView(direct);
        official.setChecked(true);
        androidChoice.setOnCheckedChangeListener((group, id) -> {
            androidBackend = id == direct.getId() ? ShellAudioService.METHOD_DIRECT : ShellAudioService.METHOD_OFFICIAL;
            log("Android 서브 경로: " + (androidBackend == 0 ? "AOSP" : "Direct") + " 선택됨");
        });
        pane.addView(androidChoice);
        connect = Screen.button(this, pane, "Shizuku 권한 연결 (Android 방식만)");
        connect.setOnClickListener(v -> android.requestConnection());
        check = Screen.button(this, pane, "선택 경로 지원·권한 확인");
        check.setOnClickListener(v -> {
            if (selected == Method.SAMSUNG) log(samsung.probe());
            else if (selected == Method.ANDROID) log(android.getStatus());
            else log("먼저 두 경로 중 하나를 선택하십시오.");
        });
        begin = Screen.button(this, pane, "선택한 음성 경로 시작");
        begin.setOnClickListener(v -> startRoute());
        tone = Screen.button(this, pane, "800Hz 음성 주입 PCM 테스트 (상대방 청취 확인)");
        tone.setOnClickListener(v -> {
            if (!started) { log("먼저 음성 경로를 시작하십시오."); return; }
            if (selected == Method.SAMSUNG) log(samsung.playTone());
            else if (selected == Method.ANDROID) android.sendTone();
        });
        mute = Screen.button(this, pane, "삼성 방식: 원음 송신 차단 명령");
        mute.setOnClickListener(v -> {
            if (selected == Method.SAMSUNG) log(samsung.setTxMode(1));
        });
        normal = Screen.button(this, pane, "삼성 방식: 일반 송신 복원");
        normal.setOnClickListener(v -> {
            if (selected == Method.SAMSUNG) log(samsung.setTxMode(0));
        });
        stop = Screen.button(this, pane, "경로 정지 및 오디오 복원");
        stop.setOnClickListener(v -> stopRoute());
        status = Screen.note(this, pane, "오디오 경로 미실행");
        logs = Screen.note(this, pane, "실행 로그가 표시됩니다.");
        Screen.note(this,pane,
                "① 삼성 방식: 역공학에서 확인한 l_call_translation_mode, l_voice_tx_control_mode 및 VOICE_TX 태그 사용. 삼성 특권 서명 및 Audio HAL 정책 없이는 실패할 수 있습니다.\n" +
                "② Android 방식: Shizuku를 통한 로컬 shell 서비스에서 실제 PCM 입력·출력 파이프를 엽니다. AOSP/Direct 내부 경로도 명시적으로 선택합니다.\n" +
                "PCM 쓰기 성공만으로 상대방 음성이 들렸다고 판정하지 않습니다. STT·번역·TTS 엔진은 아직 연결되지 않았습니다.");
        setContentView(Screen.scroll(this, pane));
        updateControls();
    }

    private void log(String message) {
        runOnUiThread(() -> {
            String stamp = new SimpleDateFormat("HH:mm:ss", Locale.KOREA).format(new Date());
            history.insert(0, stamp + "  " + message + "\n");
            if (history.length() > 4500) history.setLength(4500);
            if (logs != null) logs.setText(history.toString());
            if (status != null) status.setText(message);
        });
    }

    private void select(Method method) {
        if (selected == method) return;
        if (started) stopRoute();
        selected = method;
        selectedLabel.setText(method == Method.SAMSUNG ? "선택: ① 삼성 원본 제어 경로" :
            method == Method.ANDROID ? "선택: ② Android 쉘 오디오 경로" : "선택: 없음");
        log("선택한 경로만 실행합니다: " + method);
        updateControls();
    }

    private void startRoute() {
        if (selected == Method.NONE) { log("두 경로 중 하나를 선택하십시오."); return; }
        if (started) { log("이미 시작 요청하셨습니다. 종료 후 다시 시도하십시오."); return; }
        if (selected == Method.SAMSUNG) {
            String answer = samsung.start();
            started = answer.startsWith("삼성 제어값 요청");
            log(answer);
        } else {
            // Asynchronous result from Shizuku shell; log success/failure in real time.
            android.start(androidBackend);
            started = true;
            log("Android PCM 경로 시작 요청; Shizuku 로그를 확인하십시오.");
        }
        updateControls();
    }

    private void stopRoute() {
        if (selected == Method.SAMSUNG) log(samsung.stop());
        else if (selected == Method.ANDROID) android.stop();
        started = false;
        updateControls();
    }

    private void updateControls() {
        boolean samsungMode = selected == Method.SAMSUNG;
        boolean androidMode = selected == Method.ANDROID;
        androidChoice.setVisibility(androidMode ? View.VISIBLE : View.GONE);
        connect.setVisibility(androidMode ? View.VISIBLE : View.GONE);
        mute.setVisibility(samsungMode ? View.VISIBLE : View.GONE);
        normal.setVisibility(samsungMode ? View.VISIBLE : View.GONE);
        tone.setEnabled(selected != Method.NONE);
        begin.setEnabled(selected != Method.NONE);
    }
    @Override protected void onResume() { super.onResume(); main.post(refresh); }
    @Override protected void onPause() { main.removeCallbacks(refresh); super.onPause(); }
    @Override protected void onDestroy() {
        try { samsung.stop(); } catch(Throwable ignored) {}
        try { android.detach(); } catch(Throwable ignored) {}
        super.onDestroy();
    }
}
