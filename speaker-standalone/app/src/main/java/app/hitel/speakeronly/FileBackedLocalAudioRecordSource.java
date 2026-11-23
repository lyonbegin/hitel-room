package app.hitel.speakeronly;

import java.io.IOException;
import java.util.Arrays;

/**
 * File-backed port of IXIO LocalAudioRecordSource's PCM producer contract.
 *
 * Original: VOICE_DOWNLINK AudioRecord.read(short[512]) ->
 *           each short / 32768.0f -> reusable float[512] -> Flow collector.
 * This port replaces ONLY AudioRecord.read with a byte stream sourced from
 * the Samsung recording's already decoded PCM16LE. The existing upstream
 * AAC demuxer and MediaCodec still decode the growing M4A.
 *
 * The collector is called synchronously and MUST take ownership by copying
 * the reusable float[] before returning (as IXIO's CallScriptManager does
 * with Arrays.copyOf). No audio is buffered to disk or re-encoded here.
 */
final class FileBackedLocalAudioRecordSource {
  static final int SAMPLE_RATE=16000;
  static final int FRAME_SAMPLES=512;
  static final int PCM_BYTES_PER_SAMPLE=2;

  interface FloatPcmCollector {
    void emit(float[] reusablePcmSamples) throws Exception;
  }

  private final FloatPcmCollector collector;
  private final short[] pcm16Buffer=new short[FRAME_SAMPLES];
  private final float[] normalizedBuffer=new float[FRAME_SAMPLES];
  private int bufferedSamples;
  private int pendingLowByte=-1;
  private long emittedSamples,emittedFrames;
  private boolean finished;

  FileBackedLocalAudioRecordSource(FloatPcmCollector collector) {
    if(collector==null)throw new IllegalArgumentException("PCM collector required");
    this.collector=collector;
  }

  /** One or more bytes from a continuous, 16kHz mono, signed little-endian PCM16 stream. */
  synchronized void accept(byte[] pcm) throws Exception {
    if(finished)throw new IOException("File-backed PCM source is already finished");
    if(pcm==null)throw new IOException("File-backed PCM source received null input");
    for(int i=0;i<pcm.length;i++){
      int next=pcm[i]&0xff;
      if(pendingLowByte<0){
        pendingLowByte=next;
        continue;
      }
      short sample=(short)(pendingLowByte | (next<<8));
      pendingLowByte=-1;
      pcm16Buffer[bufferedSamples++]=sample;
      if(bufferedSamples==FRAME_SAMPLES)emitFrame(FRAME_SAMPLES);
    }
  }

  private void emitFrame(int count) throws Exception {
    // Exactly the original LocalAudioRecordSource conversion:
    //      int-to-float(shortSample) / 32768.0f
    for(int i=0;i<count;i++)normalizedBuffer[i]=pcm16Buffer[i]/32768.0f;
    // The normal full frame reuses the original-style float[512].
    // The terminal partial frame gets an exact-length array (no padded silence).
    collector.emit(count==FRAME_SAMPLES?normalizedBuffer:Arrays.copyOf(normalizedBuffer,count));
    emittedSamples+=count;
    emittedFrames++;
    bufferedSamples=0;
  }

  synchronized void finish() throws Exception {
    if(finished)return;
    if(pendingLowByte>=0)
      throw new IOException("Truncated PCM16 stream: unmatched final byte");
    if(bufferedSamples>0)emitFrame(bufferedSamples);
    finished=true;
  }

  synchronized long emittedSamples(){return emittedSamples;}
  synchronized long emittedFrames(){return emittedFrames;}
  synchronized int bufferedSamples(){return bufferedSamples;}
}
