# bitHuman / HITEL Essence 2 Android — 다른 AI 개발자를 위한 인수인계

작성일: 2026-11-21, 한국시간 기준. 대상: **PCM_FILE_R4 실패 상태**.

## 0. 가장 먼저 확인할 사항

현재 APK는 정상 완료본이 아닙니다. 사용자의 실제 실행 로그에서 파일 PCM 스트림은 전달되지만, 입모양 프레임이 크게 누락됩니다. 누적 표시 지표는 `uniqueShown=48`, `due=710`, `coveragePct=6`, 늦은 프레임 폐기는 `staleCount=160`입니다.

이전 AI는 원본 코드를 우선 사용하라는 사용자의 요구를 충분히 지키지 않고, 중간 공급 제한·큐·SDK 어댑터 변경을 추가했습니다. 특히 **원본이 입력 PCM을 재생 속도에 묶지 않도록 설명하고 있는데, 재생 대기량이 3초를 넘으면 파일 입력을 멈추는 제어를 다시 넣었습니다.** 다음 담당자는 이 변경부터 원본과 분리해 대조해야 합니다.

다만 그 제한 하나가 장애의 유일한 원인이라는 비교 실험은 아직 없습니다. GPU 성능 부족, 원본 SDK 자체의 결함, PCM 손상 역시 확정된 원인이 아닙니다. 이 문서는 확인 사실과 원인 후보를 구분합니다.

**이번 인수인계 작업에서는 앱 코드를 추가 수정하거나 새 APK를 만들지 않았습니다. 아래의 실패 APK와 소스 커밋이 분석 기준입니다.**

## 1. 사용자가 현재 요청한 기능과 개발 원칙

1. STT는 사용하지 않습니다. 이번 단계에서는 TTS와 AI 답변 생성도 사용하지 않습니다.
2. 사용자가 텍스트를 입력하면, 지정한 기존 음성 파일을 조금씩 읽어 PCM으로 디코딩하고 기존 아바타 입력 경로로 연속 전달합니다.
3. 텍스트는 파일 응답을 시작하는 신호입니다. 입력 문장에 맞는 새 음성을 합성하는 기능이 아닙니다.
4. 파일 전체의 PCM 변환이나 전체 입모양 렌더링이 끝난 뒤 재생하는 방식으로 바꾸면 현재 스트리밍 요구를 충족하지 못합니다.
5. 원본 bitHuman / Essence 2 소스의 함수 내용과 실제 연결을 먼저 확인하고, 이미 있는 경로를 재사용해야 합니다. 새 큐·타이머·동기화 체계를 임의로 덧붙이는 방식에 사용자가 강하게 반대하셨습니다.
6. 기존 아바타 모델·화면·GPU 경로를 보존하는 것이 원칙입니다. 별도 OpenCL 탐지나 CPU 강제 고정은 현재 요구가 아닙니다.
7. 사용자는 이번 단계에서 에뮬레이터 시험을 생략해도 된다고 하셨습니다. 실제 기기에서 받은 실패 로그를 기준으로 분석해야 합니다.
8. 설치·업데이트 시 이전 로그 삭제, 실행 중 로그 지우기 버튼, 최근 로그만 복사하는 기능은 유지해야 합니다.
9. APK는 외부 HTTPS에 실제 게시하고 다운로드를 검증한 뒤 제공해야 합니다. 빌드 성공·PCM 분할 성공·다운로드 성공을 실제 음성·립싱크 성공으로 보고하면 안 됩니다.
10. 사용자께는 한국어 존댓말로 설명해야 합니다.

사용자가 별도로 제공한 통화 녹음 파일을 활용하려는 맥락이 있습니다. **R4에 실제 포함된 것은 기존 공개 영어 시험 음성입니다. 사용자 통화 녹음을 포함한 APK가 아닙니다.** 개인 녹음은 별도 전달받아 사용하고, 공개 저장소에 올리지 않아야 합니다.

## 2. 저장소·브랜치·분석 기준 커밋

