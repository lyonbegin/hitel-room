// Expression2 0.6.2 actual-original native PCM insertion and scheduler guard oracle.
//
// Original calls execute unmodified vendor ARM64 machine instructions. The
// candidate vector append is the corresponding standard std::vector append
// indicated by the original FUN_001acf1c machine-code reconstruction.
// Scheduler tests deliberately cover only branches BEFORE ML inference.
// This is NOT an implementation of FUN_001a7fbc, the full scheduler, or the SDK.
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

namespace {
constexpr uintptr_t kFeedExportRva=0x001724d8;
constexpr uintptr_t kAppendRva=0x001acf1c;
constexpr uintptr_t kScheduleRva=0x001a80dc;
// Exact first original ARM64 instruction bytes as in run 43328017533:
// 001acf1c fd7bbaa9 stp x29,x30,[sp,#-0x60]!
// 001a80dc fd7bbba9 stp x29,x30,[sp,#-0x50]!
constexpr uint32_t kAppendFirstInsn=0xa9ba7bfd;
constexpr uint32_t kScheduleFirstInsn=0xa9bb7bfd;
constexpr int kSdkInitialFloats=64000; // FUN_001a7fbc allocates 0x3e800 = 256000 bytes.

void throwOriginal(JNIEnv *env,const char *what) {
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_ORIGINAL_PCM","%s",what);
    jclass cls=env->FindClass("java/lang/IllegalStateException");
    if(cls)env->ThrowNew(cls,what);
}
uintptr_t checkedOriginal(JNIEnv* env,uintptr_t rva,uint32_t first) {
    void *handle=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
    if(!handle)handle=dlopen("libexpr2jni.so",RTLD_NOW);
    if(!handle){throwOriginal(env,"ORIGINAL_LIBEXPR2JNI_NOT_LOADED");return 0;}
    void *anchor=dlsym(handle,"Java_ai_bithuman_expression2_Native_feed");
    if(!anchor){throwOriginal(env,"ORIGINAL_FEED_EXPORT_MISSING");return 0;}
    const auto base=reinterpret_cast<uintptr_t>(anchor)-kFeedExportRva;
    const uintptr_t addr=base+rva;
    uint32_t actual=0;
    std::memcpy(&actual,reinterpret_cast<void*>(addr),sizeof(actual));
    if(actual!=first){throwOriginal(env,"ORIGINAL_FUNCTION_MACHINE_INSTRUCTION_MISMATCH");return 0;}
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_PCM",
        "ORIGINAL_ARM64_SOURCE_ENTRY_PASS rva=0x%lx addr=%p opcode=0x%x",
        static_cast<unsigned long>(rva),reinterpret_cast<void*>(addr),actual);
    return addr;
}
using OriginalAppend = void* (*)(void*,void*,const void*,const void*,int64_t);
using OriginalSchedule = uint64_t (*)(void*,uint64_t,uint64_t);

void store64(unsigned char* mem,size_t offset,uint64_t value) {
    std::memcpy(mem+offset,&value,sizeof(value));
}
void store32(unsigned char* mem,size_t offset,int32_t value) {
    std::memcpy(mem+offset,&value,sizeof(value));
}
uint64_t load64(const unsigned char* mem,size_t offset) {
    uint64_t v=0;
    std::memcpy(&v,mem+offset,sizeof(v));
    return v;
}
int32_t load32(const unsigned char* mem,size_t offset) {
    int32_t v=0;
    std::memcpy(&v,mem+offset,sizeof(v));
    return v;
}
std::vector<float> makeChunk(size_t count,size_t nonce) {
    std::vector<float> values(count);
    for(size_t i=0;i<count;++i) {
        // Deterministic, non-constant bit patterns. No microphone/SDK inference.
        int n=static_cast<int>((i*7919u+nonce*101u)%131071u)-65535;
        values[i]=static_cast<float>(n)/131072.0f;
    }
    return values;
}
struct AppendCase {
    const char* name;
    size_t reserved;
    size_t initial;
    std::vector<size_t> chunkSizes;
};
struct SchedulerCase {
    const char* name;
    bool active;
    bool tail;
    uint64_t samples;
    int32_t step;
    uint64_t nativeQueued;
    int32_t frameLimit;
};

