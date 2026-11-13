package com.example.x2hello

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

/**
 * Runs only our independently compiled source-derived libexpression2_verified_core.so.
 * Original vendor code is ABSENT from this APK.
 * Inputs and expected outputs were captured using the real unmodified original
 * ARM64 function reference oracle in separate earlier GitHub Actions jobs.
 */
class MainActivity : Activity() {
    private val tag="EXPR2_VENDOR_FREE"
    private lateinit var display:TextView
    private external fun verifiedPreprocess(input:FloatArray):FloatArray
    private external fun verifiedCanonHistory(canon:ByteArray):ByteArray

    private fun emit(message:String){
        Log.i(tag,message)
        runOnUiThread {display.append(message+"\n")}
    }
    override fun onCreate(savedInstanceState: Bundle?){
        super.onCreate(savedInstanceState)
        display=TextView(this).apply{
            textSize=12f
            setPadding(24,24,24,24)
            text="Expression2 independently compiled functions / original output vectors\n"
        }
        setContentView(ScrollView(this).apply{addView(this@MainActivity.display)})
        Thread{
            try{
                // Original libexpr2jni.so is deliberately not packaged or loaded.
                System.loadLibrary("expression2_verified_core")
                emit("VENDOR_FREE_LIBRARY_LOADED no_original_sdk=true")
                perform()
            }catch(t:Throwable){
                emit("VENDOR_FREE_VERIFICATION_FAILURE "+t.javaClass.simpleName+": "+t.message)
                Log.e(tag,"Stand-alone source function test failed",t)
            }
        }.start()
    }
    private fun asset(name:String)=assets.open(name).use{it.readBytes()}
    private fun hash(data:ByteArray):String=
        MessageDigest.getInstance("SHA-256").digest(data).joinToString(""){"%02x".format(it.toInt() and 255)}
    private fun f32(bytes:ByteArray):FloatArray{
        require(bytes.size%4==0)
        val b=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        return FloatArray(bytes.size/4){b.float}
    }
    private fun toBytes(data:FloatArray):ByteArray{
        val b=ByteBuffer.allocate(data.size*4).order(ByteOrder.LITTLE_ENDIAN)
        for(x in data)b.putFloat(x)
        return b.array()
    }
    private fun perform(){
        val cases=JSONArray()
        var all=true
        for(name in arrayOf("silence","impulse","sine","fixed_noise","spoken_tts")){
            val inFile=asset("dsp_"+name+"_input.f32")
            val ref=asset("dsp_"+name+"_original.f32")
            require(inFile.size==44000*4 && ref.size==35200*4)
            val t=System.nanoTime()
            val got=verifiedPreprocess(f32(inFile))
            val ms=(System.nanoTime()-t)/1.0e6
            val gotBytes=toBytes(got)
            val same=ref.contentEquals(gotBytes)
            var mismatches=0
            var first=-1
            for(i in ref.indices){
                if(ref[i]!=gotBytes[i]){mismatches++;if(first<0)first=i}
            }
            val record=JSONObject()
                .put("case","dsp_"+name)
                .put("original_reference_sha256",hash(ref))
                .put("standalone_sha256",hash(gotBytes))
                .put("input_sha256",hash(inFile))
                .put("bytes_compared",ref.size)
                .put("mismatch_bytes",mismatches)
                .put("first_mismatch_byte",first)
                .put("bit_exact",same)
                .put("duration_ms",ms)
            cases.put(record);all=all&&same
            emit("VENDOR_FREE_DSP_CASE "+name+" exact="+(ref.size-mismatches)+"/"+ref.size+
                " referenceSha="+hash(ref)+" bitExact="+same)
        }
        val source=asset("wise_pup_canon_input.bin")
        val reference=asset("wise_pup_canon_original_history.bin")
        require(source.size==299520 && reference.size==4792320)
        require(hash(source)=="cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5")
        val t=System.nanoTime()
        val output=verifiedCanonHistory(source)
        val durationMs=(System.nanoTime()-t)/1.0e6
        var mismatch=0
        var first=-1
        for(i in reference.indices){
            if(reference[i]!=output[i]){mismatch++;if(first<0)first=i}
        }
        val canonExact=mismatch==0
        all=all&&canonExact
        cases.put(JSONObject()
            .put("case","canon_wise_pup")
            .put("source_canon_sha256",hash(source))
            .put("original_reference_sha256",hash(reference))
            .put("standalone_sha256",hash(output))
            .put("bytes_compared",reference.size)
            .put("mismatch_bytes",mismatch)
            .put("first_mismatch_byte",first)
            .put("bit_exact",canonExact)
            .put("duration_ms",durationMs))
        emit("VENDOR_FREE_CANON_CASE exact="+(reference.size-mismatch)+"/"+reference.size+
            " referenceSha="+hash(reference)+" bitExact="+canonExact)
        val report=JSONObject()
            .put("sdk_reimplemented_functions",JSONArray().put("FUN_001a9794").put("FUN_001a7db0"))
            .put("verified_without_vendor_binary",true)
            .put("reference_origin","Original unmodified ARM64 functions executed in previous GitHub Actions")
            .put("full_sdk_parity_claimed",false)
            .put("all_cases_bit_exact",all)
            .put("cases",cases)
        File(filesDir,"vendor_free_verified_core_report.json").writeText(report.toString(2))
        emit("EXPR2_VENDOR_FREE_ALL_REFERENCE_VECTORS "+(if(all)"PASS" else "FAIL")+
             " count="+cases.length())
    }
}
