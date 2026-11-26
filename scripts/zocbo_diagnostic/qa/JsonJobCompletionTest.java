package com.hitel.zocbodiag;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

public final class JsonJobCompletionTest {
  public static void main(String[] args) throws Exception {
    AtomicInteger a = new AtomicInteger(), b = new AtomicInteger();
    JsonJobCompletion first = new JsonJobCompletion((status, paths, rows) -> {
      if (!"COMPLETE:2/3".equals(status) || paths != 2 || rows != 3)
        throw new AssertionError("first job identity/count");
      a.incrementAndGet();
    });
    JsonJobCompletion second = new JsonJobCompletion((status, paths, rows) -> {
      if (!"FAILED:IOException".equals(status) || paths != 0 || rows != 4)
        throw new AssertionError("second job identity/count");
      b.incrementAndGet();
    });
    second.finish("FAILED:IOException", 0, 4);
    CountDownLatch start = new CountDownLatch(1);
    Thread[] threads = new Thread[16];
    for (int i=0; i<threads.length; i++) {
      threads[i] = new Thread(() -> {
        try { start.await(); }
        catch (InterruptedException e) { throw new AssertionError(e); }
        first.finish("COMPLETE:2/3", 2, 3);
      });
      threads[i].start();
    }
    start.countDown();
    for (Thread t : threads) t.join();
    if (a.get()!=1 || b.get()!=1) throw new AssertionError("duplicate or missing terminal notification");
    if (first.finish("COMPLETE:2/3", 2, 3)) throw new AssertionError("repeat");
    System.out.println("PASS terminal once; reversed completion; per-job counts");
  }
}
