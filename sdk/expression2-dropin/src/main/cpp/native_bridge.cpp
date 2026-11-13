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


// Original-source-derived PCM state is now a REAL part of the independent SDK
// pipeline rather than compiled unused code. No proprietary binary is loaded.
namespace {
Expr2StreamState* state(jlong handle) {
    return reinterpret_cast<Expr2StreamState*>(static_cast<uintptr_t>(handle));
}
}
extern "C" JNIEXPORT jlong JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamCreate(
    JNIEnv* env, jobject, jbyteArray canon) {
    if (!canon || env->GetArrayLength(canon) != EXPR2_CANON_IN_BYTES) return 0;
    std::vector<uint8_t> input(EXPR2_CANON_IN_BYTES);
    env->GetByteArrayRegion(canon, 0, static_cast<jsize>(input.size()),
                            reinterpret_cast<jbyte*>(input.data()));
    if (env->ExceptionCheck()) return 0;
    return static_cast<jlong>(reinterpret_cast<uintptr_t>(
        expression2_stream_create(input.data(),input.size())));
}
extern "C" JNIEXPORT jint JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamFeed(
    JNIEnv* env, jobject, jlong handle, jfloatArray chunk) {
    if (!state(handle) || !chunk) return EXPR2_STREAM_INVALID_ARGUMENT;
    const size_t count=static_cast<size_t>(env->GetArrayLength(chunk));
    std::vector<float> input(count);
    if (count)env->GetFloatArrayRegion(chunk,0,static_cast<jsize>(count),input.data());
    if (env->ExceptionCheck()) return EXPR2_STREAM_INVALID_ARGUMENT;
    float dummy=0.f;
    return expression2_stream_feed(state(handle),count?input.data():&dummy,count);
}
extern "C" JNIEXPORT jint JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamEnd(
    JNIEnv*, jobject, jlong handle) {
    return expression2_stream_end_segment(state(handle),0);
}
extern "C" JNIEXPORT jfloatArray JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamNextWindow(
    JNIEnv* env, jobject, jlong handle) {
    std::vector<float> window(EXPR2_PREPROCESS_IN_SAMPLES);
    const int result=expression2_stream_next_window(state(handle),
                                                     window.data(),window.size());
    if(result==EXPR2_STREAM_NOT_READY) return nullptr;
    if(result!=EXPR2_STREAM_OK) {
        jclass error=env->FindClass("java/lang/IllegalStateException");
        if(error)env->ThrowNew(error,"Independent native PCM source-window error");
        return nullptr;
    }
    auto output=env->NewFloatArray(static_cast<jsize>(window.size()));
    if(output)env->SetFloatArrayRegion(output,0,static_cast<jsize>(window.size()),
                                       window.data());
    return output;
}
extern "C" JNIEXPORT jint JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamFinishWindow(
    JNIEnv*, jobject, jlong handle) {
    return expression2_stream_finish_window(state(handle));
}
extern "C" JNIEXPORT jlongArray JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamSnapshot(
    JNIEnv* env, jobject, jlong handle) {
    Expr2StreamSnapshot s{};
    if(expression2_stream_snapshot(state(handle),&s)!=EXPR2_STREAM_OK)return nullptr;
    const jlong values[] = {
        static_cast<jlong>(s.pcm_samples),
        static_cast<jlong>(s.pcm_capacity_samples),
        static_cast<jlong>(s.total_input_samples),
        static_cast<jlong>(s.scheduled_samples),
        static_cast<jlong>(s.step),
        static_cast<jlong>(s.queued_native_frames),
        static_cast<jlong>(s.segment_open),
        static_cast<jlong>(s.tail_pending)
    };
    auto result=env->NewLongArray(8);
    if(result)env->SetLongArrayRegion(result,0,8,values);
    return result;
}
extern "C" JNIEXPORT void JNICALL
Java_ai_bithuman_expression2_Expression2Native_streamDestroy(
    JNIEnv*, jobject, jlong handle) {
    expression2_stream_destroy(state(handle));
}
