# IXIO 원본 모델 다운로드 / 통화녹음 장애 추적 — 실행 증거 (2026-11-20)

> 목적: 새 STT/다운로더/녹음 앱을 제작하는 것이 아니라 기존 IXIO 복원 DEX의 **원본 실행 경로를 계속 진행**하여 막힌 지점을 확인하고 수정한다. 모델·녹음 알고리즘은 보존한다. 11월 21일 추가 시험에는 원본 진입 메서드 호출, 로그 계측, 중복 401 재시도 종료, 원본 DEK 자산의 출처 결합값 수정이 포함된다. 아래의 초기 시험 기록과 최신 수정 범위를 구분한다.

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

## 2026-11-21: 실제 HTTP 401 반복 확인 및 재시도 수정

이하 CI 실행 시각은 원문 로그의 UTC다. 한국 시각은 9시간을 더한다.

- [#44839659920](https://github.com/lyonbegin/hitel-room/actions/runs/44839659920): 원본 `checkAndStartAiModelDownload()` 실행과 녹음 설정 완료. OkHttp **network interceptor**에서 인증 모델 API의 **401 응답 21회**를 확인했다. 같은 논리 요청에서 재요청이 반복된 뒤 원본 `IxIServerException`으로 끝났다. WorkManager 모델 다운로드 시작은 0건.
- 종전 `REQUEST_TO_ORIGINAL_MODEL_CATALOG`는 application interceptor 진입 표식이다. 이 표식만으로 실제 소켓 전송 횟수를 판정하지 않는다. 종전 응답 코드 0건은 서버 무응답을 뜻하지 않는다. 인증·재시도 아래쪽의 실제 응답을 기록하지 못했던 것이며 이번 시험에서 실제 401을 확보했다.
- 종전 토큰 계측은 `v2` 레지스터의 `chain.proceed` 두 분기를 빠뜨렸다. 네 가지 원본 분기를 전부 계측하도록 고쳤다. 로그 호출을 제거하면 원본 토큰 인터셉터·코루틴·DataStore·Authenticator의 기존 코드와 동일함을 로컬에서 비교했다.
- [#44840721447](https://github.com/lyonbegin/hitel-room/actions/runs/44840721447): 연속 401의 `Authorization` 값이 이전 요청과 같은 경우에만 Authenticator에서 `null`을 반환하도록 수정했다. 최초 인증, 새 인증값, 토큰 갱신과 리다이렉트는 유지한다. 한 논리 요청의 동일 인증값 재시도는 최대 2회 응답에서 끝났으며, 실제 종료 표식은 전체 API 합계 5건이었다. 모델 API 401은 여러 논리 요청을 합해 3건으로 줄었고 다운로드 시작은 여전히 0건이었다. 인증 성공 응답이나 모델 데이터는 만들지 않았다.

## 2026-11-21: 원본 네이티브 DEK 자산 검증

검증 파일: [native-dek-binding-verification.json](ixio-20261121-native-dek-binding-verification.json).

- 원본 `libencryptor-lib.so` SHA-256: `eee000433ca92347981a70b30effa6afa8c004c1b86478701e7fc2b3fb2dcff4`.
- AArch64 JNI `getCtnEncryptKeyProdRelease`, 주소 `0x16d4c`, 길이 152바이트를 직접 역어셈블했다. 해당 함수는 원본 암호화 자산을 Java 문자열로 반환한다.
- 원본 코드 그대로 `SHA256("ctn_dek_provisioning_v1" + 0x00 + UTF8(package) + 0x00 + SHA256(source signer certificate))`를 계산했다. 원본 GCM nonce·태그·암호문에 대해 **원본 인증서 결합값으로 인증 복호화 성공, 기존 시험 인증서 결합값으로 InvalidTag**를 확인했다. 복호화된 DEK 길이는 32바이트이며 평문 키는 저장하거나 출력하지 않았다.
- 수정은 `ProvisioningManager.getDekFromEncryptedDek()`의 자산 복호화 결합값 선택 한 곳으로 제한한다. 원본 자산은 원본 인증서 정보로 읽고, 기기 Keystore KEK와 새로 저장되는 데이터의 wrapping/unwrapping AAD는 현재 APK의 실제 결합값을 계속 사용한다. 전역 서명 조회, 서버 인증, 원본 암호화 자산 및 암호화 알고리즘은 변경하지 않는다.

## 2026-11-21: 녹음의 다음 실제 차단 지점

- [#44840455817](https://github.com/lyonbegin/hitel-room/actions/runs/44840455817), [#44840721447](https://github.com/lyonbegin/hitel-room/actions/runs/44840721447): 녹음 앱의 실제 `모든 전화` 설정을 선택하고 에뮬레이터 GSM 수신·연결을 실행했다. Telecom `ACTIVE`와 원본 `InCallServiceImpl` 연결을 확인했다.
- 원본 통화 화면 대신 **필수 권한 설정: 전화/통화 기록/음악 및 오디오** 안내가 표시됐다. 녹음 서비스 시작과 녹음 버튼 조작은 이 단계에서 진행되지 않았다. 단순히 녹음 앱 프로세스가 있다는 사실을 녹음 성공으로 판정하지 않는다.
- 이후 시험에는 선언된 Android 런타임 권한만 부여하고 결과를 확인하는 에뮬레이터 전용 준비를 추가했다. 플랫폼의 privileged 권한이나 PCM 취득 로직은 바꾸지 않는다.
- 초기 원본 초기화 호출용 진단 스레드에 `null` 코루틴 컨텍스트를 전달한 오류가 있어 NPE가 발생했다. 이는 **진단 연결의 오류**이며 원본 암호화의 실패로 판정하지 않는다. `EmptyCoroutineContext.INSTANCE`로 수정했다. 초기화·다운로드 호출 실패 시 클래스와 제한된 스택 프레임을 남긴다.

## 2026-11-21: 모델 7종 다운로드·압축 해제 및 DEK 초기화 성공

[실제 실행 #44842091854](https://github.com/lyonbegin/hitel-room/actions/runs/44842091854), 시험 커밋 `be21981b59d367a01bb9eccfaab3db1866203bfb`.

1. 원본 `ProvisioningManager.ensureProvisioned`가 `00:14:56.669` 시작, `00:14:56.783` 성공했다. 내장 자산은 원본 인증서 결합값으로 읽고 기기 저장은 현재 APK 결합값을 유지한 결과다.
2. 시험 로그인 이전 초기화에서 원본 `downloadMissingModels-IoAF18A()`를 호출했다. 원본 토큰 판정과 API 선택을 유지했고, **원본 `v2/ai-model/check`가 HTTP 200을 반환**했다. 인증 API를 성공 응답으로 바꾸지 않았다.
3. 원본 `DownloadWorker` **7건이 모두 SUCCESS**, 후속 `FileUnzipWorker` **1건이 SUCCESS**로 종료됐다. `unzipFilesParallel, Success`는 `00:15:49.882`에 기록됐다. 단순 작업 등록이나 성공 반환만으로 판정한 것이 아니다.

| 원본 모델 | 실제 다운로드된 버전 |
|---|---|
| STT | 4.0.4 |
| ITN | 1.1.1 |
| VP | 6.0.0 |
| NERCLS | 1.2.0 |
| REMINDER | 1.2.0 |
| SPK | 4.0.0 |
| SPAMSMS | 3.0.0 |

이 실행에서는 Hilt가 여러 원본 use-case 인스턴스를 생성해 초기 호출이 중복됐지만, 원본 저장소가 `already active, items=7`로 중복 작업을 차단했다. 최종 시험 연결은 검증된 초기 호출 형태와 원본 저장소의 중복 처리를 유지한다.

녹음은 이 실행에서 아직 시작하지 못했다. 선언된 런타임 권한 11개는 실제 granted=true였지만 통화 화면의 필수 권한 검사는 false였다. 추가 역공학으로 `classes7.dex`의 `PermissionUtil.getRequirePermissionList()`와 `classes9.dex`의 `PermissionString`을 확인했다. **BASE + DIALER - OPTIONAL** 계산에 따라 `READ_SMS`와 `CAMERA`도 필수인데 시험 준비에서 빠져 있었다. 이 두 권한을 에뮬레이터에 실제 부여하는 후속 시험을 추가했다. 권한 검사 결과를 강제로 true로 바꾸지 않았다.

실제 통화 PCM 녹음과 STT 문자 출력은 아직 성공 판정하지 않는다. 에뮬레이터 모의 GSM 통화와 실제 상대방 음성 입력은 구분한다.

### 남은 모델 파일의 구분

7종의 압축 해제 후 원본 로그가 STT 4.0.4 등 설치 버전을 읽었으며, 이전에 반복되던 `decoder.ort not Exists` 대신 `hnsw.bin not Exists`가 남았다. `classes17.dex`의 `ModelFiles`에서 `hnsw.bin`은 `CRIMINAL_VOICE_INDEX_FILE_NAME`, `key.txt`는 `CRIMINAL_VOICE_KEY_FILE_NAME`임을 직접 확인했다. 원본 `AiModelRemoteSourceImpl.fetchAiModelInfoAuthenticated`는 인증 모델 응답의 `criminalVoicePrintFile`을 추가로 파싱한다. 같은 실행에서 인증 모델 API는 실제 HTTP 401을 반환했다. **7종의 모델 다운로드·압축 해제 완료**, **범죄자 음성 DB 미완료**, **실제 STT 추론 미검증**을 구분한다.

## 최종 재시험: 원본 통화 화면·AIDL 접속 성공, 녹음 시작은 Fail

[실제 실행 #44845033080](https://github.com/lyonbegin/hitel-room/actions/runs/44845033080), 시험 커밋 `ac1698f89d7f025c1f323e142ed1231fd8d04075`.

정리된 실제 결과는 [final-model-recorder-runtime.json](ixio-20261121-final-model-recorder-runtime.json), 재현용 분석은 [runtime readout](../tools/ixio/ixio_model_recorder_runtime_readout.py)에 있다.

| 실제 확인 항목 | 최종 결과 |
|---|---|
| 원본 DEK 초기화 | 성공 |
| STT 등 7종 DownloadWorker | 7건 모두 SUCCESS 재현 |
| FileUnzipWorker | 1건 SUCCESS 재현 |
| 원본 필수 권한 검사 | true; 실제 필수 9개 항목의 ContextCompat 결과 모두 0 |
| 에뮬레이터 원본 통화 화면 | 진입 성공 |
| 원본 통화녹음 버튼 | 실제 조작 확인 |
| 녹음 AIDL 접속 | 성공, 서비스와 리스너 등록 확인 |
| 원본 녹음 시작 | 재시도 후 `Failure(error=Fail)` |
| 실제 통화 PCM·음성 파일·STT 출력 | 성공 미확인 |

녹음은 더 이상 녹음 앱 설정 화면이나 필수 권한 안내에서 멈춘 상태가 아니다. 실제 로그 순서는 다음과 같다.

- `00:47:10.396` 원본 `isRequirePermissionGranted`가 true 반환. 전화·전화번호·음악 및 오디오·통화기록 읽기/쓰기·발신·문자 읽기·전화 응답·카메라의 실제 검사 결과 모두 `PERMISSION_GRANTED(0)`.
- `00:47:18.786` 원본 `StartRecordUseCase` 시작.
- `00:47:18.849` `[AidlRecordingStrategy] Service binding initiated: true`.
- `00:47:18.995` `[AidlRecordingStrategy] CallRecordingService connected`.
- `00:47:19.015`, `00:47:22.289` 실제 `Register CallRecordListener` 두 차례 기록.
- `00:47:22.288` 원본 녹음 시작 재시도.
- `00:47:25.290` `provider=VOLTE, result=Failure(error=Fail)`.
- `00:47:58.557` `outcome=start_failed reason=Fail`.

중요한 계측 정정: 기존 GSM 스크립트 요약의 `recording_service_bound_after_toggle=false`는 `.InCallService`처럼 **Android가 축약 표기한 컴포넌트 이름을 정규식이 놓친 결과**였다. 실제 dumpsys에는 `com.lguplus.callrecorder/.InCallService`, `ixio.ACTION_RECORDING_START`, `hasBound=true`, 메인 앱의 Client AppBindRecord가 함께 있다. 새 분석기가 실제 서비스 블록과 접속 로그를 교차 확인하므로 이 값만 보고 미연결로 판정하지 않는다. 리스너 등록과 AIDL 접속 성공을 실제 PCM 녹음 성공으로 해석하지도 않는다.

호출 후 로그에는 `RecordFail(isStorageOverFlow=false, isModelFileNotFound=true)`가 있었고, 이후 화면에는 ‘익시오를 이용할 수 없는 휴대폰이에요’가 표시됐다. **이 두 후속 관측과 녹음 시작 Fail의 직접적인 인과관계는 아직 입증되지 않았다.** 에뮬레이터이므로 실제 갤럭시의 통화 음성 녹음 성공을 보장하지 않는다.

다음의 정확한 조사 경계는 기존 `CallRecordingManager$startRecord$2`의 **리스너 등록 → 토큰·사용자 ID 읽기 → 보조 앱 시작 명령 → 시작 응답/콜백**이다. 현재 로그로는 이 구간을 실제 오디오 캡처 실패와 구별할 수 없어, OS 오디오 권한 또는 특정 OEM 제한 때문이라고 단정하지 않는다.
