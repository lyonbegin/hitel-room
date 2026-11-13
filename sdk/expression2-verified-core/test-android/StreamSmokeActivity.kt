package com.example.x2hello

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.TextView

/** Standalone vendor-free native pre-inference smoke test; NOT model inference. */
class MainActivity : Activity() {
    private external fun verifiedStreamStateSmoke(): String
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val status = TextView(this).apply { text = "Expression2 native pre-inference check" }
        setContentView(status)
        Thread {
            try {
                System.loadLibrary("expression2_verified_core")
                val result = verifiedStreamStateSmoke()
                Log.i("EXPR2_STREAM_SMOKE", result)
                runOnUiThread { status.text = result }
            } catch (t: Throwable) {
                Log.e("EXPR2_STREAM_SMOKE", "NATIVE_SMOKE_FAILURE", t)
                runOnUiThread { status.text = "FAIL: " + t.message }
            }
        }.start()
    }
}
