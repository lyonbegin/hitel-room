// Samsung continuously growing M4A -> lossless AAC recovery -> PCM16
// -> 10ms short-pause candidates + SenseVoice CTC word timestamps + LocalAgreement;
// Silero utterance VAD and full PRIOR context remain asynchronous diagnostics.
//
// stdin: repeated little-endian uint32(seq), uint32(samples), PCM16 LE.
// (0,0) means end: flush VAD, finalize pending speech.
// stdout: STT_READY, VAD_SEGMENT:<id>:<startMs>:<endMs>:<silenceMs>:<priorMs>,
//         STT_ALIGNMENT:<id>:<method>:<score>, STT_SEGMENT:<id>:<NEW_TEXT>,
//         STT_FINISHED:<count>. No fixed-duration STT segmentation.
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <algorithm>
#include <cmath>
#include <cctype>
#include <string>
#include <vector>
#include "sherpa-onnx/c-api/c-api.h"

namespace {
constexpr int kRate = 16000;
constexpr int kVadWindow = 512;
constexpr int kMaxPcmPacket = 12*kRate;

bool exact_read(void* dst,size_t bytes) {
  unsigned char* p=static_cast<unsigned char*>(dst);
  size_t n=0;
  while(n<bytes) {
    const ssize_t got=read(STDIN_FILENO,p+n,bytes-n);
    if(got<0){perror("stdin read");return false;}
    if(got==0)return false;
    n+=static_cast<size_t>(got);
  }
  return true;
}
uint32_t little32(const unsigned char* p) {
  return uint32_t(p[0])|(uint32_t(p[1])<<8)|
         (uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);
}
std::string oneline(std::string s) {
  for(char &c:s) if(c=='\r'||c=='\n'||c=='\t')c=' ';
  return s;
}
std::string trim(const std::string& s) {
  size_t a=s.find_first_not_of(" \r\n\t");
  if(a==std::string::npos)return "";
  size_t z=s.find_last_not_of(" \r\n\t");
  return s.substr(a,z-a+1);
}
struct Codepoints {
  std::vector<uint32_t> chars;
  std::vector<size_t> endOffsets;
};
Codepoints normalize(const std::string& text) {
  Codepoints out;
  for(size_t i=0;i<text.size();) {
    const unsigned char lead=static_cast<unsigned char>(text[i]);
    uint32_t cp=lead;size_t len=1;
    if((lead&0xe0)==0xc0 && i+1<text.size()) {
      cp=((lead&31)<<6)|(static_cast<unsigned char>(text[i+1])&63);len=2;
    } else if((lead&0xf0)==0xe0 && i+2<text.size()) {
      cp=((lead&15)<<12)|((static_cast<unsigned char>(text[i+1])&63)<<6)|
          (static_cast<unsigned char>(text[i+2])&63);len=3;
    } else if((lead&0xf8)==0xf0 && i+3<text.size()) {
      cp=((lead&7)<<18)|((static_cast<unsigned char>(text[i+1])&63)<<12)|
          ((static_cast<unsigned char>(text[i+2])&63)<<6)|
          (static_cast<unsigned char>(text[i+3])&63);len=4;
    }
    const bool usable=(cp>=128)||std::isalnum(static_cast<unsigned char>(cp));
    if(usable) {
      if(cp>='A'&&cp<='Z')cp+=('a'-'A');
      out.chars.push_back(cp);out.endOffsets.push_back(i+len);
    }
    i+=len;
  }
  return out;
}
struct Dedup {
  std::string newText;
  std::string method;
  float normalizedError=1.f;
};
// Compare previous *printed* utterance against a PREFIX of the context decode.
// A reliable prefix is removed. When recognizer rewrites that prefix too much,
// return a diagnostic and run CURRENT-UTTERANCE-ONLY fallback, never display
// the overlapping previous utterance a second time.
Dedup new_only(const std::string& previous,const std::string& merged) {
  Codepoints prev=normalize(previous), all=normalize(merged);
  if(prev.chars.empty()||all.chars.empty())return {"","FALLBACK_EMPTY",1.f};
  const int n=static_cast<int>(prev.chars.size());
  const int m=static_cast<int>(all.chars.size());
  const int minK=std::max(1,static_cast<int>(std::floor(n*0.55)));
  const int maxK=std::min(m,std::max(n+12,static_cast<int>(std::ceil(n*1.5))));
  if(maxK<minK)return {"","FALLBACK_SHORT",1.f};
  std::vector<int> prior(maxK+1),now(maxK+1);
  for(int j=0;j<=maxK;++j)prior[j]=j;
  float best=2.f;int bestK=0;
  for(int i=1;i<=n;++i) {
    now[0]=i;
    for(int j=1;j<=maxK;++j) {
      const int cost=prev.chars[i-1]==all.chars[j-1]?0:1;
      now[j]=std::min({prior[j]+1,now[j-1]+1,prior[j-1]+cost});
    }
    prior.swap(now);
  }
  for(int k=minK;k<=maxK;++k) {
    const float e=static_cast<float>(prior[k])/std::max(n,k);
    if(e<best-0.0001f||(std::abs(e-best)<0.0001f&&
       std::abs(k-n)<std::abs(bestK-n))){best=e;bestK=k;}
  }
  if(bestK<1||best>0.34f)return {"","FALLBACK_REWRITE",best};
  const size_t cut=all.endOffsets[bestK-1];
  std::string fresh=trim(merged.substr(cut));
  // Avoid a punctuation-only caption. The current utterance may be quiet.
  if(normalize(fresh).chars.empty())return {"","FALLBACK_NO_NEW_WORDS",best};
  return {fresh,"FULL_PRIOR_PREFIX_REMOVED",best};
}
std::string decode(const SherpaOnnxOfflineRecognizer* rec,
                   const std::vector<float>& samples) {
  if(samples.empty())return "";
  const SherpaOnnxOfflineStream* stream=SherpaOnnxCreateOfflineStream(rec);
  if(!stream)return "";
  SherpaOnnxAcceptWaveformOffline(stream,kRate,samples.data(),
                                   static_cast<int32_t>(samples.size()));
  SherpaOnnxDecodeOfflineStream(rec,stream);
  const SherpaOnnxOfflineRecognizerResult* res=
       SherpaOnnxGetOfflineStreamResult(stream);
  std::string text=(res&&res->text)?res->text:"";
  if(res)SherpaOnnxDestroyOfflineRecognizerResult(res);
  SherpaOnnxDestroyOfflineStream(stream);
  return trim(oneline(text));
}

struct TimedWord {
  std::string text;
  int64_t beginMs=0, endMs=0;
};
std::vector<TimedWord> read_words(const SherpaOnnxOfflineRecognizerResult* res,
                                   int64_t offsetMs, int64_t spanMs) {
  std::vector<TimedWord> words;
  if(!res)return words;
  // sherpa-onnx v1.12.26's SenseVoice CTC result carries tokens_arr +
  // timestamps; group SentencePiece U+2581 word starts, as in the original
  // SenseVoice post()/WhisperStreaming timestamped-word implementation.
  const int n=std::min(1024, std::max(0, res->count));
  if(n>0 && res->tokens_arr && res->timestamps){
    for(int i=0;i<n;++i){
      const char* ptr=res->tokens_arr[i];
      if(!ptr)continue;
      std::string t=ptr;
      std::string cleaned;
      bool fresh=false;
      for(size_t p=0;p<t.size();){
        if(t.compare(p,3,"\xE2\x96\x81")==0){
          fresh=true;p+=3;continue;
        }
        if(t[p]==' '||t[p]=='\n'||t[p]=='\t'){
          fresh=true;++p;continue;
        }
        cleaned.push_back(t[p++]);
      }
      const float ts=res->timestamps[i];
      const int64_t ms=offsetMs+static_cast<int64_t>(std::round(ts*1000.f));
      if(cleaned.empty())continue;
      if(words.empty()||fresh){
        words.push_back({cleaned,ms,ms+80});
      }else{
        words.back().text+=cleaned;
        words.back().endMs=std::max(words.back().endMs,ms+80);
      }
    }
    if(words.size()>1){
      for(size_t i=0;i+1<words.size();++i)
        words[i].endMs=std::min(words[i].endMs,words[i+1].beginMs);
    }
  }
  // Some model variants contain no whitespace token or no timestamps.
  // Only in this fallback do we infer rough word times from UTF-8 text.
  if(words.size()<2 && res->text){
    std::string phrase=trim(oneline(res->text));
    std::vector<std::string> terms;
    size_t p=0;
    while(p<phrase.size()){
      while(p<phrase.size()&&std::isspace(static_cast<unsigned char>(phrase[p])))p++;
      size_t q=p;
      while(q<phrase.size()&&!std::isspace(static_cast<unsigned char>(phrase[q])))q++;
      if(q>p)terms.push_back(phrase.substr(p,q-p));
      p=q;
    }
    if(terms.size()>1){
      words.clear();
      for(size_t i=0;i<terms.size();++i){
        const int64_t a=offsetMs+static_cast<int64_t>(spanMs*i/terms.size());
        const int64_t b=offsetMs+static_cast<int64_t>(spanMs*(i+1)/terms.size());
        words.push_back({terms[i],a,b});
      }
      printf("WORD_TIME_MODE:FALLBACK_ESTIMATED:%zu\n",words.size());
    }
  }
  if(!words.empty())printf("WORD_TIME_MODE:CTC_OR_FALLBACK:%zu\n",words.size());
  return words;
}
// Unlike Silero's utterance-end detector, this follows stable-ts's NONVAD
// loudness-mask approach: 10ms loudness, local smoothing, quantization,
// contiguous quiet runs. It supplies short-silence *candidates*, not a
// promise that every quiet run is a lexical boundary.
struct ShortPause {
  int64_t begin=0,end=0;
};
std::vector<ShortPause> short_pauses(const std::vector<float>& pcm,
                                    int64_t offsetSamples) {
  const int window=160; // 10 ms at 16 kHz
  const size_t frames=pcm.size()/window;
  std::vector<ShortPause> gaps;
  if(frames<10)return gaps;
  std::vector<double> loud(frames);
  double peak=0;
  for(size_t f=0;f<frames;++f){
    double v=0;
    for(int j=0;j<window;++j)v+=std::abs(pcm[f*window+j]);
    loud[f]=v/window;
    peak=std::max(peak,loud[f]);
  }
  if(peak<0.0001)return gaps;
  std::vector<bool> quiet(frames,false);
  for(size_t f=0;f<frames;++f){
    double smoothed=0;
    for(int j=-2;j<=2;j++){
      int x=std::min<int>(frames-1,std::max<int>(0,static_cast<int>(f)+j));
      smoothed+=loud[x];
    }
    // Original stable-ts non-VAD method uses 20-level quantization and
    // k_size=5 smoothing. This C++ signal-domain port uses frame-mean
    // loudness rather than torch interpolation; validate against real audio.
    const int quant=static_cast<int>(std::round(20*(smoothed/5)/peak));
    quiet[f]=quant<1;
  }
  for(size_t f=0;f<frames;){
    if(!quiet[f]){++f;continue;}
    size_t e=f+1;while(e<frames&&quiet[e])++e;
    if(e-f>=7 && e-f<=35) {
      gaps.push_back({(offsetSamples+static_cast<int64_t>(f*window))*1000/kRate,
                      (offsetSamples+static_cast<int64_t>(e*window))*1000/kRate});
    }
    f=e;
  }
  return gaps;
}
bool same_word(const TimedWord& a,const TimedWord& b){
  return normalize(a.text).chars==normalize(b.text).chars &&
         std::llabs(a.beginMs-b.beginMs)<=500;
}
struct PriorSpeech {
  int64_t start=0;
  std::vector<float> samples;
  std::string emittedText;
  bool exists=false;
};
struct Engine {
  const SherpaOnnxOfflineRecognizer* recognizer=nullptr;
  const SherpaOnnxVoiceActivityDetector* vad=nullptr;
  std::vector<float> remaining;
  std::vector<float> recording;
  std::vector<TimedWord> lastHypothesis;
  PriorSpeech prior;
  int64_t committedThroughMs=0, lastDecodeAt=0;
  int64_t acceptedSamples=0;
  unsigned int count=0, captions=0, shortPauseCount=0;
  bool hasPending=false;
  void emitCaption(const std::vector<TimedWord>& additions, const char* source) {
    for(size_t i=0;i<additions.size();i+=2){
      std::string text=additions[i].text;
      if(i+1<additions.size())text+=" "+additions[i+1].text;
      text=trim(oneline(text));
      if(!text.empty()){
        printf("STT_SEGMENT:%u:%s\n",++captions,text.c_str());
        printf("WORD_COMMIT:%u:%lld:%lld:%s\n",captions,
               static_cast<long long>(additions[i].beginMs),
               static_cast<long long>(additions[std::min(i+1,additions.size()-1)].endMs),
               source);
      }
    }
  }
  void recognizeLive(bool final=false) {
    const int64_t now=static_cast<int64_t>(recording.size());
    if(!final && now-lastDecodeAt<kRate)return;
    if(now<kRate/2)return;
    lastDecodeAt=now;
    // Recognition happens BEFORE VAD utterance-end. A rolling 8-second window
    // avoids the 17-40-second no-captions regression of v6.
    const int64_t from=std::max<int64_t>(0,now-8*kRate);
    std::vector<float> clip(recording.begin()+from,recording.end());
    const auto pauses=short_pauses(clip,from);
    for(const auto& gap:pauses){
      // Only log new gaps, not the same pause on every overlapping decode.
      if(gap.end>lastLoggedPauseMs){
        lastLoggedPauseMs=gap.end;
        ++shortPauseCount;
        printf("SHORT_PAUSE:%u:%lld:%lld:%lld\n",shortPauseCount,
            static_cast<long long>(gap.begin),
            static_cast<long long>(gap.end),
            static_cast<long long>(gap.end-gap.begin));
      }
    }
    const SherpaOnnxOfflineStream* stream=SherpaOnnxCreateOfflineStream(recognizer);
    if(!stream)return;
    SherpaOnnxAcceptWaveformOffline(stream,kRate,clip.data(),static_cast<int32_t>(clip.size()));
    SherpaOnnxDecodeOfflineStream(recognizer,stream);
    const SherpaOnnxOfflineRecognizerResult* res=SherpaOnnxGetOfflineStreamResult(stream);
    const int64_t offset=from*1000/kRate;
    auto words=read_words(res,offset,clip.size()*1000/kRate);
    std::string full=(res&&res->text)?trim(oneline(res->text)):"";
    if(res)SherpaOnnxDestroyOfflineRecognizerResult(res);
    SherpaOnnxDestroyOfflineStream(stream);
    printf("WORD_HYPOTHESIS:%lld:%zu:%s\n",
           static_cast<long long>(now*1000/kRate),words.size(),full.c_str());
    std::vector<TimedWord> newCommitted;
    for(const auto& word:words){
      // Commit only audio that starts after the last printed word. The
      // rolling CTC re-decode can assign an already printed phoneme a new,
      // longer token (e.g. 창업 -> 창업복의). Its timestamp overlaps the
      // previous committed word. Never emit that old phoneme twice.
      if(word.endMs<=committedThroughMs || normalize(word.text).chars.empty())
        continue;
      if(word.beginMs<committedThroughMs){
        printf("WORD_REWRITE_OVERLAP_SKIPPED:%lld:%lld:%lld:%s\n",
               static_cast<long long>(word.beginMs),
               static_cast<long long>(word.endMs),
               static_cast<long long>(committedThroughMs),word.text.c_str());
        continue;
      }
      bool stable=final;
      for(const auto& prev:lastHypothesis) {
        if(same_word(word,prev)){stable=true;break;}
      }
      // Original WhisperStreaming LocalAgreement commits matching words on
      // consecutive updates. A recent short quiet run is a second source of
      // evidence for a boundary, but never blindly truncates a phoneme.
      if(!stable){
        for(const auto& p:pauses){
          if(p.begin>=word.endMs-80 && p.begin<=word.endMs+260 &&
             now*1000/kRate-p.end>180){stable=true;break;}
        }
      }
      if(stable && (final||word.endMs<=now*1000/kRate-120)){
        newCommitted.push_back(word);
        committedThroughMs=std::max(committedThroughMs,word.endMs);
      } else if(!stable && !final) {
        // Do not skip a word to commit later words out of order.
        break;
      }
    }
    lastHypothesis=std::move(words);
    if(!newCommitted.empty())emitCaption(newCommitted,final?"FINAL_FLUSH":"TIMED_LOCAL_AGREEMENT");
  }
  int64_t lastLoggedPauseMs=-1;
  void emitSpeech(const SherpaOnnxSpeechSegment* seg) {
    if(!seg||seg->n<1||!seg->samples)return;
    const int64_t start=seg->start;
    const int64_t end=start+seg->n;
    const int64_t gap=prior.exists?std::max<int64_t>(
        0,start-(prior.start+static_cast<int64_t>(prior.samples.size()))):0;
    const int64_t prevMs=prior.exists?
        static_cast<int64_t>(prior.samples.size())*1000/kRate:0;
    const unsigned int seq=++count;
    printf("VAD_SEGMENT:%u:%lld:%lld:%lld:%lld\n",seq,
      static_cast<long long>(start*1000/kRate),
      static_cast<long long>(end*1000/kRate),
      static_cast<long long>(gap*1000/kRate),
      static_cast<long long>(prevMs));
    std::vector<float> current(seg->samples,seg->samples+seg->n);
    // Retain the full preceding utterance and the exact intervening recorded
    // PCM. This is the original user's one-sided context rule, evaluated at
    // VAD completion, not used as a gate for live captions.
    if(prior.exists) {
      std::vector<float> contextual;
      contextual.reserve(prior.samples.size()+gap+current.size());
      contextual.insert(contextual.end(),prior.samples.begin(),prior.samples.end());
      const int64_t gapStart=prior.start+static_cast<int64_t>(prior.samples.size());
      if(gapStart>=0 && start<=static_cast<int64_t>(recording.size()))
        contextual.insert(contextual.end(),recording.begin()+gapStart,
                          recording.begin()+start);
      else contextual.insert(contextual.end(),static_cast<size_t>(gap),0.f);
      contextual.insert(contextual.end(),current.begin(),current.end());
      printf("VAD_CONTEXT:%u:priorMs=%lld:silenceMs=%lld:currentMs=%lld:contextMs=%lld\n",
          seq,static_cast<long long>(prevMs),
          static_cast<long long>(gap*1000/kRate),
          static_cast<long long>(seg->n*1000/kRate),
          static_cast<long long>(contextual.size()*1000/kRate));
      // No duplicated final caption: this contextual STT is diagnostic only.
      std::string merged=decode(recognizer,contextual);
      printf("VAD_FINAL_CONTEXT_TEXT:%u:%s\n",seq,merged.c_str());
    }
    prior.start=start;
    prior.samples=std::move(current);
    prior.exists=true;
  }
  void drain() {
    while(!SherpaOnnxVoiceActivityDetectorEmpty(vad)) {
      const SherpaOnnxSpeechSegment* p=SherpaOnnxVoiceActivityDetectorFront(vad);
      emitSpeech(p);
      SherpaOnnxDestroySpeechSegment(p);
      SherpaOnnxVoiceActivityDetectorPop(vad);
    }
  }
  void accept(const float* pcm,size_t countSamples) {
    recording.insert(recording.end(),pcm,pcm+countSamples);
    remaining.insert(remaining.end(),pcm,pcm+countSamples);
    size_t n=0;
    while(remaining.size()-n>=kVadWindow) {
      SherpaOnnxVoiceActivityDetectorAcceptWaveform(vad,remaining.data()+n,kVadWindow);
      acceptedSamples+=kVadWindow;
      n+=kVadWindow;
      drain();
    }
    if(n)remaining.erase(remaining.begin(),remaining.begin()+n);
    recognizeLive();
  }
  void finish() {
    if(!remaining.empty()){
      remaining.resize(kVadWindow,0.f);
      SherpaOnnxVoiceActivityDetectorAcceptWaveform(vad,remaining.data(),kVadWindow);
      acceptedSamples+=kVadWindow;
      remaining.clear();
    }
    SherpaOnnxVoiceActivityDetectorFlush(vad);
    drain();
    recognizeLive(true);
    printf("VAD_FINISHED:%u:%lld\n",count,
           static_cast<long long>(acceptedSamples*1000/kRate));
  }
};
}  // namespace

