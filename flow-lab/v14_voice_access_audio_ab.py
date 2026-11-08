from pathlib import Path
import shutil

src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
w=src/"W03ConsoleActivity.java"
g=Path("AndroidProject/app/build.gradle.kts")

shutil.copyfile("flow-lab/VoiceAccessAudioTrial.java",src/"VoiceAccessAudioTrial.java")

s=w.read_text(encoding="utf-8")
def sub(a,b):
    global s
    assert a in s,"W03 voice trial patch missing: "+a[:140]
    s=s.replace(a,b,1)

sub('''    private KoreanSherpaStt koreanSherpa;''',
'''    private KoreanSherpaStt koreanSherpa;
    private int voiceTrialModeIndex=4; // NS+AEC+microphone direction first; baseline selectable
    private Button voiceTrialModeButton;''')

sub('''        content.addView(audioEvidence,new LinearLayout.LayoutParams(-1,dp(54)));''',
'''        content.addView(audioEvidence,new LinearLayout.LayoutParams(-1,dp(54)));
        // This button is visible without scrolling. Each tap advances ONE
        // controlled audio configuration; changes apply on next mic start.
        voiceTrialModeButton=btn("통화중 음성입력 실험: "+
            VoiceAccessAudioTrial.name(voiceTrialModeIndex),()->{
            if(koreanSherpa!=null&&koreanSherpa.isRunning()){
                status("마이크를 먼저 중지하신 뒤 시험 조건을 변경해 주십시오.");
                log("VA_AB_PRESET_CHANGE_BLOCKED","Mic already recording");
                return;
            }
            voiceTrialModeIndex=(voiceTrialModeIndex+1)%VoiceAccessAudioTrial.MODES.length;
            voiceTrialModeButton.setText("통화중 음성입력 실험: "+
                VoiceAccessAudioTrial.name(voiceTrialModeIndex));
            status("선택됨: "+VoiceAccessAudioTrial.name(voiceTrialModeIndex)+
                ". 다음 마이크 시작부터 적용됩니다.");
            log("VA_AB_UI_PRESET","mode="+voiceTrialModeIndex+
                "; label="+VoiceAccessAudioTrial.name(voiceTrialModeIndex));
        });
        screen.addView(voiceTrialModeButton,7,new LinearLayout.LayoutParams(-1,dp(52)));
        log("VA_AB_UI_DEFAULT","initialMode="+voiceTrialModeIndex+
            "; label="+VoiceAccessAudioTrial.name(voiceTrialModeIndex));''')

sub('''        log("SHERPA_KO_USER_START","User pressed HITEL microphone; Korean only; no Samsung keyboard");''',
'''        if(!koreanSherpa.setTrialMode(voiceTrialModeIndex)){
            status("이전 녹음 세션 종료 중입니다. 메모리 해제 후 다시 시작해 주십시오.");
            log("VA_AB_PRESET_REJECTED","mode="+voiceTrialModeIndex);
            return;
        }
        log("VA_AB_SESSION_REQUEST","selectedMode="+voiceTrialModeIndex+
            "; label="+VoiceAccessAudioTrial.name(voiceTrialModeIndex)+
            "; AndroidAudioModeAndRouteVerifiedSeparately");
        log("SHERPA_KO_USER_START","User pressed HITEL microphone; Korean only; no Samsung keyboard");''')

assert 'screen.addView(voiceTrialModeButton,7' in s
assert 'koreanSherpa.setTrialMode(voiceTrialModeIndex)' in s
assert 'VoiceAccessAudioTrial.name(' in s
assert 'screen.addView(pinnedLiveCaption,5' in s
w.write_text(s,encoding="utf-8")

grad=g.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in grad
assert 'versionCode = 20' in grad
assert '0.14.6-deep-stt-audio-diagnostics' in grad
grad=grad.replace('versionCode = 20','versionCode = 21',1)
grad=grad.replace('0.14.6-deep-stt-audio-diagnostics',
                  '0.14.7-voice-access-audio-ab',1)
g.write_text(grad,encoding="utf-8")

engine=(src/"KoreanSherpaStt.java").read_text(encoding="utf-8")
trial=(src/"VoiceAccessAudioTrial.java").read_text(encoding="utf-8")
assert 'audioTrial.configureBeforeStart()' in engine
assert 'audioTrial.afterRecordingStarted()' in engine
assert 'finishedTrial.close()' in engine
assert 'A11Y_STATE' in trial
assert 'getRoutedDevice()' in trial
assert 'NoiseSuppressor.create(' in trial
assert 'AcousticEchoCanceler.create(' in trial
assert 'MIC_DIRECTION_TOWARDS_USER' in trial
assert 'TYPE_BUILTIN_MIC' in trial
assert 'SHERPA_DIAG_PCM_1S' in s
assert 'recognizer.release()' in engine
print("PASS v0.14.7: Voice Access public-API A/B modes 0..6, detailed logs, original STT, original VoxSherpa")
