from pathlib import Path
import shutil

src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
w=src/"W03ConsoleActivity.java"
lab=src/"LabStore.java"
grad=Path("AndroidProject/app/build.gradle.kts")

# Keep new telemetry as a separate class, not a rewrite of VoxSherpa sources.
trace=Path("flow-lab/KoreanSttTrace.java")
assert trace.is_file()
shutil.copyfile(trace,src/"KoreanSttTrace.java")

# The W03 run folder is already automatically zipped by LabStore.finishRun().
# Only explicit user-controlled audio samples are written here.
s=lab.read_text(encoding="utf-8")
marker='    public static synchronized File transcriptsFile(Context context) {'
assert marker in s
s=s.replace(marker,'''    /** Debug WAV files stay local, inside the active W03 run and its export ZIP.
     *  Called only after the user explicitly presses the audio sample button. */
    public static synchronized File diagnosticAudioFile(String filename){
        if(runDir==null||filename==null)return null;
        String clean=filename.replaceAll("[^a-zA-Z0-9_.-]","_");
        if(!clean.endsWith(".wav"))return null;
        File f=new File(runDir,"diagnostic_audio/"+clean);
        f.getParentFile().mkdirs();
        return f;
    }
'''+marker,1)
lab.write_text(s,encoding="utf-8")

s=w.read_text(encoding="utf-8")
anchor='        Button nativeStt=btn("기존 시스템 STT 별도 진단",this::startSpeech);'
assert anchor in s,"Cannot locate current W03 native mic UI anchor"
s=s.replace(anchor,'''        // Optional ORIGINAL PCM sample, from the existing sherpa AudioRecord.
        // This never starts another microphone and is off until user taps.
        Button audioEvidence=btn("통화 중 내 목소리 12초 WAV 진단 (ZIP 포함)",()->{
            if(koreanSherpa!=null&&koreanSherpa.isRunning()){
                koreanSherpa.requestWavSample();
                log("W03_DIAG_WAV_USER_REQUEST","12s native PCM explicitly requested; no second microphone");
                status("동일 마이크 PCM을 최대 12초 저장합니다. W03 종료 시 ZIP 안의 diagnostic_audio 폴더를 확인하십시오.");
            }else{
                log("W03_DIAG_WAV_NOT_RUNNING","User requested WAV without active Korean STT");
                status("먼저 상단의 한국어 마이크 버튼을 눌러 음성인식을 실행해 주십시오.");
            }
        });
        content.addView(audioEvidence,new LinearLayout.LayoutParams(-1,dp(54)));
        content.addView(label(
            "상세 진단은 매초 SHERPA_DIAG_PCM_1S(음량·디코더·지연), "+
            "SHERPA_DIAG_AUDIO_ROUTE_CHANGE(통화 중 입력경로), "+
            "SHERPA_DIAG_PARTIAL/ENDPOINT/FINAL로 저장됩니다. "+
            "WAV는 버튼을 눌렀을 때만 녹음되며, 통화 중 음성정보가 포함될 수 있습니다.",12,false));
'''+anchor,1)
w.write_text(s,encoding="utf-8")

s=grad.read_text(encoding="utf-8")
assert 'versionCode = 19' in s
s=s.replace('versionCode = 19','versionCode = 20',1)
s=s.replace('0.14.5-streaming-release-model-on-stop',
            '0.14.6-deep-stt-audio-diagnostics',1)
grad.write_text(s,encoding="utf-8")

assert 'diagnosticAudioFile(' in lab.read_text(encoding="utf-8")
assert 'requestWavSample()' in w.read_text(encoding="utf-8")
assert 'SHERPA_DIAG_PCM_1S' in w.read_text(encoding="utf-8")
assert 'class KoreanSttTrace' in (src/"KoreanSttTrace.java").read_text(encoding="utf-8")
assert 'recognizer.release()' in (src/"KoreanSherpaStt.java").read_text(encoding="utf-8")
print("PASS detailed W03 logs, opt-in 12 second WAV inside existing ZIP, native ONNX release, previous streaming UI")
