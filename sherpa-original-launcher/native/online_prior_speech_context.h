#ifndef ONLINE_PRIOR_SPEECH_CONTEXT_H
#define ONLINE_PRIOR_SPEECH_CONTEXT_H
// Keeps the FULL immediately preceding utterance and its REAL intervening
// silence in PCM; never decodes the old file again. Existing Sherpa OnlineStream
// has already accepted these past samples. New provisional texts are compared
// with the whole last-utterance transcript using v6 UTF8 prefix alignment.
// v7's 70-350ms non-VAD quiet candidate is only a context boundary heuristic,
// never a gate for live captions.
#include "prior_utterance_merge.h"
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>
struct OnlinePriorSpeechContext {
  std::vector<float> current;
  std::vector<float> previous;
  std::vector<float> lastGap;
  std::string transcriptBeforeCurrent;
  std::string previousUtteranceText;
  int64_t currentStartSample=0;
  int64_t previousStartSample=0;
  int64_t lastBoundaryEnd=-1;
  uint64_t contextCount=0;
  bool previousExists=false;
  prior_merge::Dedup align(const std::string& wholeRaw)const{
    return prior_merge::new_only(transcriptBeforeCurrent,wholeRaw);
  }
  std::string merge(const std::string& wholeRaw)const{
    if(!previousExists||transcriptBeforeCurrent.empty())return wholeRaw;
    const auto d=align(wholeRaw);
    return d.method=="FULL_PRIOR_PREFIX_REMOVED"?
      prior_merge::combine(transcriptBeforeCurrent,d.newText):wholeRaw;
  }
  void accept(const float* pcm,uint32_t count,uint64_t totalSamples,
              const std::string& wholeRaw){
    current.insert(current.end(),pcm,pcm+count);
    if(current.size()<16000/2)return;
    // Keep the latest 8s only for gap DETECTION. The immediately preceding
    // utterance PCM is stored in 'previous' in FULL, not truncated to 8s.
    const size_t from=current.size()>8*16000?current.size()-8*16000:0;
    std::vector<float> clip(current.begin()+from,current.end());
    auto gaps=prior_merge::short_pauses(clip,currentStartSample+from);
    for(const auto& gap:gaps){
      if(gap.endSamples<=lastBoundaryEnd)continue;
      if(gap.beginSamples < currentStartSample+16000/2)continue;
      // Acoustically require 100ms *after* a short quiet candidate to
      // avoid declaring a word break on a silence run still in progress.
      if(gap.endSamples+1600 > static_cast<int64_t>(totalSamples))continue;
      const int64_t begin=gap.beginSamples-currentStartSample;
      const int64_t end=gap.endSamples-currentStartSample;
      if(begin<0||end>static_cast<int64_t>(current.size())||end<=begin)continue;
      std::vector<float> completed(current.begin(),current.begin()+begin);
      std::vector<float> followingGap(current.begin()+begin,current.begin()+end);
      const int64_t completedStart=currentStartSample;
      if(previousExists){
        // Exactly one-sided FULL prior utterance + ACTUAL intervening silence
        // + current completed utterance. The live OnlineStream already holds
        // these samples in state; replaying the overlap into it would duplicate
        // both audio time and words and violate the incremental-input rule.
        std::vector<float> combined;
        combined.reserve(previous.size()+lastGap.size()+completed.size());
        combined.insert(combined.end(),previous.begin(),previous.end());
        combined.insert(combined.end(),lastGap.begin(),lastGap.end());
        combined.insert(combined.end(),completed.begin(),completed.end());
        ++contextCount;
        const auto d=align(wholeRaw);
        printf("ONLINE_PRIOR_CONTEXT:%llu:priorMs=%zu:gapMs=%zu:currentMs=%zu:combinedMs=%zu:method=%s:error=%.3f\n",
          static_cast<unsigned long long>(contextCount),
          previous.size()/16,lastGap.size()/16,completed.size()/16,
          combined.size()/16,d.method.c_str(),d.normalizedError);
        if(d.method=="FULL_PRIOR_PREFIX_REMOVED"){
          printf("ONLINE_CONTEXT_MERGE:%llu:%s\n",
            static_cast<unsigned long long>(totalSamples*1000/16000),
            prior_merge::combine(transcriptBeforeCurrent,d.newText).c_str());
        }
      }
      std::string thisText;
      if(!previousExists)thisText=wholeRaw;
      else{
        const auto d=align(wholeRaw);
        thisText=d.method=="FULL_PRIOR_PREFIX_REMOVED"?d.newText:"";
      }
      previous=std::move(completed);
      previousStartSample=completedStart;
      previousUtteranceText=thisText;
      lastGap=std::move(followingGap);
      transcriptBeforeCurrent=merge(wholeRaw);
      current.erase(current.begin(),current.begin()+end);
      currentStartSample=gap.endSamples;
      lastBoundaryEnd=gap.endSamples;
      printf("ONLINE_PRIOR_SEALED:startMs=%lld:endMs=%lld:durationMs=%zu:textChars=%zu\n",
        static_cast<long long>(completedStart*1000/16000),
        static_cast<long long>(gap.beginSamples*1000/16000),
        previous.size()/16,previousUtteranceText.size());
      break;
    }
  }
};
#endif
