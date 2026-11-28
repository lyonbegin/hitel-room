package app.hitel.speakeronly;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
public final class Pcm512PacerTest {
  static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
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
    java.util.concurrent.LinkedBlockingQueue<byte[]> fifo=new java.util.concurrent.LinkedBlockingQueue<>(frames.size()+1);
    fifo.addAll(frames);
    for(byte[] expected:frames)check(Arrays.equals(expected,fifo.poll()),"FIFO order");
    check(fifo.isEmpty(),"all queued frames consumed");
    System.out.println("PASS_PCM512_BYTE_EXACT_FRAMING_EOF_PADDING_FIFO");
  }
}
