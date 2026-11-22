package ai.hitel.media;
import java.util.*;
public final class HitelPairedAvQueueTest {
    private static void check(boolean b){if(!b) throw new AssertionError();}
    private static byte[] sequence(int start,int n){byte[] b=new byte[n];for(int i=0;i<n;i++)b[i]=(byte)(start+i);return b;}
    public static void main(String[] args){
        List<String> freed=new ArrayList<>();
        HitelPairedAvQueue<String> q=new HitelPairedAvQueue<>(100,4,freed::add);
        q.begin(1,1000);
        check(q.tryAppend(1,0,sequence(0,1000)));
        check(q.tryOfferFrame(1,1,"one"));
        check(q.poll()==null); // missing first video and PCM
        check(q.tryOfferFrame(1,0,"zero"));
        check(q.poll()==null); // still not enough PCM
        check(q.tryAppend(1,500,sequence(1000,1600)));
        HitelPairedAvQueue.Pair<String> p=q.poll();
        check(p.ordinal==0&&p.startSample==0&&p.endSample==640&&p.captureTimeNs==1000);
        check(Arrays.equals(p.pcm16,sequence(0,1280)));p.close();p.close();
        HitelPairedAvQueue.Pair<String> p1=q.poll();
        check(p1.ordinal==1&&p1.startSample==640&&p1.endSample==1280&&p1.captureTimeNs==40001000L);
        check(Arrays.equals(p1.pcm16,sequence(1280,1280)));p1.close();
        check(q.tryOfferFrame(1,2,"tail")); check(q.poll()==null);
        q.end(1,1300);HitelPairedAvQueue.Pair<String> tail=q.poll();
        check(tail.pcm16.length==40&&tail.endSample==1300);tail.close();
        check(q.drained()&&q.poll()==null);
        q.begin(2,2000);check(!q.tryAppend(1,0,new byte[2]));
        check(q.tryAppend(2,0,new byte[3200]));
        check(!q.tryAppend(2,1600,new byte[2])); // bounded
        check(q.tryOfferFrame(2,0,"cancelled"));
        q.begin(3,3000);check(q.emittedSamples()==0&&q.queuedFrames()==0);
        check(freed.equals(Arrays.asList("zero","one","tail","cancelled")));
        q.close();System.out.println("PASS_HITEL_PAIRED_AV_PCM_ORDINAL_GAPS_TAIL_BACKPRESSURE_CANCEL");
    }
}
