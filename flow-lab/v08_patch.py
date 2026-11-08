from pathlib import Path
p=Path('AndroidProject')
s=p/'app/src/main/java/app/hitel/samsungprobe/CallAccessibilityService.java'
w=p/'app/src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java'
def fix(file,old,new):
 t=file.read_text(encoding='utf-8')
 assert old in t,(file,old[:100]);file.write_text(t.replace(old,new,1),encoding='utf-8')
fix(s,'if(!relevant(pkg))return;\n            if(isSamsung(pkg))synchronized(lock){','''// Exclude HITEL's own UI events: otherwise 500ms polling generates a log-event feedback loop.
            if(!isSamsung(pkg)){
                if(event.getEventType()==AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
                    synchronized(lock){state.foregroundPackage=pkg;state.scannedAt=System.currentTimeMillis();}
                return;
            }
            synchronized(lock){''')
fix(s,'boolean bg=!isSamsung(activePkg());','boolean bg=isHitelForeground();')
fix(s,'private String activePkg(){AccessibilityNodeInfo x=getRootInActiveWindow();return x==null?"":s(x.getPackageName());}','''private String activePkg(){AccessibilityNodeInfo x=getRootInActiveWindow();return x==null?"":s(x.getPackageName());}
    public boolean isHitelForeground(){return activePkg().startsWith("app.hitel.callflowlab");}''')
fix(s,'String nodeKey=id+"|window="+n.getWindowId()+"|node="+n.hashCode();','''String unique=n.getUniqueId();
        String nodeKey=id+"|window="+n.getWindowId()+"|"+
           (unique==null||unique.isBlank()?"node="+n.hashCode():"unique="+unique);
        // A previously accessible window scan is NOT a new OEM background event.
        boolean provenBackground=background&&source.startsWith("event:");''')
fix(s,'if(background)state.remoteBackgroundCount++;','if(provenBackground)state.remoteBackgroundCount++;')
fix(s,'if(background){state.lastBackgroundTranscriptAt=now;state.backgroundMessageCount++;}','if(provenBackground){state.lastBackgroundTranscriptAt=now;state.backgroundMessageCount++;}')
fix(s,'LabStore.transcript(direction,id,txt,background,nodeKey,update,source);','LabStore.transcript(direction,id,txt,provenBackground,nodeKey,update,source);')
fix(s,'LabStore.log(background?"TRANSCRIPT_BACKGROUND":"TRANSCRIPT",','LabStore.log(provenBackground?"TRANSCRIPT_BACKGROUND_EVENT":"TRANSCRIPT",')
# Some Samsung accessibility callbacks contain the utterance in event text even if their source TextView is empty.
fix(s,'''                harvest(source,bg,0,new int[]{0},"event:"+event.getEventType());''','''                String eventOrigin="event:"+event.getEventType();
                harvest(source,bg,0,new int[]{0},eventOrigin);
                String nodeId=s(source.getViewIdResourceName());
                if(isTranscript(nodeId)&&s(source.getText()).isEmpty()&&event.getText()!=null){
                    for(CharSequence text:event.getText())if(text!=null&&!text.toString().isBlank())
                        captureTranscript(source,nodeId,text.toString(),bg,eventOrigin+":event_text");
                }''')
# Track current vs historic Text Call node, rather than relying on sticky textCall flag.
fix(s,'public long lastSamsungWindowAt;','public long lastSamsungWindowAt,lastTextCallVisibleAt;')
fix(s,'b.lastSamsungWindowAt=lastSamsungWindowAt;b.lastEventSource=lastEventSource;','b.lastSamsungWindowAt=lastSamsungWindowAt;b.lastTextCallVisibleAt=lastTextCallVisibleAt;b.lastEventSource=lastEventSource;')
fix(s,'state.lastSamsungWindowAt=state.samsungEventCount=state.backgroundMessageCount=0;','state.lastSamsungWindowAt=state.lastTextCallVisibleAt=state.samsungEventCount=state.backgroundMessageCount=0;')
fix(s,'if(id.equals(P+"text_call_message_edit_text")){state.textCall=true;state.localTextPresent=!txt.isEmpty();}','if(id.equals(P+"text_call_message_edit_text")){state.textCall=true;state.lastTextCallVisibleAt=System.currentTimeMillis();state.localTextPresent=!txt.isEmpty();}')
fix(s,'if(isTranscript(id)&&!txt.isEmpty())captureTranscript(n,id,txt,bg,origin);','''if(id.equals(P+"text_call_message_edit_text"))synchronized(lock){state.textCall=true;state.lastTextCallVisibleAt=System.currentTimeMillis();}
        if(isTranscript(id)&&!txt.isEmpty())captureTranscript(n,id,txt,bg,origin);''')
# Probe PASS requires actual Samsung-origin remote messages after HITEL is in foreground.
fix(w,'private long backgroundProbeBaseline=0;','private long backgroundProbeBaseline=0,backgroundProbeRemoteBaseline=0;')
fix(w,'''               snapshot.backgroundMessageCount>backgroundProbeBaseline &&''','''               snapshot.backgroundMessageCount>backgroundProbeBaseline &&
               snapshot.remoteBackgroundCount-backgroundProbeRemoteBaseline>=2 &&''')
fix(w,'''        CallAccessibilityService.Snapshot snap=a.snapshot();
        backgroundProbeBaseline=snap.backgroundMessageCount;''','''        if(!a.isHitelForeground()){
            status("HITEL 화면을 전면에 띄운 상태에서 시험해 주십시오.");return;
        }
        CallAccessibilityService.Snapshot snap=a.snapshot();
        backgroundProbeRemoteBaseline=snap.remoteBackgroundCount;
        backgroundProbeBaseline=snap.backgroundMessageCount;''')
fix(w,'status("지금 우리 앱을 계속 보시면서 상대방께 새로운 문장 두 개를 말씀해 달라고 요청하십시오. 15초 동안 실제 이벤트를 검사합니다.");','status("HITEL 전면 상태를 유지한 채 상대방께 서로 다른 새 문장 두 개를 말씀해 달라고 요청하십시오. 실제 삼성 원문 이벤트 2건을 검사합니다.");')
fix(w,'String support=s.textCall?"삼성 문자 입력 노드 관측됨(숨긴 화면 접근은 미보장)":"입력 노드 아직 확인 안 됨";','''long nodeAge=s.lastTextCallVisibleAt==0?Long.MAX_VALUE:System.currentTimeMillis()-s.lastTextCallVisibleAt;
            String support=nodeAge<5000?"최근 삼성 문자 입력 노드 관측됨":"현재 삼성 문자 입력 노드 미확인(과거 기록 보존)";''')
manifest=p/'app/src/main/AndroidManifest.xml';fix(manifest,'HITEL 통화 실시간 자막 v0.7','HITEL 통화 실시간 자막 v0.8')
gradle=p/'app/build.gradle.kts';fix(gradle,'versionCode = 7','versionCode = 8');fix(gradle,'versionName = "0.7.0-live-samsung-transcript"','versionName = "0.8.0-live-samsung-event-proof"')
print('PASS v0.8: all source anchors matched; previous package ID retained for APK update')
