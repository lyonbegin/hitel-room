package com.hitel.zocbodiag;

import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** Synthetic authorized requests only; no network or Android dependencies. */
public final class NativeRequestSlotTest {
    private static final ArrayDeque<String> fifo = new ArrayDeque<>();
    private static final ConcurrentHashMap<String, NativeWorkQueue.RequestSlot> started = new ConcurrentHashMap<>();
    private static final Set<String> completed = new HashSet<>();
    private static final AtomicInteger callbacks = new AtomicInteger();
    private static final CountDownLatch firstFive = new CountDownLatch(5);
    private static final CountDownLatch sixth = new CountDownLatch(1);
    private static synchronized void drain() {
        while (!fifo.isEmpty()) {
            final String id = fifo.peekFirst();
            NativeWorkQueue.Result r = NativeWorkQueue.tryStart(id, slot -> {
                if (!id.equals(slot.key)) throw new AssertionError("wrong identity");
                started.put(id, slot);
                firstFive.countDown();
                if (id.equals("exam-6")) sixth.countDown();
            }, failure -> {
                synchronized (NativeRequestSlotTest.class) {
                    if (failure != null || !completed.add(id)) throw new AssertionError("bad callback " + id);
                    callbacks.incrementAndGet();
                }
                drain();
            });
            if (r == NativeWorkQueue.Result.FULL) return;
            if (r != NativeWorkQueue.Result.ACCEPTED) throw new AssertionError(r);
            fifo.removeFirst();
        }
    }
    private static NativeWorkQueue.RequestSlot waitFor(String id) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            NativeWorkQueue.RequestSlot slot = started.get(id);
            if (slot != null) return slot;
            Thread.sleep(1);
        }
        throw new AssertionError("not started: " + id);
    }
    public static void main(String[] args) throws Exception {
        try {
            for (int i=1; i<=12; i++) fifo.add("exam-"+i);
            drain();
            if (!firstFive.await(5, TimeUnit.SECONDS) || NativeWorkQueue.requestRunning() != 5 || fifo.size() != 7)
                throw new AssertionError("five slots / seven waiting");
            if (NativeWorkQueue.tryStart("exam-1", s -> {}, e -> {}) != NativeWorkQueue.Result.DUPLICATE)
                throw new AssertionError("duplicate");
            if (NativeWorkQueue.tryStart("exam-13", s -> {}, e -> {}) != NativeWorkQueue.Result.FULL)
                throw new AssertionError("full");
            NativeWorkQueue.RequestSlot third = waitFor("exam-3");
            third.finish(null);
            third.finish(null); // duplicate response must not release a different slot
            if (!sixth.await(5, TimeUnit.SECONDS) || NativeWorkQueue.requestRunning() != 5 || callbacks.get() != 1)
                throw new AssertionError("refill / duplicate response");
            for (int i : new int[] {2,1,5,4,6,7,8,9,10,11,12}) waitFor("exam-"+i).finish(null);
            if (NativeWorkQueue.requestRunning() != 0 || callbacks.get() != 12 || !fifo.isEmpty())
                throw new AssertionError("drain");
            CountDownLatch failed = new CountDownLatch(1);
            if (NativeWorkQueue.tryStart("failure", s -> { throw new java.io.IOException("synthetic"); }, e -> {
                if (!(e instanceof java.io.IOException)) throw new AssertionError("wrong error");
                failed.countDown();
            }) != NativeWorkQueue.Result.ACCEPTED || !failed.await(5, TimeUnit.SECONDS) || NativeWorkQueue.requestRunning() != 0)
                throw new AssertionError("failure release");
            System.out.println("PASS max=5 FIFO=12 refill=PASS outOfOrder=PASS duplicate=PASS failure=PASS");
            System.exit(0);
        } catch (Throwable t) { t.printStackTrace(); System.exit(1); }
    }
}
