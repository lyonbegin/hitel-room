from pathlib import Path
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")
s=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v7"' in s,"unexpected applicationId"
assert 'versionCode = 9' in s and 'versionName = "0.9.0-dialer-textcall-auto-return"' in s,"unexpected version"
gradle.write_text(s.replace('applicationId = "app.hitel.callflowlab.v7"', 'applicationId = "app.hitel.callflowlab.v09"'),encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL 통화 실시간 자막 v0.9' in m
manifest.write_text(m.replace('HITEL 통화 실시간 자막 v0.9','HITEL 통화 실시간 자막 v0.9 (독립설치)'),encoding="utf-8")
print("PASS separate APK app.hitel.callflowlab.v09. Old v7 preserved without uninstall. Old v7 accessibility service should be disabled manually.")
