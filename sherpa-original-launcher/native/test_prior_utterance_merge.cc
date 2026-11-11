// Full prior utterance + short pause + current utterance: native invariant tests.
// Pure C++ runs before Android build and does not require the STT ONNX model.
#include "online_prior_speech_context.h"
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
static void require(bool ok,const char* what){
  if(!ok){std::fprintf(stderr,"FAIL %s\n",what);std::exit(1);}
  std::printf("PASS %s\n",what);
}
int main(){
  auto a=prior_merge::new_only(
    "고객님 안녕하세요 인터넷 상품",
    "고객님 안녕하세요 인터넷 상품 가입 안내는 이 번입니다");
  require(a.method=="FULL_PRIOR_PREFIX_REMOVED","v6 full Korean previous-prefix match");
  require(a.newText.find("가입 안내")!=std::string::npos,
          "remove entire prior utterance not current words");
  auto b=prior_merge::new_only("유선 상품","유선상품 신청은 일 번입니다");
  require(b.method=="FULL_PRIOR_PREFIX_REMOVED","Korean whitespace-independent overlap");
  require(b.newText.find("신청")!=std::string::npos,"Korean rewrite preserves new continuation");
  auto c=prior_merge::new_only(
    "안녕하세요 안내 전화입니다","완전히 관계없는 문장만 있습니다");
  require(c.method=="FALLBACK_REWRITE","ambiguous overlap never repeats wrong prior text");
  std::vector<float> speech1(16000,0.13f),silence(1920,0.f);
  std::vector<float> speech2(16000,0.10f);
  std::vector<float> clip=speech1;
  clip.insert(clip.end(),silence.begin(),silence.end());
  clip.insert(clip.end(),speech2.begin(),speech2.end());
  const auto pauses=prior_merge::short_pauses(clip,0);
  require(!pauses.empty(),"v7 10ms non-VAD 70-350ms quiet candidate");
  OnlinePriorSpeechContext x;
  x.accept(speech1.data(),speech1.size(),speech1.size(),"유선 상품");
  require(!x.previousExists,"one-word live caption is not gated by VAD");
  x.accept(silence.data(),silence.size(),speech1.size()+silence.size(),"유선 상품");
  x.accept(speech2.data(),speech2.size(),clip.size(),"유선 상품 신청은 일 번");
  require(x.previousExists,"full immediately previous speech is sealed after short pause");
  require(x.previous.size()>=15000,"full prior speech duration preserved, not 300ms tail");
  require(x.lastGap.size()>0,"actual prior silent gap retained, no synthetic duration");
  require(x.transcriptBeforeCurrent=="유선 상품 신청은 일 번"||
          x.transcriptBeforeCurrent=="유선 상품","sealed transcript available");
  const auto display=x.merge("유선상품 신청은 일 번입니다");
  require(display=="유선상품 신청은 일 번입니다",
          "newest online provisional transcript never regresses to stale prior");
  require(display.find("신청")!=std::string::npos,
          "one-sided live lexical continuation kept");
  std::printf("ALL_PRIOR_CONTEXT_TESTS_PASSED\n");
}
