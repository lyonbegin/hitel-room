#!/usr/bin/env python3
"""V23: ADD the verified V5 growing-M4A -> Korean direct-STT module to the
reconstructed ORIGINAL HITEL14 V22. All existing microphone, MediaProjection
speaker STT, system choice, and logs remain byte-for-byte unchanged.

Run AFTER v15, v16, v17. V5 sources are fetched via a pinned git checkout
at v5-source/speaker-standalone. Offline model/native artifacts are pulled
from the exact V5 signed release APK separately by the build workflow.

Important: different applicationId from V22 because Actions debug-signing
certificate can differ between runs; resulting V23 contains ALL V22 features.
"""
import hashlib
import shutil
from pathlib import Path

app=Path("AndroidProject/app")
src=app/"src/main/java/app/hitel/samsungprobe"
source=Path("v5-source/speaker-standalone/app/src/main")
sub=app/"src/main/java/app/hitel/speakeronly"
m=app/"src/main/AndroidManifest.xml"
g=app/"build.gradle.kts"
w=src/"W03ConsoleActivity.java"
assert source.is_dir(), "V5 source checkout not present"
assert not sub.exists(), "Direct STT package already exists: patch must apply exactly once"

originals={
  key:(src/key).read_bytes()
  for key in ("KoreanSherpaStt.java","SpeakerPlaybackStt.java",
              "SpeakerPlaybackCaptureService.java","SpeakerCaptureLog.java")
}
original_w03=w.read_text(encoding="utf-8")
# The source V5 is the exact standalone module from successful signed release.
names=("CallStateGate.java","DirectPcmKoreanStt.java","GrowingM4aSelector.java",
       "LatencyTrace.java","MainActivity.java","SamsungRecordAccessibility.java",
       "SpeakerEngine.java","SpeakerService.java","StreamingAacPcmDecoder.java",
       "TraceJournal.java")
sub.mkdir(parents=True)
for name in names:
    file=source/"java/app/hitel/speakeronly"/name
    assert file.is_file(), f"Missing checked-out V5 source: {file}"
    shutil.copyfile(file,sub/name)
    assert (sub/name).read_bytes()==file.read_bytes()
assert not (sub/"PcmSpeakerMonitor.java").exists(),"Do not copy speaker monitor into direct-STT variant"

# Reuse only V5 accessibility service resource (not V5 launcher/activity).
resource_src=source/"res/xml/samsung_record_accessibility.xml"
target=app/"src/main/res/xml/samsung_record_accessibility.xml"
assert resource_src.is_file()
assert not target.exists()
shutil.copyfile(resource_src,target)
string_src=source/"res/values/strings.xml"
string_dest=app/"src/main/res/values/direct_recorder_strings.xml"
assert string_src.is_file()
assert not string_dest.exists()
shutil.copyfile(string_src,string_dest)

ui=original_w03
needle='''        screen.addView(nativeChange,new LinearLayout.LayoutParams(-1,dp(55)));
        screen.addView(tabs);'''
assert ui.count(needle)==1,"Original V22 system choice UI anchor changed"
ui=ui.replace(needle,'''        screen.addView(nativeChange,new LinearLayout.LayoutParams(-1,dp(55)));
        // ADDED V23 mode. Original mic STT, output STT, original Android
        // system chooser and existing logs above remain unmodified.
        Button directKoreanStt=btn(
            "③ 통화녹음 16kHz PCM → 한국어 STT 직접 실행 (스피커 캡처 불필요)",
            ()->startActivity(new Intent(this,app.hitel.speakeronly.MainActivity.class)));
        screen.addView(directKoreanStt,new LinearLayout.LayoutParams(-1,dp(66)));
        screen.addView(label(
            "V23 추가 기능: 삼성 통화녹음 증가분을 직접 인식합니다. "+
            "기존 ① 마이크 STT / ② 출력음 STT와 독립적으로 실행됩니다.",12,false));
        screen.addView(tabs);''',1)
w.write_text(ui,encoding="utf-8")

xml=m.read_text(encoding="utf-8")
assert "HITEL14 시스템 단일앱선택 V22" in xml
assert 'android:extractNativeLibs' not in xml
xml=xml.replace('<application ', '<application android:extractNativeLibs="true" ',1)
xml=xml.replace('HITEL14 시스템 단일앱선택 V22',
                'HITEL14 V23 마이크 출력음 직접STT 통합',1)