| 구분 | 값 |
|---|---|
| 사용자 프로젝트 저장소 | https://github.com/lyonbegin/hitel-room |
| 현재 작업 브랜치 | `feature/hitel-essence2-file-reply-r4-20261121` |
| 브랜치 열기 | https://github.com/lyonbegin/hitel-room/tree/feature/hitel-essence2-file-reply-r4-20261121 |
| 실패 APK의 소스 커밋 | `5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b` |
| 해당 커밋 | https://github.com/lyonbegin/hitel-room/commit/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b |
| R4 최초 구현 커밋 | `e6ed252b2d3210bbc3cee347ed9c150778ed801a` |
| R4에 사용한 원본 examples 커밋 | `fea69e72515af7d05f384a9d2147ac0cc181b411` |
| R4 플러그인 기준 | `flutter-plugin-v2.6.37` 보관 소스 |
| 실제 빌드 워크플로 | `.github/workflows/essence2-file-reply-r4.yml` |

브랜치는 문서 추가 등으로 앞으로 이동할 수 있습니다. APK를 재현하거나 코드 줄 번호를 대조할 때는 **위 소스 커밋을 고정**하십시오.

```bash
git clone --single-branch --branch feature/hitel-essence2-file-reply-r4-20261121 https://github.com/lyonbegin/hitel-room.git
cd hitel-room
git checkout 5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b
```

과거 계열인 `feature/hitel-korean-echo-r3-20261121`은 한국어 TTS 시험용입니다. `feature/hitel-essence2-sofia-embedded-offline-20261120` 역시 다른 작업이 이어진 브랜치입니다. 이 둘을 현재 R4의 기준으로 사용하거나 덮어쓰지 마십시오.

## 3. 실패 APK와 빌드 증거

| 항목 | 값 |
|---|---|
| 앱 표시 이름 | `HITEL PCM File R4` |
| Android applicationId | `ai.bithuman.example.avatar_chat.essence2` |
| APK | `HITEL_Essence2_Text_File_Stream_R4_20261121_ARM64.apk` |
| APK 크기 | `348743390` bytes |
| APK SHA-256 | `2b27fac84a365268ff4b139ae37b5977d8b260ea7d7709747ce5b74765f00066` |
| 모델 | Essence 2 Sofia, `A52DHS2219`, `1080×1920` |
| 실제 사용한 native SDK | `ai.bithuman:essence2-android:0.9.5` 기반 |
| 빌드 도구 | Flutter `3.41.9`, Java `17`, Android arm64 debug APK |
| 성공한 빌드 실행 | https://github.com/lyonbegin/hitel-room/actions/runs/44872766191 |
| 해당 job ID | `136750740705` |

APK 외부 주소:

https://github.com/lyonbegin/hitel-room/releases/download/hitel-essence2-sofia-audio-lipsync-20261121/HITEL_Essence2_Text_File_Stream_R4_20261121_ARM64.apk

빌드에서 확인한 것은 컴파일, 실제 재사용 PCM 분할기의 JVM 검사, 압축되지 않은 M4A asset 접근 조건, APK 내부 원본 JNI·모델 파일 일치, 공개 다운로드 파일과 빌드 파일의 바이트 일치입니다. **이것들은 Galaxy에서의 정상 립싱크 증거가 아닙니다.** 실제 사용자 실행은 아래와 같이 실패했습니다.

Release tag는 여러 과거 APK가 함께 있는 `hitel-essence2-sofia-audio-lipsync-20261121`입니다. 반드시 파일명의 `Text_File_Stream_R4`와 SHA-256을 확인하십시오.

## 4. 현재 연결 구조

기존 Flutter 화면과 원본 AvatarPlayer를 사용하는 시험 앱입니다. 내부 서버는 앱 안의 loopback HTTP/WebSocket 시험 런타임이며, 외부 AI 서버가 답변을 만들어 주는 구조가 아닙니다.

1. 화면의 텍스트 입력이 기존 세션을 통해 `conversation.item.create`, `response.create`를 전송합니다.
2. 생성된 `hitel_offline_runtime.dart`가 사용자 텍스트를 읽고 `HitelFileReply.reply()`를 호출합니다. 시작 시 자동 인사 요청에는 음성을 보내지 않습니다.
3. `HitelFileReply`가 MethodChannel `ai.hitel/file_audio`의 `start` / `next`를 호출합니다.
4. `HitelFileAudioSource`가 APK 내부 `assets/hitel_file_reply.m4a`를 `FilePcmStream.decodeAsset()`으로 읽습니다.
5. MediaExtractor·MediaCodec이 패킷을 순차 디코딩합니다. 기존 파일 디코더의 모노·16 kHz 변환 후, 최대 100ms PCM16 조각이 콜백으로 나옵니다.
6. bitHuman의 기존 `Pcm16kTo24k`가 Flutter 음성 API에 맞는 24 kHz mono PCM16 little-endian으로 변환합니다.
7. **추가된 8개짜리 큐와 3초 재생 대기량 제한**을 거쳐 Dart로 전달합니다. Dart는 각 조각을 기존 loopback WebSocket의 `response.output_audio.delta`로 전송합니다.
8. 기존 `BithumanRealtimeSession`이 받은 PCM을 `avatar.playSpeakerPCM()`으로 넘깁니다.
9. Android `BithumanPlugin` → `AvatarPlayer`로 들어갑니다. 원본 플레이어 안에서 SDK용 16 kHz 변환·feed, 프레임 수신, AudioTrack 출력, 표시 시계가 연결됩니다.
10. 파일 EOF에서 변환기의 잔여 PCM을 내보낸 후 `response.done`을 전송합니다. 기존 세션은 `notifyTurnEnd()`로 SDK의 발화 끝을 알립니다. 새 텍스트는 이전 세대의 디코딩을 취소하고 기존 중단 경로를 사용합니다.

