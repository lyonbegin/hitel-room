package app.hitel.sherpaoriginalcli;

import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaFormat;
import android.os.SystemClock;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Persistent Samsung AAC-LC 48kHz mono decoder. Input is ONLY the new ADTS
 * frames recovered from the latest mdat source cursor; each raw AAC frame is
 * queued once into the SAME Android MediaCodec, and newly decoded PCM is sent
 * to the SAME already-running sherpa-onnx OnlineStream. Never gates on VAD,
 * silence, or an utterance boundary. No FFmpeg process is restarted per delta.
 */
final class StreamingAacPcmDecoder implements AutoCloseable {
  interface PcmSink { void accept(byte[] pcm) throws Exception; }
  private static final int SOURCE_RATE=48000, RATE=16000, FILTER=33;
  private static final int PCM_WINDOW_BYTES=RATE*2/5; // 200ms max, flush sooner
  private final MediaCodec codec;
  private final TraceJournal journal;
  private final MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();
  private final ByteArrayOutputStream pcm=new ByteArrayOutputStream(PCM_WINDOW_BYTES+4096);
  private final float[] history=new float[FILTER];
  private final double[] taps=new double[FILTER];
  private int historyHead, channels=1, outputRate=SOURCE_RATE, outputEncoding=AudioFormat.ENCODING_PCM_16BIT;
  private long sampleCount, inputFrames, outputSamples, outputPcmBytes;
  private boolean ended;

