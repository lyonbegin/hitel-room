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
// Legacy prior utterance merge disabled for pure streaming A/B variant.
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
#include <cstdlib>
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
struct Engine {
  const SherpaOnnxOnlineRecognizer* recognizer=nullptr;
  const SherpaOnnxOnlineStream* stream=nullptr;
  uint64_t pcmSamples=0;
  unsigned int captions=0, hypotheses=0;
  uint64_t decodeCalls=0, decodeTotalUs=0, decodeMaxUs=0;
  std::string lastRaw;
  // No VAD, prefix seals, prior speech merging, or mid-call commits.
  uint32_t currentSeq=0;
  void update(bool final) {
    const auto* result=SherpaOnnxGetOnlineStreamResult(recognizer,stream);
    if(!result)return;
    const std::string raw=sanitize(result->text?result->text:"");
    SherpaOnnxDestroyOnlineRecognizerResult(result);
    // The Zipformer hypothesis is a REPLACEABLE full-session transcript.
    // Every new hypothesis replaces the entire displayed string; there is
    // no stable-prefix or previously sealed utterance to duplicate or freeze.
    if(raw!=lastRaw||final){
      const long long audioMs=static_cast<long long>(pcmSamples*1000/16000);
      printf("ONLINE_TIMING:LIVE:%u:%lld:%llu:0\n",hypotheses+1,audioMs,
          static_cast<unsigned long long>(boot_ns()));
      printf("ONLINE_HYPOTHESIS:%lld:%s\n",audioMs,raw.c_str());
      printf("ONLINE_LIVE:%lld:%s\n",audioMs,raw.c_str());
      std::vector<std::string> tw=words(raw);
      if(!tw.empty()){
        const size_t tail=tw.size()>2?tw.size()-2:0;
        const std::string latest=tw.size()-tail==2?tw[tail]+" "+tw[tail+1]:tw[tail];
        printf("ONLINE_LIVE_TAIL:%lld:%s\n",audioMs,latest.c_str());
      }
      hypotheses++;
      lastRaw=raw;
    }
    if(final && !raw.empty()){
      // Only commit ONE final full-session transcript at source EOF.
      // The Java UI has already displayed the replaceable LIVE hypothesis.
      captions++;
      printf("STT_SEGMENT:%u:%s\n",captions,raw.c_str());
      printf("ONLINE_FINAL_FULL_TEXT:audioMs=%llu:chars=%zu\n",
          static_cast<unsigned long long>(pcmSamples*1000/16000),raw.size());
    }
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
      const uint64_t elapsedUs=(decodeEnd-decodeBegin)/1000;
      decodeCalls++;
      decodeTotalUs+=elapsedUs;
      decodeMaxUs=std::max(decodeMaxUs,elapsedUs);
      printf("ONLINE_TIMING:DECODE:%u:%llu:%llu:%llu\n",seq,
          static_cast<unsigned long long>(pcmSamples*1000/16000),
          static_cast<unsigned long long>(decodeEnd),
          static_cast<unsigned long long>((decodeEnd-decodeBegin)/1000));
      update(false);
    }
    // NO prior-utterance replay, VAD, short-pause segmentation, or
    // offline re-recognition. Only newly arriving PCM advances OnlineStream.
    // Speech pauses are handled internally by the streaming recognizer.
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
    printf("ONLINE_PERF_SUMMARY:audioMs=%llu:decodeCalls=%llu:decodeTotalUs=%llu:decodeMaxUs=%llu:decodeRTF=%.6f\n",
        static_cast<unsigned long long>(pcmSamples*1000/16000),
        static_cast<unsigned long long>(decodeCalls),
        static_cast<unsigned long long>(decodeTotalUs),
        static_cast<unsigned long long>(decodeMaxUs),
        pcmSamples?double(decodeTotalUs)/double(pcmSamples*1000000.0/16000.0):0.0);
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
  // A/B benchmark switches. Defaults preserve the v20 validated configuration.
  // Set ZIPFORMER_DECODE=greedy_search and/or ZIPFORMER_THREADS=1|2|4
  // only in a separately measured test run; never claim speedup without metrics.
  const char* mode=std::getenv("ZIPFORMER_DECODE");
  const bool greedy=mode && std::strcmp(mode,"greedy_search")==0;
  const char* threadsEnv=std::getenv("ZIPFORMER_THREADS");
  int threads=2;
  if(threadsEnv && (std::strcmp(threadsEnv,"1")==0 ||
                    std::strcmp(threadsEnv,"2")==0 ||
                    std::strcmp(threadsEnv,"4")==0)) threads=std::atoi(threadsEnv);
  c.model_config.num_threads=threads;
  c.model_config.provider="cpu";
  c.model_config.modeling_unit="cjkchar";
  c.decoding_method=greedy?"greedy_search":"modified_beam_search";
  c.max_active_paths=greedy?1:8;
  printf("ONLINE_BENCH_CONFIG:decode=%s:threads=%d:paths=%d\n",
         c.decoding_method,threads,c.max_active_paths);
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
  printf("ONLINE_READY:model=korean-zipformer-174m-int8:chunk_size=45:chunk_shift=32:threads=2:full_previous_state=true:live=REPLACE\n");
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
