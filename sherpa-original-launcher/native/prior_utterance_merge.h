#ifndef PRIOR_UTTERANCE_MERGE_H
#define PRIOR_UTTERANCE_MERGE_H
// One-sided FULL previous-utterance context and Korean UTF-8 overlap alignment.
// Derived from the project's validated v6 new_only() and v7 non-VAD short_pauses().
// No audio from the future is read. Online transcription is NOT gated on pauses.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cctype>
#include <string>
#include <vector>
namespace prior_merge {
struct Codepoints {
  std::vector<uint32_t> chars;
  std::vector<size_t> endOffsets;
};
inline Codepoints normalize(const std::string& text){
  Codepoints result;
  for(size_t i=0;i<text.size();){
    const unsigned char a=static_cast<unsigned char>(text[i]);
    uint32_t cp=a;size_t len=1;
    if((a&0xe0)==0xc0 && i+1<text.size()){
      cp=((a&31)<<6)|(static_cast<unsigned char>(text[i+1])&63);len=2;
    }else if((a&0xf0)==0xe0 && i+2<text.size()){
      cp=((a&15)<<12)|((static_cast<unsigned char>(text[i+1])&63)<<6)|
         (static_cast<unsigned char>(text[i+2])&63);len=3;
    }else if((a&0xf8)==0xf0 && i+3<text.size()){
      cp=((a&7)<<18)|((static_cast<unsigned char>(text[i+1])&63)<<12)|
        ((static_cast<unsigned char>(text[i+2])&63)<<6)|
        (static_cast<unsigned char>(text[i+3])&63);len=4;
    }
    const bool usable=(cp>=128)||(cp<128&&std::isalnum(static_cast<unsigned char>(cp)));
    if(usable){
      if(cp>='A'&&cp<='Z')cp+=('a'-'A');
      result.chars.push_back(cp);
      result.endOffsets.push_back(i+len);
    }
    i+=len;
  }
  return result;
}
inline std::string trim(const std::string& s){
  auto a=s.find_first_not_of(" \t\r\n");
  if(a==std::string::npos)return "";
  auto b=s.find_last_not_of(" \t\r\n");
  return s.substr(a,b-a+1);
}
struct Dedup{
  std::string newText;
  std::string method;
  float normalizedError=1.f;
};
inline Dedup new_only(const std::string& previous,const std::string& merged){
  Codepoints prev=normalize(previous),all=normalize(merged);
  if(prev.chars.empty()||all.chars.empty())return {"","FALLBACK_EMPTY",1.f};
  const int n=static_cast<int>(prev.chars.size()),m=static_cast<int>(all.chars.size());
  const int minK=std::max(1,static_cast<int>(std::floor(n*0.55)));
  const int maxK=std::min(m,std::max(n+12,static_cast<int>(std::ceil(n*1.5))));
  if(maxK<minK)return {"","FALLBACK_SHORT",1.f};
  std::vector<int> prior(maxK+1),now(maxK+1);
  for(int j=0;j<=maxK;++j)prior[j]=j;
  float best=2.f;int bestK=0;
  for(int i=1;i<=n;++i){
    now[0]=i;
    for(int j=1;j<=maxK;++j){
      const int cost=prev.chars[i-1]==all.chars[j-1]?0:1;
      now[j]=std::min({prior[j]+1,now[j-1]+1,prior[j-1]+cost});
    }
    prior.swap(now);
  }
  for(int k=minK;k<=maxK;++k){
    const float e=static_cast<float>(prior[k])/std::max(n,k);
    if(e<best-0.0001f ||
       (std::abs(e-best)<0.0001f && std::abs(k-n)<std::abs(bestK-n))){
      best=e;bestK=k;
    }
  }
  if(bestK<1 || best>0.34f)return {"","FALLBACK_REWRITE",best};
  const size_t cut=all.endOffsets[bestK-1];
  const std::string fresh=trim(merged.substr(cut));
  if(normalize(fresh).chars.empty())return {"","FALLBACK_NO_NEW_WORDS",best};
  return {fresh,"FULL_PRIOR_PREFIX_REMOVED",best};
}
inline std::string combine(const std::string& previous,const std::string& fresh){
  if(previous.empty())return fresh;
  if(fresh.empty())return previous;
  return previous+" "+fresh;
}
struct ShortPause { int64_t beginSamples=0,endSamples=0; };
// The same non-VAD 10ms loudness / five-frame smoothing / 20-level
// quantization / 70-350ms pause-candidate method as v7.
inline std::vector<ShortPause> short_pauses(
    const std::vector<float>& pcm,int64_t offsetSamples){
  constexpr int window=160;
  const size_t frames=pcm.size()/window;
  std::vector<ShortPause> gaps;
  if(frames<10)return gaps;
  std::vector<double> loud(frames);
  double peak=0;
  for(size_t f=0;f<frames;++f){
    double v=0;
    for(int j=0;j<window;++j)v+=std::abs(pcm[f*window+j]);
    loud[f]=v/window;peak=std::max(peak,loud[f]);
  }
  if(peak<0.0001)return gaps;
  std::vector<bool> quiet(frames,false);
  for(size_t f=0;f<frames;++f){
    double smoothed=0;
    for(int j=-2;j<=2;++j){
      int x=std::min<int>(frames-1,std::max<int>(0,static_cast<int>(f)+j));
      smoothed+=loud[x];
    }
    const int quant=static_cast<int>(std::round(20*(smoothed/5)/peak));
    quiet[f]=quant<1;
  }
  for(size_t f=0;f<frames;){
    if(!quiet[f]){++f;continue;}
    size_t e=f+1;while(e<frames&&quiet[e])++e;
    if(e-f>=7&&e-f<=35){
      gaps.push_back({offsetSamples+static_cast<int64_t>(f*window),
                      offsetSamples+static_cast<int64_t>(e*window)});
    }
    f=e;
  }
  return gaps;
}
} // namespace prior_merge
#endif
