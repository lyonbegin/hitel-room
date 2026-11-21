# Korean local text echo for Essence2

The app keeps the existing model, screen, local session and WebSocket protocol.
Microphone input is disabled in this first Korean-only build.

1. The real input field sends `conversation.item.create` with `input_text`.
2. The existing loopback server reads that text and returns exactly that string
   as the response transcript. It calls `HitelKoreanEcho.reply` with the same text.
3. `HitelKoreanTts` runs `vits-mimic3-ko_KO-kss_low` using the pinned official
   sherpa-onnx 1.12.26 Android runtime, CPU, two inference threads.
4. Short clauses are synthesised sequentially. VITS produces a clause at a time;
   this is **not sample-by-sample incremental VITS inference**. Its callback PCM
   is forwarded before synthesising the remaining clauses.
5. Continuous 22050-to-24000 Hz resampling produces little-endian mono PCM16.
   The existing WebSocket audio delta routes it into `playSpeakerPCM`.
6. The archived original `AvatarPlayer` feeds the avatar on a worker, renders
   separately, writes the speaker and presents against the device sample clock.
   It does not JPEG-cache all frames or wait for the complete response.
7. `response.done` follows the last PCM chunk. Actual playback progress controls
   the UI, and the original player returns to its idle video after playback.

Cancellation invalidates the synthesis generation and clears native playback
through the existing text interrupt. Socket closure also cancels synthesis.
The synthesiser owns no AudioTrack, so there is only one speaker output path.

The Essence2 adapter no longer treats the first refused pull after endOfAudio as
completion. It checks the expected final ordinal, with a logged five-second
quiet fallback for an incomplete native tail. Skip-ahead is enabled for this
streaming build, so a device that renders below 25 fps can skip stale frames
while continuing the same audio. This can reduce visible mouth-frame coverage.

To connect a future AI text backend, replace the local echo text provider and
pass its returned Korean text to the same TTS/PCM path. No audio API is required.

## Build and verification

Workflow: `.github/workflows/essence2-korean-echo-stream.yml`.
The workflow downloads the official model and pinned runtime, records their
SHA256 hashes, embeds the model, and checks the avatar JNI against the original
AAR. It installs the built APK on Android 15 with networking disabled and submits
two Korean texts through the existing input field. A debug-only broadcast copies
the test text to the clipboard; Android's paste and enter keys do the submission.
The probe checks input hashes, distinct generated PCM hashes, complete speaker
writes, actual mouth frames, return to idle, and early PCM delivery. It records
whether actual speaker writes/presentation preceded the final synthesis callback;
that measurement is reported rather than inferred from chunk counts.

`tests/KoreanSpeechAudioTest.kt` is a platform-free JVM check of sample duration,
arbitrary callback boundaries, early packet delivery and Korean clause splitting.
The local synthesised PCM retained for diagnostics is one overwritten file,
`files/hitel-echo-latest.pcm`; no growing audio history is stored.

This build is a text echo, with no AI generation and no prerecorded reply.
