package com.example.x2hello

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.tensorflow.lite.Interpreter
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Independent 53-frame Expression2 model experiment, built with Google LiteRT.
 * No bitHuman SDK, vendor API key or cloud service. Uses a public IMX sample.
 * Audio is 220/440Hz synthetic tones, so true speech lip-sync is not yet proven.
 */
class MainActivity : Activity() {
    private val tag = "HITEL_PHASE4"
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var status: TextView
    private lateinit var imageView: ImageView
    private val rendered = ArrayList<Bitmap>(53)
    private var index = 0

    data class FrameSpec(
        val current: Array<Array<FloatArray>>,
        val previous: Array<Array<FloatArray>>,
        val phase: Int
    )

    private fun note(s: String) {
        Log.i(tag,s)
        runOnUiThread { status.append(s + "\n") }
    }

    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        status=TextView(this).apply {
            textSize=11f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(18,25,32))
            text="Independent Expression2 Phase4 Android experiment\n"
            setPadding(12,10,12,10)
        }
        imageView=ImageView(this).apply {
            adjustViewBounds=true
            scaleType=ImageView.ScaleType.FIT_CENTER
        }
        val col=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
            addView(status,LinearLayout.LayoutParams(-1,-2))
            addView(imageView,LinearLayout.LayoutParams(-1,0,1f))
        }
        setContentView(col)
        Thread {
            try { process() }
            catch(e:Throwable) {
                Log.e(tag,"Model execution failed",e)
                note("PHASE4_FAILURE "+e.javaClass.simpleName+": "+e.message)
            }
        }.start()
    }

    private fun canon():Array<Array<FloatArray>> {
        val bytes=assets.open("canon.bin").use { it.readBytes() }
        require(bytes.size==16*90*52*4) { "Invalid canon byte size" }
        val data=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer()
        return Array(16) { Array(90) { FloatArray(52).also { data.get(it) } } }
    }

    private fun seed(canon:Array<Array<FloatArray>>):
      Array<Array<Array<Array<FloatArray>>>> {
        return Array(1) {
            Array(16) { c ->
                Array(16) {
                    Array(90) { y -> canon[c][y].clone() }
                }
            }
        }
    }

    private fun model():ByteBuffer {
        return assets.openFd("combined_litert.tflite").use { fd ->
            FileInputStream(fd.fileDescriptor).channel.use { channel ->
                channel.map(FileChannel.MapMode.READ_ONLY,fd.startOffset,fd.length)
                    .order(ByteOrder.nativeOrder())
            }
        }
    }

    private fun process() {
        val start=SystemClock.elapsedRealtime()
        note("PHASE4_START vendorSDK=NONE credentials=NONE")
        val identity=canon()
        Interpreter(model(),Interpreter.Options().setNumThreads(2)).use { interp ->
            val audio=Array(1) { FloatArray(35200) { i ->
                val t=i.toDouble()/16000.0
                (0.12*sin(2*PI*220*t)+0.02*sin(2*PI*440*t)).toFloat()
            } }
            val encoded=Array(1) { Array(55) { Array(12) { FloatArray(768) } } }
            val tokens=Array(1) { Array(14) { Array(16) { FloatArray(384) } } }
            interp.runSignature(mapOf("args_0" to audio),
                mutableMapOf<String,Any>("output_0" to encoded),"enc")
            interp.runSignature(mapOf("args_0" to encoded),
                mutableMapOf<String,Any>("output_0" to tokens),"tok14")
            note("ENC_TOK14_PASS")
            val history=seed(identity)
            val motions=ArrayList<Array<Array<FloatArray>>>(14)
            for(i in 0 until 14) {
                val token=Array(1) { Array(16) { c -> tokens[0][i][c].clone() } }
                val next=Array(1) { Array(16) { Array(90) { FloatArray(52) } } }
                interp.runSignature(mapOf("args_0" to history,"args_1" to token),
                    mutableMapOf<String,Any>("output_0" to next),"step")
                motions.add(next[0])
                for(c in 0 until 16) {
                    for(h in 0 until 15) history[0][c][h]=history[0][c][h+1]
                    history[0][c][15]=next[0][c]
                }
            }
            note("STEP14_PASS")
            val sequence=ArrayList<FrameSpec>(53)
            for(i in 0 until 14) {
                val cur=motions[i]
                val previous=if(i==0)cur else motions[i-1]
                if(i==0)sequence.add(FrameSpec(cur,previous,3))
                else for(phase in 0 until 4)sequence.add(FrameSpec(cur,previous,phase))
            }
            require(sequence.size==53)
            var offset=0
            while(offset<sequence.size) {
                val remains=sequence.size-offset
                val batch=if(remains>=16)16 else 8
                val count=min(batch,remains)
                val input=ByteBuffer.allocateDirect(batch*36*90*52*4)
                    .order(ByteOrder.nativeOrder())
                for(k in 0 until batch) {
                    val item=sequence[offset+min(k,count-1)]
                    for(c in 0 until 36) {
                        when {
                            c<16 -> for(y in 0 until 90) {
                                for(x in 0 until 52)input.putFloat(item.current[c][y][x])
                            }
                            c<32 -> for(y in 0 until 90) {
                                for(x in 0 until 52)input.putFloat(item.previous[c-16][y][x])
                            }
                            else -> {
                                val value=if(c-32==item.phase)1f else 0f
                                repeat(90*52) { input.putFloat(value) }
                            }
                        }
                    }
                }
                input.rewind()
                val output=ByteBuffer.allocateDirect(batch*3*720*416*4)
                    .order(ByteOrder.nativeOrder())
                val sig=if(batch==16)"dec16" else "dec8"
                interp.runSignature(mapOf("args_0" to input),
                    mutableMapOf<String,Any>("output_0" to output),sig)
                for(k in 0 until count)rendered.add(bitmap(output,k))
                offset+=count
                note("DECODE_BATCH_PASS "+sig+" kept="+count+" total="+rendered.size)
            }
            require(rendered.size==53)
            FileOutputStream(File(filesDir,"phase4_first.png")).use {
                rendered.first().compress(Bitmap.CompressFormat.PNG,100,it)
            }
            FileOutputStream(File(filesDir,"phase4_last.png")).use {
                rendered.last().compress(Bitmap.CompressFormat.PNG,100,it)
            }
            note("INDEPENDENT_ANDROID_PHASE4_PASS frames=53 totalMs="+
                 (SystemClock.elapsedRealtime()-start))
            handler.post { play() }
        }
    }

    private fun bitmap(buffer:ByteBuffer,frame:Int):Bitmap {
        val area=720*416
        val offset=frame*3*area
        val pixels=IntArray(area)
        for(i in 0 until area) {
            val r=channel(buffer.getFloat((offset+i)*4))
            val g=channel(buffer.getFloat((offset+area+i)*4))
            val b=channel(buffer.getFloat((offset+2*area+i)*4))
            pixels[i]=Color.rgb(r,g,b)
        }
        return Bitmap.createBitmap(pixels,416,720,Bitmap.Config.ARGB_8888)
    }

    private fun channel(value:Float):Int {
        return max(0,min(255,(value*255f+0.5f).toInt()))
    }

    private fun play() {
        val run=object:Runnable {
            override fun run() {
                if(rendered.isEmpty())return
                imageView.setImageBitmap(rendered[index])
                index=(index+1)%rendered.size
                handler.postDelayed(this,50L)
            }
        }
        handler.post(run)
    }
}
