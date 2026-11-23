package app.hitel.speakeronly;

/** JVM-only checks for partials, corrections, endpoint clearing and no accumulation. */
public final class IxioLiveCaptionStateTest {
  private static void same(String actual,String expected){
    if(expected==null?actual!=null:!expected.equals(actual))
      throw new AssertionError("expected "+expected+" but was "+actual);
  }
  private static void check(boolean condition,String reason){
    if(!condition)throw new AssertionError(reason);
  }
  public static void main(String[] args){
    IxioLiveCaptionState s=new IxioLiveCaptionState();
    same(s.onPartial("한국"),"한국");
    same(s.onPartial("한국"),null); // repeated hypothesis must not redraw
    same(s.onPartial("한국 산업"),"한국 산업");
    same(s.onPartial("한국 산어"),"한국 산어"); // original SDK may correct text
    check(s.onEndpoint(),"endpoint must clear current utterance");
    same(s.current(),"");
    same(s.onPartial("다음 문장"),"다음 문장"); // no old history
    same(s.current(),"다음 문장");
    check(s.onEndpoint(),"second endpoint clears");
    check(!s.onEndpoint(),"empty SDK endpoint remains empty");
    same(s.onPartial(""),null); // blank nonendpoint is not a new hypothesis
    same(s.onPartial("새로운"),"새로운");
    check(s.hasVisibleText(),"visible after new partial");
    System.out.println("PASS_IXIO_LIVE_CAPTION_CURRENT_UTTERANCE_NO_CUMULATIVE_TEXT_AND_ENDPOINT_CLEAR");
  }
}
