# Android 11: 이전 실기 성공 방식 및 Railway Sandbox 단독 실행 검증 경로

## 1. 이전 실기 실행의 실체
- 2026-10-24 GitHub Actions run #40093555145 성공.
- 당시 실제 Android 11 및 scrcpy/noVNC는 GitHub Actions Ubuntu KVM 호스트의 Docker Compose에서 동작.
- Railway HITEL 웹은 프런트엔드/일시적인 Relay 역할.
- 임시 Cloudflare 터널이 브라우저와 해당 GitHub 호스트를 연결.
- 브라우저는 noVNC 실제 화면 프레임 95개를 수신.
- 근거: https://github.com/lyonbegin/hitel-room/actions/runs/40093555145
- 기존 워크플로: .github/workflows/android-original-native-live.yml (feature/communication-sdk)
- Compose 오버라이드: infra/android-original/github-4cpu.compose.yml (feature/communication-sdk)

## 2. 현 Railway 구성 실측
- Web: hitel-communication-web, production, Railway Runtime V2
- Build environment V3 표시는 빌드 환경만 뜻하며 실제 서비스 Runtime V3를 뜻하지 않음
- 해당 계정 Beta Feature 목록에는 Runtime V3 직접 활성화 항목 없음
- Railway Sandbox KVM 시험에서 /dev/kvm 미노출
- 2026-10-28 일회성 Railway Sandbox에서 Android SDK·Android 11(API30) 이미지·AVD 설치 성공
- -accel off 및 ANDROID_I_WANT_MY_TCG=yes 부팅 검사 190초 제한 시간 내 sys.boot_completed=1 미달
- 시험 VM 실제 destroy() 성공
- 검사 결과: docs/RAILWAY_SANDBOX_ANDROID11_REAL_TEST_20261028.md

## 3. Railway 단독 실행 검증에서 우선할 기술적 방법
**이전 실기 성공과 같은 성능이 검증된 방법은 아님. 실제 부팅/화면/터치/10분 제한을 통과할 때까지 사용자 실행용으로 활성화하지 않을 것.**

1. 장기 설치/준비 작업을 별도의 일회용 Sandbox에서 수행한다.
2. 실제 Android 11 SDK와 AVD 설치 완료 후 `Sandbox.checkpoint('hitel-android11-tcg-installed')`로 디스크만 보존하고 준비 VM은 destroy().
3. 테스트 VM은 `Sandbox.create('hitel-android11-tcg-installed')`로 복원한다. 준비 비용과 시간 반복을 없애는 목적.
4. 기존 `sandbox-control/tcg-boot.sh`의 `-no-snapshot`은 Quick Boot를 명시적으로 막으므로, 별도의 부팅 검증 시에는 제거한다.
5. Android의 `sys.boot_completed=1` 확인 후 에뮬레이터 자체 Quick Boot 스냅샷을 디스크에 보존한다.
6. 완전 부팅된 Quick Boot 파일을 포함한 디스크 체크포인트로 새 Sandbox 시작·Android 재개 소요시간을 측정한다.
7. 실제 Android 화면에서 scrcpy/noVNC 출력과 터치·APK 설치를 각각 검증한다.
8. 매 세션 600초 deadline은 서버 및 Sandbox 내부에서 강제하고, 종료 시 실제 Sandbox.destroy() 결과를 검증한다.

주의: Railway Sandbox의 체크포인트는 **VM 디스크만** 복원하며 실행 중 메모리를 저장하지 않는다. Android Quick Boot 파일 자체가 저장·복원 가능한지와 성능은 별도 검증해야 한다.

## 4. 명확한 경계
- Runtime V2 서비스에 Build Environment V3를 쓰는 것만으로 중첩 KVM이 생기는 것은 아님.
- GitHub Actions 실기 성공을 Railway Sandbox VM 성공이라고 보고하지 말 것.
- Railway 단독 TCG 부팅이 검증되지 않으면 Android 실행 가능 상태를 표시하지 말 것.
- 사용자가 요구한 운영 방식은 Railway Sandbox 온디맨드 10분 사용 후 삭제, 상시 Relay 미운영.

References:
- https://docs.railway.com/sandboxes
- https://developer.android.com/studio/run/emulator-commandline
- https://station.railway.com/questions/enable-nested-virtualization-support-in-de9f4c0f
