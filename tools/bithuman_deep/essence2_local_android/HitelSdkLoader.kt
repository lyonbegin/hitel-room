package ai.bithuman.flutter

import android.app.Application
import android.os.Process
import android.util.Log

/** Used by the ORIGINAL SDK's patched NativeBridge.<clinit> before JNI symbols resolve.
 * Each choice lives in a distinct Android process so both native versions
 * register the same JNI API against independent Java virtual machines.
 */
object HitelSdkLoader {
    @JvmStatic fun route(): String {
        val p=Application.getProcessName()
        return when {
            p.endsWith(":hitel_original") -> "BASELINE"
            p.endsWith(":hitel_wg128") -> "WG128"
            else -> throw IllegalStateException("SDK requested outside isolated Android SDK process: "+p)
        }
    }
    @JvmStatic fun libraryForProcess(): String {
        val lib = if (route()=="WG128") "le_jni_wg128" else "le_jni"
        Log.i("HITEL_SDK_AB", "sdk.loader route="+route()+" so="+lib+" pid="+Process.myPid())
        return lib
    }
}
