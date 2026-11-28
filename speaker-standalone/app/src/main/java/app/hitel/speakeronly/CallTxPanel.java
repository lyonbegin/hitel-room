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
    TextView title=new TextView(a);title.setText("통화 중 녹음 음성 보내기 · In-call Music");title.setTextSize(17);root.addView(title);
    select=new Button(a);select.setText("송신할 M4A 선택 · PCM 미리 변환");root.addView(select);
    select.setOnClickListener(v->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("audio/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);a.startActivityForResult(i,picker);});
    send=new Button(a);send.setText("선택 음성 상대방에게 보내기");root.addView(send);send.setEnabled(false);send.setOnClickListener(v->start());
    setup=new Button(a);setup.setText("송신 보조 ADB 시작 명령 복사");root.addView(setup);setup.setOnClickListener(v->copyCommand());
    info=new TextView(a);info.setText(pcm.length()>0?"선택된 PCM 준비됨 · "+prefs.getString("name","M4A"):"먼저 송신할 M4A 파일을 선택하십시오.");root.addView(info);
    refresh();
  }
  private void copyCommand(){
    String command=".\\adb.exe shell 'APK=$(pm path "+app.getPackageName()+" | head -n 1 | cut -c9-); CLASSPATH=\"$APK\" app_process /system/bin app.hitel.speakeronly.CallTxShell "+token+"'";
    android.content.ClipboardManager clip=(android.content.ClipboardManager)app.getSystemService(Context.CLIPBOARD_SERVICE);
    clip.setPrimaryClip(ClipData.newPlainText("HITEL TX ADB",command));
    info.setText("PowerShell에서 복사된 명령 실행 · HITEL_CALL_TX_READY 확인. 이 보조 프로세스는 휴대전화 내부에서만 동작합니다.");
  }
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
  void visible(boolean b){showing=b;ui.removeCallbacks(refreshTick);if(b)refreshTick.run();}
  void refresh(){
    if(closed)return;
    boolean ready=pcm.isFile()&&pcm.length()>0;
    send.setEnabled(ready&&!converting&&!sending&&callUp());
    select.setEnabled(!converting&&!sending);
    send.setText(sending?"음성 송신 중…":callUp()?"선택 음성 상대방에게 보내기":"통화 중에만 송신 가능");
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
      }catch(Throwable e){status("변환 실패 (이전 선택 PCM 유지): "+e.getMessage());}
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
            out.writeUTF(token);out.writeLong(n);out.flush();
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
      }catch(Throwable e){status("송신 실패: "+e.getMessage()+" · ADB 보조 실행/통화 TX 경로 확인");}
      finally{sending=false;ui.post(this::refresh);}
    },"HITEL-TX-Send");job.start();
  }
  void close(){closed=true;visible(false);Socket s=current;if(s!=null)try{s.close();}catch(IOException ignored){}Thread t=job;if(t!=null)t.interrupt();}
}
