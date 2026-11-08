from pathlib import Path
base=Path("AndroidProject/app/src/main")
d=base/"java/app/hitel/samsungprobe"
w=d/"W03ConsoleActivity.java"
a=d/"CallAccessibilityService.java"
g=Path("AndroidProject/app/build.gradle.kts")
m=base/"AndroidManifest.xml"
s=w.read_text(encoding="utf-8")
def sub(old,new):
 global s
 assert old in s,("W03 anchor not found",old[:180])
 s=s.replace(old,new,1)

# "전체 실행 로그" previously lived in a permanently allocated bottom pane
# weighted 3/10 of the display and made the main content 7/10, obstructing
# text fields and controls. Use two ordinary, mutually exclusive Activity tabs.
sub('''        sc.addView(content);screen.addView(sc,new LinearLayout.LayoutParams(-1,0,7));''',
'''        sc.addView(content);
        LinearLayout tabs=container();
        tabs.setOrientation(LinearLayout.HORIZONTAL);
        Button callTab=btn("통화 · 자막 · 입력",()->{
            sc.setVisibility(View.VISIBLE);
            logPage.setVisibility(View.GONE);
        });
        Button logsTab=btn("전체 실행 로그",()->{
            sc.setVisibility(View.GONE);
            logPage.setVisibility(View.VISIBLE);
            if(followLogs&&logAdapter!=null&&logAdapter.getCount()>0)
                logList.setSelection(logAdapter.getCount()-1);
        });
        tabs.addView(callTab,new LinearLayout.LayoutParams(0,dp(50),1));
        tabs.addView(logsTab,new LinearLayout.LayoutParams(0,dp(50),1));
        screen.addView(tabs);
        screen.addView(sc,new LinearLayout.LayoutParams(-1,0,1));
        logPage=container();
        logPage.setVisibility(View.GONE);
        screen.addView(logPage,new LinearLayout.LayoutParams(-1,0,1));''')
sub('''    private ScrollView scrollBody;''',
'''    private ScrollView scrollBody;
    private LinearLayout logPage;''')
sub('''        screen.addView(head);
        logList=new ListView(this);''',
'''        logPage.addView(head);
        logList=new ListView(this);''')
sub('''        screen.addView(logList,new LinearLayout.LayoutParams(-1,0,3));''',
'''        logPage.addView(logList,new LinearLayout.LayoutParams(-1,0,1));''')
# Avoid overlay wording: W12 introduced NO overlay; W03 help text was stale.
s=s.replace("삼성 화면의 HITEL 복귀 패널을 직접 눌러도 되며, ", "")
s=s.replace("전화 화면 위의 HITEL 복귀 버튼을 사용해 주십시오.", "삼성 문자통화 화면을 확인한 뒤 HITEL로 자동 복귀합니다.")
s=s.replace("HITEL 복귀 버튼으로 돌아오십시오.", "HITEL 전면 복귀를 확인하십시오.")
s=s.replace("HITEL로 돌아오기' 버튼", "삼성 문자통화 화면")
# Text Call's microphone may be reserved by telephony/OEM. The big primary
# speech button should not silently invoke SpeechRecognizer 7 times again.
# Transfer explicitly to the normal Samsung InCallUI, focus only the actual
# OEM text entry field (without inserting or sending any text). Samsung's
# keyboard mic is only a user-triggered test and can also be blocked by OEM.
sub('''        sttButton=btn("🎙 여기서 바로 말하기 (STT)",this::startSpeech);
        Button stop=btn("음성 인식 중지",this::stopSpeech);
        addButtonRow(content,sttButton,stop);''',
'''        sttButton=btn("말하기 → 삼성 전화",this::openSamsungSpeechEntry);
        Button nativeStt=btn("HITEL STT 별도 시험",this::startSpeech);
        addButtonRow(content,sttButton,nativeStt);
        content.addView(label(
           "삼성 텍스트 통화 중 HITEL STT는 이 기기에서 오류 7이 반복되었습니다. "+
           "말하기를 누르면 삼성 통화 화면을 열고 원본 문자 입력창에 키보드를 띄웁니다. "+
           "키보드 마이크가 나타나면 직접 눌러 음성 입력을 시험하십시오. "+
           "텍스트 통화 중에는 삼성 키보드 STT도 제한될 수 있습니다.",12,false));
        Button stop=btn("HITEL 음성인식 중지",this::stopSpeech);
        content.addView(stop,new LinearLayout.LayoutParams(-1,dp(44)));''')