**16 kHz native SDK 입력과 24 kHz Flutter 음성 API 입력은 서로 다른 계층입니다. PCM의 rate·mono·PCM16·little-endian 규격을 층별로 구분해야 합니다.** 100ms는 전송 조각의 오디오 길이이지, 반드시 100ms마다 기다리라는 뜻이 아닙니다.

R4는 완성된 M4A 파일의 순차 디코딩입니다. 계속 커지는 통화 녹음 파일의 증가분 추적 기능은 구현하지 않았습니다.

## 5. 다음 AI가 읽을 파일

아래 경로는 사용자 저장소의 분석 기준 커밋을 기준으로 합니다.

| 파일/폴더 | 역할 및 확인점 |
|---|---|
| `.github/workflows/essence2-file-reply-r4.yml` | 원본 다운로드부터 패치 순서·빌드·검증·APK 게시까지 전부 확인하는 시작점 |
| `tools/bithuman_deep/prepare_essence2_file_reply.py` | R4 통합 생성기. 플러그인 연결·Dart 서버 연결·asset·UI·로그 삭제 설정을 삽입 |
| `tools/bithuman_deep/essence2_file_audio/HitelFileAudioSource.kt` | 새로 작성한 native 파일 공급기. 8개 큐, 재생 대기 3초 제한, 기존 resampler 호출 |
| `tools/bithuman_deep/essence2_file_audio/hitel_file_reply.dart` | 새로 작성한 텍스트→파일 응답. PCM delta와 응답 종료 전송 |
| `tools/bithuman_deep/essence2_file_audio/FilePcmStream.java` | HITEL14 소스에서 가져온 파일 디코더. 4초→100ms 변경과 asset FD 입력 추가 |
| `tools/bithuman_deep/patch_essence2_android_pcm_playback.py` | AudioTrack 부분 쓰기 재시도, **앱 load의 `skipAhead: true` 강제 지정** |
| `tools/bithuman_deep/patch_essence2_streaming_engine.py` | **SDK 어댑터의 feed·flushTail·완료 판정·monitor 경계를 바꾸는 패치** |
| `tools/bithuman_deep/prepare_essence2_function_trace.py` | GPU·입력·프레임·출력 로그 계측. 각 지표가 무엇을 세는지 확인 |
| `tools/bithuman_deep/prepare_essence2_monitor_trace.py` | 어댑터 monitor 계측 |
| `tools/bithuman_deep/prepare_essence2_spoken_voice_mock.py` | 과거 전체 PCM asset mock 생성기. R4 준비 과정에서 먼저 적용되지만 R4 생성기가 전체 load 경로를 제거함 |
| `tools/bithuman_deep/prepare_essence2_local_debug_loopback.py` | 기존 로컬 시험 서버·mock 연결 생성 |
| `tools/bithuman_deep/prepare_essence2_hitel_no_key_runtime.py` | 현재 로컬 시험용 부팅 연결 |
| `tools/bithuman_deep/essence2_file_audio/HitelDiagnostics.kt` | 로그 MethodChannel, 설치 시점 확인 |
| `tools/bithuman_deep/essence2_file_audio/DiagnosticFiles.kt` | 삭제 대상 로그 4개만 명시 |
| `tools/bithuman_deep/essence2_file_audio/HitelLogResetReceiver.kt` | APK 교체 시 로그 초기화 |
| `tools/bithuman_deep/essence2_file_audio/HitelE2Trace.kt` | native trace 회전·최근 로그·실행 중 지우기 |
| `tools/bithuman_deep/essence2_file_audio/FilePcmChunkerTest.java` | 분할·변환 연속성 JVM 검사. Android AAC 디코더/립싱크 검사가 아님 |
| `tools/bithuman_deep/essence2_file_audio/DiagnosticFilesTest.kt` | 설치 시점별 로그 삭제 범위 JVM 검사 |
| `vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/` | 현재 빌드가 복사해 사용하는 bitHuman 플러그인 보관본. 원본 비교의 기준 |

