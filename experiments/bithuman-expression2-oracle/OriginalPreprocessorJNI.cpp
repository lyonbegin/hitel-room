// Expression2 0.6.2 A/B DSP oracle.
// REFERENCE path calls original, unmodified libexpr2jni.so machine instructions
// at verified RVA 0x001a9794 and checks their original ARM64 prologue.
// CANDIDATE path is visibly separate and must NEVER be reported as the original.
// Inputs and outputs are Float32; no auth/session/SDK rendering methods used.
#include <jni.h>
#include <dlfcn.h>
#include <link.h>
#include <android/log.h>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <limits>
#include <string>
#include <vector>
#include <algorithm>

namespace {
constexpr int kOriginalSamples=44000;
constexpr int kOutputSamples=35200;
constexpr uintptr_t kOriginalRVA=0x001a9794;
constexpr uint32_t kOriginalFirstInstruction=0xd10283ff; // sub sp,sp,#0xa0
void raise(JNIEnv *env,const std::string &message) {
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_ORIGINAL_ORACLE","%s",message.c_str());
    jclass type=env->FindClass("java/lang/IllegalStateException");
    env->ThrowNew(type,message.c_str());
}
using OriginalProc = void(*)(float, const float *, int, float *);
uintptr_t originalAddress(JNIEnv* env) {
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE","ORACLE_ENTER_ADDRESS_LOOKUP");
    // Use the *real published JNI export* as the unmodified ELF load-base anchor.
    // This avoids unreliable dl_iterate_phdr behavior under Android NativeBridge.
    void *handle=dlopen("libexpr2jni.so", RTLD_NOW|RTLD_NOLOAD);
    if(!handle) handle=dlopen("libexpr2jni.so",RTLD_NOW);
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE",
        "ORACLE_DLOPEN_RETURNED handle=%p",handle);
    if(!handle){
        const char *err=dlerror();
        raise(env,std::string("ORIGINAL_DLOPEN_FAILED: ")+(err?err:"unknown"));
        return 0;
    }
    void *feed=dlsym(handle,"Java_ai_bithuman_expression2_Native_feed");
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE",
        "ORACLE_ORIGINAL_FEED_EXPORT pointer=%p",feed);
    if(!feed){
        raise(env,"ORIGINAL_JNI_EXPORT_NOT_FOUND");
        return 0;
    }
    constexpr uintptr_t kKnownFeedRVA=0x001724d8;
    uintptr_t base=reinterpret_cast<uintptr_t>(feed)-kKnownFeedRVA;
    uintptr_t addr=base+kOriginalRVA;
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE",
        "ORACLE_ADDRESS_CANDIDATE base=%p target=%p",
        reinterpret_cast<void*>(base),reinterpret_cast<void*>(addr));
    uint32_t ins=0;
    memcpy(&ins,reinterpret_cast<const void*>(addr),sizeof(ins));
    if(ins!=kOriginalFirstInstruction){
        raise(env,"ORIGINAL_CODE_IDENTITY_MISMATCH: unexpected first ARM64 instruction");
        return 0;
    }
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE",
      "ORIGINAL_ADDRESS_PASS base=%p function=%p RVA=%lx instruction=%08x",
      reinterpret_cast<void*>(base),reinterpret_cast<void*>(addr),
      static_cast<unsigned long>(kOriginalRVA),ins);
    return addr;
}

