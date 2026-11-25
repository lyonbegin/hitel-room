package com.hitel.zocbodiag;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.InputStream;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** One screen, one account-scoped controller, no per-item Activity launches. */
final class NativeBatchPanel {
    static final int PICK_JSONL = 704;

    /**
     * Only the original authorized operation can supply this implementation.
     * Each invocation must own its request state and return after the actual
     * operation has ended and resources have been released.
     */
    interface AuthorizedProcessorFactory {
        NativeFiveWorkerPool.Processor create(Context app, String account);
    }

    private static volatile AuthorizedProcessorFactory factory;
    static synchronized void installAuthorizedProcessor(AuthorizedProcessorFactory value) {
        factory = value;
    }

    private static Session session;
    private static final ExecutorService io = Executors.newSingleThreadExecutor();

    private static final class Session {
        final String account;
        final NativeBatchQueueStore store;
        volatile NativeFiveWorkerPool pool;
        volatile boolean busy;
        volatile String message = "JSONL 파일을 선택하십시오.";
        volatile String counts = "";
        Session(Context app, String account) {
            this.account = account;
            store = new NativeBatchQueueStore(app, account);
            busy = true;
            io.execute(() -> {
                try {
                    int recovered = store.recoverInterrupted();
                    if (recovered > 0) message = "중단 작업 " + recovered + "건: 확인 필요";
                    snapshot();
                } catch (Exception e) {
                    message = "DB 복구 오류: " + e.getClass().getSimpleName();
                } finally { busy = false; }
            });
        }
        void snapshot() {
            StringBuilder s = new StringBuilder();
            for (String state : new String[]{"QUEUED","RUNNING","SUCCESS","FAILED","INTERRUPTED","AUTH_REQUIRED","RATE_LIMITED"}) {
                s.append(state).append(": ").append(store.count(state)).append("\n");
            }
            counts = s.toString();
        }
    }

    private static synchronized Session acquire(Context app, String account) {
        if (account == null || account.isEmpty()) return null;
        if (session != null && !session.account.equals(account)) {
            if (session.pool != null && session.pool.running()) {
                session.pool.pause();
                return null;
            }
            if (session.busy) return null;
            Session previous = session;
            io.execute(previous.store::close);
            session = null;
        }
        if (session == null) session = new Session(app, account);
        return session;
    }

    private final Activity host;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final LinearLayout root;
    private final TextView status;
    private final Button pick, start, pause;
    private Session current;
    private boolean attached = true;
    private boolean refreshing;
    private final Runnable tick = new Runnable() {
        public void run() {
            if (!attached || host.isFinishing() || host.isDestroyed()) return;
            String account = PrivatePapers.account();
            if (current != null && !current.account.equals(account)) {
                if (current.pool != null) current.pool.pause();
                current = null;
            }
            if (current == null) current = acquire(host.getApplicationContext(), account);
            if (current != null && !current.busy && !refreshing) {
                final Session s = current;
                refreshing = true;
                io.execute(() -> {
                    try { s.snapshot(); }
                    catch (Exception e) { s.message = "상태 조회 오류: " + e.getClass().getSimpleName(); }
                    finally { main.post(() -> refreshing = false); }
                });
            }
            render();
            main.postDelayed(this, 1000);
        }
    };

    NativeBatchPanel(Activity host, Runnable back) {
        this.host = host;
        current = acquire(host.getApplicationContext(), PrivatePapers.account());
        root = new LinearLayout(host);
        root.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(host);
        title.setText("네이티브 작업 관리 / 동시 5개");
        title.setTextSize(20);
        root.addView(title);
        status = new TextView(host);
        root.addView(status);
        pick = button("JSONL 파일 선택", this::pickFile);
        start = button("작업 시작", this::start);
        pause = button("일시정지", () -> {
            if (current != null && current.pool != null) current.pool.pause();
            render();
        });
        root.addView(pick); root.addView(start); root.addView(pause);
        root.addView(button("기존 목록으로", back));
        render();
        main.post(tick);
    }
    LinearLayout view() { return root; }
    void detach() { attached = false; main.removeCallbacks(tick); }
    private Button button(String label, Runnable r) {
        Button b = new Button(host); b.setText(label); b.setOnClickListener(v -> r.run()); return b;
    }
    private void render() {
        Session s = current;
        if (s == null) {
            status.setText("로그인 계정 또는 이전 작업 종료를 확인하십시오.");
            pick.setEnabled(false); start.setEnabled(false); pause.setEnabled(false); return;
        }
        NativeFiveWorkerPool p = s.pool;
        boolean running = p != null && p.running();
        boolean ready = factory != null;
        String worker = p == null ? "0 / 5" : p.active() + " / 5 (최고 " + p.peak() + ")";
        status.setText(s.message + "\n" + (ready ? "" : "원본 처리 어댑터 미연결: 실행 차단\n") +
            "Worker: " + worker + "\n" + (p == null ? "" : p.stopReason() + "\n") + s.counts);
        pick.setEnabled(!running && !s.busy);
        start.setEnabled(ready && !running && !s.busy);
        pause.setEnabled(running);
    }
    private void pickFile() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.setType("*/*"); i.addCategory(Intent.CATEGORY_OPENABLE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        host.startActivityForResult(i, PICK_JSONL);
    }
    void importFile(Uri uri) {
        final Session s = current;
        if (uri == null || s == null || s.busy || (s.pool != null && s.pool.running())) return;
        s.busy = true; s.message = "JSONL 읽는 중"; render();
        final Context app = host.getApplicationContext();
        io.execute(() -> {
            try (InputStream input = app.getContentResolver().openInputStream(uri)) {
                if (!s.account.equals(PrivatePapers.account())) throw new IllegalStateException("account changed");
                long n = s.store.importJsonl(input);
                s.message = "신규 입력: " + n + "건";
            } catch (Exception e) {
                s.message = "파일 입력 오류: " + e.getClass().getSimpleName();
            } finally {
                try { s.snapshot(); } catch (Exception ignored) {}
                s.busy = false;
                main.post(() -> { if (attached) render(); });
            }
        });
    }
    private void start() {
        final Session s = current;
        final AuthorizedProcessorFactory f = factory;
        if (s == null || f == null || s.busy || (s.pool != null && s.pool.running())) return;
        if (!s.account.equals(PrivatePapers.account())) return;
        final NativeFiveWorkerPool.Processor processor;
        try { processor = f.create(host.getApplicationContext(), s.account); }
        catch (RuntimeException e) { s.message = "어댑터 초기화 오류"; render(); return; }
        if (processor == null) return;
        s.pool = new NativeFiveWorkerPool(s.store, id -> {
            if (!s.account.equals(PrivatePapers.account())) return NativeFiveWorkerPool.Result.AUTH_REQUIRED;
            return processor.process(id);
        });
        s.pool.start();
        s.message = "작업 시작";
        render();
    }
}
