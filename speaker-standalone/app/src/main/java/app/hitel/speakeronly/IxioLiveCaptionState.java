package app.hitel.speakeronly;

/**
 * Real-time display state is CURRENT SDK utterance only, not a growing
 * transcript. Original IXIO speechSDK returns the entire mutable partial
 * hypothesis; it is not a stream of unique words.
 *
 * No artificial 300ms or endpoint delay: expose each changed nonempty
 * hypothesis immediately. An endpoint clears the display instantly.
 */
final class IxioLiveCaptionState {
  private String visible="";

  String onPartial(String sdkHypothesis) {
    if(sdkHypothesis==null || sdkHypothesis.isEmpty())return null;
    if(sdkHypothesis.equals(visible))return null;
    visible=sdkHypothesis;
    return visible;
  }

  boolean onEndpoint() {
    boolean hadText=!visible.isEmpty();
    visible="";
    return hadText;
  }

  boolean hasVisibleText(){return !visible.isEmpty();}
  String current(){return visible;}
}
