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
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Source-of-truth numerical differential test.
 * JNI originalPreprocess executes the original unmodified Expression2 ARM64
 * FUN_001a9794 (RVA 0x1a9794) without reconstructing its C++ code.
 * JNI candidatePreprocess executes a visibly separate implementation.
 *
 * No SDK auth/session/render APIs called. Only a standalone numerical DSP
 * function is exercised as a reference. Pass != SDK feature parity.
 */
class MainActivity: Activity() {
    private val TAG="EXPR2_ORACLE"
    private lateinit var display: TextView
    private external fun originalPreprocess(samples: FloatArray): FloatArray
    private external fun candidatePreprocess(samples: FloatArray): FloatArray
    private external fun originalPcmGuardOracle(): String
    private external fun originalFeedStateOracle(): String
    private external fun originalEndSegmentGuardOracle(): String
    private external fun originalFramePopOracle(): String
    private external fun originalFrameTransferOracle(): String
    private external fun originalFeedAccumulationOracle(): String

    private fun emit(message:String) {
        Log.i(TAG,message)
        runOnUiThread { display.append(message+"\n") }
    }

    override fun onCreate(savedInstanceState:Bundle?) {
        super.onCreate(savedInstanceState)
        display=TextView(this).apply {
            textSize=12f
            setPadding(18,18,18,18)
            text="bitHuman Expression2 actual native function A/B comparator\n"
        }
        setContentView(ScrollView(this).apply {addView(this@MainActivity.display)})
        Thread {
            try {
                System.loadLibrary("LiteRt")
                System.loadLibrary("expr2jni")
                System.loadLibrary("expression2_oracle")
                emit("ORIGINAL_LIBRARIES_LOADED actualUnmodifiedSDK=true")
                perform()
            } catch(e:Throwable) {
                emit("ORIGINAL_ORACLE_FAILURE "+e.javaClass.simpleName+": "+e.message)
                Log.e(TAG,"original oracle failed",e)
            }
        }.start()
    }

    private fun originalSpeech():FloatArray {
        val bytes=assets.open("voice-test.f32").use {it.readBytes()}
        require(bytes.size==44000*4){"voice-test.f32 should contain exactly 44000 Float32 samples"}
        val buf=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        return FloatArray(44000){buf.float}
    }

    private fun samples(case:String):FloatArray {
        val a=FloatArray(44000)
        when(case){
            "silence" -> Unit
            "impulse" -> a[8000]=0.25f
            "sine" -> {
                for(i in a.indices) {
                    val t=i/16000.0
                    a[i]=(0.15*sin(2*PI*220*t)+0.03*sin(2*PI*440*t)).toFloat()
                }
            }
            "spoken_tts" -> return originalSpeech()
            "fixed_noise" -> {
                var x=0x1948AF21
                for (i in a.indices) {
                    x=x xor (x shl 13)
                    x=x xor (x ushr 17)
                    x=x xor (x shl 5)
                    a[i]=(0.08*(x/2147483648.0)).toFloat()
                }
            }
            else -> error("No case: "+case)
        }
        return a
    }
    private fun hash(a:FloatArray):String {
        val sha=MessageDigest.getInstance("SHA-256")
        val buf=ByteBuffer.allocate(4*1024).order(ByteOrder.LITTLE_ENDIAN)
        for(f in a){
            if(buf.remaining()<4){
                sha.update(buf.array(),0,buf.position())
                buf.clear()
            }
            buf.putFloat(f)
        }
        sha.update(buf.array(),0,buf.position())
        return sha.digest().joinToString(""){"%02x".format(it)}
    }
    private fun saveFloats(case:String, tag:String, a:FloatArray){
        val file=File(filesDir,case+"_"+tag+".f32")
        file.outputStream().buffered().use {stream ->
            val buf=ByteBuffer.allocate(4096).order(ByteOrder.LITTLE_ENDIAN)
            for(x in a){
                if(buf.remaining()<4){
                    stream.write(buf.array(),0,buf.position())
                    buf.clear()
                }
                buf.putFloat(x)
            }
            stream.write(buf.array(),0,buf.position())
        }
    }


