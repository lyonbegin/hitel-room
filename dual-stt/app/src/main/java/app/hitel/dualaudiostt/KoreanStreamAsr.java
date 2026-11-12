package app.hitel.dualaudiostt;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.os.Process;
import android.os.SystemClock;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Independent Korean streaming sherpa-onnx decoder for MIC or allowed MEDIA playback.
 * This has no Samsung accessibility/text-call dependency. Never implies call RX capture.
 * Based on the original HITEL14 KoreanSherpaStt model/config and PCM decode pipeline.
 */
public final class KoreanStreamAsr {
    public interface Listener {
        void onStatus(String source, String status);
        void onPartial(String source, String text);
        void onFinal(String source, String text);
    }
    private static final int RATE = 16000;
    private static final Object MODEL_LOCK = new Object();
    private static final String MODEL = "sherpa-onnx-streaming-zipformer-korean-2024-06-16";
    private static final String ROOT = "https://huggingface.co/k2-fsa/" + MODEL +
        "/resolve/ba6078bca4daf3f0dd37f79d0ab505af71df14a6/";
    private static final String[] NAMES = {
        "encoder-epoch-99-avg-1.int8.onnx",
        "decoder-epoch-99-avg-1.onnx",
        "joiner-epoch-99-avg-1.int8.onnx", "tokens.txt"
    };
    private static final long[] MINIMUM = {115000000L, 9500000L, 2000000L, 50000L};

    private final Context context;
    private final String source;
    private final MediaProjection projection;
    private final Listener listener;
    private final AtomicBoolean active = new AtomicBoolean(false);
    private volatile boolean stopping = false;
    private volatile AudioRecord audio;
    private Thread worker;

