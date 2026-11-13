// Expression2 0.6.2 original ARM64 frame-queue pop and frame-count oracle.
// Executes actual unmodified libexpr2jni.so functions FUN_001aa40c
// and FUN_001a84cc, NOT a replacement renderer or copied queue algorithm.
// Synthetic deque input only; no model/GPU backend is started.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <new>
#include <mutex>
#include <vector>
#include <string>
#include <sstream>
#include <array>
#include <algorithm>
namespace {
constexpr uintptr_t kFeedExport=0x001724d8;
constexpr uintptr_t kPopRva=0x001aa40c;
constexpr uintptr_t kCountRva=0x001a84cc;
constexpr uint32_t kPopOpcode=0xfc1b0fe8; // ARM64 e80f1bfc
constexpr uint32_t kCountOpcode=0xa9be7bfd; // ARM64 fd7bbea9
constexpr size_t kFrameBytes=0x124800;
constexpr size_t kSlots=0x49,kSlotBytes=0x38;
using OriginalPop=uint64_t(*)(void*,void*,uint64_t,uint64_t*,char*);
using OriginalCount=uint64_t(*)(void*);
void raise(JNIEnv* env,const char* msg){
 __android_log_print(ANDROID_LOG_ERROR,"EXPR2_FRAME_ORACLE","%s",msg);
 jclass c=env->FindClass("java/lang/IllegalStateException");
 if(c)env->ThrowNew(c,msg);
}
uintptr_t originalFunction(JNIEnv* env,void* lib,uintptr_t rva,uint32_t opcode){
 void* anchor=dlsym(lib,"Java_ai_bithuman_expression2_Native_feed");
 if(!anchor){raise(env,"ORIGINAL_FEED_EXPORT_ABSENT");return 0;}
 const auto addr=reinterpret_cast<uintptr_t>(anchor)-kFeedExport+rva;
 uint32_t actual=0;std::memcpy(&actual,reinterpret_cast<void*>(addr),sizeof(actual));
 if(actual!=opcode){raise(env,"ORIGINAL_FRAME_CODE_IDENTITY_MISMATCH");return 0;}
 __android_log_print(ANDROID_LOG_INFO,"EXPR2_FRAME_ORACLE",
    "ORIGINAL_FRAME_ARM64_ENTRY_PASS rva=%lx opcode=%x",
    static_cast<unsigned long>(rva),actual);
 return addr;
}
template<typename T>void store(unsigned char* p,size_t off,T value){
 std::memcpy(p+off,&value,sizeof(value));
}
template<typename T>T load(const unsigned char* p,size_t off){
 T value{};std::memcpy(&value,p+off,sizeof(value));return value;
}
struct State {
 alignas(16) unsigned char native[0x200]={};
 std::mutex* mutexPtr=nullptr;
 void* block=nullptr;
 void* map[1]={};
 State(){
   block=::operator new(kSlots*kSlotBytes);
   std::memset(block,0,kSlots*kSlotBytes);
   map[0]=block;
   auto *mapPtr=&map[0];
   store(native,0xb0,reinterpret_cast<uintptr_t>(mapPtr));
   mutexPtr=new (native+0x7c)std::mutex;
 }
 ~State(){
   mutexPtr->~mutex();
   ::operator delete(block); // The original function frees each dequeued image.
 }
 unsigned char* slot(){return reinterpret_cast<unsigned char*>(block);}
};
struct Case{const char* name;uint8_t pattern;uint8_t speech;bool withMeta;size_t margin;};
std::string run(JNIEnv* env){
 void* lib=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
 if(!lib)lib=dlopen("libexpr2jni.so",RTLD_NOW);
 if(!lib){raise(env,"UNMODIFIED_ORIGINAL_LIBRARY_MISSING");return {};}
 const auto popAddr=originalFunction(env,lib,kPopRva,kPopOpcode);
 const auto countAddr=originalFunction(env,lib,kCountRva,kCountOpcode);
 if(env->ExceptionCheck()||!popAddr||!countAddr)return {};
 auto pop=reinterpret_cast<OriginalPop>(popAddr);
 auto count=reinterpret_cast<OriginalCount>(countAddr);
 const std::vector<Case> tests={
   {"zero_silence",0x00,0,true,0},
   {"speech_pattern",0x55,1,true,0},
   {"nontrivial_pattern",0xa3,1,true,64},
   {"without_metadata",0x7a,0,false,16},
 };
 std::ostringstream out;size_t passing=0;
 out<<"{\"sdk\":\"ai.bithuman:expression2-android:0.6.2\","
    <<"\"original_pop_rva\":\"0x001aa40c\","
    <<"\"original_queue_count_rva\":\"0x001a84cc\","
    <<"\"frame_bytes\":"<<kFrameBytes<<",\"cases\":[";
 for(size_t ci=0;ci<tests.size();++ci){
   const auto& t=tests[ci];State engine;
   auto* originalImage=static_cast<uint8_t*>(::operator new(kFrameBytes));
   std::vector<uint8_t> expected(kFrameBytes);
   for(size_t i=0;i<kFrameBytes;++i){
     uint8_t x=static_cast<uint8_t>(((i*37u+i/1024u)&0xffu)^t.pattern);
     originalImage[i]=x;expected[i]=x;
   }
   uint64_t index=100+ci,time=200+ci,sample=300+ci;
   auto* slot=engine.slot();
   store(slot,0,index);store(slot,8,time);store(slot,16,sample);
   slot[24]=t.speech;
   store(slot,0x20,reinterpret_cast<uintptr_t>(originalImage));
   store<uint64_t>(engine.native,0xc8,0);
   store<uint64_t>(engine.native,0xd0,1);
   std::vector<uint8_t> output(kFrameBytes+t.margin,0xee);
   std::array<uint64_t,4> meta{0,0,0,0};
   const bool before=count(engine.native)==1;
   uint64_t r=pop(engine.native,output.data(),output.size(),
                  t.withMeta?meta.data():nullptr,nullptr);
   // Original code has already freed originalImage; ownership must be clear.
   const bool imageExact=std::equal(expected.begin(),expected.end(),output.begin());
   const bool marginUntouched=std::all_of(output.begin()+kFrameBytes,
     output.end(),[](uint8_t v){return v==0xee;});
   const bool metadataExact=!t.withMeta||
     (meta[0]==index&&meta[1]==time&&meta[2]==sample&&(meta[3]&255u)==t.speech);
   const bool ownerZero=load<uintptr_t>(slot,0x20)==0;
   const bool headOne=load<uint64_t>(engine.native,0xc8)==1;
   const bool queueEmpty=count(engine.native)==0 &&
                   load<uint64_t>(engine.native,0xd0)==0;
   uint64_t empty=pop(engine.native,output.data(),output.size(),
                   t.withMeta?meta.data():nullptr,nullptr);
   bool ok=r==1&&empty==0&&before&&imageExact&&marginUntouched&&
           metadataExact&&ownerZero&&headOne&&queueEmpty;
   if(ok)++passing;
   __android_log_print(ANDROID_LOG_INFO,"EXPR2_FRAME_ORACLE",
      "ORIGINAL_FRAME_POP_CASE name=%s exact=%d owner=%d head=%d meta=%d pass=%d",
      t.name,imageExact?1:0,ownerZero?1:0,headOne?1:0,metadataExact?1:0,ok?1:0);
   if(ci)out<<",";
   out<<"{\"name\":\""<<t.name<<"\",\"pop_return\":"<<r
      <<",\"empty_return\":"<<empty<<",\"image_exact\":"
      <<(imageExact?"true":"false")<<",\"metadata_exact\":"
      <<(metadataExact?"true":"false")<<",\"ownership_cleared\":"
      <<(ownerZero?"true":"false")<<",\"head_incremented\":"
      <<(headOne?"true":"false")<<",\"queue_empty\":"
      <<(queueEmpty?"true":"false")<<",\"pass\":"
      <<(ok?"true":"false")<<"}";
 }
 out<<"],\"case_count\":"<<tests.size()<<",\"passed\":"<<passing
    <<",\"failures\":"<<(tests.size()-passing)<<",\"status\":\""
    <<(passing==tests.size()?"PASS":"FAIL")<<"\","
    <<"\"scope\":\"original native pop with synthetic queue, not GPU-rendered video\"}";
 return out.str();
}
}
extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalFramePopOracle(JNIEnv* env,jobject){
 const std::string s=run(env);
 if(env->ExceptionCheck())return nullptr;
 return env->NewStringUTF(s.c_str());
}