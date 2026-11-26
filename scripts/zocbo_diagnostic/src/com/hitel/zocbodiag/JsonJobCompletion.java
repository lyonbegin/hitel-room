package com.hitel.zocbodiag;

import java.util.concurrent.atomic.AtomicBoolean;

/** One terminal notification per original selection; independent of an Activity. */
final class JsonJobCompletion {
  interface Listener {
    void completed(String status, int imagePathCount, int questionCount);
  }
  private final Listener listener;
  private final AtomicBoolean fired = new AtomicBoolean();
  JsonJobCompletion(Listener listener) {
    if (listener == null) throw new IllegalArgumentException("listener required");
    this.listener = listener;
  }
  boolean finish(String status, int paths, int questions) {
    if (status == null || !(status.startsWith("COMPLETE:") || status.startsWith("FAILED:")))
      throw new IllegalArgumentException("terminal status required");
    if (!fired.compareAndSet(false, true)) return false;
    try { listener.completed(status, paths, questions); }
    catch (RuntimeException ignored) { /* UI failure cannot change saved work outcome. */ }
    return true;
  }
}
