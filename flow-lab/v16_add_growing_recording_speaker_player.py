#!/usr/bin/env python3
"""Add *only* one new recording-folder -> AudioTrack playback entry.

Prerequisite: reconstruct v14 source then run v15_preserve_v14_add_playback.py.
NO modification to KoreanSherpaStt, existing SpeakerPlaybackStt,
SpeakerPlaybackCaptureService, VoiceAccessAudioTrial, or LabStore.

Recording playback uses the existing experiment source's growing M4A AAC
follower and MediaCodec decoder, with PCM output redirected to AudioTrack.
"""
from pathlib import Path
import shutil
import hashlib

app=Path("AndroidProject/app")
root=app/"src/main/java/app/hitel/samsungprobe"
parts=Path("flow-lab/recording-playback")
mic_before=(root/"KoreanSherpaStt.java").read_bytes()
speaker_before=(root/"SpeakerPlaybackStt.java").read_bytes()
speaker_service_before=(root/"SpeakerPlaybackCaptureService.java").read_bytes()
w03_file=root/"W03ConsoleActivity.java"
manifest_file=app/"src/main/AndroidManifest.xml"
gradle_file=app/"build.gradle.kts"

for name in (
    "PlaybackTraceJournal.java",
    "StreamingAacPcmDecoder.java",
    "RecordingFolderPlaybackEngine.java",
    "RecordingFolderPlaybackService.java",
    "RecordingFolderPlaybackActivity.java"
):
    assert not (root/name).exists(),f"Refusing to override existing class: {name}"
    shutil.copyfile(parts/name,root/name)

# Only one new button, inserted into the existing post-v15 W03.
old='''        content.addView(speakerHistory);'''
new='''        content.addView(speakerHistory);
        // ADDITIVE ONLY: already-implemented speaker STT is unchanged.
        // This button merely opens the separate growing-M4A media player.
        Button growingRecordingPlayer=btn(
            "삼성 녹음 폴더 → 우리 앱 스피커 실시간 재생",()->{
                startActivity(new Intent(this,RecordingFolderPlaybackActivity.class));
            });
        content.addView(growingRecordingPlayer,new LinearLayout.LayoutParams(-1,dp(54)));'''
s=w03_file.read_text(encoding="utf-8")
assert s.count(old)==1,"W03 original speaker section anchor changed"
s=s.replace(old,new,1)
w03_file.write_text(s,encoding="utf-8")

m=manifest_file.read_text(encoding="utf-8")
assert "RecordingFolderPlaybackService" not in m
assert "<application" in m
m=m.replace('''    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>''',
'''    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>''',1)
m=m.replace('''    <application android:label=''', '''    <application android:extractNativeLibs="true" android:label=''',1)
assert 'android:extractNativeLibs="true"' in m
m=m.replace('''        <service android:name=".SpeakerPlaybackCaptureService" android:exported="false" android:foregroundServiceType="mediaProjection"/>''',
'''        <service android:name=".SpeakerPlaybackCaptureService" android:exported="false" android:foregroundServiceType="mediaProjection"/>
        <activity android:name=".RecordingFolderPlaybackActivity" android:exported="false"/>
        <service android:name=".RecordingFolderPlaybackService" android:exported="false"
            android:foregroundServiceType="mediaPlayback"/>''',1)
manifest_file.write_text(m,encoding="utf-8")

g=gradle_file.read_text(encoding="utf-8")
assert "versionCode = 22" in g and "0.14.8-original-mic-plus-playback" in g
g=g.replace("versionCode = 22","versionCode = 23",1)
g=g.replace("0.14.8-original-mic-plus-playback","0.14.9-growing-m4a-speaker-output",1)
g+="""

// The original microphone and speaker STT dependencies are untouched.
// DocumentFile only enumerates the user-selected recording directory.
dependencies {
    implementation("androidx.documentfile:documentfile:1.0.1")
}
android {
    packaging {
        jniLibs {
            // libaac-mdat-follow.so is an NDK PIE executable invoked from
            // nativeLibraryDir, so it must be extracted to the filesystem.
            useLegacyPackaging = true
        }
    }
}
"""
gradle_file.write_text(g,encoding="utf-8")

assert (root/"KoreanSherpaStt.java").read_bytes()==mic_before
assert (root/"SpeakerPlaybackStt.java").read_bytes()==speaker_before
assert (root/"SpeakerPlaybackCaptureService.java").read_bytes()==speaker_service_before
assert "CallAccessibilityService" not in m
assert "SpeakerPlaybackCaptureService" in m
assert "RecordingFolderPlaybackService" in m
assert "AudioPlaybackCaptureConfiguration" not in (root/"RecordingFolderPlaybackEngine.java").read_text()
assert "AudioTrack.Builder()" in (root/"RecordingFolderPlaybackEngine.java").read_text()
print("PASS mic original SHA256:",hashlib.sha256(mic_before).hexdigest())
print("PASS existing speaker engine SHA256:",hashlib.sha256(speaker_before).hexdigest())
print("PASS original mic STT and speaker STT unchanged; only growing-file AudioTrack player added")
