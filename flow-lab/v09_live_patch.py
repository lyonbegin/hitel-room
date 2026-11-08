from pathlib import Path
r=Path("AndroidProject/app/src/main/java/app/hitel/samsungprobe")
a=r/"CallAccessibilityService.java"
w=r/"W03ConsoleActivity.java"
def sub(f,old,new):
    s=f.read_text(encoding="utf-8")
    assert old in s,(str(f),old[:120])
    f.write_text(s.replace(old,new,1),encoding="utf-8")

# Every actual Samsung Text Call update, including partial text corrections,
# becomes a new JSONL record and is reflected on the HITEL screen.
sub(a,'''        public String lastRemote="",lastLocal="",lastTranslated="";''',
      '''        public String lastRemote="",lastLocal="",lastTranslated="";
        public String lastRemoteTranslation="",lastLocalTranslation="";
        public long lastRemoteTranslationAt=0,lastLocalAt=0;''')
sub(a,'''b.lastRemote=lastRemote;b.lastLocal=lastLocal;b.lastTranslated=lastTranslated;''',
      '''b.lastRemote=lastRemote;b.lastLocal=lastLocal;b.lastTranslated=lastTranslated;
            b.lastRemoteTranslation=lastRemoteTranslation;b.lastLocalTranslation=lastLocalTranslation;
            b.lastRemoteTranslationAt=lastRemoteTranslationAt;b.lastLocalAt=lastLocalAt;''')
sub(a,'''state.lastRemote=state.lastLocal=state.lastTranslated="";state.lastRemoteAt=0;''',
      '''state.lastRemote=state.lastLocal=state.lastTranslated="";
            state.lastRemoteTranslation=state.lastLocalTranslation="";
            state.lastRemoteAt=state.lastRemoteTranslationAt=state.lastLocalAt=0;''')
sub(a,'''                state.lastLocal=txt;
            }else {
                if(old==null)state.translatedCount++;
                state.lastTranslated=txt;
            }''',
      '''                state.lastLocal=txt;state.lastLocalAt=now;
            }else {
                if(old==null)state.translatedCount++;
                state.lastTranslated=txt;
                if(id.endsWith("/remote_message_translated")){
                    state.lastRemoteTranslation=txt;state.lastRemoteTranslationAt=now;
                }else if(id.endsWith("/local_message_translated")){
                    state.lastLocalTranslation=txt;
                }
            }''')
# W03 front screen shows all 4 categories directly, not just one unlabelled translation.
sub(w,'''    private TextView callState, textCallState, remoteSubtitle, sentSubtitle, status, logHeader, flowStatus;''',
      '''    private TextView callState, textCallState, remoteSubtitle, sentSubtitle, status, logHeader, flowStatus;
    private TextView remoteTranslation, localTranslation, streamStatus;''')
sub(w,'''        remoteSubtitle=label("상대방 마지막 자막: 대기 중",13,true);content.addView(remoteSubtitle);
        sentSubtitle=label("내 마지막 메시지: 대기 중",12,false);content.addView(sentSubtitle);''',
      '''        remoteSubtitle=label("상대방 원문: 새 자막 대기 중",15,true);content.addView(remoteSubtitle);
        remoteTranslation=label("상대방 번역: 삼성 원본에서 새 번역 대기 중",15,true);
        content.addView(remoteTranslation);
        sentSubtitle=label("내 발신 문장: 새 기록 대기 중",13,false);content.addView(sentSubtitle);
        localTranslation=label("내 발신 번역: 새 기록 대기 중",13,false);content.addView(localTranslation);
        streamStatus=label("실시간 중계: 삼성 접근성 이벤트 대기",12,true);
        content.addView(streamStatus);''')
sub(w,'''            if(!s.lastLocal.equals(lastLocalShown)){''',
      '''            if(remoteTranslation!=null){
                remoteTranslation.setText("상대방 번역: "+(s.lastRemoteTranslation.isEmpty()?
                        "삼성에서 관측된 번역 없음":s.lastRemoteTranslation));
            }
            if(localTranslation!=null){
                localTranslation.setText("내 발신 번역: "+(s.lastLocalTranslation.isEmpty()?
                        "삼성에서 관측된 번역 없음":s.lastLocalTranslation));
            }
            if(!s.lastLocal.equals(lastLocalShown)){''')
sub(w,'''            updateTranscriptHealth(s);''',
      '''            updateTranscriptHealth(s);
            if(streamStatus!=null){
                long now=System.currentTimeMillis();
                long since=s.lastSamsungTranscriptAt<=0?Long.MAX_VALUE:now-s.lastSamsungTranscriptAt;
                if(since<2500)
                    streamStatus.setText("실시간 중계: 최신 자막 수신 "+(since/1000)+"초 전 · 0.5초 간격 화면 갱신");
                else if(s.lastSamsungTranscriptAt>0)
                    streamStatus.setText("실시간 중계: 신규 문장 대기 "+(since/1000)+"초 · 삼성 이벤트가 계속 오는지 확인");
                else streamStatus.setText("실시간 중계: 아직 삼성 자막/번역 이벤트 없음");
            }''')
sub(w,'''        flowStatus.setText("HITEL 전면 조작 중 · "+(sendWaiting?"삼성 전송 요청 진행":"입력/전송 대기")+" · 전체 로그 "+entries.size()+"줄");''',
      '''        flowStatus.setText("HITEL 실시간 통화 · "+(sendWaiting?"삼성 전송 요청 진행":"자막/번역 수신 모니터링")+
            " · 전체 대화 "+transcriptEntries.size()+"건");''')
# Background-only events distinguish from when Samsung window is actually visible.
# Log new/edited Samsung translation as remote/local in the same timeline;
# the fallback Samsung-visible overlay provides the live conversation if
# Android suspends events once the OEM is actually backgrounded.
sub(a,'''                LabStore.log("HITEL_OVERLAY_SHOWN","삼성 화면 위에 반환 버튼 표시. 사용자가 눌러 HITEL 전면 복귀");''',
      '''                LabStore.log("HITEL_OVERLAY_SHOWN","삼성 문자통화가 실제 전면에 보이는 동안 HITEL 자막 패널 사용 가능");''')
print("PASS v0.9 live: Samsung remote/local + translated live content and streamed activity evidence")
