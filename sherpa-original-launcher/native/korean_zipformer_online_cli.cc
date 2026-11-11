// v29: ONE Korean Zipformer 174M INT8 recognizer and ONE never-rotated
// sherpa-onnx OnlineStream. No 4-second windows, no second recognizer,
// no artificial per-window padding, and no forced segment merges.
// Incoming PCM is filtered for silence BEFORE AcceptWaveform.
// Samsung AAC/M4A source and Android MediaCodec pipeline are untouched.
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
  std::string lastPublished;
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
    // Endpoint needs silence PCM to advance the clock. Since silence is NOT
    // delivered by user instruction, do not claim its endpoint is active.
    // No forced 4s reset: keep exactly ONE OnlineStream until final EOF.
    config.enable_endpoint=0;
    const uint64_t begun=bootNs();
    rec=SherpaOnnxCreateOnlineRecognizer(&config);
    say("SINGLE_MODEL_READY:ok=%d:durationMs=%llu",rec?1:0,
        (unsigned long long)((bootNs()-begun)/1000000));
    if(!rec)return false;
    stream=SherpaOnnxCreateOnlineStream(rec);
    if(!stream)return false;
    say("STT_READY");
    say("ONLINE_READY:model=korean-zipformer-174m-int8:recognizers=1:streams=1:mode=continuous:silence_filter=energy_rms_peak:decode_threads=2:liveEdge=%d",liveEdge?1:0);
    say("SINGLE_STREAM_CREATED:count=1:no_4s_split=1:no_secondary_worker=1");
    say("SPEECH_GATE_READY:rms_min=%.4f:peak_min=%.4f:mute_input=1",SPEECH_RMS_MIN,SPEECH_PEAK_MIN);
    return true;
  }
  void update(){
    if(!stream)return;
    auto* result=SherpaOnnxGetOnlineStreamResult(rec,stream);
    if(!result)return;
    std::string full=clean(result->text?result->text:"");
    SherpaOnnxDestroyOnlineRecognizerResult(result);
    if(full==lastPublished)return;
    std::string before=lastPublished;
    lastPublished=full;
    const size_t prefix=commonUtf8Prefix(before,full);
    const size_t keep=utf16Length(before,prefix);
    const std::string suffix=full.substr(prefix);
    unsigned int id=++hypotheses;
    const uint64_t ns=bootNs(),audioMs=sourceSamples*1000/RATE;
    say("ONLINE_TIMING:LIVE:%u:%llu:%llu:0",id,
        (unsigned long long)audioMs,(unsigned long long)ns);
    say("ONLINE_EDIT:%llu:%zu:%s",
        (unsigned long long)audioMs,keep,suffix.c_str());
    // UI receives incremental edits even when original audio clock has
    // discontinuities due to silence skipping.
    say("SINGLE_LIVE:sourceMs=%llu:keptUtf16=%zu:newUtf8Bytes=%zu",
        (unsigned long long)audioMs,keep,suffix.size());
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
      say("SINGLE_STAGE:DECODE:durationUs=%llu",
          (unsigned long long)us);
      update();
    }
  }
  void dispatch(uint32_t seq,const std::vector<float>& pcm){
    const uint64_t at=sourceSamples;
    sourceSamples+=pcm.size();
    const uint64_t now=bootNs();
    const uint64_t endMs=sourceSamples*1000/RATE;
    say("ONLINE_TIMING:INPUT:%u:%llu:%llu:0",seq,
        (unsigned long long)endMs,(unsigned long long)now);
    double sum=0,peak=0;
    for(const float v:pcm){sum+=double(v)*double(v);peak=std::max(peak,std::abs(double(v)));}
    const double rms=std::sqrt(sum/std::max<size_t>(1,pcm.size()));
    const bool speech=(rms>=SPEECH_RMS_MIN || peak>=SPEECH_PEAK_MIN);
    if(!speech){
      ++mutedChunks;
      skippedSamples+=pcm.size();
      // No waveform and no synthetic zeros sent to STT while gated.
      if(mutedChunks==1 || mutedChunks%5==0){
        say("SPEECH_GATE_SKIP:seq=%u:sourceMs=%llu:rms=%.6f:peak=%.6f:skippedTotalMs=%llu",
            seq,(unsigned long long)endMs,rms,peak,
            (unsigned long long)(skippedSamples*1000/RATE));
      }
      say("ONLINE_SKIPPED:%u:%llu",seq,(unsigned long long)endMs);
      return;
    }
    ++speechChunks;
    say("SPEECH_GATE_PASS:seq=%u:sourceMs=%llu:rms=%.6f:peak=%.6f:sampleCount=%zu",
        seq,(unsigned long long)endMs,rms,peak,pcm.size());
    SherpaOnnxOnlineStreamAcceptWaveform(stream,RATE,pcm.data(),pcm.size());
    acceptedSamples+=pcm.size();
    say("SINGLE_STAGE:ACCEPT:seq=%u:sourceFromMs=%llu:sourceToMs=%llu:samples=%zu",
        seq,(unsigned long long)(at*1000/RATE),
        (unsigned long long)endMs,pcm.size());
    decode(seq);
    say("ONLINE_ACCEPTED:%u:%zu",seq,pcm.size());
  }
  void finish(){
    if(stream){
      // Only final actual EOF ends the stream. No padding every 4 seconds.
      SherpaOnnxOnlineStreamInputFinished(stream);
      decode(0);
      update();
    }
    if(!lastPublished.empty()){
      say("STT_SEGMENT:1:%s",lastPublished.c_str());
      say("ONLINE_FINAL_FULL_TEXT:audioMs=%llu:chars=%zu",
          (unsigned long long)(sourceSamples*1000/RATE),lastPublished.size());
    }
    say("SINGLE_STREAM_FINISHED:sourceMs=%llu:acceptedMs=%llu:silenceSkippedMs=%llu:speechChunks=%llu:silentChunks=%llu:decodeCalls=%llu:totalDecodeMs=%llu",
        (unsigned long long)(sourceSamples*1000/RATE),
        (unsigned long long)(acceptedSamples*1000/RATE),
        (unsigned long long)(skippedSamples*1000/RATE),
        (unsigned long long)speechChunks,(unsigned long long)mutedChunks,
        (unsigned long long)decodeCalls,(unsigned long long)(decodeUs/1000));
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
