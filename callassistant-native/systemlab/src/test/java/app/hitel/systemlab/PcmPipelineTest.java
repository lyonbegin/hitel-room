package app.hitel.systemlab;
import org.junit.Test;
import static org.junit.Assert.*;
public class PcmPipelineTest {
  @Test public void emitsNonzeroPcm16() {
    byte[] pcm = PcmPipeline.tone(200, 800);
    assertEquals(6400, pcm.length);
    assertTrue(PcmPipeline.peak(pcm, pcm.length) > 3500);
  }
  @Test public void silenceHasZeroPeak() {
    assertEquals(0, PcmPipeline.peak(new byte[640], 640));
  }
  @Test(expected = IllegalArgumentException.class)
  public void highFrequencyRejected() {
    PcmPipeline.tone(200, 9000);
  }
}
