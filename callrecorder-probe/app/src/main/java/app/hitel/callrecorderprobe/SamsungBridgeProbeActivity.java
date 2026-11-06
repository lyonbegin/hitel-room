package app.hitel.callrecorderprobe;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.telephony.TelephonyManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Tries actual Samsung Call Assistant IPC entry points; never requests dialer role. */
public final class SamsungBridgeProbeActivity extends Activity {
    private static final String ASSISTANT = "com.samsung.android.callassistant";
    private static final String INCALL = "com.samsung.android.incallui";
    private static final String DIALER = "com.samsung.android.dialer";
    private static final String VIEWER = "com.samsung.android.callassistant.callassistviewer.CallAssistViewerActivity";
    private static final String RECORD_VIEWER = "com.samsung.android.callassistant.callassistviewer.RecordViewerActivity";
    private static final String TRANSLATOR = "com.samsung.android.callassistant.voiptranslator.VoipTranslatorService";
    private static final String TEXT_CALL = "com.samsung.android.callassistant.permission.TEXT_CALL";
    private static final String READ_CALL = "com.samsung.android.incall.permission.READ_CALL_CONTENT_PROVIDER";
    private static final String WRITE_CALL = "com.samsung.android.incall.permission.WRITE_CALL_CONTENT_PROVIDER";
    private static final String VOIP = "com.samsung.android.callassistant.permission.VOIP_TRANSLATOR";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView output, callState;
    private final StringBuilder log = new StringBuilder();
    private boolean bound = false;
    private final ServiceConnection sc = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder service) {
            add("통역 Service onServiceConnected: " + name.flattenToShortString() +
                    " / Binder=" + (service != null ? service.getInterfaceDescriptor() : "null"));
        }
        @Override public void onServiceDisconnected(ComponentName name) { add("통역 Service 연결 해제"); }
    };
    private final Runnable refresh = new Runnable() {
        @Override public void run() {
            try {
                if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                    int s = getSystemService(TelephonyManager.class).getCallState();
                    callState.setText("현재 통화 상태: " + (s == 2 ? "OFFHOOK / 통화중" : s == 1 ? "RINGING / 수신중" : "IDLE / 대기") +
                        "\n이 상태만으로 삼성 Call Assistant 연결 성공을 의미하지 않습니다.");
                } else callState.setText("전화 상태 권한이 필요합니다.");
            } catch (Throwable e) { callState.setText("전화 상태 조회 실패: " + e); }
            handler.postDelayed(this, 900);
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout panel = Screen.vertical(this);
        Screen.title(this, panel, "HITEL × 삼성 전화 실제 연결 검사");
        Screen.note(this, panel, "삼성 전화앱은 그대로 유지합니다. 아래 버튼은 APK에서 확인한 삼성 Call Assistant 실제 컴포넌트 호출을 실행합니다. 삼성 서명이 필요한 기능은 거부될 수 있습니다.");
        callState = Screen.note(this, panel, "통화 상태");
        Button inspect = Screen.button(this, panel, "1. 삼성 패키지 / UID / 보호권한 검사");
        inspect.setOnClickListener(v -> inspectSamsung());
        Button textCall = Screen.button(this, panel, "2. 삼성 텍스트 통화 화면 직접 연결 시도");
        textCall.setOnClickListener(v -> launch("TEXT_CALL", VIEWER));
        Button records = Screen.button(this, panel, "3. 삼성 텍스트 통화 기록 화면 연결 시도");
        records.setOnClickListener(v -> launch("RECORD_VIEWER", RECORD_VIEWER));
        Button service = Screen.button(this, panel, "4. 삼성 통역 서비스 Binder 연결 시도");
        service.setOnClickListener(v -> probeService());
        Button copy = Screen.button(this, panel, "5. 실제 결과 전체 복사");
        copy.setOnClickListener(v -> {
            ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE))
                .setPrimaryClip(ClipData.newPlainText("HITEL Samsung bridge results", log.toString()));
            add("결과를 클립보드에 복사했습니다.");
        });
        Screen.note(this, panel, "판정 기준: 컴포넌트 실제 실행/서비스 onServiceConnected만 호출 성공입니다. 권한 검사 통과만으로 PCM·자막 연결 성공이라고 주장하지 않습니다.");
        output = Screen.note(this, panel, "검사 전");
        ScrollView scroll = Screen.scroll(this, panel);
        setContentView(scroll);
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE}, 201);
        inspectSamsung();
    }
    private void add(String line) {
        String msg = android.text.format.DateFormat.format("HH:mm:ss", System.currentTimeMillis()) + " " + line;
        android.util.Log.i("HITEL_SAMSUNG_BRIDGE", msg);
        log.append(msg).append('\n');
        runOnUiThread(() -> { if (output != null) output.setText(log.toString()); });
    }
    private void inspectSamsung() {
        add("=== 삼성 Call Assistant 내부 연결 표면 검사 ===");
        PackageManager pm = getPackageManager();
        for (String pkg : new String[]{ASSISTANT, INCALL, DIALER}) {
            try {
                PackageInfo pi = pm.getPackageInfo(pkg, 0);
                ApplicationInfo app = pi.applicationInfo;
                add(pkg + " INSTALLED version=" + pi.versionName +
                    " uid=" + (app != null ? app.uid : -1));
            } catch (PackageManager.NameNotFoundException e) {
                add(pkg + " NOT_VISIBLE_OR_NOT_INSTALLED");
            }
        }
        int same = pm.checkSignatures(getPackageName(), ASSISTANT);
        add("삼성 Call Assistant와 APK 서명 일치: " + (same == PackageManager.SIGNATURE_MATCH ? "YES" : "NO (code=" + same + ")"));
        for (String permission : new String[]{TEXT_CALL, VOIP, READ_CALL, WRITE_CALL}) {
            add(permission + " : " + (checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
        }
        try {
            android.content.pm.ActivityInfo ai = pm.getActivityInfo(new ComponentName(ASSISTANT, VIEWER), 0);
            add("CallAssistViewerActivity: 존재 exported=" + ai.exported + " required=" + ai.permission);
        } catch (Throwable t) { add("CallAssistViewerActivity 조회: " + t.getClass().getSimpleName()); }
        try {
            android.content.pm.ServiceInfo si = pm.getServiceInfo(new ComponentName(ASSISTANT, TRANSLATOR), 0);
            add("VoipTranslatorService: 존재 exported=" + si.exported + " required=" + si.permission);
        } catch (Throwable t) { add("VoipTranslatorService 조회: " + t.getClass().getSimpleName()); }
    }
    private void launch(String action, String clazz) {
        try {
            Intent i = new Intent(Intent.ACTION_MAIN);
            i.setComponent(new ComponentName(ASSISTANT, clazz));
            startActivity(i);
            add(action + " START_ACTIVITY_ACCEPTED (연결 실행 승인; 기능과 통화 데이터 연결은 별도 확인)");
        } catch (SecurityException e) { add(action + " SECURITY_DENIED: " + e.getMessage()); }
        catch (android.content.ActivityNotFoundException e) { add(action + " COMPONENT_MISSING: " + e.getMessage()); }
        catch (Throwable t) { add(action + " ERROR " + t.getClass().getSimpleName() + ": " + t.getMessage()); }
    }
    private void probeService() {
        try {
            if (bound) { unbindService(sc); bound = false; }
            Intent intent = new Intent().setComponent(new ComponentName(ASSISTANT, TRANSLATOR));
            bound = bindService(intent, sc, Context.BIND_AUTO_CREATE);
            add("VOIP_TRANSLATOR BIND_RESULT=" + bound + " (true는 Binder 연결 완료가 아님)");
        } catch (SecurityException e) { add("VOIP_TRANSLATOR SECURITY_DENIED: " + e.getMessage()); }
        catch (Throwable t) { add("VOIP_TRANSLATOR ERROR " + t.getClass().getSimpleName() + ": " + t.getMessage()); }
    }
    @Override protected void onResume() { super.onResume(); handler.post(refresh); }
    @Override protected void onPause() { handler.removeCallbacks(refresh); super.onPause(); }
    @Override protected void onDestroy() {
        if (bound) try { unbindService(sc); } catch (Throwable ignored) {}
        super.onDestroy();
    }
}