# Retain original permissions and only append missing ones.
for perm in ("android.permission.BLUETOOTH_CONNECT",
             "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
             "android.permission.READ_PHONE_STATE"):
    if perm not in xml:
        xml=xml.replace("    <application ",
              f'    <uses-permission android:name="{perm}"/>\n    <application ',1)
extra='''        <!-- Third HITEL14 STT pathway: original growing-M4A source,
             Android MediaCodec -> PCM 16kHz -> Sherpa OnlineStream.
             Accessibility helper is opt-in; no recording->speaker route. -->
        <activity android:name="app.hitel.speakeronly.MainActivity"
                  android:exported="false" android:windowSoftInputMode="adjustResize"/>
        <service android:name="app.hitel.speakeronly.SpeakerService"
                 android:exported="false" android:foregroundServiceType="dataSync"/>
        <service android:name="app.hitel.speakeronly.SamsungRecordAccessibility"
                 android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
                 android:exported="true" android:label="HITEL 통화녹음 시작 보조">
          <intent-filter>
            <action android:name="android.accessibilityservice.AccessibilityService"/>
          </intent-filter>
          <meta-data android:name="android.accessibilityservice"
                     android:resource="@xml/samsung_record_accessibility"/>
        </service>
'''
assert xml.count("</application>")==1
xml=xml.replace('    </application>',extra+'    </application>',1)
m.write_text(xml,encoding="utf-8")

gradle=g.read_text(encoding="utf-8")
assert 'versionCode = 30' in gradle
assert 'app.hitel.callflowlab.v14.systempicker' in gradle
assert 'implementation("com.github.k2-fsa:sherpa-onnx:1.12.26")' in gradle
gradle=gradle.replace('versionCode = 30','versionCode = 31',1)
gradle=gradle.replace('app.hitel.callflowlab.v14.systempicker',
                      'app.hitel.callflowlab.v14.integrated.directstt',1)
gradle=gradle.replace('0.14.16-native-system-picker-v22',
                      '0.14.17-v23-mic-playback-direct-stt',1)
assert 'implementation("androidx.documentfile:documentfile:1.0.1")' not in gradle
gradle += '\n// V23: original V5 Android SAF tree/DocumentsProvider support.\ndependencies { implementation("androidx.documentfile:documentfile:1.0.1") }\n'
assert 'jniLibs { useLegacyPackaging = true }' not in gradle
gradle += '\n// Extract the original native AAC follower binary so it can be executed.\nandroid { packaging { jniLibs { useLegacyPackaging = true } } }\n'
g.write_text(gradle,encoding="utf-8")

for key,content in originals.items():
    assert (src/key).read_bytes()==content,f"V22 source changed: {key}"
    print("PRESERVED_V22",key,hashlib.sha256(content).hexdigest())
assert "mgr.createScreenCaptureIntent()" in ui
assert 'MediaProjectionConfig.createConfigForDefaultDisplay()' not in ui
assert 'SpeakerTargetPicker' not in ui
assert '③ 통화녹음 16kHz PCM' in ui
assert 'app.hitel.speakeronly.MainActivity' in xml
assert 'app.hitel.speakeronly.SpeakerService' in xml
assert 'app.hitel.speakeronly.SamsungRecordAccessibility' in xml
assert 'android:extractNativeLibs="true"' in xml
assert 'implementation("androidx.documentfile:documentfile:1.0.1")' in gradle
assert (sub/"SpeakerEngine.java").read_text().count("target.accept(pcm)")>=1
assert 'new DirectPcmKoreanStt(' in (sub/"SpeakerEngine.java").read_text()
assert 'stream.acceptWaveform(normalized,RATE)' in (sub/"DirectPcmKoreanStt.java").read_text()
assert "PcmSpeakerMonitor" not in (sub/"SpeakerEngine.java").read_text()
print("PASS_V23_INTEGRATION_THREE_STT_PATHS_ORIGINAL_V22_UNMODIFIED")
print("PASS_V23_DIRECT_KOREAN_STT_NATIVE_M4A_TO_PCM_SINK_SOURCE_PRESENT")
print("PASS_V23_NATIVE_SYSTEM_SINGLE_APP_CHOICE_PRESERVED")
print("PASS_V23_IN_APP_DIRECT_STT_LAUNCH_AND_ACCESSIBILITY_SERVICE")