R4 새 소스 폴더:

https://github.com/lyonbegin/hitel-room/tree/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/tools/bithuman_deep/essence2_file_audio

**주의: 실제 앱의 `main.dart`, `hitel_offline_runtime.dart`, 수정된 Android 플러그인은 빌드 중 생성·조립됩니다.** 저장소 루트에서 완성 앱 폴더만 찾으면 연결을 놓칩니다. CI 작업 경로는 `original-upstream/app/avatar_chat`과 `essence2-local-mock-plugin`입니다. 수정이 필요하면 조립 순서와 생성기를 먼저 읽어야 합니다.

## 6. 이전 AI가 실제로 바꾼 것과 잘못한 점

| 구분 | 실제 변경 | 인수인계 판단 |
|---|---|---|
| 파일 디코딩 | 기존 Java 디코더 재사용, 100ms 분할과 APK asset FD 진입 추가 | 새 PCM 합성 알고리즘은 아니지만, 그대로 가져온 무변경 코드도 아님 |
| 파일→세션 연결 | `HitelFileAudioSource`, `HitelFileReply`, MethodChannel 흐름 신규 작성 | 사용자가 요구한 원본 우선 원칙에 비해 새 중간 계층을 많이 추가함 |
| 공급 제한 | 큐 8개, 대기 음성 3초 초과 시 sleep | 원본의 입력 공급 방침과 다른 제어를 도입함. 우선 제거/대조 대상 |
| 재생 계수 연동 | `BithumanPlugin`의 PCM 수신과 playout 갱신에서 pending24k 갱신 | 사용자 정의 속도 제어를 원본 플레이어 상태에 결합 |
| skip-ahead | 앱에서 `skipAhead: true` 지정 | 보관 원본 기본값 `false`와 다름. GPU와 별도 설정인데 함께 유리한 변경처럼 적용함 |
| SDK 어댑터 | feed·tail native 호출 주변 monitor, fed 계수 갱신 시점, 완료 판단 등을 변경 | 스트리밍 문제를 다루면서 원본 실행 의미까지 바꿈. 회귀 비교가 없었음 |
| AudioTrack | 부분 쓰기 재시도 추가 | 이것도 변경 이력에 포함해야 함. 현재 로그의 쓰기 성공만으로 소리 검증을 대체하면 안 됨 |
| 원본 유지 설명 | native JNI·모델·원본 플레이어 중심으로만 보존을 설명 | 중간 공급과 SDK 어댑터 변경을 충분히 드러내지 못함 |
| 원인 분석 | 처음에는 프레임 지연과 표시 폐기 현상을 중심으로 설명 | 현상은 맞지만, 직접 추가한 공급 제한과 원본의 경고를 먼저 대조하지 못함 |
| 검증 | 빌드·분할기·파일 일치 검사 후 설치본 제공 | 실기기 음성·입모양 연속성 검증은 안 됨. 사용자 실행으로 립싱크 실패 확인 |
| 시험 음성 | 기존 공개 영어 fixture를 M4A로 변환해 포함 | 사용자 통화 녹음 적용은 아직 하지 않았음 |

추가한 공급 제한의 실제 코드:

```kotlin
while (live(turn) && pending24k > 24000L * 3L) Thread.sleep(10)
```

원본 보관 `lib/bithuman_realtime.dart` 241–256행은 도착한 PCM을 플러그인에 신속히 전달하도록 설명하며, 과거 재생 속도에 묶인 전달이 지연을 만들었던 이유를 적고 있습니다. 1230행 부근도 대기 없이 넘기는 방침이며 실제 호출은 1242행 `playSpeakerPCM`입니다. **원본에 이런 설명이 있는데도 새 공급 제한을 둔 것이 이전 AI의 중요한 잘못입니다.**

