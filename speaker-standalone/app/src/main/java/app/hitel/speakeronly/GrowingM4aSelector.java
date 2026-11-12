package app.hitel.speakeronly;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Stateful detection: only a file that grew between consecutive observations
 * is considered a LIVE recording. Never auto-play a completed M4A.
 * Framework-independent so the same decision is exercised in GitHub CI.
 */
final class GrowingM4aSelector {
  static final class Entry {
    final String uri, name;
    final long bytes, modified;
    Entry(String uri,String name,long bytes,long modified){
      this.uri=uri;this.name=name;this.bytes=bytes;this.modified=modified;
    }
  }
  static final class Decision {
    final Entry latest;
    final Entry growing;
    final long growthBytes;
    final int files;
    final int verifiedGrowthEvents;
    Decision(Entry latest,Entry growing,long growthBytes,int files,int verifiedGrowthEvents){
      this.latest=latest;this.growing=growing;this.growthBytes=growthBytes;
      this.files=files;this.verifiedGrowthEvents=verifiedGrowthEvents;
    }
  }
  private Map<String,Long> lastSizes=new HashMap<>();
  private Map<String,Integer> growthEvents=new HashMap<>();
  private Map<String,Integer> stagnantPolls=new HashMap<>();
  static final int MIN_GROWTH_EVENTS=3;
  // A Samsung recorder may append AAC every ~300ms even if sampled at 100ms.
  // Count three distinct POSITIVE growth events, not three consecutive polls.
  static final int STAGNANT_LIMIT_POLLS=30;
  static boolean isM4a(String name){
    return name!=null&&name.toLowerCase(Locale.ROOT).endsWith(".m4a");
  }
  Decision observe(List<Entry> list){
    List<Entry> candidates=new ArrayList<>();
    Map<String,Long> newSizes=new HashMap<>();
    for(Entry e:list){
      if(!isM4a(e.name)||e.uri==null||e.bytes<0)continue;
      candidates.add(e);
      newSizes.put(e.uri,e.bytes);
    }
    // Newest first, independent of whether old file is larger.
    Comparator<Entry> newest=(a,b)->{
      int mod=Long.compare(b.modified,a.modified);
      if(mod!=0)return mod;
      return b.name.compareTo(a.name);
    };
    Collections.sort(candidates,newest);
    Entry growing=null;long growth=0;
    int progress=0;
    Map<String,Integer> nextEvents=new HashMap<>();
    Map<String,Integer> nextStale=new HashMap<>();
    for(Entry e:candidates){
      Long previous=lastSizes.get(e.uri);
      int count=growthEvents.containsKey(e.uri)?growthEvents.get(e.uri):0;
      int stale=stagnantPolls.containsKey(e.uri)?stagnantPolls.get(e.uri):0;
      if(previous==null||e.bytes<previous||e.bytes<512){
        count=0;stale=0;
      }else if(e.bytes>previous){
        count=Math.min(MIN_GROWTH_EVENTS,count+1);
        stale=0;
      }else{
        stale++;
        if(stale>STAGNANT_LIMIT_POLLS)count=0;
      }
      nextEvents.put(e.uri,count);
      nextStale.put(e.uri,stale);
      if(progress==0)progress=count;
      if(growing==null && previous!=null && e.bytes>previous &&
         count>=MIN_GROWTH_EVENTS){
        growing=e;
        growth=e.bytes-previous;
      }
    }
    lastSizes=newSizes;
    growthEvents=nextEvents;
    stagnantPolls=nextStale;
    return new Decision(candidates.isEmpty()?null:candidates.get(0),
                        growing,growth,candidates.size(),progress);
  }
}
