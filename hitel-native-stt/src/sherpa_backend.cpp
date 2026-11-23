#include "sherpa_backend.hpp"
#include "sherpa-onnx/c-api/c-api.h"

#include <fstream>
#include <stdexcept>
#include <utility>

namespace hitel {
namespace {
std::string Existing(const std::string &directory, const char *name) {
  const std::string path = directory + "/" + name;
  std::ifstream file(path, std::ios::binary);
  if (!file || file.peek() == std::ifstream::traits_type::eof()) {
    throw std::runtime_error("IXIO ORIGINAL model missing/empty: " + path);
  }
  return path;
}

class SherpaBackend final : public StreamingBackend {
 public:
  explicit SherpaBackend(const std::string &directory)
      : encoder_(Existing(directory, "encoder.ort")),
        decoder_(Existing(directory, "decoder.ort")),
        joiner_(Existing(directory, "joiner.ort")),
        tokens_(Existing(directory, "tokens.txt")),
        bpe_(Existing(directory, "bpe.vocab")) {
    SherpaOnnxOnlineRecognizerConfig c{};
    c.feat_config.sample_rate = 16000;
    c.feat_config.feature_dim = 80;
    c.model_config.transducer.encoder = encoder_.c_str();
    c.model_config.transducer.decoder = decoder_.c_str();
    c.model_config.transducer.joiner = joiner_.c_str();
    c.model_config.tokens = tokens_.c_str();
    c.model_config.modeling_unit = "bpe";
    c.model_config.bpe_vocab = bpe_.c_str();
    c.model_config.provider = "cpu";
    c.model_config.num_threads = 2;
    c.decoding_method = "greedy_search";
    c.enable_endpoint = 1;
    c.rule1_min_trailing_silence = 2.4f;
    c.rule2_min_trailing_silence = 1.2f;
    c.rule3_min_utterance_length = 20.f;
    recognizer_ = SherpaOnnxCreateOnlineRecognizer(&c);
    if (!recognizer_) {
      throw std::runtime_error(
          "Public sherpa-onnx rejected original IXIO .ort / BPE / config; "
          "inspect model metadata instead of replacing model");
    }
    stream_ = SherpaOnnxCreateOnlineStream(recognizer_);
    if (!stream_) {
      SherpaOnnxDestroyOnlineRecognizer(recognizer_);
      recognizer_ = nullptr;
      throw std::runtime_error("Failed to create Zipformer streaming state");
    }
  }

  ~SherpaBackend() override {
    if (stream_) SherpaOnnxDestroyOnlineStream(stream_);
    if (recognizer_) SherpaOnnxDestroyOnlineRecognizer(recognizer_);
  }
  void Accept16k(const float *samples, std::size_t count) override {
    if (count > static_cast<std::size_t>(INT32_MAX))
      throw std::overflow_error("PCM frame count too large");
    SherpaOnnxOnlineStreamAcceptWaveform(stream_, 16000, samples,
                                        static_cast<std::int32_t>(count));
  }
  bool IsReady() override {
    return SherpaOnnxIsOnlineStreamReady(recognizer_, stream_) != 0;
  }
  Hypothesis DecodeAndGetResult() override {
    SherpaOnnxDecodeOnlineStream(recognizer_, stream_);
    const auto *r = SherpaOnnxGetOnlineStreamResult(recognizer_, stream_);
    if (!r) throw std::runtime_error("Native recognizer returned null result");
    Hypothesis h;
    if (r->text) h.text = r->text;
    if (r->tokens_arr && r->count > 0 && r->count < 100000) {
      for (int i = 0; i < r->count; ++i) {
        h.tokens.emplace_back(r->tokens_arr[i] ? r->tokens_arr[i] : "");
      }
    }
    SherpaOnnxDestroyOnlineRecognizerResult(r);
    return h;
  }
  bool IsEndpoint() override {
    return SherpaOnnxOnlineStreamIsEndpoint(recognizer_, stream_) != 0;
  }
  void Reset() override { SherpaOnnxOnlineStreamReset(recognizer_, stream_); }
  void InputFinished() override { SherpaOnnxOnlineStreamInputFinished(stream_); }
 private:
  std::string encoder_, decoder_, joiner_, tokens_, bpe_;
  const SherpaOnnxOnlineRecognizer *recognizer_ = nullptr;
  const SherpaOnnxOnlineStream *stream_ = nullptr;
};
} // namespace

std::unique_ptr<StreamingBackend> CreateSherpaBackend(
    const std::string &original_ixio_model_directory) {
  return std::make_unique<SherpaBackend>(original_ixio_model_directory);
}
} // namespace hitel
