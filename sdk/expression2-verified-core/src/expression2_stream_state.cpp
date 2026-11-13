#include "../include/expression2_stream_state.h"
#include "../include/expression2_verified_core.h"
#include <algorithm>
#include <cstring>
#include <limits>
#include <mutex>
#include <new>
#include <vector>

struct Expr2StreamState {
  mutable std::mutex guard;
  std::vector<uint8_t> canon;
  std::vector<uint8_t> history;
  std::vector<float> pcm;
  uint64_t scheduled_samples = 0;
  uint64_t total_input_samples = 0;
  uint64_t queued_native_frames = 0;
  int32_t step = 0;
  int32_t frame_limit = 0; // no real encoder attached: infer is NEVER attempted
  bool open = false;
  bool tail = false;
  bool history_ready = false;
};

namespace {
constexpr size_t kInitialPcmCapacity = 64000;

bool initialize(Expr2StreamState& s) {
  if (expression2_verified_canon_history(s.canon.data(), s.canon.size(),
                                         s.history.data(), s.history.size()) != 0)
    return false;
  s.history_ready = true;
  return true;
}

// Thresholds were observed from unmodified FUN_001a80dc in a synthetic
// engine whose inference capacity was deliberately exhausted. These do not
// assert any encoder tensor shapes or full scheduler behavior.
bool threshold_reached(const Expr2StreamState& s) {
  if (!s.open) return false;
  if (!s.tail) {
    uint64_t required = 0;
    if (s.step == 0) required = 25600;
    else if (s.step == 1) required = 44000;
    else {
      const auto step = static_cast<uint64_t>(s.step);
      if (step > (std::numeric_limits<uint64_t>::max() - 18400u) / 25600u)
        return false;
      required = step * 25600u + 18400u;
    }
    return s.scheduled_samples >= required;
  }
  // Mirror the original-oracle's truncations; do not round to nearest.
  const double coarse = static_cast<double>(s.scheduled_samples) / 800.0;
  const auto outer = static_cast<int64_t>((static_cast<double>(
      static_cast<int64_t>(coarse)) + 11.0) / 32.0);
  const int64_t required = std::max<int64_t>(1, outer);
  return static_cast<int64_t>(s.step) < required;
}
}

extern "C" Expr2StreamState* expression2_stream_create(const void* canon,
                                                        size_t canon_bytes) {
  if (!canon || canon_bytes != EXPR2_CANON_IN_BYTES) return nullptr;
  try {
    Expr2StreamState* s = new Expr2StreamState();
    try {
      const auto* bytes = static_cast<const uint8_t*>(canon);
      s->canon.assign(bytes, bytes + canon_bytes);
      s->history.resize(EXPR2_CANON_OUT_BYTES);
      s->pcm.reserve(kInitialPcmCapacity);
      if (!initialize(*s)) { delete s; return nullptr; }
      return s;
    } catch (...) { delete s; return nullptr; }
  } catch (...) { return nullptr; }
}

extern "C" int expression2_stream_feed(Expr2StreamState* s,
                                        const float* pcm, size_t count) {
  if (!s || (count && !pcm)) return EXPR2_STREAM_INVALID_ARGUMENT;
  std::lock_guard<std::mutex> lock(s->guard);
  if (s->tail) return EXPR2_STREAM_INVALID_STATE;
  if (count > std::numeric_limits<uint64_t>::max() - s->total_input_samples ||
      count > s->pcm.max_size() - s->pcm.size())
    return EXPR2_STREAM_INVALID_ARGUMENT;
  try {
    // The original feed-state oracle proved float32 value/size/capacity
    // parity in the deliberately backpressured/no-inference branch.
    if (count) s->pcm.insert(s->pcm.end(), pcm, pcm + count);
  } catch (...) { return EXPR2_STREAM_INVALID_STATE; }
  s->total_input_samples += count;
  s->scheduled_samples += count;
  s->open = true;
  return EXPR2_STREAM_OK;
}

