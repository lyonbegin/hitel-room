package app.hitel.callnative;

import android.Manifest;
import android.app.Activity;
import android.app.role.RoleManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.telecom.TelecomManager;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private EditText number;
    private TextView status;
    private static final int ROLE_REQUEST = 501;
    private static final int CALL_REQUEST = 502;
    private static final int PHONE_STATE_REQUEST = 503;
    private TextView passiveStatus;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = Screen.vertical(this);
        Screen.title(this, root, "HITEL 통화 어시스트");
        status = Screen.note(this, root, "기본 전화 앱 상태 확인 중");
        Screen.note(this, root, "Android 공통 Telecom API 기반의 독립 전화 앱입니다. 별도 권한 관리 앱과 통화 서버를 사용하지 않습니다.");
        passiveStatus = Screen.note(this, root, "기존 전화 앱의 통화 상태: 권한 확인 전");
        Screen.button(this, root, "기존 전화 앱 유지하며 통화 상태 감지 허용").setOnClickListener(v -> requestPhoneState());
        Button role = Screen.button(this, root, "기본 전화 앱으로 지정");
        role.setOnClickListener(v -> requestDialerRole());
        number = new EditText(this);
        number.setSingleLine(true);
        number.setHint("전화번호 입력");
        number.setInputType(InputType.TYPE_CLASS_PHONE);
        root.addView(number);
        String[][] keys = {{"1","2","3"},{"4","5","6"},{"7","8","9"},{"*","0","#"}};
        for (String[] row : keys) {
            LinearLayout strip = new LinearLayout(this);
            for (String key : row) {
                Button b = new Button(this); b.setText(key);
                strip.addView(b, new LinearLayout.LayoutParams(0, -2, 1f));
                b.setOnClickListener(v -> number.append(key));
            }
            root.addView(strip);
        }
        Button delete = Screen.button(this, root, "마지막 숫자 지우기");
        delete.setOnClickListener(v -> {
            String old = number.getText().toString();
            if (!old.isEmpty()) number.setText(old.substring(0, old.length()-1));
        });
        Button call = Screen.button(this, root, "전화 걸기");
        call.setOnClickListener(v -> makeCall());
        Screen.button(this, root, "통화 화면 열기").setOnClickListener(v ->
            startActivity(new Intent(this, CallActivity.class)));
        Screen.button(this, root, "마이크 자막 / 기기 TTS 독립 시험").setOnClickListener(v ->
            startActivity(new Intent(this, VoiceLabActivity.class)));
        Screen.note(this, root, "지원: 기본 전화 앱 설정·통화 제어·통화 화면·기기 내 음성인식/합성 시험. 제한: 일반 설치 앱은 SIM 상대방 통화 오디오 추출 및 번역 음성 주입 권한이 없습니다.");
        setContentView(Screen.scroll(this, root));
        applyDialIntent(getIntent());
    }

    @Override protected void onResume() {
        super.onResume();
        RoleManager manager = getSystemService(RoleManager.class);
        boolean held = manager != null && manager.isRoleHeld(RoleManager.ROLE_DIALER);
        status.setText(held ? "기본 전화 앱: HITEL 지정됨" : "기본 전화 앱: 기존 전화 앱 유지");
        updatePhoneState();
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent); applyDialIntent(intent);
    }
    private void applyDialIntent(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data != null && "tel".equals(data.getScheme()))
            number.setText(data.getSchemeSpecificPart());
    }
    private void requestDialerRole() {
        RoleManager manager = getSystemService(RoleManager.class);
        if (manager != null && manager.isRoleAvailable(RoleManager.ROLE_DIALER))
            startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_DIALER), ROLE_REQUEST);
        else status.setText("이 기기에서 기본 전화 앱 변경을 지원하지 않습니다.");
    }
    private void requestPhoneState() {
        if (android.os.Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
            updatePhoneState(); return;
        }
        requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE}, PHONE_STATE_REQUEST);
    }
    private void updatePhoneState() {
        if (passiveStatus == null) return;
        if (checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            passiveStatus.setText("기존 전화 상태: 전화 상태 권한이 필요합니다."); return;
        }
        try {
            android.telephony.TelephonyManager t = getSystemService(android.telephony.TelephonyManager.class);
            int state = t.getCallState();
            passiveStatus.setText("기존 전화 상태: " + (state == android.telephony.TelephonyManager.CALL_STATE_IDLE ? "대기" : state == android.telephony.TelephonyManager.CALL_STATE_RINGING ? "수신 중" : "통화 중") + " (기존 전화앱 변경 없음)");
        } catch (Exception e) { passiveStatus.setText("전화 상태 조회 실패: " + e.getClass().getSimpleName()); }
    }
    private void makeCall() {
        String digits = number.getText().toString().trim();
        if (!digits.matches("[+0-9*# -]{1,24}")) {
            status.setText("전화번호가 올바르지 않습니다."); return;
        }
        RoleManager manager = getSystemService(RoleManager.class);
        Uri uri = Uri.fromParts("tel", digits, null);
        if (manager != null && manager.isRoleHeld(RoleManager.ROLE_DIALER)) {
            if (checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.CALL_PHONE}, CALL_REQUEST); return;
            }
            try { getSystemService(TelecomManager.class).placeCall(uri, new Bundle()); }
            catch (Exception error) { status.setText("발신 실패: " + error.getClass().getSimpleName()); }
        } else startActivity(new Intent(Intent.ACTION_DIAL, uri));
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == CALL_REQUEST && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) makeCall();
        if (code == PHONE_STATE_REQUEST) updatePhoneState();
    }
}