그렇다고 현 로그만으로 “3초 제한만 지우면 반드시 해결된다”고 넘겨서는 안 됩니다. 제한 제거, 원본 어댑터 복원, skip-ahead 차이 등을 분리하여 비교해야 합니다. 이전 AI가 덧붙인 “입모양이 준비될 때까지 음성을 기다리게 하자”는 제안 역시 아직 구현·검증한 해법이 아니므로, 새 동기화 알고리즘을 또 만들기 전에 원본을 재현하십시오.

native `lible_jni.so`와 모델 바이트는 빌드에서 원본 일치를 확인했습니다. 그러나 전체 AAR·플러그인이 무변경이라는 뜻은 아닙니다. 기존 로컬 시험 구성은 AAR의 JVM metering URL getter 한 곳을 loopback 시험 주소로 바꿉니다. 관련 스크립트는 `tools/bithuman_deep/essence2_sdk095_hitel_meter_route.py`이며, 현재 인증·서버 구성 전체를 공식 SDK 원상태라고 설명하면 안 됩니다.

## 7. 사용자 실행 로그 — 확인된 실패

원본 자료: 사용자 제공 `붙여넣은 텍스트(1)(9).txt`와 `(10).txt`. 둘 다 진단 시각이 **2026-11-21 15:09:18.008806 KST**이며 같은 실행의 사본입니다. 별도 두 번의 성공/실패 시험으로 세지 마십시오. `(10)`은 첫 헤더 일부가 잘려 있습니다.

두 파일의 공통 실행 표식은 `build=PCM_FILE_R4`, `mode=text_trigger_file_stream`, `STT=false`, `TTS=false`, `engine=essence2`, `sample=A52DHS2219`, `loaded=true`입니다. 복사본은 최근 native 로그 일부만 포함하므로 시작 시점 전체 계측은 없습니다.

### 7.1 텍스트→PCM 전송은 진행됨

| 사용자 응답 구간 | 시작 | 첫 PCM 전송 | 전송 종료 | 조각 수 |
|---|---|---|---|---|
| turn=2 | 15:08:41.959956 | 15:08:42.276604, 약 317ms 후 | 15:08:55.752971 | 146 |
| turn=3 | 15:08:59.386999 | 15:08:59.545773, 약 159ms 후 | 15:09:12.475761 | 146 |

첫 PCM 시각은 서버 공급 시작 지표입니다. 첫 스피커 발음이나 첫 정상 입모양 시각이 아닙니다. `response.done` 역시 파일 전송 종료이며 모든 소리가 실제로 들렸다는 뜻이 아닙니다. 146에는 마지막 짧은 조각과 변환기 tail이 포함될 수 있으므로 단순히 146×100ms로 파일 길이를 계산하지 마십시오.

### 7.2 GPU 경로·오디오 소비·입모양 누락

실제 로그 중 핵심 필드만 발췌했습니다. 아래 줄은 원문 전체가 아닌 분석용 발췌입니다.

```text
15:09:13.430 sdk.pull.result ordinal=308 durationUs=422159 hardwareFrame=true readyDepth=0
15:09:13.487 player.frame.stale atBytes=591360 headBytes=622080 staleCount=156
15:09:13.770 sdk.pull.result ordinal=321 durationUs=285433 hardwareFrame=true
15:09:14.020 display.present kind=C newMouthFrame=false uniqueShown=45 due=674 coveragePct=6
15:09:14.022 surface.post.ok hardwareCanvas=true bitmapWidth=1080 bitmapHeight=1920
15:09:14.057 audio.track.write kind=C pcmBytes=1920 returnedBytes=1920 head24k=352320
15:09:14.963 player.frame.stale atBytes=689280 headBytes=693120 staleCount=160
15:09:15.079 sdk.utterance.drained framesThrough=362 expectedFrames=362 complete=true
15:09:16.026 display.present kind=I uniqueShown=48 due=710 coveragePct=6 coalesced=52
```

여기서 확인되는 사실은 다음과 같습니다.

