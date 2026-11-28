package app.hitel.speakeronly;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
public final class Pcm512PacerTest {
  static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
  static final class FakeClock implements Pcm32Pacer.Clock {
    long time;
    public long now(){return time;}
    public void sleep(long ns){time+=ns;}
  }
  public static void main(String[] args)throws Exception{
    byte[] source=new byte[13964];
    for(int i=0;i<source.length;i++)source[i]=(byte)(i*31);
    Pcm512Framer f=new Pcm512Framer();
    ArrayList<byte[]> frames=new ArrayList<>();
    for(int i=0;i<source.length;){
      int n=Math.min(i==0?6400:682,source.length-i);
      f.accept(Arrays.copyOfRange(source,i,i+n),frames::add);i+=n;
    }
    check(frames.size()==source.length/1024,"full frame count");
    int pad=f.finish(frames::add);
    check(pad==(1024-source.length%1024)/2,"EOF pad count");
    ByteArrayOutputStream out=new ByteArrayOutputStream();
    for(byte[] b:frames){check(b.length==1024,"fixed frame");out.write(b);}
    byte[] result=out.toByteArray();
    check(Arrays.equals(source,Arrays.copyOf(result,source.length)),"no audio loss/reorder");
    for(int i=source.length;i<result.length;i++)check(result[i]==0,"only EOF zero padding");
    check(f.finish(frames::add)==0,"no repeated EOF");
    FakeClock c=new FakeClock();Pcm32Pacer pace=new Pcm32Pacer(c);
    check(pace.await()==0,"first immediate");
    c.time+=10_000_000L;check(pace.await()==32_000_000L,"normal 32ms");
    c.time+=79_000_000L;check(pace.await()==111_000_000L,"overrun no extra delay");
    check(pace.await()==143_000_000L,"no catch-up burst");
    c.time+=250_000_000L;check(pace.await()==393_000_000L,"starvation recovery");
    check(pace.await()==425_000_000L,"rebase after starvation");
    Pcm32Pacer real=new Pcm32Pacer(new Pcm32Pacer.Clock(){
      public long now(){return System.nanoTime();}
      public void sleep(long ns)throws InterruptedException{Thread.sleep(ns/1000000L,(int)(ns%1000000L));}
    });
    long first=real.await(),prev=first,min=Long.MAX_VALUE,max=0;
    for(int i=0;i<20;i++){long at=real.await(),dt=at-prev;check(dt>=32000000L,"no burst");min=Math.min(min,dt);max=Math.max(max,dt);prev=at;}
    System.out.println("PASS_PCM512_BYTE_EXACT_FRAMING_EOF_PADDING_AND_32MS_NO_BURST minNs="+min+" maxNs="+max+" elapsedNs="+(prev-first));
  }
}
