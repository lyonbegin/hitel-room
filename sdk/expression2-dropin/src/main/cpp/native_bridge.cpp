#include <jni.h>
#include <vector>
#include <cstdint>
#include <limits>
#include "expression2_verified_core.h"
#include "expression2_stream_state.h"

// This bridge calls only the independently built, original-vector-verified C++
// routines. It never loads the proprietary libexpr2jni.so or vendor AAR.
extern "C" JNIEXPORT jfloatArray JNICALL
Java_ai_bithuman_expression2_Expression2Native_preprocess(
    JNIEnv* env, jobject, jfloatArray pcm) {
    if (!pcm || env->GetArrayLength(pcm) != EXPR2_PREPROCESS_IN_SAMPLES)
        return nullptr;
    std::vector<float> input(EXPR2_PREPROCESS_IN_SAMPLES);
    std::vector<float> output(EXPR2_PREPROCESS_OUT_SAMPLES);
    env->GetFloatArrayRegion(pcm, 0, static_cast<jsize>(input.size()), input.data());
    if (env->ExceptionCheck()) return nullptr;
    if (expression2_verified_preprocess(input.data(), input.size(),
                                        output.data(), output.size()) != 0)
        return nullptr;
    jfloatArray result = env->NewFloatArray(static_cast<jsize>(output.size()));
    if (result)
        env->SetFloatArrayRegion(result, 0, static_cast<jsize>(output.size()), output.data());
    return result;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_ai_bithuman_expression2_Expression2Native_canonHistory(
    JNIEnv* env, jobject, jbyteArray canon) {
    if (!canon || env->GetArrayLength(canon) != EXPR2_CANON_IN_BYTES)
        return nullptr;
    std::vector<uint8_t> input(EXPR2_CANON_IN_BYTES);
    std::vector<uint8_t> output(EXPR2_CANON_OUT_BYTES);
    env->GetByteArrayRegion(canon, 0, static_cast<jsize>(input.size()),
                            reinterpret_cast<jbyte*>(input.data()));
    if (env->ExceptionCheck()) return nullptr;
    if (expression2_verified_canon_history(input.data(), input.size(),
                                           output.data(), output.size()) != 0)
        return nullptr;
    jbyteArray result = env->NewByteArray(static_cast<jsize>(output.size()));
    if (result)
        env->SetByteArrayRegion(result, 0, static_cast<jsize>(output.size()),
                                reinterpret_cast<jbyte*>(output.data()));
    return result;
}
