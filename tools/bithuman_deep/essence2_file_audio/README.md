# Essence2 synchronized file playback

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
4. The decoder sends 16 kHz PCM through the existing file loopback. The
   synchronized player feeds the same PCM to the SDK without resampling.
5. The original Essence2 engine prebuffers four finished frames with further
   motion ready, or starts under its existing short-reply policy. One frame
   covers 640 samples. The player pairs PCM with the frame before writing
   speech to AudioTrack. The presenter uses AudioTimestamp at display vsync
   and displays the newest due frame.
6. If the renderer runs late, the player holds the last frame and sends silence
   to keep AudioTrack fed. Speech waits for its matching frame. The original
   per-reply tail drain can use the last frame after the engine finishes.
7. A new text cancels the old stream. The player's epoch and the engine's
   generation discard old audio and video across the turn boundary.

The original native JNI, model and hardware surface implementation are reused.
The same APK exposes these debuggable settings. Reload the avatar after a change.

| ADB property | Values |
| --- | --- |
| `debug.bh.e2.sync` | `0` synchronized, `2` direct comparison |
| `debug.bh.e2.height` | `0` native resolution, `720` SDK 720p |
| `debug.bh.e2.clock` | `0` synchronized default, `1` enables SDK skip-ahead in synchronized mode, `2` disables it |
| `debug.bh.marker.every` | `0` off, `25` a white-frame/click capture marker every 25 voiced units in synchronized mode |

## Diagnostics

Copied diagnostics include
`build=PCM16_GPU_SYNC_CONTROL_20261121`, `STT=false`, `TTS=false`.
`MY_PACKAGE_REPLACED` clears old logs after an APK update; first launch also
checks the install/update timestamp. Only four named diagnostic files are
removed. Models and credentials are not traversed or deleted. A second button
clears logs while running; native trace clearing is serialized on its writer.
Copied logs contain only the current files' bounded tails (about 18 KB), not
the previous rotated trace. Native files rotate at 512 KiB and the protocol
log is capped at 128 KiB.

Useful events are `file.response.begin`, `file.decode.begin`,
`file.source.format`, `file.first_segment` (`beforeFileEnd=true`),
`file.first_pcm`, `file.pcm.progress`, `file.decode.done`,
`file.response.end`, `sync.route`, `sync.pull`, `sync.audio.commit`, and
`sync.present`. `kind=H` and `spokenSamples=0` indicate a hold during render
starvation. Report SDK pull timing, unique shown frames, render holds and
actual captured lip-sync separately.

## Verification limits

Workflow: `.github/workflows/essence2-file-reply-r4.yml`.
The APK is built and its original native/model hashes are checked. JVM checks
exercise the reused real chunker at 48-to-16-kHz conversion, first callback
before source end, 100-ms packets and continuous PCM; these do not execute an
Android AAC decoder. A separate JVM filesystem check verifies reset on an
install change and preservation of model/credential files.
This workflow does not run an emulator or claim a Galaxy GPU/speaker test.
