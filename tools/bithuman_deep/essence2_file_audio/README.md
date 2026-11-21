# Essence2 audio-master file playback

This installation test deliberately performs no STT, TTS or AI answering.
Entering any nonblank text triggers the same existing public test speech file.
The bundled test voice is English; it is not a Korean synthesis model or the
private call recording mentioned in the older HITEL14 conversation.

## Reused source and connection

`FilePcmStream.java` is adapted from the existing HITEL14 source:

https://github.com/lyonbegin/hitel-room/blob/feature/hitel14-v23-integrated-direct-pcm-stt-20261112/sherpa-original-launcher/app/src/main/java/app/hitel/sherpaoriginalcli/FilePcmStream.java

Original Git blob: `c85110ed5624d023da9178cdfca5e3ee03038030`.
The package changes to the avatar plugin's package; the old 4-second chunk size
becomes 100 ms. `decodeAsset` adds a direct APK AssetFileDescriptor input. The
MediaExtractor/MediaCodec packet loop and stateful mono/16-kHz conversion are
retained. No whole-file byte load, PCM conversion or temporary file staging is
used at runtime. The M4A asset is stored uncompressed in the APK for direct
descriptor access; its audio is AAC, generated from the existing test fixture
only during the build.

1. The real text field sends `conversation.item.create` / `response.create`.
2. `HitelFileReply` starts the file decoder only for that text request. The
   automatic initial greeting returns no voice.
3. `FilePcmStream` emits up to 100 ms of 16-kHz mono PCM16 per callback.
4. The decoder sends 16 kHz PCM through the file loopback. Separate workers
   feed the SDK and write the original PCM to AudioTrack without resampling.
5. Before audio starts, the player waits up to two seconds for SDK ordinal 0.
   After that opening wait, AudioTrack writes the source PCM at its original
   rate. Android AudioTimestamp provides the estimated presentation position,
   with playbackHeadPosition as a logged fallback.
6. The SDK ordinal maps to the PCM interval [ordinal × 640, ordinal × 640 + 640),
   clipped at EOF. The presenter selects the newest due SDK frame at vsync.
   A frame is discarded if the audio has passed its window by another 40 ms.
   SDK skip-ahead remains active. The screen holds when no usable frame is ready.
7. A new text invalidates the previous audio and video timeline and clears
   queued frames. The audio stream completes at its original sample count.

The original native JNI, model and hardware surface implementation are reused.
The same APK exposes these debuggable settings. Reload the avatar after a change.

| ADB property | Values |
| --- | --- |
| `debug.bh.e2.sync` | `0` audio-master, `2` direct frame presentation |
| `debug.bh.e2.height` | `0` native resolution, `720` SDK 720p |
| `debug.bh.e2.clock` | `0` SDK skip-ahead, `2` disables SDK skip-ahead |

## Diagnostics

Copied diagnostics include
`build=PCM16_SDK_TIMELINE_20261122`, `STT=false`, `TTS=false`.
`MY_PACKAGE_REPLACED` clears old logs after an APK update; first launch also
checks the install/update timestamp. Only four named diagnostic files are
removed. Models and credentials are not traversed or deleted. A second button
clears logs while running; native trace clearing is serialized on its writer.
Use **상세 로그 공유** after a reply. The ZIP contains the complete current
trace (and the retained previous segment), `frame_timeline.csv` and
`sdk_internal_timing.csv`. The clipboard action supplies a short tail.

- `frame_timeline.csv` joins each ordinal to source samples and timestamps for
  PCM arrival, feeding, speaker writes, SDK return, display and dropping.
  Ordinals with no SDK return remain visible in the table.
- `sdk_internal_timing.csv` includes probes inserted at JNI call sites inside
  the SDK AAR, SDK native GPU/CPU diagnostic messages, and SDK thread CPU ticks.
  A native diagnostic marked `stderr` is timestamped at capture
  and has no original thread ID. `sdk.probe.ready` reports available transports.
- `sync.preroll` and `audio.clock.first` cover startup.
  `audio.finish` includes PCM SHA-256 for comparison with `file.decode.done`.

The diagnostic APK enables detailed GPU timing flags, which can change measured
performance. Individual GPU kernel and physical speaker/display timing still
depend on the device's telemetry.

## Verification limits

Workflow: `.github/workflows/essence2-file-reply-r4.yml`.
The APK is built and its original native/model hashes are checked. JVM checks
exercise the reused real chunker at 48-to-16-kHz conversion, first callback
before source end, 100-ms packets and continuous PCM; these do not execute an
Android AAC decoder. A separate JVM filesystem check verifies reset on an
install change and preservation of model/credential files.
This workflow does not run an emulator or claim a Galaxy GPU/speaker test.
