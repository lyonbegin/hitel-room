// Original Expression2 0.6.2 ARM64 FUN_001a7a04 -> FUN_001aa40c.
// Executes unmodified vendor machine code, not reconstructed replacement.
// Synthetic already-rendered backend frames; no inference, auth or live GPU.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <new>
#include <mutex>
#include <condition_variable>
#include <vector>
#include <string>
#include <sstream>
#include <array>
#include <algorithm>
namespace {
constexpr uintptr_t kFeedRva=0x001724d8,kTransferRva=0x001a7a04;
constexpr uintptr_t kPopRva=0x001aa40c,kCountRva=0x001a84cc;
constexpr size_t kFrameBytes=0x124800,kSlotBytes=0x38,kSlots=0x49;
using Transfer=uint64_t(*)(void*,uint64_t,uint8_t*,std::string*);
using Pop=uint64_t(*)(void*,void*,uint64_t,uint64_t*,char*);
using Count=uint64_t(*)(void*);
void fail(JNIEnv* env,const char* why){
  __android_log_print(ANDROID_LOG_ERROR,"EXPR2_TRANSFER_ORACLE","%s",why);
  jclass cls=env->FindClass("java/lang/IllegalStateException");
  if(cls)env->ThrowNew(cls,why);
}
uintptr_t checked(JNIEnv* env,void* lib,uintptr_t rva,uint32_t opcode) {
  void* anchor=dlsym(lib,"Java_ai_bithuman_expression2_Native_feed");
  if(!anchor){fail(env,"ORIGINAL_JNI_ANCHOR_NOT_FOUND");return 0;}
  uintptr_t ptr=reinterpret_cast<uintptr_t>(anchor)-kFeedRva+rva;
  uint32_t actual=0;std::memcpy(&actual,reinterpret_cast<void*>(ptr),4);
  if(actual!=opcode){fail(env,"ORIGINAL_MACHINE_BYTES_MISMATCH");return 0;}
  return ptr;
}
template<class T>void put(unsigned char* m,size_t at,T v) {
  std::memcpy(m+at,&v,sizeof(v));
}
template<class T>T get(const unsigned char* m,size_t at) {
  T v{};std::memcpy(&v,m+at,sizeof(v));return v;
}
struct Context {
  alignas(16) unsigned char state[0x300]={};
  alignas(16) unsigned char backend[0x650]={};
  void* block=nullptr;
  void* map[1]={};
  std::mutex* queueMutex=nullptr;
  std::mutex* backendMutex=nullptr;
  std::condition_variable* cond=nullptr;
  std::string* errorString=nullptr;
  Context() {
    block=::operator new(kSlotBytes*kSlots);
    std::memset(block,0,kSlotBytes*kSlots);
    map[0]=block;
    put(state,0,reinterpret_cast<uintptr_t>(backend));
    put(state,0xb0,reinterpret_cast<uintptr_t>(&map[0]));
    put(state,0xb8,reinterpret_cast<uintptr_t>(&map[1]));
    put<uint64_t>(state,0xc8,0);
    put<uint64_t>(state,0xd0,0);
    queueMutex=new(state+0x7c)std::mutex;
    backendMutex=new(backend+0x3f0)std::mutex;
    cond=new(backend+0x418)std::condition_variable;
    errorString=new(backend+0x568)std::string;
    backend[0x3d0]=1;
    backend[0x528]=1;
    put<int32_t>(backend,0x448,0);
  }
  ~Context() {
    errorString->~basic_string();
    cond->~condition_variable();
    backendMutex->~mutex();
    queueMutex->~mutex();
    ::operator delete(block);
  }
};
struct Case {const char* name;int frames;uint8_t pattern;};
std::string run(JNIEnv* env){
  void* lib=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
  if(!lib)lib=dlopen("libexpr2jni.so",RTLD_NOW);
  if(!lib){fail(env,"UNMODIFIED_ORIGINAL_LIBRARY_NOT_LOADED");return {};}
  const auto t=checked(env,lib,kTransferRva,0xd10243ff); // ff4302d1
  const auto p=checked(env,lib,kPopRva,0xfc1b0fe8); // e80f1bfc
  const auto q=checked(env,lib,kCountRva,0xa9be7bfd); // fd7bbea9
  if(env->ExceptionCheck()||!t||!p||!q)return {};
  auto transfer=reinterpret_cast<Transfer>(t);
  auto pop=reinterpret_cast<Pop>(p);
  auto count=reinterpret_cast<Count>(q);
  const std::vector<Case> cases={{"single_frame",1,0x41},{"two_frames",2,0xab}};
  std::ostringstream report;size_t passed=0;
  report<<"{\"sdk\":\"ai.bithuman:expression2-android:0.6.2\","
        <<"\"original_transfer_rva\":\"0x001a7a04\","
        <<"\"original_pop_rva\":\"0x001aa40c\","
        <<"\"native_frame_bytes\":"<<kFrameBytes<<",\"cases\":[";
  for(size_t ci=0;ci<cases.size();++ci) {
    const auto& testcase=cases[ci];
    Context c;
    auto* staged=static_cast<unsigned char*>(::operator new(testcase.frames*kSlotBytes));
    std::memset(staged,0,testcase.frames*kSlotBytes);
    std::vector<std::vector<uint8_t>> expected;
    for(int f=0;f<testcase.frames;++f) {
      auto* img=static_cast<uint8_t*>(::operator new(kFrameBytes));
      auto& ref=expected.emplace_back(kFrameBytes);
      for(size_t i=0;i<kFrameBytes;++i) {
        uint8_t x=static_cast<uint8_t>(((i*3u+i/1024u+f*17u)&0xffu)^testcase.pattern);
        img[i]=x;ref[i]=x;
      }
      auto* slot=staged+f*kSlotBytes;
      put<uint64_t>(slot,0,3000+f);
      put<uint64_t>(slot,8,4000+f);
      put<uint64_t>(slot,16,5000+f);
      slot[0x18]=static_cast<uint8_t>(f%2);
      put(slot,0x20,reinterpret_cast<uintptr_t>(img));
    }
    put(c.backend,0x530,reinterpret_cast<uintptr_t>(staged));
    put(c.backend,0x538,reinterpret_cast<uintptr_t>(staged+testcase.frames*kSlotBytes));
    put(c.backend,0x540,reinterpret_cast<uintptr_t>(staged+testcase.frames*kSlotBytes));
    uint8_t produced=0;std::string error;
    uint64_t transferResult=transfer(c.state,1,&produced,&error);
    uint64_t queued=count(c.state);
    bool moved=transferResult==1&&produced==1&&queued==(uint64_t)testcase.frames&&
       get<uintptr_t>(c.backend,0x530)==0&&
       get<uintptr_t>(c.backend,0x538)==0&&c.backend[0x528]==0;
    std::vector<uint8_t> out(kFrameBytes);
    size_t extracted=0;
    for(int f=0;f<testcase.frames&&moved;++f) {
      std::array<uint64_t,4> meta{0,0,0,0};
      uint64_t result=pop(c.state,out.data(),out.size(),meta.data(),nullptr);
      bool data=std::equal(expected[f].begin(),expected[f].end(),out.begin());
      bool info=meta[0]==(uint64_t)(3000+f)&&meta[1]==(uint64_t)(4000+f)&&
                meta[2]==(uint64_t)(5000+f)&&(meta[3]&0xffu)==(unsigned)(f%2);
      if(result==1&&data&&info)++extracted;
    }
    bool ok=moved&&extracted==(size_t)testcase.frames&&count(c.state)==0&&
      get<uint64_t>(c.state,0xc8)==(uint64_t)testcase.frames;
    if(ok)++passed;
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_TRANSFER_ORACLE",
      "ORIGINAL_TRANSFER_CASE name=%s moved=%d exact=%zu expected=%d pass=%d",
      testcase.name,moved?1:0,extracted,testcase.frames,ok?1:0);
    if(ci)report<<",";
    report<<"{\"name\":\""<<testcase.name<<"\",\"frames\":"<<testcase.frames
          <<",\"original_queued\":"<<queued<<",\"exact_popped\":"<<extracted
          <<",\"pass\":"<<(ok?"true":"false")<<"}";
  }
  report<<"],\"case_count\":"<<cases.size()<<",\"passed\":"<<passed
        <<",\"failures\":"<<(cases.size()-passed)<<",\"status\":\""
        <<(passed==cases.size()?"PASS":"FAIL")<<"\","
        <<"\"scope\":\"actual ARM64 transfer and dequeue with synthetic backend frame buffers; no ML rendering\"}";
  return report.str();
}
}
extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalFrameTransferOracle(JNIEnv* env,jobject) {
  const auto s=run(env);
  if(env->ExceptionCheck())return nullptr;
  return env->NewStringUTF(s.c_str());
}