    // Window offsets, zero padding, sample conversion and the 3x encoder-input
    // scale are sourced from the unmodified ARM64 FUN_001a8500:
    //   0x001a8598-0x001a8638 (see original instruction artifact 13992718722).
    // This executes the actual FUN_001a9794 on source-derived windows.
    // It does NOT claim that FUN_001a8500, the ML backend or render worker ran.
    private fun originalStreamWindowProof() {
        data class Probe(
            val name: String, val step: Int, val available: Int,
            val expectedStart: Int, val expectedCopy: Int,
            val activeTail: Boolean = false
        )
        val cases = arrayOf(
            Probe("step0_threshold", 0, 25600, 0, 25600),
            Probe("step0_extra", 0, 44000, 0, 25600),
            Probe("step1_full", 1, 44000, 0, 44000),
            Probe("step2_full", 2, 69600, 25600, 44000),
            Probe("step3_partial", 3, 80000, 51200, 28800),
            Probe("step3_full", 3, 96000, 51200, 44000),
            Probe("step0_active_tail", 0, 44000, 0, 25600, true),
            Probe("step1_active_tail", 1, 44000, 0, 44000, true)
        )
        val seed = originalSpeech()
        val rows = JSONArray()
        val encodedHashes = mutableMapOf<String,String>()
        for (probe in cases) {
            // The initial 44,000 samples are the identical TTS asset used by
            // the existing standalone original-vs-candidate DSP test.
            val pcm = FloatArray(probe.available) { i ->
                if (probe.activeTail && i >= 25600) {
                    val t = (i - 25600) / 16000.0
                    (0.19*sin(2.0*PI*421.0*t) + 0.04*sin(2.0*PI*837.0*t)).toFloat()
                } else if (i < seed.size) seed[i]
                else seed[i % seed.size] * (if (i < 70000) 0.75f else 1.25f)
            }
            val start = if (probe.step > 1) (probe.step - 1) * 25600 else 0
            val desiredStop = (probe.step + 1) * 25600
            val stop = minOf(pcm.size, desiredStop, start + 44000)
            val copied = maxOf(0, stop - start)
            require(start == probe.expectedStart && copied == probe.expectedCopy) {
                "Source-derived original audio window offsets changed: " + probe.name
            }
            val window = FloatArray(44000)
            if (copied > 0) System.arraycopy(pcm, start, window, 0, copied)
            require((0 until copied).all { window[it].toRawBits() == pcm[start+it].toRawBits() })
            require((copied until window.size).all { window[it].toRawBits() == 0f.toRawBits() })

            // The actual unmodified vendor ARM64 preprocessor executes here.
            val original = originalPreprocess(window)
            require(original.size == 35200 && original.all { it.isFinite() })
            val encoderInput = FloatArray(original.size) { original[it] * 3.0f }
            require(encoderInput.all { it.isFinite() })
            encodedHashes[probe.name] = hash(encoderInput)

            // Existing independently reconstructed candidate: diagnostic only.
            // Its output is NOT substituted for the original encoder input.
            val candidate = candidatePreprocess(window)
            require(candidate.size == original.size)
            var exact = 0
            var maxAbs = 0.0
            for (i in original.indices) {
                if (original[i].toRawBits() == candidate[i].toRawBits()) exact++
                maxAbs = maxOf(maxAbs, abs(original[i].toDouble()-candidate[i].toDouble()))
            }
            saveFloats("stream_" + probe.name, "window", window)
            saveFloats("stream_" + probe.name, "original_preprocessed", original)
            saveFloats("stream_" + probe.name, "original_encoder_x3", encoderInput)
            rows.put(JSONObject()
                .put("name", probe.name)
                .put("step", probe.step)
                .put("available_samples", probe.available)
                .put("start", start)
                .put("copied_samples", copied)
                .put("zero_padded_samples", window.size-copied)
                .put("window_sha256", hash(window))
                .put("original_preprocessed_sha256", hash(original))
                .put("original_encoder_x3_sha256", hash(encoderInput))
                .put("output_samples", original.size)
                .put("candidate_bit_exact", exact)
                .put("candidate_max_abs_diff", maxAbs)
                .put("actual_original_arm64_preprocessor_invoked", true)
                .put("actual_original_full_inference_invoked", false))
            emit("ORIGINAL_STREAM_WINDOW_CASE name=" + probe.name +
                " step=" + probe.step + " copied=" + copied +
                " pad=" + (window.size-copied) + " exact=" + exact)
        }
        // A nonzero post-25,600 tail must have no effect on step 0,
        // but it must change the original step-1 encoder input.
        require(encodedHashes.getValue("step0_active_tail") ==
                encodedHashes.getValue("step0_extra")) {
            "Original first-step input unexpectedly depends on later PCM"
        }
        require(encodedHashes.getValue("step1_active_tail") !=
                encodedHashes.getValue("step1_full")) {
            "Original second-step input failed to observe active tail"
        }
        val result = JSONObject()
            .put("source", "unmodified Expression2 0.6.2 ARM64 FUN_001a8500 window assembly")
            .put("source_window_rva", "0x001a8500")
            .put("executed_original_preprocessor_rva", "0x001a9794")
            .put("source_derived_not_runtime_full_inference", true)
            .put("window_samples", 44000)
            .put("preprocessed_samples", 35200)
            .put("encoder_scale", 3)
            .put("case_count", cases.size)
            .put("active_tail_step0_invariant", true)
            .put("active_tail_step1_sensitive", true)
            .put("cases", rows)
            .put("status", "PASS")
        File(filesDir, "original_stream_window_report.json").writeText(result.toString(2))
        emit("ORIGINAL_STREAM_WINDOW_AB_COMPLETE cases=" + cases.size)
    }

