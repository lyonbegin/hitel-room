package app.hitel.samsungprobe;

import android.content.Context;
import android.net.Uri;
import java.io.File;
import java.io.IOException;

import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

/**
 * HITEL14 completed-M4A transcription bridge. NO custom ASR algorithm.
 *
 * ASR REFERENCE — exact unmodified source included in:
 * flow-lab/upstream/sherpa-onnx-v1.12.26/StreamingDecodeFileTransducer.java
 * https://github.com/k2-fsa/sherpa-onnx/blob/v1.12.26/
 * java-api-examples/StreamingDecodeFileTransducer.java
 * Copyright 2022-2023 zhaoming; 2024 Xiaomi Corporation.
 *
 * Only required adaptations:
 * 1. WaveReader(.wav) -> existing MIT TranscriberM4aDecoder(.m4a), which
 *    supplies mono float PCM and the original source sample rate.
 * 2. Upstream example bilingual model paths -> EXISTING HITEL14 Korean
 *    Zipformer 2024-06-16 INT8 files, already prepared in sherpa-ko-v1.
 * 3. CLI print -> HITEL14 Progress callback and current UI.
 * 4. Kotlin JNI API's Java setters -> equivalent config to the CLI example.
 *
 * Everything governing STT follows the OFFICIAL file example:
 * ONE stream; acceptWaveform for the entire recording; 0.8s tail silence;
 * while (isReady) decode; getResult; release. NO isEndpoint, reset,
 * extra 100ms windows, second pass, text voting or custom resampling.
 *
 * Existing HITEL14 microphone code and Samsung phone UI are not called.
 */
final class SamsungCompletedM4aTranscriber {
    interface Progress {
        void onPhase(String message);
        void onSentence(String sentence);
    }

    private SamsungCompletedM4aTranscriber() {}

    static String transcribe(File file, Context context, Progress progress)
        throws Exception {
        if (context == null || file == null || !file.isFile() ||
            !file.canRead() || file.length() == 0) {
            throw new IOException("선택한 완료 M4A 파일을 읽을 수 없습니다.");
        }

        // Original HITEL14 Korean model (NO Whisper / NO new STT model).
        File folder = KoreanSherpaStt.prepareSharedModelsForFile(context, progress);
        OnlineTransducerModelConfig transducer = new OnlineTransducerModelConfig();
        transducer.setEncoder(new File(folder,
            "encoder-epoch-99-avg-1.int8.onnx").getAbsolutePath());
        transducer.setDecoder(new File(folder,
            "decoder-epoch-99-avg-1.onnx").getAbsolutePath());
        transducer.setJoiner(new File(folder,
            "joiner-epoch-99-avg-1.int8.onnx").getAbsolutePath());

        OnlineModelConfig modelConfig = new OnlineModelConfig();
        modelConfig.setTransducer(transducer);
        modelConfig.setTokens(new File(folder, "tokens.txt").getAbsolutePath());
        modelConfig.setModelType("zipformer");
        modelConfig.setNumThreads(2); // existing HITEL14 configuration
        modelConfig.setProvider("cpu");

        OnlineRecognizerConfig config = new OnlineRecognizerConfig();
        config.setModelConfig(modelConfig);
        config.setDecodingMethod("greedy_search"); // official file example

        OnlineRecognizer recognizer = null;
        OnlineStream stream = null;
        try {
            recognizer = new OnlineRecognizer(null, config);
            stream = recognizer.createStream("");

            final OnlineStream input = stream;
            final long[] pcmSamples = {0L};
            final int[] sampleRate = {0};
            final int[] pcmChunks = {0};

            LabStore.log("SAMSUNG_REC_FILE_REFERENCE_BEGIN",
                "source=sherpa-onnx/v1.12.26/java-api-examples/" +
                "StreamingDecodeFileTransducer.java" +
                "; decoder=Majkey25/transcriber-android/AudioTranscriber.kt" +
                "; model=sherpa-onnx-streaming-zipformer-korean-2024-06-16" +
                "; input="+file.getName() +
                "; fileSize="+file.length() +
                "; algorithm=official-one-stream-no-reset-one-result" +
                "; phoneUnchanged=true; microphoneUnchanged=true");
            progress.onPhase(
                "원본 Transcriber M4A→PCM, sherpa 공식 StreamingDecodeFileTransducer 실행");

            // Necessary format bridge; replaces WaveReader on the original
            // official source, retaining the exact acceptWaveform call.
            TranscriberM4aDecoder.decode(
                context, Uri.fromFile(file), (samples, rate) -> {
                    if (samples == null || samples.length == 0) return;
                    if (rate <= 0 || (sampleRate[0] != 0 && sampleRate[0] != rate))
                        throw new IllegalStateException(
                            "M4A PCM sampleRate mismatch: " + rate);
                    sampleRate[0] = rate;
                    pcmSamples[0] += samples.length;
                    pcmChunks[0]++;

                    // OFFICIAL:
                    // stream.acceptWaveform(reader.getSamples(),
                    //                       reader.getSampleRate());
                    input.acceptWaveform(samples, rate);
                }
            );
            if (pcmSamples[0] == 0L || sampleRate[0] == 0)
                throw new IOException("Transcriber M4A 디코더 출력 PCM이 없습니다.");

            // OFFICIAL — exact algorithm, source rate preserved:
            // float[] tailPaddings = new float[(int) (0.8 *
            //                                    reader.getSampleRate())];
            float[] tailPaddings =
                new float[(int) (0.8 * sampleRate[0])];
            stream.acceptWaveform(tailPaddings, sampleRate[0]);

            // OFFICIAL:
            // while (recognizer.isReady(stream)) {
            //   recognizer.decode(stream);
            // }
            int decodeSteps = 0;
            while (recognizer.isReady(stream)) {
                recognizer.decode(stream);
                decodeSteps++;
            }

            // OFFICIAL:
            // String text = recognizer.getResult(stream).getText();
            String text = recognizer.getResult(stream).getText();
            LabStore.log("SAMSUNG_REC_FILE_REFERENCE_RESULT",
                "input="+file.getName() +
                "; pcmSamples="+pcmSamples[0] +
                "; sampleRate="+sampleRate[0] +
                "; chunks="+pcmChunks[0] +
                "; decodeSteps="+decodeSteps +
                "; textLength="+(text == null ? 0 : text.length()) +
                "; originalExampleAlgorithm=true");
            if (text == null || text.trim().isEmpty()) {
                throw new IOException(
                    "공식 StreamingDecodeFileTransducer 방식에서 " +
                    "한국어 Zipformer 전사 결과가 비어 있습니다. " +
                    "FILE_REFERENCE_RESULT의 PCM·decodeSteps를 확인하십시오.");
            }
            progress.onSentence(text); // Display original output without edits.
            return text;
        } finally {
            // OFFICIAL resource-release order:
            if (stream != null) stream.release();
            if (recognizer != null) recognizer.release();
        }
    }
}