std::vector<float> readInput(JNIEnv *env,jfloatArray arg) {
    if(!arg || env->GetArrayLength(arg)!=kOriginalSamples) {
        raise(env,"EXPECTED_EXACTLY_44000_FLOATS");
        return {};
    }
    std::vector<float> src(kOriginalSamples);
    env->GetFloatArrayRegion(arg,0,kOriginalSamples,src.data());
    return src;
}
jfloatArray toJava(JNIEnv *env,const std::vector<float>& output) {
    jfloatArray r=env->NewFloatArray(static_cast<jsize>(output.size()));
    if(r)env->SetFloatArrayRegion(r,0,static_cast<jsize>(output.size()),output.data());
    return r;
}
float quantized(float value) {
    // Candidate code separately reconstructed from observed ARM64 instructions.
    // Deliberately NOT assumed equivalent until numerical parity passes.
    double raw=std::trunc(static_cast<double>(value)*2147483648.0);
    raw=std::max(-2147483648.0,std::min(2147483647.0,raw));
    return static_cast<float>(std::floor((raw+64.0)/128.0));
}
std::vector<float> candidate(const std::vector<float>& source) {
    std::vector<float> q(kOriginalSamples);
    for (int i=0;i<kOriginalSamples;++i) q[i]=quantized(source[i]);
    constexpr int width=1120;
    constexpr int overlap=192;
    std::vector<float> out(kOutputSamples,0);
    int previousSelectedSourceStart=0;
    for(int block=0;block<(kOutputSamples+width-1)/width;++block){
        int start=block*width;
        int count=std::min(width,kOutputSamples-start);
        if(block==0){
            for(int j=0;j<count;++j)out[start+j]=q[j];
            continue;
        }
        // Original Ghidra source FUN_001a9794 scans offsets [-117,+117].
        // Crucial source-code fact: FUN_001a9794 uses the previously selected
        // source window plus 1120 as the overlap reference for this block.
        // It does NOT compare against the fixed output block start.
        const int sourceReference=previousSelectedSourceStart+width;
        int center=static_cast<int>(1.25f*static_cast<float>(start)+0.5f);
        float bestEnergy=std::numeric_limits<float>::infinity();
        int bestOffset=center;
        for(int offset=-117;offset<=117;++offset){
            int trial=center+offset;
            float cost=0.0f;
            for(int j=0;j<overlap;++j){
                float tgt=(sourceReference+j<kOriginalSamples)?q[sourceReference+j]:0.0f;
                float ref=(trial+j>=0 && trial+j<kOriginalSamples)?q[trial+j]:0.0f;
                float d=ref-tgt;
                cost+=d*d;
            }
            if(cost<bestEnergy){bestEnergy=cost;bestOffset=trial;}
        }
        for(int j=0;j<count;++j){
            float nxt=(bestOffset+j>=0 && bestOffset+j<kOriginalSamples)?q[bestOffset+j]:0.0f;
            if(j<overlap){
                float prev=(sourceReference+j<kOriginalSamples)?q[sourceReference+j]:0.0f;
                const float a=static_cast<float>(j)/192.0f;
                out[start+j]=prev*(1.0f-a)+nxt*a;
            }else{
                out[start+j]=nxt;
            }
        }
        previousSelectedSourceStart=bestOffset;
    }
    for(float &v:out){
        double rounded=std::floor(static_cast<double>(v)+0.5);
        rounded=std::max(-2147483648.0,std::min(2147483647.0,rounded*128.0));
        v=static_cast<float>(rounded * 4.656612873077393e-10);
    }
    return out;
}
}
extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_example_x2hello_MainActivity_originalPreprocess(JNIEnv* env,jobject,jfloatArray input){
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE","ORACLE_JNI_ENTER_ORIGINAL");
    auto src=readInput(env,input);
    if(env->ExceptionCheck())return nullptr;
    uintptr_t address=originalAddress(env);
    if(env->ExceptionCheck() || !address)return nullptr;
    std::vector<float> output(kOutputSamples,std::numeric_limits<float>::quiet_NaN());
    OriginalProc proc=reinterpret_cast<OriginalProc>(address);
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE","ORACLE_ENTER_ORIGINAL_FUNCTION");
    proc(1.25f,src.data(),kOriginalSamples,output.data());
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE","ORACLE_RETURN_ORIGINAL_FUNCTION");
    for(float f:output){
        if(!std::isfinite(f)) {
            raise(env,"ORIGINAL_RETURNED_NAN_OR_INF");
            return nullptr;
        }
    }
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_ORIGINAL_ORACLE",
        "ORIGINAL_FUNCTION_INVOKED 44000_to_35200 scale=1.25 source=libexpr2jni");
    return toJava(env,output);
}
extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_example_x2hello_MainActivity_candidatePreprocess(JNIEnv* env,jobject,jfloatArray input){
    auto src=readInput(env,input);
    if(env->ExceptionCheck())return nullptr;
    return toJava(env,candidate(src));
}
