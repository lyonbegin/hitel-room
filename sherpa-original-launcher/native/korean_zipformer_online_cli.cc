// Korean Zipformer INT8 online ASR for Samsung growing M4A -> recovered AAC -> PCM.
// NOT a time-window re-decoder: a single sherpa-onnx OnlineStream retains
// encoder state and consumes only NEW PCM samples. No VAD wait before caption.
// Input: repeated uint32-le(seq), uint32-le(nSamples), little-endian int16 PCM.
// Input 0,0 signals the recorder has stopped and flushes final decoder frames.
// Output: ONLINE_READY, ONLINE_HYPOTHESIS:<ms>:<text>,
//         STT_SEGMENT:<seq>:<one-or-two-space-delimited-words>,
//         WORD_COMMIT:<seq>:<inputMs>:<inputMs>:ONLINE_STABLE_PREFIX,
//         STT_FINISHED:<count>.
#include "sherpa-onnx/c-api/c-api.h"
#include <algorithm>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <sstream>
#include <unistd.h>
#include <chrono>

namespace {
bool read_all(void* dest,size_t size) {
  auto* bytes=static_cast<uint8_t*>(dest);
  size_t got=0;
  while(got<size){
    ssize_t n=read(STDIN_FILENO,bytes+got,size-got);
    if(n<=0)return false;
    got+=static_cast<size_t>(n);
  }
  return true;
}
uint32_t le32(const uint8_t* p){
  return uint32_t(p[0])|(uint32_t(p[1])<<8)|
      (uint32_t(p[2])<<16)|(uint32_t(p[3])<<24);
}
std::string sanitize(std::string s){
  for(char& c:s)if(c=='\n'||c=='\r'||c=='\t')c=' ';
  return s;
}
std::vector<std::string> words(const std::string& text){
  std::istringstream ss(text);
  std::string w;std::vector<std::string> output;
  while(ss>>w)output.push_back(w);
  return output;
}
struct Engine {
  const SherpaOnnxOnlineRecognizer* recognizer=nullptr;
  const SherpaOnnxOnlineStream* stream=nullptr;
  uint64_t pcmSamples=0;
  unsigned int captions=0, hypotheses=0;
  std::vector<std::string> priorHypothesis, committed;
  std::string lastRaw;
  int quietUpdates=0;
  void emit(const std::vector<std::string>& v,size_t first,size_t end,bool final){
    for(size_t i=first;i<end;i+=2){
      std::string text=v[i];
      if(i+1<end)text+=" "+v[i+1];
      if(text.empty())continue;
      const unsigned int s=++captions;
      const long long inputMs=static_cast<long long>(pcmSamples*1000/16000);
      printf("STT_SEGMENT:%u:%s\n",s,text.c_str());
      printf("WORD_COMMIT:%u:%lld:%lld:%s\n",s,inputMs,inputMs,
          final?"ONLINE_FINAL":"ONLINE_STABLE_PREFIX");
    }
  }
  void update(bool final) {
    const auto* result=SherpaOnnxGetOnlineStreamResult(recognizer,stream);
    if(!result)return;
    const std::string raw=sanitize(result->text?result->text:"");
    std::vector<std::string> now=words(raw);
    SherpaOnnxDestroyOnlineRecognizerResult(result);
    if(raw==lastRaw)quietUpdates++;
    else quietUpdates=0;
    if(raw!=lastRaw||final) {
      printf("ONLINE_HYPOTHESIS:%lld:%s\n",
          static_cast<long long>(pcmSamples*1000/16000),raw.c_str());
      hypotheses++;
      lastRaw=raw;
    }
    // Exact-prefix LocalAgreement over consecutive incremental hypotheses.
    // Retractions are not emitted; captions are not retroactively rewritten.
    size_t common=0;
    while(common<now.size()&&common<priorHypothesis.size()
        &&now[common]==priorHypothesis[common])++common;
    // The last word in a partial result may still be growing.
    size_t safe=final?now.size():(now.empty()?0:std::min(common,now.size()-1));
    // If there is no following word, allow an unchanged final word after
    // three successive decoder updates to avoid starving one-word speech.
    if(!final && common==now.size() && quietUpdates>=3)safe=common;
    size_t agreed=0;
    while(agreed<committed.size()&&agreed<now.size()
         &&committed[agreed]==now[agreed])agreed++;
    if(agreed<committed.size()){
      printf("ONLINE_REWRITE_SKIPPED:%zu:%zu\n",agreed,committed.size());
      priorHypothesis=std::move(now);
      return;
    }
    const size_t from=committed.size();
    safe=std::max(from,std::min(safe,now.size()));
    if(safe>from) {
      emit(now,from,safe,final);
      committed.insert(committed.end(),now.begin()+from,now.begin()+safe);
    }
    priorHypothesis=std::move(now);
  }
  void accept(const float* wave,uint32_t n){
    pcmSamples+=n;
    SherpaOnnxOnlineStreamAcceptWaveform(stream,16000,wave,n);
    int iteration=0;
    while(SherpaOnnxIsOnlineStreamReady(recognizer,stream)&&++iteration<1000){
      SherpaOnnxDecodeOnlineStream(recognizer,stream);
      update(false);
    }
  }
  void finish(){
    // Match model creator guidance: 1x chunk padding (32*40ms).
    std::vector<float> padding(32*640,0.f);
    SherpaOnnxOnlineStreamAcceptWaveform(stream,16000,padding.data(),padding.size());
    SherpaOnnxOnlineStreamInputFinished(stream);
    int iteration=0;
    while(SherpaOnnxIsOnlineStreamReady(recognizer,stream)&&++iteration<1000){
      SherpaOnnxDecodeOnlineStream(recognizer,stream);
      update(false);
    }
    update(true);
    printf("ONLINE_FINISHED:pcmMs=%llu:hypotheses=%u:captions=%u\n",
           static_cast<unsigned long long>(pcmSamples*1000/16000),
           hypotheses,captions);
    printf("STT_FINISHED:%u\n",captions);
  }
};
}
int main(int argc,char** argv){
  setvbuf(stdout,nullptr,_IOLBF,0);
  if(argc!=5){
    fprintf(stderr,"USAGE: libsensevoice-stream.so tokens encoder decoder joiner\n");
    return 2;
  }
  SherpaOnnxOnlineRecognizerConfig c={};
  c.feat_config.sample_rate=16000;
  c.feat_config.feature_dim=80;
  c.model_config.transducer.encoder=argv[2];
  c.model_config.transducer.decoder=argv[3];
  c.model_config.transducer.joiner=argv[4];
  c.model_config.tokens=argv[1];
  c.model_config.num_threads=2;
  c.model_config.provider="cpu";
  c.model_config.modeling_unit="cjkchar";
  c.decoding_method="modified_beam_search";
  c.max_active_paths=8;
  c.enable_endpoint=0; // VAD must never gate 1-2-word captions.
  Engine engine;
  engine.recognizer=SherpaOnnxCreateOnlineRecognizer(&c);
  if(!engine.recognizer){
    fprintf(stderr,"KOREAN_ZIPFORMER_MODEL_LOAD_FAILED\n");
    return 3;
  }
  engine.stream=SherpaOnnxCreateOnlineStream(engine.recognizer);
  if(!engine.stream){
    SherpaOnnxDestroyOnlineRecognizer(engine.recognizer);return 4;
  }
  printf("STT_READY\n");
  printf("ONLINE_READY:model=korean-zipformer-int8:chunk=32:threads=2:full_previous_state=true\n");
  int status=0;
  for(;;){
    uint8_t header[8];
    if(!read_all(header,sizeof(header))){status=5;break;}
    const uint32_t seq=le32(header),n=le32(header+4);
    if(seq==0 && n==0)break;
    if(seq==0||n==0||n>16000*12){status=6;break;}
    std::vector<uint8_t> bytes(n*2);
    if(!read_all(bytes.data(),bytes.size())){status=7;break;}
    std::vector<float> pcm(n);
    for(uint32_t i=0;i<n;++i){
      const uint16_t u=uint16_t(bytes[2*i])|(uint16_t(bytes[2*i+1])<<8);
      pcm[i]=static_cast<int16_t>(u)/32768.f;
    }
    printf("ONLINE_ACCEPTED:%u:%u\n",seq,n);
    engine.accept(pcm.data(),n);
  }
  engine.finish();
  SherpaOnnxDestroyOnlineStream(engine.stream);
  SherpaOnnxDestroyOnlineRecognizer(engine.recognizer);
  return status;
}
