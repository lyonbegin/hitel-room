// Actual original-ARM64 FUN_001a7fbc feed-state oracle for Expression2 0.6.2.
//
// Runs unmodified published libexpr2jni.so code. This harness supplies only a
// synthetic engine state sufficient to observe ORIGINAL pre-inference PCM
// accumulation, segment open, canonical history init and backpressure.
// A configured output limit of 0 prevents entering the ML inference path.
// Do not treat this as a whole-SDK or dynamic-backend verification.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <cmath>
#include <new>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <memory>
#include <limits>

namespace {
constexpr uintptr_t kAnchorRva=0x001724d8;
constexpr uintptr_t kOriginalFeedRva=0x001a7fbc;
constexpr uint32_t kFeedOriginalOpcode=0xa9ba7bfd;
constexpr size_t kCanonBytes=299520;
constexpr size_t kHistoryBytes=4792320;
constexpr size_t kCanonSlice=18720;
constexpr size_t kMinCapacity=64000;

void throwTest(JNIEnv* env,const char *what) {
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_ORIGINAL_FEED","%s",what);
    jclass cls=env->FindClass("java/lang/IllegalStateException");
    if(cls)env->ThrowNew(cls,what);
}
uintptr_t originalFeedAddress(JNIEnv* env) {
    void* h=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
    if(!h)h=dlopen("libexpr2jni.so",RTLD_NOW);
    if(!h){throwTest(env,"ORIGINAL_LIB_MISSING");return 0;}
    void* anchor=dlsym(h,"Java_ai_bithuman_expression2_Native_feed");
    if(!anchor){throwTest(env,"ORIGINAL_FEED_EXPORT_MISSING");return 0;}
    const auto address=reinterpret_cast<uintptr_t>(anchor)-kAnchorRva+kOriginalFeedRva;
    uint32_t opcode;
    std::memcpy(&opcode,reinterpret_cast<void*>(address),sizeof(opcode));
    if(opcode!=kFeedOriginalOpcode) {
        throwTest(env,"ORIGINAL_PCM_FEED_ARM64_OPCODE_MISMATCH");
        return 0;
    }
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED",
        "ORIGINAL_FUNCTION_IDENTITY rva=0x%lx opcode=0x%x",
        static_cast<unsigned long>(kOriginalFeedRva),opcode);
    return address;
}
using OriginalFeed = void(*)(void*,const float*,int64_t,uint64_t);

void writePointer(unsigned char* state,size_t at,const void* ptr) {
    std::memcpy(state+at,&ptr,sizeof(ptr));
}
uint64_t read64(unsigned char* state,size_t at) {
    uint64_t r;std::memcpy(&r,state+at,sizeof(r));return r;
}
int32_t read32(unsigned char* state,size_t at) {
    int32_t r;std::memcpy(&r,state+at,sizeof(r));return r;
}
void write32(unsigned char* state,size_t at,int32_t value) {
    std::memcpy(state+at,&value,sizeof(value));
}
std::vector<float> chunk(int count,int seed) {
    std::vector<float> a(static_cast<size_t>(count));
    for(size_t i=0;i<a.size();++i) {
        const uint32_t x=static_cast<uint32_t>((i*7919u+seed*11113u)%100003u);
        a[i]=static_cast<float>(static_cast<int>(x)-50000)/131072.0f;
    }
    return a;
}
struct Scenario {
    const char* name;
    std::vector<int> chunks;
    bool reserveSmall;
};
struct Synth {
    alignas(16) unsigned char engine[0x600]={};
    alignas(16) unsigned char state[0x280]={};
    std::vector<unsigned char> canon;
    std::vector<unsigned char> history;
    std::vector<float>* pcm;
    std::mutex* outputMutex;

