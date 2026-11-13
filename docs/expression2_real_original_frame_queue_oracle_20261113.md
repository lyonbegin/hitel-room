# Expression 2 original ARM64 native frame deque oracle

**Provenance:** immutable published \`ai.bithuman:expression2-android:0.6.2\`, AAR SHA-256 \`067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584\`. Original full ARM64 function and instructions were indexed in [Actions run 43328017533](https://github.com/lyonbegin/hitel-room/actions/runs/43328017533).

## Executed function

\`FUN_001aa40c\` at RVA \`0x001aa40c\` is the **actual unmodified vendor ARM64 code** invoked by \`OriginalFrameQueueJNI.cpp\`. The runtime address is derived from original JNI feed export RVA \`0x001724d8\`. Its original first ARM64 instruction \`e80f1bfc\` is verified before execution.

An isolated, source-derived deque fixture constructs the original block layout (73 slots per block, 56 bytes per slot); source image buffer 0x124800 bytes; mutex at engine-state +0x7c; deque map at +0xb0; head index at +0xc8; queue size at +0xd0.

The comparator checks original 0-, 1-, 4-, and 8-frame variants (five cases), actual frame byte-for-byte copying, metadata including speech byte, decrementing queued count, advancing head, clearing source ownership pointer, and returning 0 without output changes on an empty queue.

**Limit:** This is an original native frame-dequeue branch test using synthetic source buffers. It does not prove original backend production, an actual IMX-generated image, \`pump()\`, JNI \`Native_pullToBuffer\` semantics, pixel color ordering, real-time FPS, session/authentication behavior, or full SDK equivalence.

Previous original PCM accumulation branch test: [Actions run 43360143421](https://github.com/lyonbegin/hitel-room/actions/runs/43360143421), six cases, failures zero.
