// v30: Vosk small-ko Kaldi recognizer, one persistent stream.
// The existing Galaxy M4A -> AAC -> Android MediaCodec -> PCM transport is untouched.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdarg>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>
#include <unistd.h>
#include <time.h>
extern "C" {
struct VoskModel; struct VoskRecognizer;
void vosk_set_log_level(int);
VoskModel* vosk_model_new(const char*);
void vosk_model_free(VoskModel*);
VoskRecognizer* vosk_recognizer_new(VoskModel*,float);
int vosk_recognizer_accept_waveform(VoskRecognizer*,const char*,int);
const char* vosk_recognizer_result(VoskRecognizer*);
const char* vosk_recognizer_partial_result(VoskRecognizer*);
const char* vosk_recognizer_final_result(VoskRecognizer*);
void vosk_recognizer_free(VoskRecognizer*);
}
namespace {
constexpr uint32_t RATE=16000;
constexpr double RMS_FLOOR=.003,PEAK_FLOOR=.02;
uint64_t nowNs(){timespec t{};clock_gettime(CLOCK_BOOTTIME,&t);return uint64_t(t.tv_sec)*1000000000ULL+t.tv_nsec;}
void say(const char* fmt,...){va_list v;va_start(v,fmt);vfprintf(stdout,fmt,v);va_end(v);fputc('\n',stdout);fflush(stdout);}
bool readAll(void* p,size_t bytes){size_t at=0;while(at<bytes){ssize_t n=read(0,(char*)p+at,bytes-at);if(n<=0)return false;at+=(size_t)n;}return true;}
uint32_t le32(const unsigned char* p){return (uint32_t)p[0]|((uint32_t)p[1]<<8)|((uint32_t)p[2]<<16)|((uint32_t)p[3]<<24);}
void appendUtf8(std::string& s,unsigned c){if(c<128)s+=char(c);else if(c<2048){s+=char(192|(c>>6));s+=char(128|(c&63));}else if(c<65536){s+=char(224|(c>>12));s+=char(128|((c>>6)&63));s+=char(128|(c&63));}else if(c<0x110000){s+=char(240|(c>>18));s+=char(128|((c>>12)&63));s+=char(128|((c>>6)&63));s+=char(128|(c&63));}}
int hex(char c){if(c>='0'&&c<='9')return c-'0';if(c>='a'&&c<='f')return c-'a'+10;if(c>='A'&&c<='F')return c-'A'+10;return -1;}
std::string jsonText(const char* json,const char* key){
  if(!json)return {};
  const std::string src(json),search=std::string("\"")+key+"\"";
  size_t p=src.find(search);if(p==std::string::npos)return {};
  p=src.find(':',p+search.size());if(p==std::string::npos)return {};
  p=src.find('"',p+1);if(p==std::string::npos)return {};
  std::string out;
  for(++p;p<src.size();++p){
    char c=src[p];if(c=='"')break;
    if(c!='\\'){out+=c;continue;}
    if(++p>=src.size())break;c=src[p];
    if(c=='u'&&p+4<src.size()){
      unsigned n=0;bool ok=true;
      for(int j=1;j<=4;j++){int h=hex(src[p+j]);if(h<0){ok=false;break;}n=n*16+(unsigned)h;}
      if(ok){appendUtf8(out,n);p+=4;}else out+='?';
    }else if(c=='n'||c=='r'||c=='t')out+=' ';
    else if(c=='\\'||c=='"'||c=='/')out+=c;
  }
  return out;
}
size_t prefixBytes(const std::string& a,const std::string& b){
  size_t k=0;while(k<a.size()&&k<b.size()&&a[k]==b[k])k++;
  while(k>0&&k<b.size()&&((unsigned char)b[k]&192)==128)k--;return k;
}
size_t utf16Units(const std::string& s,size_t to){
  size_t count=0;
  for(size_t i=0;i<to;){unsigned c=(unsigned char)s[i];
    if((c&248)==240){count+=2;i+=4;}
    else if((c&240)==224){count++;i+=3;}
    else if((c&224)==192){count++;i+=2;}
    else {count++;i++;}
  }return count;
}
struct Engine{
  VoskModel* model=nullptr;VoskRecognizer* rec=nullptr;
  std::string committed,lastSent;
  uint64_t total=0,accepted=0,skipped=0,decodeUs=0,decodeCalls=0;
  unsigned seqCaption=0;
  ~Engine(){if(rec)vosk_recognizer_free(rec);if(model)vosk_model_free(model);}
  bool init(const char* path,bool live){
    vosk_set_log_level(-1);
    auto start=nowNs();model=vosk_model_new(path);
    if(!model){say("VOSK_LOAD_FAILED:model");return false;}
    rec=vosk_recognizer_new(model,16000.f);
    if(!rec){say("VOSK_LOAD_FAILED:recognizer");return false;}
    say("VOSK_MODEL_READY:ok=1:startupMs=%llu",(unsigned long long)((nowNs()-start)/1000000));
    say("STT_READY");
    say("ONLINE_READY:model=vosk-small-ko-0.22:recognizers=1:streams=1:partial=1:liveEdge=%d",live?1:0);
    say("VOSK_STREAM_CREATED:count=1:continuous=1:no_zipformer=1");
    return true;
  }
  void update(const std::string& next){
    if(next==lastSent)return;
    auto n=prefixBytes(lastSent,next);
    auto keep=utf16Units(lastSent,n);
    std::string suffix=next.substr(n);
    lastSent=next;unsigned id=++seqCaption;uint64_t clock=nowNs(),audioMs=total*1000/RATE;
    say("ONLINE_TIMING:LIVE:%u:%llu:%llu:0",id,(unsigned long long)audioMs,(unsigned long long)clock);
    say("ONLINE_EDIT:%llu:%zu:%s",(unsigned long long)audioMs,keep,suffix.c_str());
  }
  void push(uint32_t id,const std::vector<unsigned char>& buf){
    size_t count=buf.size()/2;total+=count;
    uint64_t audioMs=total*1000/RATE;
    say("ONLINE_TIMING:INPUT:%u:%llu:%llu:0",id,(unsigned long long)audioMs,(unsigned long long)nowNs());
    double sum=0,peak=0;
    for(size_t i=0;i<buf.size();i+=2){short s=(short)(unsigned short)(buf[i]|(buf[i+1]<<8));double x=s/32768.;sum+=x*x;peak=std::max(peak,std::abs(x));}
    double rms=std::sqrt(sum/std::max<size_t>(1,count));
    if(rms<RMS_FLOOR&&peak<PEAK_FLOOR){
      skipped+=count;
      say("SPEECH_GATE_SKIP:seq=%u:audioMs=%llu:skippedMs=%llu",id,(unsigned long long)audioMs,(unsigned long long)(skipped*1000/RATE));
      say("ONLINE_SKIPPED:%u:%llu",id,(unsigned long long)audioMs);
      return;
    }
    auto st=nowNs();
    int endpoint=vosk_recognizer_accept_waveform(rec,(const char*)buf.data(),(int)buf.size());
    auto end=nowNs();uint64_t us=(end-st)/1000;decodeUs+=us;decodeCalls++;accepted+=count;
    say("ONLINE_TIMING:DECODE:%u:%llu:%llu:%llu",id,(unsigned long long)audioMs,(unsigned long long)end,(unsigned long long)us);
    say("VOSK_DECODE:seq=%u:durationUs=%llu:endpoint=%d",id,(unsigned long long)us,endpoint);
    if(endpoint<0){say("VOSK_FATAL:accept_failed");return;}
    if(endpoint==1){std::string done=jsonText(vosk_recognizer_result(rec),"text");if(!done.empty()){if(!committed.empty())committed+=" ";committed+=done;}update(committed);}
    else{std::string partial=jsonText(vosk_recognizer_partial_result(rec),"partial");update(committed+(committed.empty()||partial.empty()?"":" ")+partial);}
    say("ONLINE_ACCEPTED:%u:%zu",id,count);
  }
  void finish(){
    if(rec){std::string done=jsonText(vosk_recognizer_final_result(rec),"text");
      if(!done.empty()){if(!committed.empty())committed+=" ";committed+=done;}update(committed);}
    if(!committed.empty())say("STT_SEGMENT:1:%s",committed.c_str());
    say("VOSK_STREAM_FINISHED:audioMs=%llu:acceptedMs=%llu:skippedMs=%llu:decodeCalls=%llu:decodeTotalMs=%llu",
      (unsigned long long)(total*1000/RATE),(unsigned long long)(accepted*1000/RATE),
      (unsigned long long)(skipped*1000/RATE),(unsigned long long)decodeCalls,(unsigned long long)(decodeUs/1000));
    say("ONLINE_FINISHED:pcmMs=%llu:hypotheses=%u:captions=%u:workers=1",
      (unsigned long long)(total*1000/RATE),seqCaption,!lastSent.empty()?1:0);
    say("STT_FINISHED:%u",!lastSent.empty()?1:0);
  }
};
}
int main(int argc,char** argv){
  setvbuf(stdout,nullptr,_IOLBF,0);
  if(argc!=2&&argc!=3){fprintf(stderr,"USAGE: vosk_korean MODEL_DIRECTORY [--live-edge]\n");return 2;}
  if(argc==3&&strcmp(argv[2],"--live-edge"))return 2;
  Engine engine;if(!engine.init(argv[1],argc==3))return 3;int status=0;
  for(;;){unsigned char h[8];if(!readAll(h,sizeof(h))){status=5;break;}
    unsigned seq=le32(h),n=le32(h+4);if(seq==0&&n==0)break;
    if(seq==0||n==0||n>RATE*12){status=6;break;}
    std::vector<unsigned char> pcm((size_t)n*2);
    if(!readAll(pcm.data(),pcm.size())){status=7;break;}
    engine.push(seq,pcm);
  }engine.finish();return status;
}
