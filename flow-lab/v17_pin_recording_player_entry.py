#!/usr/bin/env python3
"""UI-only hotfix: pin the existing recording-folder player entry on the first
screen, above the tabs. No audio, mic STT, speaker STT, file decoder, or service
changes. The original in-scroll button remains available as a second entry.
"""
from pathlib import Path
import hashlib

root=Path("AndroidProject/app")
w=root/"src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java"
g=root/"build.gradle.kts"
s=w.read_text(encoding="utf-8")
anchor='''        screen.addView(tabs);'''
assert s.count(anchor)==1, "Cannot find original W03 tabs insertion point"
new='''        // Important: visible before ANY scrolling or tab selection.
        // Opens the SAME existing recording-folder playback activity.
        Button callRecordingShortcut=btn(
            "📂 삼성 통화 녹음 폴더 선택 · 실시간 스피커 재생",()->{
                startActivity(new Intent(this,RecordingFolderPlaybackActivity.class));
            });
        screen.addView(callRecordingShortcut,new LinearLayout.LayoutParams(-1,dp(58)));
        screen.addView(tabs);'''
s=s.replace(anchor,new,1)
assert s.count("RecordingFolderPlaybackActivity.class")==2, "Expected both pinned and original button"
assert 'screen.addView(callRecordingShortcut' in s
w.write_text(s,encoding="utf-8")

gradle=g.read_text(encoding="utf-8")
assert 'versionCode = 23' in gradle
assert '0.14.9-growing-m4a-speaker-output' in gradle
gradle=gradle.replace("versionCode = 23","versionCode = 24",1)
gradle=gradle.replace("0.14.9-growing-m4a-speaker-output","0.14.10-pinned-growing-recording-button",1)
g.write_text(gradle,encoding="utf-8")

src=root/"src/main/java/app/hitel/samsungprobe"
for name in ("KoreanSherpaStt.java","SpeakerPlaybackStt.java","SpeakerPlaybackCaptureService.java","RecordingFolderPlaybackEngine.java"):
    path=src/name
    assert path.exists(),name
    print("UNCHANGED",name,hashlib.sha256(path.read_bytes()).hexdigest())
print("PINNED_PRIMARY_ACTION:",new.splitlines()[3].strip())
print("SUCCESS: added first-screen shortcut with same destination, audio source untouched")
