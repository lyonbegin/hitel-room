import com.hitel.zocbodiag.NativeFiveWorkerPool;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
public class PoolTest {
 static class Store implements NativeFiveWorkerPool.Store {
   int next, total; Set<String> done=new HashSet<>();
   Store(int n){total=n;}
   public String claim(){return next<total?""+(++next):null;}
   public void complete(String id,NativeFiveWorkerPool.Result r,String d){if(!done.add(id))throw new AssertionError("duplicate "+id);}
 }
 static void waitFor(NativeFiveWorkerPool p) throws Exception { long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);while(p.running()&&System.nanoTime()<deadline) Thread.sleep(5);if(p.running())throw new AssertionError("timeout"); }
 static void check(boolean b,String m){if(!b)throw new AssertionError(m);}
 public static void main(String[] args)throws Exception {
  Store s=new Store(1000); AtomicInteger active=new AtomicInteger(), max=new AtomicInteger(); CountDownLatch initial=new CountDownLatch(5);
  NativeFiveWorkerPool p=new NativeFiveWorkerPool(s,id->{int a=active.incrementAndGet();max.accumulateAndGet(a,Math::max);try{initial.countDown();if(!initial.await(2,TimeUnit.SECONDS))throw new AssertionError("not concurrent");if(id.equals("13"))throw new IllegalStateException();Thread.sleep(2);return NativeFiveWorkerPool.Result.SUCCESS;}finally{active.decrementAndGet();}});
  check(p.start(),"start");check(!p.start(),"duplicate start");waitFor(p);check(s.done.size()==1000,"terminal count");check(max.get()==5&&p.peak()==5,"max workers");check(p.active()==0,"cleanup");System.out.println("PASS 1000 unique terminal jobs, peak="+max.get()+", duplicate start refused, failure isolated");
  Store r=new Store(100); CountDownLatch gate=new CountDownLatch(5);NativeFiveWorkerPool q=new NativeFiveWorkerPool(r,id->{gate.countDown();gate.await();if(id.equals("1"))return NativeFiveWorkerPool.Result.RATE_LIMITED;Thread.sleep(100);return NativeFiveWorkerPool.Result.SUCCESS;});q.start();waitFor(q);check(r.next==5,"no new work after rate limit");check(q.stopReason().equals("RATE_LIMITED"),"reason");System.out.println("PASS rate-limited: no further claims, active work drained");
 }
}
