# Expression 2 — original PCM/frame ownership and indirect-call follow-up (2026-11-13)

Scope: ONLY ai.bithuman:expression2-android:0.6.2. Essence 2 not started. No guessed replacement pipeline.

## Immutable original code evidence

- Unmodified AAR SHA256: `067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584`.
- Source of original ARM64 listings and Ghidra reconstructions: [run 43328017533](https://github.com/lyonbegin/hitel-room/actions/runs/43328017533), original native artifact `13992718722`.
- Original 92 JVM class javap outputs: same run, artifact `13994215608`.
- New original-code audit: [run 43356784497](https://github.com/lyonbegin/hitel-room/actions/runs/43356784497), artifact `14006362184`.
- 21 targeted functions: original instruction bytes rehashed against manifest. All 1,035 indexed functions / 65,933 original ARM64 instructions inspected for register-indirect branches. 16 JVM signatures (including overloads) documented.

**Evidence rule:** Native observations below are grounded in actual original ARM64 machine-code instruction listings and their Ghidra C-like reconstruction. That reconstruction is *not* the vendor's literal C++ source and static analysis is *not* a runtime parity test.

## I. Original input: Kotlin -> JNI -> engine

1. JVM `Expression2Avatar.feed(float[], int, int)` validates range, makes an independent FloatArray copy and enqueues it. JVM has 3 feed overloads, which must not be conflated.
2. JVM `runWorker()` removes the FloatArray work item and invokes `Native.feed` on the dedicated worker. The JVM work-item queue has capacity 1,024; it is not the native video frame queue.
3. JNI `Java_ai_bithuman_expression2_Native_feed` at `001724d8` uses the JNI function table offset `0x668` to copy the requested Java FloatArray region into thread-local native Float32 storage, then calls `FUN_001a7fbc` with a native PCM pointer and sample count. The exact exception and failure paths remain to be tested.
4. On the first PCM input of an unopened segment, `FUN_001a7fbc` at `001a7fbc` invokes reset `FUN_001a77c0(param_1,0)` and Canon history initialization `FUN_001a7db0`, saves previous total-sample position, and may allocate a `0x3e800` byte initial Float32 capacity (256,000 bytes, 64,000 floats).
5. It appends the incoming `count * 4` bytes through `FUN_001acf1c`, updates `param_1[10]` from the native buffer's begin/end pointer difference divided by four, increments the cumulative sample count in `param_1[0xb]`, and calls `FUN_001a80dc`. `FUN_001acf1c` has reallocation/memmove paths; source pointers must not be assumed stable after a growth operation.

## II. Native PCM scheduler, actual source control flow

In `FUN_001a80dc` at `001a80dc`:

- The original non-tail thresholds are first `0x6400` (25,600 samples), then `44000`, then `step_index * 0x6400 + 0x47e0` (i.e. step_index*25,600 + 18,400).
- Tail mode follows a **different branch** based on sample count divided by 800 and then by 32, with a minimum step bound; it must not reuse the non-tail threshold rule.
- Engine `+0x7c` protects reading the native queue count at `+0xd0`. Scheduler also reads outstanding async backend work, formed from backend counters at `+0x500` and `+0x560` when backend-ready flags are set.
- Scheduler compares `(native queued frames + backend outstanding)` against an engine-configured limit at engine `+0x2c`; if the limit is reached it defers the next inference step. **The numerical configured limit has not been proved**; it must not be invented as '1,024' or '73'.
- Only if capacity allows does it invoke original `FUN_001a8500` and increase the step counter after success. That function builds the original 44,000-sample input window and calls original `FUN_001a9794` for preprocessing. The exact encoder/generator live-timing parity remains unproven.

## III. Original output frame ownership across threads

Producer `FUN_001a7a04` at `001a7a04`:

- Reads backend staged-frame region from backend `+0x530` to `+0x538`, where a condition-variable wait at backend `+0x418` can be involved.
- Under native engine queue mutex at `+0x7c`, copies/moves the frame slot metadata and image-buffer pointer from backend slot to the native deque's slot.
- Explicitly zeroes backend slot's image pointer and related ownership fields and increments engine native frame count. This is evidence of **transfer**, not two independent owners.
- The deque block layout in the decompiled code uses `0x49` entries per allocated block, each `0x38` bytes. **This is an internal block granularity, not a proven maximum frame-queue capacity.**

Consumer `FUN_001aa40c` at `001aa40c`:

- With mutex `engine+0x7c`, checks `engine+0xd0 != 0`, takes one slot, sets its `image pointer` to zero, advances deque head and decrements count.
- Unlocks mutex before `memcpy(caller_buffer, transferred_image_buffer, 0x124800)`. Copies frame metadata, then frees the transferred image-buffer allocation with `operator_delete`.
- The size is `0x124800 = 1,198,080` bytes, i.e. 416×720×4. This alone does not certify RGB/RGBA/BGRA byte channel order.
- JNI `Native_pullToBuffer` checks for a direct ByteBuffer and at least this much capacity. Its native JNI method-entry register-indirect calls must not be misreported as unknown AI-backend callbacks.

## IV. EndSegment / pump / reset

- `FUN_001a8230` at `001a8230` optionally reduces accepted final sample count when its end argument is inside the current range, marks tail state at offset `+0x31`, invokes `FUN_001a80dc` in tail mode and can invoke `FUN_001a82f0`. It clears open/tail flags only after its completion criteria and successful output flushing.
- `FUN_001a8404` at `001a8404` first calls output collection `FUN_001a7a04`, then attempts scheduler / tail handling and completion. `FUN_001aa594` at `001aa594` supplies an additional pump-for-pull path, possibly flushing and pumping again when async backend data remains.
- `FUN_001a77c0` at `001a77c0` resets input-sample and speech-state counters, plus protected output counters, but the two reset modes' runtime behavior and racing feed/pull remain unverified.

## V. Original register-indirect call classification

The new audit found **429** ARM64 `BLR`/`BR` sites across all 1,035 indexed functions, of which **83** lie within up to two direct-call hops from the selected stream functions. Breakdown of those 83 static sites:

| Original code category | Sites | Interpretation |
|---|---:|---|
| Five selected JNI wrappers: feed, pump, pumpForPull, pullToBuffer, endSegment | 47 | Predominantly JNI function-table dispatch (the Ghidra code explicitly uses `(*JNIEnv function table + offset)`) |
| Import thunks and adjacent runtime helpers | 32 | Most are branch-through-import entries such as `memcpy` or `TfLiteSignatureRunnerInvoke`; do not count them as AI model callbacks |
| Two unwind/runtime helpers (`FUN_002134b0`, `FUN_002132f8`) | 4 | Dynamic exception/unwinding handler callbacks |
| **Total** | **83** | **Not 83 untraced model functions** |

The key functions `FUN_001a7fbc`, `FUN_001a80dc`, `FUN_001a8500`, `FUN_001a8404`, `FUN_001a7a04`, `FUN_001aa40c`, `FUN_001a8230`, `FUN_001a77c0` contain **zero** ARM64 `BLR/BR` instructions in the verified function bodies. This does *not* prove all deeper model invocation targets: separately called functions, imported libraries, async threads and virtual calls still require source-based resolution.

## VI. Verified separate-module progress

A separate source-verified native Android test module has already passed *two* original-function comparisons:

1. `FUN_001a9794` audio preprocessing: five 35,200-Float32 output vectors, byte-identical to real original ARM64 code on the tested inputs.
2. `FUN_001a7db0` Canon history initialization: four complete 4,792,320-byte history buffers, byte-identical on tested inputs.

Existing evidence: [full two-function verification report](expression2_two_original_functions_vendor_free_bitwise_pass_20261113.md), [Android emulator run 43356046681](https://github.com/lyonbegin/hitel-room/actions/runs/43356046681).

**Those two functions are NOT equivalent to a complete Expression 2 SDK.**

## VII. Strict next implementation gate

The next independent implementation candidates are original `FUN_001a7fbc` (PCM accumulation) and `FUN_001a80dc` (segment scheduler), **in that order**. Before declaring either equivalent:

1. Capture original ARM64 state snapshots at initial feed, subsequent chunk, capacity growth, threshold crossing, backpressure and tail.
2. Compare original vs independent state: active flags, `param_1[7..11]` buffer pointers and counters, step counter, queue count, async outstanding count, error status and output frame metadata. Pointer *addresses* are allocation-specific; compare buffer contents, sizes, ownership and resulting state, not equality of pointer values.
3. Run identical chunk sequences through original SDK and independent candidate, including multiple feed sizes, no-frame short feeds, endSegment, reset before flush, and delayed pull.
4. Preserve exact original reference input/state and independent output; fail tests on deviations. Static signatures alone may not be marked as runtime parity.
5. Do not independently invent an alternative 53-frame batch, scheduler, thread or queue.

No Essence 2, no paid service, no account credentials and no source-app replacement were introduced in this audit.
