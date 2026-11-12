package app.hitel.sherpaoriginalcli;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.SystemClock;
import java.io.IOException;

/**
 * Speaker-only diagnostic for the exact 16,000 Hz mono PCM16 bytes that would
 * otherwise be fed to sherpa-onnx. No STT process or model is started.
 * The Android audio mixer may resample 16 kHz to the hardware output rate.
 */
final class PcmSpeakerMonitor implements AutoCloseable {
  static final int RATE = 16000;
  private final TraceJournal journal;
  private final AudioTrack track;
  private long totalWritten;
  private int writes;
  private boolean closed;

  PcmSpeakerMonitor(TraceJournal journal) throws IOException {
    this.journal=journal;
    int minimum=AudioTrack.getMinBufferSize(
        RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
    if(minimum<=0)throw new IOException("16kHz AudioTrack unsupported: "+minimum);
    final int capacity=Math.max(minimum, RATE*2/4);
    AudioAttributes attributes=new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build();
    AudioFormat format=new AudioFormat.Builder()
        .setSampleRate(RATE)
        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .build();
    track=new AudioTrack(attributes,format,capacity,AudioTrack.MODE_STREAM,0);
    if(track.getState()!=AudioTrack.STATE_INITIALIZED){
      track.release();
      throw new IOException("16kHz AudioTrack initialization failed");
    }
    track.play();
    if(track.getPlayState()!=AudioTrack.PLAYSTATE_PLAYING){
      track.release();
      throw new IOException("16kHz AudioTrack did not enter playing state");
    }
    journal.event("SPEAKER","SPEAKER_TRACK_STARTED","sampleRate",RATE,
      "channels",1,"pcmBits",16,"bufferBytes",capacity,
      "minBufferBytes",minimum,"mode","SPEAKER_ONLY_NO_STT");
  }

  synchronized void write(byte[] pcm) throws IOException {
    if(closed)throw new IOException("Speaker monitor already closed");
    if(pcm==null || pcm.length==0)return;
    if((pcm.length&1)!=0)throw new IOException("Odd PCM16 byte count");
    long start=SystemClock.elapsedRealtimeNanos();
    int offset=0;
    while(offset<pcm.length){
      int wrote=track.write(pcm,offset,pcm.length-offset,AudioTrack.WRITE_BLOCKING);
      if(wrote<=0)throw new IOException("AudioTrack.write error="+wrote);
      offset+=wrote;
    }
    totalWritten+=pcm.length;
    writes++;
    long head=(track.getPlaybackHeadPosition()&0xffffffffL);
    journal.timingAt(SystemClock.elapsedRealtimeNanos(),"SPEAKER","PCM_PLAYBACK_WRITE",
      "pcmBytes",pcm.length,"totalPcmBytes",totalWritten,
      "writtenAudioMs",totalWritten/32,
      "playedAudioMs",head*1000/RATE,
      "playState",track.getPlayState(),
      "writeDurationMs",(SystemClock.elapsedRealtimeNanos()-start)/1000000.0);
    if(writes<=3 || writes%5==0)
      journal.event("SPEAKER","PLAYBACK_PROGRESS","chunks",writes,
        "totalPcmBytes",totalWritten,"queuedAudioMs",totalWritten/32,
        "playedAudioMs",head*1000/RATE);
  }

  @Override public synchronized void close(){
    if(closed)return;
    closed=true;
    long played=(track.getPlaybackHeadPosition()&0xffffffffL);
    journal.event("SPEAKER","SPEAKER_TRACK_FINISHED",
      "writtenPcmBytes",totalWritten,"writtenAudioMs",totalWritten/32,
      "playedAudioMs",played*1000/RATE,"chunks",writes);
    try{track.stop();}catch(IllegalStateException ignored){}
    track.release();
  }
}
