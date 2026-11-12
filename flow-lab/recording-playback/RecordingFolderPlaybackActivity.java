package app.hitel.samsungprobe;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * Add-on controls only. Does not alter existing playback-capture app chooser,
 * microphone STT, speaker STT, W03 scenario state, or dialer.
 */
public final class RecordingFolderPlaybackActivity extends Activity {
    private static final int SELECT_SAMSUNG_FOLDER=1417;
    private static final String PREF="growing_recording_audio_playback";
    private TextView folderInfo,status,events;
    private boolean receiverActive=false;
    private final BroadcastReceiver receiver=new BroadcastReceiver(){
        @Override public void onReceive(Context ctx,Intent intent){
            if(!RecordingFolderPlaybackService.EVENT.equals(intent.getAction()))return;
            String state=intent.getStringExtra(RecordingFolderPlaybackService.KEY_STATE);
            String details=intent.getStringExtra(RecordingFolderPlaybackService.KEY_DETAIL);
            if(state==null||details==null)return;
            status.setText(state+" · "+details);
            String old=events.getText().toString();
            String next=java.text.DateFormat.getTimeInstance().format(new java.util.Date())+
                " "+state+" · "+details+"\n"+old;
            events.setText(next.length()>12000?next.substring(0,12000):next);
            getSharedPreferences(PREF,MODE_PRIVATE).edit().putString("lastStatus",state+" · "+details).apply();
        }
    };
    private int dp(int pixels){
        return Math.round(pixels*getResources().getDisplayMetrics().density);
    }
    private TextView label(String content,int size){
        TextView t=new TextView(this);
        t.setText(content);t.setTextSize(size);
        t.setTextColor(0xff222222);
        t.setPadding(dp(5),dp(8),dp(5),dp(8));
        return t;
    }
    private Button button(String text,Runnable job){
        Button b=new Button(this);
        b.setText(text);b.setAllCaps(false);b.setOnClickListener(v->job.run());
        return b;
    }
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        ScrollView scroll=new ScrollView(this);
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12),dp(12),dp(12),dp(12));
        scroll.addView(root);setContentView(scroll);
        root.addView(label("HITEL14 · 전화 녹음파일 → 스피커 재생",20));
        root.addView(label("추가 기능입니다. 기존 마이크 STT와 스피커 STT는 변경하지 않습니다. "+
            "삼성 전화의 Recordings/Call 등 녹음 폴더를 선택하면, 새로 생성되거나 "+
            "계속 커지는 M4A를 읽어 우리 앱의 미디어 출력으로 재생합니다.",13));
        root.addView(button("① 삼성 통화 녹음 폴더 선택",this::chooseFolder));
        folderInfo=label("폴더 미선택",13);root.addView(folderInfo);
        root.addView(button("② 선택 폴더 감시·재생 시작",this::start));
        root.addView(button("감시·스피커 재생 중지",this::stop));
        status=label("상태 대기",14);root.addView(status);
        root.addView(label("③ 기존 스피커 STT에서 재생 앱을 선택하시면 됩니다. "+
            "이 기능 자체는 STT를 자동 시작하거나 입력 앱 선택을 변경하지 않습니다. "+
            "녹음파일에 실제로 데이터가 추가되어야 소리가 재생됩니다.",12));
        root.addView(button("기존 HITEL14 화면으로 돌아가기",()->finish()));
        root.addView(label("파일 감시·디코딩·스피커 상태 로그",15));
        events=label("아직 파일 증가분 감시 로그가 없습니다.",12);
        events.setTextIsSelectable(true);
        root.addView(events);
        restore();
    }
    private void restore(){
        String selected=getSharedPreferences(PREF,MODE_PRIVATE).getString("folderUri","");
        folderInfo.setText(selected.isEmpty()?"폴더 미선택":"녹음 폴더: "+selected);
        status.setText(getSharedPreferences(PREF,MODE_PRIVATE).getString("lastStatus","실행 전"));
    }
    private void chooseFolder(){
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(pick,SELECT_SAMSUNG_FOLDER);
    }
    @Override protected void onActivityResult(int req,int code,Intent data){
        super.onActivityResult(req,code,data);
        if(req!=SELECT_SAMSUNG_FOLDER||code!=RESULT_OK||data==null||data.getData()==null)return;
        Uri chosen=data.getData();
        try{
            getContentResolver().takePersistableUriPermission(
                chosen,Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getSharedPreferences(PREF,MODE_PRIVATE).edit()
                .putString("folderUri",chosen.toString()).apply();
            folderInfo.setText("선택 폴더: "+chosen);
            status.setText("폴더 권한 확인 · 녹음파일 감시를 시작합니다.");
            start();
        }catch(Throwable error){
            status.setText("폴더 읽기 권한 실패: "+error);
        }
    }
    private void start(){
        String uri=getSharedPreferences(PREF,MODE_PRIVATE).getString("folderUri","");
        if(uri.isEmpty()){
            status.setText("녹음 폴더를 먼저 선택하십시오.");
            return;
        }
        Intent start=new Intent(this,RecordingFolderPlaybackService.class);
        start.setAction(RecordingFolderPlaybackService.START);
        start.putExtra(RecordingFolderPlaybackService.KEY_URI,uri);
        try{startForegroundService(start);status.setText("폴더 감시 시작 요청 · 새 녹음 증가분 대기");}
        catch(Throwable error){status.setText("서비스 실행 실패: "+error);}
    }
    private void stop(){
        Intent stop=new Intent(this,RecordingFolderPlaybackService.class);
        stop.setAction(RecordingFolderPlaybackService.STOP);
        try{startService(stop);status.setText("재생 중지 요청");}
        catch(Throwable error){status.setText("중지 오류: "+error);}
    }
    @Override protected void onStart(){
        super.onStart();
        IntentFilter filter=new IntentFilter(RecordingFolderPlaybackService.EVENT);
        if(Build.VERSION.SDK_INT>=33)
            registerReceiver(receiver,filter,Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(receiver,filter);
        receiverActive=true;
        restore();
    }
    @Override protected void onStop(){
        if(receiverActive)unregisterReceiver(receiver);
        receiverActive=false;
        super.onStop();
    }
}
