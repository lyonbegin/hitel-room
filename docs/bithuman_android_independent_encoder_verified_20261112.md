# Verified independent Expression 2 model execution on Android 14 emulator

Date of run: 2026-11-12 UTC
GitHub successful run: https://github.com/lyonbegin/hitel-room/actions/runs/43230843459
Independent APK artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43230843459/artifacts/13949159251
Android screenshot/Logcat/ADB artifact: https://github.com/lyonbegin/hitel-room/actions/runs/43230843459/artifacts/13949384313

## Exact experiment

- Android 14 / API 34 x86_64 Google APIs emulator, KVM acceleration, 4GB configured RAM.
- App code: experiments/bithuman-independent-android/MainActivity.kt
- APK built with Google LiteRT 1.4.2 Interpreter API, no bitHuman Android SDK.
- The app embeds a 158,524,428-byte public model member combined_litert.tflite extracted from the Wise Pup IMX.
- No bitHuman API Secret, authorization, cloud model generation or license patching.
- App invokes TFLite signature enc using generated 16 kHz sinewave input (220Hz + 440Hz), then directly passes its actual enc result to signature tok14.
- Android UI and Logcat display verified output sizes, model computation timing and SHA-256 output fingerprints.
- The app is a native model execution test only. It neither renders facial video nor trains new avatars.

## Direct Android ADB and Logcat proof

    ro.product.cpu.abi=x86_64
    ro.product.cpu.abilist=x86_64,arm64-v8a
    IMX_LOCAL_START runtime=Google-LiteRT; vendor-sdk=NONE; api-secret=NONE
    MODEL_MAPPED bytes=158524428 ms=0
    ENC_PASS shape=[1,55,12,768] ms=906 sha256=07f79252acb6654cd272dedd022e62ddace17687b9c2a52810e60d953fd788e0
    TOK14_PASS shape=[1,14,16,384] ms=58 sha256=723b04381eb1741fc0df9e8702957b1a34d82d2fac0b7c627dd61cabf42ea54b
    INDEPENDENT_ANDROID_CPU_PASS two signatures; rendering NOT tested
    ANDROID14_REAL_MODEL_INFERENCE_PASS

Build job PASS, emulator job PASS. Proof includes screenshot.png, ui.xml, encoder-logcat.txt, full-logcat.txt, meminfo.txt, apk-sha256.txt.

## CPU host cross-check

A separate independent GitHub Ubuntu x86_64 job executed all five Expression2 TFLite signatures with Google LiteRT 2.3.0, as recorded in:
https://github.com/lyonbegin/hitel-room/actions/runs/43229511340
- enc: 0.10191 sec, [1,55,12,768]
- tok14: 0.00139 sec, [1,14,16,384]
- step: 0.0713 sec, [1,16,90,52]
- dec8: 0.89602 sec, [8,3,720,416]
- dec16: 1.74073 sec, [16,3,720,416]
- Peak process RSS after dec16: 1,665,132 KB.

Only enc -> tok14 is a verified natural data transfer. Step used a synthetic zero latent and the first available 14-bank token. dec8 and dec16 used synthetic zero tensors, not the actual identity+motion prepared input.

## Remaining scope

- Implement correct iterative step scheduler and true decoder feature composition using IMX member canon.bin.
- Run real face frames from correct conditioning, validate against bundled idle.mp4.
- Run real audio-to-frame lip sync on Android and measure frame rate.
- Implement new avatar creation from arbitrary user photos as a completely separate pipeline.

No output above proves true talking-head rendering, live speech synchronisation or audio-to-face fidelity.