    public KoreanStreamAsr(Context context, String source, MediaProjection projection, Listener listener) {
        if (!"MIC".equals(source) && !"PLAYBACK".equals(source))
            throw new IllegalArgumentException("Unknown source");
        this.context = context.getApplicationContext();
        this.source = source;
        this.projection = projection;
        this.listener = listener;
    }
    public boolean isActive() { return active.get(); }
    public void start() {
        if (!active.compareAndSet(false, true)) return;
        stopping = false;
        worker = new Thread(this::run, "HITEL-Stream-STT-" + source);
        worker.start();
    }
    public void stop() {
        stopping = true;
        AudioRecord old = audio;
        if (old != null) try { old.stop(); } catch (Exception ignored) { }
    }
    private void status(String message) { listener.onStatus(source, message); }
    private File ensureModel() throws Exception {
        synchronized (MODEL_LOCK) {
            File folder = new File(context.getFilesDir(), "sherpa-ko-v1");
            if (!folder.isDirectory() && !folder.mkdirs())
                throw new IllegalStateException("Cannot create model directory");
            for (int i = 0; i < NAMES.length; i++) {
                if (stopping) return folder;
                File target = new File(folder, NAMES[i]);
                if (target.length() >= MINIMUM[i]) continue;
                File partial = new File(folder, NAMES[i] + ".part");
                if (partial.exists() && !partial.delete())
                    throw new IllegalStateException("Cannot clear previous download");
                status("한국어 모델 준비 " + (i+1) + "/4: " + NAMES[i]);
                HttpURLConnection conn = (HttpURLConnection)
                    new URL(ROOT + NAMES[i] + "?download=true").openConnection();
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "HITEL-DualAudio-STT/1");
                try {
                    if (conn.getResponseCode() != 200)
                        throw new IllegalStateException("Model HTTP " + conn.getResponseCode());
                    try (InputStream in = conn.getInputStream();
                         FileOutputStream out = new FileOutputStream(partial)) {
                        byte[] buffer = new byte[65536]; int n;
                        while ((n = in.read(buffer)) >= 0) {
                            if (stopping) return folder;
                            if (n > 0) out.write(buffer, 0, n);
                        }
                        out.getFD().sync();
                    }
                } finally { conn.disconnect(); }
                if (partial.length() < MINIMUM[i])
                    throw new IllegalStateException("Incomplete model file " + NAMES[i]);
                if (target.exists() && !target.delete())
                    throw new IllegalStateException("Cannot replace model");
                if (!partial.renameTo(target))
                    throw new IllegalStateException("Cannot finalize model");
            }
            return folder;
        }
    }
    private AudioRecord openRecord() {
        int minimum = AudioRecord.getMinBufferSize(
            RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minimum <= 0) throw new IllegalStateException("PCM format unsupported: " + minimum);
        AudioRecord.Builder builder = new AudioRecord.Builder()
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(RATE)
                .setChannelMask(AudioFormat.CHANNEL_IN_MONO).build())
            .setBufferSizeInBytes(Math.max(8192, minimum * 2));
        if ("MIC".equals(source)) {
            builder.setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION);
        } else {
            if (projection == null) throw new IllegalStateException("MediaProjection missing");
            AudioPlaybackCaptureConfiguration config =
                new AudioPlaybackCaptureConfiguration.Builder(projection)
                    .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                    .addMatchingUsage(AudioAttributes.USAGE_GAME)
                    .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                    .build();
            builder.setAudioPlaybackCaptureConfig(config);
        }
        AudioRecord recorder = builder.build();
        if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
            recorder.release();
            throw new IllegalStateException("AudioRecord initialization failed");
        }
        return recorder;
    }
    private void run() {
        OnlineRecognizer recognizer = null;
        OnlineStream stream = null;
        AudioRecord local = null;
        try {
            Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO);
            if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED)
                throw new IllegalStateException("RECORD_AUDIO not granted");
            File folder = ensureModel();
            if (stopping) return;
            status("한국어 sherpa-onnx 초기화 · " + source);
            OnlineTransducerModelConfig transducer = new OnlineTransducerModelConfig();
            transducer.setEncoder(new File(folder, NAMES[0]).getAbsolutePath());
            transducer.setDecoder(new File(folder, NAMES[1]).getAbsolutePath());
            transducer.setJoiner(new File(folder, NAMES[2]).getAbsolutePath());
            OnlineModelConfig model = new OnlineModelConfig();
            model.setTransducer(transducer);
            model.setTokens(new File(folder, NAMES[3]).getAbsolutePath());
            model.setModelType("zipformer");
            model.setNumThreads(2);
            model.setProvider("cpu");
            OnlineRecognizerConfig config = new OnlineRecognizerConfig();
            config.setModelConfig(model);
            config.setEnableEndpoint(true);
            recognizer = new OnlineRecognizer(null, config);
            stream = recognizer.createStream("");
            if (stopping) return;
            local = openRecord();
            audio = local;
            local.startRecording();
            if (local.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING)
                throw new IllegalStateException("AudioRecord not recording");
            status("STT 진행 중 · 실제 음성 신호 확인 대기");
            short[] pcm = new short[1600];
            long samples = 0, energy = 0, lastSignalAt = SystemClock.elapsedRealtime();
            long lastCaptionAt = 0;
            String lastPartial = "", lastFinal = "";
            while (!stopping) {
                int n = local.read(pcm, 0, pcm.length, AudioRecord.READ_BLOCKING);
                if (n < 0) {
                    if (stopping) break;
                    throw new IllegalStateException("AudioRecord.read failed: " + n);
                }
                if (n == 0) continue;
                float[] floats = new float[n];
                for (int i = 0; i < n; i++) {
                    floats[i] = pcm[i] / 32768f;
                    energy += (long)pcm[i] * pcm[i];
                }
                samples += n;
                stream.acceptWaveform(floats, RATE);
                while (recognizer.isReady(stream)) recognizer.decode(stream);
                String partial = recognizer.getResult(stream).getText();
                long now = SystemClock.elapsedRealtime();
                if (partial != null && !partial.isBlank() && !partial.equals(lastPartial)
                    && now - lastCaptionAt >= 120) {
                    lastPartial = partial;
                    lastCaptionAt = now;
                    listener.onPartial(source, partial);
                }
                if (recognizer.isEndpoint(stream)) {
                    String text = recognizer.getResult(stream).getText();
                    if (text != null && !text.isBlank()) {
                        lastFinal = text;
                        listener.onFinal(source, text);
                    }
                    recognizer.reset(stream);
                    lastPartial = "";
                }
                if (now - lastSignalAt > 3000) {
                    double rms = samples == 0 ? 0 : Math.sqrt((double)energy / samples) / 32768d;
                    status("오디오 신호 RMS=" + String.format(java.util.Locale.US, "%.5f", rms)
                        + (rms < 0.0005 ? " · 무음/캡처 제한 가능" : " · 신호 감지"));
                    samples = 0; energy = 0; lastSignalAt = now;
                }
            }
            if (stream != null && recognizer != null) {
                stream.inputFinished();
                while (recognizer.isReady(stream)) recognizer.decode(stream);
                String tail = recognizer.getResult(stream).getText();
                if (tail != null && !tail.isBlank() && !tail.equals(lastFinal))
                    listener.onFinal(source, tail);
            }
        } catch (Throwable failure) {
            if (!stopping) status("실행 실패: " + failure.getClass().getSimpleName()
                + ": " + failure.getMessage());
        } finally {
            audio = null;
            if (local != null) {
                try { if (local.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING)
                    local.stop(); } catch (Throwable ignored) { }
                try { local.release(); } catch (Throwable ignored) { }
            }
            if (stream != null) try { stream.release(); } catch (Throwable ignored) { }
            if (recognizer != null) try { recognizer.release(); } catch (Throwable ignored) { }
            active.set(false);
            status("STT 세션 종료 · " + source);
        }
    }
}
