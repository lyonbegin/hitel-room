# HITEL Android common dialer — emulator verification v0.3.0

Separate branch: feature/samsung-callassistant-native-20261106
Package: app.hitel.callnative, Android 10+.

## Supported Android standard functions
- RoleManager.ROLE_DIALER; TelecomManager.placeCall; InCallService telephony call lifecycle.
- Incoming-call notification, answer, reject, disconnect, hold/unhold, mute, route speaker, DTMF.
- On-device only SpeechRecognizer (API 31+ and offline engine required).
- Android local TextToSpeech (only if selected voice does not require network).

## Removed dependencies
- No Samsung private Audio HAL commands, no Shizuku, no root, no SIP/PBX, no call relay server.
- No external network audio transfer; SpeechRecognizer uses only on-device recognition.

## Known technical boundary
- Being a default dialer does not grant access to cellular downlink PCM or inject TTS into uplink.
- Captions in VoiceLab are microphone test only, not the other party's actual call audio.
- No translation engine, true call recording or translated TTS uplink has been implemented.

## GitHub Actions
- .github/workflows/build-callassistant-native.yml: build and apk signing.
- .github/workflows/test-callassistant-emulator.yml: real Android AVD boots, install, launch, dialer role, GSM virtual call test, logs/screenshots.
- callassistant-native/ci/emulator-smoke.sh: ADB smoke tests. Test failure does not count as completed.

## Build
gradle -p callassistant-native :app:assembleDebug
