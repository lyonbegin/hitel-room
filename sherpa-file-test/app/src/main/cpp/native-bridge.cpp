// Minimal JNI adapter; upstream sherpa-onnx-ffmpeg.c is byte-for-byte unchanged.
#include <jni.h>
#include <unistd.h>
#include <stdio.h>
#include <thread>
#define main sherpa_upstream_main
#include "sherpa-onnx-ffmpeg.c"
#undef main
extern "C" JNIEXPORT jint JNICALL Java_app_hitel_sherpafiletest_MainActivity_nativeOriginal(
 JNIEnv* env,jobject instance,jstring tok,jstring enc,jstring dec,jstring join,jstring path){
 const char* v[5]={
  env->GetStringUTFChars(tok,nullptr),env->GetStringUTFChars(enc,nullptr),
  env->GetStringUTFChars(dec,nullptr),env->GetStringUTFChars(join,nullptr),
  env->GetStringUTFChars(path,nullptr)
 };
 char* args[]={
  const_cast<char*>("sherpa-onnx-ffmpeg"),
  const_cast<char*>(v[0]),const_cast<char*>(v[1]),const_cast<char*>(v[2]),
  const_cast<char*>(v[3]),const_cast<char*>(v[4])
 };
 int pipes[2];if(pipe(pipes)!=0)return -101;
 int saved=dup(STDERR_FILENO);
 if(saved<0){close(pipes[0]);close(pipes[1]);return -102;}
 fflush(stderr);
 dup2(pipes[1],STDERR_FILENO);
 close(pipes[1]);
 JavaVM* vm=nullptr;env->GetJavaVM(&vm);
 jobject callback=env->NewGlobalRef(instance);
 std::thread reader([vm,callback,in=pipes[0]](){
   JNIEnv* e=nullptr;
   if(vm->AttachCurrentThread(&e,nullptr)!=JNI_OK){close(in);return;}
   jclass cls=e->GetObjectClass(callback);
   jmethodID cb=e->GetMethodID(cls,"onNativeBytes","([B)V");
   char buf[4096];
   while(true){
     ssize_t n=read(in,buf,sizeof(buf));if(n<=0)break;
     if(cb){
       jbyteArray bytes=e->NewByteArray((jsize)n);
       e->SetByteArrayRegion(bytes,0,(jsize)n,(const jbyte*)buf);
       e->CallVoidMethod(callback,cb,bytes);e->DeleteLocalRef(bytes);
       if(e->ExceptionCheck()){e->ExceptionClear();break;}
     }
   }
   e->DeleteLocalRef(cls);e->DeleteGlobalRef(callback);close(in);vm->DetachCurrentThread();
 });
 const int rc=sherpa_upstream_main(6,args); // no custom STT loop
 fflush(stderr);dup2(saved,STDERR_FILENO);close(saved);reader.join();
 env->ReleaseStringUTFChars(tok,v[0]);env->ReleaseStringUTFChars(enc,v[1]);
 env->ReleaseStringUTFChars(dec,v[2]);env->ReleaseStringUTFChars(join,v[3]);
 env->ReleaseStringUTFChars(path,v[4]);
 return rc;
}
