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
