package com.example.x2hello

import android.app.Activity
import android.os.Bundle
import android.util.Log
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/**
 * Differential execution against original unchanged ARM64
 * FUN_001a7db0, using original Wise Pup canon.bin payload.
 * Helper-function equivalence does NOT establish full SDK equivalence.
 */
class MainActivity : Activity() {
    private val tag = "EXPR2_CANON_ORACLE"
    private lateinit var label: TextView
    private external fun originalCanonSeed(input: ByteArray): ByteArray
    private external fun candidateCanonSeed(input: ByteArray): ByteArray
    private val canonSize = 299520
    private val historySize = 4792320
    private val sliceBytes = 18720

    private fun emit(message:String){
        Log.i(tag,message)
        runOnUiThread { label.append(message+"\n") }
    }
    override fun onCreate(savedInstanceState: Bundle?){
        super.onCreate(savedInstanceState)
        label = TextView(this).apply {
            textSize=12f
            setPadding(24,24,24,24)
            text="Expression2 original Wise Pup temporal-history canon oracle\n"
        }
        setContentView(ScrollView(this).apply { addView(label) })
        Thread{
            try{
                System.loadLibrary("LiteRt")
                System.loadLibrary("expr2jni")
                System.loadLibrary("expression2_canon_oracle")
                emit("CANON_ORIGINAL_SDK_LOADED")
                verify()
            }catch(e:Throwable){
                emit("CANON_ORACLE_FAILURE " + e.javaClass.simpleName + ": " + e.message)
                Log.e(tag,"Original native canon oracle failed",e)
            }
        }.start()
    }
    private fun hash(bytes:ByteArray):String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") {
            "%02x".format(it.toInt() and 0xff)
        }
    private fun readActualCanon():ByteArray {
        val data=assets.open("canon.bin").use {it.readBytes()}
        require(data.size==canonSize)
        require(hash(data)=="cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5")
        return data
    }
    private fun getVector(name:String, canon:ByteArray):ByteArray{
        return when(name){
            "wise_pup_canon" -> canon.copyOf()
            "zeros" -> ByteArray(canonSize)
            "pattern" -> ByteArray(canonSize) { i -> (i*73+19).toByte() }
            "reversed_canon" -> ByteArray(canonSize).apply {
                for (i in 0 until 16) {
                    System.arraycopy(canon, (15-i)*sliceBytes, this, i*sliceBytes, sliceBytes)
                }
            }
            else -> error("Unknown vector " + name)
        }
    }
    private fun verify(){
        val sample=readActualCanon()
        emit("WISE_PUP_ORIGINAL_CANON_SHA256 "+hash(sample))
        val cases=JSONArray()
        var complete=true
        for(name in arrayOf("wise_pup_canon","zeros","pattern","reversed_canon")){
            val src=getVector(name,sample)
            val startOriginal=System.nanoTime()
            val original=originalCanonSeed(src)
            val originalNs=System.nanoTime()-startOriginal
            val startCandidate=System.nanoTime()
            val candidate=candidateCanonSeed(src)
            val candidateNs=System.nanoTime()-startCandidate
            require(original.size==historySize && candidate.size==historySize)
            var exactBytes=0
            var firstMismatch=-1
            for(i in original.indices){
                if(original[i]==candidate[i])exactBytes++
                else if(firstMismatch<0)firstMismatch=i
            }
            val bitExact=(exactBytes==historySize)
            complete=complete && bitExact
            val record=JSONObject()
                .put("case",name)
                .put("input_sha256",hash(src))
                .put("original_output_sha256",hash(original))
                .put("candidate_output_sha256",hash(candidate))
                .put("reference_function_rva","0x001a7db0")
                .put("reference_sdk","ai.bithuman:expression2-android:0.6.2")
                .put("input_bytes",src.size).put("output_bytes",original.size)
                .put("exact_bytes",exactBytes)
                .put("first_mismatch_byte",firstMismatch)
                .put("bit_exact",bitExact)
                .put("original_duration_ms",originalNs/1.0e6)
                .put("candidate_duration_ms",candidateNs/1.0e6)
            cases.put(record)
            if(name=="wise_pup_canon"){
                File(filesDir,"wise_pup_canon_input.bin").writeBytes(src)
                File(filesDir,"wise_pup_canon_original_history.bin").writeBytes(original)
                File(filesDir,"wise_pup_canon_candidate_history.bin").writeBytes(candidate)
            }
            emit("CANON_CASE "+name+" exact="+exactBytes+"/"+historySize+
                " bitExact="+bitExact+" originalMs="+(originalNs/1.0e6)+
                " candidateMs="+(candidateNs/1.0e6))
        }
        val report=JSONObject()
            .put("source","actual unmodified ARM64 libexpr2jni.so FUN_001a7db0")
            .put("sample_imx","Wise Pup Expression 2")
            .put("input_model_member","canon.bin")
            .put("canon_sha256",hash(sample))
            .put("output_bytes",historySize)
            .put("all_cases_bit_exact",complete)
            .put("cases",cases)
            .put("limit","Verified helper function only; not entire beginSegment state machine")
        File(filesDir,"canon_original_differential_report.json").writeText(report.toString(2))
        emit("ORIGINAL_CANON_AB_COMPLETE count="+cases.length()+" bitExact="+complete)
    }
}
