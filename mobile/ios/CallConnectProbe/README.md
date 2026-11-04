# HITEL iPhone XR — iOS 시스템 통화 녹음 경로 읽기 검사

이 실험 앱은 기존 전화 앱을 전면에 유지하고, CallKit이 전화 연결을 확인하면 iOS 운영체제의 두 후보 디렉터리를 **실제 절대 경로로 직접 열어서** 권한·파일 목록·크기 변화·읽기 성공 여부를 기록합니다. Apple Notes의 일반 UI를 읽는 프로젝트가 아닙니다.

## 정확한 검사 대상

1. `/var/mobile/Media/Recordings/`
2. `/var/mobile/Library/CallServices/Recordings/`

두 경로는 조사 대상일 뿐, 통화 중 Apple이 녹음 중인 원본 파일의 위치라는 사실은 아직 실기기로 확인되지 않았습니다.

## 자동 검사

- 기존 iOS 단축어 자동화의 '전화 앱 열릴 때' 트리거는 유지합니다.
- App Intent 타입 이름을 유지하여 기존 자동화의 연결을 최대한 보존했습니다. 동작 명칭은 'HITEL 연결되면 녹음 파일 검사'입니다.
- CallKit 연결을 최대 20초 대기하고, 연결되면 2초 간격으로 5회 검사합니다.
- HITEL 앱이 전면 실행 중일 때 연결을 감지한 경우에는 2초마다 추가 검사를 시도합니다.
- iOS는 다른 앱이 전면인 상황에서 Shortcuts / 앱의 지속적인 백그라운드 실행을 보장하지 않습니다.

## 두 시스템 경로에서 조사하는 내용

- 디렉터리 속성 조회의 성공 여부, NSError 오류 도메인/번호
- 디렉터리 실제 목록 조회 성공 여부, NSError 오류 도메인/번호
- 접근할 수 있는 경우: 하위 파일 이름(최대 256개), 크기, 수정 시각
- 이전 검사 대비 크기 증가량과 증가 파일 수
- `FileHandle(forReadingFrom:)` 읽기 전용 열기, 최대 4KB 판독의 성공·실패
- 파일 데이터는 즉시 버리며 녹음 오디오 자체는 저장·전송하지 않습니다.
- 별도 대조군으로 HITEL 자체 폴더와 Apple Notes 앱 그룹 접근 상태도 기록합니다.

## 결과 해석

`ERROR NSCocoaErrorDomain:257` 등 접근 거부는 파일이 없다는 증명이 아닙니다. 파일 접근·목록 조회가 실패하면 파일 크기 증가 여부를 알 수 없습니다. `OK read_bytes=...`는 해당 파일 읽기에 성공했다는 뜻이며, 그것이 실제 통화 녹음이라는 증거는 아닙니다.

검사 결과는 자체 Documents의 `HITEL-Recording-File-Probe.jsonl`에 JSON Lines로 누적되고 앱에서 공유됩니다. 각 줄의 `systemRecordingDirectories` 배열에 두 시스템 경로의 결과가 따로 담깁니다.

## 설치 및 검증 수준

GitHub Actions로 iPhone arm64용 unsigned IPA를 생성하고, Windows Sideloadly에서 Apple ID 서명 후 iPhone XR / iOS 18.7에 설치합니다. 앱 번들 ID `app.hitel.callconnectprobe`를 유지합니다.

GitHub Actions 빌드 성공과 iPhone에서 녹음 파일을 읽었다는 의미는 전혀 다릅니다. 실제 통화에서 파일이 생성되고 접근되는지는 **기기에서 생성된 JSONL 로그**로만 판단할 수 있습니다.

기존 음성 명령·음성 합성·격자 터치는 포함하지 않습니다. HITEL 운영 iOS 앱, SDK, 서버와 Railway 배포를 변경하지 않습니다.

Apple 참고 자료: https://developer.apple.com/documentation/callkit/cxcallobserver
