// Execute the unmodified vendor ARM64 Expression2 0.6.2 FUN_001a8230.
// This is a tail/end-segment guard-state oracle, NOT a replacement SDK.
// Synthetic frameLimit=0 prevents model invocation and backend flush.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <new>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>
namespace {
constexpr uintptr_t kFeedExport=0x001724d8,kEndRva=0x001a8230;
constexpr uint32_t kFirstOpcode=0xa9be7bfd; // original fd7bbea9
using OriginalEnd=uint64_t(*)(void*,int64_t,uint64_t);
void fail(JNIEnv* env,const char* msg) {
  __android_log_print(ANDROID_LOG_ERROR,"EXPR2_END_ORACLE","%s",msg);
  jclass cls=env->FindClass("java/lang/IllegalStateException");
  if(cls)env->ThrowNew(cls,msg);
}
uintptr_t originalAddress(JNIEnv* env) {
  void* lib=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
  if(!lib)lib=dlopen("libexpr2jni.so",RTLD_NOW);
  if(!lib){fail(env,"UNMODIFIED_ORIGINAL_LIBRARY_MISSING");return 0;}
  void* anchor=dlsym(lib,"Java_ai_bithuman_expression2_Native_feed");
  if(!anchor){fail(env,"ORIGINAL_JNI_FEED_ANCHOR_MISSING");return 0;}
  auto addr=reinterpret_cast<uintptr_t>(anchor)-kFeedExport+kEndRva;
  uint32_t ins=0;
  std::memcpy(&ins,reinterpret_cast<void*>(addr),sizeof(ins));
  if(ins!=kFirstOpcode){fail(env,"ORIGINAL_END_FUNCTION_OPCODE_CHANGED");return 0;}
  __android_log_print(ANDROID_LOG_INFO,"EXPR2_END_ORACLE",
      "ORIGINAL_END_ARM64_IDENTITY_PASS rva=%lx ins=%x",
      static_cast<unsigned long>(kEndRva),ins);
  return addr;
}
template<class T> void store(unsigned char* data,size_t at,T v) {
  std::memcpy(data+at,&v,sizeof(v));
}
template<class T> T read(const unsigned char* data,size_t at) {
  T v{};std::memcpy(&v,data+at,sizeof(v));return v;
}
struct Case { const char* name;bool open;bool tail;int64_t samples;int64_t ending; };
std::string run(JNIEnv* env){
  const auto address=originalAddress(env);
  if(!address||env->ExceptionCheck())return {};
  const auto original=reinterpret_cast<OriginalEnd>(address);
  const std::vector<Case> tests={
    {"closed_zero",false,false,0,0},
    {"closed_with_samples",false,false,1000,500},
    {"closed_tail_flag",false,true,1000,100},
    {"open_zero",true,false,0,0},
    {"open_short",true,false,1000,0},
    {"open_end_inside",true,false,1000,500},
    {"open_end_equals",true,false,1000,1000},
    {"open_end_past",true,false,1000,1001},
    {"open_end_negative",true,false,1000,-1},
    {"open_padded_tail",true,false,30000,15000},
    {"open_tail_already_set",true,true,25000,18000},
  };
  std::ostringstream json;size_t passed=0;
  json<<"{\"sdk\":\"ai.bithuman:expression2-android:0.6.2\","
      <<"\"original_function\":\"FUN_001a8230\",\"original_rva\":\"0x001a8230\","
      <<"\"synthetic_backpressure_blocks_inference\":true,\"cases\":[";
  for(size_t i=0;i<tests.size();++i){
    const auto& t=tests[i];
    alignas(16) unsigned char state[0x200]={};
    alignas(16) unsigned char engine[0x600]={};
    store<uintptr_t>(state,0,reinterpret_cast<uintptr_t>(engine));
    store<int32_t>(state,0x2c,0); // original inference capacity guard
    state[0x30]=t.open?1:0;state[0x31]=t.tail?1:0;
    store<int64_t>(state,0x50,t.samples);
    store<int32_t>(state,0x68,0); // original motion step index
    auto* mutex=new (state+0x7c) std::mutex;
    const uint64_t retval=original(state,t.ending,0u);
    const auto observed=read<int64_t>(state,0x50);
    const int64_t expected=(t.open&&t.ending>0&&t.ending<t.samples)
      ?t.ending:t.samples;
    const bool endOpen=(state[0x30]&1)!=0;
    const bool endTail=(state[0x31]&1)!=0;
    const bool ok=(retval==1u && observed==expected && endOpen==t.open &&
      endTail==(t.open||t.tail) && read<int32_t>(state,0x68)==0 &&
      read<uint64_t>(state,0xd0)==0);
    if(ok)++passed;
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_END_ORACLE",
       "ORIGINAL_END_CASE name=%s sample=%lld expected=%lld open=%d tail=%d pass=%d",
       t.name,static_cast<long long>(observed),static_cast<long long>(expected),
       endOpen?1:0,endTail?1:0,ok?1:0);
    mutex->~mutex();
    if(i)json<<",";
    json<<"{\"case\":\""<<t.name<<"\",\"original_return\":"<<retval
        <<",\"sample\":"<<observed<<",\"expected\":"<<expected
        <<",\"open\":"<<(endOpen?"true":"false")
        <<",\"tail\":"<<(endTail?"true":"false")
        <<",\"pass\":"<<(ok?"true":"false")<<"}";
  }
  json<<"],\"case_count\":"<<tests.size()<<",\"passed\":"<<passed
      <<",\"failures\":"<<(tests.size()-passed)<<",\"result\":\""
      <<(passed==tests.size()?"PASS":"FAIL")<<"\","
      <<"\"scope\":\"original ARM64 endSegment state/trim branches before infer or backend flush\"}";
  return json.str();
}
}
extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalEndSegmentGuardOracle(JNIEnv* env,jobject){
  const auto result=run(env);
  if(env->ExceptionCheck())return nullptr;
  return env->NewStringUTF(result.c_str());
}