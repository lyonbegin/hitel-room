# HITEL 오디오 연동 — Voicenotes 2.0.5 IPA 구조 분석 기반 독립 구현

사용자 제공 `app.voicenotes_2.0.5_und3fined.ipa`를 정적으로 분석한 결과입니다. 본 구현은 공개 iOS API로 기능을 새로 작성한 것으로, Voicenotes의 저작권 있는 바이너리나 소스코드를 복사하지 않았습니다.

## 실제 IPA에서 확인한 사실

- 원본 앱 번들 ID: `app.voicenotes`; 버전 2.0.5; iPhoneOS ARM64.
- Share Extension: `app.voicenotes.VoicenotesShareExtension`.
- 확장 활성화 규칙: 파일 최대 5개, 오디오 외 이미지/PDF/마크다운 등 UTI 포함.
- 실행 파일 문자열: `loadItemForTypeIdentifier:options:completionHandler:`, `copyItemAtURL:toURL:error:`, `containerURLForSecurityApplicationGroupIdentifier:`, `group.app.voicenotes`, `voicenotes://share-files`.
- 따라서 일반적인 공유 파일 수신 → App Group 저장 → 본앱 전달 방식의 실마리가 있습니다. 실제 클로저 실행 흐름까지 원본 코드로 확인된 것은 아닙니다.

## HITEL의 새 기능

1. iOS 공유 메뉴 `HITEL 오디오 가져오기` — Apple 메모가 명시적으로 공유한 오디오 파일을 `NSItemProvider`로 수신.
2. 공유된 임시 파일이 삭제되기 전 자체 저장소로 사본 복사, SHA256·바이트 수 기록.
3. App Group 서명 가능: `group.app.hitel.notesbridge/Incoming`으로 전달, 본앱 활성화 때 자동 수집.
4. 일반 Apple ID 무료 서명: App Group 권한이 없어도 24MB 이하 오디오는 로컬 Pasteboard로 전달. 본앱의 `무료 서명: 공유된 오디오 받기`에서 저장. iOS의 붙여넣기 권한 안내가 있을 수 있음.
5. 본앱에서 오디오 트랙 검증, 크기·길이·SHA256 확인, 재생, 사용자 승인 시 오프라인 한국어 음성 인식 (`SFSpeechRecognizer.requiresOnDeviceRecognition`).
6. 원본 iOS Phone/Notes 비공개 폴더 접근, 무단 통화 녹음, 외부 서버 업로드는 포함되지 않음.
7. Apple 메모가 녹음 진행 중 오디오 파일을 공유하는지, 공유된 파일이 실시간으로 증가하는지는 이 정적 구현으로 증명되지 않음.

## 빌드 구성

- `project.yml`: 일반 Apple ID / Sideloadly용 App Group 없는 unsigned IPA. Share Extension과 본앱 간 클립보드 전달.
- `project.group.yml`: App Group 프로비저닝이 가능한 Apple Developer Team을 위한 unsigned IPA. 호스트와 확장 양쪽에 같은 App Group entitlement를 적용.
- `.github/workflows/ios-voicenotes-native-bridge.yml`: iOS arm64 2종 실제 컴파일, Share Extension 내장·오디오 UTI 규칙 확인, IPA 패키징 후 GitHub Release 발행.
- 두 IPA 모두 **서명 전 파일**이며, Apple ID 서명에 따라 실기기 설치 가능 여부가 달라집니다.

## 기능적 차이

Voicenotes 원본 앱의 로그인·과금·서버·AI 요약·디자인은 재현하지 않았습니다. 이번 구현 범위는 사용자가 요청한 Apple 메모 오디오 공유와 서드파티 iPhone 앱 간의 직접 전달 기능입니다. 비공개 Voicenotes 코드를 복제하지 않고 원본의 공식 iOS API 사용 흔적과 대응시킨 것입니다.
