package app.hitel.speakeronly;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.view.View;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.widget.Button;
import androidx.documentfile.provider.DocumentFile;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.File;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** Standalone Samsung growing recording -> direct Korean STT with live caption UI. */
public final class MainActivity extends Activity {
  static final int PICK_FILE=41,PICK_FOLDER=42,SAVE_ZIP=43,BLUETOOTH_PERMISSION=44,PHONE_STATE_PERMISSION=45,PICK_IXIO_MODEL=46;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private Uri selected;
  private boolean folderMode;
  private int deviceId=-1;
  private TextView header,source,detectedSource,status,deviceSummary,explanation,liveTranscript;
  private Button fileButton,folderButton,outputButton,startButton,stopButton,exportButton,openExportButton,saveAsButton,accessibilityButton,modelButton,quickTestButton;
  private boolean startQuickTestAfterPick;
  private boolean receiverRegistered;

  private final BroadcastReceiver receiver=new BroadcastReceiver(){
    @Override public void onReceive(Context c,Intent i){
      if(i==null||!SpeakerService.EVENT.equals(i.getAction()))return;
      String text=i.getStringExtra(SpeakerService.EX_TRANSCRIPT);
      if(text!=null&&liveTranscript!=null)liveTranscript.setText(text);
      String s=i.getStringExtra(SpeakerService.EX_STATUS);
      if(s!=null){
        status.setText(s);
        if(s.startsWith("녹음 중 파일 발견: "))detectedSource.setText(s);
      }
      updateButtons();
    }
  };

