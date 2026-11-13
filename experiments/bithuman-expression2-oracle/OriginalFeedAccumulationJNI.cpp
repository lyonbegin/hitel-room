// Original Expression2 0.6.2 ARM64 FUN_001a7fbc PCM-accumulation oracle.
// Executes the *actual unmodified* native function using structurally minimal,
// explicitly synthetic engine state to cover only output-backpressured branches.
// The original native ML model and live feed/pump/pull are NOT exercised here.
#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <cstdint>
#include <cstring>
#include <new>
#include <mutex>
#include <sstream>
#include <vector>
#include <string>
#include <algorithm>

namespace {
constexpr uintptr_t kRvaFeedExport=0x001724d8;
constexpr uintptr_t kRvaOriginalAccum=0x001a7fbc;
constexpr uint32_t kOriginalPrologue=0xa9ba7bfd; // fd7bbaa9 @ 001a7fbc
constexpr size_t kCanonBytes=299520;
constexpr size_t kHistoryBytes=4792320;
constexpr size_t kCanonSlice=18720;
constexpr size_t kEngineBytes=0x600;
constexpr size_t kStateBytes=0x200;
constexpr size_t kNativeInitialFloats=64000; // 0x3e800 / sizeof(float)
using OriginalAccum=void (*)(void*,const float*,int64_t,uintptr_t);

void storeAddress(unsigned char* dst,size_t off,const void* value) {
    uintptr_t v=reinterpret_cast<uintptr_t>(value);
    std::memcpy(dst+off,&v,sizeof(v));
}
void store32(unsigned char* dst,size_t off,int32_t val) {
    std::memcpy(dst+off,&val,sizeof(val));
}
uint64_t read64(const unsigned char* src,size_t off) {
    uint64_t r;
    std::memcpy(&r,src+off,sizeof(r));
    return r;
}
int32_t read32(const unsigned char* src,size_t off) {
    int32_t r;
    std::memcpy(&r,src+off,sizeof(r));
    return r;
}
void raise(JNIEnv* env,const char* message) {
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_ORIGINAL_FEED","%s",message);
    auto cls=env->FindClass("java/lang/IllegalStateException");
    if(cls)env->ThrowNew(cls,message);
}
uintptr_t checkedOriginalAccum(JNIEnv* env) {
    void* h=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
    if(!h)h=dlopen("libexpr2jni.so",RTLD_NOW);
    if(!h){raise(env,"ORIGINAL_UNMODIFIED_LIB_NOT_LOADED");return 0;}
    void* feed=dlsym(h,"Java_ai_bithuman_expression2_Native_feed");
    if(!feed){raise(env,"ORIGINAL_FEED_JNI_ANCHOR_MISSING");return 0;}
    const uintptr_t addr=reinterpret_cast<uintptr_t>(feed)-kRvaFeedExport+kRvaOriginalAccum;
    uint32_t first=0;
    std::memcpy(&first,reinterpret_cast<const void*>(addr),sizeof(first));
    if(first!=kOriginalPrologue){
        raise(env,"ORIGINAL_ACCUM_ARM64_PROLOGUE_DIFFERS");return 0;
    }
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED",
        "REAL_ORIGINAL_ACCUM_ARM64_VERIFIED rva=0x%lx code=%x",
        static_cast<unsigned long>(kRvaOriginalAccum),first);
    return addr;
}
std::vector<float> samplesFor(size_t count,size_t seed) {
    std::vector<float> result(count);
    for(size_t i=0;i<count;++i) {
        const int64_t x=static_cast<int64_t>((i*4099u+seed*1237u)%1048573u)-524286;
        result[i]=static_cast<float>(x)/524288.0f;
    }
    return result;
}
bool canonHistoryMatches(const std::vector<unsigned char>& canon,
                         const std::vector<unsigned char>& history) {
    for(size_t s=0;s<16;++s)
        for(size_t h=0;h<16;++h)
            if(std::memcmp(history.data()+(s*16+h)*kCanonSlice,
                           canon.data()+s*kCanonSlice,kCanonSlice)!=0)return false;
    return true;
}
struct Case {
    const char* name;
    std::vector<size_t> counts;
};
std::string runFeedOracle(JNIEnv* env) {
    const uintptr_t addr=checkedOriginalAccum(env);
    if(env->ExceptionCheck() || !addr)return {};
    const auto original=reinterpret_cast<OriginalAccum>(addr);
    const std::vector<Case> cases={
        {"subthreshold_single",{25599}},
        {"subthreshold_many",{1600,1600,4096,8192}},
        {"cross_first_threshold",{8000,17599,1}},
        {"cross_second_threshold",{1600,25600,16800}},
        {"capacity_growth_and_backpressure",{8000,17599,1,18400,25600,1024}},
        {"larger_capacity_growth",{44000,64000,32000}}
    };
    std::ostringstream json;
    json<<"{\"sdk\":\"ai.bithuman:expression2-android:0.6.2\","
        <<"\"actual_original_arm64_function\":\"FUN_001a7fbc\","
        <<"\"original_rva\":\"0x001a7fbc\","
        <<"\"engine_state\":\"minimal synthetic, backend marked inactive; frame_limit=0\","
        <<"\"real_model_invoked\":false,"
        <<"\"cases\":[";
    size_t failures=0;
    for(size_t caseId=0;caseId<cases.size();++caseId) {
        const auto& spec=cases[caseId];
        // Source-derived state layout: original ARM64 instructions, run 43328017533.
        alignas(16) unsigned char state[kStateBytes]={};
        std::vector<unsigned char> engine(kEngineBytes,0);
        std::vector<unsigned char> canon(kCanonBytes);
        std::vector<unsigned char> history(kHistoryBytes,0);
        for(size_t j=0;j<canon.size();++j)
            canon[j]=static_cast<unsigned char>((j*37u+caseId*13u)&0xffu);
        storeAddress(engine.data(),0x268,canon.data());
        storeAddress(engine.data(),0x280,history.data());
        // Original FUN_001a77c0 checks engine+0x3d0 and +0x528: both 0.
        storeAddress(state,0x00,engine.data());
        // Setting limit=0 prevents FUN_001a80dc from entering its inference
        // function FUN_001a8500 at the 25600-sample threshold.
        store32(state,0x2c,0);
        auto* stateMutex=new (state+0x7c) std::mutex();
        std::vector<float> candidate;
        candidate.reserve(kNativeInitialFloats);
        bool complete=true;
        int firstFailedChunk=-1;
        size_t expectedSamples=0;
        size_t referenceCapacity=0;
        for(size_t chunkId=0;chunkId<spec.counts.size();++chunkId) {
            const auto chunk=samplesFor(spec.counts[chunkId],caseId*31+chunkId);
            // No arbitrary truncation or re-quantization: original gets exact
            // Float32 PCM bytes from a separate owned input vector.
            original(state,chunk.data(),static_cast<int64_t>(chunk.size()),0);
            candidate.insert(candidate.end(),chunk.begin(),chunk.end());
            expectedSamples+=chunk.size();
            const auto begin=read64(state,0x38);
            const auto end=read64(state,0x40);
            const auto cap=read64(state,0x48);
            const size_t refSamples=(end-begin)/4;
            referenceCapacity=(cap-begin)/4;
            const bool rangeValid=(begin!=0 && begin<=end && end<=cap);
            const bool sizeMatch=rangeValid &&
                refSamples==expectedSamples && read64(state,0x50)==expectedSamples &&
                read64(state,0x58)==expectedSamples;
            const bool contentMatch=sizeMatch &&
                std::memcmp(reinterpret_cast<const void*>(begin),
                            candidate.data(),expectedSamples*sizeof(float))==0;
            const bool capacityMatch=referenceCapacity==candidate.capacity();
            const bool active=(state[0x30]&1)!=0 && state[0x31]==0;
            const bool noFrameWork=read32(state,0x68)==0 && read64(state,0xd0)==0;
            const bool ok=contentMatch && capacityMatch && active && noFrameWork;
            if(!ok){complete=false;if(firstFailedChunk<0)firstFailedChunk=static_cast<int>(chunkId);}
            __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED",
                "ORIGINAL_ACCUM_CHUNK case=%s index=%zu refsamples=%zu cap=%zu contents=%d capacity=%d inference_steps=%d",
                spec.name,chunkId,refSamples,referenceCapacity,
                contentMatch?1:0,capacityMatch?1:0,read32(state,0x68));
        }
        const bool historyMatches=canonHistoryMatches(canon,history);
        complete=complete && historyMatches;
        if(!complete)++failures;
        if(caseId)json<<",";
        json<<"{\"case\":\""<<spec.name<<"\","
            <<"\"chunks\":"<<spec.counts.size()<<","
            <<"\"total_pcm_samples\":"<<expectedSamples<<","
            <<"\"original_buffer_capacity_floats\":"<<referenceCapacity<<","
            <<"\"candidate_buffer_capacity_floats\":"<<candidate.capacity()<<","
            <<"\"original_canon_history_exact\":"<<(historyMatches?"true":"false")<<","
            <<"\"first_failed_chunk\":"<<firstFailedChunk<<","
            <<"\"no_inference_steps\":"<<(read32(state,0x68)==0?"true":"false")<<","
            <<"\"buffer_content_size_capacity_equal\":"<<(complete?"true":"false")<<"}";
        __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED",
            "ORIGINAL_ACCUM_CASE name=%s exact=%d samples=%zu capacity=%zu canon=%d",
            spec.name,complete?1:0,expectedSamples,referenceCapacity,
            historyMatches?1:0);
        // FUN_001a7fbc allocated a Float32 vector via the original C++
        // allocator. Release the allocation; raw state is only an oracle test.
        void* originalPcm=reinterpret_cast<void*>(read64(state,0x38));
        if(originalPcm)::operator delete(originalPcm);
        stateMutex->~mutex();
    }
    json<<"],\"case_count\":"<<cases.size()
        <<",\"failures\":"<<failures
        <<",\"status\":\""<<(failures==0?"PASS":"FAIL")<<"\","
        <<"\"scope\":\"real original ARM64 feed accumulation under synthetic backpressure; no live model, no full SDK parity\"}";
    return json.str();
}
} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalFeedAccumulationOracle(JNIEnv* env,jobject) {
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_FEED","ORIGINAL_ACCUM_ORACLE_ENTER");
    const auto result=runFeedOracle(env);
    if(env->ExceptionCheck())return nullptr;
    return env->NewStringUTF(result.c_str());
}
