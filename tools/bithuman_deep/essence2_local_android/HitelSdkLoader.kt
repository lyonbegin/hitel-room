package ai.bithuman.flutter

import android.app.Application
import android.os.Process
import android.util.Log

/**
 * BASELINE: untouched vendor ELF, SDK chooses its own GPU/CPU paths.
 * GPU3: the EXACT SAME untouched vendor ELF, with a per-process OpenCL
 * dispatcher installed prior to nativeCreate. Stage 1 original GPU, stage 2
 * compatible small-workgroup GPU on -54, stage 3 original vendor CPU fallback.
 * No JNI/native model/PCM/player/render code is replaced.
 */
object HitelSdkLoader {
    @JvmStatic fun route(): String {
        val name = Application.getProcessName()
        return when {
            name.endsWith(":hitel_original") -> "BASELINE"
            name.endsWith(":hitel_gpu3") -> "GPU3"
            else -> throw IllegalStateException("SDK requested outside isolated Android SDK process: " + name)
        }
    }
    @JvmStatic fun libraryForProcess(): String {
        val current = route()
        if (current == "GPU3") {
            System.loadLibrary("le_jni")
            HitelSdkProbe.afterNativeLoad()
        }
        // Both process routes return the ORIGINAL library name.
        // NativeBridge's existing System.loadLibrary handles BASELINE as before.
        Log.i("HITEL_SDK_AB", "sdk.loader route=" + current +
            " so=le_jni originalVendorNative=true pid=" + Process.myPid())
        return "le_jni"
    }
}
