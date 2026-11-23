package app.hitel.speakeronly;

import java.io.Closeable;
import java.io.File;

/**
 * EXPERIMENTAL native original-IXIO-model STT pathway.
 *
 * Separate from stable DirectPcmKoreanStt. Not selected by SpeakerEngine yet.
 * Requires a separately built PUBLIC sherpa-onnx C API ARM64 library and
 * libhitel-native-stt-jni.so; the original IXIO libsherpa-onnx-jni.so does
 * NOT implement the new native backend API.
 *
 * Caller: create and call acceptPcm() on the existing STT worker thread;
 * never call from the Android main thread.
 */
final class NativeSttBridge implements Closeable {
  interface Listener {
    void caption(String wholeUtterance, boolean isFinal,
                 long audioSamples, long revision, long nativeEmittedNs);
    void trace(String phase, long samples, long decoderStep,
               long processingUs, boolean changed);
  }

  private final Listener callback;
  private long nativeHandle;
  private boolean finished;

  NativeSttBridge(File originalIxioModelDirectory, Listener callback) {
    if (originalIxioModelDirectory == null || callback == null)
      throw new IllegalArgumentException("IXIO model directory and listener are mandatory");
    this.callback = callback;
    // Deliberately lazy. The existing stable app does not attempt this load.
    System.loadLibrary("sherpa-onnx-c-api");
    System.loadLibrary("hitel-native-stt-jni");
    nativeHandle = nativeOpen(originalIxioModelDirectory.getAbsolutePath());
    if (nativeHandle == 0L)
      throw new IllegalStateException("Native STT engine initialization failed");
  }

  synchronized void acceptPcm(byte[] pcm16le) {
    if (nativeHandle == 0L || finished)
      throw new IllegalStateException("STT native session already finished");
    nativeAccept(nativeHandle, pcm16le);
  }
  synchronized void finish() {
    if (nativeHandle == 0L || finished) return;
    nativeFinish(nativeHandle);
    finished = true;
  }
  @Override public synchronized void close() {
    if (nativeHandle == 0L) return;
    // The caller must stop the PCM worker before closing this session.
    long handle = nativeHandle;
    nativeHandle = 0L;
    nativeClose(handle);
    finished = true;
  }
  // These names and descriptors are bound to native_stt_jni.cpp.
  private void onNativeCaption(String text, boolean finalSegment,
                               long audioSamples, long revision, long nativeNs) {
    callback.caption(text, finalSegment, audioSamples, revision, nativeNs);
  }
  private void onNativeTrace(String phase, long samples, long decoderStep,
                             long processingUs, boolean changed) {
    callback.trace(phase, samples, decoderStep, processingUs, changed);
  }
  private native long nativeOpen(String modelDirectory);
  private native void nativeAccept(long handle, byte[] pcm16le);
  private native void nativeFinish(long handle);
  private native void nativeClose(long handle);
}
