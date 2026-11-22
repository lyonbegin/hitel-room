package ai.bithuman.example.avatar_chat

// Direct Flutter Texture bridge to the official Android Essence2 SDK sample.
// No bitHuman Flutter plugin, AvatarPlayer, PlayoutClock, catchUp or stale policy.
import ai.bithuman.essence2.Essence2Avatar
import ai.bithuman.essence2.Essence2Credential
import ai.bithuman.essence2.Essence2ModelStore
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.Rect
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import io.flutter.view.TextureRegistry
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : FlutterActivity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val busy = AtomicBoolean(false)
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var channel: MethodChannel
    private var textureEntry: TextureRegistry.SurfaceTextureEntry? = null
    private var drawingSurface: Surface? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "hitel.e2.direct.quickstart")
        channel.setMethodCallHandler { call, result ->
            if (call.method != "start") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            val secret = call.argument<String>("secret") ?: ""
            val wav = call.argument<ByteArray>("wav")
            if (secret.isBlank() || wav == null || wav.isEmpty()) {
                result.error("input", "API secret and WAV file are required", null)
                return@setMethodCallHandler
            }
            if (!busy.compareAndSet(false, true)) {
                result.error("busy", "An Essence2 render is already running", null)
                return@setMethodCallHandler
            }
            val texture = textureEntry ?: flutterEngine.renderer.createSurfaceTexture().also { textureEntry = it }
            result.success(texture.id())
            worker.execute {
                try {
                    renderOnce(secret, wav, texture)
                } catch (t: Throwable) {
                    Log.e(TAG, "Essence2 official sample failed", t)
                    report("FAILED: " + t.toString())
                } finally {
                    busy.set(false)
                }
            }
        }
    }

    private fun report(message: String) {
        Log.i(TAG, message)
        handler.post {
            if (::channel.isInitialized) channel.invokeMethod("status", message)
        }
    }

    private fun renderOnce(secret: String, wav: ByteArray, texture: TextureRegistry.SurfaceTextureEntry) {
        // This is the original Android essence2-hello Wav.kt, package renamed only.
        val pcm = Wav.read16kMono(wav).toLittleEndianBytes()
        val seconds = pcm.size / 32000.0
        report("16 kHz mono PCM16 / " + "%.2f".format(seconds) + " s")

        // These three model calls are the original vendor Android sample API.
        Essence2Credential.set(secret)
        val store = Essence2ModelStore(this)
        val identity = store.fetch("A52DHS2219", progress = { member, done, total ->
            if (done == total) Log.i(TAG, "Model fetched " + member + " (" + total + " bytes)")
        })
        report("Model ready; creating original Essence2Avatar")

        Essence2Avatar.create(identity.dir).use { avatar ->
            texture.surfaceTexture().setDefaultBufferSize(avatar.width, avatar.height)
            drawingSurface?.release()
            drawingSurface = Surface(texture.surfaceTexture())

            val frame = avatar.newFrameBuffer()
            val bitmap = Bitmap.createBitmap(avatar.width, avatar.height, Bitmap.Config.ARGB_8888)
            val frames = ArrayList<ByteArray>((seconds * FPS).toInt() + 16)
            val jpeg = ByteArrayOutputStream(512 * 1024)

            // Python quickstart.py sends 16 kHz PCM in 10 ms chunks to one runtime.
            // Here the same loop calls the ORIGINAL Android SDK's feed(ByteArray).
            val chunkBytes = 160 * 2
            var offset = 0
            while (offset < pcm.size) {
                val end = minOf(offset + chunkBytes, pcm.size)
                avatar.feed(pcm.copyOfRange(offset, end))
                offset = end
            }
            avatar.endOfAudio()

            // Identical pull/availability/checkRender contract to official Android hello.
            // No app-side generated-frame drop or timestamp skip.
            var quietMs = 0
            while (quietMs < (if (frames.isEmpty()) 30_000 else 5_000)) {
                frame.clear()
                if (avatar.pull(frame)) {
                    quietMs = 0
                    frame.rewind()
                    bitmap.copyPixelsFromBuffer(frame)
                    jpeg.reset()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 88, jpeg)
                    frames.add(jpeg.toByteArray())
                    continue
                }
                if (frames.size >= (seconds * FPS).toInt() && avatar.available() == 0) break
                Thread.sleep(10)
                quietMs += 10
            }
            avatar.checkRender()
            report("SDK returned " + frames.size + " frames; playing in order")
            showEveryFrame(pcm, frames)
            report("DONE " + frames.size + " frames (none discarded in app)")
        }
    }

    // Same static PCM AudioTrack and 25 FPS visual output as the official Android hello.
    // Unlike a deadline-skipping presenter, this loop explicitly visits EVERY frame.
    private fun showEveryFrame(pcm: ByteArray, frames: List<ByteArray>) {
        val surface = drawingSurface ?: error("Flutter Texture is missing")
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build())
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(16000)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build())
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(pcm.size)
            .build()
        try {
            track.write(pcm, 0, pcm.size)
            track.play()
            val samples = pcm.size / 2
            val options = BitmapFactory.Options().apply { inSampleSize = 2 }
            for (i in frames.indices) {
                val wanted = i * (16000 / FPS)
                while (track.playbackHeadPosition < wanted && track.playbackHeadPosition < samples) {
                    Thread.sleep(2)
                }
                val bitmap = BitmapFactory.decodeByteArray(frames[i], 0, frames[i].size, options)
                    ?: error("Cannot decode SDK frame " + i)
                val canvas = surface.lockCanvas(null)
                try {
                    canvas.drawBitmap(
                        bitmap, null,
                        Rect(0, 0, canvas.width, canvas.height),
                        Paint(Paint.FILTER_BITMAP_FLAG)
                    )
                } finally {
                    surface.unlockCanvasAndPost(canvas)
                    bitmap.recycle()
                }
            }
        } finally {
            track.stop()
            track.release()
        }
    }

    override fun onDestroy() {
        worker.shutdown()
        drawingSurface?.release()
        textureEntry?.release()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "HITEL_E2_DIRECT"
        private const val FPS = 25
    }
}
