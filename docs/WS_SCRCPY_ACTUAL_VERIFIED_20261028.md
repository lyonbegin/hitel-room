# HITEL Communication SDK — ws-scrcpy 실기 검증 보고서 (2026-10-28)

## 구현
- GitHub: `lyonbegin/hitel-room`, 브랜치 `feature/ws-scrcpy-android11-20261028`
- 원본: `NetrisTV/ws-scrcpy` MIT, commit `cd6cea6ebde17af6685c2b325183fc24bef9d52b`
- Android: API 30, x86_64, GitHub-hosted KVM. 운영 세션은 Google Play 포함 AVD.
- H.264 전송: 수정된 scrcpy Android server -> WebSocket/ADB -> ws-scrcpy Node -> 임시 HTTPS 터널 -> 브라우저 WebCodecs. **VNC/noVNC, Xvfb, x11vnc, websockify 없음. WebRTC도 아님.**
- Railway: 기존 `hitel-communication-web` 컨테이너가 세션 메타데이터 및 제어 API 담당. 상시 Android VM 및 별도 영상 Relay 사용하지 않음.
- 사용 화면: `https://hitel-communication-web-production.up.railway.app/android-original/`.
- 브랜치의 `OriginalAndroidManager` 및 `WsScrcpyEmbed`가 실제 H264 화면 전용으로 변경됨.

## 실기 검증 증거 — Chrome WebCodecs
- Run: https://github.com/lyonbegin/hitel-room/actions/runs/40644853438
- 최종 작업 결과: SUCCESS
- `/dev/kvm` 확인: 성공
- Android 11 `sys.boot_completed=1`: 성공
- ADB `emulator-5554`, ws-scrcpy 서버 PID 확인: 성공
- Google Chrome에서 H.264 WebCodecs 디코딩 가능: 참
- 실제 Android canvas 화면: 512×1088 픽셀, 색상 50종, 유효 픽셀 PASS
- 브라우저 터치 입력 WebSocket 송신: 12프레임
- 첫 실영상: 페이지 이동 후 약 1.803초
- 네이티브 화면·입력 실증 로그: `WS_SCRCPY_REAL_ANDROID11_NO_VNC_ALL_PASS`
- runner 정상 종료: SUCCESS. 앞선 취소됐던 테스트에서 발견된 서버 SIGTERM 정리 문제를 수정함.

## 외부 웹/Railway 실증
- Run: https://github.com/lyonbegin/hitel-room/actions/runs/40645457914
- 최종 결과: SUCCESS
- 최초 빌드 캐시: `WS_SCRCPY_CACHED_UPSTREAM_BUILD_REUSED`
- Google Play Android 11 원본 AVD 이미지 생성 성공, 캐시 키 `hitel-ws-scrcpy-avd-android30-google-play-pixel4-v1`
- 새 VM에서 Android 기본 Quick Boot 스냅샷 로딩: 1846ms
- 실제 ADB와 ws-scrcpy PID 확인: 성공
- Cloudflare 임시 공개 HTTPS health 검증: `HITEL_WS_SCRCPY_PUBLIC_HOST_REAL_H264_READY`
- GitHub OIDC 검증 후 Railway 등록: `HITEL_WS_SCRCPY_REGISTER_SUCCESS`
- Railway API `/lab-sandbox/ws-scrcpy/status`: 등록 동안 `online:true,vnc:false`
- 외부 웹 브라우저 원본 `ws-scrcpy` 화면에서 `emulator-5554 (WebCodecs)` 및 조작 메뉴 표시 확인
- 검증용 수명: 90초. 종료 시 Railway `/finish` HTTP 200, 상태 `online:false`.
- 주의: 90초 시험은 운영 기본 600초 TTL에 대한 전체 지속시험은 아님.

