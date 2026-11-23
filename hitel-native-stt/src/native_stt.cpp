#include "hitel_native_stt.hpp"

#include <chrono>
#include <stdexcept>
#include <utility>
#include <vector>

namespace hitel {
namespace {
using Clock = std::chrono::steady_clock;
std::int64_t NowNs() {
  return std::chrono::duration_cast<std::chrono::nanoseconds>(
      Clock::now().time_since_epoch()).count();
}
std::int64_t MicrosSince(Clock::time_point from) {
  return std::chrono::duration_cast<std::chrono::microseconds>(
      Clock::now() - from).count();
}
} // namespace

NativeSttEngine::NativeSttEngine(std::unique_ptr<StreamingBackend> backend,
                               CaptionCallback on_caption,
                               TraceCallback on_trace)
    : backend_(std::move(backend)),
      caption_(std::move(on_caption)),
      trace_(std::move(on_trace)) {
  if (!backend_ || !caption_) {
    throw std::invalid_argument("Native STT requires backend and caption callback");
  }
}

void NativeSttEngine::AcceptPcm16Le(const std::uint8_t *pcm,
                                   std::size_t byte_count) {
  if (finished_) throw std::logic_error("PCM after InputFinished");
  if ((byte_count & 1u) != 0) throw std::invalid_argument("PCM16 odd byte count");
  if (!byte_count) return;
  if (!pcm) throw std::invalid_argument("PCM pointer is null");
  const auto began = Clock::now();
  const std::size_t count = byte_count / 2;
  std::vector<float> normalized(count);
  for (std::size_t i = 0; i < count; ++i) {
    const std::uint16_t raw =
        static_cast<std::uint16_t>(pcm[2 * i]) |
        (static_cast<std::uint16_t>(pcm[2 * i + 1]) << 8);
    const std::int16_t sample = static_cast<std::int16_t>(raw);
    normalized[i] = static_cast<float>(sample) / 32768.0f;
  }
  backend_->Accept16k(normalized.data(), count);
  samples_ += count;
  if (trace_) trace_({"PCM_ACCEPTED", samples_, decoder_steps_,
                       MicrosSince(began), false});
  DrainReady();
}

void NativeSttEngine::Emit(const std::string &text, bool final) {
  CaptionEvent e;
  e.text = text;
  e.is_final = final;
  e.audio_samples = samples_;
  e.revision = ++revision_;
  e.decoder_step = decoder_steps_;
  e.emit_ns = NowNs();
  caption_(e); // NO timer, debounce, chunk-count gate or artificial word pacing
}

void NativeSttEngine::FinalizeUtterance() {
  if (!previous_.empty()) Emit(previous_, true);
  previous_.clear();
  backend_->Reset();
}

void NativeSttEngine::DrainReady() {
  // Guard a defective backend that never advances IsReady. Do not silently
  // discard decoded audio if it loops: fail explicitly for diagnostics.
  std::size_t iterations = 0;
  while (backend_->IsReady()) {
    if (++iterations > 4096)
      throw std::runtime_error("STT decoder did not make progress");
    const auto began = Clock::now();
    auto snapshot = backend_->DecodeAndGetResult();
    ++decoder_steps_;
    const bool changed = (snapshot.text != previous_);
    if (changed) {
      previous_ = std::move(snapshot.text);
      if (!previous_.empty()) Emit(previous_, false);
    }
    if (trace_) trace_({"NATIVE_DECODE_DONE", samples_, decoder_steps_,
                        MicrosSince(began), changed});
    if (backend_->IsEndpoint()) {
      if (trace_) trace_({"NATIVE_ENDPOINT", samples_, decoder_steps_, 0, false});
      FinalizeUtterance();
    }
  }
}

void NativeSttEngine::Finish() {
  if (finished_) return;
  finished_ = true;
  backend_->InputFinished();
  DrainReady();
  // A result without endpoint is still a final utterance at EOF.
  if (!previous_.empty()) {
    Emit(previous_, true);
    previous_.clear();
  }
  if (trace_) trace_({"INPUT_FINISHED", samples_, decoder_steps_, 0, false});
}
} // namespace hitel
