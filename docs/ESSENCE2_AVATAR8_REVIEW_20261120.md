# 아바타 8 후속 수정과 검증 범위

이 문서는 `lyonbegin/hitel-room`의 기존 작업을 이어받은 기록입니다.
실행 성공의 범위를 설치, 인증, 렌더링, 실제 소리, 립싱크로 구분합니다.
현재 정식 인증을 거친 실기기 립싱크 완료본은 입증되지 않았습니다.

## 확인된 문제

| 기존 실행 | 실제 증거 | 판단 |
| --- | --- | --- |
| [공식 예제 시험 44750041760](https://github.com/lyonbegin/hitel-room/actions/runs/44750041760) | 환경변수 `BITHUMAN_API_SECRET`가 빈 문자열이며 `No API secret`에서 종료 | 설치 및 인증 누락 상태 확인만 통과. 엔진·음성·립싱크 시험 아님 |
| [직전 Sofia APK 시험 44739169993](https://github.com/lyonbegin/hitel-room/actions/runs/44739169993) | `feedMaxUs=25574898.0`, `mouthUnique=3 due=60` | 25.6초의 입력 지연, 새 음성 프레임 표시율 5%. 실시간 립싱크 성공 아님 |
| 같은 Sofia 시험 | `Repack original SDK with ONLY one JVM meter URL getter changed` 단계 실행 | JNI가 같아도 AAR 전체가 순정이라는 뜻은 아님 |
| 같은 Sofia 시험 | `_resolveSecret isn't referenced`, 앱이 `htdemo.v1.offline.*`를 사용 | 정식 키 입력 경로 대신 로컬 시험용 인증·대화 서버 사용 |
| 기존 음성 판정 | 음성 입력·오디오 쓰기·영상 표시 이벤트가 각각 한 번이라도 있으면 통과 | 충분한 입 모양 표시율이나 실제 스피커 소리는 입증하지 못함 |
| 기존 에뮬레이터 옵션 | `-no-audio`, 주 ABI `x86_64` | 실제 음향 출력 및 공식 ARM64 실기기 지원의 증거로 사용할 수 없음 |

원인은 서로 구분해야 합니다. 정식 예제는 인증 전에 멈췄고, Sofia 시험은
로컬 모의 인증을 사용한 ARM 변환 환경에서 성능과 프레임 표시가 부족했습니다.
실기기에서도 동일한 내부 성능 문제가 발생하는지는 아직 확인되지 않았습니다.

## 반영한 코드

`prepare_essence2_authenticated_baseline.py`는 고정한 공식 upstream
`fea69e72515af7d05f384a9d2147ac0cc181b411`의 앱을 사용합니다.
기존 다섯 샘플 선택 화면과 패키지
`ai.bithuman.example.avatar_chat.essence2`를 유지합니다.

- 원본 `_resolveSecret()` 및 기기 보안 저장소 입력 경로를 사용합니다.
- 모델 다운로드와 realtime 요청에 같은 정식 API Secret을 전달합니다.
- 예전 앱에서 남을 수 있는 `htdemo.v1.*` 토큰은 네트워크 호출 전에 거부합니다.
- realtime 세션을 만들기 전에 `avatar.ready`를 기다리고 `isReady`를 재확인합니다.
  원본 SDK의 60초 대기 후 연결 진행 경로에만 의존하지 않습니다.
- Flutter 플러그인 파일 전체를 원본과 비교하며, 네이티브 SDK는 Maven의
  `ai.bithuman:essence2-android:0.9.5`를 그대로 사용합니다.
- 모의 인증·meter·대화 서버, 로컬 모델 우회, AAR 재조립은 이 빌드에 넣지 않습니다.
- 기존 Sofia 모의 APK 워크플로는 자동 실행을 해제하여 새 수정본과 혼동하지 않게 합니다.

새 APK의 빌드 작업은 `essence2-authenticated-android-baseline.yml`입니다.
공개 APK 안에 키를 컴파일하지 않습니다. 인증은 설치 후 원본 입력 화면에서 처리합니다.
키나 모델 권한을 임의로 만들어 인증된 것으로 취급하지 않습니다.

`analyze_essence2_e2trace.py --require-lipsync`는 같은 표시 이벤트에 기록된
누적 `uniqueShown/due`를 사용합니다. 기본 기준은 최소 10개 due 프레임,
90% 이상 새 프레임 표시율, 필요한 시작·음성 이벤트와 로그 누락 0입니다.
이는 프레임 표시율의 공학적 회귀 기준이며, 사람 입 모양의 시각적 정확성이나
실제 스피커 가청성을 자동 인증하는 기준은 아닙니다.
`0/0`인 idle 상태의 `cov=100%`는 통과하지 않습니다.

## 검증과 재사용

1. GitHub Actions에서 **Essence2 real-auth APK build and credential UI audit**를 실행합니다.
2. Python 회귀시험, 생성한 Dart 시험·분석, 실제 APK 빌드, 원본 JNI 비교를 수행합니다.
3. Android 15에 설치한 뒤 샘플 선택 → 정식 키 입력 화면 표시를 확인합니다.
   이 UI 시험에서는 키를 제출하지 않으며 엔진 성공으로 표시하지 않습니다.
4. `authenticated-proof/ui/result.json`에서 시험 범위와 미검증 항목을 확인합니다.
5. 정식 인증 후 렌더링 시험은 실제 ARM64 기기에서 수행해야 합니다.
   실제 영어 발화, 지속적인 새 입 모양, 음성과 영상의 동기를 따로 확인합니다.

Python 시험의 로컬 실행 예시는 다음과 같습니다.

```bash
export ESSENCE2_UPSTREAM=/absolute/path/to/official-sources
export ESSENCE2_PLUGIN=/absolute/path/to/original-flutter-plugin
python3 -m unittest discover -s tools/bithuman_deep -p test_essence2_acceptance.py -v
```

원본 공식 Kotlin 예제를 설치하는 예전 audit 스크립트에도
`verification-scope.json`을 추가했습니다. 설치가 성공하더라도 정식 키가 없으면
`BLOCKED_MISSING_API_SECRET`이며, `lipsync_verified`는 `false`입니다.

## 남은 실제 차단 요인

현재 이 작업에 정식 bitHuman API Secret이 제공되거나 연결된 사실은 없습니다.
로컬 ADB 클라이언트는 서버를 시작하지 못했습니다. 별도로 확인한
`SM-F711N` 미러링 창은 검은 화면에서 입력에 응답하지 않았습니다.
따라서 현재 연결 상태로 실기기에 최종 설치하거나 소리·립싱크를 확인했다고
보고할 수 없습니다. 정상 인증된 실기기 결과가 나오기 전에는 설치 후보 APK를
립싱크 검증 완료본으로 제공하지 않습니다.
