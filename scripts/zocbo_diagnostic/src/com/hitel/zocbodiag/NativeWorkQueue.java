package com.hitel.zocbodiag;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Process-wide bounded executor for already authorized local file work.
 * No Activity, WebView, credentials, or network request is owned by this queue.
 */
final class NativeWorkQueue {
    private static final AtomicInteger threadId = new AtomicInteger();
    private static final Set<String> pending = new HashSet<>();
    private static final ThreadPoolExecutor pool = new ThreadPoolExecutor(
        5, 5, 30L, TimeUnit.SECONDS, new ArrayBlockingQueue<Runnable>(256),
        task -> new Thread(task, "native-paper-worker-" + threadId.incrementAndGet()),
        new ThreadPoolExecutor.AbortPolicy());
    static { pool.allowCoreThreadTimeOut(true); }

    enum Result { ACCEPTED, DUPLICATE, FULL }

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
