// Galaxy ARM64 offline Korean call-recording STT.
// Uses the Sherpa-ONNX v1.12.26 official C API and official SenseVoice INT8 model.
// Same input->model path proven with real user recording on Android 15 x86_64.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sherpa-onnx/c-api/c-api.h"

int main(int argc, char **argv) {
  if (argc != 4) {
    fprintf(stderr, "USAGE: libsensevoice-cli.so tokens.txt model.int8.onnx mono16k.wav\n");
    return 2;
  }
  const SherpaOnnxWave *wav = SherpaOnnxReadWave(argv[3]);
  if (!wav) {
    fprintf(stderr, "WAVE_READ_FAILED file=%s\n", argv[3]);
    return 3;
  }
  fprintf(stderr, "WAVE_READ_OK rate=%d samples=%d seconds=%.5f\n",
      wav->sample_rate, wav->num_samples,
      (double)wav->num_samples / (wav->sample_rate ? wav->sample_rate : 1));
  fflush(stderr);

  SherpaOnnxOfflineRecognizerConfig cfg = {};
  cfg.model_config.tokens = argv[1];
  cfg.model_config.num_threads = 2;
  cfg.model_config.provider = "cpu";
  cfg.model_config.sense_voice.model = argv[2];
  cfg.model_config.sense_voice.language = "ko";
  cfg.model_config.sense_voice.use_itn = 1;
  cfg.decoding_method = "greedy_search";
  const SherpaOnnxOfflineRecognizer *recognizer = SherpaOnnxCreateOfflineRecognizer(&cfg);
  if (!recognizer) {
    fprintf(stderr, "SENSEVOICE_RECOGNIZER_INIT_FAILED\n");
    SherpaOnnxFreeWave(wav);
    return 4;
  }
  const SherpaOnnxOfflineStream *stream = SherpaOnnxCreateOfflineStream(recognizer);
  if (!stream) {
    fprintf(stderr, "SENSEVOICE_STREAM_INIT_FAILED\n");
    SherpaOnnxDestroyOfflineRecognizer(recognizer);
    SherpaOnnxFreeWave(wav);
    return 5;
  }
  SherpaOnnxAcceptWaveformOffline(stream, wav->sample_rate, wav->samples, wav->num_samples);
  fprintf(stderr, "SENSEVOICE_INFERENCE_BEGIN\n"); fflush(stderr);
  SherpaOnnxDecodeOfflineStream(recognizer, stream);
  const SherpaOnnxOfflineRecognizerResult *result = SherpaOnnxGetOfflineStreamResult(stream);
  fprintf(stderr, "FULL_TRANSCRIPT: %s\n", (result && result->text) ? result->text : "");
  fprintf(stderr, "SENSEVOICE_INFERENCE_DONE\n"); fflush(stderr);
  if (result) SherpaOnnxDestroyOfflineRecognizerResult(result);
  SherpaOnnxDestroyOfflineStream(stream);
  SherpaOnnxDestroyOfflineRecognizer(recognizer);
  SherpaOnnxFreeWave(wav);
  return 0;
}
