# IXIO 오류 문구 추적 및 APK 검증 결과

검증일: 2026-11-22 한국시간

복원 APK의 전체 19개 DEX, smali 파일 82,491개를 조사하여 같은 오류 문구의 직접 호출부 66곳을 확인하였습니다. 외부 패키지를 포함한 추가 검사에서도 총 66곳으로 일치하였고, 추가 호출부는 없었습니다. 호출부는 59개 클래스, 60개 메서드에 분산되어 있습니다.

| 문자열 리소스 | 호출부 수 |
| --- | ---: |
| `ai_engine_check_fail` | 7 |
| `network_server_error_toast_msg` | 52 |
| `setting_snackbar_error_retry` | 1 |
| `snackbar_error_retry` | 6 |

통화 녹음에 한정되었던 공통 `ToolTipStatus.VasError` 메뉴 진입 처리를 모든 `SettingDestination` 대상으로 확대하였습니다. 실제 네트워크 확인과 가입 차단 판단은 기존 경로를 사용합니다. 모델 목록은 기존 공개 모델 목록 API를 선택하도록 수정되어 원본 다운로드 워커에서 모델 7종의 다운로드 성공을 확인하였습니다.

66개 오류 호출부에는 원래 명령을 보존하면서 인자 없는 추적 호출을 추가하였습니다. 복사 로그에는 오류 위치의 리소스명, 클래스, 메서드와 식별자가 남습니다. 실제 서버 작업 실패는 원래 실패로 처리하며 그 발생 위치를 기록합니다. 66개 서버 작업을 모두 정상화한 것으로 검증한 결과는 아닙니다.

Android 14 에뮬레이터에서 메인·녹음 보조앱 설치, GitHub Pages 시험 로그인과 딥링크 복귀, 원래 홈 화면, 설정 탭, 통화 녹음 설정 화면 진입을 확인하였습니다. 로그 지우기·복사 버튼과 클립보드 설정 호출도 시험하였으며 앱 충돌은 기록되지 않았습니다. 이 검증에는 에뮬레이터 전용 지원 단말 입력을 사용합니다. 실제 휴대전화에서는 기존 단말 지원 판정을 사용합니다.

실기기 통화 PCM, 녹음 성공, 실시간 STT 동작과 각 메뉴의 개별 서버 기능 전체는 이번 검증 범위에 포함되지 않았습니다.

| 설치 파일 | 크기 | 다운로드 |
| --- | ---: | --- |
| 메인 APK | 165,917,560 bytes | [IXIO_HITEL_QA_AllRetryErrors_20261121.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-qa-all-retry-errors-20261121/IXIO_HITEL_QA_AllRetryErrors_20261121.apk) |
| 녹음 보조앱 APK | 30,780,855 bytes | [IXIO_Recorder_Companion_AllRetryErrors_20261121.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-qa-all-retry-errors-20261121/IXIO_Recorder_Companion_AllRetryErrors_20261121.apk) |

두 파일은 같은 시험 서명으로 생성되었습니다. 게시 후 별도 실행 환경에서 인증 없이 HTTPS GET으로 다시 내려받았습니다. 두 주소의 HTTP 200 응답, 실제 설치 시험에 사용한 APK와의 바이트 일치, 메인 APK의 시험 당시 SHA-256 일치를 모두 확인하였습니다.

| 파일 | SHA-256 |
| --- | --- |
| 메인 APK | `3a44aa26ad3e4efff86aca024d3522425901cb4c51856d87c6625dca9f405a3d` |
| 녹음 보조앱 APK | `a12d0e426abfa2ab5e75107c1c685b1e798e8fa59432a20843b17d2db8526408` |

[빌드·설치·화면 검증](https://github.com/lyonbegin/hitel-room/actions/runs/44917960399)과 [익명 다운로드·바이트 일치 검증](https://github.com/lyonbegin/hitel-room/actions/runs/44919050496)은 각각 성공하였습니다. [외부 패키지 포함 검색](https://github.com/lyonbegin/hitel-room/actions/runs/44907540111)에서도 추가 오류 호출부는 0곳이었습니다.

빌드 소스는 `ca6c2f114bb03a5911c4323eb143bb9d4e48bb02`, 배포 참조는 `8be0646de7d48db89f41fa34b18db2f84b13be09`입니다. 양쪽의 `tools/ixio` 트리 SHA는 `964647b0f1a1150de55c720fdebe7fa9aed095a0`으로 동일합니다. 배포 참조에는 기본 브랜치와 동일한 워크플로 파일을 유지하고, 빌드에 사용한 작업 설정과 소스 커밋은 위 실행 기록에 보존하였습니다.

전체 호출부 목록은 [ixio_retry_error_caller_index_20261122.json](ixio_retry_error_caller_index_20261122.json), 다운로드 검증 수치는 [ixio_public_apk_verification_20261122.json](ixio_public_apk_verification_20261122.json)에 기록하였습니다.
