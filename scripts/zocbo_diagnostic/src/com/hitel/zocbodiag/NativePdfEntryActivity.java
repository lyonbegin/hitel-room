package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.database.Cursor;
import java.io.FileOutputStream;
import java.io.InputStream;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
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

/** App-private offline reader. Its input is an index key, never a file path or URL. */
public final class NativePdfEntryActivity extends Activity {
  private static final int PICK_PDF = 7410;
  private Uri localUri;
  private String localTitle;
  private boolean pickerPending;
  private File imported;
  private Uri importedUri;
  private Bitmap displayed;
  private String owner, selected;
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
      String uri = state.getString("local_uri");
      localUri = uri == null ? null : Uri.parse(uri);
      localTitle = state.getString("local_title");
      pickerPending = state.getBoolean("picker_pending");
    } else if (getIntent().getBooleanExtra("pick_local", false)) {
      pickLocal();
    }
  }

  @Override protected void onResume() {
    super.onResume();
    String current = PrivatePapers.account();
    if (!current.equals(owner)) { owner = current; selected = null; localUri = null; page = 0; }
    display();
  }

  @Override protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    out.putString("paper", selected); out.putInt("page", page);
    out.putString("local_uri", localUri == null ? null : localUri.toString());
    out.putString("local_title", localTitle);
    out.putBoolean("picker_pending", pickerPending);
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

  private void display() {
    final int version = ++generation;
    if (displayed != null) { displayed.recycle(); displayed = null; }
    body = new LinearLayout(this);
    body.setOrientation(LinearLayout.VERTICAL); body.setBackgroundColor(Color.WHITE);
    setContentView(body);
    List<JSONObject> rows = PrivatePapers.list(this, owner);
    JSONObject match = null;
    for (JSONObject row : rows) if (row.optString("key").equals(selected)) match = row;
    if (match == null && localUri == null) {
      boolean missing = selected != null;
      selected = null;
      body.addView(label("저장한 시험지", 22));
      body.addView(button("로컬 열람", () -> pickLocal()));
      if (missing) body.addView(label("선택한 시험지의 저장본을 열 수 없습니다.", 15));
      if (rows.isEmpty()) {
        body.addView(label(owner.isEmpty() ? "로그인한 계정의 저장본을 확인할 수 없습니다." : "저장한 시험지가 없습니다.", 16));
      } else {
        ScrollView scroller = new ScrollView(this);
        LinearLayout list = new LinearLayout(this); list.setOrientation(LinearLayout.VERTICAL);
        for (JSONObject row : rows) {
          list.addView(button(row.optString("title"), () -> { selected = row.optString("key"); localUri = null; page = 0; display(); }));
        }
        scroller.addView(list); body.addView(scroller,new LinearLayout.LayoutParams(-1,0,1));
      }
      return;
    }
    final JSONObject row = match;
    final Uri uriAtOpen = localUri;
    body.addView(label(uriAtOpen == null ? row.optString("title") : localTitle, 18));
    ImageView picture = new ImageView(this);
    picture.setScaleType(ImageView.ScaleType.FIT_CENTER);
    picture.setContentDescription("시험지 페이지");
    body.addView(picture,new LinearLayout.LayoutParams(-1,0,1));
    LinearLayout nav = new LinearLayout(this); nav.setGravity(Gravity.CENTER);
    Button back = button("이전", () -> { page--; display(); });
    Button next = button("다음", () -> { page++; display(); });
    TextView counter = label("여는 중",16);
    back.setEnabled(false); next.setEnabled(false);
    nav.addView(button("목록", () -> { selected = null; localUri = null; page = 0; display(); }));
    nav.addView(button("파일", () -> pickLocal()));
    nav.addView(back); nav.addView(counter); nav.addView(next); body.addView(nav);
    final int requested = page;
    final String accountAtOpen = owner;
    final int targetWidth = Math.max(800, Math.min(2000, getResources().getDisplayMetrics().widthPixels));
    worker.execute(() -> {
      Bitmap bitmap = null;
      try {
        if (!accountAtOpen.equals(PrivatePapers.account())) throw new IOException("account changed");
        File file = uriAtOpen == null ? PrivatePapers.resolveFile(this, accountAtOpen, row)
            : localFile(uriAtOpen);
        if (file == null) throw new IOException("document unavailable");
        final int pages, position;
        try (ParcelFileDescriptor fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer pdf = new PdfRenderer(fd)) {
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
          if (!accountAtOpen.equals(PrivatePapers.account()) || (uriAtOpen == null && PrivatePapers.resolveFile(this, accountAtOpen, row) == null)) {
            result.recycle(); selected = null; display(); return;
          }
          page = position; displayed = result; picture.setImageBitmap(result);
          counter.setText((position+1) + " / " + pages);
          back.setEnabled(position > 0); next.setEnabled(position + 1 < pages);
          long remaining = row == null ? 0 : row.optLong("until") - System.currentTimeMillis();
          if (remaining > 0 && remaining < Integer.MAX_VALUE)
            main.postDelayed(() -> { if (generation == version && !isDestroyed()) display(); }, remaining + 1);
        });
      } catch (Exception | OutOfMemoryError e) {
        if (bitmap != null) bitmap.recycle();
        main.post(() -> { if (version == generation) counter.setText("열기 실패"); });
      }
    });
  }

  private void pickLocal() {
    if (pickerPending) return;
    Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    pick.addCategory(Intent.CATEGORY_OPENABLE);
    pick.setType("application/pdf");
    pick.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
    pick.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    if (android.os.Build.VERSION.SDK_INT >= 26)
      pick.putExtra(DocumentsContract.EXTRA_INITIAL_URI, PaperDocumentsProvider.folder(this));
    try { pickerPending = true; startActivityForResult(pick, PICK_PDF); }
    catch (android.content.ActivityNotFoundException e) {
      pickerPending = false;
      Toast.makeText(this, "파일 선택 앱을 찾을 수 없습니다.", Toast.LENGTH_LONG).show();
    }
  }

  @Override protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request != PICK_PDF) return;
    pickerPending = false;
    if (result != RESULT_OK || data == null || data.getData() == null) return;
    Uri chosen = data.getData();
    if (!"content".equals(chosen.getScheme())) return;
    localUri = chosen; selected = null; page = 0;
    localTitle = "로컬 PDF";
    // Metadata lookups and PDF copies run off the UI thread below.
    display();
  }

  private File localFile(Uri uri) throws IOException {
    if (uri.equals(importedUri) && imported != null && imported.isFile()) return imported;
    File candidate = File.createTempFile("local-paper-", ".pdf", getCacheDir());
    boolean complete = false;
    try {
      try (InputStream in = getContentResolver().openInputStream(uri);
           FileOutputStream out = new FileOutputStream(candidate)) {
        if (in == null) throw new IOException("cannot open PDF");
        byte[] buffer = new byte[65536]; int count;
        while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
      }
      if (candidate.length() == 0) throw new IOException("empty PDF");
      if (imported != null) imported.delete();
      imported = candidate; importedUri = uri; complete = true;
      return candidate;
    } finally { if (!complete) candidate.delete(); }
  }

  @Override public void onBackPressed() {
    if (selected == null && localUri == null) super.onBackPressed();
    else { selected = null; localUri = null; page = 0; display(); }
  }
  @Override protected void onDestroy() {
    generation++;
    if (displayed != null) { displayed.recycle(); displayed = null; }
    // Cleanup runs after any in-flight copy/render, so no descriptor is deleted
    // while it is still being prepared for this activity.
    worker.execute(() -> { if (imported != null) imported.delete(); });
    worker.shutdown();
    main.removeCallbacksAndMessages(null);
    super.onDestroy();
  }
}
