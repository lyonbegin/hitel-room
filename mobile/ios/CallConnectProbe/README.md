# HITEL iPhone XR 통화 중 파일 접근 시험

기존 전화 앱을 전면에 두고 단축어에서 CallKit 연결을 감지하면 파일 접근 가능성과 크기 변화를 검사하는 **메타데이터 전용** 앱입니다. 음성 명령, 음성 합성, 화면 터치 기능은 삭제합니다.

## 검사 내용
- 전화 앱 열림으로 실행된 단축어가 최대 20초 동안 통화 연결을 확인합니다.
- 연결되면 2초 간격으로 5번 파일 검사를 수행하고 JSONL 로그를 저장합니다.
- Apple Notes 앱 그룹의 접근 가능 여부와 공유 앱 그룹 상위 폴더 접근 결과를 별도로 기록합니다.
- HITEL 자체 Documents / Caches / tmp에서 오디오 확장자 파일의 크기·수정 시각·이전 검사 대비 증가량을 기록합니다.
- 앱이 전면에 남아 있다면 CallKit 관찰자로 추가 검사합니다. 백그라운드 지속 실행은 iOS에서 보장되지 않습니다.
- 검사 로그는 HITEL-Recording-File-Probe.jsonl로 저장되고 앱에서 공유할 수 있습니다.

## 결과 해석
Apple Notes 저장소 접근 불가는 파일 부존재의 증거가 아닙니다. 이 테스트 앱은 Apple Notes의 내부 컨테이너에 접근할 권한이 없으며, 실제 통화 오디오를 녹음하거나 복사하지 않습니다. 앱 자체 저장소에서 발견된 오디오를 Apple 통화 녹음이라고 판단하지 않습니다. 로그에 성공이 표시되어도 이는 파일 메타데이터 검사 실행에 한정됩니다.

## 설치 및 배포
GitHub Actions가 iPhone arm64용 unsigned IPA를 빌드합니다. Windows Sideloadly로 본인 Apple ID 서명 후 iPhone XR(iOS 18.7)에 설치하셔야 합니다. 기존 번들 ID app.hitel.callconnectprobe를 유지합니다. 기존 HITEL SDK·통화·영상·Railway에는 변경을 가하지 않습니다.

Apple 공식 자료
https://developer.apple.com/documentation/callkit/cxcallobserver
https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox
