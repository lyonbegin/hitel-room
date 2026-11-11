// v23: independent 1-thread CAMPPlus speaker-embedding sidecar.
// The two existing 174M Zipformer recognizers/OnlineStreams are UNCHANGED.
// The speaker worker sees one canonical PCM time axis, not one stream per ASR
// recognizer. It may drop ONLY speaker samples under overload, NEVER ASR PCM.
// Assignments are provisional: mono mixed recordings cannot yield guaranteed
// per-word voice attribution, particularly during overlapping speech.
#ifndef HITEL_SPEAKER_SIDECAR_H
#define HITEL_SPEAKER_SIDECAR_H
#include <algorithm>
#include <cmath>
#include <condition_variable>
#include <cstdio>
#include <deque>
#include <fstream>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

struct SpeakerObservation {
  int startMs=0, endMs=0;
  std::string label="UNKNOWN";
  float score=0.f;
};
class SpeakerSidecar {
public:
  using Observer=std::function<void(const SpeakerObservation&)>;
  static constexpr int WINDOW_SAMPLES=16000*24/10; // 2.4 seconds
  static constexpr int HOP_SAMPLES=16000*12/10;    // 1.2 seconds
  static constexpr size_t MAX_PENDING=80;
  SpeakerSidecar(const std::string& model,const std::string& selfPcm,Observer cb)
   : modelPath(model),selfPath(selfPcm),observer(std::move(cb)) {}
  void start(){ thread=std::thread([this]{run();}); }
  void feed(const float* pcm,size_t n,uint64_t startSample){
    if(!n)return;
    std::lock_guard<std::mutex> lock(mutex);
    if(finished)return;
    if(jobs.size()>=MAX_PENDING){
      // Do not stall AAC or either Zipformer worker for classification.
      dropped+=jobs.size();jobs.clear();
      say("SPEAKER_BACKPRESSURE:drop_only_speaker_jobs=%zu",dropped);
    }
    Job x;x.offset=startSample;x.pcm.assign(pcm,pcm+n);
    jobs.push_back(std::move(x));cv.notify_one();
  }
  void stopAndJoin(){
    {
      std::lock_guard<std::mutex> lock(mutex);
      finished=true;cv.notify_all();
    }
    if(thread.joinable())thread.join();
  }
  bool available() const {return modelOK.load();}
  bool enrolled() const {return selfOK.load();}
private:
  struct Job {uint64_t offset=0;std::vector<float> pcm;};
  const std::string modelPath,selfPath;
  Observer observer;
  std::mutex mutex;
  std::condition_variable cv;
  std::deque<Job> jobs;
  std::thread thread;
  std::atomic<bool> modelOK{false},selfOK{false};
  bool finished=false;
  size_t dropped=0;
  const SherpaOnnxSpeakerEmbeddingExtractor* extractor=nullptr;
  std::vector<float> self,first,second,buffer;
  uint64_t bufferStart=0;
  bool bufferInitialized=false;
  int dim=0,observations=0;

