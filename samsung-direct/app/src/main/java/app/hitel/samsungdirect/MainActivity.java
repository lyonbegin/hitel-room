package app.hitel.samsungdirect;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import android.os.Looper;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private AudioManager audio;
    private TextView output;
    private final StringBuilder logs = new StringBuilder();
    private boolean changed;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        audio=(AudioManager)getSystemService(Context.AUDIO_SERVICE);
        ScrollView scroll=new ScrollView(this);
        LinearLayout layout=new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(20,20,20,20);
        scroll.addView(layout);
        TextView title=new TextView(this);
        title.setText("삼성 Call Assistant 오디오 호출 시험");
        title.setTextSize(21);
        layout.addView(title);
        TextView note=new TextView(this);
        note.setText("원본 Call Assistant 15.1.00.73에서 확인된 오디오 API와 파라미터를 직접 호출합니다.\n기본 전화 앱·어시스턴트는 변경하지 않습니다.\n호출 성공 ≠ 실제 통화 제어 성공. 통화 테스트 후 '원상복구'를 누르십시오.");
        layout.addView(note);
        add(layout,"1. 현재 파라미터 읽기",v->readParams());
        add(layout,"2. 통역 모드 ON  (l_call_translation_mode=on)",v->setParam("l_call_translation_mode","on"));
        add(layout,"3. 통역 모드 OFF (l_call_translation_mode=off)",v->setParam("l_call_translation_mode","off"));
        add(layout,"4. 송신 원음 차단 요청  (l_voice_tx_control_mode=1)",v->setParam("l_voice_tx_control_mode","1"));
        add(layout,"5. 송신 원음 감쇄 요청  (l_voice_tx_control_mode=2)",v->setParam("l_voice_tx_control_mode","2"));
        add(layout,"6. 정상 송신 복원  (l_voice_tx_control_mode=0)",v->setParam("l_voice_tx_control_mode","0"));
        add(layout,"7. 삼성 semIsScreenCallEnabled 조회",v->screenCallRead());
        add(layout,"8. 삼성 semSetScreenCallEnabled(true) 요청",v->screenCallSet(true));
        add(layout,"9. 삼성 semSetScreenCallEnabled(false) 요청",v->screenCallSet(false));
        add(layout,"10. VOICE_TX 태그 AudioTrack 2초 톤 시험",v->voiceTx());
        add(layout,"원상복구 (송신 NORMAL / 통역 OFF / ScreenCall OFF)",v->resetAll());
        add(layout,"검사 로그 복사",v->copy());
        output=new TextView(this);
        output.setTextSize(12);
        output.setTextIsSelectable(true);
        layout.addView(output);
        setContentView(scroll);
        line("Model="+Build.MANUFACTURER+" "+Build.MODEL+" Android="+Build.VERSION.RELEASE);
        line("원본 근거: Li5/c; setParameters + Li5/k; VOICE_TX + Li5/d; semAddAudioTag");
        line("MODIFY_AUDIO_SETTINGS="+(checkSelfPermission("android.permission.MODIFY_AUDIO_SETTINGS")==android.content.pm.PackageManager.PERMISSION_GRANTED?"GRANTED":"DENIED"));
        line("AudioManager mode="+audio.getMode()+" (2=IN_CALL, 0=NORMAL)");
        readParams();
    }
    private void add(LinearLayout col,String label,View.OnClickListener callback){
        Button b=new Button(this);
        b.setAllCaps(false);
        b.setText(label);
        b.setOnClickListener(callback);
        col.addView(b);
    }
    private synchronized void line(String str){
        String t=new SimpleDateFormat("HH:mm:ss",Locale.US).format(new Date());
        logs.append('[').append(t).append("] ").append(str).append('\n');
        if(output!=null){
            if(Looper.myLooper()==Looper.getMainLooper())output.setText(logs.toString());
            else runOnUiThread(()->{ if(output!=null) output.setText(logs.toString()); });
        }
    }
    private void read(String key){
        try{
            String v=audio.getParameters(key);
            line("AudioManager.getParameters("+key+") => "+(v==null?"null":v.isEmpty()?"(empty)":v));
        }catch(Throwable t){line("READ FAILED "+t);}
    }
    private void readParams(){
        line("=== 시스템 파라미터 조회 ===");
        line("AudioManager mode="+audio.getMode()+" micMute="+audio.isMicrophoneMute());
        read("l_call_translation_mode");
        read("l_voice_tx_control_mode");
    }
    private void setParam(String key,String val){
        line("=== 삼성 원본과 같은 setParameters 호출 === mode="+audio.getMode());
        try {
            String pair=key+"="+val;
            audio.setParameters(pair);
            changed=true;
            line("CALL RETURNED: AudioManager.setParameters("+pair+")");
            line("주의: void 메서드의 정상 반환은 HAL 반영 증거가 아닙니다.");
        }catch(Throwable t){
            line("SET FAILED: "+t.getClass().getSimpleName()+" : "+t.getMessage());
        }
        read(key);
    }
    private void screenCallRead(){
        try{
            Method method=AudioManager.class.getMethod("semIsScreenCallEnabled");
            Object result=method.invoke(audio);
            line("semIsScreenCallEnabled => "+result);
        }catch(Throwable t){line("semIsScreenCallEnabled FAILED: "+t);}
    }
    private void screenCallSet(boolean enabled){
        line("=== 삼성 ScreenCall API 직접 호출 ===");
        try{
            Method method=AudioManager.class.getMethod("semSetScreenCallEnabled",boolean.class);
            Object result=method.invoke(audio,enabled);
            changed=true;
            line("semSetScreenCallEnabled("+enabled+") return="+result);
            screenCallRead();
        }catch(Throwable t){
            Throwable cause=t instanceof InvocationTargetException && t.getCause()!=null ? t.getCause():t;
            line("semSetScreenCallEnabled FAILED: "+cause.getClass().getName()+": "+cause.getMessage());
        }
    }
    private void voiceTx(){new Thread(this::voiceTxWorker,"VoiceTxProbe").start();}
    private void voiceTxWorker(){
        line("=== VOICE_TX AudioTrack.write 직접 시험 === mode="+audio.getMode());
        line("상대방의 동의하에 연결된 통화 중 실행하여 2초 톤 수신 여부를 확인하십시오.");
        AudioTrack track=null;
        try{
            AudioAttributes.Builder builder=new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH);
            Method sem=builder.getClass().getMethod("semAddAudioTag",String.class);
            sem.invoke(builder,"VOICE_TX");
            AudioAttributes attrs=builder.build();
            line("VOICE_TX 태그 적용 호출 성공 (삼성 오디오 라우팅 반영 여부는 실기기 확인 필요)");
            AudioFormat format=new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(16000)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build();
            int buffer=Math.max(8192,AudioTrack.getMinBufferSize(16000,
                 AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT));
            track=new AudioTrack.Builder()
                .setAudioAttributes(attrs)
                .setAudioFormat(format)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(buffer)
                .build();
            if(track.getState()!=AudioTrack.STATE_INITIALIZED)
                throw new IllegalStateException("AudioTrack STATE_UNINITIALIZED");
            byte[] pcm=new byte[64000]; // 2 seconds, 16000 Hz, 16-bit mono
            for(int i=0;i<32000;i++){
                double edge=Math.min(1,Math.min(i/250.0,(31999-i)/250.0));
                short sample=(short)(Math.sin(2.0*Math.PI*440*i/16000.0)*1800*edge);
                pcm[2*i]=(byte)(sample&255);
                pcm[2*i+1]=(byte)((sample>>8)&255);
            }
            track.play();
            int written=track.write(pcm,0,pcm.length);
            line("AudioTrack.write="+written+" / "+pcm.length+" bytes");
            try{Thread.sleep(350);}catch(InterruptedException ignored){}
            line("이 값은 PCM을 AudioTrack에 썼다는 뜻이며 상대 통화 송출의 증거는 아닙니다.");
        }catch(Throwable t){line("VOICE_TX FAILED: "+t.getClass().getName()+" "+t.getMessage());}
        finally{
            if(track!=null){
                try{track.stop();}catch(Throwable ignored){}
                try{track.release();}catch(Throwable ignored){}
            }
        }
    }
    private void resetAll(){
        line("=== 오디오 제어값 초기화 ===");
        setParam("l_voice_tx_control_mode","0");
        setParam("l_call_translation_mode","off");
        screenCallSet(false);
        changed=false;
    }
    private void copy(){
        ClipboardManager m=(ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE);
        m.setPrimaryClip(ClipData.newPlainText("Samsung direct call probe logs",logs.toString()));
        Toast.makeText(this,"로그 복사 완료",Toast.LENGTH_SHORT).show();
    }
    @Override protected void onDestroy(){
        if(changed){
            try{audio.setParameters("l_voice_tx_control_mode=0");}catch(Throwable ignored){}
            try{audio.setParameters("l_call_translation_mode=off");}catch(Throwable ignored){}
        }
        super.onDestroy();
    }
}