    Synth(bool reserveSmall):canon(kCanonBytes),history(kHistoryBytes,0xa5) {
        for(size_t i=0;i<canon.size();++i)
            canon[i]=static_cast<unsigned char>((i*31u+7u)%251u);
        writePointer(engine,0x268,canon.data());
        writePointer(engine,0x280,history.data());
        writePointer(state,0,engine);
        // Original FUN_001a80dc explicitly blocks if
        // engine[+0x2c] <= queued frames + outstanding backend work.
        write32(state,0x2c,0);
        pcm=new (state+0x38) std::vector<float>;
        if(reserveSmall) pcm->reserve(8);
        outputMutex=new (state+0x7c) std::mutex;
    }
    ~Synth() {
        // Free allocations with the same libc++ allocator used by original
        // vector append code. No vendor frame/async workers are started.
        pcm->~vector();
        outputMutex->~mutex();
    }
};
bool canonEquals(const Synth& s) {
    for(size_t slice=0;slice<16;++slice) {
        const auto* src=s.canon.data()+slice*kCanonSlice;
        for(size_t i=0;i<16;++i) {
            const auto* dst=s.history.data()+(slice*16+i)*kCanonSlice;
            if(std::memcmp(dst,src,kCanonSlice)!=0)return false;
        }
    }
    return true;
}
std::string runProbe(JNIEnv* env) {
    const auto addr=originalFeedAddress(env);
    if(env->ExceptionCheck() || !addr)return {};
    const auto feed=reinterpret_cast<OriginalFeed>(addr);
    const std::vector<Scenario> tests={
        {"empty_initial",{0},false},
        {"single_8",{8},false},
        {"below_threshold",{25599},false},
        {"threshold_exact",{25600},false},
        {"threshold_split",{8000,17600},true},
        {"second_threshold",{25600,18399,1},false},
        {"third_threshold",{25600,18400,25599,1},false},
        {"many_small_chunks",{1600,1600,3200,6400,12800,1600,8000,10000},true},
        {"capacity_growth",{32000,32000,1,64000},true},
    };
    size_t passed=0;
    std::ostringstream json;
    json<<"{\"source\":\"actual_unmodified_Expression2_0.6.2_ARM64\","
        <<"\"original_feed_function\":\"FUN_001a7fbc\","
        <<"\"original_feed_rva\":\"0x001a7fbc\","
        <<"\"no_original_sdk_replacement\":true,"
        <<"\"backend_inference_disabled_by_source_verified_capacity_guard\":true,"
        <<"\"cases\":[";
    for(size_t ci=0;ci<tests.size();++ci) {
        const auto &test=tests[ci];
        Synth s(test.reserveSmall);
        std::vector<float> expected;
        uint64_t expectedTotal=0;
        bool ok=true;
        size_t firstBad=std::numeric_limits<size_t>::max();
        bool canonInitialized=true;
        for(size_t j=0;j<test.chunks.size();++j) {
            const auto a=chunk(test.chunks[j],static_cast<int>(ci*37+j));
            float sentinel=0.0f;
            const float* ptr=a.empty()?&sentinel:a.data();
            // Calls the original vendor ARM64 function, including reset,
            // canon history initialization, vector append and scheduler.
            feed(s.state,ptr,static_cast<int64_t>(a.size()),0u);
            expected.insert(expected.end(),a.begin(),a.end());
            expectedTotal+=a.size();
            const bool pcmOk=s.pcm->size()==expected.size() &&
                (expected.empty() ||
                 std::memcmp(s.pcm->data(),expected.data(),
                             expected.size()*sizeof(float))==0);
            const bool countersOk=read64(s.state,0x50)==expected.size() &&
                                  read64(s.state,0x58)==expectedTotal &&
                                  read64(s.state,0x60)==0u;
            const bool flagsOk=((s.state[0x30] & 1)==1) &&
                               (s.state[0x31]==0);
            const bool inferenceBlocked=read32(s.state,0x68)==0 &&
                                        read64(s.state,0xd0)==0;
            const bool capacitiesOk=s.pcm->capacity()>=kMinCapacity;
            const bool historyOk=canonEquals(s);
            canonInitialized=canonInitialized && historyOk;
            if(!(pcmOk && countersOk && flagsOk && inferenceBlocked &&
                 capacitiesOk && historyOk)){
                ok=false;
                if(firstBad==std::numeric_limits<size_t>::max())firstBad=j;
                __android_log_print(ANDROID_LOG_ERROR,"EXPR2_ORIGINAL_FEED",
                    "FEED_STATE_MISMATCH case=%s index=%zu pcm=%d counts=%d flags=%d blocked=%d capacity=%d canon=%d",
                    test.name,j,pcmOk,countersOk,flagsOk,inferenceBlocked,
                    capacitiesOk,historyOk);
            }
        }
        if(ok)++passed;
        if(ci)json<<",";
        json<<"{\"case\":\""<<test.name<<"\",\"chunks\":"<<test.chunks.size()
            <<",\"total_samples\":"<<expectedTotal
            <<",\"original_pcm_capacity\":"<<s.pcm->capacity()
            <<",\"original_open_flag\":"<<(int)s.state[0x30]
            <<",\"original_step\":"<<read32(s.state,0x68)
            <<",\"history_matches_16x\":\""<<(canonInitialized?"YES":"NO")<<"\""
            <<",\"first_failed_chunk\":"
            <<(firstBad==std::numeric_limits<size_t>::max()?-1:(long long)firstBad)
            <<",\"pass\":"<<(ok?"true":"false")<<"}";
        __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED",
            "ORIGINAL_FEED_STATE_CASE name=%s checked_original=1 chunks=%zu pcm=%llu capacity=%zu pass=%d",
            test.name,test.chunks.size(),static_cast<unsigned long long>(expectedTotal),
            s.pcm->capacity(),ok?1:0);
    }
    json<<"],\"total_cases\":"<<tests.size()
        <<",\"passed\":"<<passed
        <<",\"failed\":"<<(tests.size()-passed)
        <<",\"status\":\""<<(passed==tests.size()?"PASS":"FAIL")<<"\","
        <<"\"limitation\":\"pre-inference synthetic engine; cannot establish complete feed, backend, pump, pull or reset parity\"}";
    return json.str();
}
} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalFeedStateOracle(JNIEnv* env,jobject) {
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED","ORIGINAL_FEED_STATE_ORACLE_ENTER");
    const auto output=runProbe(env);
    if(env->ExceptionCheck())return nullptr;
    return env->NewStringUTF(output.c_str());
}
