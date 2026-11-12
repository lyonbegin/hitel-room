package app.hitel.speakeronly;

import java.util.Arrays;
import java.util.Collections;

/** Host-side deterministic regression tests; no Android runtime required. */
public final class GrowingM4aSelectorTest {
  static GrowingM4aSelector.Entry file(String path,long size,long modified){
    return new GrowingM4aSelector.Entry(path,path.substring(path.lastIndexOf('/')+1),size,modified);
  }
  static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
  public static void main(String[] argv){
    GrowingM4aSelector selector=new GrowingM4aSelector();
    final GrowingM4aSelector.Entry old=file("content://call/old.m4a",1200000,100);
    final GrowingM4aSelector.Entry latest=file("content://call/new.m4a",10000,200);
    var initial=selector.observe(Arrays.asList(old,latest));
    check(initial.growing==null,"Must not play existing static file on first scan");
    check("new.m4a".equals(initial.latest.name),"Newest first not largest");
    check(selector.observe(Arrays.asList(old,latest)).growing==null,
      "Must not play file without size growth on second scan");
    var changing=selector.observe(Arrays.asList(old,file("content://call/new.m4a",12400,200)));
    check(changing.growing!=null&&changing.growing.name.equals("new.m4a"),
       "New M4A not selected when it grows");
    check(changing.growthBytes==2400,"Growth must be exact");
    var both=selector.observe(Arrays.asList(
       file("content://call/old.m4a",1600000,100),
       file("content://call/new.m4a",12800,200)));
    check(both.growing!=null&&both.growing.name.equals("new.m4a"),
       "Must select newest growing M4A even if older grows more");
    selector.observe(Collections.singletonList(old));
    check(selector.observe(Collections.singletonList(old)).growing==null,
       "Existing completed M4A must not trigger playback");
    var newFile=selector.observe(Arrays.asList(old,file("content://call/today.m4a",1024,1000)));
    check(newFile.growing==null,"Newly discovered file must grow on another poll");
    var growingNew=selector.observe(Arrays.asList(old,file("content://call/today.m4a",6144,1000)));
    check(growingNew.growing!=null&&growingNew.growing.name.equals("today.m4a"),
       "New file growth not detected");
    check(!GrowingM4aSelector.isM4a("old.mp3"),"Only M4A accepted");
    check(GrowingM4aSelector.isM4a("CALL.M4A"),"Case-insensitive .m4a required");
    System.out.println("PASS_LIVE_M4A_NEWEST_ACTUALLY_GROWING_ONLY");
  }
}
