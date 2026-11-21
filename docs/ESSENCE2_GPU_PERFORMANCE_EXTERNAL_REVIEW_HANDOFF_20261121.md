# Essence2 Android GPU 성능 병목 — 외부 개발자·AI 자문 요청서
작성 기준: 2026-11-21 (KST) · 재현 가능한 코드 기준 커밋 `282e3acd0b759090229463a5a88925dcd4d9092a`

## 0. 자문 목적 (핵심 요청)

이 문서는 **bitHuman Essence2 원본 Android SDK를 이용하여 PCM 16 kHz 음성을 실시간 아바타 영상으로 표시하는 HITEL 테스트 앱**의 GPU 성능 문제를 외부 전문가에게 맡기기 위한 인수인계서입니다.

**현재 관찰 결과:** 갤럭시 실기기에서 `gpuHardware=true`로 SDK의 HardwareBuffer 출력 경로는 활성화되지만, `pullHardwareBuffer()` 한 프레임 반환에는 보통 49~118 ms가 걸려, 25fps(프레임 예산 40ms)에 미달합니다. SDK의 재생 위치 추적(`setPlayoutPosition`)을 다시 연결하자 프레임 건너뛰기는 작동했지만 원래 생성 처리량 자체가 25fps로 개선되지는 않았습니다.

**반드시 답해야 할 질문:** (1) 모델 추론 연산이 GPU/CPU/다른 가속기 중 어디서 실행되고 있는가? (2) `pullHardwareBuffer()`이 왜 느린가? 정확히 어떤 연산/동기화/대기에서 시간이 소비되는가? (3) 원본 SDK 사용법을 존중하면서 어떤 검증 가능한 소규모 코드 변경으로 실제 25fps에 가까워질 수 있는가?

⚠️ `gpuHardware=true`는 **GPU 추론 사용의 증거가 아닙니다**. 이는 `useHardwareBuffers()` 호출이 성공하고 GPU 버퍼를 화면 전달에 사용한다는 앱 레벨 표시입니다. 마찬가지로 `pullThreadCpuMs=0`은 호출 스레드의 CPU 사용시간이 1ms 미만으로 기록됐다는 뜻이며, 다른 CPU 스레드의 연산이나 GPU 사용을 판정하지 못합니다.

## 1. GitHub 정확한 위치

- 저장소: https://github.com/lyonbegin/hitel-room
- 작업 브랜치: `feature/hitel-essence2-gpu-hardwarebuffer-20261121`
- 현재 문제 재현 코드의 **고정 기준 커밋**: `282e3acd0b759090229463a5a88925dcd4d9092a`
- 기준 트리: https://github.com/lyonbegin/hitel-room/tree/282e3acd0b759090229463a5a88925dcd4d9092a
- 변경 코드에서 테스트 APK까지 빌드한 GitHub Actions: https://github.com/lyonbegin/hitel-room/actions/runs/44909862786 (**성공**)
- 해당 테스트 APK의 GitHub Release: https://github.com/lyonbegin/hitel-room/releases/tag/hitel-essence2-gpu-clock-trace-20261121
- 직접 APK: https://github.com/lyonbegin/hitel-room/releases/download/hitel-essence2-gpu-clock-trace-20261121/HITEL_Essence2_GPU_CLOCK_TRACE_20261121_ARM64.apk
- APK SHA-256: `ad346bb6fa9a0635e3ef0d3c8be0c773f6c3a9fd3eab51f6d6af2959f0041932` (GitHub Release asset 메타데이터 확인)
- 앱 로그 빌드 식별자: `PCM16_GPU_CLOCK_TRACE_20261121`

이 문서가 추가된 이후 브랜치 HEAD는 변경될 수 있습니다. **기술 분석·소스 인용은 위 고정 커밋을 기준으로 시작하십시오.**

## 2. 우선 열어볼 소스 — 분석 순서

