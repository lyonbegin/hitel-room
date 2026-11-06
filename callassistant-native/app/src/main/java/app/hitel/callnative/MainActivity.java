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

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = Screen.vertical(this);
        Screen.title(this, root, "HITEL 통화 어시스트");
        status = Screen.note(this, root, "기본 전화 앱 상태 확인 중");
        Screen.note(this, root, "삼성 원본과 분리된 독립 Android 전화 앱입니다.");
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
        Screen.button(this, root, "① 삼성 / ② Android 음성 경로 개별 시험").setOnClickListener(v ->
            startActivity(new Intent(this, AudioPathActivity.class)));
        Screen.button(this, root, "통화 화면 열기").setOnClickListener(v ->
            startActivity(new Intent(this, CallActivity.class)));
        Screen.button(this, root, "마이크 자막 / 기기 TTS 독립 시험").setOnClickListener(v ->
            startActivity(new Intent(this, VoiceLabActivity.class)));
        Screen.note(this, root, "주의: 기존 SIM 상대 음성 캡처, 원음 차단, 통역 TTS 상대방 송신은 아직 불가합니다. 삼성 시스템 전용 권한이 필요합니다.");
        setContentView(Screen.scroll(this, root));
        applyDialIntent(getIntent());
    }

    @Override protected void onResume() {
        super.onResume();
        RoleManager manager = getSystemService(RoleManager.class);
        boolean held = manager != null && manager.isRoleHeld(RoleManager.ROLE_DIALER);
        status.setText(held ? "기본 전화 앱: HITEL 지정됨" : "기본 전화 앱: 다른 앱 사용 중");
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
    }
}
