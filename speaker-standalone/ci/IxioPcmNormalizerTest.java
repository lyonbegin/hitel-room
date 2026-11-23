package app.hitel.speakeronly;

public final class IxioPcmNormalizerTest {
  static void equal(float a,float b){
    if(Math.abs(a-b)>0.0000001f)throw new AssertionError(a+" != "+b);
  }
  static byte[] toPCM(short[] shorts){
    byte[] b=new byte[shorts.length*2];
    for(int i=0;i<shorts.length;i++){
      int value=shorts[i];
      b[2*i]=(byte)(value&255);
      b[2*i+1]=(byte)((value>>>8)&255);
    }
    return b;
  }
  public static void main(String[] args){
    short[] input={(short)-32768,(short)-16384,(short)-1,0,1,(short)16384,(short)32767};
    float[] f=IxioPcmNormalizer.decode(toPCM(input));
    if(f.length!=input.length)throw new AssertionError("sample count changed");
    for(int i=0;i<f.length;i++)equal(f[i],input[i]/32768f);
    IxioPcmNormalizer.Stats s=IxioPcmNormalizer.stats(f);
    if(s.hasInvalid()||s.frames!=7||s.clipped!=2||s.peak!=1f)
      throw new AssertionError("incorrect format stats");
    boolean rejected=false;
    try{IxioPcmNormalizer.decode(new byte[3]);}
    catch(IllegalArgumentException e){rejected=true;}
    if(!rejected)throw new AssertionError("odd PCM byte count accepted");
    float[] zero=IxioPcmNormalizer.decode(new byte[6400]);
    if(zero.length!=3200 || !IxioPcmNormalizer.stats(zero).isNearSilent())
      throw new AssertionError("200ms zero PCM contract violation");
    float[] one=IxioPcmNormalizer.decode(toPCM(new short[]{2048}));
    equal(one[0],0.0625f);
    System.out.println("PASS_IXIO_PCM16_TO_16K_MONO_FLOAT_EXACT_SAMPLE_AMPLITUDE_AND_WINDOW");
  }
}
