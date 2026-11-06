package app.hitel.callnative;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.Locale;

public class VoiceLabActivity extends Activity implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean ttsReady;
    private EditText message;
    private TextView result;
    private Spinner languages;
    private final String[] tags = {"ko-KR","en-US","fr-FR","ja-JP","zh-CN"};
    private final String[] names = {"한국어","English","Français","日本語","中文"};
    private static final int MIC_REQUEST = 620;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout p = Screen.vertical(this);
        Screen.title(this, p, "Android 공통 음성 기능 시험");
        Screen.note(this,p,"01. 기기 마이크 음성 인식(STT) — 실제 통화 상대방 음성이 아닙니다.");
        result = Screen.note(this,p,"대기");
        Screen.button(this,p,"마이크에서 자막 받아오기").setOnClickListener(v -> listen());
        Screen.note(this,p,"02. 기기 로컬 음성 합성(TTS) — 상대방에게 송신하지 않습니다.");
        languages = new Spinner(this);
        languages.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
        p.addView(languages);
        message = new EditText(this);
        message.setMinLines(2); message.setHint("말할 텍스트를 입력하십시오.");
        p.addView(message);
        Screen.button(this,p,"입력 문장 기기 스피커로 읽기").setOnClickListener(v -> speak());
        Screen.button(this,p,"읽기 중단").setOnClickListener(v -> { if(tts != null) tts.stop(); });
        Screen.note(this,p,"03. 번역 및 통화 내 송신은 미연결입니다. 언어 선택은 TTS 음색 언어를 바꿀 뿐 입력 문장을 자동 번역하지 않습니다.");
        Screen.note(this,p,"기기 자체 음성인식 지원 시에만 동작합니다. 클라우드로 오디오를 전송하는 인식 엔진은 실행하지 않습니다.");
        setContentView(Screen.scroll(this,p));
        tts = new TextToSpeech(this, status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            runOnUiThread(() -> {
                if (!ttsReady) result.setText("기기 TTS 엔진을 사용할 수 없습니다.");
            });
        });
    }
    private void listen() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQUEST); return;
        }
        if (android.os.Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(this)) {
            result.setText("오프라인 음성인식 엔진이 설치되지 않았습니다. 네트워크 인식으로 대체하지 않습니다."); return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            recognizer.setRecognitionListener(this);
        }
        Intent input = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        input.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        input.putExtra(RecognizerIntent.EXTRA_LANGUAGE, tags[languages.getSelectedItemPosition()]);
        input.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        result.setText("마이크 음성인식 중…");
        recognizer.startListening(input);
    }
    private void speak() {
        if (!ttsReady || tts == null) { result.setText("TTS 엔진 미준비"); return; }
        String words = message.getText().toString().trim();
        if (words.isEmpty()) { result.setText("입력된 문장이 없습니다."); return; }
        int lang = tts.setLanguage(Locale.forLanguageTag(tags[languages.getSelectedItemPosition()]));
        if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) {
            result.setText("선택한 언어의 TTS 음성이 기기에 없습니다."); return;
        }
        android.speech.tts.Voice voice = tts.getVoice();
        if (voice == null || voice.isNetworkConnectionRequired()) {
            result.setText("오프라인 TTS 음성 모델을 사용할 수 없습니다."); return;
        }
        tts.speak(words, TextToSpeech.QUEUE_FLUSH, null, "hitel-native-test");
        result.setText("기기 로컬 TTS 재생 요청됨 — 통화 상대방 송신 아님");
    }
    private void showResult(Bundle b) {
        if (b == null) return;
        ArrayList<String> words = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (words != null && !words.isEmpty()) {
            result.setText("마이크 자막: " + words.get(0));
            message.setText(words.get(0));
        }
    }
    @Override public void onReadyForSpeech(Bundle params) { result.setText("말씀해 주십시오."); }
    @Override public void onBeginningOfSpeech() { result.setText("음성을 듣고 있습니다."); }
    @Override public void onRmsChanged(float rmsdB) { }
    @Override public void onBufferReceived(byte[] buffer) { }
    @Override public void onEndOfSpeech() { result.setText("음성인식 결과 대기 중…"); }
    @Override public void onError(int error) { result.setText("마이크 인식 오류 코드: " + error); }
    @Override public void onResults(Bundle results) { showResult(results); }
    @Override public void onPartialResults(Bundle partialResults) { showResult(partialResults); }
    @Override public void onEvent(int eventType, Bundle params) { }
    @Override public void onRequestPermissionsResult(int req,String[] p,int[] grants) {
        super.onRequestPermissionsResult(req,p,grants);
        if (req == MIC_REQUEST && grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) listen();
    }
    @Override protected void onDestroy() {
        if (recognizer != null) recognizer.destroy();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }
}
