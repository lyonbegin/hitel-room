# IXIO runtime DEX 재사용 보관 방식

소스: Google Play 공개 익시오 앱의 사용자 제공 원본
- `com.lguplus.aicallagent` / XAPK 01.33.01
- `com.lguplus.callrecorder` / APK 02.02.00

실험 환경: Android 14 x86_64 Google APIs 에뮬레이터, ARM64 Native Bridge, Magisk, LSPosed, AppPealing, Frida.

분석 순서: 두 APK SHA-256 확인 → 설치 → AppPealing LSPosed 모듈 활성화(두 앱 범위 지정) → 에뮬레이터 재부팅 → 각 앱 실행 → AppPealing `apppeal_dump` 디렉터리 회수 및 Frida PID 부착 검사 → 파일별 SHA-256/DEX 헤더 검증 → `tar.gz`로 묶기 → CMS AES-256 암호화.

결과 보관 위치:
https://github.com/lyonbegin/hitel-room/releases/tag/ixio-runtime-dex-20261115

**검증된 런타임 파일이 실제로 수집된 경우에만 위 Release에 각 패키지의 암호화된 `.cms` 파일과 `-manifest.json` 파일을 게시합니다.** 확인되지 않은 경우 빈 파일이나 성공 표시를 생성하지 않습니다. 실행 진단 자료는 각 GitHub Actions의 `ixio-android14-apppealing-frida-logs` 아티팩트에 남깁니다.

공개 저장소에 평문 보호 해제 DEX를 게시하지 않습니다. `.cms` 파일을 복호화하려면 별도로 보관한 사용자 개인키가 필요합니다.

예: 

```bash
openssl cms -decrypt -binary -inform DER \
  -in com.lguplus.aicallagent.cms \
  -recip tools/ixio/dump-public-20261115.crt \
  -inkey ixio_dump_private_20261115.pem \
  -out ixio-aicallagent-memory.tar.gz
mkdir ixio-aicallagent-memory
tar -xzf ixio-aicallagent-memory.tar.gz -C ixio-aicallagent-memory
```

### 주의
- 앱 설치 성공과 메모리에서 보호 해제된 DEX 파일 확보는 서로 다른 검증 항목입니다.
- 에뮬레이터에서 앱이 보호 로직으로 바로 종료되면 복원된 DEX가 없을 수 있습니다.
- `dump-manifest.json`의 `valid_dex_or_cdex_count`가 0이면 복원된 DEX 원본 확보로 판단할 수 없습니다.
- 프라이빗 키를 GitHub에 업로드하지 마십시오.
