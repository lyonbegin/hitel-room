# HITEL IXIO — G2 독립 HTTPS API 배포

## 역할 및 현재 상태

- 실제 API 실행: 사용자 G2 Linux 서버 — FastAPI 컨테이너, SQLite 영속 볼륨, Caddy 자동 HTTPS.
- 코드 빌드·배포·외부 TLS 검증: GitHub Actions (Railway 미사용).
- 공개 접속 화면: https://lyonbegin.github.io/hitel-room/ixio-public-api/ (GitHub Pages, 정적 사이트).
- Android IXIO는 최종적으로 GitHub Pages가 아닌 `https://<HITEL_G2_API_DOMAIN>/` API로 직접 연결해야 합니다.
- 현재 CI의 `10.0.2.2:8000`은 GitHub Actions 에뮬레이터 내부 주소이며 실기기용 APK가 아닙니다.
- `HITEL_IXIO_CI_FIXTURE_ENABLED=false`로 고정해 CI 시험 가입/OTP 우회를 공개 서버에 배포하지 않습니다. 실제 가입·인증·STT는 별도 연동 검증이 필요합니다.

## 한 번만 제공해야 하는 G2 연결 설정

저장소 [Actions secrets](https://github.com/lyonbegin/hitel-room/settings/secrets/actions) 안에 다음 비밀값을 **직접 등록**하십시오. 키, 암호, 세션 토큰을 대화창에 보내지 마십시오.

| 구분 | 이름 | 내용 |
| --- | --- | --- |
| Secret | `HITEL_G2_SSH_HOST` | G2 접속 가능한 IPv4 또는 DNS 호스트명 (포트 22) |
| Secret | `HITEL_G2_SSH_PRIVATE_KEY` | G2에 로그인되는 전용 SSH private key (GitHub Secrets에만 보관) |
| Secret | `HITEL_G2_SSH_KNOWN_HOSTS` | G2 서버의 **검증된** SSH 호스트 공개키 known_hosts 줄 |

[Repository variables](https://github.com/lyonbegin/hitel-room/settings/variables/actions):

| 구분 | 이름 | 내용 |
| --- | --- | --- |
| Variable | `HITEL_G2_API_DOMAIN` | HTTPS에 쓸 DNS 호스트명, 예: `api.example.com` (스킴/포트/경로 불가) |
| Variable, 선택 | `HITEL_G2_SSH_USER` | SSH 계정. 미입력 시 `ubuntu` |

도메인이 따로 없으면 공인 IPv4에 매핑되는 무료 nip.io DNS 호스트를 사용할 수 있습니다. 예를 들어 공인 IP `203.0.113.10`이라면 형식 예시는 `203-0-113-10.nip.io` 입니다. 이 IP는 문서 예시이며 실제 서버 주소가 아닙니다. DNS가 G2를 가리켜야 하고 G2는 **공인 80/443 포트가 열려 있어야** TLS 발급이 됩니다. nip.io는 외부 DNS 서비스이므로 의존성 및 인증서 발급 제한이 있습니다.

G2 서버에는 Ubuntu/Debian 계열 Linux, `git`, `openssl`, Docker Engine/Compose plugin이 설치되어 있어야 합니다. SSH 계정은 Docker 실행 권한이 있어야 합니다. G2 서버의 `~/.ssh/authorized_keys`에 해당 배포 공개키가 설치되어야 합니다. **Actions 테스트에서만 쓰던 가상 가입자 정보·랜덤 JWT는 실제 이용자의 인증 정보가 아닙니다.**

## 실행 및 검증

1. 저장소에서 [배포 워크플로](https://github.com/lyonbegin/hitel-room/actions/workflows/ixio-g2-https-deploy.yml)를 엽니다.
2. 브랜치 `experiment/ixio-hitel-backend-android-20261116`를 선택하고 실행하십시오. 브랜치의 push 변경도 자동 검증합니다.
3. Preflight가 연결 정보의 존재를 확인합니다. API 유닛 테스트, Docker Compose 검사, Docker 이미지 실행 `/health` 검증이 진행됩니다.
4. G2는 `$HOME/hitel-ixio-g2/repository` 아래에 소스를 가져오고 `$HOME/hitel-ixio-g2/hitel.env`에 **처음 한 번만** 서명키를 자동 생성하여 보존합니다. 코드는 커밋 SHA에 고정합니다.
5. Caddy의 HTTPS 인증서는 G2에서 발급·갱신합니다. GitHub 호스팅 러너가 외부에서 `https://<HITEL_G2_API_DOMAIN>/health`를 호출하고 HTTP 성공을 확인해야 완료로 판단합니다.
6. GitHub Pages [기존 배포 워크플로](https://github.com/lyonbegin/hitel-room/actions/workflows/hitel-education-pages.yml)는 페이지의 `ixio-public-api/config.json`을 `HITEL_G2_API_DOMAIN` 변수에서 구성하도록 추가하였습니다. 공개 사이트의 기존 학습 화면은 유지됩니다.
7. 최종 APK는 G2 검증 완료 후 **별도** HTTPS API 주소로 빌드해야 합니다. CI APK는 에뮬레이터 전용이므로 실기기 배포용이 아닙니다.

## 보안·제한

- API 서버의 8000 포트는 Docker 내부에만 노출하고, 외부에는 HTTPS 443 및 ACME/리다이렉트용 80만 엽니다.
- `HITEL_JWT_SECRET`은 서버에 영속 보존되며 Actions 로그에 출력하지 않습니다.
- 단일 서버 SQLite를 사용하므로 복수 인스턴스·고가용성 운영 전에는 PostgreSQL/백업으로 전환해야 합니다.
- 모바일 통화 음성 캡처, 실제 통신사 인증, 실제 STT 성공 여부는 HTTPS health 200만으로 증명되지 않습니다.
