# Expression 2 — actual original ARM64 PCM-accumulation branch oracle

This extension uses unmodified \`ai.bithuman:expression2-android:0.6.2\` (AAR SHA256 \`067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584\`).

Original ARM64 targets and provenance: original ELF / original full function listings [GitHub Actions run 43328017533](https://github.com/lyonbegin/hitel-room/actions/runs/43328017533).

- \`FUN_001a7fbc\` at RVA \`0x001a7fbc\`: actual unmodified function invoked, not a C-like replay. Its first original instruction \`fd7bbaa9\` is checked at runtime.
- Original first-segment transition invokes \`FUN_001a77c0\` reset and \`FUN_001a7db0\` Canon history initialization; the resulting Canon history is compared bytewise to the original 16× repeat layout.
- PCM append calls the original \`FUN_001acf1c\`. Buffer begin/end/capacity at engine-state offsets \`0x38/0x40/0x48\`, segment count at \`0x50\`, total PCM count at \`0x58\`, step number at \`0x68\`.
- Input Float32 arrays use multiple deterministic chunks, including the 25,600 / 44,000 threshold boundaries and growth beyond the 64,000-float initial buffer. Their raw Float32 bytes, sizes, and capacity are compared to a separate vector candidate after each original call.
- **Very important limitation:** this oracle constructs **minimal synthetic native engine state** with backend marked inactive, Canon input/history allocated, and output-backpressure limit set to zero. This permits exercising the original accumulation branch while guaranteeing the model inference branch should not be invoked. It is not equivalent to an initialized, authorized, live original SDK render session.
- No backend execution, real-time video generation, end-to-end feed/pump/pull or full scheduler parity is claimed.

Previous real-original numeric oracle already passed: [11 vector insert cases + 12 schedule pre-inference guards, run 43359253131](https://github.com/lyonbegin/hitel-room/actions/runs/43359253131).

Files: \`experiments/bithuman-expression2-oracle/OriginalFeedAccumulationJNI.cpp\`, \`MainActivity.kt\`, \`test_original_emulator.sh\`, \`.github/workflows/expression2-original-dsp-oracle.yml\`.
