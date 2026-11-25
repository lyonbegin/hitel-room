package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.net.Uri;
import android.database.Cursor;
import android.provider.OpenableColumns;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.*;
import org.json.JSONObject;
import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** App-private saved document picker and separate user-selected PDF URI reader. */
public final class NativePdfEntryActivity extends Activity {
  private static final int RECHECK = 702, PICK_PDF = 703;
  private Uri externalPdf;
  private String externalTitle;
  private String owner, selected, validatedFile;
  private boolean checking;
  private int page, generation;
  private LinearLayout body;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final Handler main = new Handler(Looper.getMainLooper());

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    setTitle("저장한 시험지");
    owner = PrivatePapers.account();
    selected = state == null ? getIntent().getStringExtra("paper") : state.getString("paper");
    page = state == null ? 0 : state.getInt("page");
    if (state != null) {
      String uri = state.getString("externalPdf");
      if (uri != null) externalPdf = Uri.parse(uri);
      externalTitle = state.getString("externalTitle");
    }
  }

  @Override protected void onResume() {
    super.onResume();
    String current = PrivatePapers.account();
    if (!current.equals(owner)) { owner = current; selected = null; validatedFile = null; page = 0; }
    display();
  }

  @Override protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    out.putString("paper", selected); out.putInt("page", page);
    if (externalPdf != null) out.putString("externalPdf", externalPdf.toString());
    out.putString("externalTitle", externalTitle);
  }

  private int dp(int value) { return Math.round(getResources().getDisplayMetrics().density * value); }
  private TextView label(String text, int size) {
    TextView v = new TextView(this);
    v.setText(text); v.setTextSize(size); v.setTextColor(Color.rgb(27,42,58)); v.setPadding(dp(12),dp(8),dp(12),dp(8));
    return v;
  }
  private Button button(String text, Runnable action) {
    Button b = new Button(this); b.setText(text); b.setOnClickListener(v -> action.run()); return b;
  }

  private void openPicker() {
    Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    pick.addCategory(Intent.CATEGORY_OPENABLE);
    pick.setType("application/pdf");
    pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    try { startActivityForResult(pick, PICK_PDF); }
    catch (android.content.ActivityNotFoundException e) {
      Toast.makeText(this, "파일 선택기를 열 수 없습니다.", Toast.LENGTH_LONG).show();
    }
  }

  private String documentTitle(Uri uri) {
    try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
      if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
    } catch (Exception ignored) {}
    return "선택한 PDF";
  }

  private void display() {
    final int version = ++generation;
    body = new LinearLayout(this);
    body.setOrientation(LinearLayout.VERTICAL); body.setBackgroundColor(Color.WHITE);
    setContentView(body);
    if (externalPdf != null) {
      body.addView(label(externalTitle == null ? "선택한 PDF" : externalTitle, 18));
      render(null, externalPdf, version);
      return;
    }
    List<JSONObject> rows = PrivatePapers.list(this, owner);
    JSONObject match = null;
    for (JSONObject row : rows) if (row.optString("key").equals(selected)) match = row;
    if (match == null) {
      boolean missing = selected != null;
      selected = null;
      body.addView(label("저장한 시험지", 22));
      File folder = PrivatePapers.directory(this, owner);
      body.addView(label(folder == null ? "앱 저장 폴더를 사용할 수 없습니다." : folder.getAbsolutePath(), 13));
      body.addView(button("다른 PDF 선택", this::openPicker));
      if (missing) body.addView(label("선택한 시험지의 저장본을 열 수 없습니다.", 15));
      if (rows.isEmpty()) {
        body.addView(label(owner.isEmpty() ? "로그인한 계정의 저장본을 확인할 수 없습니다." : "저장한 시험지가 없습니다.", 16));
      } else {
        ScrollView scroller = new ScrollView(this);
        LinearLayout list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL);
        for (JSONObject row : rows) {
          String title = row.optString("title");
          if (!PrivatePapers.canRead(row, null)) title += " (서버 확인 필요)";
          list.addView(button(title, () -> { selected = row.optString("key"); validatedFile = null; page = 0; display(); }));
        }
        scroller.addView(list); body.addView(scroller,new LinearLayout.LayoutParams(-1,0,1));
      }
      return;
    }
    final JSONObject row = match;
    body.addView(label(row.optString("title"), 18));
    if (!PrivatePapers.canRead(row, validatedFile)) {
      body.addView(label("이 PDF는 다시 열 때 서버 확인이 필요합니다.", 16));
      if (PrivatePapers.offline(this)) {
        body.addView(label("인터넷에 연결한 후 다시 선택해 주세요.", 15));
      } else {
        Button check = button(checking ? "확인 중" : "서버 확인 후 열기", () -> {
          if (checking) return;
          checking = PrivatePapers.startRevalidation(this, owner, row, RECHECK);
          if (!checking) Toast.makeText(this, "원본 열람실에서 다시 확인해 주세요.", Toast.LENGTH_LONG).show();
        });
        check.setEnabled(!checking);
        body.addView(check);
      }
      body.addView(button("목록", () -> { selected = null; validatedFile = null; page = 0; display(); }));
      return;
    }
    render(row, null, version);
  }

  private void render(final JSONObject row, final Uri uri, final int version) {
    ImageView picture = new ImageView(this);
    picture.setScaleType(ImageView.ScaleType.FIT_CENTER);
    picture.setContentDescription("시험지 페이지");
    body.addView(picture,new LinearLayout.LayoutParams(-1,0,1));
    LinearLayout nav = new LinearLayout(this); nav.setGravity(Gravity.CENTER);
    Button back = button("이전", () -> { page--; display(); });
    Button next = button("다음", () -> { page++; display(); });
    TextView counter = label("여는 중",16);
    back.setEnabled(false); next.setEnabled(false);
    nav.addView(button("목록", () -> { externalPdf = null; externalTitle = null; selected = null; validatedFile = null; page = 0; display(); }));
    nav.addView(back); nav.addView(counter); nav.addView(next); body.addView(nav);
    final int requested = page;
    final String accountAtOpen = owner;
    final String validatedAtOpen = validatedFile;
    final int targetWidth = Math.max(800, Math.min(2000, getResources().getDisplayMetrics().widthPixels));
    worker.execute(() -> {
      Bitmap bitmap = null;
      try {
        ParcelFileDescriptor opened;
        if (uri != null) {
          opened = getContentResolver().openFileDescriptor(uri, "r");
          if (opened == null) throw new IOException("document unavailable");
        } else {
          if (!accountAtOpen.equals(PrivatePapers.account())) throw new IOException("account changed");
          File file = PrivatePapers.resolveFile(this, accountAtOpen, row);
          if (file == null || !PrivatePapers.canRead(row, validatedAtOpen)) throw new IOException("document unavailable");
          opened = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
        }
        final int pages, position;
        try (ParcelFileDescriptor fd = opened; PdfRenderer pdf = new PdfRenderer(fd)) {
          pages = pdf.getPageCount();
          if (pages < 1) throw new IOException("empty PDF");
          position = Math.max(0,Math.min(pages-1,requested));
          try (PdfRenderer.Page p = pdf.openPage(position)) {
            float scale = Math.min((float)targetWidth / p.getWidth(), 3200f / p.getHeight());
            bitmap = Bitmap.createBitmap(Math.max(1, Math.round(p.getWidth()*scale)), Math.max(1, Math.round(p.getHeight()*scale)), Bitmap.Config.ARGB_8888);
            bitmap.eraseColor(Color.WHITE);
            p.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
          }
        }
        final Bitmap result = bitmap;
        main.post(() -> {
          if (version != generation || isFinishing() || isDestroyed()) { result.recycle(); return; }
          if (uri == null && (!accountAtOpen.equals(PrivatePapers.account()) || PrivatePapers.resolveFile(this, accountAtOpen, row) == null
              || !PrivatePapers.canRead(row, validatedAtOpen))) {
            result.recycle(); selected = null; display(); return;
          }
          page = position; picture.setImageBitmap(result);
          counter.setText((position+1) + " / " + pages);
          back.setEnabled(position > 0); next.setEnabled(position + 1 < pages);
          if (row != null) {
            long remaining = row.optLong("until") - System.currentTimeMillis();
            if (validatedAtOpen == null && remaining > 0 && remaining < Integer.MAX_VALUE)
              main.postDelayed(() -> { if (generation == version && !isDestroyed()) display(); }, remaining + 1);
          }
        });
      } catch (Exception | OutOfMemoryError e) {
        if (bitmap != null) bitmap.recycle();
        main.post(() -> { if (version == generation) counter.setText("열기 실패"); });
      }
    });
  }

  @Override protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == PICK_PDF) {
      if (result == RESULT_OK && data != null && data.getData() != null
          && "content".equals(data.getData().getScheme())) {
        externalPdf = data.getData();
        externalTitle = documentTitle(externalPdf);
        selected = null; validatedFile = null; page = 0;
        try {
          if ((data.getFlags() & Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION) != 0)
            getContentResolver().takePersistableUriPermission(externalPdf, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (SecurityException ignored) {}
      }
      display();
      return;
    }
    if (request != RECHECK) return;
    checking = false;
    validatedFile = null;
    if (result == RESULT_OK && data != null && selected != null
        && selected.equals(data.getStringExtra("paper")) && owner.equals(PrivatePapers.account())) {
      validatedFile = data.getStringExtra(PrivatePapers.VALIDATED_FILE);
    }
    display();
  }

  @Override public void onBackPressed() {
    if (externalPdf != null) { externalPdf = null; externalTitle = null; page = 0; display(); }
    else if (selected == null) super.onBackPressed();
    else { selected = null; validatedFile = null; page = 0; display(); }
  }
  @Override protected void onDestroy() {
    generation++; worker.shutdownNow(); super.onDestroy();
  }
}