1. **현재 문제의 중심**  
   [`tools/bithuman_deep/essence2_file_audio/OfficialEssence2FileEngine.kt`](../tools/bithuman_deep/essence2_file_audio/OfficialEssence2FileEngine.kt)  
   - `sdk.useHardwareBuffers(HW_SLOTS)` (`HW_SLOTS=32`)
   - `runFeed()`: `sdk.feed(packet.bytes)`, `sdk.endOfAudio()`
   - `runPull()`: `sdk.setPlayoutPosition(samples)`, `sdk.pullHardwareBuffer()` 및 `sdk.lastFrameIndex`
   - `runSound()`: `AudioTrack.MODE_STREAM`, `playbackHeadPosition`, underrun
   - `video.pull`: `pullMs`, `pullThreadCpuMs`, `frameGapMs`, `sdkFrameIndex`, `gpuHardware`
2. **현재 엔진을 앱에 연결하는 빌드타임 패치**  
   [`tools/bithuman_deep/patch_essence2_official_pcm16_file.py`](../tools/bithuman_deep/patch_essence2_official_pcm16_file.py)  
   - 본 테스트에서 `BithumanPlugin.kt`의 엔진 선택을 `OfficialEssence2FileEngine`으로 대체
   - `AvatarPlayer`를 이 파일 테스트 경로에서는 우회하고, SDK 영상 → `Bitmap.wrapHardwareBuffer` → 기존 `AvatarSession.draw()`/HardwareCanvas로 직접 연결
   - 마지막 GPU 프레임 4개 보유·해제(`heldGpu`)
3. **정상 동작하던 원본 Flutter SDK의 기준 구현**  
   [`vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt`](../vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt)  
   [`.../PlayoutClock.kt`](../vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/PlayoutClock.kt)  
   [`.../BithumanPlugin.kt`](../vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt)  
   - 원본 `Essence2Engine`의 `useHardwareBuffers`, `pullHardwareBuffer`, `lastFrameIndex`, `PlayoutClock`, `AvatarPlayer`, 버퍼 큐·backpressure·프레임 건너뛰기와 직접 비교
   - 앱 테스트용 커스텀 엔진에서 사라진 제어·초기 버퍼링·backpressure가 병목에 영향을 주는지 확인
4. **테스트 입력·로그**  
   [`tools/bithuman_deep/essence2_file_audio/HitelFileAudioSource.kt`](../tools/bithuman_deep/essence2_file_audio/HitelFileAudioSource.kt)  
   [`tools/bithuman_deep/essence2_file_audio/HitelE2Trace.kt`](../tools/bithuman_deep/essence2_file_audio/HitelE2Trace.kt)  
   [`tools/bithuman_deep/essence2_file_audio/HitelDiagnostics.kt`](../tools/bithuman_deep/essence2_file_audio/HitelDiagnostics.kt)  
   [`tools/bithuman_deep/essence2_file_audio/hitel_file_reply.dart`](../tools/bithuman_deep/essence2_file_audio/hitel_file_reply.dart)
5. **실제 APK 조립·검증 절차**  
   [`.github/workflows/essence2-file-reply-r4.yml`](../.github/workflows/essence2-file-reply-r4.yml)  
   [`tools/bithuman_deep/prepare_essence2_file_reply.py`](../tools/bithuman_deep/prepare_essence2_file_reply.py)  
   - 워크플로가 bitHuman 예제 앱 및 Flutter plugin을 고정된 upstream 리비전에서 가져와 임시 경로에 조립
   - `vendor/bithuman-pristine/flutter-plugin-v2.6.37`와 공식 GitLab flutter-plugin 소스를 diff 검사
   - SDK 라이브러리는 `essence2-android 0.9.5` 기반. AAR 재패키징 과정에는 JVM meter URL getter의 제한적 패치가 있으나, 빌드 검증에서 원본 네이티브 JNI 라이브러리 바이트 동일성을 검사
   - 성공한 CI는 **APK 조립 및 다운로드 일치**를 증명할 뿐, 실기기 25fps 또는 AI GPU backend를 증명하지 않음

### 현 상태의 데이터 흐름

