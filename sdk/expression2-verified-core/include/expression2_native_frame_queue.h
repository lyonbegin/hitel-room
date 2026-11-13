#ifndef HITEL_EXPRESSION2_NATIVE_FRAME_QUEUE_H
#define HITEL_EXPRESSION2_NATIVE_FRAME_QUEUE_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Native output ownership reconstruction from observed original stages
 * FUN_001a7a04 -> FUN_001aa40c, NOT the vendor's asynchronous backend.
 * No vendor machine code is linked. Each 416x720 pixel frame is 1198080 B. */
#define EXPR2_OUTPUT_FRAME_PIXELS (416 * 720)
typedef struct Expr2NativeFrameQueue Expr2NativeFrameQueue;
Expr2NativeFrameQueue* expression2_frame_create(void);
/* Explicit staging copies the frame once into a uniquely owned native buffer. */
int expression2_frame_stage(Expr2NativeFrameQueue* queue, uint64_t index,
                             const int32_t* pixels, size_t count);
/* Pump moves unique ownership from staged to ready; the source is invalidated. */
int expression2_frame_pump(Expr2NativeFrameQueue* queue);
/* 0 = popped, 1 = empty; releases native frame after copy to caller. */
int expression2_frame_pop(Expr2NativeFrameQueue* queue, int32_t* out_pixels,
                            size_t count, uint64_t* out_index);
size_t expression2_frame_available(const Expr2NativeFrameQueue* queue);
void expression2_frame_destroy(Expr2NativeFrameQueue* queue);
#ifdef __cplusplus
}
#endif
#endif