- `hardwareFrame=true`, `hardwareCanvas=true`이므로 하드웨어 프레임 전달·표시 경로가 동작합니다. 이것만으로 음성 전처리 등을 포함한 모든 연산이 GPU라고 판단할 수는 없습니다.
- `AudioTrack.write`는 대상 PCM 바이트를 받아들이며 재생 위치도 증가합니다. 실제 스피커의 소리·볼륨·출력 경로·음성 내용까지 이 메타데이터로 증명할 수는 없습니다.
- 누적 `48/710 ≈ 6.76%` 구간에서 새 입모양이 표시된 지표입니다. `coveragePct=6`은 정수 표시입니다. 한 발화의 개수나 전체 화면 갱신 수가 아닙니다.
- `kind=C`는 이전 얼굴을 유지한 채 음성을 진행하는 catch-up입니다. `newMouthFrame=false`이므로 화면 갱신이 곧 새 입모양은 아닙니다.
- `staleCount=160`은 대응 음성 위치가 지나간 뒤 도착한 프레임을 플레이어가 폐기한 누적값입니다.
- `atBytes=591360`, `headBytes=622080` 예시는 24 kHz mono PCM16에서 `30720/48000 = 0.64초`만큼 음성 쪽이 이미 앞서간 상태입니다.
- 잘린 로그 범위에서 SDK 프레임 취득은 약 94~422ms입니다. 25fps의 프레임당 40ms보다 길지만, 이를 GPU 내부의 순수 연산 시간이나 전체 세션의 평균 FPS로 해석해서는 안 됩니다.
- `complete=true`, `framesThrough=362`는 마지막 ordinal까지 진행했다는 현재 판정입니다. `PlayoutClock.nextDelivered()`는 마지막 ordinal+1을 반환하므로, 362장을 실제 생성·표시했다는 증명이 아닙니다.

### 7.3 확인된 실패의 연쇄

1. 입력 PCM은 전달됩니다.
2. 새 입모양이 없는 구간에서 플레이어가 기존 얼굴을 쓰는 `C` 유닛으로 음성을 계속 진행합니다.
3. 뒤늦게 입모양이 도착해도 대응 음성 위치를 이미 통과했으면 stale로 폐기합니다.
4. SDK ordinal은 진행하고 발화 종료까지 도달하지만 새 입모양 표시율은 낮게 남습니다.

관련된 보관 원본 코드 위치:

- `AvatarPlayer.kt` 698–743행: 음성 위치와 프레임 위치 비교, 오래된 프레임 폐기.
- 같은 파일 803–817행: 음성부터 진행하는 `C`/유지 처리.
- 같은 파일 873–890행: 음성을 admit한 위치를 `setPlayout`에 통지.
- 같은 파일 1325–1348행: 오디오 위치에 도달한 표시 유닛을 선택하고, 같은 vsync의 오래된 표시 후보를 합치는 처리.
- `AvatarEngine.kt` 543행: 보관 원본의 skip-ahead 기본값 false.
- `PlayoutClock.kt` 98행: ordinal과 실제 수신한 프레임 수를 구분할 때 참조.

### 7.4 아직 확정하지 못한 원인 후보

| 후보 | 근거 | 부족한 검증 |
|---|---|---|
| 신규 3초 공급 제한 | 입력을 재생 진행에 연동하며 원본의 비pacing 방침과 다름 | 제한 없는 원본 경로와 동일 조건 비교 |
| skip-ahead 강제 활성화 | 앱의 명시적 true, 로그 ordinal의 308→321→334 등 건너뛰기 | 원본 기본값과 비교. off만으로 해결된다는 증거는 없음 |
| SDK 어댑터 변경의 회귀 | 이전 AI가 feed·tail·monitor·완료 판정을 변경 | 원본 어댑터만 사용한 대조 실행 |
| 프레임 취득·후처리 부하 | readyDepth=0, SDK 취득 시간, 취득 후 queue 투입에도 지연 | native 대기·render·idle cursor·스케줄링 등의 시간 내역 |
| idle cursor 진행 부하 | 원본에 건너뛴 ordinal 수만큼 `avatar.idle(stepBuf)`를 호출하는 경로가 있고 R4는 그 monitor 위치를 변경 | 해당 기기에서 실측. GPU 표시 성공만으로 readback 등의 부하를 배제할 수 없음 |
| PCM 규격·내용 문제 | 현재 로그에 전체 PCM 비교 결과가 없음 | 같은 파일의 출력 PCM을 원본 경로와 비교. 현재 손상됐다고 단정하지 않음 |

## 8. 원본 샘플·PCM 스트리밍 소스를 어디서 참조할지

### 8.1 공식 문서 — 현재 연결 방식 확인

