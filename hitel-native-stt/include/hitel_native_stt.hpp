#pragma once
#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <vector>

namespace hitel {

struct Hypothesis {
  std::string text;                // The COMPLETE current utterance, never a delta
  std::vector<std::string> tokens; // Diagnostic only. Text is authoritative.
};

struct CaptionEvent {
  std::string text;
  bool is_final = false;
  std::uint64_t audio_samples = 0;
  std::uint64_t revision = 0;
  std::uint64_t decoder_step = 0;
  std::int64_t emit_ns = 0;       // Steady clock; no wall-clock ambiguity
};

struct TraceEvent {
  const char *phase = "";
  std::uint64_t samples = 0;
  std::uint64_t decode_step = 0;
  std::int64_t elapsed_us = 0;
  bool text_changed = false;
};

class StreamingBackend {
 public:
  virtual ~StreamingBackend() = default;
  virtual void Accept16k(const float *samples, std::size_t count) = 0;
  virtual bool IsReady() = 0;
  virtual Hypothesis DecodeAndGetResult() = 0;
  virtual bool IsEndpoint() = 0;
  virtual void Reset() = 0;
  virtual void InputFinished() = 0;
};

using CaptionCallback = std::function<void(const CaptionEvent &)>;
using TraceCallback = std::function<void(const TraceEvent &)>;

class NativeSttEngine final {
 public:
  explicit NativeSttEngine(std::unique_ptr<StreamingBackend> backend,
                           CaptionCallback on_caption,
                           TraceCallback on_trace = {});
  // 16kHz, mono, signed little-endian PCM16. Each call is accepted in order.
  // No PCM frames are dropped, re-ordered or intentionally buffered for captions.
  void AcceptPcm16Le(const std::uint8_t *pcm, std::size_t byte_count);
  void Finish();
  std::uint64_t accepted_samples() const { return samples_; }
  std::uint64_t decoded_steps() const { return decoder_steps_; }
  std::uint64_t caption_revisions() const { return revision_; }
 private:
  void DrainReady();
  void FinalizeUtterance();
  void Emit(const std::string &text, bool final);
  std::unique_ptr<StreamingBackend> backend_;
  CaptionCallback caption_;
  TraceCallback trace_;
  std::string previous_;
  std::uint64_t samples_ = 0;
  std::uint64_t decoder_steps_ = 0;
  std::uint64_t revision_ = 0;
  bool finished_ = false;
};

} // namespace hitel
