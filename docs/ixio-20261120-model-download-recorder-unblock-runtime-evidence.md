# IXIO 원본 모델 다운로드 / 통화녹음 장애 추적 — 실행 증거 (2026-11-20)

> 목적: 새 STT/다운로더/녹음 앱을 제작하는 것이 아니라 기존 IXIO 복원 DEX의 **원본 실행 경로를 계속 진행**하여 처음 막히는 메서드/서비스를 확인한다. 아래의 시험에서 모델 및 녹음 바이트코드는 수정하지 않았다.

## 입력 및 실기기 로그

- 사용자 실기기 Galaxy SM-F711N의 `IXIO_ADB_20261120_220212.zip`: 2026-11-20 21:52 ~ 22:02 로그. `[AiModelCheck] --> decoder.ort not Exists` 외 `itn_vocab.json.enc`, `IxiVpDetectModel.onnx`, `ask_ner.onnx`, `slm_vocab.json.enc`, `spk.onnx`, `hnsw.bin`, `ixiSpamSms.onnx`의 부재 경고. Logcat WorkManager 일반 동작은 확인되지만 AI 모델 다운로드 워커 실행 흔적은 없음. 원본 로그에 모델 HTTP 응답 상태가 직접 기록되어 있지 않아 HTTP 401/403이라고 단정 불가.
- 21:54:44 `shouldRecordOnConnected: true` -> 21:54:45 `ProvisioningManager.getDekForLoginUse`에서 `device_wrapped_dek not found`로 메인 프로세스 크래시. 녹음 PCM 생성 여부는 미검증.
- 원본 복원 메인 `IXIO_Main_NoAppSealing_Single.apk`: [#43799320393](https://github.com/lyonbegin/hitel-room/actions/runs/43799320393); 복원 원본 보조 앱 `recorder-reassembled-signed.apk`: [#43707483111](https://github.com/lyonbegin/hitel-room/actions/runs/43707483111).

## 모델 다운로드 원본 바이트코드에서 확인한 단계

[원본 DEX 전수 호출 검증 #44749457831](https://github.com/lyonbegin/hitel-room/actions/runs/44749457831) 및 [정밀 조건 분기 #44751284862](https://github.com/lyonbegin/hitel-room/actions/runs/44751284862):

1. `InitScreenUseCase.checkAiModelUpdateAfterCallRecorderSetup()`은 먼저 `CheckCallRecorderAppStateUseCase.getInitialCallRecorderStatus()`를 호출한 다음 `getUpdateAiModelFile()`로 진행.
2. `RecentCallsViewModel.checkAndStartAiModelDownload()` → `proceedAiModelDownload()` → `UpdateAiModelUseCase.fetchUpdatingAiModel()` 경로 존재.
3. `UpdateAiModelUseCaseImpl.checkDownloadAvailability()`의 실제 조기 반환 분기: `NETWORK_NOT_CONNECTED`, `ALREADY_DOWNLOADING`, `NO_STORAGE`; 모두 통과한 경우 `AVAILABLE`.
4. `UpdateAiModelUseCaseImpl.getAiModelInfoList()`는 로컬 설치·저장된 버전과 누락 모델 타입 목록을 확인하고 서버의 모델 카탈로그 정보를 가져온다.
5. `AiModelRemoteSourceImpl.fetchAiModelInfo()` → `IxIOAppConfigApi.getAiModelVersionV2()`; `fetchAiModelInfoAuthenticated()` → `IxIOAppConfigApi.getAiModel()`. 이 둘은 별도 API이며 성공 여부는 원본 서버 응답으로 판정해야 함.
6. `DownloadViewModel.startAiModelDownload()` → `UpdateAiModelUseCase.downloadMissingModels()` 또는 `updateAiModels()`; 실패 시 `onFailDownload()`.
7. `AiModelUpdateRepositoryImpl.startDownloadsInternal()` → 기존 `createDownloadWorker()` (모델 파일 URL·이름·버전 전달) → `WorkManager.beginUniqueWork(...).then(createFileUnzipWorker()).enqueue()`. **이번 재시험들의 WorkManager 다운로드 시작 건수는 전부 0**.

이 구조를 이용해 실행을 더 깊게 시험하려면 **새 모델 다운로드 구현이 아니라** 원본 `RecentCallsViewModel.checkAndStartAiModelDownload()`를 시험 환경에서 한 번 호출하여 원본 카탈로그 API의 결과, URL 획득, 원본 WorkManager 등록 여부를 순서대로 기록해야 한다. 실패 시 실제 HTTP 상태나 예외가 확인되기 전에는 가짜 성공 응답/가짜 모델 파일/인증 우회를 사용하지 말 것.

## 녹음 보조 앱의 기존 차단 해제 실제 성과

- 이전 정상화 경로 [#44212635729](https://github.com/lyonbegin/hitel-room/actions/runs/44212635729): 복원된 보조 앱의 `com.inka.appsealing.AppSealingApplication.getContext(Object)`만 연결 복구하여 권한·설정 화면에 진입.
- 최근 시험 [#44737370814](https://github.com/lyonbegin/hitel-room/actions/runs/44737370814): **수정하지 않은 원본** 보조 앱은 에뮬레이터에서 `[50011] Launching the APP on Android emulator is not allowed`로 종료.
- 이번 [#44750140668](https://github.com/lyonbegin/hitel-room/actions/runs/44750140668): 기존 복원 DEX + 기존 Context 브리지 그대로 사용, 메인과 보조 앱을 동일한 **시험용 서명**으로 서명. 원본 마이크·오디오·알림 권한, 백그라운드 실행, ‘통화 자동 녹음’ 설정 화면까지 실제 진입 성공. 보조 앱 프로세스 PID 확인. **실제 전화 PCM 녹음 성공은 아님**.
- [#44751473535](https://github.com/lyonbegin/hitel-room/actions/runs/44751473535): 원본 녹음 설정 완료 → 원본 ‘최근 기록’ 화면 복귀. 모델 다운로드 팝업 0, 모델 다운로드 워커 0.
- [#44752937876](https://github.com/lyonbegin/hitel-room/actions/runs/44752937876): 원본 ‘설정’ 탭 진입. ‘부가서비스 이용 정보를 불러오지 못했어요. 버튼을 눌러 다시 시도해주세요’라는 실제 오류 화면 확인; 모델 다운로드 0. 이는 모델 카탈로그 API 실패와 **동일하다고 단정할 수 없음**.
- [#44754707519](https://github.com/lyonbegin/hitel-room/actions/runs/44754707519): 원본 설정 스크롤 후 일반 설정·녹음 파일 관리·백업 및 복원 화면 확인; 모델 관리 진입점 미노출.
- [#44755977800](https://github.com/lyonbegin/hitel-room/actions/runs/44755977800): 에뮬레이터 런처에서 메인 앱 시작 실패(로그인 전 PID 0). 설치는 성공했으나 **모델 단계 실패로 취급하지 않음**.
- [#44756916191](https://github.com/lyonbegin/hitel-room/actions/runs/44756916191): 메인 앱 정상 진입, 보조 녹음 설정 완료, ‘설정’ 전체 구간까지 3차 스크롤. ‘부가서비스 이용 정보를 불러오지 못했어요’ 재시도 1회 후 같은 문구 재현. 하단 ‘버전 정보’, ‘FAQ’, ‘약관’까지 탐색했지만 별도 **AI 모델 다운로드 메뉴는 화면에 나타나지 않았음**. `model_download_worker_started_count=0`, `model_download_service_log_event_count=0`, `recorder_process_alive=true`, `home_screen_seen=true`. 원본 모델 다운로드 진입점이 **전체 앱에 없다**는 뜻은 아님; **현재 설정 탭에 노출되지 않음**이라는 뜻.

## 보존·수정 범위

- 주 실행 브랜치: `experiment/ixio-hitel-backend-android-20261116`.
- 기존 워크플로 `.github/workflows/ixio-pages-offline-login-android14-apk-20261120.yml`에서 기존 보조 앱 Context 연결 복구 후 설치; `tools/ixio/ixio-pages-qa-emulator-robot.py`에서 실제 앱 UI 조작 및 WorkManager 시작 증거 기록만 수정.
- **원본 모델 목록·다운로드·압축 해제·PCM·STT·AIDL 구현은 변경하지 않음.**
- 기존 메인 APK의 로그인 시험 부분은 계속 합성 인증이며, 통신사 서버에서 유효한 계정/모델 다운로드 권한을 받았다는 의미가 아님.
- 외부 배포를 위한 메인 + 녹음 보조 앱 APK는 생성 및 게시하지 않음. 실제로 게시·실기기 검증된 다운로드라고 주장하지 말 것.
- **판정**: 녹음 앱 설정 차단은 통과; 통화 녹음 및 원본 모델 다운로드는 아직 **미검증/미성공**. 다음 정확한 검증 지점은 기존 `RecentCallsViewModel.checkAndStartAiModelDownload()` 호출 및 `getAiModelVersionV2/getAiModel` 응답·WorkManager enqueue 확인.