```text
입력: 앱 내 텍스트 입력 (STT/TTS 비활성, 고정 음성 테스트)
  -> 로컬 테스트 M4A를 MediaExtractor/MediaCodec로 복호화
  -> 16kHz mono PCM16 LE 청크 (일반적으로 100ms = 3,200 bytes)
       ├─ feedQueue -> e2-live-feed -> Essence2Avatar.feed(ByteArray)
       │      -> 원본 네이티브 SDK 렌더링
       │      -> e2-live-pull -> Essence2Avatar.pullHardwareBuffer()
       │      -> Bitmap.wrapHardwareBuffer -> Flutter HardwareCanvas 출력
       └─ soundQueue -> e2-live-sound -> Android AudioTrack
                           -> playbackHeadPosition(16k samples)
                           -> sdk.setPlayoutPosition(samples) [pull worker에서 주기적 전송]
EOF -> sdk.endOfAudio()
```

**구별:** 비디오 25fps는 엔진의 `fps=25` 목표입니다. 음성 청크 크기 100ms는 앱 입력 단위이지 네이티브 SDK가 강제하는 GPU 실행 주기라는 근거가 없습니다.

## 3. 갤럭시 실기기 테스트의 정량 증거

사용자가 직접 복사한 최신 로그의 헤더는 다음과 같습니다.
```text
build=PCM16_GPU_CLOCK_TRACE_20261121
engine=essence2
STT=false
TTS=false
sample=A52DHS2219
loaded=true
```

최신 로그에서 **네이티브 turn=4**에 대해:
```text
stage=video.pull turn=4 frame=95  sdkFrameIndex=329 gpuHardware=true pullMs=118 pullThreadCpuMs=0 frameGapMs=123 playedSamples=208320
stage=video.pull turn=4 frame=100 sdkFrameIndex=340 gpuHardware=true pullMs=70  pullThreadCpuMs=0 frameGapMs=77  playedSamples=215680
stage=video.pull turn=4 frame=110 sdkFrameIndex=360 gpuHardware=true pullMs=49  pullThreadCpuMs=0 frameGapMs=55  playedSamples=230080
stage=video.pull turn=4 frame=111 sdkFrameIndex=361 gpuHardware=true pullMs=53  pullThreadCpuMs=0 frameGapMs=55  playedSamples=230080
stage=sdk.playout.clock turn=4 playedSamples=224320 acceptedSamples=231082
stage=audio.finish turn=4 playedSamples=231082 writtenSamples=231082 complete=true underruns=1
stage=video.finish turn=4 frames=111 lastOrdinal=362 expectedApprox=361 integrityPassed=true
```

- 음성 길이 = `231082 / 16000 ≈ 14.4426초`
- 목표 프레임 ≈ 361~362프레임 (25fps)
- 최종 프레임 ordinal: 마지막 `sdkFrameIndex=361` → `lastOrdinal=362`
- 실제 이 turn에서 출력된 프레임: **111개**. SDK 내부에서 순번상 건너뛴 프레임은 약 **251개(69.3%)**. 이는 재생 위치 추적이 작동하여 오래된 프레임을 생략했음을 보여 주며, 251개가 원래부터 GPU에서 렌더됐다는 뜻은 아님
- 후반부 `pullMs=49~118ms`, 25fps 프레임 예산 40ms를 상당수 초과
- `video.draw`는 보통 **0~2ms**, `uiQueueMs=0` 부근 → 이 로그 구간의 주 병목은 UI draw로 보기 어려움
- `pullThreadCpuMs=0`은 밀리초 정수 절삭값. **모델 전체 CPU 부하 0, 또는 GPU 추론 확인**이라는 해석은 금지
- `complete=true`로 해당 오디오가 끝까지 재생된 것이 확인되지만 `underruns=1`, 실제 청감·립싱크 품질은 별도 검증 필요
- 로그에 보이는 `video.draw frame=220~235`는 화면 세션 누적 번호로 볼 수 있으며, `video.pull turn=4 frame=95~111`의 **turn별 프레임 번호와 직접 비교해 동일 turn의 프레임 수라고 단정하지 말 것**
- 최신 업로드 로그는 부분 꼬리(tail)입니다. `sdk.playout.clock` 호출의 전체 빈도, 처음 프레임 지연, 온도 변화는 이 부분만으로 확정 불가

