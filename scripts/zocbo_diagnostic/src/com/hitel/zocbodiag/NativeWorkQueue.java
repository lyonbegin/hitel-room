package com.hitel.zocbodiag;

import java.util.HashSet;
import java.util.Set;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Process-wide bounded executor. Request slots are reserved only for work
 * accepted by the original authorization path; the caller owns that path.
 * The existing selection FIFO remains outside this class. */
final class NativeWorkQueue {
    private static final int MAX_ACTIVE = 5;
    private static final AtomicInteger threadId = new AtomicInteger();
    private static final Set<String> pending = new HashSet<>();
    private static final Map<String, RequestSlot> requests = new HashMap<>();
    private static final ThreadPoolExecutor pool = new ThreadPoolExecutor(
        MAX_ACTIVE, MAX_ACTIVE, 30L, TimeUnit.SECONDS, new ArrayBlockingQueue<Runnable>(256),
        task -> new Thread(task, "native-paper-worker-" + threadId.incrementAndGet()),
        new ThreadPoolExecutor.AbortPolicy());
    static { pool.allowCoreThreadTimeOut(true); }

    enum Result { ACCEPTED, DUPLICATE, FULL }

    interface RequestWork { void start(RequestSlot slot) throws Exception; }
    interface RequestDone { void finished(Throwable failure); }

    /** Identity is immutable. Returning from start() does NOT release a slot;
     * the request's terminal callback must call finish, after saving if successful. */
    static final class RequestSlot {
        final String key;
        private final RequestDone done;
        private RequestSlot(String key, RequestDone done) { this.key = key; this.done = done; }
        void finish(Throwable failure) {
            synchronized (NativeWorkQueue.class) {
                if (requests.get(key) != this) return;
                requests.remove(key);
            }
            done.finished(failure);
        }
    }

    /** No second request waiting queue: FULL leaves the item in the caller's FIFO. */
    static synchronized Result tryStart(String key, RequestWork work, RequestDone done) {
        if (key == null || key.isEmpty() || work == null || done == null)
            throw new IllegalArgumentException("key, work and callback required");
        if (requests.containsKey(key)) return Result.DUPLICATE;
        if (requests.size() >= MAX_ACTIVE) return Result.FULL;
        RequestSlot slot = new RequestSlot(key, done);
        requests.put(key, slot);
        try {
            pool.execute(() -> {
                try { work.start(slot); }
                catch (Exception e) { slot.finish(e); }
                catch (Error e) { slot.finish(e); throw e; }
            });
            return Result.ACCEPTED;
        } catch (RejectedExecutionException e) {
            requests.remove(key);
            return Result.FULL;
        }
    }

    static synchronized int requestRunning() { return requests.size(); }

    static synchronized Result submit(String key, Runnable task) {
        if (key == null || key.isEmpty() || task == null)
            throw new IllegalArgumentException("key and task required");
        if (!pending.add(key)) return Result.DUPLICATE;
        try {
            pool.execute(() -> {
                try { task.run(); }
                finally {
                    synchronized (NativeWorkQueue.class) { pending.remove(key); }
                }
            });
            return Result.ACCEPTED;
        } catch (RejectedExecutionException e) {
            pending.remove(key);
            return Result.FULL;
        }
    }

    static int running() { return pool.getActiveCount(); }
    static int waiting() { return pool.getQueue().size(); }
    private NativeWorkQueue() {}
}
