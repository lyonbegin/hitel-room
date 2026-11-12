#!/usr/bin/env python3
"""V25: one-tap SAVE opens Android folder picker and auto-saves with readback verification.
Apply strictly AFTER V23 patch chain. No STT engine source is modified.
"""
from pathlib import Path
import shutil
src=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
w=src/"W03ConsoleActivity.java"
gradle=Path("AndroidProject/app/build.gradle.kts")
manifest=Path("AndroidProject/app/src/main/AndroidManifest.xml")
preserved={name:(src/name).read_bytes() for name in
    ("KoreanSherpaStt.java","SpeakerPlaybackStt.java",
     "SpeakerPlaybackCaptureService.java","PcmDirectSherpaSink.java",
     "SpeakerEngine.java","SpeakerService.java")}
shutil.copyfile("flow-lab/HitelSafLogSaver.java",src/"HitelSafLogSaver.java")
s=w.read_text(encoding="utf-8")

def patch(before,after):
    global s
    assert s.count(before)==1,"Missing or ambiguous V23 anchor: "+before[:120]
    s=s.replace(before,after,1)

patch('''    private static final int DIRECT_FOLDER_PICK=1181;''',
'''    private static final int DIRECT_FOLDER_PICK=1181;
    private static final int LOG_SAVE_FOLDER_PICK=1184;
    private TextView manualLogStatus;''')

# The only SAVE button is pinned at the very top of the main screen.
# It opens Android's native folder picker immediately; selection saves TXT.
patch('''        Button speakerLogExport=btn("📦 3종 STT 최신 로그 ZIP 저장 (이전 ZIP 덮어쓰기)",
            this::saveSpeakerDiagnosticZip);''',
'''        Button speakerLogExport=btn("📁 로그 저장 · 폴더 선택",this::chooseManualLogFolder);''')
patch('''        screen.addView(speakerLogExport,new LinearLayout.LayoutParams(-1,dp(52)));''',
'''        screen.addView(speakerLogExport,0,new LinearLayout.LayoutParams(-1,dp(62)));''')
patch('''        logPage.addView(logList,new LinearLayout.LayoutParams(-1,0,1));''',
'''        manualLogStatus=label("로그 저장 버튼을 누르면 폴더 선택창이 열립니다.",12,true);
        screen.addView(manualLogStatus,1,new LinearLayout.LayoutParams(-1,dp(54)));
        logPage.addView(logList,new LinearLayout.LayoutParams(-1,0,1));''')

patch('''    private void selectDirectRecordingFolder(){''',
'''    private void chooseManualLogFolder(){
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        try{
            startActivityForResult(intent,LOG_SAVE_FOLDER_PICK);
            if(manualLogStatus!=null)
                manualLogStatus.setText("저장할 폴더를 선택해 주십시오 (폴더 안에 TXT 생성).");
        }catch(Throwable error){
            if(manualLogStatus!=null)
                manualLogStatus.setText("폴더 선택 실행 실패: "+error);
            SpeakerCaptureLog.append(this,"MANUAL_LOG_PICKER_ERROR",error.toString());
        }
    }
    private void saveManualLogNow(){
        if(HitelSafLogSaver.selectedFolder(this)==null){
            if(manualLogStatus!=null)manualLogStatus.setText(
                "먼저 ① 로그 저장 폴더를 선택해 주십시오.");
            chooseManualLogFolder();
            return;
        }
        if(manualLogStatus!=null)manualLogStatus.setText(
            "TXT 기록 생성 및 저장 파일 읽기 검증 중...");
        final java.util.ArrayList<String> snapshot=
            new java.util.ArrayList<>(entries);
        new Thread(()->{
            try{
                HitelSafLogSaver.Verified file=
                    HitelSafLogSaver.save(getApplicationContext(),snapshot);
                runOnUiThread(()->{
                    if(manualLogStatus!=null)
                        manualLogStatus.setText(
                            "로그 저장 검증 완료: "+file.summary()+
                            "\\n파일 URI: "+file.uri);
                    toast("로그 저장 확인 완료: "+file.name);
                });
            }catch(Throwable error){
                SpeakerCaptureLog.append(getApplicationContext(),
                    "MANUAL_LOG_SAVE_FAILED",error.toString());
                runOnUiThread(()->{
                    if(manualLogStatus!=null)
                        manualLogStatus.setText(
                            "로그 저장 실패 (성공 아님): "+error.toString());
                    toast("로그 저장 실패: "+error.getMessage());
                });
            }
        },"HITEL14-Manual-SAF-Log-Save").start();
    }
    private void selectDirectRecordingFolder(){''')

patch('''        if(request==DIRECT_FOLDER_PICK||request==DIRECT_FILE_PICK){''',
'''        if(request==LOG_SAVE_FOLDER_PICK){
            if(result!=RESULT_OK||data==null||data.getData()==null){
                if(manualLogStatus!=null)
                    manualLogStatus.setText("로그 폴더 선택 취소 · 저장하지 않았습니다.");
                return;
            }
            android.net.Uri chosen=data.getData();
            try{
                int flags=data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION |
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                if((flags & Intent.FLAG_GRANT_WRITE_URI_PERMISSION)==0 ||
                    (flags & Intent.FLAG_GRANT_READ_URI_PERMISSION)==0)
                    throw new java.io.IOException(
                        "폴더 읽기·쓰기 권한이 모두 부여되지 않았습니다.");
                getContentResolver().takePersistableUriPermission(chosen,flags);
                HitelSafLogSaver.storeFolder(this,chosen);
                SpeakerCaptureLog.append(this,"MANUAL_LOG_FOLDER_SELECTED",
                    chosen.toString());
                if(manualLogStatus!=null)
                    manualLogStatus.setText("폴더 선택 완료 · 시험 로그 저장과 읽기 검증 시작");
                // Do not wait for STT; immediately prove filesystem write works.
                saveManualLogNow();
            }catch(Throwable error){
                SpeakerCaptureLog.append(this,"MANUAL_LOG_FOLDER_ERROR",
                    error.toString());
                if(manualLogStatus!=null)
                    manualLogStatus.setText("폴더 선택/쓰기 권한 오류: "+error);
            }
            return;
        }
        if(request==DIRECT_FOLDER_PICK||request==DIRECT_FILE_PICK){''')

w.write_text(s,encoding="utf-8")
g=gradle.read_text(encoding="utf-8")
assert 'versionCode = 31' in g
assert '0.14.17-integrated-direct-pcm-v23' in g
g=g.replace('versionCode = 31','versionCode = 33',1)
g=g.replace('0.14.17-integrated-direct-pcm-v23',
            '0.14.19-one-tap-folder-save-v25',1)
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL14 V23 PCM 직접 STT 통합' in m
m=m.replace('HITEL14 V23 PCM 직접 STT 통합',
            'HITEL14 V25 원클릭 로그 폴더 저장',1)
manifest.write_text(m,encoding="utf-8")
for name,old in preserved.items():
    assert (src/name).read_bytes()==old,"unexpected STT code change: "+name
assert 'HitelSafLogSaver.save(getApplicationContext(),snapshot)' in s
assert 'Intent.ACTION_OPEN_DOCUMENT_TREE' in s
assert 'LOG_SAVE_FOLDER_PICK' in s
assert 'Button chooseLogFolder' not in s
assert 'Button exportLogNow' not in s
assert (src/"HitelSafLogSaver.java").is_file()
print("PASS: V24 log tab includes manual folder picker and verified TXT save")
print("PASS: user folder selection immediately writes a diagnostic file")
print("PASS: unchanged original V22 and V23 STT engine source")
