# IXIO 원본 복원 DEX 전수 암호화·DEK 역공학 증거 보고서 (2026-11-20)

## 검증 범위·주의 사항

이 보고서는 원본 AppSealing 보호 입력(XAPK/녹음 APK), 보호 해제 당시 회수한 실행 DEX를 재조립한 메인 APK, 원본 녹음 앱 재조립본, 실제 GitHub Pages 시험 APK를 **서로 다른 입력으로 구분**합니다. APK의 설치·홈 화면 진입만으로 통화·STT·인증 기능을 성공이라고 간주하지 않습니다. 암호화 키/토큰 원문, JNI 라이브러리의 숨겨진 비밀 리터럴, 개인정보는 수집하거나 보고서에 복사하지 않았습니다.

### 증거

- 보호된 원본 소스: [ixio-input-20261115](https://github.com/lyonbegin/hitel-room/releases/tag/ixio-input-20261115) (main.xapk SHA-256: `4ec4793327930e72589c1d47e552e1e77f97ccf77db71c63c701934f2337a3fc`; recorder.apk SHA-256: `3cf822dda33eeef28ec3b85cb5872182371c92d07ed100e3a0fab71fbf1a37d7`).
- 런타임 DEX 회수 및 재조립 실험: [#43707483111](https://github.com/lyonbegin/hitel-room/actions/runs/43707483111). 메인 복원 코드와 녹음 앱 복원 코드의 출처 및 실패 이력은 `docs/ixio-original-bytecode-separate-reassembly-startup-verification-20261115.md`.
- 재조립 단일 메인 APK: [#43799320393](https://github.com/lyonbegin/hitel-room/actions/runs/43799320393). **원본 보호 APK 바이너리와 동일 파일은 아님**: Firebase ContextBridge 등 재조립 요소 존재.
- 원본 DEX 로그인 CTN 호출자: [#44206018215](https://github.com/lyonbegin/hitel-room/actions/runs/44206018215).
- 원본 전체 암호화/키 호출 목록: [#44743457219](https://github.com/lyonbegin/hitel-room/actions/runs/44743457219) / 아티팩트 `IXIO_20261120_FULL_ORIGINAL_DEX_CRYPTO_PROVISIONING_CALL_GRAPH`. 메인 19개 DEX, 녹음 앱 6개 DEX 역어셈블. 메인 앱 자체 패키지와 녹음 앱·AppSealing 패키지 범위의 메서드 수집.
- 원본 대비 시험 APK의 정확한 클래스·메서드·키 관련 명령 및 JNI: [#44744547759](https://github.com/lyonbegin/hitel-room/actions/runs/44744547759) / `IXIO_Exact_Original_Provisioning_Keystore_NativeKey_and_QA_Method_Diff`.
- 녹음 앱의 암호화 메서드 추림: [#44744736815](https://github.com/lyonbegin/hitel-room/actions/runs/44744736815).
- 서명 인증서 실측 및 네이티브 ELF: [#44745536481](https://github.com/lyonbegin/hitel-room/actions/runs/44745536481) / `IXIO_Original_QA_Signer_Native_Encryptor_ELF_Readonly`.

## 1. DEX와 실제 변경 위치

메인 APK `classes.dex`~`classes19.dex` 총 19개, 녹음 앱 `classes.dex`~`classes6.dex` 총 6개를 분석했습니다. 메인 업무 코드의 대부분은 15~18번 DEX에 있습니다. 키·인증·저장소 분류의 후보 메서드는 메인 8,034개, 녹음 2,388개이지만, 이 숫자에는 이름 또는 호출 컨텍스트 일치·합성 클래스·스토리지 메서드가 포함되므로 **독립 암호화 알고리즘 개수가 아닙니다.**

재조립 메인 APK와 최종 QA APK 사이에 달라진 DEX 파일은 15, 16, 18번 **정확히 3개**입니다. 원본 대비 변경된 메서드는 다음과 같습니다.

| DEX | 클래스 | 변경된 메서드 |
|---|---|---|
| 15 | `domain/init/usecase/LogInUseCase` | `invoke(Continuation)` |
| 15 | `domain/init/usecase/ResolveOnboardingLoginEntryUseCase` | `invoke(Continuation)` |
| 16 | `network/api/ixio/IxIOAuthApi` | `postAutoLogin` |
| 16 | `network/api/ixio/IxIOMemberServiceApi` | `getLoginData`, `getLoginDataV2`, `getTokenData` |
| 16 | `network/api/ixio/IxIOSetupWizardApi` | `verifyCtn` |
| 16 | `network/client/BaseServer` | `createClient$network` |
| 16 | `network/client/IXIOPagesLoginMockInterceptor` | **신규 추가 클래스** |
| 18 | `data/auth/MemberVerificationRepositoryImpl` | `verifyCtn-gIAlu-s` |

따라서 7개 기존 클래스의 9개 메서드가 수정되었고 신규 인터셉터 1개가 추가되었습니다. `util/crypto/*`, `EncryptCtnUtil`, `AES256Util`, `com/lguplus/encryptor/NativeKeyProvider`의 직접 메서드는 위 비교에서 수정된 대상으로 잡히지 않았습니다. 하지만 **APK의 최종 서명은 별도로 변경**되었으므로, 복호화의 외부 입력이 같다는 뜻은 아닙니다.

## 2. DEK 생성 및 저장: 실제 원본 호출 그래프

```text
IXIApplication$onCreate$2.invokeSuspend()
  -> ProvisioningManager.ensureProvisioned-IoAF18A()
       -> [ensureProvisioned$2.invokeSuspend()]
       -> DekProviderLib.loadDeviceWrappedDek()
       -> AppBindingDataProvider.getAppBindingData(Context)
       -> KeystoreKekManager.getOrCreateKek()
       -> DekWrapper.unwrapDek(wrappedDEK, kek, appBinding)
       -> [누락/검증 실패 시 처리 분기]
          DekProviderLib.clearDeviceWrappedDek()
          ProvisioningManager.performProvisioning()
             -> getDekFromEncryptedDek()
                -> DekProviderLib.getEncryptedDek()
                -> AppBindingDataProvider.getAppBindingData(Context)
                -> ProvisioningKeyDeriver.deriveProvisioningKey(appBinding)
                -> EncryptedDekCrypto.decryptDek(encryptedDek, derivedKey)
             -> KeystoreKekManager.getOrCreateKek()
             -> AppBindingDataProvider.getAppBindingData(Context)
             -> DekWrapper.wrapDek(DEK, KEK, appBinding)
             -> DekProviderLib.saveDeviceWrappedDek(wrappedDEK)
```

즉, `ensureProvisioned()` 호출 자체는 원본 `IXIApplication$onCreate$2`에 존재합니다. **시험 로그인 코드가 이를 직접 삭제했다고 주장하면 사실과 다릅니다.** 호출 이후 실패 또는 초기화의 경쟁 상태 여부는 런타임으로 입증해야 합니다.

## 3. DEK 조회 및 CTN 암호화: 실제 원본 호출 그래프

```text
LogInUseCase.invoke()
  -> GetEncryptedCtnUseCase.invoke()
       -> CtnRepository.getEncryptedCtn()
          -> CtnRepositoryImpl.getEncryptedCtn()
             -> EncryptCtnUtil.encrypt(ctn)
                -> EncryptCtnUtil.getDekBytes()
                   -> ProvisioningManager.getDekForLoginUse-IoAF18A()
                      -> DekProviderLib.loadDeviceWrappedDek()
                      -> AppBindingDataProvider.getAppBindingData()
                      -> KeystoreKekManager.getOrCreateKek()
                      -> DekWrapper.unwrapDek()
       -> IxIOUserServiceRepository.getLoginUrlV2(encryptedCtn)
MemberVerificationRepositoryImpl.verifyCtn-gIAlu-s()
  -> EncryptCtnUtil.encrypt()
  -> MemberVerificationRemoteSource.verifyCtn()
  -> IxIOSetupWizardApi.verifyCtn()
CtnRepositoryImpl.authorizeCtn-0E7RQCE()
  -> CtnRepositoryImpl.getEncryptedCtn()
  -> IxIOCallSummaryRepository.postCtn(...)
  -> IxIOUserServiceWithTokenRepository.postCtn(...)
```

`EncryptCtnUtil.encrypt/decrypt`는 원본 Smali에서 AES/CBC/PKCS5Padding, SecretKeySpec, IvParameterSpec, SecureRandom, Base64 조합을 사용합니다. 위 경로는 통화·재인증·토큰 연계 시 다시 활성화될 수 있으므로 단순히 `LogInUseCase` 한 곳의 암호화만 시험 문자열로 대체해서는 전체 기능이 이어지지 않습니다.

## 4. 별도 키·저장·네이티브 암호화 계층

| 클래스/메서드 | 실제 확인한 특징 |
|---|---|
| `DekProviderLibImpl.getEncryptedDek` | `NativeKeyProvider.getCtnEncryptKeyProdRelease()`를 호출하고 Base64 디코딩 |
| `DekProviderLibImpl.createEncryptedSharedPreferences` | AndroidX `MasterKey(AES256_GCM)`, `EncryptedSharedPreferences`의 AES256_SIV(키) + AES256_GCM(값); IOException/GeneralSecurityException 시 일반 SharedPreferences 폴백 존재 |
| `DekProviderLibImpl.loadDeviceWrappedDek` | `device_wrapped_dek` 문자열 취득 후 Base64 디코딩 |
| `DekProviderLibImpl.saveDeviceWrappedDek` | 암호화·래핑된 바이트를 Base64로 `device_wrapped_dek`에 저장 |
| `DekProviderLibImpl.clearDeviceWrappedDek` | 해당 저장 항목 제거 |
| `KeystoreKekManager.getOrCreateKek` | AndroidKeyStore에서 기존 AES KEK 조회, 없다면 생성 |
| `DekWrapper.wrapDek/unwrapDek` | AES/GCM/NoPadding, `Cipher.updateAAD(appBinding)` |
| `ProvisioningKeyDeriver.deriveProvisioningKey` | 앱 결합 바이트 등을 SHA-256으로 처리해 AES 키 규격 생성 |
| `EncryptedDekCrypto.decryptDek` | GCMParameterSpec/Cipher 복호화 |
| `AES256Util` | 앞선 DEK 구조와 별도 Keystore 키 생성·조회, CTN/서버용 암호화 및 서비스 키 경로 |
| `NativeKeyProvider` | `System.loadLibrary`로 실제 JNI 라이브러리를 로드하며 네이티브 메서드 다수 보유 |

원본 `NativeKeyProvider`에는 `getAesKey`, `getAesTransformation`, `getAesTransformationCtn`, `getAiSmartSummaryKey`, `getAppsFlyerKey`, `getChatEncryptKeyDev/Prod`, `getCtnEncryptKeyDevDebug/DevRelease/ProdDebug/ProdRelease/StgDebug/StgRelease`, `getKeyAlias`, `getKeyStoreName`, `getMmServiceKey`라는 별개 JNI getter 16개가 있습니다. 실제 AArch64 ELF `libencryptor-lib.so`의 JNI export 16개와 대응함을 확인했습니다. 네이티브 라이브러리 18개는 메인 복원본과 QA APK 사이에 바이트 변경이 0개였습니다. **JNI 내부 비밀키 값/기계어 의미 분석은 이 보고서에서 완료되었다고 주장하지 않습니다.**

녹음 보조 앱 복원 DEX의 직접 암호화 기본 메서드로 확인된 것은 특히 AppSealing 코드의 `AwsSqsSender.hmac256/sha256` 및 `HttpUtils`의 TLS 설정입니다. 전체 녹음 서비스의 PCM 저장·통신이나 STT가 동일 DEK를 직접 사용한다는 증거는 이번 DEX 분류만으로 발견되지 않았습니다. **녹음의 다른 암호화·네이티브 경로 부재를 확정하지 않습니다.**

## 5. 결정적인 재서명·인증서 종속성

원본 `AppBindingDataProvider.getSigningCertificateSHA256(Context)`는 `PackageManager.getPackageInfo`, `SigningInfo.getSigningCertificateHistory`, `CertificateFactory`, `MessageDigest.digest`를 사용합니다. `getAppBindingData`는 앱 패키지명과 해당 서명 인증서 SHA-256 정보 등을 결합해 바이트 배열을 반환합니다. 이 데이터는 `ProvisioningKeyDeriver`의 DEK 복호화 키 파생 입력이고 `DekWrapper.updateAAD`의 인증 입력입니다.

서명 실측:

| APK | 실제 앱 서명 인증서 SHA-256 |
|---|---|
| 보호된 LG유플러스 원본 `base.apk` | `78cc8f145957291408bbfaec1c94ef1e761ac4a84b960def2983b0818d5d05f0` |
| HITEL Github Pages QA APK | `5e6b7dc2aa26124569e91d29ab1b2cb285db7a9cd20bf194678fa862fed4b50d` |

원본 APK에는 별도 Google **Source Stamp** 인증서도 있으나, 위 비교는 앱의 기본 Signer 인증서끼리 비교했습니다. 서명 인증서가 다르다는 것은 증명되었습니다. **원본 네이티브 암호화 DEK가 원본 서명과 결합돼 있다면**, 시험용 재서명으로 파생 키가 달라져 초기화 실패가 발생할 수 있습니다. 하지만 ADB 로그에 파생 키의 인증 실패·AEAD 태그 오류가 직접 기록되지 않았으므로 이것이 실기기의 최종 실패 원인임을 입증한 것은 아닙니다.

## 6. 사용자 제공 실제 갤럭시 ADB 로그

- 21:52:40경: `DatastoreHandler`와 `DataStoreExtensionKt` 관련 `CancellationException: Data is null` 다수.
- 21:52:54/21:54:50경: OkHttp `Too many follow-up requests: 21`; `IxITokenInterceptor` 연관.
- 21:54:45: `ProvisioningManager$getDekForLoginUse$2.invokeSuspend(ProvisioningManager.kt:54)`에서 **`device_wrapped_dek not found`**.
- 앱의 CTN 암호화 호출에서 이 예외가 상향 전파해 프로세스가 종료됨.
- 모델 일부 파일 부재도 발견했으나, DEK 누락과 동일한 원인이라고 단정할 근거 없음.

현재 확인되는 가능한 선행 장애는 **초기 앱 프로비저닝 실패**, **재서명으로 인한 키 파생 입력 변경**, **EncryptedSharedPreferences 초기화 또는 저장 실패**, **DataStore 초기화와 비동기 로그인의 상태 충돌** 등입니다. 특히 저장 단계 `saveDeviceWrappedDek`가 실제 기기에서 호출·완료되었는지 아직 직접 증거가 없습니다.

## 7. 판단 및 다음 검증 경계

검증된 것은 원본 복원 DEX의 대상 메서드 호출 관계, 변경된 QA DEX의 실제 메서드, 공개 인증서 SHA-256 차이, JNI 내보내기 메서드, 실제 단말의 예외 위치입니다. 미검증은 **기기별 프로비저닝의 첫 실패 지점**, 서명 의존성이 이번 실기기 오류의 직접 원인인지 여부, 실제 통화녹음 서비스·STT의 정상 실행입니다.

정식 수정 이전에 먼저 확인할 사항: 원본 `IXIApplication.onCreate`의 코루틴에서 `ensureProvisioned` 실행·종료 상태, `getEncryptedDek`의 안전한 성공/실패 코드, 인증서 기반 앱 결합 정보 생성 성공 여부, `EncryptedSharedPreferences` 생성/폴백 여부, `saveDeviceWrappedDek`의 실제 저장 성공 여부. 민감한 DEK 값·네이티브 비밀키·암호문은 로그로 노출하지 마십시오.

**본 조사에서는 사용자의 시험 APK를 변경하거나 통신사/Android Keystore의 인증을 우회하지 않았으며, 새 APK를 빌드하지 않았습니다.** 읽기 전용 분석 스크립트·워크플로와 보고서만 GitHub에 추가하였습니다.
