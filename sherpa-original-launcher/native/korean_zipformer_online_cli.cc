// v27: Korean 174M INT8 model, PRIMARY/ON-DEMAND STANDBY worker assignment.
// Primary #0 handles every independent 4-second segment if ready. Standby #1
// is used only when primary's previous segment is still being processed.
// Up to 0.5 sec of old PCM is supplied only as adjacent context; it cannot
// be mistaken for a new recorder delta. Never force modulo-2 alternation.
#include "sherpa-onnx/c-api/c-api.h"
#include <algorithm>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <map>
#include <set>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>
#include <unistd.h>
#include <time.h>

namespace {
constexpr uint64_t RATE=16000;
constexpr uint64_t WINDOW=RATE*4;
constexpr uint64_t STRIDE=RATE*4;
constexpr uint64_t PREROLL=RATE/2;
constexpr size_t QUEUE_CAP=512; // direct-file playback: lossless historical replay.
constexpr size_t LIVE_QUEUE_CAP=28; // stale backlog guard; preserves model identity.
std::mutex outputMutex;
uint64_t bootNs(){
  struct timespec t{};clock_gettime(CLOCK_BOOTTIME,&t);
  return uint64_t(t.tv_sec)*1000000000ULL+uint64_t(t.tv_nsec);
}
void say(const char* format,...){
  std::lock_guard<std::mutex> lock(outputMutex);
  va_list args;va_start(args,format);vfprintf(stdout,format,args);va_end(args);
  putchar('\n');fflush(stdout);
}
bool readAll(void* memory,size_t count){
  auto* bytes=static_cast<uint8_t*>(memory);size_t at=0;
  while(at<count){
    ssize_t n=read(STDIN_FILENO,bytes+at,count-at);
    if(n<=0)return false;
    at+=size_t(n);
  }
  return true;
}
uint32_t le32(const uint8_t* b){
  return uint32_t(b[0])|(uint32_t(b[1])<<8)|
         (uint32_t(b[2])<<16)|(uint32_t(b[3])<<24);
}
std::string clean(std::string text){
  for(char &c:text)if(c=='\r'||c=='\n'||c=='\t')c=' ';
  return text;
}
std::vector<std::string> tokens(const std::string& text){
  std::istringstream in(text);std::string word;std::vector<std::string> out;
  while(in>>word)out.push_back(word);
  return out;
}
std::string normalized(std::string s){
  // Preserve UTF-8 bytes and compare Korean words verbatim; strip ASCII punctuation.
  s.erase(std::remove_if(s.begin(),s.end(),[](unsigned char c){
    return c<128 && (c=='.'||c==','||c=='!'||c=='?'||c==':'||c==';');
  }),s.end());return s;
}
// Count UTF-16 code units in a valid UTF-8 prefix. Java String uses UTF-16.
// Never split a Unicode code point when generating an incremental edit.
size_t utf16Length(const std::string& value,size_t bytes){
  size_t units=0;
  for(size_t i=0;i<bytes;){
    const unsigned char lead=static_cast<unsigned char>(value[i]);
    size_t n=1;
    if((lead&0xF8)==0xF0){n=4;units+=2;}
    else if((lead&0xF0)==0xE0){n=3;units+=1;}
    else if((lead&0xE0)==0xC0){n=2;units+=1;}
    else {units+=1;}
    i+=std::min(n,bytes-i);
  }
  return units;
}
size_t commonUtf8Prefix(const std::string& oldText,const std::string& newText){
  size_t k=0;
  const size_t limit=std::min(oldText.size(),newText.size());
  while(k<limit && oldText[k]==newText[k])++k;
  // k may be inside a multi-byte Hangul code point.
  while(k>0 && k<newText.size() &&
        (static_cast<unsigned char>(newText[k])&0xC0)==0x80)--k;
  return k;
}
std::string joinOverlap(const std::string& left,const std::string& right){
  if(left.empty())return right;
  if(right.empty())return left;
  const auto a=tokens(left),b=tokens(right);
  size_t common=0;
  const size_t limit=std::min<size_t>({a.size(),b.size(),8});
  for(size_t n=1;n<=limit;++n){
    bool same=true;
    for(size_t i=0;i<n;++i){
      if(normalized(a[a.size()-n+i])!=normalized(b[i])){same=false;break;}
    }
    if(same)common=n;
  }
  std::string result=left;
  for(size_t j=common;j<b.size();++j){result+=" ";result+=b[j];}
  return result;
}
struct Task {
  enum Type{DATA,END,QUIT} type=DATA;
  int window=0;
  uint32_t seq=0;
  uint64_t globalEnd=0;
  std::vector<float> pcm;
};
struct Segment{std::string text;bool done=false;};
struct Manager;
struct Worker{
  Manager* parent=nullptr;
  int id=0;
  const SherpaOnnxOnlineRecognizer* recognizer=nullptr;
  const SherpaOnnxOnlineStream* stream=nullptr;
  std::mutex mutex;
  std::condition_variable cv;
  std::deque<Task> jobs;
  std::thread thread;
  int activeWindow=-1;
  std::string lastRaw;
  uint64_t decodeCalls=0,decodeUs=0;
  void start();
  void enqueue(Task&& task);
  void loop();
  void beginWindow(int window);
  void process(Task& job);
  void endWindow();
  void update(bool final);
};
struct Manager{
  Worker workers[2];
  std::mutex stateMutex,readyMutex;
  std::condition_variable readyCv;
  std::map<int,Segment> segments;
  int primaryState=0; // 0: loading, 1: ready, -1: failed
  std::atomic<bool> standbyReady{false};
  std::string lastPublished;
  std::atomic<uint64_t> pcmSamples{0};
  unsigned int hypotheses=0;
  std::atomic<int> maxWindow{-1};
  std::set<int> endedWindows;
  std::map<int,int> windowOwners;
  std::atomic<int> reserved[2]{{0},{0}};
  std::deque<float> preroll;
  std::mutex ownerMutex;
  std::string argv[4];
  bool liveEdge=false;
  explicit Manager(int argc,char** a) {
    liveEdge=(argc==6);
    for(int i=0;i<4;++i)argv[i]=a[i+1];
    for(int i=0;i<2;++i){workers[i].parent=this;workers[i].id=i;}
  }
  void signalReady(bool ok,int worker){
    std::lock_guard<std::mutex> guard(readyMutex);
    if(worker==0)primaryState=ok?1:-1;
    else standbyReady.store(ok);
    readyCv.notify_all();
    if(worker==1)say("DUAL_STANDBY_MODEL_%s",ok?"READY":"UNAVAILABLE");
  }
  bool launch(){
    for(auto &w:workers)w.start();
    std::unique_lock<std::mutex> lock(readyMutex);
    // The primary recognizer alone opens the live stream. NEVER block live
    // start on a secondary model that may still be warming up.
    readyCv.wait(lock,[this]{return primaryState!=0;});
    if(primaryState!=1){
      lock.unlock();
      for(auto &w:workers){Task t;t.type=Task::QUIT;w.enqueue(std::move(t));}
      for(auto &w:workers)w.thread.join();
      return false;
    }
    say("STT_READY");
    say("ONLINE_READY:model=korean-zipformer-174m-int8:workers=2:primary=0:standby=1:window_ms=4000:stride_ms=4000:context_preroll_ms=500:decoding=modified_beam_search:threads_per_worker=1");
    say("DUAL_READY:workers=2:independent_recognizers=true:independent_online_streams=true:allocation=primary_then_standby:liveEdge=%d",liveEdge?1:0);
    return true;
  }
  int owner(int window){
    auto it=windowOwners.find(window);
    return it==windowOwners.end()?0:it->second;
  }
  void releaseWindow(int window,int worker){
    const int after=reserved[worker].fetch_sub(1)-1;
    say("DUAL_WORKER_RELEASE:worker=%d:window=%d:reservedAfter=%d",
        worker,window,after);
  }
  void beginWindow(int w,uint32_t seq){
    if(w<=maxWindow.load())return;
    for(int id=maxWindow.load()+1;id<=w;++id){
      // No id%2 alternation. Worker 0 is always preferred when unreserved.
      // Only an unfinished primary segment causes a handoff to standby.
      const int primary=reserved[0].load(),standby=reserved[1].load();
      const int assigned=primary==0?0:
        (standby==0 && standbyReady.load()?1:0);
      windowOwners.emplace(id,assigned);
      reserved[assigned].fetch_add(1);
      segments.emplace(id,Segment{});
      Task start;start.type=Task::DATA;start.window=id;start.seq=seq;
      workers[assigned].enqueue(std::move(start));
      // Preserve only the preceding 500ms phoneme context across a 4s
      // segment boundary. The next 4s are NEW data, never historical replay.
      if(id>0 && !preroll.empty()){
        Task context;context.type=Task::DATA;context.window=id;context.seq=seq;
        context.globalEnd=uint64_t(id)*STRIDE;
        context.pcm.assign(preroll.begin(),preroll.end());
        workers[assigned].enqueue(std::move(context));
      }
      maxWindow.store(id);
      say("DUAL_ASSIGN:window=%d:worker=%d:primaryBusy=%d:standbyBusy=%d:standbyReady=%d:reason=%s",
          id,assigned,primary,standby,standbyReady.load()?1:0,
          assigned==1?"PRIMARY_PROCESSING_PREVIOUS":
          primary==0?"PRIMARY_AVAILABLE":"STANDBY_UNAVAILABLE_OR_BUSY");
    }
  }
  void remember(const float* audio,size_t count){
    for(size_t i=0;i<count;++i){
      preroll.push_back(audio[i]);
      if(preroll.size()>PREROLL)preroll.pop_front();
    }
  }
  void markEnd(int w){
    if(!endedWindows.insert(w).second)return;
    Task task;task.type=Task::END;task.window=w;
    workers[owner(w)].enqueue(std::move(task));
  }
  void dispatch(uint32_t seq,const float* audio,uint32_t length){
    const uint64_t first=pcmSamples.load(),last=first+length;
    const uint64_t audioMs=last*1000/RATE;
    say("ONLINE_TIMING:INPUT:%u:%llu:%llu:0",seq,
        (unsigned long long)audioMs,(unsigned long long)bootNs());
    uint64_t at=first;
    while(at<last){
      const int w=int(at/STRIDE);
      if(w>maxWindow.load()){
        // Close the previous worker before attempting to reuse primary.
        if(w>0 && maxWindow.load()>=0)markEnd(w-1);
        beginWindow(w,seq);
      }
      const uint64_t hi=std::min(last,(uint64_t(w)+1)*STRIDE);
      const size_t lengthNow=size_t(hi-at);
      Task task;task.type=Task::DATA;task.window=w;task.seq=seq;
      task.globalEnd=hi;
      task.pcm.assign(audio+(at-first),audio+(at-first)+lengthNow);
      workers[owner(w)].enqueue(std::move(task));
      remember(audio+(at-first),lengthNow);
      if(hi==(uint64_t(w)+1)*STRIDE)markEnd(w);
      at=hi;
    }
    pcmSamples.store(last);
    say("ONLINE_ACCEPTED:%u:%u",seq,length);
  }
  void publish(int window,const std::string& raw,bool finished){
    std::string full,prior;
    unsigned int seq=0;
    // The state update AND ONLINE_EDIT publish must be one serialized unit.
    // Otherwise worker 1 can publish patch N+1 before worker 0 publishes N.
    std::lock_guard<std::mutex> guard(stateMutex);
    {
      Segment& s=segments[window];
      if(raw!=s.text)s.text=raw;
      if(finished)s.done=true;
      for(int i=0;i<=maxWindow.load();++i){
        auto it=segments.find(i);
        if(it==segments.end())break;
        full=joinOverlap(full,it->second.text);
      }
      if(full==lastPublished)return;
      prior=lastPublished;
      lastPublished=full;
      seq=++hypotheses;
    }
    // stateMutex remains held until the complete patch is emitted.
    // Only the changed UTF-8 suffix is sent to Java. The retained prefix
    // is described by UTF-16 code units so Hangul and emoji survive edits.
    // Both ASR recognizers and the original AAC delta stream are UNCHANGED.
    const size_t prefixBytes=commonUtf8Prefix(prior,full);
    const size_t keepUtf16=utf16Length(prior,prefixBytes);
    const std::string suffix=full.substr(prefixBytes);
    const auto now=bootNs(),audioMs=pcmSamples.load()*1000/RATE;
    say("ONLINE_TIMING:LIVE:%u:%llu:%llu:0",seq,
        (unsigned long long)audioMs,(unsigned long long)now);
    say("ONLINE_EDIT:%llu:%zu:%s",(unsigned long long)audioMs,
        keepUtf16,suffix.c_str());
    const auto w=tokens(full);
    if(!w.empty()){
      const std::string tail=w.size()>1?w[w.size()-2]+" "+w.back():w.back();
      say("ONLINE_LIVE_TAIL:%llu:%s",(unsigned long long)audioMs,tail.c_str());
    }
    say("DUAL_LIVE:window=%d:chars=%zu:workers=2:patchUtf16Keep=%zu:patchUtf8Bytes=%zu",
        window,full.size(),keepUtf16,suffix.size());
  }
  void finish(){
    // Finalize the last unclosed segment on user stop/source EOF.
    for(int w=0;w<=maxWindow.load();++w)markEnd(w);
    for(auto &w:workers){Task t;t.type=Task::QUIT;w.enqueue(std::move(t));}
    for(auto &w:workers)w.thread.join();
    std::string result;
    {
      std::lock_guard<std::mutex> guard(stateMutex);
      for(int i=0;i<=maxWindow.load();++i)result=joinOverlap(result,segments[i].text);
    }
    if(!result.empty()){
      say("STT_SEGMENT:1:%s",result.c_str());
      say("ONLINE_FINAL_FULL_TEXT:audioMs=%llu:chars=%zu",
          (unsigned long long)(pcmSamples.load()*1000/RATE),result.size());
    }
    say("ONLINE_FINISHED:pcmMs=%llu:hypotheses=%u:captions=%u:workers=2",
        (unsigned long long)(pcmSamples.load()*1000/RATE),hypotheses,!result.empty()?1:0);
    say("STT_FINISHED:%u",!result.empty()?1:0);
  }
};
void Worker::start(){thread=std::thread(&Worker::loop,this);}
void Worker::enqueue(Task&& task){
  std::unique_lock<std::mutex> lock(mutex);
  // Never blindly clear a window's END marker: that would strand the
  // standby reservation and mix consecutive streams. Upstream AAC live-edge
  // dropping is responsible for urgent catch-up.
  const uint64_t start=bootNs();
  cv.wait(lock,[this]{return jobs.size()<QUEUE_CAP;});
  const auto waitMs=(bootNs()-start)/1000000;
  if(waitMs>25)say("DUAL_QUEUE_BACKPRESSURE:worker=%d:waitMs=%llu:queue=%zu",id,
                     (unsigned long long)waitMs,jobs.size());
  jobs.emplace_back(std::move(task));
  lock.unlock();cv.notify_one();
}
void Worker::beginWindow(int window){
  if(activeWindow==window)return;
  if(stream)endWindow();
  stream=SherpaOnnxCreateOnlineStream(recognizer);
  if(!stream){say("DUAL_FATAL:worker=%d:stream_create_failed",id);return;}
  activeWindow=window;lastRaw.clear();
  say("DUAL_WINDOW_STARTED:worker=%d:window=%d:fromMs=%d",
      id,window,window*4000);
}
void Worker::update(bool final){
  if(!stream)return;
  auto* result=SherpaOnnxGetOnlineStreamResult(recognizer,stream);
  if(!result)return;
  const std::string raw=clean(result->text?result->text:"");
  SherpaOnnxDestroyOnlineRecognizerResult(result);
  if(raw!=lastRaw || final){
    lastRaw=raw;
    parent->publish(activeWindow,raw,final);
  }
}
void Worker::process(Task& job){
  if(job.window!=activeWindow)beginWindow(job.window);
  if(!stream || job.pcm.empty())return;
  const auto startNs=bootNs();
  SherpaOnnxOnlineStreamAcceptWaveform(stream,RATE,job.pcm.data(),job.pcm.size());
  say("DUAL_STAGE:ACCEPT:%d:%d:%u:%zu:%llu",id,activeWindow,job.seq,
      job.pcm.size(),(unsigned long long)bootNs());
  for(int i=0;i<1000 && SherpaOnnxIsOnlineStreamReady(recognizer,stream);++i){
    const uint64_t begin=bootNs();
    SherpaOnnxDecodeOnlineStream(recognizer,stream);
    const uint64_t end=bootNs();
    const uint64_t elapsedUs=(end-begin)/1000;
    decodeCalls++;decodeUs+=elapsedUs;
    say("ONLINE_TIMING:DECODE:%u:%llu:%llu:%llu",job.seq,
        (unsigned long long)(job.globalEnd*1000/RATE),
        (unsigned long long)end,(unsigned long long)elapsedUs);
    say("DUAL_STAGE:DECODE:worker=%d:window=%d:durationUs=%llu",id,activeWindow,
        (unsigned long long)elapsedUs);
    update(false);
  }
  const auto elapsed=(bootNs()-startNs)/1000000;
  if(elapsed>100)say("DUAL_PROCESS_FRAME:worker=%d:window=%d:durationMs=%llu",
                     id,activeWindow,(unsigned long long)elapsed);
}
void Worker::endWindow(){
  if(!stream)return;
  std::vector<float> padding(16*640,0.f);
  SherpaOnnxOnlineStreamAcceptWaveform(stream,RATE,padding.data(),padding.size());
  SherpaOnnxOnlineStreamInputFinished(stream);
  for(int i=0;i<1000 && SherpaOnnxIsOnlineStreamReady(recognizer,stream);++i){
    const auto before=bootNs();
    SherpaOnnxDecodeOnlineStream(recognizer,stream);
    const auto after=bootNs();
    decodeCalls++;decodeUs+=(after-before)/1000;
    say("DUAL_STAGE:FINAL_DECODE:worker=%d:window=%d:durationUs=%llu",id,activeWindow,
        (unsigned long long)((after-before)/1000));
    update(false);
  }
  update(true);
  say("DUAL_WINDOW_FINISHED:worker=%d:window=%d:decodeCalls=%llu:decodeTotalMs=%llu",
      id,activeWindow,(unsigned long long)decodeCalls,(unsigned long long)(decodeUs/1000));
  SherpaOnnxDestroyOnlineStream(stream);
  const int ended=activeWindow;
  stream=nullptr;activeWindow=-1;
  parent->releaseWindow(ended,id);
}
void Worker::loop(){
  SherpaOnnxOnlineRecognizerConfig config={};
  config.feat_config.sample_rate=16000;
  config.feat_config.feature_dim=80;
  config.model_config.transducer.encoder=parent->argv[1].c_str();
  config.model_config.transducer.decoder=parent->argv[2].c_str();
  config.model_config.transducer.joiner=parent->argv[3].c_str();
  config.model_config.tokens=parent->argv[0].c_str();
  config.model_config.num_threads=1; // 174M INT8; retain v25 one thread per worker to limit CPU contention.
  config.model_config.provider="cpu";
  config.model_config.modeling_unit="cjkchar";
  config.decoding_method="modified_beam_search";
  config.max_active_paths=8;
  config.enable_endpoint=0;
  const auto begin=bootNs();
  recognizer=SherpaOnnxCreateOnlineRecognizer(&config);
  say("DUAL_MODEL_READY:worker=%d:ok=%d:durationMs=%llu",id,recognizer?1:0,
      (unsigned long long)((bootNs()-begin)/1000000));
  parent->signalReady(recognizer!=nullptr,id);
  if(!recognizer)return;
  for(;;){
    Task job;
    {
      std::unique_lock<std::mutex> lock(mutex);
      cv.wait(lock,[this]{return !jobs.empty();});
      job=std::move(jobs.front());jobs.pop_front();
    }
    cv.notify_one();
    if(job.type==Task::QUIT)break;
    if(job.type==Task::END){
      if(activeWindow==job.window)endWindow();
      continue;
    }
    process(job);
  }
  if(stream)endWindow();
  say("DUAL_WORKER_DONE:worker=%d:decodeCalls=%llu:totalDecodeMs=%llu",id,
      (unsigned long long)decodeCalls,(unsigned long long)(decodeUs/1000));
  SherpaOnnxDestroyOnlineRecognizer(recognizer);
}
} // namespace
int main(int argc,char** argv){
  setvbuf(stdout,nullptr,_IOLBF,0);
  if(argc!=5 && argc!=6){
    fprintf(stderr,"USAGE: dual_zipformer tokens encoder decoder joiner [--live-edge]\n");return 2;
  }
  if(argc==6 && strcmp(argv[5],"--live-edge")){
    fprintf(stderr,"Unknown optional mode: %s\n",argv[5]);return 2;
  }
  Manager engine(argc,argv);
  if(!engine.launch())return 3;
  int status=0;
  for(;;){
    uint8_t h[8];
    if(!readAll(h,sizeof(h))){status=5;break;}
    const uint32_t seq=le32(h),n=le32(h+4);
    if(seq==0&&n==0)break;
    if(seq==0||n==0||n>RATE*12){status=6;break;}
    std::vector<uint8_t> bytes(size_t(n)*2);
    if(!readAll(bytes.data(),bytes.size())){status=7;break;}
    std::vector<float> pcm(n);
    for(uint32_t i=0;i<n;++i){
      const uint16_t u=uint16_t(bytes[2*i])|(uint16_t(bytes[2*i+1])<<8);
      pcm[i]=static_cast<int16_t>(u)/32768.f;
    }
    engine.dispatch(seq,pcm.data(),n);
  }
  engine.finish();
  return status;
}