sub('''    private void startSpeech(){
        if(!recordStarted)return;''',
'''    /** User explicitly requests Samsung's real phone UI for speech input.
     * Never starts a competing HITEL microphone capture during Text Call. */
    private void openSamsungSpeechEntry(){
        if(!recordStarted)return;
        if(isListening){stopSpeech();destroyRecognizer();isListening=false;}
        log("W14_SAMSUNG_DICTATION_REQUEST",
            "Open actual Samsung call UI and focus OEM text field only. "+
            "Samsung keyboard microphone is manually operated; NOT assumed available");
        status("삼성 전화 화면을 엽니다. 문자 입력창이 나타나면 키보드 마이크를 직접 눌러 "+
           "음성인식 가능 여부를 확인해 주십시오. 문자는 자동 전송되지 않습니다.");
        openCallUi();
        ui.postDelayed(()->{
            CallAccessibilityService svc=CallAccessibilityService.instance;
            if(svc==null){
                log("W14_SAMSUNG_DICTATION_NO_A11Y","Cannot focus Samsung edit field without accessibility");
                return;
            }
            boolean focused=svc.focusSamsungTextCallInput();
            log("W14_SAMSUNG_DICTATION_FOCUS","Samsung text-call input focus="+focused+
                "; keyboard mic availability and STT results NOT verified");
        },900);
    }
    /** Diagnostic-only third-party SpeechRecognizer. The original 7/7 failures
     * remain visible as errors, never treated as proof of microphone exclusivity. */
    private void startSpeech(){
        if(!recordStarted)return;''')
sub('''        sttButton.setEnabled(!isListening&&recordStarted);''',
'''        sttButton.setEnabled(recordStarted);''')
sub('''            log("W03_OPEN_OEM_UI","TelecomManager.showInCallScreen(false); 전화 앱 화면 일시 노출. 반드시 사용자 반환 버튼 제공");''',
'''            log("W03_OPEN_OEM_UI","TelecomManager.showInCallScreen(false); 삼성 전화 앱 전체화면 열기, 오버레이 없음");''')
# Avoid previously misleading onReadyForSpeech meaning "microphone activated".
sub('''status("마이크 활성 · 지금 말씀하십시오.");log("W03_STT_READY","language="+lang);''',
'''status("음성인식 서비스 준비 · 실제 마이크 신호 수신은 미확인");log("W03_STT_READY","serviceReadyOnly; language="+lang);''')
sub('''status("STT 인식 실패 코드 "+code+". 다시 말하거나 아래에 직접 입력하십시오.");destroyRecognizer();''',
'''status("HITEL 음성인식 실패 코드 "+code+
                       ". 텍스트 통화 중에는 마이크 입력이 제한될 수 있습니다. "+
                       "삼성 전화 화면의 키보드 음성 입력을 시험하거나 문장을 직접 입력하십시오.");
                    destroyRecognizer();''')
w.write_text(s,encoding="utf-8")

s=a.read_text(encoding="utf-8")
anchor='''    /** Only used after an explicit user selection. Never changes call mode by itself. */'''
assert anchor in s,"Samsung service anchor missing"
s=s.replace(anchor,'''    /** Focus the actual visible Samsung Text Call editor; never types or sends.
     * This opens the Samsung keyboard. The user, not HITEL, operates its mic.
     * No accessibility overlay and no injection into the carrier audio path. */
    public boolean focusSamsungTextCallInput(){
        try{
            AccessibilityNodeInfo input=find(P+"text_call_message_edit_text");
            if(input==null||!input.isVisibleToUser()||!input.isEnabled()){
                LabStore.log("W14_SAMSUNG_FOCUS_UNAVAILABLE",
                    "OEM input node absent/hidden/disabled, no arbitrary coordinates");
                return false;
            }
            boolean focus=input.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
            boolean click=click(input);
            LabStore.log("W14_SAMSUNG_INPUT_FOCUS",
                "focus="+focus+" click="+click+"; never typed/sent; keyboard STT manual");
            return focus||click;
        }catch(Throwable t){
            LabStore.log("W14_SAMSUNG_INPUT_FOCUS_EXCEPTION",t.toString());
            return false;
        }
    }
''' + anchor,1)
a.write_text(s,encoding="utf-8")
grad=g.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v13"' in grad
assert 'versionCode = 13' in grad
grad=grad.replace('applicationId = "app.hitel.callflowlab.v13"',
                  'applicationId = "app.hitel.callflowlab.v14"')
grad=grad.replace('versionCode = 13','versionCode = 14')
grad=grad.replace('0.13.0-first-launch-accessibility',
                  '0.14.0-fullscreen-tabs-samsung-dictation')
g.write_text(grad,encoding="utf-8")
xml=m.read_text(encoding="utf-8")
assert 'HITEL 통화 실시간 자막 v0.13 (접근성 첫 실행 안내)' in xml
xml=xml.replace('HITEL 통화 실시간 자막 v0.13 (접근성 첫 실행 안내)',
                'HITEL 통화 실시간 자막 v0.14 (통화와 로그 분리)')
m.write_text(xml,encoding="utf-8")
assert 'TYPE_ACCESSIBILITY_OVERLAY' not in s
assert 'screen.addView(logList,new LinearLayout.LayoutParams(-1,0,3))' not in w.read_text(encoding="utf-8")
print("PASS v14 separate logs tab, no floating overlay, Samsung keyboard dictation test via original call UI, independent STT diagnosis retained")
