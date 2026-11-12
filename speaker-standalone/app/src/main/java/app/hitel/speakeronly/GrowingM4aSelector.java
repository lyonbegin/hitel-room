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
    Decision(Entry latest,Entry growing,long growthBytes,int files){
      this.latest=latest;this.growing=growing;this.growthBytes=growthBytes;this.files=files;
    }
  }
  private Map<String,Long> lastSizes=new HashMap<>();
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
    for(Entry e:candidates){
      Long previous=lastSizes.get(e.uri);
      if(previous==null||e.bytes<=previous||e.bytes<512)continue;
      if(growing==null){growing=e;growth=e.bytes-previous;}
    }
    lastSizes=newSizes;
    return new Decision(candidates.isEmpty()?null:candidates.get(0),
                        growing,growth,candidates.size());
  }
}
