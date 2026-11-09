from pathlib import Path

root=Path("AndroidProject")
ui=root/"app/src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java"
gradle=root/"app/build.gradle.kts"
flow=root/"app/src/main/java/app/hitel/samsungprobe/SamsungRecordingFlow.java"
s=ui.read_text(encoding="utf-8")

def replace_once(before,after,label):
    global s
    count=s.count(before)
    assert count==1, f"{label}: expected one anchor, got {count}"
    s=s.replace(before,after,1)

replace_once(
'''        content.addView(fileRetry,new LinearLayout.LayoutParams(-1,dp(50)));
        samsungFileAsrState=label(''',
'''        content.addView(fileRetry,new LinearLayout.LayoutParams(-1,dp(50)));
        // Diagnostic/manual selection lane: show all files, no phone call needed.
        Button browseRecordings=btn("📂 Recordings/Call 전체 파일 보기 · 선택 STT",
            this::showCallRecordingFiles);
        content.addView(browseRecordings,new LinearLayout.LayoutParams(-1,dp(54)));
        samsungFileAsrState=label(''',
"manual selection button")

replace_once(
'''    /** Samsung OEM record STOP. Never hangs up and never stops HITEL14 microphone. */
    private void stopSamsungRecordingAndTranscribe(){''',
'''    /**
     * Display EVERY direct file from internal storage /Recordings/Call.
     * Selecting a file starts the independent AAC->PCM->sherpa file pipeline,
     * without making a call or starting/stopping the microphone.
     */
    private void showCallRecordingFiles(){
        if(!has(Manifest.permission.READ_MEDIA_AUDIO)){
            requestPermissions(new String[]{Manifest.permission.READ_MEDIA_AUDIO},606);
            return;
        }
        File[] files=SamsungRecordingFlow.allCallFiles();
        if(files==null){
            new AlertDialog.Builder(this)
                .setTitle("Recordings/Call 접근 불가")
                .setMessage("저장된 파일을 읽지 못했습니다. 경로: "+
                    SamsungRecordingFlow.callFolderPath()+
                    "\\n오디오 읽기 권한과 파일 접근 상태를 확인해 주십시오.")
                .setPositiveButton("확인",null).show();
            log("SAMSUNG_REC_BROWSER_ERROR","directory inaccessible");
            return;
        }
        if(files.length==0){
            new AlertDialog.Builder(this)
                .setTitle("통화 녹음 파일 목록 (0개)")
                .setMessage("폴더가 비어 있습니다. "+
                    SamsungRecordingFlow.callFolderPath())
                .setPositiveButton("확인",null).show();
            log("SAMSUNG_REC_BROWSER_EMPTY","directory="+SamsungRecordingFlow.callFolderPath());
            return;
        }
        String[] labels=new String[files.length];
        java.text.SimpleDateFormat date=new java.text.SimpleDateFormat(
            "MM-dd HH:mm",Locale.KOREA);
        for(int i=0;i<files.length;i++){
            File file=files[i];
            String dateText=file.lastModified()>0?
                date.format(new java.util.Date(file.lastModified())):"날짜 미상";
            labels[i]=file.getName()+"\\n"+
                String.format(Locale.KOREA,"%,d bytes",file.length())+
                " · "+dateText;
        }
        log("SAMSUNG_REC_BROWSER_OPEN",
            "count="+files.length+"; folder="+SamsungRecordingFlow.callFolderPath());
        new AlertDialog.Builder(this)
            .setTitle("내장 저장공간/Recordings/Call · 전체 "+files.length+"개")
            .setItems(labels,(dialog,index)->{
                File selected=files[index];
                boolean started=SamsungRecordingFlow.transcribeSelectedFile(
                    getApplicationContext(),selected);
                log("SAMSUNG_REC_BROWSER_CHOOSE",
                    "file="+selected.getName()+"; accepted="+started);
                if(!started)
                    toast("파일을 처리할 수 없거나 다른 녹음 작업이 진행 중입니다.");
                refreshSamsungFileAsr();
            })
            .setNegativeButton("닫기",null)
            .show();
    }

    /** Samsung OEM record STOP. Never hangs up and never stops HITEL14 microphone. */
    private void stopSamsungRecordingAndTranscribe(){''',
"file listing UI")

replace_once(
'''else if(req==605)placeCall();''',
'''else if(req==605)placeCall();
            else if(req==606)showCallRecordingFiles();''',
"audio permission callback")

assert 'private void startKoreanSherpaSpeech()' in s
assert 'private void stopKoreanSherpaSpeech()' in s
assert 'this::showCallRecordingFiles' in s
assert 'SamsungRecordingFlow.transcribeSelectedFile(' in s
assert 'SamsungRecordingFlow.allCallFiles()' in s
assert 'this::stopSamsungRecordingAndTranscribe' in s
assert 'this::stopKoreanSherpaSpeech' in s
assert 'android.telecom.TelecomManager' in s # keep original, don't modify
ui.write_text(s,encoding="utf-8")

grad=gradle.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in grad
assert grad.count('versionCode = 22')==1
grad=grad.replace('versionCode = 22','versionCode = 23',1)
assert grad.count('0.14.8-completed-m4a-file-asr')==1
grad=grad.replace('0.14.8-completed-m4a-file-asr',
                  '0.14.9-completed-m4a-file-browser',1)
gradle.write_text(grad,encoding="utf-8")

filecode=flow.read_text(encoding="utf-8")
assert 'static File[] allCallFiles()' in filecode
assert 'static boolean transcribeSelectedFile(Context context,File selected)' in filecode
assert 'WORKER.execute(SamsungRecordingFlow::finalizeAndTranscribe)' in filecode
assert 'TelecomManager.endCall' not in filecode
assert 'AudioRecord' not in filecode.replace('Never uses AudioRecord','')
print("PASS: all Recordings/Call files enumerated and selectable; independent file STT; no microphone/hangup changes")
