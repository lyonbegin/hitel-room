# 하이텔 방 (Hitel Room)
사람과 사람이 1:1 또는 다자간으로 영상·음성 대화하는 독립 React 웹 클라이언트입니다.

## 서버 사용 원칙
- 기존 WebRTC Session Server: https://webrtc-new.fly.dev
- 서버 기능/소스 **추가 또는 변경 없음**
- 기존 서버의 /auth/dev-token, /telemedicine/consultations, /realtime 및 mediasoup SFU 프로토콜을 사용
- 현재 서버 규격상 **초대된 회원만 세션 참가 가능**, 방 생성자는 개발 테스트에서 `doctor` 권한 필요
- 공개방 목록·자유입장·실시간 문자채팅은 현재 서버에서 제공되지 않으므로 구현됐다고 표시하지 않음
- 개발 로그인 기능은 운영 회원인증이 아닙니다. 운영 공개 이전에 별도 인증이 필요합니다.

## Fly 배포
GitHub Actions가 push 시 Secret `FLY_API_TOKEN`으로 Fly 앱을 생성/배포합니다.
Workflow: .github/workflows/deploy-fly.yml.
앱 이름 우선순위: hitel-room → hitel-room-lyonbegin.
기존 webrtc-new Fly 앱은 변경하지 않습니다.

## 로컬
```sh
npm install
npm run build
npm run dev
```
기본 API 주소는 https://webrtc-new.fly.dev 입니다.
서버가 브라우저 Origin / CORS를 허용하지 않는 경우 서버 변경 없이 이 클라이언트만으로 접속을 복구할 수 없습니다.

## CORS 우회 구성
브라우저가 `https://webrtc-new.fly.dev`에 직접 교차 출처로 요청하면 허용 Origin 헤더가 없어 CORS로 차단됩니다.
프론트엔드 앱의 Nginx에서 `/api/*`를 기존 API로, `/socket.io/*`를 기존 Socket.IO 서버로 전달합니다.
브라우저는 `https://hitel-room.fly.dev` 한 도메인에만 접속합니다. 기존 서버의 설정 및 소스는 변경하지 않습니다.

## 개발용 로그인 인증
로그인 화면에서는 ID/이름/역할만 입력합니다. 키 또는 JWT 입력란은 없습니다.
테스트 로그인 원문 키는 기존 WebRTC 서버의 `TEST_LOGIN_KEY`와 동일해야 합니다.
Fly.io `fly secrets list`에 나오는 16자리 Digest는 원문 키가 아닙니다.
하이텔 방의 Fly 앱에 `TEST_LOGIN_KEY` Secret을 한 번 등록하거나 GitHub Actions Secret `TEST_LOGIN_KEY`를 등록하면, 배포 시 Nginx 프록시에 적용됩니다.
공개 GitHub 저장소와 브라우저 번들에 비밀키를 넣지 않습니다.

## VideoCore SDK 재사용
기존 `lyonbegin/video-town-front`의 SDK 소스를 배포 단계에서 빌드해 사용합니다. 가면 알고리즘은 복사하지 않습니다.
- SDK: `/sdk/video-core.esm.js`
- 독립 SDK Playground: `/sdk-playground.html`
- 가면/원본 전환: `VideoCore.openCamera({mode})`, `camera.setMode(mode)`와 mediasoup `producer.replaceTrack`
- WebRTC 서버 `webrtc-new.fly.dev`는 변경하지 않습니다.
