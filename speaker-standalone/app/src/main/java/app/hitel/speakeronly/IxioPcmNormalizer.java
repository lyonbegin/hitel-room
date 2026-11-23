package app.hitel.speakeronly;

/**
 * Lossless-in-time PCM16LE -> signed floating point conversion for the ORIGINAL
 * IXIO speechSDK. The IXIO SDK expects 16kHz mono float[] in [-1, +1).
 *
 * There is deliberately NO auto-gain, noise gate, per-window normalization,
 * time stretching, frequency scaling or extra pre-emphasis. Every source
 * PCM16 frame becomes exactly one destination sample.
 */
final class IxioPcmNormalizer {
  static final int SAMPLE_RATE=16000;
  static final int BYTES_PER_SAMPLE=2;

  private IxioPcmNormalizer(){}

  static float[] decode(byte[] pcm) {
    if(pcm==null || (pcm.length&1)!=0)
      throw new IllegalArgumentException("PCM must be nonnull, signed 16-bit LE mono");
    float[] samples=new float[pcm.length/2];
    for(int i=0,j=0;i<samples.length;i++,j+=2){
      int raw=(pcm[j]&0xff)|((pcm[j+1]&0xff)<<8);
      short signed=(short)raw;
      samples[i]=signed/32768.0f;
    }
    return samples;
  }

  static Stats stats(float[] samples){
    if(samples==null)throw new IllegalArgumentException("PCM float[] null");
    double sum=0,square=0;int clipped=0,nonzero=0,finite=0;
    float peak=0f;
    for(float v:samples){
      if(!Float.isFinite(v))continue;
      finite++;
      float a=Math.abs(v);
      peak=Math.max(peak,a);
      if(a>=0.999f)clipped++;
      if(a>0.0076f)nonzero++;
      sum+=v;square+=(double)v*v;
    }
    return new Stats(samples.length,finite,nonzero,clipped,peak,
      finite==0?0:sum/finite,
      finite==0?0:Math.sqrt(square/finite));
  }

  static final class Stats{
    final int frames,finite,nonzero,clipped;
    final float peak;
    final double dc,rms;
    Stats(int f,int valid,int nz,int cl,float p,double d,double r){
      frames=f;finite=valid;nonzero=nz;clipped=cl;peak=p;dc=d;rms=r;
    }
    boolean hasInvalid(){return finite!=frames;}
    boolean isNearSilent(){return rms<0.001;}
  }
}
