# Expression 2 original function body audit: native frame queue and audio preprocessing

Date: 2026-11-13. Scope: Expression 2 only. No Essence 2, no new speculative renderer.

## Verified source

Published Maven ai.bithuman:expression2-android:0.6.2, AAR SHA256:
067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584.

- Original JVM bytecode: 92 classes, all extracted, no failures. Evidence: https://github.com/lyonbegin/hitel-room/actions/runs/43328017533/artifacts/13994215608
- Original native ARM64 machine bytes: 1,035 directly reachable functions, 65,933 instructions, all Ghidra-decompiled. Evidence: https://github.com/lyonbegin/hitel-room/actions/runs/43328017533/artifacts/13992718722
- This run: 18 selected ARM64 functions with original instruction byte SHA256 recomputed and checked; 7 actual JVM methods; 16 native direct function-call edges.
- Successful run: https://github.com/lyonbegin/hitel-room/actions/runs/43335650754
- Report JSON with source function addresses and hashes: https://github.com/lyonbegin/hitel-room/actions/runs/43335650754/artifacts/13996773294
- Confirmed CI: EXPR2_ORIGINAL_FRAME_QUEUE_PASS 18 ARM64 7 JVM 16 CALL_EDGES

## Original native frame queue

| Source function (Ghidra address) | Confirmed original behavior |
|---|---|
| FUN_001a7a04 (001a7a04) | Transfers completed asynchronous backend frames to native deque; uses mutex and condition variable |
| FUN_001a84cc (001a84cc) | Retrieves waiting frame count from engine+0xd0 under engine+0x7c mutex |
| FUN_001aa594 (001aa594) | Invokes FUN_001a8404 native pump; may invoke FUN_001a82f0 for backend flush |
| FUN_001aa40c (001aa40c) | Removes one frame under mutex, decreases native queue count, copies 0x124800 bytes to the caller, returns frame metadata and deletes internal image buffer |
| Native_pullToBuffer (00172e7c) | Requires a DIRECT ByteBuffer with capacity at least 0x124800; copies up to four metadata fields to the output long array |
| FUN_001a77c0 (001a77c0) | Clears audio, output and engine state counters; precise reset mode equivalence requires further verification |

0x124800 = 1,198,080 bytes = 416x720x4 (four bytes per pixel). Full original color channel order and all error cases are not yet proven by these static references.

IMPORTANT: JVM ArrayBlockingQueue(1024) stores input work items, not video frames. The native output-frame queue is a separate queue and its maximum capacity remains unverified.

## Original native speech input route

| Function | Confirmed source fact |
|---|---|
| Expression2Avatar.feed(float[],int,int) | Original JVM copies selected FloatArray values and puts work into the worker queue |
| Native_feed / 001724d8 | Uses JNI array-region access to transfer the requested PCM range to native code |
| FUN_001a7fbc / 001a7fbc | Initializes a new speech segment if necessary, appends PCM to native buffer, invokes scheduler |
| FUN_001a80dc / 001a80dc | Native buffered audio thresholds: first 25,600 samples, second 44,000, later index*25,600+18,400 |
| FUN_001a8500 / 001a8500 | Prepares a zero-filled 44,000-sample Float32 input window (176,000 bytes), copies a bounded PCM slice, then invokes FUN_001a9794 |
| FUN_001a9794 / 001a9794 | Original input preprocessing, window splitting and numeric operations; no bit-identical reimplementation certified |
| FUN_001a8500 / 001a8500 | Preprocessing output feeds 35,200 Float32 values to encoder (0x8980 elements); first token bank six and subsequent token bank eight |
| FUN_001a8404 / 001a8404 | Pump backend outputs, process eligible audio, complete pending tail |
| FUN_001a8230 / 001a8230 | Marks utterance end, invokes remaining buffer processing and pending-frame completion |

CORRECTION to the previous independently invented prototype: Directly feeding 35,200 raw 16-kHz PCM floats into the TFLite encoder does NOT match the original published SDK. The original uses a 44,000-sample input window and a separate preprocessing function. Ghidra inferred C-like pseudocode is not the original source text; exact param types and the transform math still require binary-level confirmation.

## Implemented in this turn

- tools/bithuman_deep/verify_expression2_frame_queue.py: source-gated original ARM64 instruction SHA256 rehash and JVM method/16 direct call edge verifier.
- .github/workflows/expression2-native-queue-proof.yml: actual GitHub replay of original SDK analysis artifacts; both key stages verified.
- No vendor binary changes or guessed alternative SDK logic.
- No Essence 2 changes.

## Remaining source verification

- Exact original preprocessor mathematics and input/output comparison with known PCM.
- Backend frame allocation, ownership across threads, native queue maximum and race conditions.
- Native direct-buffer pixel channel order and accurate frame metadata semantics.
- Original Android feed/pump/pull/flush/reset continuous interactive runtime validation.
- Exact parity on real ARM64 device; no live FPS or speech latency claim yet.

Verdict: ORIGINAL MACHINE-CODE TRACE VERIFIED, NOT YET A COMPLETE INDEPENDENT SDK.
