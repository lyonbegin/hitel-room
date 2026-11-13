// JNI bridge from independently owned PCM chunks to source-verified DSP output.
// The Kotlin LiteRT renderer is a separate component; no vendor SDK is loaded.
#include "../include/expression2_stream_state.h"
#include "../include/expression2_verified_core.h"
#include <jni.h>
#include <vector>
#include <cstring>

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_example_x2hello_MainActivity_verifiedNativeStreamPreprocess(
    JNIEnv* env, jobject, jbyteArray canon_bytes, jfloatArray pcm) {
  if (!canon_bytes || !pcm ||
      env->GetArrayLength(canon_bytes)!=EXPR2_CANON_IN_BYTES ||
      env->GetArrayLength(pcm)!=EXPR2_PREPROCESS_IN_SAMPLES)
    return nullptr;
  try {
    std::vector<uint8_t> canon(EXPR2_CANON_IN_BYTES);
    std::vector<float> source(EXPR2_PREPROCESS_IN_SAMPLES);
    std::vector<float> output(EXPR2_PREPROCESS_OUT_SAMPLES);
    env->GetByteArrayRegion(canon_bytes,0,static_cast<jsize>(canon.size()),
        reinterpret_cast<jbyte*>(canon.data()));
    if(env->ExceptionCheck())return nullptr;
    env->GetFloatArrayRegion(pcm,0,static_cast<jsize>(source.size()),source.data());
    if(env->ExceptionCheck())return nullptr;
    Expr2StreamState* stream=expression2_stream_create(canon.data(),canon.size());
    if(!stream)return nullptr;
    const size_t chunks[]={8000u,17600u,18400u};
    size_t offset=0;
    int result=EXPR2_STREAM_OK;
    for(const auto count:chunks){
      result=expression2_stream_feed(stream,source.data()+offset,count);
      offset+=count;
      if(result!=EXPR2_STREAM_OK)break;
    }
    Expr2StreamSnapshot snap{};
    if(result==EXPR2_STREAM_OK)result=expression2_stream_snapshot(stream,&snap);
    if(result==EXPR2_STREAM_OK &&
        (snap.pcm_samples!=source.size() || !snap.canon_history_initialized))
      result=EXPR2_STREAM_INVALID_STATE;
    if(result==EXPR2_STREAM_OK)
      result=expression2_stream_preprocess_first_window(stream,output.data(),output.size());
    expression2_stream_destroy(stream);
    if(result!=EXPR2_STREAM_OK)return nullptr;
    jfloatArray array=env->NewFloatArray(static_cast<jsize>(output.size()));
    if(array)env->SetFloatArrayRegion(array,0,static_cast<jsize>(output.size()),output.data());
    return array;
  }catch(...){return nullptr;}
}