**이전 GPU 하드웨어 버퍼 버전(재생 위치 추적 미연결)의 실기기 기록**에서도 `gpuHardware=true`, `pullMs`가 대략 60~90ms대로 관찰됐습니다. 최근 수정은 늦은 프레임 건너뛰기를 동작시키지만, 네이티브 한 프레임 지연 자체를 40ms 이하로 줄였다는 증거는 없습니다.

## 4. 꼭 구분해서 분석할 네 가지 계층

| 계층 | 현 증거 | 아직 불명확한 점 |
|---|---|---|
| ① 모델 추론 | 실제 영상 프레임이 생성됨 | CPU/OpenCL/Vulkan/NNAPI/전용 가속기 중 사용 backend 및 처리비 |
| ② GPU 영상 버퍼 | `gpuHardware=true`, `pullHardwareBuffer()` 성공 | GPU buffer 지원 여부와 **GPU 추론 속도**는 별개 |
| ③ SDK JNI pull | 49~118ms 소요, 호출 스레드 CPU시간 정수 0ms | 실제 compute vs synchronization/fence vs 버퍼 재사용 대기 vs 공급 부족 |
| ④ Flutter 출력 | `video.draw` 0~2ms | 전체 렌더링 지연의 다른 구간 유무; 이 로그의 우선순위는 낮음 |

`gpuHardware=true` 한 줄만 보고 GPU AI 가속 성공이라고 결론 내리지 마십시오. 반대로 `pullThreadCpuMs=0`만 보고 GPU 연산을 안 한다고 결론 내리지 마십시오.

## 5. 외부 전문가에게 요청하는 작업 — 우선순위

1. **실제 모델 backend 규명**  
   이 앱이 런타임에 사용하는 `essence2-android 0.9.5` AAR 및 JNI `.so`에서 `Essence2Avatar.create/feed/pullHardwareBuffer/useHardwareBuffers/setPlayoutPosition` 호출의 내부 경로를 추적하십시오. SDK가 OpenCL 등을 사용한다면 초기화, 실패시 fallback, GPU command queue/fence/동기화, driver 라이브러리 로드 결과를 **코드·심볼·로그 증거**로 구분하십시오. 재패키징된 JVM getter와 실제 네이티브 라이브러리를 혼동하지 마십시오.
2. **49~118ms의 위치를 분해**  
   `sdk.feed()` 대기·처리시간, 모델 프레임 생성, `sdk.available()` 생산, `pullHardwareBuffer()` 반환 대기, GPU 버퍼 보유·해제, SDK 내부 동기화·전력/thermal 영향을 각각 계측하십시오. `pullThreadCpuMs`만이 아니라 프로세스/렌더 worker/드라이버/GPU 타임라인을 Perfetto/atrace/가용 기기 카운터로 확인하십시오.
3. **원본 SDK와 커스텀 엔진을 함수·큐 단위로 diff**  
   원본 `Essence2Engine`/`AvatarPlayer`의 초기 lead, `PlayoutClock`, queue depth/backpressure, `setPlayoutPosition` 전송 간격, skip-ahead, 소유권 및 reset 체계와 `OfficialEssence2FileEngine`의 동작 차이를 분석하십시오. 특히 새 엔진의 `setPlayoutPosition`은 **pull worker에서 호출**하므로 느린 네이티브 pull이 clock 갱신을 지연시킬 수 있는지 확인하십시오. 원본이 별도 producer에서 clock을 갱신하는 설계와 비교하십시오.
4. **25fps 달성 가능성 판정**  
   현재 모델/해상도/기기에서 40ms/frame에 도달 가능한지 측정하십시오. 가능하면 **원본 SDK가 공식 지원하는 옵션**(실제 backend 선택, 모델 변형, 렌더 해상도, buffer slot 조정 등)만 먼저 검토하십시오. 미지원 기능을 추측으로 만들어 쓰지 마십시오. 지원되지 않거나 하드웨어상 불가능하다면 그 사실과 한계를 수치로 보고하십시오.
