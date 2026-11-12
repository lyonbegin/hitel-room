package app.hitel.speakeronly;

import java.util.Arrays;
import java.util.Collections;

/** Host-side regression: 100ms sampling, three distinct growth events,
 * older larger completed files never auto-start, Samsung 300ms writes work.
 */
public final class GrowingM4aSelectorTest {
  static GrowingM4aSelector.Entry file(String path,long size,long modified){
    return new GrowingM4aSelector.Entry(path,path.substring(path.lastIndexOf('/')+1),size,modified);
  }
  static void check(boolean ok,String why){if(!ok)throw new AssertionError(why);}
  public static void main(String[] args){
    GrowingM4aSelector detector=new GrowingM4aSelector();
    var old=file("content://calls/old.m4a",1200000,100);
    var recent=file("content://calls/current.m4a",10000,200);
    var scan=detector.observe(Arrays.asList(old,recent));
    check(scan.growing==null,"Past completed file must NOT play at baseline");
    check(scan.latest.name.equals("current.m4a"),"Newest must win, not largest");
    // 100ms samples; Samsung writes roughly every 300ms, so zero-growth
    // observations between writes must not reset the three-event proof.
    check(detector.observe(Arrays.asList(old,recent)).growing==null,"No growth at 100ms");
    recent=file("content://calls/current.m4a",12200,200);
    scan=detector.observe(Arrays.asList(old,recent));
    check(scan.growing==null&&scan.verifiedGrowthEvents==1,"First growth is insufficient");
    for(int i=0;i<2;i++)check(
      detector.observe(Arrays.asList(old,recent)).growing==null,"100ms pause should not count");
    recent=file("content://calls/current.m4a",14400,200);
    scan=detector.observe(Arrays.asList(old,recent));
    check(scan.growing==null&&scan.verifiedGrowthEvents==2,"Second growth insufficient");
    for(int i=0;i<2;i++)check(
      detector.observe(Arrays.asList(old,recent)).growing==null,"Stable 100ms read");
    recent=file("content://calls/current.m4a",16600,200);
    scan=detector.observe(Arrays.asList(
      file("content://calls/old.m4a",1600000,100),recent));
    check(scan.growing!=null&&scan.growing.name.equals("current.m4a"),
      "Newest positively growing M4A must win even if older file grew much more");
    check(scan.verifiedGrowthEvents==3,"Must verify three real positive size changes");
    check(scan.growthBytes==2200,"Actual change bytes required");
    // New file discovered mid-call starts at zero confirmations.
    var latest=file("content://calls/now.m4a",3000,500);
    check(detector.observe(Arrays.asList(old,latest)).growing==null,"New file one sample");
    check(detector.observe(Arrays.asList(old,file("content://calls/now.m4a",5000,500))).growing==null,"New first growth");
    check(detector.observe(Arrays.asList(old,file("content://calls/now.m4a",7000,500))).growing==null,"New second growth");
    scan=detector.observe(Arrays.asList(old,file("content://calls/now.m4a",9000,500)));
    check(scan.growing!=null&&scan.growing.name.equals("now.m4a"),"New third growth");
    // A file stalled for over 3s must not reuse old growth confirmations.
    detector.observe(Collections.singletonList(file("content://calls/stale.m4a",3000,800)));
    detector.observe(Collections.singletonList(file("content://calls/stale.m4a",4000,800)));
    detector.observe(Collections.singletonList(file("content://calls/stale.m4a",5000,800)));
    for(int i=0;i<35;i++)detector.observe(Collections.singletonList(file("content://calls/stale.m4a",5000,800)));
    scan=detector.observe(Collections.singletonList(file("content://calls/stale.m4a",6000,800)));
    check(scan.growing==null&&scan.verifiedGrowthEvents==1,"Stagnant previous growths must expire");
    check(!GrowingM4aSelector.isM4a("previous.mp3"),"Do not accept non M4A");
    check(GrowingM4aSelector.isM4a("CALL.M4A"),"Case insensitive M4A");
    System.out.println("PASS_100MS_THREE_DISTINCT_GROWTH_EVENTS_SAMSUNG_300MS_CADENCE");
  }
}
