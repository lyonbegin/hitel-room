# IXIO 원본 녹음·권한 상태 진단 APK — 실기기 조작 안내 (2026-11-21)

## 목적
원본 IXIO DEX의 모델/STT/녹음/AIDL 동작은 교체하지 않고, 통화 UI가 권한 허용을 받았음에도 `AppStatus.permissionGranted=false`를 표시하는 지점을 추적한다.

## 버튼 동작
- 각 IXIO Activity의 오른쪽 상단 근처에 작은 **로그** 버튼을 표시한다.
- **로그 → 로그 지우기**: HITEL QA 진단 저장 파일 및 회전 파일을 삭제한다. Android 전체 Logcat이나 다른 앱의 저장 파일을 삭제하지 않는다.
- **로그 → 로그 복사**: 앱 자체의 진단 파일을 Android 클립보드에 복사한다. 채팅창에 길게 눌러 붙여넣기 할 수 있다.
- 진단 파일은 앱 내부에 저장하며 최대 약 384 KiB(기본 파일 + 한 개의 회전 파일)를 넘지 않도록 자동 회전한다. 로그에서 계정 토큰, CTN, 통화 음성, 녹음 내용은 수집하지 않는다.

## 실기기 시험 절차
1. 기존 메인 IXIO와 녹음 보조 앱에 중요한 통화 녹음 및 설정이 있으면 **먼저 백업**한다. 이 시험용 APK는 별도 인증서로 서명되어 있으므로 기존 인증서의 패키지와 덮어쓰기 설치가 불가능할 수 있으며, 앱 제거 시 데이터가 삭제될 수 있다.
2. 배포가 검증된 경우에만 동일 릴리스의 **녹음 보조 APK**와 **메인 APK**를 설치한다. 두 APK의 서명은 동일하다.
3. 익시오 실행 후 오른쪽 위 **로그** 버튼을 눌러 **로그 지우기**를 선택한다.
4. 원본 익시오 권한 허용, 통화/녹음 시작 버튼, STT 자막, 녹음 중지 순서로 실제 증상이 발생하도록 조작한다. 통화 상대방의 동의와 관련 법규를 준수한다.
5. **로그 → 로그 복사**를 선택한다. 다른 앱의 Logcat까지 모두 복사되는 것은 아니며, 이번 시험에 필요한 권한/원본 녹음 시작/AIDL 계측 표식만 파일에 남는다.
6. ChatGPT 채팅에 붙여넣기 하고, 가능하면 어떤 버튼을 눌렀을 때 실패했는지도 함께 기록한다.

## 데이터 구조
- `PERMISSION repository#… androidCheck=…`: 실제 Android 권한 검사.
- `PERMISSION repository#… stateFlowWrite=…`: 원본 Repository의 Flow 발행.
- `PERMISSION callViewModel#… flowInitial=…`: 원본 ViewModel이 받은 초기 권한 상태.
- `PERMISSION permissionFlowEmission#… value=…`: Coroutine Flow가 반영한 불리언 값.
- `SCREEN ErrorStateScreen.permissionGranted=…`: 실제 통화 권한 안내를 결정한 상태.
- `IXIO_RECORD_START_TRACE`: 리스너 등록·토큰 호출 단계·AIDL 녹음 시작·콜백의 고정 표식. 토큰이나 전화번호는 남기지 않음.

## 성공 조건
단순 앱 프로세스 실행, 모델 다운로드, 녹음 보조 앱 AIDL 접속은 **통화 PCM 녹음 성공과 다르다**. 성공 여부는 원본 AIDL `startRecording` 후 `onStarted`와 실제 녹음 파일의 생성·PCM 내용, STT 결과를 확인해야 한다.

## 코드
- `tools/ixio/qa_debug/DiagHooks.java`: GUI 진단 버튼과 클립보드 복사.
- `tools/ixio/qa_debug/DiagLog.java`: 내부 저장/로그 지우기/회전.
- `tools/ixio/qa_debug/DiagTrace.java`: 개인정보 없는 상태값 기록.
- `tools/ixio/ixio_qa_log_buttons_patch.py`: 원본 복원 DEX에 진단 연결 적용.
- `.github/workflows/ixio-qa-log-clear-copy-installable-apk-20261121.yml`: 패키징·Android E2E·검증 후 외부 HTTPS 게시.
