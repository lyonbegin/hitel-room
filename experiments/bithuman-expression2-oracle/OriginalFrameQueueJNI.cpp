// Source-gated real unmodified Expression2 0.6.2 ARM64 native frame deque oracle.
//
// FUN_001aa40c is called DIRECTLY from the vendor libexpr2jni.so and is
// *not* a rewritten/decompiled substitute. Native state is an isolated
// synthetic deque fixture, not the live video inference engine. These tests
// prove only the selected branch's copy, metadata and ownership behavior.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <new>
#include <mutex>
#include <sstream>
#include <vector>
#include <algorithm>

namespace {
constexpr uintptr_t kFeedExportRva=0x001724d8;
constexpr uintptr_t kQueuePopRva=0x001aa40c;
constexpr uint32_t kPrologue=0xfc1b0fe8; // original bytes e80f1bfc
constexpr size_t kImageBytes=0x124800;
constexpr size_t kSlotBytes=0x38;
constexpr size_t kBlockEntries=0x49;
using OriginalPop=uint64_t(*)(void*,void*,uint64_t,uint64_t*,char*);
void error(JNIEnv* env,const char* s){
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_QUEUE_ORIGINAL","%s",s);
    jclass e=env->FindClass("java/lang/IllegalStateException");
    if(e)env->ThrowNew(e,s);
}
uintptr_t originalPopAddress(JNIEnv* env){
    void* lib=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
    if(!lib)lib=dlopen("libexpr2jni.so",RTLD_NOW);
    if(!lib){error(env,"UNMODIFIED_ORIGINAL_NATIVE_LIBRARY_MISSING");return 0;}
    void* anchor=dlsym(lib,"Java_ai_bithuman_expression2_Native_feed");
    if(!anchor){error(env,"ORIGINAL_FEED_JNI_ANCHOR_NOT_FOUND");return 0;}
    const uintptr_t address=reinterpret_cast<uintptr_t>(anchor)-kFeedExportRva+kQueuePopRva;
    uint32_t first=0;
    std::memcpy(&first,reinterpret_cast<const void*>(address),sizeof(first));
    if(first!=kPrologue){error(env,"ORIGINAL_NATIVE_QUEUE_OPCODE_CHANGED");return 0;}
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_QUEUE_ORIGINAL",
        "REAL_ORIGINAL_FRAME_QUEUE_ENTRY address=%p original_prologue=%x",
        reinterpret_cast<void*>(address),first);
    return address;
}
void store(unsigned char* b,size_t o,uint64_t v){std::memcpy(b+o,&v,8);}
uint64_t load(const unsigned char* b,size_t o){uint64_t v=0;std::memcpy(&v,b+o,8);return v;}
struct Case {const char* name;size_t n;bool alternateSpeech;};
std::string run(JNIEnv* env){
    const auto address=originalPopAddress(env);
    if(env->ExceptionCheck() || !address)return {};
    const auto pop=reinterpret_cast<OriginalPop>(address);
    const std::vector<Case> tests={
        {"empty",0,false},{"single",1,false},
        {"single_speech",1,true},{"four_frames",4,true},{"eight_frames",8,true}
    };
    size_t failures=0,totalCopied=0;
    std::ostringstream json;
    json<<"{\"sdk\":\"ai.bithuman:expression2-android:0.6.2\","
        <<"\"original_function\":\"FUN_001aa40c\","
        <<"\"original_rva\":\"0x001aa40c\","
        <<"\"frame_bytes\":"<<kImageBytes<<","
        <<"\"synthetic_queue\":true,\"model_executed\":false,\"cases\":[";
    for(size_t t=0;t<tests.size();++t){
        const auto& spec=tests[t];
        alignas(16) unsigned char state[0x200]={};
        auto* lock=new(state+0x7c) std::mutex;
        auto* block=static_cast<unsigned char*>(::operator new(kBlockEntries*kSlotBytes));
        std::memset(block,0,kBlockEntries*kSlotBytes);
        uintptr_t map[2]={reinterpret_cast<uintptr_t>(block),0};
        store(state,0xb0,reinterpret_cast<uintptr_t>(map));
        store(state,0xb8,reinterpret_cast<uintptr_t>(map+1));
        store(state,0xc8,0);
        store(state,0xd0,spec.n);
        std::vector<std::vector<unsigned char>> expected;
        for(size_t i=0;i<spec.n;++i){
            expected.emplace_back(kImageBytes);
            for(size_t p=0;p<kImageBytes;++p)
                expected.back()[p]=static_cast<unsigned char>((p*17u+i*43u+t*19u)&255u);
            void* source=::operator new(kImageBytes);
            std::memcpy(source,expected.back().data(),kImageBytes);
            unsigned char* slot=block+i*kSlotBytes;
            store(slot,0,1000u+i);
            store(slot,8,2000u+i);
            store(slot,16,16000u*(i+1));
            slot[24]=static_cast<unsigned char>(spec.alternateSpeech&&(i%2==0));
            store(slot,0x20,reinterpret_cast<uintptr_t>(source));
        }
        std::vector<unsigned char> output(kImageBytes,0x5c);
        bool equal=true;
        int firstFail=-1;
        size_t popped=0;
        for(size_t i=0;i<spec.n;++i){
            std::fill(output.begin(),output.end(),0x5c);
            uint64_t meta[4]={0,0,0,0};
            const auto returned=pop(state,output.data(),kImageBytes,meta,nullptr);
            const bool bytes=std::memcmp(output.data(),expected[i].data(),kImageBytes)==0;
            const bool metadata=meta[0]==1000u+i && meta[1]==2000u+i &&
              meta[2]==16000u*(i+1) &&
              reinterpret_cast<const unsigned char*>(meta)[24] ==
                static_cast<unsigned char>(spec.alternateSpeech && (i%2==0));
            const bool queue=load(state,0xc8)==i+1 && load(state,0xd0)==spec.n-i-1;
            const bool ownership=load(block+i*kSlotBytes,0x20)==0;
            if(returned==1)++popped;
            if(returned!=1 || !bytes || !metadata || !queue || !ownership){
                equal=false;if(firstFail<0)firstFail=static_cast<int>(i);
            }
            __android_log_print(ANDROID_LOG_INFO,"EXPR2_QUEUE_ORIGINAL",
                "ORIGINAL_POP_FRAME case=%s index=%zu bytes=%d meta=%d queue=%d ownership=%d",
                spec.name,i,bytes?1:0,metadata?1:0,queue?1:0,ownership?1:0);
        }
        std::fill(output.begin(),output.end(),0x97);
        uint64_t metaEmpty[4]={0,0,0,0};
        const auto emptyReturned=pop(state,output.data(),kImageBytes,metaEmpty,nullptr);
        bool remained=true;
        for(unsigned char c:output)if(c!=0x97){remained=false;break;}
        const bool empty=emptyReturned==0 && remained && load(state,0xd0)==0;
        if(!empty)equal=false;
        // The original pop cleared and deleted successfully transferred image
        // allocations. Free only pointers still retained by a deque slot.
        for(size_t i=0;i<spec.n;++i){
            void* leftover=reinterpret_cast<void*>(load(block+i*kSlotBytes,0x20));
            if(leftover)::operator delete(leftover);
        }
        ::operator delete(block);
        lock->~mutex();
        if(!equal)++failures;
        totalCopied+=popped;
        if(t)json<<",";
        json<<"{\"name\":\""<<spec.name<<"\",\"requested\":"<<spec.n
            <<",\"popped\":"<<popped
            <<",\"copy_metadata_ownership_exact\":"<<(equal?"true":"false")
            <<",\"empty_pull_zero\":"<<(empty?"true":"false")
            <<",\"first_failed_frame\":"<<firstFail<<"}";
        __android_log_print(ANDROID_LOG_INFO,"EXPR2_QUEUE_ORIGINAL",
            "ORIGINAL_QUEUE_CASE %s pass=%d popped=%zu",spec.name,equal?1:0,popped);
    }
    json<<"],\"case_count\":"<<tests.size()<<",\"frame_count\":"<<totalCopied
        <<",\"failures\":"<<failures<<",\"status\":\""<<(failures?"FAIL":"PASS")
        <<"\",\"scope\":\"original isolated deque copy/metadata/ownership only; not model generation or live SDK parity\"}";
    return json.str();
}
}
extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalFrameQueueOracle(JNIEnv* env,jobject){
    const std::string json=run(env);
    if(env->ExceptionCheck())return nullptr;
    return env->NewStringUTF(json.c_str());
}
