#ifndef EXPRESSION2_VERIFIED_CORE_H
#define EXPRESSION2_VERIFIED_CORE_H
#include <stddef.h>
#ifdef __cplusplus
extern "C" {
#endif

/*
 * Independent functions copied from the original-BINARY-comparison-verified
 * reconstruction. These APIs never load libexpr2jni.so, do not use its
 * metering/auth/session logic, and do not imply a full Expression2 SDK.
 * Build on ARM64 with -O2 -ffp-contract=off.
 */
#define EXPR2_PREPROCESS_IN_SAMPLES 44000
#define EXPR2_PREPROCESS_OUT_SAMPLES 35200
#define EXPR2_CANON_IN_BYTES 299520
#define EXPR2_CANON_OUT_BYTES 4792320

/* Return 0 on success; -1 for null pointer or invalid dimensions. */
int expression2_verified_preprocess(
    const float *input, size_t input_samples,
    float *output, size_t output_samples);
int expression2_verified_canon_history(
    const void *canon, size_t canon_bytes,
    void *history, size_t history_bytes);

#ifdef __cplusplus
}
#endif
#endif
