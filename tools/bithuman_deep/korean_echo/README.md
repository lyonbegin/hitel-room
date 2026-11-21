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

Workflow: `.github/workflows/essence2-korean-echo-r3.yml` on
`feature/hitel-korean-echo-r3-20261121`. The installation label is
`HITEL KO Echo R3`; its screen status starts with `R3` and diagnostics include
`build=KO_ECHO_R3`. Other PCM-file experiments keep their own branch/workflow.
The workflow downloads the official model and pinned runtime, records their
SHA256 hashes, embeds the model, and checks the avatar JNI against the original
AAR. It installs the built APK on Android 15 with networking disabled and submits
two Korean texts through the existing input field. A debug-only broadcast fills
the existing text controller (the Android shell cannot type Korean Unicode);
Android's real Enter key performs the submission. It invokes the same UI send,
WebSocket server and local TTS used by manual typing. It does not inject PCM.
The probe checks input hashes, distinct generated PCM hashes, complete speaker
writes, actual mouth frames, return to idle, and early PCM delivery. It records
whether actual speaker writes/presentation preceded the final synthesis callback;
that measurement is reported rather than inferred from chunk counts.

`tests/KoreanSpeechAudioTest.kt` is a platform-free JVM check of sample duration,
arbitrary callback boundaries, early packet delivery and Korean clause splitting.
It also checks the concrete callback's `invoke(float[]): java.lang.Integer`
descriptor used by sherpa's JNI reflection. A Kotlin indy lambda at this boundary
only exposes an erased method after D8 and causes an ART NoSuchMethodError abort.
The local synthesised PCM retained for diagnostics is one overwritten file,
`files/hitel-echo-latest.pcm`; no growing audio history is stored.

R3 releases the Essence2 adapter monitor before native `feed`, `endOfAudio`,
availability snapshots and idle-cursor stepping on the active text stream's
feed/render path. The original serial feeding worker still orders incoming audio
and turn-end; the native SDK keeps its own thread safety. This lets the render
thread publish completed frames while the feed/tail native call is waiting.
R2 held the adapter monitor across these calls and recorded render monitor waits
as long as 138.8 seconds in the emulator. Original reset and deferred-utterance
handling remain; this text-only UI interrupts playback before each new input.
The display keeps the half-size Texture and scales the original bitmap into it.

This build is a text echo, with no AI generation and no prerecorded reply.
