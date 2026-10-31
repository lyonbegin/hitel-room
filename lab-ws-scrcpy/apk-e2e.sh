#!/usr/bin/env bash
# Build and install a fresh, harmless Android 11 test APK on the KVM guest.
set -Eeuo pipefail
OUT="$(pwd)/mobile-test-results/ws-scrcpy-live"
WORK="$RUNNER_TEMP/hitel-apk-e2e"
mkdir -p "$WORK/src/com/hitel/lab" "$WORK/dex" "$OUT"
echo HITEL_TEST_APK_COMPILATION_START
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
TOOLS="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
ANDROID_JAR="$SDK/platforms/android-30/android.jar"
test -r "$ANDROID_JAR"
for command in aapt d8 zipalign apksigner; do test -x "$TOOLS/$command"; done
cat > "$WORK/AndroidManifest.xml" <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.hitel.lab">
  <uses-sdk android:minSdkVersion="23" android:targetSdkVersion="28"/>
  <application android:label="HITEL SDK TEST" android:theme="@android:style/Theme.Material.Light.NoActionBar">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
XML
cat > "$WORK/src/com/hitel/lab/MainActivity.java" <<'JAVA'
package com.hitel.lab;
import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.widget.*;
import android.view.View;
public class MainActivity extends Activity {
  public void onCreate(Bundle state) {
    super.onCreate(state);
    LinearLayout box = new LinearLayout(this);
    box.setOrientation(LinearLayout.VERTICAL);
    box.setPadding(36,52,36,20);
    box.setBackgroundColor(Color.WHITE);
    TextView label = new TextView(this);
    label.setText("HITEL SDK ANDROID 11");
    label.setTextSize(22);
    label.setTextColor(Color.BLACK);
    box.addView(label,new LinearLayout.LayoutParams(-1,130));
    EditText input = new EditText(this);
    input.setSingleLine(true);
    input.setHint("HITEL INPUT");
    input.setId(2001);
    box.addView(input,new LinearLayout.LayoutParams(-1,140));
    Button button = new Button(this);
    button.setText("HITEL TAP TEST");
    button.setId(2002);
    box.addView(button,new LinearLayout.LayoutParams(-1,150));
    TextView result = new TextView(this);
    result.setId(2003);
    result.setText("READY");
    result.setTextColor(Color.BLACK);
    result.setTextSize(22);
    box.addView(result,new LinearLayout.LayoutParams(-1,120));
    button.setOnClickListener(new View.OnClickListener() {
      public void onClick(View v) {
        result.setText("TOUCH_OK:"+input.getText().toString());
      }
    });
    setContentView(box);
  }
}
JAVA
"$TOOLS/aapt" package -f -M "$WORK/AndroidManifest.xml" -I "$ANDROID_JAR" -F "$WORK/unsigned.apk"
javac -source 8 -target 8 -Xlint:none -cp "$ANDROID_JAR" -d "$WORK/classes" "$WORK/src/com/hitel/lab/MainActivity.java"
"$TOOLS/d8" --lib "$ANDROID_JAR" --output "$WORK/dex" "$WORK/classes/com/hitel/lab/MainActivity.class" "$WORK/classes/com/hitel/lab/MainActivity\$1.class"
(cd "$WORK/dex" && "$TOOLS/aapt" add "$WORK/unsigned.apk" classes.dex)
"$TOOLS/zipalign" -f 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
keytool -genkeypair -noprompt -keystore "$WORK/test.keystore" -alias hitel -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 2 -dname "CN=HITEL SDK TEST" >/dev/null 2>&1
"$TOOLS/apksigner" sign --ks "$WORK/test.keystore" --ks-key-alias hitel --ks-pass pass:android --key-pass pass:android --out "$WORK/hitel-lab.apk" "$WORK/aligned.apk"
"$TOOLS/apksigner" verify "$WORK/hitel-lab.apk"
cp "$WORK/hitel-lab.apk" "$OUT/hitel-test-app.apk"
# E2E-only fixture package: cached AVDs may contain the same package signed by
# a different ephemeral test key. Remove ONLY this disposable fixture before reinstalling.
if adb shell pm path com.hitel.lab 2>/dev/null | grep -q "^package:"; then
  adb uninstall com.hitel.lab | tee "$OUT/apk-uninstall.log"
fi
adb install -r "$WORK/hitel-lab.apk" | tee "$OUT/apk-install.log"
adb shell pm path com.hitel.lab | tee "$OUT/apk-package.log"
adb shell am force-stop com.hitel.lab || true
adb shell am start -n com.hitel.lab/.MainActivity | tee "$OUT/apk-launch.log"
sleep 2
adb exec-out screencap -p > "$OUT/apk-running.png"
timeout 40s adb shell uiautomator dump /sdcard/hitel-ui.xml >/dev/null
adb shell cat /sdcard/hitel-ui.xml > "$OUT/apk-ui-before.xml"
grep -q 'HITEL SDK ANDROID 11' "$OUT/apk-ui-before.xml"
grep -q 'HITEL TAP TEST' "$OUT/apk-ui-before.xml"
echo HITEL_REAL_APK_INSTALLED_LAUNCHED_AND_VISIBLE
