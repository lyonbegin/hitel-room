#ifndef EXPRESSION2_STREAM_STATE_H
#define EXPRESSION2_STREAM_STATE_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Independent, pre-inference state only. NO inference, frames, license bypass. */
typedef struct Expr2StreamState Expr2StreamState;
enum {
  EXPR2_STREAM_OK = 0,
  EXPR2_STREAM_NOT_READY = 1,
  EXPR2_STREAM_BACKPRESSURED = 2,
  EXPR2_STREAM_INFERENCE_NOT_IMPLEMENTED = 3,
  EXPR2_STREAM_INVALID_ARGUMENT = -1,
  EXPR2_STREAM_INVALID_STATE = -2
};
typedef struct Expr2StreamSnapshot {
  uint64_t pcm_samples;
  uint64_t scheduled_samples;
  uint64_t total_input_samples;
  uint64_t pcm_capacity_samples;
  uint64_t queued_native_frames;
  int32_t step;
  int32_t frame_limit;
  uint8_t segment_open;
  uint8_t tail_pending;
  uint8_t canon_history_initialized;
} Expr2StreamSnapshot;
/* The canonical bytes are copied; caller retains ownership of its input. */
Expr2StreamState* expression2_stream_create(const void* canon, size_t canon_bytes);
/* feed copies exact input float32 bytes (no resampling or quantization). */
int expression2_stream_feed(Expr2StreamState* s, const float* pcm, size_t count);
/* Clamp scheduled end sample only if 0 < end_sample < current sample count. */
int expression2_stream_end_segment(Expr2StreamState* s, int64_t end_sample);
/* Pre-inference scheduler guard only; never invokes the ML encoder/backend. */
int expression2_stream_scheduler_precheck(const Expr2StreamState* s);
int expression2_stream_snapshot(const Expr2StreamState* s, Expr2StreamSnapshot* result);
/* Return EXPR2_STREAM_INVALID_ARGUMENT when output cannot hold all samples. */
int expression2_stream_copy_pcm(const Expr2StreamState* s, float* output, size_t capacity);
/* Preprocess the first complete 44000-sample window ONLY. This is not a
 * certification of original FUN_001a8500's encoder windowing semantics. */
int expression2_stream_preprocess_first_window(const Expr2StreamState* s,
                                               float* output, size_t output_samples);
/* Source-derived FUN_001a8500 window: step0 copies 25,600 then zeros,
 * step1 copies 44,000 from offset0, subsequent steps slide by 25,600.
 * Only readiness/PCM/copy semantics are source-grounded; no live backend
 * scheduling/backpressure/renderer parity is claimed. */
int expression2_stream_next_window(const Expr2StreamState* s,
                                   float* output, size_t output_samples);
/* A complete independent inference window must finish before advancing. */
int expression2_stream_finish_window(Expr2StreamState* s);
int expression2_stream_reset(Expr2StreamState* s);
void expression2_stream_destroy(Expr2StreamState* s);
#ifdef __cplusplus
}
#endif
#endif
