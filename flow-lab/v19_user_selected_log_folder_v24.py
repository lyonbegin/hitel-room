#!/usr/bin/env python3
"""V24: independent, user-selected SAF log export with readback verification.
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

patch('''        logPage.addView(logList,new LinearLayout.LayoutParams(-1,0,1));''',
'''        line(logPage,"로그 저장 · 원하는 폴더 직접 선택");
        manualLogStatus=label("저장 폴더 미선택 · STT가 멈춰도 TXT 로그는 저장할 수 있습니다.",12,true);
        android.net.Uri priorLogFolder=HitelSafLogSaver.selectedFolder(this);
        if(priorLogFolder!=null)
            manualLogStatus.setText("선택한 로그 폴더: "+priorLogFolder);
        logPage.addView(manualLogStatus,new LinearLayout.LayoutParams(-1,dp(58)));
        Button chooseLogFolder=btn("① 로그 저장 폴더 선택",this::chooseManualLogFolder);
        Button exportLogNow=btn("② 로그 TXT 지금 저장 · 확인",this::saveManualLogNow);
        addButtonRow(logPage,chooseLogFolder,exportLogNow);
        logPage.addView(label("저장 후 TXT를 실제로 다시 열어 내용과 SHA-256을 검사합니다. "+
            "PCM·마이크·출력음 STT가 실패해도 실행 상태와 오류 기록을 담습니다.",11,false));
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
g=g.replace('versionCode = 31','versionCode = 32',1)
g=g.replace('0.14.17-integrated-direct-pcm-v23',
            '0.14.18-selectable-saf-log-v24',1)
gradle.write_text(g,encoding="utf-8")
m=manifest.read_text(encoding="utf-8")
assert 'HITEL14 V23 PCM 직접 STT 통합' in m
m=m.replace('HITEL14 V23 PCM 직접 STT 통합',
            'HITEL14 V24 로그 폴더 직접 저장',1)
manifest.write_text(m,encoding="utf-8")
for name,old in preserved.items():
    assert (src/name).read_bytes()==old,"unexpected STT code change: "+name
assert 'HitelSafLogSaver.save(getApplicationContext(),snapshot)' in s
assert 'Intent.ACTION_OPEN_DOCUMENT_TREE' in s
assert 'LOG_SAVE_FOLDER_PICK' in s
assert (src/"HitelSafLogSaver.java").is_file()
print("PASS: V24 log tab includes manual folder picker and verified TXT save")
print("PASS: user folder selection immediately writes a diagnostic file")
print("PASS: unchanged original V22 and V23 STT engine source")
