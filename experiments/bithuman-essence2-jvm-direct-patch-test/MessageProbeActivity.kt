package com.example.e2hello

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.TextView

/**
 * Real Android ART bytecode execution proof for the original vendor class.
 * No credential is supplied, no metering/auth checks are altered or bypassed.
 * No model inference is attempted. Both actual original ELF engine DSOs are
 * loaded if Android runtime supports the host's ARM64 native bridge.
 */
class MainActivity : Activity() {
    private val tag = "ESSENCE2_ORIGINAL_PROBE"
    private fun mark(text: String) { Log.i(tag,text) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply { text="Essence2 original JVM constant patch runtime test" })
        Thread {
            try {
                mark("ESSENCE2_PROBE_START abis="+android.os.Build.SUPPORTED_ABIS.joinToString())
                // Reflection avoids relying on Kotlin 'internal' visibility
                // from a separate app module. Invokes the REAL SDK class.
                val klass=Class.forName("ai.bithuman.elevate.BithumanCodes")
                val instance=klass.getField("INSTANCE").get(null)
                val originalRecord=klass.getMethod("getMETERING_NO_CREDENTIAL").invoke(instance)
                val recordClass=originalRecord.javaClass
                val code=recordClass.getMethod("getCode").invoke(originalRecord) as String
                val refuses=recordClass.getMethod("getRefuses").invoke(originalRecord) as Boolean
                val message=recordClass.getMethod("getMessage").invoke(originalRecord) as String
                mark("ESSENCE2_METERING_CODE="+code)
                mark("ESSENCE2_METERING_REFUSES="+refuses)
                mark("ESSENCE2_METERING_MESSAGE="+message)
                if (code!="metering_no_credential"
                    || !refuses
                    || message!="HITEL_ESSENCE2_JVM_TEXT_PATCH_OK_20261115: a valid API secret is required.") {
                    mark("ESSENCE2_JVM_ORIGINAL_CODE_MUTATED_OR_MARKER_NOT_PRESENT")
                } else {
                    mark("ESSENCE2_JVM_PATCHED_CONSTANT_REAL_ART_RUNTIME_PASS")
                }
                for (name in arrayOf("le_jni","e2u_jni")) {
                    try {
                        System.loadLibrary(name)
                        mark("ESSENCE2_ORIGINAL_NATIVE_LOAD_PASS="+name)
                    } catch (err: Throwable) {
                        mark("ESSENCE2_ORIGINAL_NATIVE_LOAD_FAIL="+name+" "+err.javaClass.name+" "+err.message)
                    }
                }
            } catch (err: Throwable) {
                mark("ESSENCE2_ORIGINAL_PROBE_FAIL "+err.javaClass.name+" "+err.message)
                Log.e(tag,"Actual JVM bytecode regression failure",err)
            } finally {
                mark("ESSENCE2_PROBE_END")
            }
        }.start()
    }
}