  TextView text(LinearLayout root,String value,int sp){
    TextView label=new TextView(this);
    label.setText(value);label.setTextSize(sp);
    label.setPadding(0,8,0,8);
    root.addView(label);
    return label;
  }
  Button button(LinearLayout root,String value){
    Button b=new Button(this);b.setText(value);root.addView(b);return b;
  }
  @Override public void onCreate(Bundle b){
    super.onCreate(b);
    deviceId=getSharedPreferences("speaker",MODE_PRIVATE).getInt("routeId",-1);
    String saved=getSharedPreferences("speaker",MODE_PRIVATE).getString("sourceUri","");
    if(!saved.isEmpty())selected=Uri.parse(saved);
    folderMode=getSharedPreferences("speaker",MODE_PRIVATE).getBoolean("folder",false);
    ScrollView scroll=new ScrollView(this);
    LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
    int padding=(int)(16*getResources().getDisplayMetrics().density);
    root.setPadding(padding,padding,padding,padding);scroll.addView(root);
    header=text(root,"삼성 통화녹음 → IXIO 원본 speechSDK STT",21);
    header.setTypeface(null,Typeface.BOLD);
    text(root,"삼성 통화녹음 파일 증가분을 16kHz PCM으로 변환하여 IXIO 원본 speechSDK.SpeechInference()에 입력합니다. HITEL14 공개 인식기는 사용하지 않습니다.",13);

    text(root,"1. IXIO 원본 STT 모델 선택 (최초 1회)",17);
    modelButton=button(root,"IXIO 원본 STT.zip 가져오기");
    modelButton.setOnClickListener(v->selectOriginalIxioSttZip());
    text(root,"IXIO 원본 STT 4.0.4 ZIP의 encoder.ort / decoder.ort / joiner.ort / tokens.txt / bpe.vocab / vad.onnx가 필요합니다. 모델이 없으면 다른 인식기로 대체하지 않습니다.",12);
    text(root,"2. 삼성 통화 녹음 폴더 지정 (최초 1회)",17);
    folderButton=button(root,"통화녹음 폴더 선택 · 최신 증가 M4A 자동 감시");
    fileButton=button(root,"저장된 M4A 직접 재생 (실시간 감지 아님 · 진단 전용)");
    source=text(root,"녹음 폴더를 선택하십시오. 이후 실행에서는 저장된 폴더를 자동 감시합니다.",13);
    detectedSource=text(root,"현재 녹음 중인 파일: 증가 확인 대기",14);
    text(root,"통화 시작(OFFHOOK) 즉시 접근성 녹음 시작을 시도하고, M4A 파일의 크기 증가를 3회 확인한 뒤 새 PCM만 STT에 전달합니다. 통화 종료(IDLE)에는 인식을 마무리합니다.",12);
    source.setTextIsSelectable(true);
    fileButton.setOnClickListener(v->choose(false));
    folderButton.setOnClickListener(v->choose(true));
    quickTestButton=button(root,"삼성 원본 녹음 M4A → IXIO STT 자동 시험");
    quickTestButton.setOnClickListener(v->startQuickTest());
    text(root,"이미 선택한 파일 또는 통화녹음 폴더 안의 '통화 녹음 100_261123_005259.m4a'를 사용합니다. 파일 접근 권한이 없는 경우에는 최초 한 번만 파일을 선택하시면 됩니다. 이 버튼은 실제 IXIO 자막이 나오는지를 시험합니다.",12);

    text(root,"3. 통화 중 녹음 자동 시작 설정",17);
    accessibilityButton=button(root,"삼성 전화 녹음 시작 보조 활성화 (접근성 설정)");
    text(root,"통화가 연결되면 접근성 서비스를 즉시 호출하여 삼성 전화의 녹음 버튼을 찾습니다. 이미 자동 녹음 중이면 버튼을 다시 누르지 않습니다. 최초 한 번 접근성 서비스 사용자가 직접 허용해야 합니다. 실제 녹음 성공은 M4A 파일이 증가할 때만 확정합니다.",12);
    accessibilityButton.setOnClickListener(v->{
      try{startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));}
      catch(Exception e){status.setText("접근성 설정 열기 실패: "+e.getMessage());}
    });

    text(root,"4. PCM을 IXIO speechSDK에 직접 전송",17);
    outputButton=button(root,"출력 선택 · 내장 스피커 / 수화부 / 블루투스 / USB-C");
    deviceSummary=text(root,"출력 장치: 자동 / 내장 스피커 우선",15);
    text(root,"AudioTrack 스피커로 재생하지 않고 16kHz PCM을 STT에 직접 전달합니다. 원래의 출력 장치 선택 기능은 이 실험에서 사용하지 않습니다.",12);
    outputButton.setOnClickListener(v->showOutputs());

    text(root,"5. 통화 이벤트 및 IXIO 실시간 STT",17);
    startButton=button(root,"통화 이벤트 자동 감시 켜기 · OFFHOOK 시 STT");
    stopButton=button(root,"통화 이벤트 자동 감시 해제");
    startButton.setOnClickListener(v->start());
    stopButton.setOnClickListener(v->stop());
    status=text(root,"대기 중",16);
    text(root,"실시간 한국어 인식 결과",17);
    liveTranscript=text(root,"아직 인식된 자막이 없습니다.",18);
    liveTranscript.setTextIsSelectable(true);
    liveTranscript.setMinLines(4);
    liveTranscript.setText(getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastTranscript","아직 인식된 자막이 없습니다."));
    status.setTextIsSelectable(true);
    explanation=text(root,
      "진단 기준: 커지는 M4A → 원본 AAC follower → Android MediaCodec → 16kHz 모노 PCM → IXIO speechSDK.SpeechInference() → 인식 자막. AudioTrack 및 MediaProjection 미사용. 원본 모델 로딩 여부·PCM 큐·초기화 상태·최종 인식 로그를 ZIP에 저장합니다.",12);
    text(root,"6. PCM → IXIO STT 인식 진단",17);
    exportButton=button(root,"진단 ZIP 다운로드에 저장 · 실제 파일 확인");
    exportButton.setOnClickListener(v->export());
    openExportButton=button(root,"저장된 ZIP 직접 열기");
    openExportButton.setOnClickListener(v->openLastExport());
    saveAsButton=button(root,"ZIP 저장 위치 직접 선택 (파일 관리자)");
    saveAsButton.setOnClickListener(v->exportToSelectedLocation());
    // The legacy output route picker is irrelevant for direct PCM STT.
    outputButton.setVisibility(View.GONE);
    deviceSummary.setVisibility(View.GONE);
    setContentView(scroll);
    if(selected!=null)source.setText((folderMode?"자동 감시 폴더: ":"직접 선택한 과거 파일: ")+selected);
    String detected=getSharedPreferences("speaker",MODE_PRIVATE).getString("detectedSource","");
    if(!detected.isEmpty())detectedSource.setText(detected);
    updateDeviceLabel();updateButtons();
    // Offline emulator regression entry: ADB injects an original (private)
    // model and a real M4A into app-private files before launching. This
    // calls exactly the same one-button test path; no fake STT result.
    if("app.hitel.speakeronly.RUN_STT_FILE".equals(getIntent().getAction())){
      String testUri=getIntent().getStringExtra("m4aUri");
      if(testUri!=null&&!testUri.isEmpty())
        ui.post(()->startFixedFileTest(Uri.parse(testUri)));
    }
    if("app.hitel.speakeronly.PROBE_IXIO_SDK".equals(getIntent().getAction())){
      new Thread(()->{
        try{
          ClassLoader loader=new DirectPcmKoreanStt(this,null,null).ixioClassLoader();
          for(String className:new String[]{
             "com.lguplus.ixispeech_ktn.speechSDK",
             "com.k2fsa.sherpa.onnx.CombinedSTTKWS",
             "com.k2fsa.sherpa.onnx.OnlineStream",
             "com.k2fsa.sherpa.onnx.OnlineStream$Companion"}){
            Class.forName(className,true,loader);
            Log.i("IXIO_SDK_PROBE","CLASS_FOUND "+className);
          }
          Class<?> sdk=loader.loadClass("com.lguplus.ixispeech_ktn.speechSDK");
          sdk.getMethod("loadSTT",String.class,String.class,
             String.class,String.class,String.class,float.class);
          sdk.getMethod("SpeechInference",float[].class,int.class,boolean.class);
          Log.i("IXIO_SDK_PROBE","PASS_ALL_ORIGINAL_IXIO_CLASSES_AND_METHODS");
          // The user's previous failure was missing original code. Check
          // the actual original arm64 native STT library independently too.
          System.loadLibrary("sherpa-onnx-jni");
          Log.i("IXIO_SDK_PROBE","PASS_ORIGINAL_IXIO_NATIVE_JNI_LOADED");
          runOnUiThread(()->status.setText("IXIO SDK 원본 클래스 로딩 성공 · STT 모델 추론 시험 별도"));
        }catch(Throwable t){
          Log.e("IXIO_SDK_PROBE","FAIL_ORIGINAL_IXIO_CLASSLOADER",t);
          runOnUiThread(()->status.setText("IXIO 원본 SDK 클래스 실패: "+t));
        }
      },"IXIO-Original-DEX-Class-Probe").start();
    }
  }

  private void selectOriginalIxioSttZip(){
    if(active())return;
    Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("application/zip");
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    startActivityForResult(intent,PICK_IXIO_MODEL);
  }

  private void startQuickTest(){
    if(active()){status.setText("이미 시험 또는 감시가 실행 중입니다. 먼저 종료하십시오.");return;}
    if(!IxioModelImporter.isReady(this)){
      status.setText("IXIO 원본 모델을 먼저 등록하십시오: IXIO_STT_Original_4.0.4.zip");
      return;
    }
    if(selected==null){
      startQuickTestAfterPick=true;
      choose(false);
      return;
    }
    if(!folderMode){
      startFixedFileTest(selected);
      return;
    }
    Uri tree=selected;
    status.setText("삼성 Recordings/Call 안의 원본 M4A 시험 파일 검색 중");
    new Thread(()->{
      try{
        DocumentFile folder=DocumentFile.fromTreeUri(this,tree);
        if(folder==null||!folder.isDirectory())throw new java.io.IOException("녹음 폴더 권한 없음");
        Uri target=null;
        DocumentFile[] all=folder.listFiles();
        for(DocumentFile child:all){
          if(child.isFile()&&"통화 녹음 100_261123_005259.m4a".equals(child.getName())){
            target=child.getUri();break;
          }
        }
        Uri found=target;
        runOnUiThread(()->{
          if(found!=null)startFixedFileTest(found);
          else{
            status.setText("시험용 원본 녹음파일이 폴더에 없습니다. 파일을 한 번 선택하십시오.");
            startQuickTestAfterPick=true;choose(false);
          }
        });
      }catch(Exception e){
        runOnUiThread(()->{
          status.setText("폴더 검색 실패: "+e.getMessage()+" · 원본 M4A 직접 선택");
          startQuickTestAfterPick=true;choose(false);
        });
      }
    },"IXIO-QuickTest-Find-Original-Recording").start();
  }

  private void startFixedFileTest(Uri file){
    if(active())return;
    if(!IxioModelImporter.isReady(this)){
      status.setText("IXIO STT.zip 원본 모델을 먼저 등록하십시오.");
      return;
    }
    // Run through the exact real production M4A -> MediaCodec -> PCM ->
    // IXIO speechSDK pipeline. No fake text, stub inference or fallback model.
    getSharedPreferences("speaker",MODE_PRIVATE).edit()
       .putBoolean("autoEnabled",false).apply();
    Intent launch=new Intent(this,SpeakerService.class)
       .setAction(SpeakerService.START)
       .putExtra(SpeakerService.EX_URI,file.toString())
       .putExtra(SpeakerService.EX_FOLDER,false)
       .putExtra(SpeakerService.EX_DEVICE,deviceId);
    try{
      if(Build.VERSION.SDK_INT>=26)startForegroundService(launch);
      else startService(launch);
      status.setText("M4A 원본 실험 시작 · 자동 PCM 변환 및 IXIO STT 텍스트 검증");
      liveTranscript.setText("IXIO speechSDK 원본 모델 초기화 중 · 결과 대기");
      ui.postDelayed(this::updateButtons,500);
    }catch(Exception e){status.setText("원본 녹음 STT 시작 실패: "+e);}
  }

  void choose(boolean folder){
    if(active())return;
    Intent intent;
    if(folder){
      intent=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    }else{
      intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
      intent.addCategory(Intent.CATEGORY_OPENABLE);
      intent.setType("audio/*");
    }
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|
        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
    startActivityForResult(intent,folder?PICK_FOLDER:PICK_FILE);
  }

  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
    super.onActivityResult(requestCode,resultCode,data);
    if(resultCode!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();
    if(requestCode==PICK_IXIO_MODEL){
      if(active()){status.setText("통화 감시 종료 후 IXIO 모델을 교체하십시오.");return;}
      status.setText("IXIO 원본 STT.zip 검사 및 설치 중");
      Uri chosen=uri;
      new Thread(()->{
        try{
          String result=IxioModelImporter.importZip(this,chosen);
          runOnUiThread(()->{status.setText(result);updateButtons();});
        }catch(Exception error){
          runOnUiThread(()->status.setText("IXIO 모델 설치 실패: "+error.getMessage()));
        }
      },"IXIO-Original-STT-Model-Import").start();
      return;
    }
    if(requestCode==PICK_FILE||requestCode==PICK_FOLDER){
      try{getContentResolver().takePersistableUriPermission(uri,
          Intent.FLAG_GRANT_READ_URI_PERMISSION);}
      catch(SecurityException e){Log.w("RecordingSpeaker","Read persist failure",e);}
      selected=uri;folderMode=requestCode==PICK_FOLDER;
      getSharedPreferences("speaker",MODE_PRIVATE).edit()
         .putString("sourceUri",uri.toString()).putBoolean("folder",folderMode).apply();
      source.setText((folderMode?"자동 감시 폴더: ":"직접 선택한 과거 파일: ")+uri);
      detectedSource.setText(folderMode?"최신 M4A 크기 증가 확인 대기":"직접 파일 재생 · 실시간 감지 아님");
      status.setText(folderMode?
        "녹음 폴더 저장 완료 · 실행하면 최신 증가 M4A를 자동으로 찾습니다.":
        "과거 파일 직접 선택됨 · 실시간 자동 감시를 원하시면 폴더를 선택하십시오.");
      updateButtons();
      if(requestCode==PICK_FILE && startQuickTestAfterPick){
        startQuickTestAfterPick=false;
        startFixedFileTest(uri);
      }
    }else if(requestCode==SAVE_ZIP){
      String id=getSharedPreferences("speaker",MODE_PRIVATE).getString("lastRunId","");
      if(id.isEmpty())return;
      File dir=new File(getFilesDir(),"diagnostics/run-"+id);
      try{
        try(OutputStream stream=getContentResolver().openOutputStream(uri,"w")){
          if(stream==null)throw new java.io.IOException("출력 파일 생성 실패");
          TraceJournal.zipDirectory(dir,stream,id);
        }
        long bytes=-1;
        try(android.os.ParcelFileDescriptor verify=getContentResolver().openFileDescriptor(uri,"r")){
          if(verify==null)throw new java.io.IOException("저장된 ZIP을 다시 열 수 없습니다");
          bytes=verify.getStatSize();
        }
        if(bytes<100)throw new java.io.IOException("저장된 ZIP 파일이 비어 있거나 없습니다: "+bytes);
        getSharedPreferences("speaker",MODE_PRIVATE).edit()
          .putString("lastExport","사용자 선택 위치 · 확인 "+bytes+"바이트")
          .putString("lastExportUri",uri.toString())
          .putLong("lastExportBytes",bytes).apply();
        status.setText("선택한 위치에 ZIP 실제 저장 확인: "+bytes+"바이트");
      }catch(Exception e){status.setText("진단 ZIP 저장 실패: "+e.getMessage());}
    }
  }

  private void updateDeviceLabel(){
    if(deviceId<0){deviceSummary.setText("출력 선택: 자동 (내장 스피커 우선)");return;}
    AudioManager audio=(AudioManager)getSystemService(AUDIO_SERVICE);
    try{
      AudioDeviceInfo target=PcmSpeakerMonitor.findDevice(audio,deviceId);
      deviceSummary.setText(target==null?
         "기존 선택 장치가 연결되지 않았습니다. 출력 선택을 다시 누르십시오.":
         "출력 선택: "+PcmSpeakerMonitor.label(target));
    }catch(SecurityException e){
      deviceSummary.setText("출력 장치 정보 접근 권한 필요");
    }
  }

  private void showOutputs(){
    if(Build.VERSION.SDK_INT>=31 &&
       checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){
      requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},BLUETOOTH_PERMISSION);
      return;
    }
    AudioManager audio=(AudioManager)getSystemService(AUDIO_SERVICE);
    final List<Integer> ids=new ArrayList<>();
    final List<String> labels=new ArrayList<>();
    ids.add(-1);labels.add("자동 선택 · 내장 스피커 우선");
    try{
      for(AudioDeviceInfo d:audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)){
        int t=d.getType();
        boolean supported=t==AudioDeviceInfo.TYPE_BUILTIN_SPEAKER ||
          t==AudioDeviceInfo.TYPE_BUILTIN_EARPIECE ||
          t==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
          t==AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
          t==AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
          t==AudioDeviceInfo.TYPE_WIRED_HEADSET ||
          t==AudioDeviceInfo.TYPE_USB_HEADSET ||
          t==AudioDeviceInfo.TYPE_USB_DEVICE;
        if(Build.VERSION.SDK_INT>=31){
          supported|=t==AudioDeviceInfo.TYPE_BLE_HEADSET||
                      t==AudioDeviceInfo.TYPE_BLE_SPEAKER;
        }
        if(!supported)continue;
        ids.add(d.getId());labels.add(PcmSpeakerMonitor.label(d));
      }
    }catch(SecurityException e){
      status.setText("블루투스 기기 조회 권한 부족: "+e.getMessage());
      return;
    }
    if(ids.size()==1)labels.add("연결된 출력 장치가 없습니다.");
    new AlertDialog.Builder(this).setTitle("실시간 음성 출력 장치")
       .setItems(labels.toArray(new String[0]),(dialog,which)->{
         if(which>=ids.size())return;
         deviceId=ids.get(which);
         getSharedPreferences("speaker",MODE_PRIVATE).edit().putInt("routeId",deviceId).apply();
         updateDeviceLabel();
         Intent route=new Intent(this,SpeakerService.class)
            .setAction(SpeakerService.ROUTE)
            .putExtra(SpeakerService.EX_DEVICE,deviceId);
         if(active())startService(route);
         else status.setText("출력 선택 완료: "+labels.get(which));
       }).setNegativeButton("닫기",null).show();
  }

  @Override public void onRequestPermissionsResult(int code,String[] perms,int[] grants){
    super.onRequestPermissionsResult(code,perms,grants);
    if(code==BLUETOOTH_PERMISSION){
      if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)showOutputs();
      else status.setText("블루투스 출력 장치 이름을 조회하려면 블루투스 연결 권한이 필요합니다.");
    }else if(code==PHONE_STATE_PERMISSION){
      if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)start();
      else status.setText("통화 자동 제어는 전화 상태 권한이 필요합니다. 전화번호나 통화기록은 읽지 않습니다.");
    }
  }

  private boolean active(){
    return getSharedPreferences("speaker",MODE_PRIVATE).getBoolean("active",false);
  }
  private void updateButtons(){
    boolean running=active();
    if(accessibilityButton!=null)
      accessibilityButton.setText(SamsungRecordAccessibility.isAvailable()?
        "삼성 통화 녹음 시작 보조 활성화됨 · 설정 열기":
        "삼성 통화 녹음 시작 보조 활성화 필요 · 설정 열기");
    startButton.setEnabled(!running&&selected!=null);
    stopButton.setEnabled(running);
    fileButton.setEnabled(!running);
    folderButton.setEnabled(!running);
    if(quickTestButton!=null)quickTestButton.setEnabled(!running);
    if(modelButton!=null){
      modelButton.setEnabled(!running);
      modelButton.setText(IxioModelImporter.isReady(this)?
        "IXIO 원본 STT 모델 준비됨 · ZIP 다시 선택":
        "IXIO 원본 STT.zip 가져오기 (필수)");
    }
    exportButton.setEnabled(!getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastRunId","").isEmpty());
    openExportButton.setEnabled(!getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastExportUri","").isEmpty());
    saveAsButton.setEnabled(!getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastRunId","").isEmpty());
    startButton.setText(folderMode?"통화 이벤트 자동 감시 켜기 · 통화 중 PCM 직접 STT":
      "선택한 M4A 파일 직접 한국어 STT (통화 연동 제외)");
    stopButton.setText(folderMode?"통화 자동 감시 해제":"수동 STT 중지");
  }
  private void start(){
    if(selected==null){status.setText("녹음 파일이나 폴더를 선택하십시오.");return;}
    if(!IxioModelImporter.isReady(this)){
      status.setText("IXIO 원본 STT 모델이 없습니다. STT.zip을 먼저 가져오십시오.");
      return;
    }
    if(active())return;
    if(folderMode && Build.VERSION.SDK_INT>=23 &&
        checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED){
      status.setText("전화 연결·종료 이벤트 감지를 위한 전화 상태 권한을 요청합니다.");
      requestPermissions(new String[]{Manifest.permission.READ_PHONE_STATE},PHONE_STATE_PERMISSION);
      return;
    }
    Intent i=new Intent(this,SpeakerService.class)
        .setAction(SpeakerService.START)
        .putExtra(SpeakerService.EX_URI,selected.toString())
        .putExtra(SpeakerService.EX_FOLDER,folderMode)
        .putExtra(SpeakerService.EX_DEVICE,deviceId);
    try{
      if(Build.VERSION.SDK_INT>=26)startForegroundService(i);
      else startService(i);
      // Explicit first-run start is consent to rearm when this UI is reopened.
      getSharedPreferences("speaker",MODE_PRIVATE).edit()
        .putBoolean("autoEnabled",folderMode).apply();
      status.setText(folderMode?
        "통화 자동 감시 시작 · OFFHOOK 후 M4A 증가 확인 → PCM 직접 STT":
        "수동 진단 직접 STT 시작");
      ui.postDelayed(this::updateButtons,600);
    }catch(Exception e){status.setText("실행 실패: "+e.getMessage());}
  }
  private void stop(){
    getSharedPreferences("speaker",MODE_PRIVATE).edit()
      .putBoolean("autoEnabled",false).apply();
    try{startService(new Intent(this,SpeakerService.class).setAction(SpeakerService.STOP));
      status.setText("자동 감시 해제 및 한국어 STT 중지 요청");}
    catch(Exception e){status.setText("중지 실패: "+e.getMessage());}
    ui.postDelayed(this::updateButtons,800);
  }
  private void export(){
    String id=getSharedPreferences("speaker",MODE_PRIVATE).getString("lastRunId","");
    if(id.isEmpty()){
      status.setText("아직 진단 세션 기록이 없습니다. 실시간 재생을 한 번 시작하십시오.");
      return;
    }
    if(Build.VERSION.SDK_INT<29){
      // Android 8/9: use the original SAF destination selection, because
      // MediaStore.Downloads direct writes were introduced in Android 10.
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/zip");
      i.putExtra(Intent.EXTRA_TITLE,"Galaxy-16kHz-AudioRoute-"+id+".zip");
      startActivityForResult(i,SAVE_ZIP);
      return;
    }
    exportButton.setEnabled(false);
    status.setText("진단 ZIP을 Downloads 폴더에 저장하고 있습니다.");
    new Thread(()->{
      try{
        TraceJournal.VerifiedExport saved=TraceJournal.saveToDownloads(this,id);
        getSharedPreferences("speaker",MODE_PRIVATE).edit()
          .putString("lastExport",saved.detail())
          .putString("lastExportUri",saved.uri.toString())
          .putLong("lastExportBytes",saved.bytes).apply();
        runOnUiThread(()->{
          status.setText("진단 ZIP 검증 완료: "+saved.detail());
          updateButtons();
        });
      }catch(Throwable error){
        Log.e("RecordingSpeaker","ZIP export failed",error);
        runOnUiThread(()->{
          status.setText("진단 ZIP 저장 실패: "+error.getMessage());
          updateButtons();
        });
      }
    },"Standalone-Diagnostic-Download-Export").start();
  }

  private void exportToSelectedLocation(){
    String id=getSharedPreferences("speaker",MODE_PRIVATE).getString("lastRunId","");
    if(id.isEmpty()){status.setText("먼저 스트리밍을 실행하십시오.");return;}
    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType("application/zip");
    intent.putExtra(Intent.EXTRA_TITLE,"Galaxy-16kHz-AudioRoute-"+id+".zip");
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
    startActivityForResult(intent,SAVE_ZIP);
  }

  private void openLastExport(){
    String address=getSharedPreferences("speaker",MODE_PRIVATE)
        .getString("lastExportUri","");
    if(address.isEmpty()){
      status.setText("검증된 ZIP이 없습니다. 저장 후 다시 실행하십시오.");
      return;
    }
    Uri uri=Uri.parse(address);
    try{
      try(android.os.ParcelFileDescriptor fd=getContentResolver().openFileDescriptor(uri,"r")){
        if(fd==null||fd.getStatSize()<100)
          throw new java.io.IOException("파일이 사라졌거나 비어 있습니다");
      }
      Intent open=new Intent(Intent.ACTION_VIEW);
      open.setDataAndType(uri,"application/zip");
      open.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivity(Intent.createChooser(open,"실제 저장된 진단 ZIP 열기"));
    }catch(Exception e){
      status.setText("저장된 ZIP 열기 실패: "+e.getMessage());
    }
  }

  @Override protected void onStart(){
    super.onStart();
    IntentFilter filter=new IntentFilter(SpeakerService.EVENT);
    if(Build.VERSION.SDK_INT>=33)registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);
    else registerReceiver(receiver,filter);
    receiverRegistered=true;
    String current=getSharedPreferences("speaker",MODE_PRIVATE).getString("status","대기 중");
    String savedZip=getSharedPreferences("speaker",MODE_PRIVATE).getString("lastExport","");
    status.setText(savedZip.isEmpty()?current:current+"\n검증된 진단 ZIP: "+savedZip);
    String detected=getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("detectedSource","");
    if(!detected.isEmpty())detectedSource.setText(detected);
    updateDeviceLabel();updateButtons();
    // Only after a user explicitly starts monitoring once. Android 12+ FGS
    // restrictions are respected because this happens while UI is foreground.
    if(selected!=null&&folderMode&&!active()&&
       getSharedPreferences("speaker",MODE_PRIVATE).getBoolean("autoEnabled",false)&&
       checkSelfPermission(Manifest.permission.READ_PHONE_STATE)==PackageManager.PERMISSION_GRANTED){
      ui.post(()->{if(!active())start();});
    }
  }
  @Override protected void onStop(){
    if(receiverRegistered){unregisterReceiver(receiver);receiverRegistered=false;}
    super.onStop();
  }
}