5. **최소한의 실험 패치 + A/B 검증**  
   같은 PCM·같은 기기·같은 해상도·비슷한 전력/온도 상태에서 변경 전후를 비교하십시오. 최소한: ① 첫 음성/첫 영상 지연, ② SDK pull p50/p95, ③ 실제 시간당 출력 frame 수와 `lastFrameIndex` 점프, ④ 오디오 underrun, ⑤ 립싱크, ⑥ GPU/CPU workload 분포, ⑦ 장시간 발열·안정성을 기록하십시오.

### 피해야 하는 작업
- 원인 검증 없이 Flutter UI, PCM 파이프라인, STT/TTS 또는 모의 서버를 새로 설계하지 말 것
- `useHardwareBuffers()` 성공만으로 모델 GPU 연산 정상이라고 주장하지 말 것
- 에뮬레이터 ARM64 번역 실행과 갤럭시 실기기 처리속도를 혼동하지 말 것
- 기존 원본 SDK 코드·동작을 먼저 비교하지 않고 자체 렌더링 엔진을 재작성하지 말 것
- 컴파일 성공, `checkRender()` 성공, `audio.finish` 성공을 25fps 성공으로 보고하지 말 것

## 6. 자문 결과로 필요한 산출물

**구두로 가능성만 나열하는 답변은 충분하지 않습니다.** 다음 5가지를 요청합니다.

1. 모델 GPU 추론 여부에 대한 **확인됨/미확인/불가** 판정 및 증거(관련 코드 위치·네이티브 메서드/심볼·실행로그).
2. `pullHardwareBuffer()` 지연 49~118ms를 구성하는 실제 병목과 증거.
3. 원본과 현재 엔진의 **구체적인 함수/코드 행 단위 차이**, 성능·동기화에 영향을 줄 가능성의 우선순위.
4. 재현 가능한 **최소 패치(diff/PR)** 와 같은 환경에서의 성능 비교 로그. 수정 불가하다면 제한 요인 및 추가 측정 요청을 정확히 기록.
5. 별도 GitHub Actions 성공 기록 및 실제 휴대전화에서 다시 확인할 진단 로그 항목.

## 7. 외부 AI에 그대로 전달할 의뢰 문구

> GitHub `lyonbegin/hitel-room`, branch `feature/hitel-essence2-gpu-hardwarebuffer-20261121`, commit `282e3acd0b759090229463a5a88925dcd4d9092a`의 Essence2 GPU 영상 생성 병목을 소스 수준에서 분석해 주십시오. 먼저 `tools/bithuman_deep/essence2_file_audio/OfficialEssence2FileEngine.kt`, `tools/bithuman_deep/patch_essence2_official_pcm16_file.py`, `vendor/bithuman-pristine/flutter-plugin-v2.6.37/.../AvatarEngine.kt` 및 `PlayoutClock.kt`를 읽으십시오. 실기기에서 `gpuHardware=true`, `pullMs=49~118ms`, `pullThreadCpuMs=0`, 총 14.44초 음성의 SDK frame ordinal 362에 출력 111프레임을 확인했습니다. GPU 버퍼 출력과 AI 모델 GPU 추론을 분리하여 검증하고, 네이티브 SDK `pullHardwareBuffer()` 처리시간의 실제 병목을 추적해 주십시오. 원본 SDK 함수와 구체적으로 비교하고 근거가 있는 최소 코드 수정 및 검증계획을 제시하십시오. 추측성 결론이나 독자적인 전체 재설계는 피하십시오.

---
**검증 범위 안내:** 이 문서의 실기기 수치는 사용자가 제공한 진단 로그에 기반합니다. SDK 네이티브 GPU 실행 비중, 실제 25fps 달성 및 립싱크 품질은 현재 미검증입니다. 이 문서 생성 과정에서 새 앱 코드 수정·APK 재빌드는 수행하지 않았습니다.
