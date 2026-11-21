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
`build=PCM16_EXTERNAL_TRACE_20261122`, `STT=false`, `TTS=false`.
`MY_PACKAGE_REPLACED` clears old logs after an APK update; first launch also
checks the install/update timestamp. The clear button resets the named
diagnostic files while the app is running.
**상세 로그 공유** includes the current app trace, the retained previous segment,
`hitel_e2_startup.log`, and `frame_timeline.csv`. The clipboard includes a
startup excerpt alongside the recent app events.

- `frame_timeline.csv` joins each ordinal to source samples and timestamps for
  PCM arrival, feeding, speaker writes, SDK return, display and dropping.
  Ordinals with no SDK return remain visible in the table.
- `sync.preroll`, `audio.clock.first`, and the first generated and displayed
  frames cover startup.
  `audio.finish` includes PCM SHA-256 for comparison with `file.decode.done`.

### Capture from a host over ADB

Connect the Android device over ADB, open HITEL, and run this from the
repository root. Trigger the M4A playback when the script starts recording.

```sh
bash tools/bithuman_deep/essence2_file_audio/capture_perfetto.sh 90
```

Open `hitel.perfetto-trace` in [Perfetto](https://ui.perfetto.dev/). The capture
requests CPU scheduling, frequency changes, graphics, audio and Android's
frame timeline where supported by the device. Inspect the `e2-motion`,
`e2-stageA/B/C` and `e2-live-pull` threads alongside the
`HITEL.e2.pullHardwareBuffer` app slice and SurfaceFlinger. The capture also
pulls the available app logs. Per-kernel GPU data depends on device support.

The SDK's rendering classes and native library use the vendor originals.
The debug build keeps its existing one-method local meter URL redirection.

## Verification limits

Workflow: `.github/workflows/essence2-file-reply-r4.yml`.
The workflow checks the built APK's original native/model bytes and verifies
the debug meter is the only edited vendor JVM method. Galaxy playback and
external trace capture require a connected device.
