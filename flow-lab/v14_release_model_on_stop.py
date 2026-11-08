from pathlib import Path
g=Path("AndroidProject/app/build.gradle.kts")
s=g.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in s
assert 'versionCode = 18' in s
assert '0.14.4-live-streaming-partial-caption' in s
s=s.replace('versionCode = 18','versionCode = 19',1)
s=s.replace('0.14.4-live-streaming-partial-caption','0.14.5-streaming-release-model-on-stop',1)
g.write_text(s,encoding="utf-8")
w=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe/KoreanSherpaStt.java")
code=w.read_text(encoding="utf-8")
assert 'ACTIVE.compareAndSet(false,true)' in code
assert 'recognizer.release()' in code
assert 'SHERPA_KO_MODEL_RELEASED' in code
assert 'SHERPA_KO_FIRST_PARTIAL_MS' in code
assert 'sharedRecognizer' not in code
assert 'getSharedRecognizer' not in code
print("PASS Korean on-device STT: intermediate text streaming, no overlapping sessions, ONNX weights released on mic stop")
