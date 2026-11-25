package com.hitel.zocbodiag;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Activity-independent scheduling only. A Processor must keep the original
 * authorized operation and return only after terminal completion / cleanup.
 * No network, viewer launching, or permission logic is implemented here.
 */
public final class NativeFiveWorkerPool {
    public static final int WORKERS = 5;
    public enum Result { SUCCESS, FAILED, AUTH_REQUIRED, RATE_LIMITED }
    public interface Store {
        // Atomically claim a single queued job and mark it RUNNING.
        // Return null if no queued work remains.
        String claim() throws Exception;
        void complete(String id, Result result, String detail) throws Exception;
    }
    public interface Processor {
        Result process(String id) throws Exception;
    }
    private final Object gate = new Object();
    private final Store store;
    private final Processor processor;
    private boolean accepting;
    private boolean running;
    private int workers;
    private int active;
    private int peak;
    private String stopReason = "IDLE";

    public NativeFiveWorkerPool(Store store, Processor processor) {
        if (store == null || processor == null) throw new NullPointerException();
        this.store = store;
        this.processor = processor;
    }
    public boolean start() {
        synchronized (gate) {
            if (running) return false;
            accepting = running = true;
            stopReason = "RUNNING";
            workers = WORKERS;
            peak = 0;
            ExecutorService executor = Executors.newFixedThreadPool(WORKERS);
            for (int i = 0; i < WORKERS; ++i) executor.execute(this::loop);
            executor.shutdown();
            return true;
        }
    }
    public void pause() { stop("PAUSED"); }
    private void stop(String reason) {
        synchronized (gate) {
            accepting = false;
            if ("RUNNING".equals(stopReason)) stopReason = reason;
        }
    }
    private void loop() {
        try {
            for (;;) {
                String id;
                synchronized (gate) {
                    if (!accepting) return;
                    id = store.claim();
                    if (id == null) return;
                    ++active;
                    peak = Math.max(peak, active);
                }
                try {
                    Result result;
                    String detail = "";
                    try {
                        result = processor.process(id);
                        if (result == null) throw new IllegalStateException("missing terminal result");
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        stop("INTERRUPTED");
                        result = Result.FAILED;
                        detail = "INTERRUPTED";
                    } catch (Exception e) {
                        result = Result.FAILED;
                        detail = e.getClass().getSimpleName();
                    }
                    if (result == Result.AUTH_REQUIRED || result == Result.RATE_LIMITED)
                        stop(result.name());
                    synchronized (gate) {
                        store.complete(id, result, detail);
                    }
                } finally {
                    synchronized (gate) { --active; }
                }
            }
        } catch (Exception e) {
            stop("STORE_ERROR:" + e.getClass().getSimpleName());
        } finally {
            synchronized (gate) {
                if (--workers == 0) {
                    accepting = running = false;
                    if ("RUNNING".equals(stopReason)) stopReason = "DRAINED";
                    gate.notifyAll();
                }
            }
        }
    }
    public int active() { synchronized (gate) { return active; } }
    public int peak() { synchronized (gate) { return peak; } }
    public boolean running() { synchronized (gate) { return running; } }
    public String stopReason() { synchronized (gate) { return stopReason; } }
}