extern "C" int expression2_stream_end_segment(Expr2StreamState* s,
                                                int64_t end_sample) {
  if (!s) return EXPR2_STREAM_INVALID_ARGUMENT;
  std::lock_guard<std::mutex> lock(s->guard);
  // Observed in FUN_001a8230's 11 pre-inference original cases.
  if (s->open) {
    if (end_sample > 0 && static_cast<uint64_t>(end_sample) < s->scheduled_samples)
      s->scheduled_samples = static_cast<uint64_t>(end_sample);
    s->tail = true;
  }
  return EXPR2_STREAM_OK;
}

extern "C" int expression2_stream_scheduler_precheck(const Expr2StreamState* s) {
  if (!s) return EXPR2_STREAM_INVALID_ARGUMENT;
  std::lock_guard<std::mutex> lock(s->guard);
  if (!threshold_reached(*s)) return EXPR2_STREAM_NOT_READY;
  if (s->frame_limit <= 0 ||
      static_cast<uint64_t>(s->frame_limit) <= s->queued_native_frames)
    return EXPR2_STREAM_BACKPRESSURED;
  // Even if capacity were supplied, there is NO inference path in this module.
  return EXPR2_STREAM_INFERENCE_NOT_IMPLEMENTED;
}

extern "C" int expression2_stream_snapshot(const Expr2StreamState* s,
                                             Expr2StreamSnapshot* result) {
  if (!s || !result) return EXPR2_STREAM_INVALID_ARGUMENT;
  std::lock_guard<std::mutex> lock(s->guard);
  *result = Expr2StreamSnapshot{};
  result->pcm_samples = s->pcm.size();
  result->scheduled_samples = s->scheduled_samples;
  result->total_input_samples = s->total_input_samples;
  result->pcm_capacity_samples = s->pcm.capacity();
  result->queued_native_frames = s->queued_native_frames;
  result->step = s->step;
  result->frame_limit = s->frame_limit;
  result->segment_open = s->open;
  result->tail_pending = s->tail;
  result->canon_history_initialized = s->history_ready;
  return EXPR2_STREAM_OK;
}

extern "C" int expression2_stream_copy_pcm(const Expr2StreamState* s,
                                             float* output, size_t capacity) {
  if (!s) return EXPR2_STREAM_INVALID_ARGUMENT;
  std::lock_guard<std::mutex> lock(s->guard);
  if (capacity < s->pcm.size() || (!output && !s->pcm.empty()))
    return EXPR2_STREAM_INVALID_ARGUMENT;
  if (!s->pcm.empty()) std::memcpy(output, s->pcm.data(),
                                    s->pcm.size() * sizeof(float));
  return EXPR2_STREAM_OK;
}

extern "C" int expression2_stream_preprocess_first_window(
    const Expr2StreamState* s, float* output, size_t output_samples) {
  if (!s || !output || output_samples != EXPR2_PREPROCESS_OUT_SAMPLES)
    return EXPR2_STREAM_INVALID_ARGUMENT;
  std::vector<float> input;
  {
    std::lock_guard<std::mutex> lock(s->guard);
    if (s->pcm.size() < EXPR2_PREPROCESS_IN_SAMPLES)
      return EXPR2_STREAM_NOT_READY;
    try { input.assign(s->pcm.begin(),
                       s->pcm.begin() + EXPR2_PREPROCESS_IN_SAMPLES); }
    catch (...) { return EXPR2_STREAM_INVALID_STATE; }
  }
  return expression2_verified_preprocess(input.data(),input.size(),
       output,output_samples)==0 ? EXPR2_STREAM_OK : EXPR2_STREAM_INVALID_STATE;
}

extern "C" int expression2_stream_reset(Expr2StreamState* s) {
  if (!s) return EXPR2_STREAM_INVALID_ARGUMENT;
  std::lock_guard<std::mutex> lock(s->guard);
  s->pcm.clear();
  s->scheduled_samples = 0;
  s->total_input_samples = 0;
  s->queued_native_frames = 0;
  s->step = 0;
  s->open = false;
  s->tail = false;
  return initialize(*s) ? EXPR2_STREAM_OK : EXPR2_STREAM_INVALID_STATE;
}
extern "C" void expression2_stream_destroy(Expr2StreamState* s) { delete s; }
