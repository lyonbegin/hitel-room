package ai.bithuman.flutter;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/** Run the reused decoder's real chunker on the JVM; no codec or speaker is simulated. */
public final class FilePcmChunkerTest {
  public static void main(String[] args) throws Exception {
    List<byte[]> chunks = new ArrayList<>();
    final int[] fed = {0}, firstAt = {-1};
    FilePcmStream.Callback callback = new FilePcmStream.Callback() {
      public boolean cancelled() { return false; }
      public void onStart(long d, String m, int r, int c) { }
      public void onProgress(long d, long t) { }
      public void onSegment(int seq, byte[] pcm, long pos, long total, boolean last) {
        if (firstAt[0] < 0) firstAt[0] = fed[0];
        if (pcm.length > 3200 || pcm.length % 2 != 0) throw new AssertionError("Bad PCM packet size");
        if (seq != chunks.size() + 1) throw new AssertionError("Packet order changed");
        chunks.add(pcm);
      }
    };
    Class<?> type = Class.forName("ai.bithuman.flutter.FilePcmStream$PcmChunker");
    Constructor<?> ctor = type.getDeclaredConstructor(FilePcmStream.Callback.class, long.class);
    ctor.setAccessible(true);
    Object chunker = ctor.newInstance(callback, 1000L);
    Method accept = type.getDeclaredMethod("accept", float.class, int.class);
    Method flush = type.getDeclaredMethod("flush", boolean.class);
    accept.setAccessible(true); flush.setAccessible(true);
    for (int i = 0; i < 48000; i++) {
      fed[0] = i + 1;
      accept.invoke(chunker, (float) (Math.sin(i * 2 * Math.PI * 240 / 48000) * .25), 48000);
    }
    flush.invoke(chunker, true);
    if (firstAt[0] > 4801 || firstAt[0] >= 48000) throw new AssertionError("Waited for the complete source");
    int samples = 0;
    for (byte[] block : chunks) {
      for (int i = 0; i < block.length; i += 2) {
        int actual = (short) ((block[i] & 255) | ((block[i + 1] & 255) << 8));
        int expected = Math.round((float) (Math.sin(samples * 2 * Math.PI * 240 / 16000) * .25) * 32767f);
        if (Math.abs(actual - expected) > 1) throw new AssertionError("PCM continuity changed at " + samples);
        samples++;
      }
    }
    if (samples != 16000 || chunks.size() != 10) throw new AssertionError("PCM duration or chunk count changed");
    System.out.println("PASS_REUSED_FILE_DECODER_100MS_EARLY_CALLBACK_PCM_DURATION_AND_CONTINUITY");
  }
}
