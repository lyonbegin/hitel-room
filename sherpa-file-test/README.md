# Sherpa 한국어 파일 STT — 독립 Android 테스트 앱

- **패키지 ID:** `app.hitel.sherpafiletest` (HITEL v14와 완전히 별개)
- **STT:** `sherpa-onnx:1.12.26`, 한국어 streaming Zipformer INT8 `sherpa-onnx-streaming-zipformer-korean-2024-06-16` 재사용
- **M4A 디코딩:** `flow-lab/TranscriberM4aDecoder.kt` / `TranscriberLocalAudioBudget.kt` (Majkey25/transcriber-android MIT 기반), CI에서 패키지명만 변경해 복사
- **Android 파일 선택:** `ACTION_OPEN_DOCUMENT` (WhisperVault에서 확인한 SAF 접근 방식)
- **실행:** 파일 선택 → STT 실행 → 결과 확인 → TXT 저장 위치 선택
- **모델 제공:** 빌드 때 HF의 기존 Zipformer 4개 모델 파일을 APK assets에 넣음. 설치 후 **모델 네트워크 다운로드 필요 없음**.
- **권한:** 인터넷/마이크/전화/접근성 권한 불필요. Android 시스템 파일 선택기를 통해 해당 파일 읽기 권한만 요청.
- **모델 저장:** 설치 후 최초 실행에서 APK assets → 앱 전용 `files/sherpa-ko-v1/`로 추출. HITEL14의 비공개 모델 디렉터리와 직접 공유 불가.
- **로그:** `adb logcat -s SherpaFileTest` — 파일·PCM·디코드 회수·에러.
- **범위 제외:** 마이크, 기존 전화 후킹, 삼성 OEM, 자동 발신, v14 코드 수정.

## 재현

GitHub Actions `.github/workflows/build-sherpa-file-stt-test.yml`이 이 프로젝트만 컴파일합니다. Gradle 의존성 `com.github.k2-fsa:sherpa-onnx:1.12.26`은 기존 HITEL Android 코드와 동일합니다.

빌드 성공과 APK 유효성 검사는 Actions 로그로 확인합니다. 실제 갤럭시 M4A 파일의 전사 성공은 설치 후 장치 테스트가 필요합니다. 기존 APK는 수정·삭제하지 않습니다.

## 원본

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx/tree/v1.12.26), [official Java file streaming example](https://github.com/k2-fsa/sherpa-onnx/blob/v1.12.26/java-api-examples/StreamingDecodeFileTransducer.java)
- [Majkey25/transcriber-android](https://github.com/Majkey25/transcriber-android) (MIT); [license](https://github.com/Majkey25/transcriber-android/blob/main/LICENSE)
- [WhisperVault](https://github.com/rainhuang0220/WhisperVault) — 검증된 Android SAF 파일 선택 UX만 참조
