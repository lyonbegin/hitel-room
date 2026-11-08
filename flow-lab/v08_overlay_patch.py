from pathlib import Path
p=Path('AndroidProject')
s=p/'app/src/main/java/app/hitel/samsungprobe/CallAccessibilityService.java'
w=p/'app/src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java'
def fix(file,old,new):
 x=file.read_text(encoding='utf-8');assert old in x,(file,old[:160]);file.write_text(x.replace(old,new,1),encoding='utf-8')
fix(s,'import android.widget.Button;','''import android.widget.Button;
import android.widget.TextView;
import android.widget.ScrollView;
import android.widget.LinearLayout;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;''')
fix(s,'    private boolean overlayShown=false;','''    private boolean overlayShown=false;
    private TextView overlayTimeline;
    private ScrollView overlayScroller;
    private File overlayLogFile;
    private long overlayLogCursor=0,overlayRefreshedAt=0;
    private final StringBuilder overlayFullHistory=new StringBuilder();
    private int px(float dp){return (int)(getResources().getDisplayMetrics().density*dp+0.5f);}''')
fix(s,'            if(want==overlayShown)return;','''            if(want==overlayShown){if(want)refreshOverlayTimeline();return;}''')
start=s.read_text();i=start.index('                Button b=new Button(this);b.setAllCaps(false);b.setText("HITEL로 돌아오기");');j=start.index('                LabStore.log("HITEL_OVERLAY_SHOWN"',i)
old=start[i:j]
new='''                LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);
                panel.setBackgroundColor(0xfffafafa);panel.setPadding(px(6),px(3),px(6),px(3));
                LinearLayout bar=new LinearLayout(this);bar.setOrientation(LinearLayout.HORIZONTAL);
                Button back=new Button(this);back.setAllCaps(false);back.setText("HITEL 전체 화면");back.setTextSize(12);
                back.setOnClickListener(v->{
                    LabStore.log("HITEL_OVERLAY_RETURN","사용자가 자막 패널에서 HITEL 전면 복귀");
                    Intent i=new Intent(this,W03ConsoleActivity.class);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                    try{startActivity(i);}catch(Throwable e){LabStore.log("HITEL_OVERLAY_RETURN_ERROR",e.toString());}
                });
                Button toggle=new Button(this);toggle.setAllCaps(false);toggle.setText("자막 축소");toggle.setTextSize(12);
                bar.addView(back,new LinearLayout.LayoutParams(0,px(51),2));
                bar.addView(toggle,new LinearLayout.LayoutParams(0,px(51),1));
                panel.addView(bar,new LinearLayout.LayoutParams(-1,px(51)));
                overlayScroller=new ScrollView(this);
                overlayTimeline=new TextView(this);overlayTimeline.setTextSize(14);overlayTimeline.setTextColor(0xff101010);
                overlayTimeline.setPadding(px(6),px(2),px(6),px(8));
                overlayTimeline.setText("실제 삼성 접근성 자막 수신 대기");
                overlayScroller.addView(overlayTimeline);
                panel.addView(overlayScroller,new LinearLayout.LayoutParams(-1,0,1));
                WindowManager.LayoutParams p=new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,px(270),
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT);
                p.gravity=Gravity.BOTTOM;
                toggle.setOnClickListener(v->{
                    boolean expand=overlayScroller.getVisibility()!=View.VISIBLE;
                    overlayScroller.setVisibility(expand?View.VISIBLE:View.GONE);
                    toggle.setText(expand?"자막 축소":"자막 확대");
                    p.height=expand?px(270):px(60);
                    try{overlayManager.updateViewLayout(panel,p);}catch(Throwable ex){LabStore.log("HITEL_OVERLAY_RESIZE_ERROR",ex.toString());}
                });
                overlayManager.addView(panel,p);overlayView=panel;overlayShown=true;
                refreshOverlayTimeline();
'''
fix(s,old,new)
fix(s,'''        overlayView=null;overlayShown=false;
    }
''','''        overlayView=null;overlayTimeline=null;overlayScroller=null;overlayShown=false;
    }
    /** A Samsung-visible fallback: HITEL transcript panel is an accessibility overlay,
     * not a separate dialer. Everything shown comes from the same observed JSONL file.
     * The full history is held in a scrolling view; no synthetic transcript is added. */
    private void refreshOverlayTimeline(){
        if(overlayTimeline==null||!overlayShown)return;
        long now=SystemClock.elapsedRealtime();if(now-overlayRefreshedAt<350)return;
        overlayRefreshedAt=now;
        File f=LabStore.transcriptsFile(this);if(f==null||!f.exists())return;
        if(!f.equals(overlayLogFile)||f.length()<overlayLogCursor){
            overlayLogFile=f;overlayLogCursor=0;overlayFullHistory.setLength(0);
        }
        int received=0;
        try(RandomAccessFile r=new RandomAccessFile(f,"r")){
            r.seek(overlayLogCursor);String raw;
            while((raw=r.readLine())!=null){
                overlayLogCursor=r.getFilePointer();
                String line=new String(raw.getBytes(StandardCharsets.ISO_8859_1),StandardCharsets.UTF_8);
                JSONObject o=new JSONObject(line);
                String id=o.optString("viewId","");
                String side=id.contains("remote_message_translated")?"상대방 번역":
                    id.contains("local_message_translated")?"내 발신 번역":
                    "remote".equals(o.optString("direction"))?"상대방 원문":"내 발신";
                String stamp=new SimpleDateFormat("HH:mm:ss",Locale.KOREA).format(new Date(o.optLong("timestampMs",0L)));
                overlayFullHistory.append(stamp).append("  ").append(side)
                    .append("UPDATED".equals(o.optString("update"))?" · 정정":"")
                    .append("\\n").append(o.optString("text")).append("\\n\\n");
                received++;
            }
        }catch(Throwable e){LabStore.log("HITEL_OVERLAY_TRANSCRIPT_ERROR",e.toString());}
        if(received>0){overlayTimeline.setText(overlayFullHistory.toString());
            if(overlayScroller!=null)overlayScroller.post(()->overlayScroller.fullScroll(View.FOCUS_DOWN));}
    }
''')
fix(s,'''            if(SystemClock.elapsedRealtime()-lastSweep>1300){lastSweep=SystemClock.elapsedRealtime();scanNow("event");}''','''            if(SystemClock.elapsedRealtime()-lastSweep>1300){lastSweep=SystemClock.elapsedRealtime();scanNow("event");}
            if(overlayShown)refreshOverlayTimeline();''')
fix(w,'content.addView(label("삼성 전화 화면이 보일 때만 문자통화 버튼 조작이 가능합니다. 숨겨진 전화 화면의 내용을 무조건 읽을 수 있는 것은 아닙니다.",11,false));','content.addView(label("삼성 화면 위에는 실제 자막을 보여주는 HITEL 자막 패널이 나타납니다. 패널을 축소하여 삼성 조작을 계속하거나 HITEL 전체 화면으로 돌아올 수 있습니다. 삼성 앱이 숨겨진 상태의 이벤트 수집은 별도로 검증합니다.",11,false));')
print('PASS optional Samsung-visible HITEL subtitle accessibility overlay installed')
