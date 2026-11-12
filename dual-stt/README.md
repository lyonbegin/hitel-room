# HITEL dual audio STT — separate APK, no Samsung Text Call

Base: `test/call-flow-lab-v14-20261108`, commit `6041137733901fab768779551d9314fb3e37517d`.
This is a **new, independently installed app** (`app.hitel.dualaudiostt`); it does not compile `flow-lab`, `CallAccessibilityService`, `W03ConsoleActivity`, or Samsung Text Call automation. The original HITEL14 APK remains untouched.

## Reused on-device framework
- `com.github.k2-fsa:sherpa-onnx:1.12.26` and the original v14 Korean streaming Zipformer model pinned to `ba6078bca4daf3f0dd37f79d0ab505af71df14a6`.
- Independent streaming transducer recognizer + OnlineStream per input; 16 kHz mono PCM, partial/final callbacks, model download once for both channels.
- Android 10+ `AudioRecord` microphone input; on-device Korean inference.
- Android 10+ `MediaProjection` + `AudioPlaybackCaptureConfiguration` for **permitted media/game/unknown-usage playback**, with explicit OS consent and a foreground service.
- Microphone path can **acoustically** hear an external speaker or speakerphone when routing and microphone access permit it; this is a **mixed ambient signal** (the two speakers cannot be reliably separated). It does not intercept telephony RX.

## Important limits
Android `AudioPlaybackCapture` NEVER captures `USAGE_VOICE_COMMUNICATION` (ordinary carrier voice calls), protected apps, or apps disallowing playback capture. A MediaProjection session can capture silence even when output is audible. Android may silence concurrent microphone capture during a voice call. No accessibility text scraping, no forced call audio capture and no audio injection. This must be verified on the user's handset, not inferred from a green CI build.

## Test
1. Install the signed debug APK. Grant microphone permission for channel A.
2. Start **A: 마이크 STT**. Speak Korean, verify partial/final captions. For acoustic speakerphone testing, enable speakerphone on a separate phone call and check which sound is heard (the input may be silenced during calls).
3. Start **B: 미디어 출력 STT**, approve Android's system capture dialog, and play Korean video/music speech from an app that allows media capture. Verify the B caption and signal status.
4. With both on, verify independently labeled A/B partials, finals, and the signal/RMS status. Stop channels or revoke projection to release audio devices.
5. Do not claim that B can transcribe carrier downlink speech. If that is the requirement, test acoustically via A or use a supported external hardware loopback; generic app-only call RX interception is not supported.

Source: `dual-stt/app/src/main/java/app/hitel/dualaudiostt/`.
CI: `.github/workflows/build-dual-audio-stt.yml`.
Output: `downloads/HITEL14_DualAudioSTT.apk` only after successful CI build.
