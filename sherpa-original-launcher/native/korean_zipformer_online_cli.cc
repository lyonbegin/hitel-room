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
#include "online_prior_speech_context.h"
#include <algorithm>
#include <cstdint>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <sstream>
#include <unistd.h>
#include <chrono>
#include <time.h>

namespace {
uint64_t boot_ns(){
  struct timespec ts{};
  clock_gettime(CLOCK_BOOTTIME,&ts);
  return static_cast<uint64_t>(ts.tv_sec)*1000000000ULL+static_cast<uint64_t>(ts.tv_nsec);
}
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
// Compare recognized Korean sound as text *independent of spaces*.
// The streaming decoder can rewrite "유선 상품" as "유선상품" without changing
// any spoken syllable. Token-index freezing permanently lost all subsequent
// captions on the real Android test. Prefix agreement must use normalized
// characters rather than whitespace-separated index alone.
std::string normalized(const std::string& s){
  std::string out;
  for(unsigned char c:s){
    if(c>=128||std::isalnum(c))out.push_back(static_cast<char>(c));
  }
  return out;
}
size_t raw_index_after(const std::string& raw,size_t normalizedBytes){
  size_t used=0;
  for(size_t i=0;i<raw.size();++i){
    unsigned char c=static_cast<unsigned char>(raw[i]);
    if(c>=128||std::isalnum(c)){
      if(used==normalizedBytes)return i;
      ++used;
      if(used==normalizedBytes)return i+1;
    }
  }
  return raw.size();
}
struct Engine {
  const SherpaOnnxOnlineRecognizer* recognizer=nullptr;
  const SherpaOnnxOnlineStream* stream=nullptr;
  uint64_t pcmSamples=0;
  unsigned int captions=0, hypotheses=0;
  std::string committedNorm;
  std::string lastRaw;
  OnlinePriorSpeechContext priorContext;
  int quietUpdates=0;
  uint32_t currentSeq=0;
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
    SherpaOnnxDestroyOnlineRecognizerResult(result);
    if(raw==lastRaw)quietUpdates++;
    else quietUpdates=0;
    if(raw!=lastRaw||final){
      // Provisional speech-to-text MUST be visible immediately. Confirmed
      // captions can lag or be blocked by an ASR rewrite; never gate UI
      // updates on the confirmed-prefix buffer.
      const long long audioMs=static_cast<long long>(pcmSamples*1000/16000);
      printf("ONLINE_TIMING:LIVE:%u:%lld:%llu:0\n",hypotheses+1,audioMs,
             static_cast<unsigned long long>(boot_ns()));
      const std::string merged=priorContext.merge(raw);
      if(merged!=raw){
        const auto d=priorContext.align(raw);
        printf("ONLINE_CONTEXT_LIVE_MERGE:audioMs=%lld:method=%s:error=%.3f:priorChars=%zu\n",
          audioMs,d.method.c_str(),d.normalizedError,priorContext.transcriptBeforeCurrent.size());
      }
      printf("ONLINE_HYPOTHESIS:%lld:%s\n",audioMs,raw.c_str());
      printf("ONLINE_LIVE:%lld:%s\n",audioMs,merged.c_str());
      std::vector<std::string> tw=words(merged);
      if(!tw.empty()){
        const size_t tail=tw.size()>2?tw.size()-2:0;
        const std::string latest=tw.size()-tail==2?tw[tail]+" "+tw[tail+1]:tw[tail];
        printf("ONLINE_LIVE_TAIL:%lld:%s\n",audioMs,latest.c_str());
      }
      hypotheses++;
    }
    const std::string norm=normalized(raw);
    const std::string prior=normalized(lastRaw);
    size_t stable=0;
    while(stable<norm.size()&&stable<prior.size()&&norm[stable]==prior[stable])
      ++stable;
    if(final||quietUpdates>=3)stable=norm.size();
    if(norm.compare(0,committedNorm.size(),committedNorm)!=0){
      printf("ONLINE_REWRITE_PENDING:already=%zu:now=%zu:common=%zu\n",
          committedNorm.size(),norm.size(),stable);
      // Keep earlier committed words visible, but never claim the new
      // result's rewritten sounds are 'fresh'. A UI provisional-correction
      // layer can replace them later. Unlike word-index logic, spaces alone
      // will NOT trigger this branch.
      lastRaw=raw;
      return;
    }
    lastRaw=raw;
    if(stable<=committedNorm.size())return;
    // Do not slice UTF-8 inside a Hangul syllable. Each Hangul codepoint is
    // three bytes; fall back to the last valid codepoint boundary.
    while(stable>0 && stable<norm.size() &&
          (static_cast<unsigned char>(norm[stable])&0xc0)==0x80)--stable;
    if(stable<=committedNorm.size())return;
    const size_t oldRaw=raw_index_after(raw,committedNorm.size());
    const size_t safeRaw=raw_index_after(raw,stable);
    if(safeRaw<=oldRaw)return;
    const std::string fragment=raw.substr(oldRaw,safeRaw-oldRaw);
    std::vector<std::string> updated=words(fragment);
    if(updated.empty())return;
    size_t confirm=updated.size();
    // A last word with no following boundary may be a syllable-in-progress.
    // Confirm it only after 3 identical updates or at final audio EOF.
    const bool endedWithSpace=(safeRaw<raw.size() &&
        std::isspace(static_cast<unsigned char>(raw[safeRaw])));
    if(!final && quietUpdates<3 && !endedWithSpace && confirm>0)--confirm;
    if(confirm==0)return;
    emit(updated,0,confirm,final);
    for(size_t i=0;i<confirm;++i)committedNorm+=normalized(updated[i]);
    printf("ONLINE_NORMALIZED_PREFIX_COMMITTED:bytes=%zu:newWords=%zu\n",
           committedNorm.size(),confirm);
  }
  void accept(const float* wave,uint32_t n,uint32_t seq){
    currentSeq=seq;
    pcmSamples+=n;
    const uint64_t acceptedNs=boot_ns();
    printf("ONLINE_TIMING:INPUT:%u:%llu:%llu:0\n",seq,
        static_cast<unsigned long long>(pcmSamples*1000/16000),
        static_cast<unsigned long long>(acceptedNs));
    SherpaOnnxOnlineStreamAcceptWaveform(stream,16000,wave,n);
    int iteration=0;
    while(SherpaOnnxIsOnlineStreamReady(recognizer,stream)&&++iteration<1000){
      const uint64_t decodeBegin=boot_ns();
      SherpaOnnxDecodeOnlineStream(recognizer,stream);
      const uint64_t decodeEnd=boot_ns();
      printf("ONLINE_TIMING:DECODE:%u:%llu:%llu:%llu\n",seq,
          static_cast<unsigned long long>(pcmSamples*1000/16000),
          static_cast<unsigned long long>(decodeEnd),
          static_cast<unsigned long long>((decodeEnd-decodeBegin)/1000));
      update(false);
    }
    // v7 short-pause candidates and the previous entire utterance are kept
    // AFTER immediate live updates, never used as a gate for one-word captions.
    priorContext.accept(wave,n,pcmSamples,lastRaw);
  }
  void finish(){
    // Match faster 174M chunk16 model's ~640ms trailing padding.
    std::vector<float> padding(16*640,0.f);
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
  const uint64_t modelBeginNs=boot_ns();
  engine.recognizer=SherpaOnnxCreateOnlineRecognizer(&c);
  const uint64_t modelEndNs=boot_ns();
  printf("ONLINE_TIMING:MODEL_LOAD:0:0:%llu:%llu\n",
      static_cast<unsigned long long>(modelEndNs),
      static_cast<unsigned long long>((modelEndNs-modelBeginNs)/1000));
  if(!engine.recognizer){
    fprintf(stderr,"KOREAN_ZIPFORMER_MODEL_LOAD_FAILED\n");
    return 3;
  }
  engine.stream=SherpaOnnxCreateOnlineStream(engine.recognizer);
  if(!engine.stream){
    SherpaOnnxDestroyOnlineRecognizer(engine.recognizer);return 4;
  }
  printf("STT_READY\n");
  printf("ONLINE_READY:model=korean-zipformer-174m-int8:chunk=16:threads=2:full_previous_state=true:live=UNCONFIRMED\n");
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
    engine.accept(pcm.data(),n,seq);
  }
  engine.finish();
  SherpaOnnxDestroyOnlineStream(engine.stream);
  SherpaOnnxDestroyOnlineRecognizer(engine.recognizer);
  return status;
}
