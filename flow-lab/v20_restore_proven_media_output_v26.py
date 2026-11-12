#!/usr/bin/env python3
"""V26: restore the EXACT earlier successful speaker player as optional USAGE_MEDIA route.
V25 mic/output and direct PCM STT remain unchanged unless the user explicitly selects playback.
Run strictly after v19_user_selected_log_folder_v24.py.
"""
from pathlib import Path
import shutil

src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
w=src/"W03ConsoleActivity.java"
direct=src/"PcmDirectSherpaSink.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")
saved={x:(src/x).read_bytes() for x in
       ("KoreanSherpaStt.java","SpeakerPlaybackStt.java",
        "SpeakerPlaybackCaptureService.java","HitelSafLogSaver.java",
        "StreamingAacPcmDecoder.java","SpeakerEngine.java","SpeakerService.java")}

# Literal reuse of the previously tested Samsung-recording -> AudioTrack source.
# Only its Java package is changed to coexist with HITEL14.
original=Path("speaker-standalone/app/src/main/java/app/hitel/speakeronly/PcmSpeakerMonitor.java").read_text(encoding="utf-8")
assert original.count("package app.hitel.speakeronly;")==1
assert 'setUsage(AudioAttributes.USAGE_MEDIA)' in original
assert 'AudioAttributes.ALLOW_CAPTURE_BY_ALL' in original
assert 'new AudioTrack(attributes,format,capacity,AudioTrack.MODE_STREAM,0)' in original
assert 'pcmRms' in original and 'ACTUAL_OUTPUT_ROUTE' in original
(src/"PcmSpeakerMonitor.java").write_text(
    original.replace("package app.hitel.speakeronly;",
                     "package app.hitel.samsungprobe;",1),encoding="utf-8")

s=direct.read_text(encoding="utf-8")
def rep(old,new):
    global s
    assert s.count(old)==1, "missing or duplicate direct sink anchor: "+old[:140]
    s=s.replace(old,new,1)

rep('''    private OnlineStream stream;
    private String lastPartial="";''',
'''    private OnlineStream stream;
    // Opt-in verified AudioTrack route. Null in ordinary direct STT mode.
    private PcmSpeakerMonitor mediaOutput;
    private String lastPartial="";''')
rep('''        log=journal;
        callback=events;
        File modelDir=new File(context.getFilesDir(),"sherpa-ko-v1");''',
'''        log=journal;
        callback=events;
        if(ignoredOutputDevice==-2){
            // Same original player code that previously produced audible recording.
            // No model load or microphone/MediaProjection in this sink.
            mediaOutput=new PcmSpeakerMonitor(context,journal,-1,
                message->callback.accept("DIRECT_STATUS|MEDIA_OUTPUT "+message));
            log.event("SPEAKER","VERIFIED_PLAYER_RESTORED",
                "usage","USAGE_MEDIA","capturePolicy","ALLOW_CAPTURE_BY_ALL",
                "sttInsidePlaybackSink",false);
            callback.accept("DIRECT_STATUS|삼성 M4A → 16kHz PCM → 원본 미디어 AudioTrack 대기");
            return;
        }
        File modelDir=new File(context.getFilesDir(),"sherpa-ko-v1");''')
rep('''    void setOutputDevice(int ignored){
        callback.accept("DIRECT_STATUS|직접 STT 경로에는 스피커 출력 장치가 없습니다.");
    }''',
'''    void setOutputDevice(int id){
        if(mediaOutput!=null){
            mediaOutput.setOutputDevice(id);
            return;
        }
        callback.accept("DIRECT_STATUS|직접 STT 경로에는 스피커 출력 장치가 없습니다.");
    }''')
rep('''    void write(byte[] littleEndianPcm)throws Exception {
        if(closed||stream==null)throw new IllegalStateException("PCM 직접 STT가 종료되었습니다.");''',
'''    void write(byte[] littleEndianPcm)throws Exception {
        if(closed)throw new IllegalStateException("PCM 출력 경로가 종료되었습니다.");
        if(mediaOutput!=null){
            mediaOutput.write(littleEndianPcm);
            totalSamples+=littleEndianPcm.length/2;
            return;
        }
        if(stream==null)throw new IllegalStateException("PCM 직접 STT가 종료되었습니다.");''')
rep('''        closed=true;
        try{
            if(stream!=null && recognizer!=null){''',
'''        closed=true;
        if(mediaOutput!=null){
            mediaOutput.close();
            mediaOutput=null;
            log.event("SPEAKER","MEDIA_OUTPUT_CLOSED","pcmSamples",totalSamples);
            return;
        }
        try{
            if(stream!=null && recognizer!=null){''')
direct.write_text(s,encoding="utf-8")

s=w.read_text(encoding="utf-8")
def ui(old,new):
    global s
    assert s.count(old)==1, "missing or duplicate UI anchor: "+old[:140]
    s=s.replace(old,new,1)
