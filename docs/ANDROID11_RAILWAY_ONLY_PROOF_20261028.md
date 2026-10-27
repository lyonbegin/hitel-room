# Railway Sandbox 전용 Android 11 재검증 — 실제 결과

검증일: 2026-10-28 KST
프로젝트: HITEL / Communication SDK

## 1. Docker Android Emulator (Google SDK, x86_64)
- 최초 설치, Sandbox 생성·삭제: 성공
- 별도의 새 Sandbox에 Android 11 설치 체크포인트 복원 성공
- 체크포인트 이름: `hitel-android11-tcg-installed`
- Android Emulator 기동: `-accel off` (KVM 없는 TCG 모드)
- 500초까지 콜드 부팅 추가검증: `sys.boot_completed=1` 확인되지 않음
- 결과: `android11-tcg-boot-failed-or-timeout`
- 설치 VM ID: `c20d06cf-e4f7-4933-9059-f1a3b65b8879`
- 부팅 VM ID: `f32edd47-49be-4e72-9189-d5c719f107c3`
- 설치·부팅 테스트 VM 모두 `Sandbox.destroy()` 성공
- 설치된 체크포인트는 디스크 캐시이며 부팅된 Android가 아님

## 2. Android 11 ReDroid (Android userspace in Docker, KVM 불필요)
- GitHub 준비 코드: `feature/railway-android11-snapshot-followup-20261028`
- 실제 Railway Sandbox 생성 성공: `bf1c5d4a-81cc-4a96-b5b7-d633436ad391`
- 호스트 커널: Linux `6.18.46-railway` (x86_64)
- `/dev/binder` 장치 없음
- `binder_linux` 커널 모듈 없음: `Module binder_linux not found`
- `binderfs` 마운트 실패: `unknown filesystem type 'binder'`
- 결과: `REDROID_KERNEL_MISSING_BINDER_DRIVER`, 종료 코드 34
- 실제 시험용 Sandbox destroy() 성공
- 따라서 Android 11 ReDroid 컨테이너는 Railway의 현재 샌드박스 커널에서 실행되지 않음

## 3. 중요한 검증 범위
- `Sandbox.create`, `checkpoint`, `destroy`는 실제 작동함
- Google SDK 설치는 실제 성공했으나 운영체제 부팅 및 터치 가능 화면은 성공하지 않음
- ReDroid용 커널 Binder 지원 역시 현재 Railway Sandbox에 없음
- GitHub Actions KVM 호스트에서 과거 Android 11 실행 성공한 기록은 존재하나 Railway Sandbox 성공 증거로 보지 않음
- 운영 웹 UI는 Railway Sandbox 전용 상태를 유지하며 실행 불가 상황에서 버튼을 비활성으로 유지

## 4. 검증에 따라 필요한 실행환경
- Google Android Emulator: KVM 가속 노출 및 실제 Android 11 부팅 성공
- ReDroid: `binder_linux` 또는 `binderfs`를 제공하는 Linux 커널
- KVM 또는 Binder 커널 기능 중 하나를 제공하는 인프라 없이는 현재 제공된 Railway Sandbox에서 실용적 Android 11 원본 화면을 실행할 수 없음
- Railway 측 VM 커널/장치 지원 설정에 대한 제공 여부 확인 필요

## 5. 과금 및 정리
- 두 시험 방법 모두 VM 삭제 성공
- 별도 Android/Relay 상시 과금 서비스 신설 없음
- 설치된 체크포인트는 별도 스토리지 객체이므로 사용자 요청 시 삭제 가능
- 일회용 시험 환경 변수는 빈 값으로 복원
- 운영 소스 브랜치는 기존 `feature/railway-android-sandbox-10min-20261025`로 복원
