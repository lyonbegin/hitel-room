# HITEL IXIO 공개 접속 구성 (GitHub Pages + G2)

**중요:** GitHub Pages는 정적 파일만 제공하므로 FastAPI/실시간 STT/API 리버스 프록시를 호스팅하지 않습니다.

- **Pages**: 실기기 접속·API 상태 점검 웹 페이지 및 공개 진입 화면 (토큰·전화번호 저장 금지)
- **G2**: 계속 실행되는 FastAPI + 영속적 DB, TLS 종단(공개 HTTPS 프록시), 인증 및 추후 STT 처리
- **익시오 Android APK**: Pages 주소가 아니라 **공개 G2 HTTPS API 기본 주소**로 직접 요청
- **GitHub Actions**: FastAPI 테스트, APK 수정·빌드·에뮬레이터 검증, Pages 정적 아티팩트 제작·배포
- `10.0.2.2:8000`: Android 에뮬레이터 → 호스트 테스트 주소. 실기기에서 사용 불가.
- `localhost:8000`: Actions 러너/서버 내부 주소. 인터넷 외부에서 사용 불가.

## 연결 순서

1. G2에서 `services/hitel-api` 의 FastAPI 앱을 상시 실행합니다. 바인드 주소가 `0.0.0.0:8000`이어도 방화벽/HTTPS 프록시 없이는 공개 주소가 아닙니다.
2. G2에 HTTPS 진입점(역방향 프록시 및 유효한 TLS 인증서)을 마련합니다. 외부에서 `https://<G2_API_HOST>/health` 응답이 실제로 확인되어야 합니다. HTTPS API 호스트명은 임의로 생성하지 않습니다.
3. 배포 서버에 `HITEL_JWT_SECRET` (충분히 긴 별도 비밀값), `HITEL_DATABASE_URL` (영속 DB), `HITEL_CORS_ORIGINS` (실제로 운영되는 Pages 오리진), `HITEL_IXIO_COMPAT_ENABLED=true`, `HITEL_IXIO_CI_FIXTURE_ENABLED=false`를 설정합니다. SMS 인증 프로바이더도 실제 운영 시 필요합니다. CI 가상 계정/증명은 절대로 공개 서버에 사용하지 마십시오.
4. GitHub 저장소 `lyonbegin/hitel-room` > Settings > Secrets and variables > Actions > Variables 에 `HITEL_PUBLIC_API_BASE_URL` = 검증된 `https://<G2_API_HOST>/`를 등록합니다. API 토큰이 아닌 **공개 URL**만 기록합니다.
5. Pages가 기존 사이트를 덮어쓰지 않도록 별도 승인을 위해 `HITEL_IXIO_ENABLE_PAGES_DEPLOY=true` 변수를 사용합니다. `IXIO Public API GitHub Pages Connection` 워크플로의 수동 실행 또는 허용된 push가 배포를 수행합니다. GitHub Pages 배포 소스는 GitHub Actions여야 하며, 기존 Pages 사이트가 있을 경우 영향 검토가 필요합니다.
6. Pages `/health` 검증이 성공하면 Android APK를 `HITEL_PUBLIC_API_BASE_URL`을 사용하도록 **새로 빌드**하여 실기기에서 테스트합니다. 단, 현재 APK는 테스트용 CTN 문자열을 하드코딩하고 있으므로 그대로 실기기에 배포하지 마십시오. 실기기 배포본은 정상적인 HITEL 인증·PKCE·토큰 교환 방식을 사용해야 합니다.

## 현재 상태

G2의 실제 배포 HTTPS 호스트는 확인되지 않아 `config.json`에는 빈 문자열만 둡니다. URL이 입력·검증되지 않은 상태를 연결 완료라고 표시하지 않습니다.

이 페이지는 공개 API를 '중계'하지 않습니다. 웹 브라우저의 `fetch`는 G2 서버를 직접 호출하며, HITEL 서버 측에서 정확한 Pages Origin의 CORS 허용이 필요합니다. 모바일 네이티브 API 연결에는 Pages CORS가 필요하지 않지만 공개 HTTPS API는 반드시 필요합니다.
