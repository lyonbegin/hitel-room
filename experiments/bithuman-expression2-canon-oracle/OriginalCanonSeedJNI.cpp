// Expression2 canonical temporal-history expansion differential oracle.
// The actual reference is FUN_001a7db0 inside the UNMODIFIED ARM64 vendor
// libexpr2jni.so. We do not treat Ghidra pseudocode as literal C++ source.
// This function is a standalone native helper and does not use SDK auth.
#include <jni.h>
#include <dlfcn.h>
#include <android/log.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace {
constexpr size_t kCanonBytes = 16u*90u*52u*sizeof(float); // 299,520 bytes
constexpr size_t kOutputBytes = 16u*kCanonBytes; // 4,792,320 bytes
constexpr size_t kSliceBytes = 90u*52u*sizeof(float); // 18,720 bytes
constexpr uintptr_t kNativeFeedRVA = 0x001724d8;
constexpr uintptr_t kCanonReplicatorRVA = 0x001a7db0;
constexpr uint8_t kOriginalPrologue[16] = {
  0xff,0x83,0x02,0xd1, // sub sp,sp,#0xa0
  0xfd,0x7b,0x04,0xa9, // stp x29,x30,[sp,#0x40]
  0xfc,0x6f,0x05,0xa9, // stp x28,x27,[sp,#0x50]
  0xfa,0x67,0x06,0xa9  // stp x26,x25,[sp,#0x60]
};

void fail(JNIEnv* env,const char* message){
    __android_log_print(ANDROID_LOG_ERROR,"EXPR2_CANON_ORACLE","%s",message);
    jclass cls=env->FindClass("java/lang/IllegalStateException");
    if(cls)env->ThrowNew(cls,message);
}
uintptr_t resolveOriginal(JNIEnv* env){
    void *h=dlopen("libexpr2jni.so",RTLD_NOW|RTLD_NOLOAD);
    if(!h)h=dlopen("libexpr2jni.so",RTLD_NOW);
    if(!h){fail(env,"ORIGINAL_NATIVE_LIB_NOT_LOADED");return 0;}
    void *feed=dlsym(h,"Java_ai_bithuman_expression2_Native_feed");
    if(!feed){fail(env,"ORIGINAL_NATIVE_FEED_SYMBOL_NOT_FOUND");return 0;}
    uintptr_t base=reinterpret_cast<uintptr_t>(feed)-kNativeFeedRVA;
    uintptr_t fn=base+kCanonReplicatorRVA;
    if(memcmp(reinterpret_cast<const void*>(fn),kOriginalPrologue,sizeof(kOriginalPrologue))!=0){
        fail(env,"ORIGINAL_CANON_BINARY_MISMATCH");
        return 0;
    }
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_CANON_ORACLE",
        "ORIGINAL_CANON_ADDRESS_PASS native=%p rva=%lx",
        reinterpret_cast<void*>(fn),static_cast<unsigned long>(kCanonReplicatorRVA));
    return fn;
}
bool readCanon(JNIEnv* env,jbyteArray bytes,std::vector<uint8_t>& out){
    if(!bytes||static_cast<size_t>(env->GetArrayLength(bytes))!=kCanonBytes){
        fail(env,"CANON_INPUT_EXACT_BYTES_REQUIRED_299520");
        return false;
    }
    out.resize(kCanonBytes);
    env->GetByteArrayRegion(bytes,0,static_cast<jsize>(kCanonBytes),
                            reinterpret_cast<jbyte*>(out.data()));
    return !env->ExceptionCheck();
}
jbyteArray writeOutput(JNIEnv* env,const std::vector<uint8_t>& data){
    jbyteArray result=env->NewByteArray(static_cast<jsize>(kOutputBytes));
    if(result){
        env->SetByteArrayRegion(result,0,static_cast<jsize>(kOutputBytes),
                                reinterpret_cast<const jbyte*>(data.data()));
    }
    return result;
}
using OriginalCanonSeed=void(*)(const void*,void*);
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_example_x2hello_MainActivity_originalCanonSeed(
    JNIEnv* env,jobject,jbyteArray bytes){
    std::vector<uint8_t> src;
    if(!readCanon(env,bytes,src))return nullptr;
    uintptr_t fn=resolveOriginal(env);
    if(!fn||env->ExceptionCheck())return nullptr;
    std::vector<uint8_t> result(kOutputBytes,0xa5);
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_CANON_ORACLE",
        "ORIGINAL_CANON_CALL_BEGIN inputBytes=%zu outputBytes=%zu",
        kCanonBytes,kOutputBytes);
    reinterpret_cast<OriginalCanonSeed>(fn)(src.data(),result.data());
    __android_log_print(ANDROID_LOG_INFO,"EXPR2_CANON_ORACLE",
        "ORIGINAL_CANON_FUNCTION_INVOKED reference=unmodified-libexpr2jni-so");
    return writeOutput(env,result);
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_example_x2hello_MainActivity_candidateCanonSeed(
    JNIEnv* env,jobject,jbyteArray bytes){
    std::vector<uint8_t> src;
    if(!readCanon(env,bytes,src))return nullptr;
    std::vector<uint8_t> result(kOutputBytes,0xa5);
    // Source-derived: FUN_001a7db0 copies each of the 16 original
    // 90x52 Float32 slices into 16 adjacent temporal history slots.
    // Do not invent a canon buffer format beyond the original function.
    for(size_t slice=0;slice<16;++slice){
        const uint8_t *from=src.data()+slice*kSliceBytes;
        for(size_t history=0;history<16;++history){
            const size_t offset=(slice*16+history)*kSliceBytes;
            memcpy(result.data()+offset,from,kSliceBytes);
        }
    }
    return writeOutput(env,result);
}
