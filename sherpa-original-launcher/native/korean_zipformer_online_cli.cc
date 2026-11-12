// v22 upstream-API parity experiment: one persistent Sherpa-ONNX OnlineStream.
// Keep the existing Samsung M4A native follower, AAC MediaCodec and PCM pipe.
// Every PCM sample enters the SAME official Sherpa-ONNX stream, in order.
// Use Sherpa's own endpoint + stream reset, not 4s windows or text overlap merge.
// A/B baseline against v22 before reintroducing concurrent recognizers.
#include "sherpa-onnx/c-api/c-api.h"
#include <algorithm>
#include <chrono>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <mutex>
#include <string>
#include <vector>
#include <unistd.h>
#include <time.h>

namespace {
constexpr uint64_t RATE=16000;
constexpr double SPEECH_RMS_MIN=0.0030; // intentionally low: protect quiet Korean syllables
constexpr double SPEECH_PEAK_MIN=0.0200;
std::mutex printMutex;
uint64_t bootNs(){
  timespec t{};clock_gettime(CLOCK_BOOTTIME,&t);
  return uint64_t(t.tv_sec)*1000000000ULL+uint64_t(t.tv_nsec);
}
void say(const char* format,...){
  std::lock_guard<std::mutex> lock(printMutex);
  va_list args;va_start(args,format);vfprintf(stdout,format,args);va_end(args);
  putchar('\n');fflush(stdout);
}
bool readAll(void* memory,size_t count){
  uint8_t *b=static_cast<uint8_t*>(memory);
  size_t at=0;
  while(at<count){
    ssize_t n=read(STDIN_FILENO,b+at,count-at);
    if(n<=0)return false;
    at+=size_t(n);
  }
  return true;
}
uint32_t le32(const uint8_t* b){
  return uint32_t(b[0])|(uint32_t(b[1])<<8)|
    (uint32_t(b[2])<<16)|(uint32_t(b[3])<<24);
}
std::string clean(std::string t){
  for(char &c:t)if(c=='\r'||c=='\n'||c=='\t')c=' ';
  return t;
}
size_t utf16Length(const std::string& v,size_t bytes){
  size_t units=0;
  for(size_t i=0;i<bytes;){
    const unsigned char lead=static_cast<unsigned char>(v[i]);
    size_t n=1;
    if((lead&0xF8)==0xF0){n=4;units+=2;}
    else if((lead&0xF0)==0xE0){n=3;units++;}
    else if((lead&0xE0)==0xC0){n=2;units++;}
    else units++;
    i+=std::min(n,bytes-i);
  }
  return units;
}
size_t commonUtf8Prefix(const std::string& a,const std::string& b){
  size_t k=0,limit=std::min(a.size(),b.size());
  while(k<limit && a[k]==b[k])++k;
  while(k>0&&k<b.size()&&
       (static_cast<unsigned char>(b[k])&0xC0)==0x80)--k;
  return k;
}
class SingleContinuousASR {
  const SherpaOnnxOnlineRecognizer* rec=nullptr;
  const SherpaOnnxOnlineStream* stream=nullptr;
  std::string lastPublished,committed;
  uint32_t endpointCount=0;
  uint64_t sourceSamples=0,acceptedSamples=0,skippedSamples=0;
  uint64_t decodeCalls=0,decodeUs=0,mutedChunks=0,speechChunks=0;
  unsigned int hypotheses=0;
  bool liveEdge=false;
public:
  explicit SingleContinuousASR(bool live):liveEdge(live){}
  bool start(const char* tokens,const char* encoder,const char* decoder,const char* joiner){
    SherpaOnnxOnlineRecognizerConfig config={};
    config.feat_config.sample_rate=RATE;
    config.feat_config.feature_dim=80;
    config.model_config.transducer.encoder=encoder;
    config.model_config.transducer.decoder=decoder;
    config.model_config.transducer.joiner=joiner;
    config.model_config.tokens=tokens;
    config.model_config.num_threads=2; // One recognizer, two CPU threads only.
    config.model_config.provider="cpu";
    config.model_config.modeling_unit="cjkchar";
    config.decoding_method="modified_beam_search";
    config.max_active_paths=8;
    // Official endpoint detection receives the actual PCM silence as well.
    config.enable_endpoint=1;
    config.rule1_min_trailing_silence=2.4f;
    config.rule2_min_trailing_silence=1.2f;
    config.rule3_min_utterance_length=300.0f;
    const uint64_t begun=bootNs();
    rec=SherpaOnnxCreateOnlineRecognizer(&config);
    say("SINGLE_MODEL_READY:ok=%d:durationMs=%llu",rec?1:0,
        (unsigned long long)((bootNs()-begun)/1000000));
    if(!rec)return false;
    stream=SherpaOnnxCreateOnlineStream(rec);
    if(!stream)return false;
    say("STT_READY");
    say("ONLINE_READY:model=korean-zipformer-174m-int8:recognizers=1:streams=1:mode=official_continuous:endpoint=enabled:decode_threads=2");
    say("SINGLE_STREAM_CREATED:count=1:no_4s_split=1:no_secondary_worker=1");
    say("OFFICIAL_ENDPOINT_READY:enabled=1:reset_on_endpoint=1");
    return true;
  }
  void publish(const std::string& partial) {
    std::string full=committed;
    if(!partial.empty()){
      if(!full.empty())full+=" ";
      full+=partial;
    }
    if(full==lastPublished)return;
    const std::string before=lastPublished;
    lastPublished=full;
    const size_t prefix=commonUtf8Prefix(before,full);
    const size_t keep=utf16Length(before,prefix);
    const std::string suffix=full.substr(prefix);
    const unsigned int id=++hypotheses;
    const uint64_t ns=bootNs(),audioMs=sourceSamples*1000/RATE;
    say("ONLINE_TIMING:LIVE:%u:%llu:%llu:0",id,
        (unsigned long long)audioMs,(unsigned long long)ns);
    say("ONLINE_HYPOTHESIS:%llu:%s",(unsigned long long)audioMs,full.c_str());
    say("ONLINE_LIVE:%llu:%s",(unsigned long long)audioMs,full.c_str());
    say("ONLINE_EDIT:%llu:%zu:%s",(unsigned long long)audioMs,keep,suffix.c_str());
  }
  std::string getRaw(){
    if(!stream)return {};
    const auto* result=SherpaOnnxGetOnlineStreamResult(rec,stream);
    if(!result)return {};
    std::string raw=clean(result->text?result->text:"");
    SherpaOnnxDestroyOnlineRecognizerResult(result);
    return raw;
  }
  void commitEndpoint(){
    const std::string raw=getRaw();
    if(!raw.empty()){
      if(!committed.empty())committed+=" ";
      committed+=raw;
    }
    endpointCount++;
    say("OFFICIAL_ENDPOINT:count=%u:sourceMs=%llu:chars=%zu",
      endpointCount,(unsigned long long)(sourceSamples*1000/RATE),raw.size());
    SherpaOnnxOnlineStreamReset(rec,stream);
    publish("");
  }
  void decode(uint32_t seq){
    for(int i=0;i<1000 && SherpaOnnxIsOnlineStreamReady(rec,stream);++i){
      const uint64_t before=bootNs();
      SherpaOnnxDecodeOnlineStream(rec,stream);
      const uint64_t end=bootNs();
      const uint64_t us=(end-before)/1000;
      ++decodeCalls;decodeUs+=us;
      say("ONLINE_TIMING:DECODE:%u:%llu:%llu:%llu",seq,
          (unsigned long long)(sourceSamples*1000/RATE),
          (unsigned long long)end,(unsigned long long)us);
      if(SherpaOnnxOnlineStreamIsEndpoint(rec,stream))commitEndpoint();
      else publish(getRaw());
    }
  }
  void dispatch(uint32_t seq,const std::vector<float>& pcm){
    sourceSamples+=pcm.size();
    const uint64_t endMs=sourceSamples*1000/RATE;
    say("ONLINE_TIMING:INPUT:%u:%llu:%llu:0",seq,
        (unsigned long long)endMs,(unsigned long long)bootNs());
    // Feed every new sample into one continuous upstream stream.
    // No ad-hoc energy gating, fixed windows, or re-decoding earlier PCM.
    SherpaOnnxOnlineStreamAcceptWaveform(stream,RATE,pcm.data(),pcm.size());
    acceptedSamples+=pcm.size();
    say("OFFICIAL_PCM_ACCEPTED:seq=%u:sourceMs=%llu:samples=%zu",
        seq,(unsigned long long)endMs,pcm.size());
    decode(seq);
    say("ONLINE_ACCEPTED:%u:%zu",seq,pcm.size());
  }
  void finish(){
    if(stream){
      // Match upstream example: send a short tail then finalize the stream.
      std::vector<float> tail(4800,0.f);
      SherpaOnnxOnlineStreamAcceptWaveform(stream,RATE,tail.data(),tail.size());
      SherpaOnnxOnlineStreamInputFinished(stream);
      decode(0);
      const std::string finalRaw=getRaw();
      if(!finalRaw.empty()){
        if(!committed.empty())committed+=" ";
        committed+=finalRaw;
      }
      publish("");
    }
    if(!lastPublished.empty()){
      say("STT_SEGMENT:1:%s",lastPublished.c_str());
      say("ONLINE_FINAL_FULL_TEXT:audioMs=%llu:chars=%zu",
          (unsigned long long)(sourceSamples*1000/RATE),lastPublished.size());
    }
    say("OFFICIAL_STREAM_FINISHED:pcmMs=%llu:acceptedMs=%llu:endpoints=%u:decodeCalls=%llu:decodeMs=%llu",
        (unsigned long long)(sourceSamples*1000/RATE),
        (unsigned long long)(acceptedSamples*1000/RATE),
        endpointCount,(unsigned long long)decodeCalls,
        (unsigned long long)(decodeUs/1000));
    say("ONLINE_FINISHED:pcmMs=%llu:hypotheses=%u:captions=%u:workers=1",
        (unsigned long long)(sourceSamples*1000/RATE),hypotheses,
        !lastPublished.empty()?1:0);
    say("STT_FINISHED:%u",!lastPublished.empty()?1:0);
  }
  ~SingleContinuousASR(){
    if(stream)SherpaOnnxDestroyOnlineStream(stream);
    if(rec)SherpaOnnxDestroyOnlineRecognizer(rec);
  }
};
} // namespace
int main(int argc,char** argv){
  setvbuf(stdout,nullptr,_IOLBF,0);
  if(argc!=5 && argc!=6){
    fprintf(stderr,"USAGE: single_zipformer tokens encoder decoder joiner [--live-edge]\n");
    return 2;
  }
  if(argc==6 && strcmp(argv[5],"--live-edge"))return 2;
  SingleContinuousASR engine(argc==6);
  if(!engine.start(argv[1],argv[2],argv[3],argv[4]))return 3;
  int status=0;
  for(;;){
    uint8_t header[8];
    if(!readAll(header,sizeof(header))){status=5;break;}
    const uint32_t seq=le32(header),n=le32(header+4);
    if(seq==0&&n==0)break;
    if(seq==0||n==0||n>RATE*12){status=6;break;}
    std::vector<uint8_t> bytes(size_t(n)*2);
    if(!readAll(bytes.data(),bytes.size())){status=7;break;}
    std::vector<float> pcm(n);
    for(uint32_t i=0;i<n;++i){
      const uint16_t raw=uint16_t(bytes[2*i])|(uint16_t(bytes[2*i+1])<<8);
      pcm[i]=static_cast<int16_t>(raw)/32768.f;
    }
    engine.dispatch(seq,pcm);
  }
  engine.finish();
  return status;
}
