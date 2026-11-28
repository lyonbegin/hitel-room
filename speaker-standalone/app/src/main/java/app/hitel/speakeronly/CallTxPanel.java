package app.hitel.speakeronly;

import android.Manifest;
import android.app.Activity;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.*;
import android.telephony.TelephonyManager;
import android.widget.*;
import java.io.*;
import java.net.*;
import java.security.SecureRandom;

/** Manual, selected-file-only TX UI, independent of the original live STT pipeline. */
final class CallTxPanel {
  private final Activity activity;
  private final Context app;
  private final Handler ui=new Handler(Looper.getMainLooper());
  private final Button select,send,setup;
  private final TextView info;
  private final File pcm;
  private final String token;
  private final CallTxBootstrap bootstrap;
  private volatile boolean helperReady,preparing;
  private long lastProbe=0;
  private volatile boolean converting,sending,closed;
  private volatile Socket current;
  private volatile Thread job;
  private boolean showing;
  private final Runnable refreshTick=new Runnable(){public void run(){if(showing&&!closed){refresh();ui.postDelayed(this,300);}}};
  CallTxPanel(Activity a,LinearLayout root,int picker){
    activity=a;app=a.getApplicationContext();pcm=new File(app.getFilesDir(),"call_tx_selected_48k.pcm");
    android.content.SharedPreferences prefs=app.getSharedPreferences("call_tx",0);
    String saved=prefs.getString("token","");
    if(!saved.matches("[0-9a-f]{32}")){
      byte[] random=new byte[16];new SecureRandom().nextBytes(random);
      StringBuilder b=new StringBuilder();for(byte x:random)b.append(String.format(java.util.Locale.US,"%02x",x&255));
      saved=b.toString();prefs.edit().putString("token",saved).apply();
    }token=saved;
    bootstrap=new CallTxBootstrap(app,token);
    TextView title=new TextView(a);title.setText("통화 중 녹음 음성 보내기 · In-call Music");title.setTextSize(17);root.addView(title);
    select=new Button(a);select.setText("송신할 M4A 선택 · PCM 미리 변환");root.addView(select);
    select.setOnClickListener(v->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("audio/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);a.startActivityForResult(i,picker);});
    send=new Button(a);send.setText("선택 음성 상대방에게 보내기");root.addView(send);send.setEnabled(false);send.setOnClickListener(v->start());
    setup=new Button(a);setup.setText("휴대전화 내부 송신 준비");root.addView(setup);setup.setOnClickListener(v->setupDialog());
    info=new TextView(a);info.setText(pcm.length()>0?"선택된 PCM 준비됨 · "+prefs.getString("name","M4A"):"먼저 송신할 M4A 파일을 선택하십시오.");root.addView(info);
    refresh();
  }
  private void setupDialog(){
    if(preparing||sending)return;
    new android.app.AlertDialog.Builder(activity).setTitle("휴대전화 내부 송신 준비")
      .setMessage("PC나 USB 연결은 필요하지 않습니다. 최초 1회 개발자 옵션의 무선 디버깅에서 이 앱을 페어링하십시오. 페어링 화면은 분할 화면으로 함께 열어 두십시오.")
      .setItems(new String[]{"무선 디버깅 설정 열기","최초 페어링 (포트 + 6자리 코드)","이미 페어링됨 · 자동 연결","연결 포트 직접 입력"},(d,which)->{
        if(which==0){try{activity.startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS));}catch(Exception e){status(e.getMessage());}}
        else if(which==2)prepare(0,null,0);
        else{
          LinearLayout fields=new LinearLayout(activity);fields.setOrientation(LinearLayout.VERTICAL);
          EditText port=new EditText(activity);port.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);port.setHint(which==1?"페어링 포트":"무선 디버깅 연결 포트");fields.addView(port);
          EditText code=new EditText(activity);code.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);code.setHint("6자리 페어링 코드");if(which==1)fields.addView(code);
          new android.app.AlertDialog.Builder(activity).setTitle(which==1?"최초 인증":"연결 포트").setView(fields)
            .setPositiveButton("확인",(x,y)->{try{int n=Integer.parseInt(port.getText().toString());if(which==1)prepare(0,code.getText().toString(),n);else prepare(n,null,0);}catch(Exception e){status("포트 입력 확인");}})
            .setNegativeButton("취소",null).show();
        }
      }).setNegativeButton("닫기",null).show();
  }
  private void prepare(int connectPort,String code,int pairPort){
    if(preparing||closed||sending)return;
    preparing=true;helperReady=false;refresh();
    status("휴대전화 내부 송신 준비 중");
    new Thread(()->{
      try{
        if(code!=null){bootstrap.pair(pairPort,code);status("페어링 완료 · 내부 연결 중");}
        bootstrap.start(connectPort);helperReady=bootstrap.probe();
        status(helperReady?"송신 준비 완료 · PC 연결 불필요":"송신 보조 응답 없음");
      }catch(Throwable e){helperReady=false;status("송신 준비 실패: "+e.getMessage()+" · 무선 디버깅 상태 확인");}
      finally{preparing=false;ui.post(this::refresh);}
    },"HITEL-TX-LocalBootstrap").start();
  }
  private void checkHelper(){
    if(preparing||sending||closed)return;
    long now=SystemClock.elapsedRealtime();
    if(now-lastProbe<3000)return;lastProbe=now;
    preparing=true;
    new Thread(()->{
      boolean was=helperReady;helperReady=bootstrap.probe();
      preparing=false;
      ui.post(()->{
        if(closed)return;
        refresh();
        if(!helperReady&&bootstrap.paired()&&(!was)&&lastProbe>0){
          // Auto-start once on foreground entry; subsequent retries require explicit setup.
          if(autoStartPending){autoStartPending=false;prepare(0,null,0);}
        }
      });
    },"HITEL-TX-Health").start();
  }
  private boolean autoStartPending=true;
  private boolean callUp(){
    try{
      if(app.checkSelfPermission(Manifest.permission.READ_PHONE_STATE)!=PackageManager.PERMISSION_GRANTED)return false;
      TelephonyManager tm=(TelephonyManager)app.getSystemService(Context.TELEPHONY_SERVICE);
      AudioManager am=(AudioManager)app.getSystemService(Context.AUDIO_SERVICE);
      return tm.getCallState()==TelephonyManager.CALL_STATE_OFFHOOK&&am.getMode()==AudioManager.MODE_IN_CALL
        &&app.getSharedPreferences("speaker",0).getBoolean("active",false)
        &&app.getSharedPreferences("speaker",0).getBoolean("folder",false);
    }catch(Exception e){return false;}
  }
  void visible(boolean b){showing=b;ui.removeCallbacks(refreshTick);if(b){autoStartPending=true;lastProbe=0;refreshTick.run();}}
  void refresh(){
    if(closed)return;
    if(showing)checkHelper();
    boolean direct=app.checkSelfPermission("android.permission.MODIFY_PHONE_STATE")==PackageManager.PERMISSION_GRANTED;
    boolean ready=pcm.isFile()&&pcm.length()>0;
    setup.setEnabled(!preparing&&!sending);
    setup.setText(helperReady||direct?"휴대전화 내부 송신 준비 완료":"휴대전화 내부 송신 준비");
    send.setEnabled(ready&&!converting&&!sending&&(helperReady||direct)&&callUp());
    select.setEnabled(!converting&&!sending);
    send.setText(sending?"음성 송신 중…":!helperReady&&!direct?"송신 보조 준비 필요":callUp()?"선택 음성 상대방에게 보내기":"통화 중에만 송신 가능");
  }
  private void status(String s){android.util.Log.i("HITEL_CALL_TX",s);ui.post(()->{if(!closed){info.setText(s);refresh();}});}
  void select(Uri uri){
    if(converting||sending||closed)return;
    converting=true;refresh();
    status("선택 M4A → 48kHz 모노 PCM16 변환 중");
    job=new Thread(()->{
      File temp=new File(app.getFilesDir(),"call_tx_selected.tmp");
      try{
        long n=CallTxDecode.convert(app,uri,temp);
        if(!temp.renameTo(pcm))throw new IOException("PCM 파일 교체 실패");
        app.getSharedPreferences("call_tx",0).edit().putString("name",uri.getLastPathSegment()).apply();
        status("PCM 준비 완료: "+n+" bytes · "+n/96+"ms");
      }catch(Throwable e){pcm.delete();status("변환 실패 · 송신할 M4A를 다시 선택하십시오: "+e.getMessage());}
      finally{temp.delete();converting=false;ui.post(this::refresh);}
    },"HITEL-TX-Decode");job.start();
  }
  private void start(){
    if(closed||sending||converting||!callUp()||pcm.length()<=0)return;
    sending=true;refresh();
    job=new Thread(()->{
      try{
        long n=pcm.length();
        if(app.checkSelfPermission("android.permission.MODIFY_PHONE_STATE")==PackageManager.PERMISSION_GRANTED){
          try(InputStream in=new FileInputStream(pcm)){
            CallTxPlayer.send((AudioManager)app.getSystemService(Context.AUDIO_SERVICE),in,n,()->!closed&&callUp());
          }
        }else{
          try(Socket s=new Socket()){
            current=s;s.connect(new InetSocketAddress("127.0.0.1",CallTxShell.PORT),1500);
            s.setSoTimeout((int)Math.min(650000,n/96+10000));
            DataOutputStream out=new DataOutputStream(new BufferedOutputStream(s.getOutputStream()));
            DataInputStream in=new DataInputStream(s.getInputStream());
            CallTxAuth.client(token,in,out);out.writeLong(n);out.flush();
            String ack=in.readUTF();if(!"ACCEPTED".equals(ack))throw new IOException(ack);
            try(InputStream file=new BufferedInputStream(new FileInputStream(pcm))){
              byte[] block=new byte[CallTxPlayer.BLOCK];int k;
              while((k=file.read(block))!=-1){
                if(closed||!callUp())throw new IOException("통화 종료");
                out.write(block,0,k);out.flush();
              }
            }
            String result=in.readUTF();
            if(!result.equals("LOCAL_DRAIN_COMPLETE "+n))throw new IOException(result);
          }finally{current=null;}
        }
        status("TX 트랙 재생 완료 · 상대 전화기에서 수신 여부 확인 필요");
      }catch(Throwable e){helperReady=false;status("송신 실패: "+e.getMessage()+" · 휴대전화 내부 송신 준비 확인");}
      finally{sending=false;ui.post(this::refresh);}
    },"HITEL-TX-Send");job.start();
  }
  void close(){closed=true;visible(false);Socket s=current;if(s!=null)try{s.close();}catch(IOException ignored){}Thread t=job;if(t!=null)t.interrupt();}
}
