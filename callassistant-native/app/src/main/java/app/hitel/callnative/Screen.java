package app.hitel.callnative;

import android.app.Activity;
import android.graphics.Color;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

final class Screen {
    static LinearLayout vertical(Activity a) {
        LinearLayout p = new LinearLayout(a);
        p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(28, 28, 28, 28);
        p.setBackgroundColor(Color.WHITE);
        return p;
    }
    static ScrollView scroll(Activity a, LinearLayout content) {
        ScrollView s = new ScrollView(a); s.addView(content); return s;
    }
    static TextView title(Activity a, LinearLayout p, String text) {
        TextView t = new TextView(a);
        t.setText(text); t.setTextColor(Color.BLACK); t.setTextSize(24f);
        t.setPadding(0, 6, 0, 20); p.addView(t); return t;
    }
    static TextView note(Activity a, LinearLayout p, String text) {
        TextView t = new TextView(a);
        t.setText(text); t.setTextColor(Color.DKGRAY); t.setTextSize(16f);
        t.setPadding(0, 8, 0, 16); p.addView(t); return t;
    }
    static Button button(Activity a, LinearLayout p, String text) {
        Button b = new Button(a); b.setAllCaps(false); b.setText(text);
        p.addView(b, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return b;
    }
    private Screen(){}
}