  StreamingAacPcmDecoder(TraceJournal log) throws Exception {
    journal=log;
    codec=MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
    MediaFormat format=MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC,SOURCE_RATE,1);
    // AAC-LC objectType=2, sampleRateIndex=3 (48k), channelConfig=1 (mono).
    format.setByteBuffer("csd-0",ByteBuffer.wrap(new byte[]{(byte)0x11,(byte)0x88}));
    codec.configure(format,null,null,0);
    codec.start();
    double total=0;
    for(int i=0;i<FILTER;i++){
      int d=i-(FILTER-1)/2;
      double cutoff=0.145; // cycles per 48k sample, stop before 16k Nyquist
      double sinc=d==0?2*cutoff:Math.sin(2*Math.PI*cutoff*d)/(Math.PI*d);
      taps[i]=sinc*(0.54-0.46*Math.cos(2*Math.PI*i/(FILTER-1)));
      total+=taps[i];
    }
    for(int i=0;i<FILTER;i++)taps[i]/=total;
    journal.event("STREAM","PERSISTENT_ANDROID_AAC_DECODER_STARTED",
      "codec",codec.getName(),"sourceRate",SOURCE_RATE,"pcmRate",RATE,
      "ffmpegRestartPerDelta",false,"vadWait",false);
  }
  static void readFully(InputStream in,byte[] data,int off,int length)throws IOException {
    int at=0;
    while(at<length){
      int n=in.read(data,off+at,length-at);
      if(n<0)throw new EOFException("Truncated recovered ADTS frame");
      at+=n;
    }
  }
  /** Complete recovered ADTS DELTA only: none of the old source is decoded. */
  long feed(File file,int attempt,PcmSink sink)throws Exception {
    if(ended)throw new IllegalStateException("AAC streaming decoder already ended");
    long frames=0,begin=SystemClock.elapsedRealtime(),before=outputPcmBytes;
    try(InputStream in=new BufferedInputStream(new FileInputStream(file))){
      byte[] h=new byte[7];
      while(in.read(h,0,1)!=-1){
        readFully(in,h,1,6);
        if((h[0]&255)!=255||(h[1]&0xf0)!=0xf0)
          throw new IOException("Recovered AAC stream contains invalid ADTS sync");
        int sampleIndex=(h[2]>>2)&15;
        int nChannels=((h[2]&1)<<2)|((h[3]>>6)&3);
        if(sampleIndex!=3 || nChannels!=1)
          throw new IOException("Unexpected AAC profile "+sampleIndex+"/"+nChannels);
        int frameLength=((h[3]&3)<<11)|((h[4]&255)<<3)|((h[5]&224)>>5);
        int headerLength=(h[1]&1)==1?7:9;
        if(frameLength<=headerLength || frameLength>8192)
          throw new IOException("Invalid ADTS frame length: "+frameLength);
        int payload=frameLength-headerLength;
        if(headerLength==9){byte[] crc=new byte[2];readFully(in,crc,0,2);}
        byte[] data=new byte[payload];
        readFully(in,data,0,data.length);
        queueFrame(data,sink);
        ++frames;
      }
    }
    drain(sink,0);
    flushPcm(sink); // publish latest samples without waiting for phrase end
    journal.timing("STREAM","AAC_DELTA_DECODED","attempt",attempt,
      "newAacFrames",frames,"pcmBytes",outputPcmBytes-before,
      "durationMs",SystemClock.elapsedRealtime()-begin,
      "totalAacFrames",inputFrames,"totalPcmBytes",outputPcmBytes);
    return frames;
  }
  private void queueFrame(byte[] data,PcmSink sink)throws Exception {
    long begin=SystemClock.elapsedRealtime();
    for(;;){
      int idx=codec.dequeueInputBuffer(3000);
      if(idx>=0){
        ByteBuffer input=codec.getInputBuffer(idx);
        if(input==null || input.capacity()<data.length)
          throw new IOException("Android MediaCodec AAC input buffer too small");
        input.clear();input.put(data);
        codec.queueInputBuffer(idx,0,data.length,inputFrames*1024L*1000000L/SOURCE_RATE,0);
        inputFrames++;
        drain(sink,0);
        return;
      }
      drain(sink,3000);
      if(SystemClock.elapsedRealtime()-begin>15000)
        throw new IOException("Persistent MediaCodec AAC input queue blocked for 15s");
    }
  }
  private boolean drain(PcmSink sink,long timeoutUs)throws Exception {
    boolean eos=false;
    for(int loops=0;loops<512;loops++){
      int idx=codec.dequeueOutputBuffer(info,timeoutUs);
      if(idx==MediaCodec.INFO_TRY_AGAIN_LATER)break;
      if(idx==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){
        MediaFormat f=codec.getOutputFormat();
        if(f.containsKey(MediaFormat.KEY_SAMPLE_RATE))outputRate=f.getInteger(MediaFormat.KEY_SAMPLE_RATE);
        if(f.containsKey(MediaFormat.KEY_CHANNEL_COUNT))channels=f.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
        if(f.containsKey(MediaFormat.KEY_PCM_ENCODING))outputEncoding=f.getInteger(MediaFormat.KEY_PCM_ENCODING);
        journal.event("STREAM","MEDIA_CODEC_OUTPUT_FORMAT",
          "rate",outputRate,"channels",channels,"encoding",outputEncoding);
        if(outputRate!=SOURCE_RATE || channels!=1 ||
            outputEncoding!=AudioFormat.ENCODING_PCM_16BIT)
          throw new IOException("Unsupported AAC PCM format "+outputRate+"/"+channels+"/"+outputEncoding);
        continue;
      }
      if(idx<0)continue;
      try{
        ByteBuffer out=codec.getOutputBuffer(idx);
        if(out!=null && info.size>0){
          out.order(ByteOrder.LITTLE_ENDIAN);
          out.position(info.offset);out.limit(info.offset+info.size);
          while(out.remaining()>=2){
            short sample=out.getShort();
            pushSample(sample,sink);
          }
        }
        eos=(info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
      }finally{codec.releaseOutputBuffer(idx,false);}
      if(eos)break;
      timeoutUs=0;
    }
    return eos;
  }
  private void pushSample(short value,PcmSink sink)throws Exception {
    history[historyHead]=value;
    historyHead=(historyHead+1)%FILTER;
    sampleCount++;
    if(sampleCount%3!=0)return; // 48k -> 16k, preserve FIR filter state
    double val=0;
    for(int k=0;k<FILTER;k++){
      int idx=(historyHead+k)%FILTER;
      val+=history[idx]*taps[k];
    }
    int v=(int)Math.round(val);
    v=Math.max(Short.MIN_VALUE,Math.min(Short.MAX_VALUE,v));
    pcm.write(v&255);pcm.write((v>>>8)&255);
    outputSamples++;
    outputPcmBytes+=2;
    if(pcm.size()>=PCM_WINDOW_BYTES)flushPcm(sink);
  }
  private void flushPcm(PcmSink sink)throws Exception {
    if(pcm.size()==0)return;
    byte[] data=pcm.toByteArray();
    pcm.reset();
    sink.accept(data);
  }
  long pcmBytes(){return outputPcmBytes;}
  void finish(PcmSink sink)throws Exception {
    if(ended)return;
    long begin=SystemClock.elapsedRealtime();
    boolean queued=false;
    while(!queued && SystemClock.elapsedRealtime()-begin<2000){
      int idx=codec.dequeueInputBuffer(10000);
      if(idx>=0){
        codec.queueInputBuffer(idx,0,0,inputFrames*1024L*1000000L/SOURCE_RATE,
          MediaCodec.BUFFER_FLAG_END_OF_STREAM);
        queued=true;
      }else drain(sink,0);
    }
    if(queued){
      for(int i=0;i<80;i++){
        if(drain(sink,10000))break;
      }
    }
    flushPcm(sink);
    ended=true;
    journal.event("STREAM","EOS_COMPLETE","aacFrames",inputFrames,
      "pcmSamples",outputSamples,"pcmBytes",outputPcmBytes);
  }
  @Override public void close(){
    ended=true;
    try{codec.stop();}catch(Exception ignored){}
    codec.release();
    journal.event("STREAM","MEDIA_CODEC_RELEASED","aacFrames",inputFrames,
      "pcmBytes",outputPcmBytes);
  }
}
