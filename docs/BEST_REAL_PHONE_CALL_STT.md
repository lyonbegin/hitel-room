# BEST REAL PHONE CALL STT — 실전화 통화 STT 최우선 기준본

사용자 지정 기준본: 2026-11-29. **실제 삼성 전화 통화 STT 개발을 재개할 때 이 브랜치와 아래 APK 빌드 커밋을 먼저 사용한다.** 현재까지 비교한 네 가지 실기기 버전 중 사용자가 선정한 최우선 정상본이며, 모든 STT 엔진을 대상으로 한 보편적 성능 순위는 아니다.

## 고정된 빌드 출처

- Repository: `lyonbegin/hitel-room`
- Stable discovery branch: `stable/phone-call-stt-best-20261129`
- Exact APK source commit: `7fb7c68e2c526773d65782baf9e90aa0906fc8d9`
- Release tag: `ixio-v14-buffer1024-only-7fb7c68-20261129`
- APK: [HITEL_IXIO_V14_Buffer1024_Only_20261129.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-v14-buffer1024-only-7fb7c68-20261129/HITEL_IXIO_V14_Buffer1024_Only_20261129.apk)
- APK size: 22,058,052 bytes
- APK SHA256: `020ffe9e21ff6e2b3b83aecea2ca2d016a90f9c143ad90d0feddfd6502284bc4`
- Build: https://github.com/lyonbegin/hitel-room/actions/runs/46167832663
- Previous successful 200ms baseline: `1fa6e53159fa85abd31880f7e5cad0e699130038`

## 실제 통화 검증

Local diagnostic source (not published): Galaxy-16kHz-AudioRoute-20261129-020640-3370290.zip, events.jsonl 2,402 rows. Galaxy Z Fold4 SM-F936N, Android API 35. Original IXIO speechSDK READY confirmed. PCM 16kHz mono; 340 sampled full frames of 512 samples and one final remainder of 341 samples. Decoded 2,785,962 bytes = 1,392,981 samples; SDK recognized 1,392,981 samples; no sample discrepancy in this run. First PCM queued at elapsed 3733 ms; first changed partial at 4329 ms (596 ms after first queue event). 99 partial changes, 9 final segments, 2725 total SDK calls including tail; final drain 439 ms, queue 0, sdkCompleted true, failed false. SESSION_END USER_STOP. These timestamps do not establish absolute speech-to-screen latency; no external synchronized audio ground truth.

## 보존할 구현

- Samsung phone call -> growing recording M4A -> AAC follower / MediaCodec -> FIR 48kHz to 16kHz mono PCM16 -> original FIFO -> original IXIO SpeechInference -> V14 captions.
- Compared with 200ms baseline, exactly one runtime source line changed in StreamingAacPcmDecoder.java: PCM_WINDOW_BYTES=1024 (formerly RATE*2/5). No Framer, no forced pacing/sleep, no new Consumer or logging logic.
- Original end-of-stream remainder handling and original SDK tail silence retained.
- Original IXIO model assets imported separately; this is a validated application/pipeline baseline, not a newly trained model.
- Do not overwrite this baseline, merge experimental changes into it, or substitute the older forced pacing / Framer versions. Start future experiments from the exact APK source commit in a new branch. Keep existing app behavior unless user explicitly requests a change.

Search keywords: BEST REAL PHONE CALL STT, 실전화 통화 STT 최우수 정상본, 실제 전화 STT, IXIO V14 Buffer1024 Only, 삼성 통화녹음.