bool thresholdReached(const SchedulerCase& t) {
    if(!t.active)return false;
    if(!t.tail) {
        uint64_t threshold=(t.step==0?25600ull:(t.step==1?44000ull:
                                    static_cast<uint64_t>(t.step)*25600ull+18400ull));
        return t.samples>=threshold;
    }
    const int64_t x=static_cast<int64_t>(
        (static_cast<double>(static_cast<int64_t>(
            static_cast<double>(t.samples)/800.0))+11.0)/32.0);
    const int64_t required=x<2?1:x;
    return t.step<required;
}

std::string runAll(JNIEnv* env) {
    const auto appendAddr=checkedOriginal(env,kAppendRva,kAppendFirstInsn);
    if(env->ExceptionCheck() || !appendAddr)return {};
    const auto scheduleAddr=checkedOriginal(env,kScheduleRva,kScheduleFirstInsn);
    if(env->ExceptionCheck() || !scheduleAddr)return {};
    const auto append=reinterpret_cast<OriginalAppend>(appendAddr);
    const auto schedule=reinterpret_cast<OriginalSchedule>(scheduleAddr);

    const std::vector<AppendCase> appendCases={
        {"empty_zero",{0},0,{0}},
        {"empty_eight",0,0,{8}},
        {"within_reserved",64,16,{8}},
        {"exact_reserved",64,32,{32}},
        {"grow_by_one",64,63,{2}},
        {"grow_large",64,16,{128}},
        {"first_25600",kSdkInitialFloats,0,{25600}},
        {"append_to_44000",kSdkInitialFloats,25600,{18400}},
        {"cross_original_capacity",kSdkInitialFloats,44000,{25600}},
        {"repeated_mixed",kSdkInitialFloats,0,{1600,25600,1600,25600,1600,0,1600}},
        {"reallocation_twice",8,8,{64,512,2048}},
    };
    std::ostringstream report;
    size_t appendFailures=0;
    report<<"{\"sdk\":\"ai.bithuman:expression2-android:0.6.2\","
          <<"\"unmodified_arm64_original_executed\":true,"
          <<"\"original_append_rva\":\"0x001acf1c\","
          <<"\"original_schedule_rva\":\"0x001a80dc\","
          <<"\"append_cases\":[";
    for(size_t idx=0;idx<appendCases.size();++idx) {
        const auto &spec=appendCases[idx];
        std::vector<float> original,independent;
        original.reserve(spec.reserved);
        independent.reserve(spec.reserved);
        auto initial=makeChunk(spec.initial,999+idx);
        original.insert(original.end(),initial.begin(),initial.end());
        independent.insert(independent.end(),initial.begin(),initial.end());
        bool equal=true;
        int firstMismatch=-1;
        for(size_t ch=0;ch<spec.chunkSizes.size();++ch) {
            const auto chunk=makeChunk(spec.chunkSizes[ch],ch+idx*17);
            float sentinel=0.0f;
            const float *begin=chunk.empty()?&sentinel:chunk.data();
            const float *end=begin+chunk.size();
            void *insertPos=original.empty()?static_cast<void*>(original.data()):
                static_cast<void*>(original.data()+original.size());
            // Critical: execute unmodified FUN_001acf1c, not a copy.
            append(static_cast<void*>(&original),insertPos,begin,end,
                   static_cast<int64_t>(chunk.size()));
            independent.insert(independent.end(),chunk.begin(),chunk.end());
            if(original.size()!=independent.size() ||
               original.capacity()!=independent.capacity() ||
               (original.size() &&
                std::memcmp(original.data(),independent.data(),
                            original.size()*sizeof(float))!=0)) {
                equal=false;
                if(firstMismatch<0)firstMismatch=static_cast<int>(ch);
            }
        }
        if(!equal)++appendFailures;
        if(idx)report<<",";
        report<<"{\"case\":\""<<spec.name<<"\","
              <<"\"source\":\"ORIGINAL_ARM64_FUN_001acf1c\","
              <<"\"chunk_count\":"<<spec.chunkSizes.size()<<","
              <<"\"output_floats\":"<<original.size()<<","
              <<"\"original_capacity\":"<<original.capacity()<<","
              <<"\"candidate_capacity\":"<<independent.capacity()<<","
              <<"\"first_different_chunk\":"<<firstMismatch<<","
              <<"\"byte_exact_and_capacity_equal\":"<<(equal?"true":"false")<<"}";
        __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_PCM",
            "ORIGINAL_APPEND_CASE name=%s actualOriginal=1 bitExactCapacity=%d floats=%zu capacity=%zu",
            spec.name,equal?1:0,original.size(),original.capacity());
    }
    report<<"],\"append_failures\":"<<appendFailures<<",\"scheduler_guard_cases\":[";

    // Back-pressure guards deliberately prevent FUN_001a8500/model execution.
    // Their results are original scheduler observations, not full engine parity.
    const std::vector<SchedulerCase> schedulerCases={
        {"closed_segment",false,false,0,0,0,0},
        {"initial_just_below",true,false,25599,0,0,0},
        {"initial_exact_threshold",true,false,25600,0,0,0},
        {"second_just_below",true,false,43999,1,0,0},
        {"second_exact_threshold",true,false,44000,1,0,0},
        {"third_just_below",true,false,69599,2,0,0},
        {"third_exact_threshold",true,false,69600,2,0,0},
        {"queued_backpressure",true,false,70000,2,4,2},
        {"tail_min_already_done",true,true,0,1,0,0},
        {"tail_min_blocked",true,true,0,0,1,0},
        {"tail_second_not_required",true,true,44000,2,0,0},
        {"tail_second_blocked",true,true,44000,1,0,0},
    };
    size_t guardFailures=0;
    for(size_t idx=0;idx<schedulerCases.size();++idx) {
        const auto &t=schedulerCases[idx];
        // Alignment: Android NDK's bionic pthread mutex / libc++ std::mutex.
        // The exact offset 0x7c is from the original native instructions.
        alignas(16) unsigned char state[0x200]={};
        auto* mutexPtr=new (state+0x7c) std::mutex;
        state[0x30]=t.active?1:0;
        store32(state,0x2c,t.frameLimit);
        store64(state,0x50,t.samples);
        store32(state,0x68,t.step);
        store64(state,0xd0,t.nativeQueued);
        // *engine=0 -> no asynchronous inference backend is attached.
        store64(state,0x00,0);
        const bool ready=thresholdReached(t);
        const bool safe=!ready || t.frameLimit<=static_cast<int64_t>(t.nativeQueued);
        if(!safe){
            mutexPtr->~mutex();
            throwOriginal(env,"REFUSING_TO_RUN_ORIGINAL_INFERENCE_WITH_SYNTHETIC_STATE");
            return {};
        }
        // The genuine vendor scheduler executes up to the early-return boundary.
        const uint64_t nativeReturn=schedule(state,t.tail?1u:0u,0u);
        const auto originalStep=load32(state,0x68);
        const auto originalSamples=load64(state,0x50);
        const auto originalQueued=load64(state,0xd0);
        const bool passed=(nativeReturn==1u &&
                           originalStep==t.step &&
                           originalSamples==t.samples &&
                           originalQueued==t.nativeQueued);
        if(!passed)++guardFailures;
        mutexPtr->~mutex();
        if(idx)report<<",";
        report<<"{\"case\":\""<<t.name<<"\","
              <<"\"tail\":"<<(t.tail?"true":"false")<<","
              <<"\"input_samples\":"<<t.samples<<","
              <<"\"step_before\":"<<t.step<<","
              <<"\"step_after\":"<<originalStep<<","
              <<"\"frame_limit\":"<<t.frameLimit<<","
              <<"\"native_queued\":"<<t.nativeQueued<<","
              <<"\"threshold_reached\":"<<(ready?"true":"false")<<","
              <<"\"original_return\":"<<nativeReturn<<","
              <<"\"guard_pass\":"<<(passed?"true":"false")<<"}";
        __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_PCM",
            "ORIGINAL_SCHEDULER_GUARD name=%s actualOriginal=1 pass=%d return=%llu step=%d",
            t.name,passed?1:0,static_cast<unsigned long long>(nativeReturn),originalStep);
    }
    report<<"],\"scheduler_guard_failures\":"<<guardFailures
          <<",\"append_case_count\":"<<appendCases.size()
          <<",\"scheduler_guard_case_count\":"<<schedulerCases.size()
          <<",\"status\":\""<<((appendFailures+guardFailures)==0?"PASS":"FAIL")<<"\","
          <<"\"scope\":\"original vector-append and scheduler pre-inference guard branches only; no real engine or SDK parity\"}";
    return report.str();
}
} // namespace

extern "C" JNIEXPORT jstring JNICALL
Java_com_example_x2hello_MainActivity_originalPcmGuardOracle(JNIEnv* env,jobject) {
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_PCM",
                        "ORIGINAL_PCM_GUARD_ORACLE_ENTER");
    const auto result=runAll(env);
    if(env->ExceptionCheck())return nullptr;
    return env->NewStringUTF(result.c_str());
}
