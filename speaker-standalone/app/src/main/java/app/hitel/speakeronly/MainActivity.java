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
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.io.File;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/** Standalone Samsung growing recording PCM monitor. No STT UI or model. */
public final class MainActivity extends Activity {
  static final int PICK_FILE=41,PICK_FOLDER=42,SAVE_ZIP=43,BLUETOOTH_PERMISSION=44;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private Uri selected;
  private boolean folderMode;
  private int deviceId=-1;
  private TextView header,source,detectedSource,status,deviceSummary,explanation;
  private Button fileButton,folderButton,outputButton,startButton,stopButton,exportButton,openExportButton,saveAsButton;
  private boolean receiverRegistered;

  private final BroadcastReceiver receiver=new BroadcastReceiver(){
    @Override public void onReceive(Context c,Intent i){
      if(i==null||!SpeakerService.EVENT.equals(i.getAction()))return;
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
    header=text(root,"녹음 중 최신 M4A → 실시간 16kHz 스피커",21);
    header.setTypeface(null,Typeface.BOLD);
    text(root,"이 앱은 STT 모델이 없습니다. 삼성 녹음파일이 커지는 동안 AAC를 16kHz PCM으로 변환해 미디어(USAGE_MEDIA)로 출력합니다. 다른 출력음 STT 앱의 단일 앱 선택 화면에서 이 앱을 선택할 수 있도록 허용했습니다.",13);

    text(root,"1. 삼성 통화 녹음 폴더 지정 (최초 1회)",17);
    folderButton=button(root,"통화녹음 폴더 선택 · 최신 증가 M4A 자동 감시");
    fileButton=button(root,"저장된 M4A 직접 재생 (실시간 감지 아님 · 진단 전용)");
    source=text(root,"녹음 폴더를 선택하십시오. 이후 실행에서는 저장된 폴더를 자동 감시합니다.",13);
    detectedSource=text(root,"현재 녹음 중인 파일: 증가 확인 대기",14);
    text(root,"녹음 폴더와 하위 폴더에서 최신 .m4a 크기가 연속해서 증가할 때만 자동으로 재생합니다. 완료된 과거 파일은 자동 재생하지 않습니다.",12);
    source.setTextIsSelectable(true);
    fileButton.setOnClickListener(v->choose(false));
    folderButton.setOnClickListener(v->choose(true));

    text(root,"2. 출력 장치 선택",17);
    outputButton=button(root,"출력 선택 · 내장 스피커 / 수화부 / 블루투스 / USB-C");
    deviceSummary=text(root,"출력 장치: 자동 / 내장 스피커 우선",15);
    text(root,"블루투스 이어폰·스피커 또는 USB-C 오디오를 연결하면 목록에서 선택할 수 있습니다. 실제 연결된 출력 경로는 아래 상태에 표시됩니다.",12);
    outputButton.setOnClickListener(v->showOutputs());

    text(root,"3. 실시간 재생",17);
    startButton=button(root,"최신 증가 M4A 자동 감시 및 16kHz 재생");
    stopButton=button(root,"재생 중지");
    startButton.setOnClickListener(v->start());
    stopButton.setOnClickListener(v->stop());
    status=text(root,"대기 중",16);
    status.setTextIsSelectable(true);
    explanation=text(root,
      "진단 기준: 48,000Hz AAC → Android MediaCodec → 16,000Hz 모노 PCM → AudioTrack. 녹음 원본 파일은 수정하지 않습니다. 통화 중에는 Android 전화 오디오 정책에 따라 출력 장치 선택이 제한될 수 있어 요청한 장치와 실제 출력 장치를 별도로 기록합니다.",12);
    text(root,"4. 실제 출력 경로 진단",17);
    exportButton=button(root,"진단 ZIP 다운로드에 저장 · 실제 파일 확인");
    exportButton.setOnClickListener(v->export());
    openExportButton=button(root,"저장된 ZIP 직접 열기");
    openExportButton.setOnClickListener(v->openLastExport());
    saveAsButton=button(root,"ZIP 저장 위치 직접 선택 (파일 관리자)");
    saveAsButton.setOnClickListener(v->exportToSelectedLocation());
    setContentView(scroll);
    if(selected!=null)source.setText((folderMode?"자동 감시 폴더: ":"직접 선택한 과거 파일: ")+selected);
    String detected=getSharedPreferences("speaker",MODE_PRIVATE).getString("detectedSource","");
    if(!detected.isEmpty())detectedSource.setText(detected);
    updateDeviceLabel();updateButtons();
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
    }
  }

  private boolean active(){
    return getSharedPreferences("speaker",MODE_PRIVATE).getBoolean("active",false);
  }
  private void updateButtons(){
    boolean running=active();
    startButton.setEnabled(!running&&selected!=null);
    stopButton.setEnabled(running);
    fileButton.setEnabled(!running);
    folderButton.setEnabled(!running);
    exportButton.setEnabled(!getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastRunId","").isEmpty());
    openExportButton.setEnabled(!getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastExportUri","").isEmpty());
    saveAsButton.setEnabled(!getSharedPreferences("speaker",MODE_PRIVATE)
      .getString("lastRunId","").isEmpty());
    startButton.setText(folderMode?"최신 증가 M4A 자동 감시 및 16kHz 재생":
      "선택한 M4A 직접 재생 (실시간 자동 감지 아님)");
  }
  private void start(){
    if(selected==null){status.setText("녹음 파일이나 폴더를 선택하십시오.");return;}
    if(active())return;
    Intent i=new Intent(this,SpeakerService.class)
        .setAction(SpeakerService.START)
        .putExtra(SpeakerService.EX_URI,selected.toString())
        .putExtra(SpeakerService.EX_FOLDER,folderMode)
        .putExtra(SpeakerService.EX_DEVICE,deviceId);
    try{
      if(Build.VERSION.SDK_INT>=26)startForegroundService(i);
      else startService(i);
      status.setText("실시간 16kHz PCM 스트리밍 시작 요청");
      ui.postDelayed(this::updateButtons,600);
    }catch(Exception e){status.setText("실행 실패: "+e.getMessage());}
  }
  private void stop(){
    try{startService(new Intent(this,SpeakerService.class).setAction(SpeakerService.STOP));
      status.setText("스트리밍 종료 요청");}
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
  }
  @Override protected void onStop(){
    if(receiverRegistered){unregisterReceiver(receiver);receiverRegistered=false;}
    super.onStop();
  }
}