## 실행 및 인증
- GitHub KVM 실제 장치 구동은 `.github/workflows/hitel-ws-scrcpy-live.yml` (workflow_dispatch).
- Railway `POST /lab-sandbox/ws-scrcpy/register`는 Github Actions OIDC 발급자를 검증한다.
- Railway `POST /lab-sandbox/ws-scrcpy/start`는 서버 내부 `HITEL_GITHUB_WORKFLOW_TOKEN`으로 dispatch 할 수 있도록 구현했으나 **현재 실제 Railway 환경에 해당 서버 자격증명이 설정돼 있지 않음**.
- 따라서 사이트의 'Android 실행' 버튼은 현 시점에서 비활성화되어 있으며, 웹 버튼 클릭으로 GitHub VM이 즉시 켜지는 기능을 완료로 판정하면 안 됨. 사용자에게 매번 토큰을 입력받는 설계는 사용하지 않음.
- 웹 `Android 종료` 버튼은 Railway API를 거쳐 실행 중 Github runner에 stop 요청. 만료/종료 시 임시 URL 제거.

## 남은 검증 범위
- 외부 인터넷 사용자의 실제 터치 왕복 지연(ms) 비교 (기존 VNC와 동일 조건 측정 필요).
- 서버측 workflow dispatch 자격증명 연결 후 웹 실행 버튼 E2E.
- 실제 Google Play 로그인 및 제3자 앱 설치, 터치/키보드 조작 반복 검증.
- 600초 만료 자동 종료 및 비용 확인.

기술적으로 검증된 것과 아직 검증되지 않은 것 구분이 필요하다.

## 추가 신뢰성/재실행 검증
- 2차 캐시된 Quick Boot 실험: https://github.com/lyonbegin/hitel-room/actions/runs/40646076801 — **FAILED**. GitHub 새 호스트에서 GPU 컨텍스트 복원 실패. 스냅샷 디스크 자체는 복원됐지만 ADB 사용 불가.
- 따라서 운영 기본값은 `-no-snapshot`으로 변경. 설치된 **깨끗한 AVD 디스크와 빌드된 ws-scrcpy**는 계속 캐시하지만, GPU Quick Boot 메모리/그래픽 상태는 재사용하지 않음.
- 3차 실기: https://github.com/lyonbegin/hitel-room/actions/runs/40646399692 — **SUCCESS**.
- 빌드 캐시 및 AVD 캐시 두 개 모두 cache hit: 06:51:26~06:51:48 UTC.
- Android 11 실제 부팅 완료: 06:53:01 UTC.
- Google Play AVD에서 scrcpy PID 확인: 06:53:11 UTC.
- 외부 HTTPS 호스트 공개 및 Railway OIDC 서명등록: 06:53:23~06:53:24 UTC.
- GitHub 작업 생성(06:51:19 UTC)부터 외부 호스트 등록까지 **약 125초**. 첫 체크포인트 준비를 포함한 성공한 1차 실험(06:42:10→06:44:50, 약 160초)보다 약 35초 단축.
- TinyFish 외부 웹 확인: `https://exclusive-suffered-seeds-schedule.trycloudflare.com/`에서 `emulator-5554 (WebCodecs)` 및 제어 메뉴 표시; 임시 URL은 종료 후 더 이상 보증하지 않음.
- 60초 제한 검증 세션 성공 종료: 06:54:28 UTC, `/finish` HTTP 200, Railway API `online:false` 확인.
- GitHub workflow는 시험용 push trigger 제거, `workflow_dispatch` 단독. 온디맨드 600초 제한으로 복구됨.
- **제한:** `HITEL_GITHUB_WORKFLOW_TOKEN`이 Railway에 없으므로 실제 웹 버튼에서 즉시 GitHub Actions를 dispatch하지는 못함. 이 단계가 완료되기 전에는 UI '실행' 버튼을 비활성화한 상태가 사실에 부합함. 브라우저/사용자에게 토큰을 입력시키는 구조는 설계하지 않음.