ui('''        Button directStop=btn("PCM 직접 STT 중지",this::stopDirectRecordingStt);
        addButtonRow(content,directStart,directStop);''',
'''        Button directStop=btn("PCM 직접 STT 중지",this::stopDirectRecordingStt);
        addButtonRow(content,directStart,directStop);
        Button provenMediaOutput=btn("삼성 통화녹음 → 원본 미디어 스피커 재생",
            this::startDirectRecordingMediaPlayback);
        content.addView(provenMediaOutput,new LinearLayout.LayoutParams(-1,dp(54)));
        content.addView(label(
            "검증용: 과거 성공한 AudioTrack 코드를 그대로 사용 · "+
            "USAGE_MEDIA/ALLOW_CAPTURE_BY_ALL. 소리가 나오면 출력음 STT 시스템 선택창에서 "+
            "HITEL14를 선택해 유튜브와 같은 캡처 경로로 확인하십시오. "+
            "녹음 폴더 또는 M4A 파일 선택은 기존 버튼을 이용합니다.",12,false));''')
ui('''    private void startDirectRecordingStt(){
        android.content.SharedPreferences prefs=getSharedPreferences("hitel_direct_source",MODE_PRIVATE);''',
'''    private void startDirectRecordingStt(){
        startDirectRecordingMode(-1);
    }
    private void startDirectRecordingMediaPlayback(){
        startDirectRecordingMode(-2);
    }
    private void startDirectRecordingMode(int audioMode){
        android.content.SharedPreferences prefs=getSharedPreferences("hitel_direct_source",MODE_PRIVATE);''')
ui('''        service.putExtra(SpeakerService.EX_DEVICE,-1);''',
'''        // -1 = existing direct PCM ASR; -2 = opt-in proven AudioTrack media mode.
        service.putExtra(SpeakerService.EX_DEVICE,audioMode);''')
ui('''            if(directSttStatus!=null)directSttStatus.setText(folder?
                "통화 상태 자동 감시 시작 요청 · 녹음 파일 증가 확인 대기":
                "선택한 M4A를 직접 STT 처리 시작 요청");
            SpeakerCaptureLog.append(this,"DIRECT_STT_REQUEST",
                "folder="+folder+"; SAF="+raw);''',
'''            if(directSttStatus!=null)directSttStatus.setText(audioMode==-2?
                "원본 미디어 AudioTrack 대기 · PCM 수신 시 실제 스피커 재생":
                folder?"통화 상태 자동 감시 시작 요청 · 녹음 파일 증가 확인 대기":
                "선택한 M4A를 직접 STT 처리 시작 요청");
            SpeakerCaptureLog.append(this,audioMode==-2?
                "PROVEN_MEDIA_PLAYBACK_REQUEST":"DIRECT_STT_REQUEST",
                "folder="+folder+"; mode="+audioMode+"; SAF="+raw);''')
w.write_text(s,encoding="utf-8")

g=gradle.read_text(encoding="utf-8")
assert g.count("versionCode = 33")==1
assert g.count("0.14.19-one-tap-folder-save-v25")==1
g=g.replace("versionCode = 33","versionCode = 34",1)
g=g.replace("0.14.19-one-tap-folder-save-v25",
            "0.14.20-proven-media-output-v26",1)
gradle.write_text(g,encoding="utf-8")

m=manifest.read_text(encoding="utf-8")
assert m.count("HITEL14 V25 원클릭 로그 폴더 저장")==1
m=m.replace("HITEL14 V25 원클릭 로그 폴더 저장",
            "HITEL14 V26 미디어 스피커 원본 복원",1)
assert m.count("<application")==1
# Android 10+: explicit consent for own USAGE_MEDIA playback to be capturable.
if 'android:allowAudioPlaybackCapture=' not in m:
    m=m.replace("<application","<application android:allowAudioPlaybackCapture=\"true\"",1)
manifest.write_text(m,encoding="utf-8")

for name,original_bytes in saved.items():
    assert (src/name).read_bytes()==original_bytes, "untouched STT or recorder changed: "+name
assert 'if(ignoredOutputDevice==-2)' in direct.read_text()
assert 'mediaOutput.write(littleEndianPcm)' in direct.read_text()
assert 'startDirectRecordingMediaPlayback' in w.read_text()
assert 'AudioAttributes.USAGE_MEDIA' in (src/"PcmSpeakerMonitor.java").read_text()
assert 'AudioAttributes.ALLOW_CAPTURE_BY_ALL' in (src/"PcmSpeakerMonitor.java").read_text()
print("PASS_V26_EXACT_OLD_AUDIOTRACK_SOURCE_REUSED_WITH_USAGE_MEDIA")
print("PASS_V26_MIC_YOUTUBE_STT_AND_DEFAULT_DIRECT_PCM_UNCHANGED")
print("PASS_V26_SPEAKER_MODE_EXPLICIT_OPT_IN_NOT_AUTO_PLAYING_CALLS")