    private fun perform() {
        val rows=JSONArray()
        for(case in arrayOf("silence","impulse","sine","fixed_noise","spoken_tts")){
            val pcm=samples(case)
            // Preserve exact input bytes for host-side reproduction of every diff.
            saveFloats(case,"input",pcm)
            val startOriginal=System.nanoTime()
            val original=originalPreprocess(pcm)
            val originalMs=(System.nanoTime()-startOriginal)/1e6
            val startCandidate=System.nanoTime()
            val candidate=candidatePreprocess(pcm)
            val candidateMs=(System.nanoTime()-startCandidate)/1e6
            require(original.size==35200 && candidate.size==35200)
            var sum=0.0
            var ss=0.0
            var maximum=0.0
            var exact=0
            var nonfinite=0
            var first=-1
            var firstRef=0f
            var firstCandidate=0f
            for(i in original.indices){
                if(!original[i].isFinite() || !candidate[i].isFinite())nonfinite++
                val err=abs(original[i].toDouble()-candidate[i].toDouble())
                sum+=err
                ss+=err*err
                maximum=max(maximum,err)
                if(original[i].toRawBits()==candidate[i].toRawBits())exact++
                if(first<0 && original[i].toRawBits()!=candidate[i].toRawBits()){
                    first=i
                    firstRef=original[i]
                    firstCandidate=candidate[i]
                }
            }
            val mae=sum/original.size
            val rmse=sqrt(ss/original.size)
            val compare=JSONObject()
                .put("case",case)
                .put("pcm_sha256",hash(pcm))
                .put("source_sdk_version","Expression2-android-0.6.2")
                .put("original_function_rva","0x001a9794")
                .put("original_sha256",hash(original))
                .put("candidate_sha256",hash(candidate))
                .put("count",35200)
                .put("nonfinite_count",nonfinite)
                .put("float_exact_count",exact)
                .put("mae",mae).put("rmse",rmse).put("max_abs",maximum)
                .put("first_different_index",first)
                .put("first_different_original",firstRef.toDouble())
                .put("first_different_candidate",firstCandidate.toDouble())
                .put("original_duration_ms",originalMs)
                .put("candidate_duration_ms",candidateMs)
                .put("bit_exact",exact==original.size)
            rows.put(compare)
            saveFloats(case,"input",pcm)
            saveFloats(case,"original",original)
            saveFloats(case,"candidate",candidate)
            emit("ORACLE_CASE "+case+" exact="+exact+"/35200"+
                " mae="+mae+" rmse="+rmse+" max="+maximum+
                " origMs="+originalMs+" candMs="+candidateMs)
        }
        val report=JSONObject().put("oracle","original unmodified ARM64 libexpr2jni.so FUN_001a9794")
            .put("result","REFERENCE_EXECUTED_AND_COMPARED")
            .put("warning","Non-bit-exact candidates must not be reported as original SDK parity")
            .put("sample_rate",16000).put("input_samples",44000)
            .put("output_samples",35200).put("cases",rows)
        File(filesDir,"original_differential_report.json").writeText(report.toString(2))
        // New source-gated experiment: execute original unmodified ARM64 PCM
        // vector append and pre-inference scheduler guard functions. This is
        // not a claim of full original feed/pump/pull state parity.
        val pcmGuard=JSONObject(originalPcmGuardOracle())
        File(filesDir,"original_pcm_guard_report.json").writeText(pcmGuard.toString(2))
        val appendFailures=pcmGuard.getInt("append_failures")
        val guardFailures=pcmGuard.getInt("scheduler_guard_failures")
        emit("ORIGINAL_PCM_GUARD_RESULT append="+pcmGuard.getInt("append_case_count")+
            " scheduler="+pcmGuard.getInt("scheduler_guard_case_count")+
            " appendFail="+appendFailures+" schedulerFail="+guardFailures)
        require(appendFailures==0 && guardFailures==0 &&
                pcmGuard.getString("status")=="PASS"){
            "Real original PCM/guard differential mismatch"
        }
        emit("ORIGINAL_PCM_GUARD_AB_COMPLETE")
        // Execute original unmodified ARM64 FUN_001a7fbc against a guarded
        // synthetic state; only PCM accumulation and pre-inference state
        // are verified, never the full model scheduler.
        val feedReport=JSONObject(originalFeedStateOracle())
        File(filesDir,"original_feed_state_report.json").writeText(feedReport.toString(2))
        emit("ORIGINAL_FEED_STATE_RESULT cases="+feedReport.getInt("total_cases")+
            " pass="+feedReport.getInt("passed")+" fail="+feedReport.getInt("failed"))
        require(feedReport.getString("status")=="PASS" &&
                feedReport.getInt("failed")==0 &&
                feedReport.getInt("total_cases")==9){
            "Original ARM64 feed-state oracle mismatch"
        }
        emit("ORIGINAL_FEED_STATE_AB_COMPLETE")
        // Execute actual unmodified ARM64 FUN_001a7fbc with source-derived
        // native state. Backpressure blocks model inference in these tests.
        val originalAccum=JSONObject(originalFeedAccumulationOracle())
        File(filesDir,"original_feed_accumulation_report.json").writeText(originalAccum.toString(2))
        emit("ORIGINAL_FEED_ACCUM_RESULT cases="+originalAccum.getInt("case_count")+
             " failures="+originalAccum.getInt("failures"))
        require(originalAccum.getString("status")=="PASS" &&
                originalAccum.getInt("failures")==0) {
            "Original ARM64 accumulation buffer/status not matched"
        }
        emit("ORIGINAL_FEED_ACCUM_AB_COMPLETE")
        val endReport=JSONObject(originalEndSegmentGuardOracle())
        File(filesDir,"original_end_segment_guard_report.json").writeText(endReport.toString(2))
        emit("ORIGINAL_END_BOUNDARY_RESULT cases="+endReport.getInt("case_count")+
            " pass="+endReport.getInt("passed")+" fail="+endReport.getInt("failures"))
        require(endReport.getInt("case_count")==11 &&
                endReport.getInt("failures")==0 &&
                endReport.getString("result")=="PASS") {
            "Actual original ARM64 end segment boundary mismatch"
        }
        emit("ORIGINAL_END_BOUNDARY_AB_COMPLETE")
        val frameReport=JSONObject(originalFramePopOracle())
        File(filesDir,"original_frame_pop_report.json").writeText(frameReport.toString(2))
        emit("ORIGINAL_FRAME_POP_RESULT cases="+frameReport.getInt("case_count")+
            " pass="+frameReport.getInt("passed")+" fail="+frameReport.getInt("failures"))
        require(frameReport.getInt("case_count")==4 &&
                frameReport.getInt("failures")==0 &&
                frameReport.getString("status")=="PASS") {
            "Original ARM64 native frame pop and ownership mismatch"
        }
        emit("ORIGINAL_FRAME_POP_AB_COMPLETE")
        val transfer=JSONObject(originalFrameTransferOracle())
        File(filesDir,"original_frame_transfer_report.json").writeText(transfer.toString(2))
        emit("ORIGINAL_FRAME_TRANSFER_RESULT cases="+transfer.getInt("case_count")+
            " pass="+transfer.getInt("passed")+" fail="+transfer.getInt("failures"))
        require(transfer.getInt("case_count")==2 &&
                transfer.getInt("failures")==0 &&
                transfer.getString("status")=="PASS") {
            "Original ARM64 backend staging -> native queue -> pull failed"
        }
        emit("ORIGINAL_FRAME_TRANSFER_AB_COMPLETE")
        originalStreamWindowProof()
        emit("ORIGINAL_ORACLE_AB_COMPLETE count="+rows.length()+" report=original_differential_report.json")
    }
}
