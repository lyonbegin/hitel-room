# Communication SDK — Android 외부 APK 설치 운영

## 실제 구조
```
웹 /sdk-lab → /lab-api/apk/upload (운영자 인증, 바이너리)
                  ↓ /data/apk-manager/files/*.apk (Railway 영속 볼륨)
웹 /sdk-lab → /lab-api/apk/jobs (설치 대상 등록)
                  ↓ /data/apk-manager/jobs/*.json (대기열)
에뮬레이터 호스트 --HTTPS polling--> /lab-api/apk/agent/next
                  ↓ APK 다운로드 / SHA-256 재검증
           adb install -r <downloaded.apk>
                  ↓ adb shell pm path <package>
           /lab-api/apk/agent/report
                  ↓
웹 /sdk-lab → 설치 성공/실패 표시
```

## 사용자 운영
1. Railway 서비스 `hitel-device-relay` > **Variables** 에서 `LAB_APK_ADMIN_TOKEN` 값을 관리자가 확인한다. 이 값은 GitHub 코드에 저장하지 않는다.
2. [Communication SDK 에뮬레이터](https://hitel-communication-web-production.up.railway.app/sdk-lab) 아래 **외부 앱 설치 · 에뮬레이터 관리** 영역에서 토큰을 입력한다.
3. `.apk` 파일을 업로드하면 80MB 제한과 ZIP 헤더 확인 후 보관하며 SHA-256 해시를 제공한다. 실제 APK 패키지/서명 호환성은 설치 호스트의 Android SDK와 패키지 매니저가 검사한다.
4. `android-lab-01`(지속형) 또는 `ci-android`(일회용) 대상 선택 → **실제 설치 요청**. 호스트가 오프라인이면 작업은 대기열에 보존된다.
5. 온라인 에뮬레이터 에이전트가 파일을 받고 `adb install -r`, `pm path`로 설치 성공을 검증하고 결과를 회신한다.

## 상시 가동 Android 에뮬레이터 호스트 (Railway와 분리)
Railway 컨테이너는 ADB로 다른 머신의 에뮬레이터를 마음대로 실행하지 않는다. KVM 사용 가능한 사용자의 전용 Linux/Windows 개발 머신 또는 별도 VM을 준비해야 한다.

### KVM Linux 예시
```bash
# 이미 Android SDK commandline-tools와 Java가 구성돼 있다고 가정
sdkmanager --install "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis_playstore;x86_64"
echo no | avdmanager create avd -n hitel-play -k "system-images;android-35;google_apis_playstore;x86_64"
emulator -avd hitel-play -no-snapshot-load -gpu swiftshader_indirect &
adb wait-for-device
adb devices
# 반드시 개인/조직 비밀관리시스템에서 설정: git에 키를 올리지 않는다.
export LAB_APK_AGENT_TOKEN='여기에 Railway LAB_APK_AGENT_TOKEN 값'
export LAB_RELAY_URL='https://hitel-device-relay-production.up.railway.app'
python3 mobile/tools/apk-emulator-agent.py --device android-lab-01 --serial emulator-5554
```
Play Store가 포함된 이미지에서는 사용자가 Play Store에 로그인한 후 카카오T 공식 패키지 `com.kakao.taxi`를 설치할 수 있다. Google Play 로그인은 사용자가 직접 수행한다.

### Windows 지속형 호스트 자동 실행
현재 프로젝트에는 Windows Android 호스트 부트스트랩 파일을 포함한다.

- `mobile/tools/start-persistent-windows.ps1`: Android Studio SDK의 Google Play 이미지 설치·AVD 생성·가상 기기 실행·Railway 에이전트 자동 재연결
- 인증키: 사용자 계정의 Windows DPAPI로 암호화해 `%LOCALAPPDATA%\\HitelCommunication` 아래 저장
- `-InstallAutostart` 옵션: 현재 Windows 계정의 **시작프로그램**에 등록해 재로그인 후 자동 시작
- Google Play 로그인은 기기 사용자가 직접 처리하며 인증 비밀번호를 웹 APK 관리 서버로 보내지 않는다.

Android Studio의 **SDK Command-line Tools**와 Python 3가 준비된 Windows 개발 PC에서 **처음 한 번만** 다음 명령을 실행한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\mobile\tools\start-persistent-windows.ps1 -Configure -InstallAutostart
```

실행 시 Railway `hitel-device-relay` 서비스의 `LAB_APK_AGENT_TOKEN`을 보안 입력으로 받는다. 지속형 호스트는 `android-lab-01` 장치로 연결되며, 앱 설치 및 Google Play 로그인 상태를 AVD 사용자 데이터에 보존한다.

전제: 해당 Windows 머신이 켜져 있고 사용자 로그인이 유지되어야 지속 실행된다. ChatGPT 작업 컨테이너나 Railway 웹 서버에는 해당 머신의 Android 가상화/ADB 실행 권한이 제공되지 않으므로, **실제 외부 호스트가 한번은 연결되어야** 한다.

Windows 이미지용 [실행 파일](../mobile/tools/start-persistent-windows.ps1) 및 [Windows 사전검증 워크플로](../.github/workflows/windows-host-preflight.yml) 참고.

## GitHub Actions 임시 에뮬레이터
사용자는 웹에서 `ci-android`에 설치 작업을 등록할 수 있다. 이후
[HITEL Mobile Emulator E2E](https://github.com/lyonbegin/hitel-room/actions/workflows/mobile-emulator.yml)
워크플로를 수동 실행하면, GitHub Actions OIDC 인증으로 설치 대기열을 소비한다.
일회용 에뮬레이터이므로 워크플로가 끝나면 설치 앱과 계정은 사라진다.
워크플로에서 빌드한 HITEL 테스트 APK를 업로드하고 설치하는 자동 E2E 테스트도 포함되어 있다.

## 구분해야 하는 현재 범위
- APK 업로드 / 설치 작업 / ADB 호스트 에이전트 / 설치 결과: 구현.
- 웹에서 설치 작업 등록 즉시 처리: `android-lab-01` 등 **실행 중인 호스트가 연결되었을 때** 가능.
- 카카오T가 로그인·인증·가상 기기 지원 문제 없이 정상 실행하는지는 별도 실제 테스트.
- Play Store 앱 설치는 사용자의 로그인과 승인 후 가능. 웹 관리자가 Google 계정 로그인을 우회할 수 없다.
- 네이티브 앱의 `AccessibilityService` 는 사용자가 승인한 앱 접근성 동작을 처리한다. 실제 결제나 차량 호출은 승인 없이 실행하지 않는다.
- 타사 앱 화면을 웹에서 연속 스트리밍하고 웹 탭 좌표를 ADB에 전달하는 기능은 후속 개발 대상. 이전의 HITEL `PixelCopy`는 타사 앱 전체 화면을 캡처하지 않는다.

## 보안
- 관리자용 `LAB_APK_ADMIN_TOKEN` 과 호스트용 `LAB_APK_AGENT_TOKEN` 은 서로 독립된 비밀.
- GitHub Actions는 저장된 호스트 비밀이 아닌 GitHub OIDC JWT로 **CI 에뮬레이터만** 제어.
- API는 임의 쉘 실행 요청을 받아들이지 않는다. ADB 설치 명령은 고정된 인수 형식만 사용.
- 호스트는 업로드 해시와 다운로드한 APK의 SHA-256을 비교한다.
- 신뢰된 공급처의 APK만 업로드한다. 타사 앱을 설치하면 에뮬레이터 안에서 해당 코드가 실행된다.

## 외부 앱 실화면 및 원격 조작
- 지속형 호스트 에이전트는 `adb exec-out screencap -p`로 **Android OS 전체 화면**을 획득해 관리자 인증이 필요한 `/lab-api/apk/agent/frame` API에 보낸다.
- 웹 관리 화면에서 실제 전체화면 스냅샷을 확인하고, 화면 클릭 좌표를 `/lab-api/apk/control`로 전송한다. 연결된 호스트가 `adb shell input tap` 명령을 수행한다.
- 홈/뒤로가기/상하 스크롤도 고정된 ADB 인수로 처리한다. 호스트 오프라인에서 지연 조작하는 위험을 막기 위해 조작 요청은 즉시 거절된다.
- 관리자 토큰 없이 외부 앱 화면을 가져올 수 없다. 로그인과 개인 정보가 표시될 수 있어 개발 전용 에뮬레이터 사용을 권장한다.
- CI는 1회 실행 후 종료되므로 마지막 화면 캡처만 보관하며, 지속형 호스트는 수초 간격으로 화면을 갱신한다.

## 카카오T Google Play 설치 방법
1. KVM 지원 호스트에서 `google_apis_playstore` 시스템 이미지의 에뮬레이터를 시작하고, 사용자가 해당 기기에서 Google Play 로그인을 완료한다.
2. SDK 관리 화면에서 `android-lab-01`을 선택한다.
3. **Google Play 카카오T 설치** 섹션에서 `com.kakao.taxi` 패키지의 '에뮬레이터 Play Store에서 열기'를 누른다.
4. 에뮬레이터의 실제 화면이 웹에 표시되면 사용자가 Install 버튼을 눌러 설치를 승인한다. 스토어 페이지 열림만으로 설치됐다고 기록하지 않는다.
5. '실제 설치 여부 확인' 버튼은 Android PackageManager `pm path com.kakao.taxi` 명령으로 설치 성공을 검사한다.


## 2026-10-24 실제 Google Play 실기 검증
GitHub Actions의 별도 `google_apis_playstore` Android 35 이미지에서 **Google Play 앱의 실제 패키지 존재**, 공식 `market://details?id=com.kakao.taxi` 페이지 호출, 화면 캡처까지 검증했다. [실기 실행](https://github.com/lyonbegin/hitel-room/actions/runs/40070509148)의 결과는 SUCCESS다. 깨끗한 CI 에뮬레이터에서는 `com.kakao.taxi` 미설치가 정상적으로 보고되었으며, Google 로그인·실제 설치·카카오 계정 인증이 끝났다는 뜻은 아니다.