int main(int argc,char** argv) {
  setvbuf(stdout,nullptr,_IOLBF,0);
  setvbuf(stderr,nullptr,_IOLBF,0);
  if(argc!=4){
    fprintf(stderr,"USAGE: libsensevoice-stream.so tokens.txt model.int8.onnx silero_vad.onnx\n");
    return 2;
  }
  SherpaOnnxOfflineRecognizerConfig cfg={};
  cfg.model_config.num_threads=2;
  cfg.model_config.provider="cpu";
  cfg.model_config.tokens=argv[1];
  cfg.model_config.sense_voice.model=argv[2];
  cfg.model_config.sense_voice.language="ko";
  cfg.model_config.sense_voice.use_itn=1;
  cfg.decoding_method="greedy_search";
  Engine engine;
  engine.recognizer=SherpaOnnxCreateOfflineRecognizer(&cfg);
  if(!engine.recognizer){fprintf(stderr,"STT_MODEL_INITIALIZATION_FAILED\n");return 3;}
  SherpaOnnxVadModelConfig vadCfg={};
  vadCfg.silero_vad.model=argv[3];
  vadCfg.silero_vad.threshold=0.42f;
  vadCfg.silero_vad.min_silence_duration=0.42f;
  vadCfg.silero_vad.min_speech_duration=0.14f;
  vadCfg.silero_vad.max_speech_duration=20.f; // safety bound, not a fixed segment duration
  vadCfg.silero_vad.window_size=kVadWindow;
  vadCfg.sample_rate=kRate;
  vadCfg.num_threads=1;
  vadCfg.provider="cpu";
  engine.vad=SherpaOnnxCreateVoiceActivityDetector(&vadCfg,90.f);
  if(!engine.vad){
    fprintf(stderr,"VAD_MODEL_INITIALIZATION_FAILED\n");
    SherpaOnnxDestroyOfflineRecognizer(engine.recognizer);
    return 7;
  }
  printf("STT_READY\n");
  printf("VAD_READY:rate=16000:window=512:live=CTC_WORD_LOCAL_AGREEMENT:overlap=FULL_PRIOR_SPEECH\n");
  int status=0;
  for(;;) {
    unsigned char header[8];
    if(!exact_read(header,sizeof(header))){
      fprintf(stderr,"STREAM_SOURCE_EOF_OR_HEADER_ERROR\n");
      status=4;break;
    }
    const uint32_t seq=little32(header),samples=little32(header+4);
    if(seq==0 && samples==0)break;
    if(seq==0||samples==0||samples>kMaxPcmPacket){
      fprintf(stderr,"STREAM_SEGMENT_HEADER_INVALID seq=%u count=%u\n",seq,samples);
      status=5;break;
    }
    std::vector<unsigned char> pcm(samples*2);
    if(!exact_read(pcm.data(),pcm.size())){
      fprintf(stderr,"STREAM_SEGMENT_PCM_TRUNCATED seq=%u\n",seq);
      status=6;break;
    }
    std::vector<float> wave(samples);
    for(uint32_t i=0;i<samples;++i){
      const uint16_t u=uint16_t(pcm[2*i])|(uint16_t(pcm[2*i+1])<<8);
      wave[i]=static_cast<int16_t>(u)/32768.f;
    }
    printf("STT_ACCEPTED:%u:%u\n",seq,samples);
    engine.accept(wave.data(),wave.size());
  }
  engine.finish();
  printf("STT_FINISHED:%u\n",engine.captions);
  SherpaOnnxDestroyVoiceActivityDetector(engine.vad);
  SherpaOnnxDestroyOfflineRecognizer(engine.recognizer);
  return status;
}
