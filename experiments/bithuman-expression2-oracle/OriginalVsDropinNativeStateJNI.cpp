// Same-process, same-input comparison between ORIGINAL unmodified ARM64
// FUN_001a7fbc and the actual HITEL expression2_stream_state.cpp.
// Reference engine is synthetic/backpressured: NO ML inference is triggered.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <memory>
#include <mutex>
#include <new>
#include <sstream>
#include <vector>
#include <string>
#include <iomanip>
#include <algorithm>
#include "../../sdk/expression2-verified-core/include/expression2_stream_state.h"
#include "../../sdk/expression2-verified-core/include/expression2_verified_core.h"

namespace {
constexpr uintptr_t kJniFeedRva = 0x001724d8;
constexpr uintptr_t kNativeFeedRva = 0x001a7fbc;
constexpr uint32_t kExpectedPrologue = 0xa9ba7bfd;
using NativeFeed = void (*)(void*, const float*, int64_t, uintptr_t);

void pointerAt(unsigned char* dst,size_t offset,const void* p){
    const auto value = reinterpret_cast<uintptr_t>(p);
    std::memcpy(dst+offset,&value,sizeof(value));
}
void intAt(unsigned char* dst,size_t offset,int32_t v){
    std::memcpy(dst+offset,&v,sizeof(v));
}
uint64_t read64(const unsigned char* p,size_t off){
    uint64_t v=0;
    std::memcpy(&v,p+off,sizeof(v));
    return v;
}
int32_t read32(const unsigned char* p,size_t off){
    int32_t v=0;
    std::memcpy(&v,p+off,sizeof(v));
    return v;
}
void fail(JNIEnv* env,const char* message){
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_AB_DIFFERENTIAL","%s",message);
    jclass c=env->FindClass("java/lang/IllegalStateException");
    if(c)env->ThrowNew(c,message);
}
uint64_t fnv64(const float* src,size_t count){
    uint64_t hash=14695981039346656037ULL;
    const auto* data=reinterpret_cast<const unsigned char*>(src);
    for(size_t i=0;i<count*sizeof(float);++i) {
        hash^=data[i];hash*=1099511628211ULL;
    }
    return hash;
}
std::string hex64(uint64_t x){
    std::ostringstream out;
    out<<std::hex<<std::setfill('0')<<std::setw(16)<<x;
    return out.str();
}
std::vector<float> makePcm(size_t count,size_t seed){
    std::vector<float> out(count);
    for(size_t i=0;i<count;++i){
        const uint64_t x=(i*4099ULL+seed*1237ULL)%1048573ULL;
        out[i]=static_cast<float>(static_cast<int64_t>(x)-524286)/524288.0f;
    }
    return out;
}
struct Original {
    alignas(16) unsigned char engine[0x600]={};
    alignas(16) unsigned char state[0x280]={};
    std::vector<unsigned char> canon;
    std::vector<unsigned char> history;
    std::mutex* mutex;
    Original(size_t seed):canon(EXPR2_CANON_IN_BYTES),history(EXPR2_CANON_OUT_BYTES,0xA5){
        for(size_t j=0;j<canon.size();++j)
            canon[j]=static_cast<unsigned char>((j*37u+seed*13u)&0xffu);
        pointerAt(engine,0x268,canon.data());
        pointerAt(engine,0x280,history.data());
        pointerAt(state,0,engine);
        intAt(state,0x2c,0); // prevent model inference from synthetic engine
        mutex = new (state+0x7c) std::mutex;
    }
    ~Original(){
        void* pcm=reinterpret_cast<void*>(read64(state,0x38));
        if(pcm)::operator delete(pcm);
        mutex->~mutex();
    }
};
struct Case {
    const char* name;
    std::vector<size_t> feeds;
};
std::string execute(JNIEnv* env){
    void* handle=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
    if(!handle)handle=dlopen("libexpr2jni.so",RTLD_NOW);
    if(!handle){fail(env,"ORIGINAL_ARM64_BINARY_MISSING");return {};}
    auto* anchor=dlsym(handle,"Java_ai_bithuman_expression2_Native_feed");
    if(!anchor){fail(env,"ORIGINAL_ARM64_FEED_ANCHOR_MISSING");return {};}
    const auto address = reinterpret_cast<uintptr_t>(anchor)-kJniFeedRva+kNativeFeedRva;
    uint32_t op=0;
    std::memcpy(&op,reinterpret_cast<const void*>(address),4);
    if(op!=kExpectedPrologue){
        fail(env,"ORIGINAL_ARM64_FEED_PROLOGUE_HASH_MISMATCH");return {};
    }
    const auto originalFeed=reinterpret_cast<NativeFeed>(address);
    const std::vector<Case> cases={
        {"zero", {0}},
        {"eight", {8}},
        {"below_first", {25599}},
        {"first_exact", {25600}},
        {"first_split", {8000,17600}},
        {"second_exact", {25600,18400}},
        {"third_exact", {25600,18400,25600}},
        {"growth_128k", {44000,25600}},
        {"growth_256k", {44000,64000,32000}},
        {"single_full_speech", {221904}},
        {"many_speech_chunks", {1600,25600,18400,25600,25600,25600,25600,25600,25600,25600,25600,25600,25600,12904}}
    };
    int passed=0,failed=0,firstDivergenceCase=-1,firstDivergenceChunk=-1;
    std::ostringstream json;
    json<<"{\"reference\":\"actual unmodified original ARM64 FUN_001a7fbc\","
        <<"\"candidate\":\"actual HITEL sdk/expression2-verified-core/src/expression2_stream_state.cpp\","
        <<"\"mode\":\"synthetic_no_inference\","
        <<"\"reference_rva\":\"0x001a7fbc\","
        <<"\"original_instruction_verified\":true,\"cases\":[";
    for(size_t ci=0;ci<cases.size();++ci){
        const auto& spec=cases[ci];
        Original orig(ci);
        auto* candidate=expression2_stream_create(orig.canon.data(),orig.canon.size());
        if(!candidate){fail(env,"INDEPENDENT_STREAM_STATE_INIT_FAILED");return {};}
        bool all=true;
        std::vector<float> expected;
        std::ostringstream steps;
        for(size_t i=0;i<spec.feeds.size();++i){
            const auto pcm=makePcm(spec.feeds[i],ci*31+i);
            float dummy=0.0f;
            const float* input=pcm.empty()?&dummy:pcm.data();
            originalFeed(orig.state,input,static_cast<int64_t>(pcm.size()),0);
            const int result=expression2_stream_feed(candidate,input,pcm.size());
            Expr2StreamSnapshot s{};
            const int snapshot=expression2_stream_snapshot(candidate,&s);
            expected.insert(expected.end(),pcm.begin(),pcm.end());
            const uint64_t begin=read64(orig.state,0x38);
            const uint64_t end=read64(orig.state,0x40);
            const uint64_t capacity=read64(orig.state,0x48);
            const bool rangeValid=begin && begin<=end && end<=capacity;
            const size_t originalSize=rangeValid?(end-begin)/sizeof(float):0;
            const size_t originalCapacity=rangeValid?(capacity-begin)/sizeof(float):0;
            std::vector<float> candidatePcm(s.pcm_samples);
            const int copy=expression2_stream_copy_pcm(candidate,
                candidatePcm.empty()?nullptr:candidatePcm.data(),candidatePcm.size());
            const bool bytesEqual=rangeValid && originalSize==candidatePcm.size() &&
                (originalSize==0 || std::memcmp(reinterpret_cast<const void*>(begin),
                    candidatePcm.data(),originalSize*sizeof(float))==0);
            const bool sameCap=originalCapacity==s.pcm_capacity_samples;
            const bool counters=read64(orig.state,0x50)==s.pcm_samples &&
                read64(orig.state,0x58)==s.total_input_samples;
            const bool flags=(orig.state[0x30]&1)==(s.segment_open?1:0) &&
                orig.state[0x31]==(s.tail_pending?1:0);
            const bool state=read32(orig.state,0x68)==s.step &&
                read64(orig.state,0xd0)==s.queued_native_frames;
            const bool canon=s.canon_history_initialized!=0 &&
                orig.history.size()==EXPR2_CANON_OUT_BYTES;
            const bool ok=result==EXPR2_STREAM_OK && snapshot==EXPR2_STREAM_OK &&
                copy==EXPR2_STREAM_OK && bytesEqual && sameCap &&
                counters && flags && state && canon;
            if(!ok && firstDivergenceCase<0){
                firstDivergenceCase=static_cast<int>(ci);
                firstDivergenceChunk=static_cast<int>(i);
            }
            all &= ok;
            if(i)steps<<",";
            steps<<"{\"chunk\":"<<i<<",\"count\":"<<spec.feeds[i]
                <<",\"orig_samples\":"<<originalSize
                <<",\"candidate_samples\":"<<s.pcm_samples
                <<",\"orig_capacity\":"<<originalCapacity
                <<",\"candidate_capacity\":"<<s.pcm_capacity_samples
                <<",\"orig_input_counter\":"<<read64(orig.state,0x58)
                <<",\"candidate_input_counter\":"<<s.total_input_samples
                <<",\"orig_step\":"<<read32(orig.state,0x68)
                <<",\"candidate_step\":"<<s.step
                <<",\"orig_frame_count\":"<<read64(orig.state,0xd0)
                <<",\"candidate_frame_count\":"<<s.queued_native_frames
                <<",\"pcm_equal\":"<<(bytesEqual?"true":"false")
                <<",\"capacity_equal\":"<<(sameCap?"true":"false")
                <<",\"counters_equal\":"<<(counters?"true":"false")
                <<",\"flags_equal\":"<<(flags?"true":"false")
                <<",\"state_equal\":"<<(state?"true":"false")
                <<",\"canon_initialized\":"<<(canon?"true":"false")
                <<",\"orig_pcm_fnv64\":\""<<(rangeValid?hex64(fnv64(
                    reinterpret_cast<const float*>(begin),originalSize)):"unavailable")
                <<"\",\"candidate_pcm_fnv64\":\""<<hex64(fnv64(
                    candidatePcm.data(),candidatePcm.size()))<<"\""
                <<",\"match\":"<<(ok?"true":"false")<<"}";
            __android_log_print(ANDROID_LOG_INFO,"EXPR2_AB_DIFFERENTIAL",
                "CASE=%s CHUNK=%zu ORIG_PCM=%zu CAND_PCM=%llu ORIG_CAP=%zu CAND_CAP=%llu PCM=%d CAP=%d COUNTERS=%d PASS=%d",
                spec.name,i,originalSize,
                static_cast<unsigned long long>(s.pcm_samples),originalCapacity,
                static_cast<unsigned long long>(s.pcm_capacity_samples),
                bytesEqual?1:0,sameCap?1:0,counters?1:0,ok?1:0);
        }
        if(all)++passed;else ++failed;
        if(ci)json<<",";
        json<<"{\"case\":\""<<spec.name<<"\",\"passed\":"<<(all?"true":"false")
            <<",\"feed_count\":"<<spec.feeds.size()
            <<",\"states\":["<<steps.str()<<"]}";
        expression2_stream_destroy(candidate);
    }
    json<<"],\"total_cases\":"<<cases.size()
        <<",\"passed_cases\":"<<passed
        <<",\"failed_cases\":"<<failed
        <<",\"first_divergence_case_index\":"<<firstDivergenceCase
        <<",\"first_divergence_chunk_index\":"<<firstDivergenceChunk
        <<",\"conclusion\":\""<<(failed==0?"PASS":"FAIL")<<"\","
        <<"\"limits\":\"same controlled pre-inference state only; no original network/auth/full ML path\"}";
    return json.str();
}
} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalVsDropinNativeState(JNIEnv* env,jobject){
    const auto report=execute(env);
    if(env->ExceptionCheck())return nullptr;
    return env->NewStringUTF(report.c_str());
}
