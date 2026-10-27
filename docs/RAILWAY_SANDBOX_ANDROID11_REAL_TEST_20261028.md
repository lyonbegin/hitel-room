# Railway Sandbox Android 11 실제 VM 검사 결과 — 2026-10-28

## 운영 원칙
- Android 테스트용 VM은 Railway Sandbox에서 요청 시 생성하고 종료 후 삭제
- GitHub Actions는 실제 사용자용 Android VM 실행에 사용하지 않음
- Android 실행 완료를 가정한 프런트엔드 상태 조작 금지
- 체크포인트가 실제로 준비되고 Android 부팅까지 확인된 경우에만 실행 버튼 활성화

## 실제 검사 기록
- Railway: 프로젝트 HITEL-ROOM / production / hitel-communication-web
- 검사 기동: 2026-10-27 22:30:39 UTC
- 실제 Sandbox ID: badedae4-f856-460b-b683-5aceb7e7dff1
- 실제 VM 생성 성공: 2026-10-27 22:30:47 UTC
- Android 11 명령줄 도구·SDK·에뮬레이터·API30 x86_64 이미지·AVD 설치 성공: 2026-10-27 22:33:45 UTC
- 실제 Android Emulator 실행 인자: `-accel off -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 1536 -cores 2`
- 환경 변수: `ANDROID_I_WANT_MY_TCG=yes`
- Android 부팅 검사 결과: 타임아웃, exitCode=-1, timedOut=true, `sys.boot_completed=1` 미확인
- 시간: 2026-10-27 22:36:55 UTC
- Sandbox.destroy(): 성공, 2026-10-27 22:36:56 UTC
- 최종 결과: `android11-not-booted`
- checkpoint: 생성되지 않음
- 실시간 noVNC 화면: 생성되지 않음

## 로그 검증 요약
```text
HITEL_RAILWAY_TCG_PROBE railway-sandbox-real-created
ANDROID_INSTALL_APT_START
ANDROID_INSTALL_CLI_START
ANDROID_INSTALL_SDK_START
ANDROID_INSTALL_AVD_START
ANDROID_INSTALL_DONE
HITEL_RAILWAY_TCG_PROBE android11-booting-without-kvm
ANDROID_TCG_TEST_START
ANDROID_TCG_STILL_BOOTING_20
ANDROID_TCG_STILL_BOOTING_40
ANDROID_TCG_STILL_BOOTING_60
ANDROID_TCG_STILL_BOOTING_80
ANDROID_TCG_STILL_BOOTING_100
ANDROID_TCG_STILL_BOOTING_120
ANDROID_TCG_STILL_BOOTING_140
HITEL_RAILWAY_TCG_PROBE android11-boot-result timedOut=true exitCode=-1
HITEL_RAILWAY_TCG_PROBE railway-sandbox-destroyed
HITEL_RAILWAY_TCG_PROBE final result=android11-not-booted
```

## 구분
- **검증 성공:** 실제 Railway Sandbox 생성, Google Android 11 시스템 이미지 설치, VM 삭제
- **검증 실패:** 시험시간 내 Android 11 시스템 부팅, VNC 실제 화면 표시
- **미검증:** 더 긴 부팅 제한에서의 TCG 부팅 완료, 10분 안에 실용적 터치·APK 설치, 네이티브 음성 기능
- **최종 결론:** 현재 설정을 사용하여 Railway Sandbox 기반 Android 11을 실제 사용 가능한 상태로 제공했다고 주장할 수 없음.

Google 공식 문서: https://developer.android.com/studio/run/emulator-commandline
Railway Sandboxes: https://docs.railway.com/sandboxes
