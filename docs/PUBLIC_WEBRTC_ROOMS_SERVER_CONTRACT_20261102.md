# HITEL 공개 영상방: 원본 Fly WebRTC 서버 호환 계약 (2026-11-02)

## 제품 동작 (확정)
- 사용자는 본인의 계정으로 로그인한다. 초대할 상대방 ID를 입력하지 않는다.
- 어떤 사용자가 공개방을 생성하면 모든 사용자의 **공통 방 목록**에 곧바로 나타난다.
- 다른 사용자는 목록의 한 방을 클릭하여 **방장 승인이나 초대 없이** 참가한다.
- 카메라/마이크 브라우저 권한은 최초 한 번만 사용자에게 요청한다.
- 실제 영상 처리는 기존 VideoCore의 원본/가면 트랙을 유지하며, 미디어는 기존 HITEL mediasoup SFU를 사용한다.
- 퇴장과 방 종료는 구분한다. 참가자 퇴장은 다른 사람의 방을 종료하지 않는다.

## 확인된 기존 원본 서버 차단 (실제 GitHub Actions 요청)
- 테스트 로그인 POST /api/auth/dev-token: HTTP 201 (정상).
- host-only, policy.allowUnlistedParticipants=true 요청:
  POST /api/telemedicine/consultations: HTTP 400
  응답: `property policy should not exist,participants must contain at least 2 elements`
- 테스트방 생성이 거부되었으므로 남은 테스트방 없음.
- 따라서 UI의 초대 입력 필드만 삭제하면 공개방은 작동하지 않는다.

검증: https://github.com/lyonbegin/hitel-room/actions/runs/41468403140

## 기존 Fly 서버 필수 변경 (미구현: 해당 서버 코드/배포 권한 없음)

1. `POST /telemedicine/consultations`의 create DTO에 `visibility:'PUBLIC'` 또는 `policy.allowUnlistedParticipants:true`를 허용한다. 공개방에 한해서는 최초 `participants` 배열이 **방장 한 명**이어도 허용한다. 기존 비공개 원격진료 세션의 2명 초대 검증은 유지한다.
2. 세션에 `visibility`/공개방 정책을 저장한다. 응답의 `policy.allowUnlistedParticipants`가 `true`로 반환되어야 한다.
3. 인증된 새 사용자의 `GET /telemedicine/consultations/:id`은 **공개방에 한하여** 방 메타데이터를 제공한다. 비공개 환자 의료 정보는 공개되지 않도록 응답을 제한한다.
4. 원본 Socket.IO `session:join`: 공개이고 유효한 방이면 초대 여부와 관계없이 새로운 사용자 `userId`를 원자적으로 참가자로 등록한다. 인원 제한, 중복 소켓, 종료된 방, 중복 사용자 및 차단 여부를 확인한다. `participant.permissions`는 최소 음성·영상 송수신만 허용하며 `manageSession`은 `false`이다.
5. `session:ready` 또는 공개방 입장 완료 후 기존 SFU `rtc:join` · `rtc:create-transport` · `rtc:produce` · `rtc:consume`이 기존과 동일하게 성공해야 한다. 기존 비공개방의 호스트 승인 정책은 바꾸지 않는다.
6. `session:start`는 공개방에서 방장 준비 시 자동 처리하거나 `requireHostStart:false`로 건너뛴다. 새로운 참가자는 이미 LIVE인 공개방에 즉시 미디어 연결이 가능해야 한다.
7. 공개방 목록이 종료 또는 만료 시 제거되도록 `session:end`와 HITEL 공개방 API의 상태를 동기화한다.

## 이미 구현된 별도 코드

- 웹: `fix/webrtc-room-lifecycle-20261102`의 `src/App.tsx` 공개방 UI, `src/lib/publicRooms.ts` 실목록/입장 클라이언트, `nginx.conf` HITEL API 프록시.
- API: `feature/public-rooms-api-20261102`의 `services/hitel-api/app/public_rooms.py` SQLite 또는 PostgreSQL SQLAlchemy 테이블 기반 영속 공개 목록.
- Railway 기존 API 미리보기: `https://hitel-api-preview-production.up.railway.app/v1/public-rooms`; HTTP 200 반환 확인.
- Railway 기존 웹 미리보기: `https://hitel-web-preview-production.up.railway.app/webrtc-room`; 실제 영상방 연결은 현재 원본 서버 차단 때문에 검증 불가.

## 검증 수락 기준

1. A 사용자가 ID 입력 없이 방장 혼자 `POST /telemedicine/consultations`으로 공개방을 생성해 HTTP 201 수신.
2. 공개 목록은 브라우저 A/B/C에서 동일한 방 이름과 방 ID를 반환.
3. 초대받지 않은 B가 `GET /telemedicine/consultations/:id` 및 `session:join`에서 성공.
4. B가 `rtc:join`과 Producer/Consumer 생성 성공; A·B 양쪽에 실제 서로의 영상과 오디오가 나타남.
5. C가 추가 입장하면 기존 통화 A·B를 끊지 않고 3명 연결.
6. 4명 제한 방에서 5번째 참가자가 시도하면 명확한 정원 초과 오류.
7. B가 퇴장해도 A·C 통화 유지. A가 방을 종료하면 목록에서 제거되고 새로운 입장은 차단.
8. 가면/원본 트랙 변경과 재연결 후 방 입장이 정상 작동.

**주의**: 현재 공개방 카탈로그 API는 진짜 Fly `session:join` 승인을 우회하지 않습니다. 원본 서버 패치 없이 성공 표시를 하지 말 것.