  static float cosine(const std::vector<float>& a,const std::vector<float>& b){
    if(a.empty()||b.empty()||a.size()!=b.size())return 0.f;
    double dot=0,aa=0,bb=0;
    for(size_t i=0;i<a.size();++i){dot+=double(a[i])*b[i];aa+=double(a[i])*a[i];bb+=double(b[i])*b[i];}
    if(aa<=1e-9||bb<=1e-9)return 0.f;
    return float(dot/std::sqrt(aa*bb));
  }
  bool embedding(const float* pcm,int count,std::vector<float>& out){
    const SherpaOnnxOnlineStream* stream=SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor);
    if(!stream)return false;
    SherpaOnnxOnlineStreamAcceptWaveform(stream,16000,pcm,count);
    SherpaOnnxOnlineStreamInputFinished(stream);
    bool ok=false;
    if(SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor,stream)){
      const float* p=SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor,stream);
      if(p){
        out.assign(p,p+dim);
        SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(p);
        ok=true;
      }
    }
    SherpaOnnxDestroyOnlineStream(stream);
    return ok;
  }
  bool loadSelf(){
    if(selfPath.empty()||selfPath=="-")return false;
    std::ifstream in(selfPath,std::ios::binary|std::ios::ate);
    if(!in)return false;
    const auto n=in.tellg();
    if(n < std::streamoff(16000*2*3) || n > std::streamoff(16000*2*20))return false;
    in.seekg(0);
    std::vector<char> bytes(size_t(n),0);
    in.read(bytes.data(),bytes.size());
    if(!in)return false;
    std::vector<float> pcm(bytes.size()/2);
    for(size_t i=0;i<pcm.size();++i){
      const unsigned lo=static_cast<unsigned char>(bytes[2*i]);
      const unsigned hi=static_cast<unsigned char>(bytes[2*i+1]);
      pcm[i]=static_cast<int16_t>(lo|(hi<<8))/32768.f;
    }
    return embedding(pcm.data(),int(pcm.size()),self);
  }
  void classify(const float* pcm,uint64_t beginSample){
    // Very low energy cannot be reliably assigned to a speaker.
    double energy=0;
    for(int i=0;i<WINDOW_SAMPLES;++i)energy+=double(pcm[i])*pcm[i];
    const double rms=std::sqrt(energy/WINDOW_SAMPLES);
    SpeakerObservation obs;
    obs.startMs=int(beginSample*1000/16000);
    obs.endMs=int((beginSample+WINDOW_SAMPLES)*1000/16000);
    if(rms<0.009){
      say("SPEAKER_INTERVAL:%d:%d:SILENCE:0",obs.startMs,obs.endMs);
      return;
    }
    std::vector<float> emb;
    if(!embedding(pcm,WINDOW_SAMPLES,emb)){
      say("SPEAKER_INTERVAL:%d:%d:UNAVAILABLE:0",obs.startMs,obs.endMs);
      return;
    }
    if(selfOK.load()){
      const float s=cosine(emb,self);
      obs.score=s;
      // Neutral zone is intentionally wide; never hide ambiguous speech.
      obs.label=s>=0.66f?"SELF":(s<=0.43f?"OTHER":"UNKNOWN");
    }else if(first.empty()){
      first=emb;obs.label="A";obs.score=1.f;
    }else{
      const float a=cosine(emb,first);
      const float b=cosine(emb,second);
      obs.score=std::max(a,b);
      if(a>=0.63f && (second.empty()||a>=b+0.07f)){
        obs.label="A";
      }else if(!second.empty()&&b>=0.63f&&b>=a+0.07f){
        obs.label="B";
      }else if(second.empty()&&a<0.45f){
        second=emb;obs.label="B";obs.score=1.f;
      }else obs.label="UNKNOWN";
    }
    ++observations;
    say("SPEAKER_INTERVAL:%d:%d:%s:%.3f",obs.startMs,obs.endMs,
        obs.label.c_str(),obs.score);
    observer(obs);
  }
  void run(){
    SherpaOnnxSpeakerEmbeddingExtractorConfig config={};
    config.model=modelPath.c_str();config.num_threads=1;config.provider="cpu";
    extractor=SherpaOnnxCreateSpeakerEmbeddingExtractor(&config);
    if(!extractor){
      say("SPEAKER_UNAVAILABLE:model_load_failed:dual_asr_unaffected=true");
      // Still drain queue quickly so ASR never hangs.
      std::lock_guard<std::mutex> lock(mutex);jobs.clear();
      return;
    }
    dim=SherpaOnnxSpeakerEmbeddingExtractorDim(extractor);
    modelOK.store(true);
    selfOK.store(loadSelf());
    say("SPEAKER_READY:model=campplus:threads=1:independent_from_dual_asr=true:enrolled=%d:dim=%d",
        selfOK.load()?1:0,dim);
    for(;;){
      Job item;
      {
        std::unique_lock<std::mutex> lock(mutex);
        cv.wait(lock,[this]{return finished||!jobs.empty();});
        if(jobs.empty()){if(finished)break;else continue;}
        item=std::move(jobs.front());jobs.pop_front();
      }
      if(!bufferInitialized||item.offset!=bufferStart+buffer.size()){
        if(bufferInitialized)
          say("SPEAKER_PCM_GAP:expected=%llu:actual=%llu",(unsigned long long)(bufferStart+buffer.size()),
              (unsigned long long)item.offset);
        buffer.clear();bufferStart=item.offset;bufferInitialized=true;
      }
      buffer.insert(buffer.end(),item.pcm.begin(),item.pcm.end());
      while(buffer.size()>=WINDOW_SAMPLES){
        classify(buffer.data(),bufferStart);
        buffer.erase(buffer.begin(),buffer.begin()+HOP_SAMPLES);
        bufferStart+=HOP_SAMPLES;
      }
    }
    say("SPEAKER_FINISHED:windows=%d:droppedSpeakerChunks=%zu:asrWorkers=2",
        observations,dropped);
    SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor);
    extractor=nullptr;
  }
};
#endif
