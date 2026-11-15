package com.example.e2hello

import ai.bithuman.elevate.BithumanCodes
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
                val originalRecord = BithumanCodes.METERING_NO_CREDENTIAL
                mark("ESSENCE2_METERING_CODE="+originalRecord.code)
                mark("ESSENCE2_METERING_REFUSES="+originalRecord.refuses)
                mark("ESSENCE2_METERING_MESSAGE="+originalRecord.message)
                if (originalRecord.code!="metering_no_credential"
                    || !originalRecord.refuses
                    || originalRecord.message!="HITEL_ESSENCE2_JVM_TEXT_PATCH_OK_20261115: a valid API secret is required.") {
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