| 목적 | 공식 주소 | 참고할 내용 |
|---|---|---|
| Android에 연속 PCM 넣기 | https://docs.bithuman.ai/platforms/android/app#integrate-into-your-app | Essence 2는 16 kHz mono PCM16 LE 입력을 chunk마다 feed, 발화 끝 endOfAudio, 프레임 pull, 중단 resetAudio |
| Android API 정확한 시그니처 | https://docs.bithuman.ai/platforms/android/reference#essence2avatar | feed의 ByteArray/FloatArray overload, HardwareBuffer, reset, playout API 확인 |
| Flutter 외부 음성 연결 | https://docs.bithuman.ai/platforms/flutter/app | 자기 음성 파이프라인은 24 kHz mono PCM16을 playSpeakerPCM으로 전달. pushAudio와 음성출력 API를 혼동하지 않기 |
| Android 기본 시작점 | https://docs.bithuman.ai/platforms/android | native 입출력 규격과 버전 확인 |
| Essence 2 Android 완성 예제 | https://docs.bithuman.ai/examples/android-essence-2 | 파일 입력·렌더링·오디오 시계 기준 재생, 하드웨어 버퍼 API |

문서의 최신 SDK와 R4의0.9.5는 다를 수 있으므로, 최신 문서의 클래스를 현재 APK에 이미 적용된 것으로 읽으면 안 됩니다.

### 8.2 현재 공식 문서가 안내하는 GitLab

2026-11-21에 공식 문서의 링크를 직접 따라가 확인한 주소입니다.

- Examples: https://gitlab.com/bithuman/sdk/bithuman-examples
- Android Essence 2 MainActivity: https://gitlab.com/bithuman/sdk/bithuman-examples/-/blob/main/android/essence2-hello/app/src/main/java/com/example/e2hello/MainActivity.kt
- 공식 문서의 Flutter plugin 링크: https://gitlab.com/bithuman/sdk/homebrew-bithuman/-/tree/flutter-plugin-v2.6.40/packages/flutter-plugin

조회 도구에서는 GitLab 코드 페이지가 `Loading`으로만 반환되어 최신 파일 본문은 검증하지 못했습니다. 최신 소스 내용을 읽었다고 주장하지 마십시오. 공식 문서가 이 경로를 안내한다는 점과, 아래 고정 GitHub 스냅샷 본문을 읽었다는 점을 구분하십시오.

예전 GitHub `bithuman-product/homebrew-bithuman` 및 `flutter-plugin-v2.6.37` 파일 직접 조회는 현재 404를 반환했습니다. 삭제·이전·접근 권한 중 어느 이유인지 그 응답만으로 단정하지 않았습니다. 원본 경로가 안 열리면 아래 보관본을 기준으로 현재 APK를 분석할 수 있습니다.

### 8.3 R4 빌드가 실제 사용한 공식 GitHub examples 고정 스냅샷

저장소: https://github.com/bithuman-product/bithuman-examples

고정 커밋: `fea69e72515af7d05f384a9d2147ac0cc181b411`.

| 파일 | 직접 주소 | 용도 |
|---|---|---|
| Flutter 앱 | https://github.com/bithuman-product/bithuman-examples/blob/fea69e72515af7d05f384a9d2147ac0cc181b411/app/avatar_chat/lib/main.dart | BithumanAvatar.load, BithumanRealtimeSession 연결 |
| Flutter 의존성 | https://github.com/bithuman-product/bithuman-examples/blob/fea69e72515af7d05f384a9d2147ac0cc181b411/app/avatar_chat/pubspec.yaml | 원래 plugin v2.6.37 git 의존성이 어디를 가리켰는지 확인 |
| Android 설명 | https://github.com/bithuman-product/bithuman-examples/blob/fea69e72515af7d05f384a9d2147ac0cc181b411/android/essence2-hello/README.md | 샘플 목적·실행 조건·버전별 측정 구분 |
| MainActivity | https://github.com/bithuman-product/bithuman-examples/blob/fea69e72515af7d05f384a9d2147ac0cc181b411/android/essence2-hello/app/src/main/java/com/example/e2hello/MainActivity.kt | renderOnce / play / loadSpeech. native PCM feed 및 audio clock 재생 기준 |
| Wav.kt | https://github.com/bithuman-product/bithuman-examples/blob/fea69e72515af7d05f384a9d2147ac0cc181b411/android/essence2-hello/app/src/main/java/com/example/e2hello/Wav.kt | PCM WAV RIFF 읽기, mono·16 kHz 변환 |
| Android 전체 설명 | https://github.com/bithuman-product/bithuman-examples/blob/fea69e72515af7d05f384a9d2147ac0cc181b411/android/README.md | 입력 PCM 규격과 AudioRecord 관련 참고 |

