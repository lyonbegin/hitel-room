package com.hitel.zocbodiag;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public final class NativeWorkQueueTest {
  public static void main(String[] args) throws Exception {
    CountDownLatch gate = new CountDownLatch(1);
    CountDownLatch started = new CountDownLatch(5);
    CountDownLatch done = new CountDownLatch(261);
    AtomicInteger active = new AtomicInteger(), max = new AtomicInteger(), completed = new AtomicInteger();
    Runnable task = () -> {
      int n = active.incrementAndGet();
      max.accumulateAndGet(n, Math::max);
      started.countDown();
      try { gate.await(); completed.incrementAndGet(); }
      catch (InterruptedException e) { Thread.currentThread().interrupt(); }
      finally { active.decrementAndGet(); done.countDown(); }
    };
    try {
      for (int i = 0; i < 5; i++)
        if (NativeWorkQueue.submit("job"+i, task) != NativeWorkQueue.Result.ACCEPTED) throw new AssertionError("submit");
      if (!started.await(5, TimeUnit.SECONDS)) throw new AssertionError("workers");
      if (NativeWorkQueue.submit("job0", task) != NativeWorkQueue.Result.DUPLICATE) throw new AssertionError("duplicate");
      for (int i = 5; i < 261; i++)
        if (NativeWorkQueue.submit("job"+i, task) != NativeWorkQueue.Result.ACCEPTED) throw new AssertionError("queue");
      if (NativeWorkQueue.waiting() != 256 ||
          NativeWorkQueue.submit("overflow", task) != NativeWorkQueue.Result.FULL) throw new AssertionError("capacity");
      gate.countDown();
      if (!done.await(10, TimeUnit.SECONDS) || max.get() != 5 || completed.get() != 261)
        throw new AssertionError("drain");
      System.out.println("PASS workers="+max.get()+" completed="+completed.get()+" waiting="+NativeWorkQueue.waiting()+" duplicate=PASS overflow=PASS");
    } finally { gate.countDown(); }
    System.exit(0);
  }
}
