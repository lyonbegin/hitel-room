// Expression2 native core: ONLY behavior already proven against the exact
// unmodified original SDK's ARM64 instructions with matching input/output.
// No original bitHuman .so, AAR, model runtime, authentication or session.
// C++ is reconstructed based on reverse engineering; NOT vendor source text.
#include "../include/expression2_verified_core.h"
#include <jni.h>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <algorithm>
#include <limits>
#include <vector>

namespace {
constexpr int kOriginalSamples=EXPR2_PREPROCESS_IN_SAMPLES;
constexpr int kOutputSamples=EXPR2_PREPROCESS_OUT_SAMPLES;

float quantized(float value) {
    // Function body is copied from the candidate proven bit-identical to the
    // unmodified original ARM64 FUN_001a9794 (5 vectors x 35,200 samples).
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
                const float a=static_cast<float>(j)*0.0052083335f; // match original NEON coefficient generation
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
} // anonymous namespace

extern "C" int expression2_verified_preprocess(
    const float* input,size_t input_samples,float* output,size_t output_samples){
    if(!input || !output || input_samples!=EXPR2_PREPROCESS_IN_SAMPLES ||
       output_samples!=EXPR2_PREPROCESS_OUT_SAMPLES)return -1;
    std::vector<float> source(input,input+input_samples);
    const std::vector<float> result=candidate(source);
    if(result.size()!=output_samples)return -1;
    std::memcpy(output,result.data(),output_samples*sizeof(float));
    return 0;
}

extern "C" int expression2_verified_canon_history(
    const void* canon,size_t canon_bytes,void* history,size_t history_bytes){
    if(!canon || !history || canon_bytes!=EXPR2_CANON_IN_BYTES ||
       history_bytes!=EXPR2_CANON_OUT_BYTES)return -1;
    const auto* input=static_cast<const uint8_t*>(canon);
    auto* output=static_cast<uint8_t*>(history);
    constexpr size_t slice=90u*52u*sizeof(float);
    // Recovered FUN_001a7db0: 16 input slices, each copied 16 times.
    // Verified against unmodified ARM64 on four 4,792,320-byte vectors.
    for(size_t s=0;s<16;++s){
        const uint8_t* original_slice=input+s*slice;
        for(size_t h=0;h<16;++h){
            std::memcpy(output+(s*16+h)*slice,original_slice,slice);
        }
    }
    return 0;
}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_example_x2hello_MainActivity_verifiedPreprocess(
    JNIEnv* env,jobject,jfloatArray input){
    if(!input || env->GetArrayLength(input)!=EXPR2_PREPROCESS_IN_SAMPLES)
        return nullptr;
    std::vector<float> source(EXPR2_PREPROCESS_IN_SAMPLES);
    std::vector<float> result(EXPR2_PREPROCESS_OUT_SAMPLES);
    env->GetFloatArrayRegion(input,0,EXPR2_PREPROCESS_IN_SAMPLES,source.data());
    if(env->ExceptionCheck())return nullptr;
    if(expression2_verified_preprocess(source.data(),source.size(),
                                        result.data(),result.size())!=0)return nullptr;
    jfloatArray output=env->NewFloatArray(EXPR2_PREPROCESS_OUT_SAMPLES);
    if(output)env->SetFloatArrayRegion(output,0,EXPR2_PREPROCESS_OUT_SAMPLES,result.data());
    return output;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_example_x2hello_MainActivity_verifiedCanonHistory(
    JNIEnv* env,jobject,jbyteArray input){
    if(!input || env->GetArrayLength(input)!=EXPR2_CANON_IN_BYTES)
        return nullptr;
    std::vector<uint8_t> canon(EXPR2_CANON_IN_BYTES),result(EXPR2_CANON_OUT_BYTES);
    env->GetByteArrayRegion(input,0,EXPR2_CANON_IN_BYTES,
                            reinterpret_cast<jbyte*>(canon.data()));
    if(env->ExceptionCheck())return nullptr;
    if(expression2_verified_canon_history(canon.data(),canon.size(),
                                           result.data(),result.size())!=0)return nullptr;
    jbyteArray output=env->NewByteArray(EXPR2_CANON_OUT_BYTES);
    if(output)env->SetByteArrayRegion(output,0,EXPR2_CANON_OUT_BYTES,
                                      reinterpret_cast<jbyte*>(result.data()));
    return output;
}
