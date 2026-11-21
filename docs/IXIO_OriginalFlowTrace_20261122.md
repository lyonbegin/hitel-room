# IXIO 원본 함수 경계 진단 로그 — 2026-11-22

원본 함수 사이에 로그를 삽입한 시험판입니다. 호출 전후·실제 반환값·분기·예외·상태 반영·녹음 콜백 오류 값을 기록합니다.

- 빌드 소스: `f2e967243cc354780ee0956549db769a9c78082f`
- 릴리스 소스: `0836c4f2ffcb60f0386e0e0c608ef21e8c14e94b`
- [빌드·Android 실행 검사](https://github.com/lyonbegin/hitel-room/actions/runs/44925580250)
- [익명 HTTPS 다운로드·바이트 일치 검사](https://github.com/lyonbegin/hitel-room/actions/runs/44925881305)
- [계측 코드](https://github.com/lyonbegin/hitel-room/blob/f2e967243cc354780ee0956549db769a9c78082f/tools/ixio/ixio_original_flow_trace.py)
- [앱 내부 로그·보관·복사 코드](https://github.com/lyonbegin/hitel-room/blob/f2e967243cc354780ee0956549db769a9c78082f/tools/ixio/qa_debug/DiagLog.java)

## 적용 범위

| 구간 | 기록 내용 |
|---|---|
| 설정 버튼·화면 | 이벤트·목적지 유형, 검사 결과, 실제 상태 값, 상태 반영 호출과 반환값 |
| 모델 검사 | 사용 가능 여부, 누락·다운로드 중 상태, API별 응답 코드·예외 유형 |
| 다운로드 | 작업 진입·재시도·HTTP 상태·파일 존재/크기·교체 결과·실제 작업 결과 |
| 압축 해제 | 원본 작업의 진입·호출 전후·예외·반환값 계측 |
| 녹음 | 메인 앱의 AIDL 호출 전후, onStarted/onCompleted/onError, 두 오류 정수, 보류 요청 완료 결과 |

원본 19개 DEX의 네 오류 리소스 실행 참조 66곳, 서로 다른 원본 함수 60개를 확인했습니다. 이번 경계 계측은 60개 함수를 빠짐없이 포함하며, 모델·녹음·설정의 관련 경로까지 총 382개 클래스, 16,097개 지점에 적용했습니다. 정적 API 경로 131개를 이름으로 분류하며 요청의 토큰·쿼리·본문은 기록하지 않습니다.

각 행에는 순서 번호·PID·TID가 들어갑니다. CALL_RETURN의 `from=S번호`로 대응하는 CALL을 찾습니다. 객체 식별값과 코루틴 label을 기록하여 중단·재개를 구분합니다. 문자열은 유형·길이를 기록하고, 모델 종류·버전은 제한된 형식만 기록합니다. 계정·토큰·전화번호·통화 내용·오디오 표본·HTTP 응답 본문을 이 계측에서 직렬화하지 않습니다.

원본 명령·레지스터를 보존합니다. 새 로그 invoke가 기존 catch에 다른 레지스터 상태를 합치지 않도록, 원래 예외 처리 범위에서 새 로그 호출만 제외합니다. 원본 명령 각각에 적용되는 예외 처리기는 전후 일치를 검사합니다. DEX 함수 참조 한도를 맞추기 위해 classes18의 계측 클래스를 클래스 이름과 명령을 보존한 채 추가 classes20.dex로 옮깁니다. 기존 비DEX 항목은 바이트 일치를 검사합니다.

기존 시험판의 로그인 시험 경로, 공개 모델 목록 선택, 공통 설정 VAS 메뉴 판정 처리는 유지합니다. 이번 변경은 원본의 실제 다운로드·녹음 결과를 성공으로 바꾸지 않습니다.

## 실제 검증 결과

| 항목 | 확인 결과 |
|---|---|
| 오류 함수 계측 누락 | 60개 중 0개 |
| 원본 명령·예외 처리 대상 보존 | 전체 빌드 검사 통과 |
| Android 14 앱 설치·시험 로그인·홈·녹음 설정 진입 | 통과, 치명적 종료 없음 |
| 실제 함수 경계 로그 | 72,860행 관찰 |
| 다운로드 원본 doWork의 Success 반환 | 4건 관찰. 모델 전체 준비·STT 성공을 뜻하지 않음 |
| 앱 로그 화면에 FLOW·순서 번호·PID·TID 표시 | 확인 |
| 실제 FLOW 기록을 로그 복사 버튼으로 클립보드에 저장 | 확인 |
| 실제 압축 해제 작업 종료 관찰 | 미관찰. 계측 삽입과 실제 실행 확인을 구분함 |
| 실제 녹음 콜백 관찰 | 미관찰. 실기기 통화 검증이 필요함 |
| 통화 자동 녹음 스위치 ON | 확인되지 않음 |
| 마지막 UI 검사에서 업데이트 버튼 클릭 | 확인되지 않음. 해당 실행의 자동 모델 경로에서 작업 반환값은 관찰함 |
| 두 공개 APK 다운로드 | 인증 없이 HTTP 200, 시험한 파일과 바이트 일치 |

실제 로그 예시:

```text
11-21 16:44:26.488  5513  5558 I HITEL_IXIO_DIAG: 11-21 16:44:26.488 #18368 pid=5513 tid=5558 [FLOW] S3646 DownloadWorker.doWork RETURN result=androidx.work.ListenableWorker$Result$Success#26316df
```

## 핵심 기록 보관과 복사

진행률 등 반복 기록이 핵심 결과를 밀어내지 않도록 중요 작업·결과·예외·녹음 콜백을 별도 진단 파일에도 보관합니다. 복사본에는 중요한 원본 호출·결과와 최근 전체 함수 로그를 함께 넣습니다. 각각 약 2MiB씩 두 세대로 제한합니다. 두 구역에 같은 순서 번호가 보이면 같은 사건의 중복 기록입니다.

실제 DiagLog 소스의 파일·압축 처리를 Android API용 호스트 어댑터와 함께 JVM에서 검사했습니다. 반복 이벤트 12,000개로 전체 로그를 순환시킨 뒤에도 최초 중요 결과·오류 코드가 보존됐습니다. 3,921,708자 복사본은 70,009자로 인코딩됐고, 복원 문자열이 원문과 일치했습니다. 로그 지우기 후 진단 파일 네 개가 모두 삭제됐습니다. 이 호스트 검사는 실제 통화 검증으로 취급하지 않습니다.

사용 순서: **로그 지우기 → 문제 동작 재현 → 로그 복사**. 긴 복사본은 Android 클립보드 전송 한도를 고려하여 GZIP_BASE64로 자동 인코딩합니다. 전체 내용을 그대로 전달하면 원문을 복원할 수 있습니다. 앱의 미리보기는 읽을 수 있는 텍스트입니다.

## APK

- [IXIO_HITEL_QA_OriginalFlowTrace_20261122.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-qa-original-flow-trace-20261122/IXIO_HITEL_QA_OriginalFlowTrace_20261122.apk) — 168,891,315 bytes, SHA-256 `adf4affccc9f38e9c8cce4a3a7b6848a12fa0903dda9ad3a064ebfcd9de875bb`
- [IXIO_Recorder_Companion_OriginalFlowTrace_20261122.apk](https://github.com/lyonbegin/hitel-room/releases/download/ixio-qa-original-flow-trace-20261122/IXIO_Recorder_Companion_OriginalFlowTrace_20261122.apk) — 30,780,855 bytes, SHA-256 `25463e9553299371ad0ca37f558c0c232593ff6daf7659c61f27fee3777295e8`

[전체 함수 로그 위치표](https://github.com/lyonbegin/hitel-room/releases/download/ixio-qa-original-flow-trace-20261122/IXIO_OriginalFlowTrace_Sites_20261122.json.gz)와 [실제 실행·외부 다운로드 보고서](https://github.com/lyonbegin/hitel-room/releases/download/ixio-qa-original-flow-trace-20261122/verified-public-trace-apks.json)를 같은 릴리스에 보관했습니다. 위치표의 함수·행 정보는 계측 시점의 원본 기준이며, classes18에서 classes20으로 옮긴 클래스 목록도 포함합니다.

두 APK는 같은 새 시험 서명으로 만들었습니다. 이전 시험판에 덮어 설치할 때 서명이 충돌할 수 있으므로, 기존 앱을 삭제해야 한다면 먼저 녹음 파일을 보관해야 합니다.

실기기 통화·PCM·STT 성공은 아직 검증하지 않았습니다. 별도 녹음기 앱 내부의 네이티브 함수는 이번에 계측하지 않았으며, 메인 앱의 원본 AIDL 요청과 수신된 콜백을 계측했습니다. 콜백이 오지 않은 것을 성공으로 기록하지 않습니다.
