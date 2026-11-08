from pathlib import Path

base=Path("AndroidProject")
w=base/"app/src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java"
g=base/"app/build.gradle.kts"
s=w.read_text(encoding="utf-8")
def sub(old,new):
    global s
    assert old in s, "W03 streaming anchor missing "+old[:100]
    s=s.replace(old,new,1)

# The existing microphone engine emits onPartial() BEFORE user pauses.
# W03 only displayed those words in status(), never in the editable transcript.
# Keep one committed base and one replaceable draft: no repeated/duplicated text.
sub('''    private TextView pinnedMicState;''',
'''    private TextView pinnedMicState;
    private TextView pinnedLiveCaption;
    private String sherpaCommittedText="";
    private String sherpaLiveDraft="";''')

sub('''        screen.addView(pinnedMicState,4,new LinearLayout.LayoutParams(-1,dp(52)));''',
'''        screen.addView(pinnedMicState,4,new LinearLayout.LayoutParams(-1,dp(52)));
        // Persistent, live, TOP-LEVEL caption: unaffected by status text and call polling.
        pinnedLiveCaption=label("내 목소리 실시간 자막 · 마이크를 누르시면 여기에 나타납니다.",14,true);
        pinnedLiveCaption.setMaxLines(3);
        pinnedLiveCaption.setPadding(dp(9),dp(7),dp(9),dp(7));
        pinnedLiveCaption.setBackgroundColor(0xffeeeeee);
        screen.addView(pinnedLiveCaption,5,new LinearLayout.LayoutParams(-1,dp(70)));''')

sub('''        screen.addView(voxSettings,5,new LinearLayout.LayoutParams(-1,dp(48)));''',
'''        screen.addView(voxSettings,6,new LinearLayout.LayoutParams(-1,dp(48)));''')

sub('''        koreanSherpa=new KoreanSherpaStt(getApplicationContext(),new KoreanSherpaStt.Listener(){''',
'''        // Preserve manually entered text and previous committed sentences.
        sherpaCommittedText=message.getText().toString().trim();
        sherpaLiveDraft="";
        if(pinnedLiveCaption!=null)pinnedLiveCaption.setText("내 음성 인식 준비 중...");
        if(koreanSherpa==null)koreanSherpa=new KoreanSherpaStt(getApplicationContext(),new KoreanSherpaStt.Listener(){''')

sub('''            @Override public void onPartial(String text){
                ui.post(()->{
                    if(isFinishing())return;
                    status("한국어 듣는 중: "+text);
                });
            }''',
'''            @Override public void onPartial(String text){
                // Partial tokens are provisional; replace only the live draft.
                // DO NOT wait for sherpa-onnx endpoint / end of sentence.
                ui.post(()->{
                    if(isFinishing()||text==null||text.isBlank())return;
                    sherpaLiveDraft=text;
                    String rendered=sherpaCommittedText.isEmpty()?text:
                        sherpaCommittedText+System.lineSeparator()+text;
                    message.setText(rendered);
                    message.setSelection(rendered.length());
                    if(pinnedLiveCaption!=null)
                        pinnedLiveCaption.setText("🎙 내 목소리 · 인식 중"+System.lineSeparator()+text);
                    status("한국어 실시간 인식 중 · 문장이 끝나기 전부터 계속 표시됩니다.");
                });
            }''')

sub('''            @Override public void onFinal(String text){
                ui.post(()->{
                    if(isFinishing()||text==null||text.isBlank())return;
                    String old=message.getText().toString().trim();
                    String joined=old.isEmpty()?text:old+"\\n"+text;
                    message.setText(joined);
                    message.setSelection(joined.length());
                    lastSttResult=joined;
                    sttSucceeded=true;
                    log("SHERPA_KO_RESULT",text);
                    step(3,"내 음성 인식","UNVERIFIED","sherpa-onnx 실제 디코딩: "+text+
                        "; 발화 정확도와 삼성 통화 중 입력 품질은 실기기 검증 필요");
                });
            }''',
'''            @Override public void onFinal(String text){
                ui.post(()->{
                    if(isFinishing()||text==null||text.isBlank())return;
                    // Replace last partial with the final hypothesis; do not append
                    // a second copy of words already rendered during streaming.
                    String joined=sherpaCommittedText.isEmpty()?text:
                        sherpaCommittedText+System.lineSeparator()+text;
                    sherpaCommittedText=joined;
                    sherpaLiveDraft="";
                    message.setText(joined);
                    message.setSelection(joined.length());
                    if(pinnedLiveCaption!=null)
                        pinnedLiveCaption.setText("✓ 내 음성 확정"+System.lineSeparator()+text);
                    lastSttResult=joined;
                    sttSucceeded=true;
                    log("SHERPA_KO_RESULT",text);
                    step(3,"내 음성 인식","UNVERIFIED","sherpa-onnx 실제 디코딩: "+text+
                        "; 발화 정확도와 삼성 통화 중 입력 품질은 실기기 검증 필요");
                });
            }''')

# Add listener lifecycle handling while preserving original VoxSherpa module.
sub('''        sttButton.setText("🎙 한국어 말하기 · HITEL 직접 STT");
        log("SHERPA_KO_USER_STOP"''',
'''        sttButton.setText("🎙 한국어 말하기 · HITEL 직접 STT");
        if(pinnedLiveCaption!=null)pinnedLiveCaption.setText("내 음성 인식 중지 · 마지막 결과 저장 중");
        log("SHERPA_KO_USER_STOP"''')

assert s.count('if(koreanSherpa==null)koreanSherpa=new')==1
assert 'sherpaCommittedText+System.lineSeparator()+text' in s
assert 'screen.addView(voxSettings,6' in s
assert 'screen.addView(pinnedLiveCaption,5' in s
w.write_text(s,encoding="utf-8")

grad=g.read_text(encoding="utf-8")
assert 'applicationId = "app.hitel.callflowlab.v14"' in grad
assert 'versionCode = 17' in grad
grad=grad.replace('versionCode = 17','versionCode = 18',1)
grad=grad.replace('0.14.3-pinned-voice-vox-controls','0.14.4-live-streaming-partial-caption',1)
g.write_text(grad,encoding="utf-8")
print("PASS streamed sherpa partial text renders in pinned live captions and W03 editable transcript before speech endpoint; no duplicate final")
