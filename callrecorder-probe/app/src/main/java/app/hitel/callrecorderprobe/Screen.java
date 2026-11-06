package app.hitel.callrecorderprobe;
import android.app.Activity;
import android.widget.*;
import android.graphics.Color;
import android.view.ViewGroup;
final class Screen {
 static LinearLayout vertical(Activity a){LinearLayout r=new LinearLayout(a);r.setOrientation(1);r.setPadding(24,24,24,24);r.setBackgroundColor(Color.WHITE);return r;}
 static TextView title(Activity a,LinearLayout r,String s){TextView v=new TextView(a);v.setTextSize(23);v.setTextColor(Color.BLACK);v.setText(s);r.addView(v);return v;}
 static TextView note(Activity a,LinearLayout r,String s){TextView v=new TextView(a);v.setTextSize(16);v.setTextColor(Color.DKGRAY);v.setPadding(0,12,0,12);v.setText(s);r.addView(v);return v;}
 static Button button(Activity a,LinearLayout r,String s){Button b=new Button(a);b.setText(s);b.setAllCaps(false);r.addView(b);return b;}
 static ScrollView scroll(Activity a,LinearLayout r){ScrollView s=new ScrollView(a);s.addView(r);return s;}
}