**중요:** 이 커밋의 `essence2-hello/MainActivity.kt`는 전체 음성을 feed하고 프레임들을 준비한 후 재생하는 파일 예제입니다. 파일 수신과 음성·립싱크 재생이 동시 진행되는 스트리밍 완성 앱이라고 설명하면 안 됩니다. 현재 목표의 입력·출력 API 비교에는 도움이 되지만 그대로 복사해 전체 사전 렌더 방식으로 되돌리면 요구가 달라집니다.

### 8.4 현재 APK를 대조할 때 가장 중요한 bitHuman 플러그인 보관본

보관본 기준 폴더:

https://github.com/lyonbegin/hitel-room/tree/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin

아래 링크는 사용자의 구현을 원본이라고 부르는 것이 아니라, **R4가 실제 복사해 빌드한 bitHuman 플러그인 보관 소스**를 가리킵니다.

| 읽는 순서 | 원본 파일과 위치 | 확인할 함수/역할 |
|---|---|---|
| 1 | [bithuman_realtime.dart](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/lib/bithuman_realtime.dart#L241) | 입력 pacing을 제거한 이유, response.output_audio.delta 수신, 1242행 playSpeakerPCM, 응답 끝 notifyTurnEnd |
| 2 | [bithuman.dart](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/lib/bithuman.dart#L620) | 24 kHz PCM 음성·립싱크 동시 입력 API. 634행 notifyTurnEnd |
| 3 | [BithumanPlugin.kt](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt) | Flutter→native PCM 진입, newPlayer, 원본 GPU 자동 경로, playout 계수 |
| 4 | [AvatarPlayer.kt](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/AvatarPlayer.kt#L630) | offer, feed, produce, writeLoop, presentDue. 음성·입모양 묶음과 stale 조건 |
| 5 | [AvatarEngine.kt](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt#L185) | Essence2Engine, feed/flushTail/reset, renderLoop, leadMet, hardwareFrames, skip-ahead |
| 6 | [PlayoutClock.kt](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/PlayoutClock.kt) | SDK ordinal→발화 sample 위치, 건너뛰기와 실제 프레임 개수 구분 |
| 7 | [Pcm16kTo24k.kt](https://github.com/lyonbegin/hitel-room/blob/5f71f174b71d0ed55c16a5c3f0d46a60bf4f151b/vendor/bithuman-pristine/flutter-plugin-v2.6.37/packages/flutter-plugin/android/src/main/kotlin/ai/bithuman/flutter/Pcm16kTo24k.kt) | 조각 사이 상태를 유지하는 기존 변환기 |

보관된 주요 Git blob SHA: realtime `7c12185ec6286d92874b376442645b6f126ed492`, AvatarEngine `72ec04e96b0c01c912c73e7aba0c43b5024aef3d`, AvatarPlayer `690ede72e722725ded1d7a4b748b59905727f417`, Pcm16kTo24k `71b7af220891a7ef06676bd7790e147f9633c743`. 새로운 공식 버전과 현재 APK를 비교할 때 파일의 이름만으로 동일본이라고 간주하지 마십시오.

### 8.5 사용자께서 참고하라고 제공한 기존 HITEL14 파일 디코더

- 저장소: `lyonbegin/hitel-room`
- 브랜치: `feature/hitel14-v23-integrated-direct-pcm-stt-20261112`
- 파일: `sherpa-original-launcher/app/src/main/java/app/hitel/sherpaoriginalcli/FilePcmStream.java`
- Git blob SHA: `c85110ed5624d023da9178cdfca5e3ee03038030`
- 직접 링크: https://github.com/lyonbegin/hitel-room/blob/feature/hitel14-v23-integrated-direct-pcm-stt-20261112/sherpa-original-launcher/app/src/main/java/app/hitel/sherpaoriginalcli/FilePcmStream.java

이 파일은 bitHuman 렌더러가 아니라 파일→PCM 공급 소스입니다. MediaExtractor/MediaCodec 루프를 참고하는 목적이며, STT sink를 현재 앱에 붙이라는 뜻이 아닙니다. 원래 4초 분할값은 과거 STT 경로의 설정이고, 사용자는 현재 아바타 스트리밍에서 그것을 그대로 유지하라고 하신 것이 아닙니다.

R4 복사본의 변경은 package, 100ms 분할, APK asset file descriptor 입력 및 공통 디코딩 진입 함수 등입니다. 이 디코더는 현재 M4A/AAC 경로를 사용하며 `audio/raw`는 거부합니다. 임의의 모든 WAV 파일을 읽는 범용 디코더로 소개하면 안 됩니다.


