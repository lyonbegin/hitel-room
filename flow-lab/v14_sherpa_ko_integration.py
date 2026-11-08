from pathlib import Path
base=Path("AndroidProject/app/src/main")
src=base/"java/app/hitel/samsungprobe"
w=src/"W03ConsoleActivity.java"
g=Path("AndroidProject/app/build.gradle.kts")
m=base/"AndroidManifest.xml"
settings=Path("AndroidProject/settings.gradle.kts")
s=w.read_text(encoding="utf-8")
def sub(a,b):
    global s
    assert a in s,"missing anchor: "+a[:140]
    s=s.replace(a,b,1)

sub('''    private ScrollView scrollBody;''',
'''    private KoreanSherpaStt koreanSherpa;
    private ScrollView scrollBody;''')
sub('''        sttButton=btn("말하기 → 삼성 전화",this::openSamsungSpeechEntry);
        Button nativeStt=btn("HITEL STT 별도 시험",this::startSpeech);
        addButtonRow(content,sttButton,nativeStt);
        content.addView(label(
           "삼성 텍스트 통화 중 HITEL STT는 이 기기에서 오류 7이 반복되었습니다. "+
           "말하기를 누르면 삼성 통화 화면을 열고 원본 문자 입력창에 키보드를 띄웁니다. "+
           "키보드 마이크가 나타나면 직접 눌러 음성 입력을 시험하십시오. "+
           "텍스트 통화 중에는 삼성 키보드 STT도 제한될 수 있습니다.",12,false));
        Button stop=btn("HITEL 음성인식 중지",this::stopSpeech);
        content.addView(stop,new LinearLayout.LayoutParams(-1,dp(44)));''',
'''        sttButton=btn("🎙 한국어 말하기 · HITEL 직접 STT",this::startKoreanSherpaSpeech);
        Button stop=btn("마이크 인식 중지",this::stopKoreanSherpaSpeech);
        addButtonRow(content,sttButton,stop);
        content.addView(label(
           "한국어 Zipformer INT8 · sherpa-onnx 네이티브 인식. "+
           "최초 실행 시 한국어 모델 약 144MB를 공식 출처에서 자동 다운로드하며 이후 오프라인 동작합니다. "+
           "이 버튼은 삼성 전화 화면으로 이동하지 않고 이곳에서 마이크를 읽습니다. "+
           "통화 중 삼성 오디오 정책으로 무음 처리될 가능성은 실제 PCM 기록으로 판정합니다.",12,false));
        Button nativeStt=btn("기존 시스템 STT 별도 진단",this::startSpeech);
        Button samsungEntry=btn("삼성 문자 입력창 보기",this::openSamsungSpeechEntry);
        addButtonRow(content,nativeStt,samsungEntry);''')
sub('''    /** User explicitly requests Samsung's real phone UI for speech input.''',
'''    /** Primary microphone action: native Korean streaming ASR inside HITEL, no dialer change. */
    private void startKoreanSherpaSpeech(){
        if(!recordStarted)return;
        if(koreanSherpa!=null&&koreanSherpa.isRunning()){
            stopKoreanSherpaSpeech();return;
        }
        if(!has(Manifest.permission.RECORD_AUDIO)){
            log("SHERPA_KO_PERMISSION_REQUEST","Request Android microphone permission");
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},604);
            return;
        }
        koreanSherpa=new KoreanSherpaStt(getApplicationContext(),new KoreanSherpaStt.Listener(){
            @Override public void onState(String phase,String messageText){
                log("SHERPA_KO_"+phase,messageText);
                ui.post(()->{
                    if(isFinishing())return;
                    status(messageText);
                    sttButton.setText("STOP".equals(phase)||"LISTENING".equals(phase)||
                        "MODEL_DOWNLOAD".equals(phase)||"INITIALIZING".equals(phase)?
                        "■ 한국어 마이크 중지":"🎙 한국어 말하기 · HITEL 직접 STT");
                });
            }
            @Override public void onPartial(String text){
                ui.post(()->{
                    if(isFinishing())return;
                    status("한국어 듣는 중: "+text);
                });
            }
            @Override public void onFinal(String text){
                ui.post(()->{
                    if(isFinishing()||text==null||text.isBlank())return;
                    String old=message.getText().toString().trim();
                    String joined=old.isEmpty()?text:old+"\n"+text;
                    message.setText(joined);
                    message.setSelection(joined.length());
                    lastSttResult=joined;
                    sttSucceeded=true;
                    log("SHERPA_KO_RESULT",text);
                    step(3,"내 음성 인식","UNVERIFIED","sherpa-onnx 실제 디코딩: "+text+
                        "; 발화 정확도와 삼성 통화 중 입력 품질은 실기기 검증 필요");
                });
            }
        });
        log("SHERPA_KO_USER_START","User pressed HITEL microphone; Korean only; no Samsung keyboard");
        sttButton.setText("■ 한국어 마이크 중지");
        status("한국어 sherpa-onnx 초기화 중입니다. 최초 1회 모델 다운로드가 필요할 수 있습니다.");
        koreanSherpa.start();
    }
    private void stopKoreanSherpaSpeech(){
        if(koreanSherpa!=null)koreanSherpa.stop();
        sttButton.setText("🎙 한국어 말하기 · HITEL 직접 STT");
        log("SHERPA_KO_USER_STOP","User stopped native microphone");
    }

    /** User explicitly requests Samsung's real phone UI for speech input.''')
sub('''            if(req==601)placeCall();else if(req==602)startSpeech();else if(req==603)refreshState();''',
'''            if(req==601)placeCall();else if(req==602)startSpeech();
            else if(req==603)refreshState();else if(req==604)startKoreanSherpaSpeech();''')
sub('''        ui.removeCallbacks(poll);destroyRecognizer();io.shutdown();''',
'''        ui.removeCallbacks(poll);destroyRecognizer();
        if(koreanSherpa!=null)koreanSherpa.stop();
        io.shutdown();''')
sub('''        sttButton.setEnabled(recordStarted);''',
'''        sttButton.setEnabled(recordStarted);''')
w.write_text(s,encoding="utf-8")
grad=g.read_text(encoding="utf-8")
assert 'plugins { id("com.android.application") }' in grad
grad=grad.replace('plugins { id("com.android.application") }',
'''plugins { id("com.android.application") }''',1)
assert 'versionCode = 14' in grad
grad=grad.replace('versionCode = 14','versionCode = 15',1)
grad=grad.replace('versionName = "0.14.0-fullscreen-tabs-samsung-dictation"',
                  'versionName = "0.14.1-sherpa-ko-mic"',1)
grad=grad.replace('''    compileOptions {''',
'''    defaultConfig {
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    compileOptions {''',1)
grad += '''
dependencies {
    implementation("com.github.k2-fsa:sherpa-onnx:1.12.26")
}
'''
g.write_text(grad,encoding="utf-8")
sett=settings.read_text(encoding="utf-8")
assert 'repositories { google(); mavenCentral() }' in sett
sett=sett.replace('repositories { google(); mavenCentral() }','repositories { google(); mavenCentral(); maven("https://jitpack.io") }',1)
settings.write_text(sett,encoding="utf-8")
manifest=m.read_text(encoding="utf-8")
manifest=manifest.replace('HITEL 통화 실시간 자막 v0.14 (통화와 로그 분리)',
    'HITEL 통화 실시간 자막 v0.14 (한국어 STT)')
m.write_text(manifest,encoding="utf-8")
assert 'SHERPA_KO_USER_START' in w.read_text(encoding="utf-8")
print("PASS: original v14 package, original branch, native sherpa microphone button, model auto-download")
