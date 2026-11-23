#include "hitel_native_stt.hpp"
#include "sherpa_backend.hpp"
#include <jni.h>

#include <cstdint>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
void ThrowJava(JNIEnv *env, const char *kind, const std::string &message) {
  if (env->ExceptionCheck()) return;
  jclass cls = env->FindClass(kind);
  if (cls) env->ThrowNew(cls, message.c_str());
}

struct Session {
  JavaVM *vm = nullptr;
  jobject observer = nullptr;
  jmethodID caption_method = nullptr, trace_method = nullptr;
  std::mutex mutex;
  std::unique_ptr<hitel::NativeSttEngine> engine;

  JNIEnv *GetEnv(bool *attached) {
    *attached = false;
    JNIEnv *env = nullptr;
    if (vm->GetEnv(reinterpret_cast<void **>(&env), JNI_VERSION_1_6) == JNI_OK)
      return env;
    if (vm->AttachCurrentThread(reinterpret_cast<void **>(&env), nullptr) != JNI_OK)
      throw std::runtime_error("Cannot attach JNI STT callback thread");
    *attached = true;
    return env;
  }
  void Caption(const hitel::CaptionEvent &event) {
    bool attached = false;
    JNIEnv *env = GetEnv(&attached);
    jstring text = env->NewStringUTF(event.text.c_str());
    if (text) {
      env->CallVoidMethod(observer, caption_method, text,
                          static_cast<jboolean>(event.is_final),
                          static_cast<jlong>(event.audio_samples),
                          static_cast<jlong>(event.revision),
                          static_cast<jlong>(event.emit_ns));
      env->DeleteLocalRef(text);
    }
    if (env->ExceptionCheck()) { env->ExceptionDescribe(); env->ExceptionClear(); } // Never poison PCM worker
    if (attached) vm->DetachCurrentThread();
  }
  void Trace(const hitel::TraceEvent &event) {
    bool attached = false;
    JNIEnv *env = GetEnv(&attached);
    jstring phase = env->NewStringUTF(event.phase);
    if (phase) {
      env->CallVoidMethod(observer, trace_method, phase,
                          static_cast<jlong>(event.samples),
                          static_cast<jlong>(event.decode_step),
                          static_cast<jlong>(event.elapsed_us),
                          static_cast<jboolean>(event.text_changed));
      env->DeleteLocalRef(phase);
    }
    if (env->ExceptionCheck()) { env->ExceptionDescribe(); env->ExceptionClear(); }
    if (attached) vm->DetachCurrentThread();
  }
};
using SessionPtr = std::unique_ptr<Session>;
Session *AsSession(jlong handle) {
  return reinterpret_cast<Session *>(static_cast<std::uintptr_t>(handle));
}
} // namespace

extern "C" {
JNIEXPORT jlong JNICALL
Java_app_hitel_speakeronly_NativeSttBridge_nativeOpen(
    JNIEnv *env, jobject self, jstring model_directory) {
  if (!model_directory) {
    ThrowJava(env, "java/lang/IllegalArgumentException", "Missing IXIO model directory");
    return 0;
  }
  const char *utf8 = env->GetStringUTFChars(model_directory, nullptr);
  if (!utf8) return 0;
  std::string path(utf8);
  env->ReleaseStringUTFChars(model_directory, utf8);
  SessionPtr s(new Session);
  try {
    if (env->GetJavaVM(&s->vm) != JNI_OK)
      throw std::runtime_error("JavaVM not available");
    s->observer = env->NewGlobalRef(self);
    if (!s->observer) throw std::runtime_error("STT callback reference missing");
    jclass cls = env->GetObjectClass(self);
    if (!cls) throw std::runtime_error("STT callback class unavailable");
    s->caption_method = env->GetMethodID(
        cls, "onNativeCaption", "(Ljava/lang/String;ZJJJ)V");
    s->trace_method = env->GetMethodID(
        cls, "onNativeTrace", "(Ljava/lang/String;JJJZ)V");
    env->DeleteLocalRef(cls);
    if (!s->caption_method || !s->trace_method)
      throw std::runtime_error("Native STT observer methods unavailable");
    Session *raw = s.get();
    s->engine = std::make_unique<hitel::NativeSttEngine>(
        hitel::CreateSherpaBackend(path),
        [raw](const hitel::CaptionEvent &e) { raw->Caption(e); },
        [raw](const hitel::TraceEvent &e) { raw->Trace(e); });
    return static_cast<jlong>(reinterpret_cast<std::uintptr_t>(s.release()));
  } catch (const std::exception &e) {
    if (s->observer) env->DeleteGlobalRef(s->observer);
    ThrowJava(env, "java/lang/IllegalStateException", e.what());
    return 0;
  }
}

JNIEXPORT void JNICALL
Java_app_hitel_speakeronly_NativeSttBridge_nativeAccept(
    JNIEnv *env, jobject, jlong handle, jbyteArray bytes) {
  auto *s = AsSession(handle);
  if (!s || !bytes) {
    ThrowJava(env, "java/lang/IllegalArgumentException", "Missing native session or PCM");
    return;
  }
  const jsize n = env->GetArrayLength(bytes);
  std::vector<std::uint8_t> pcm(static_cast<std::size_t>(n));
  if (n) env->GetByteArrayRegion(bytes, 0, n,
                                reinterpret_cast<jbyte *>(pcm.data()));
  if (env->ExceptionCheck()) return;
  try {
    std::lock_guard<std::mutex> lock(s->mutex);
    s->engine->AcceptPcm16Le(pcm.data(), pcm.size());
  } catch (const std::exception &e) {
    ThrowJava(env, "java/lang/IllegalStateException", e.what());
  }
}
JNIEXPORT void JNICALL
Java_app_hitel_speakeronly_NativeSttBridge_nativeFinish(
    JNIEnv *env, jobject, jlong handle) {
  auto *s = AsSession(handle);
  if (!s) return;
  try {
    std::lock_guard<std::mutex> lock(s->mutex);
    s->engine->Finish();
  } catch (const std::exception &e) {
    ThrowJava(env, "java/lang/IllegalStateException", e.what());
  }
}
JNIEXPORT void JNICALL
Java_app_hitel_speakeronly_NativeSttBridge_nativeClose(
    JNIEnv *env, jobject, jlong handle) {
  auto *s = AsSession(handle);
  if (!s) return;
  // Contract: stop the STT worker and finish before Close. No concurrent calls.
  if (s->observer) env->DeleteGlobalRef(s->observer);
  delete s;
}
} // extern "C"
