// Samsung continuously growing M4A -> lossless AAC recovery -> PCM16
// -> Silero VAD (utterance / silence boundaries) -> SenseVoice with one-sided,
// full PRIOR utterance context -> caption only for NEW utterance.
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
  PriorSpeech prior;
  unsigned int count=0;
  int64_t acceptedSamples=0;

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
    std::string output;
    // Even when a prior utterance produced empty text, send its FULL audio
    // to the contextual recognizer. Dedup will fall back to current-only.
    if(prior.exists) {
      // Preserve the ENTIRE intervening silence in original PCM time.
      // No fixed 300-500 ms overlap and no 1-second pause truncation.
      // Only the full preceding speech and its actual following silent gap
      // precede the new utterance; no future audio is appended.
      const size_t silence=static_cast<size_t>(gap);
      std::vector<float> contextual;
      contextual.reserve(prior.samples.size()+silence+current.size());
      contextual.insert(contextual.end(),prior.samples.begin(),prior.samples.end());
      contextual.insert(contextual.end(),silence,0.f);
      contextual.insert(contextual.end(),current.begin(),current.end());
      printf("VAD_CONTEXT:%u:priorMs=%lld:silenceMs=%lld:currentMs=%lld:contextMs=%lld\n",
          seq,static_cast<long long>(prevMs),
          static_cast<long long>(gap*1000/kRate),
          static_cast<long long>(seg->n*1000/kRate),
          static_cast<long long>(contextual.size()*1000/kRate));
      std::string merged=decode(recognizer,contextual);
      Dedup d=new_only(prior.emittedText,merged);
      printf("STT_ALIGNMENT:%u:%s:%.3f\n",seq,d.method.c_str(),d.normalizedError);
      if(d.method=="FULL_PRIOR_PREFIX_REMOVED")output=d.newText;
      else output=decode(recognizer,current);
    } else {
      output=decode(recognizer,current);
      printf("STT_ALIGNMENT:%u:FIRST_OR_EMPTY_PRIOR:0\n",seq);
    }
    output=trim(oneline(output));
    printf("STT_SEGMENT:%u:%s\n",seq,output.c_str());
    prior.start=start;
    prior.samples=std::move(current);
    prior.emittedText=output;
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
    remaining.insert(remaining.end(),pcm,pcm+countSamples);
    size_t n=0;
    while(remaining.size()-n>=kVadWindow){
      SherpaOnnxVoiceActivityDetectorAcceptWaveform(vad,remaining.data()+n,
                                                     kVadWindow);
      acceptedSamples+=kVadWindow;
      n+=kVadWindow;
      drain();
    }
    if(n)remaining.erase(remaining.begin(),remaining.begin()+n);
  }
  void finish() {
    if(!remaining.empty()) {
      // Flush remaining PCM without losing a syllable at the recording end.
      remaining.resize(kVadWindow,0.f);
      SherpaOnnxVoiceActivityDetectorAcceptWaveform(vad,remaining.data(),
                                                     kVadWindow);
      acceptedSamples+=kVadWindow;
      remaining.clear();
    }
    SherpaOnnxVoiceActivityDetectorFlush(vad);
    drain();
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
  vadCfg.silero_vad.max_speech_duration=45.f; // safety bound, not a fixed segment duration
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
  printf("VAD_READY:rate=16000:window=512:min_silence_ms=420:overlap=FULL_PRIOR_SPEECH\n");
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
  printf("STT_FINISHED:%u\n",engine.count);
  SherpaOnnxDestroyVoiceActivityDetector(engine.vad);
  SherpaOnnxDestroyOfflineRecognizer(engine.recognizer);
  return status;
}
