package app.hitel.sherpaoriginalcli;

import android.os.SystemClock;
import android.util.Log;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Dedicated low-overhead stage timeline. The audio and UI threads only enqueue
 * timestamped events; a separate writer serializes JSON and performs file I/O.
 * All boot_ns timestamps use Android CLOCK_BOOTTIME, shared with native
 * clock_gettime(CLOCK_BOOTTIME). wall_iso is for human inspection only.
 */
final class LatencyTrace {
  private static final int CAPACITY=32768;
  private final ArrayBlockingQueue<Metric> queue=new ArrayBlockingQueue<>(CAPACITY);
  private final AtomicLong nextId=new AtomicLong();
  private final AtomicLong dropped=new AtomicLong();
  private final AtomicBoolean closing=new AtomicBoolean(false);
  private final long startedNs=SystemClock.elapsedRealtimeNanos();
  private final Thread writer;
  private static final class Metric {
    final long bootNs,wallMs,id;
    final String stage,event;
    final Map<String,Object> data;
    Metric(long ns,long ms,long id,String stage,String event,Map<String,Object> data){
      this.bootNs=ns;this.wallMs=ms;this.id=id;
      this.stage=stage;this.event=event;this.data=data;
    }
  }
  LatencyTrace(File directory) {
    File out=new File(directory,"latency-trace.jsonl");
    writer=new Thread(()->writeLoop(out),"Galaxy-Latency-Log-Writer");
    writer.setPriority(Thread.MIN_PRIORITY);
    writer.start();
    at(startedNs,"CLOCK","SYNC",TraceJournal.map("wallEpochMs",System.currentTimeMillis(),
      "bootNs",startedNs,"clock","CLOCK_BOOTTIME","note","wall and boot clocks sampled separately"));
  }
  void at(long eventNs,String stage,String event,Map<String,Object> data){
    if(closing.get())return;
    Metric m=new Metric(eventNs,System.currentTimeMillis(),nextId.incrementAndGet(),stage,event,data);
    if(!queue.offer(m))dropped.incrementAndGet();
  }
  void add(String stage,String event,Map<String,Object> data){
    at(SystemClock.elapsedRealtimeNanos(),stage,event,data);
  }
  long lost(){return dropped.get();}
  private void writeLoop(File out){
    SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ",Locale.US);
    format.setTimeZone(TimeZone.getDefault());
    try(FileOutputStream file=new FileOutputStream(out,true)){
      while(!closing.get()||!queue.isEmpty()){
        Metric m=queue.poll(150,TimeUnit.MILLISECONDS);
        if(m==null)continue;
        try{
          JSONObject json=new JSONObject();
          json.put("id",m.id);
          json.put("wall_iso",format.format(new Date(m.wallMs)));
          json.put("boot_ns",m.bootNs);
          json.put("elapsed_ms",(m.bootNs-startedNs)/1000000.0);
          json.put("stage",m.stage);
          json.put("event",m.event);
          json.put("data",new JSONObject(m.data));
          file.write((json.toString()+"\n").getBytes(StandardCharsets.UTF_8));
        }catch(Exception e){Log.e("GalaxyLatencyTrace","Could not serialize metric",e);}
      }
      JSONObject end=new JSONObject();
      end.put("stage","CLOCK");end.put("event","LOG_CLOSED");
      end.put("boot_ns",SystemClock.elapsedRealtimeNanos());
      end.put("dropped",dropped.get());
      file.write((end.toString()+"\n").getBytes(StandardCharsets.UTF_8));
      file.flush();
    }catch(Exception e){Log.e("GalaxyLatencyTrace","Timeline writer failed",e);}
  }
  void close(){
    if(!closing.compareAndSet(false,true))return;
    try{writer.join(4000);}catch(InterruptedException e){Thread.currentThread().interrupt();}
  }
}
