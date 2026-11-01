# HITEL Shared UI

별도 비교판: feature/shared-ui-redesign-20261101

기존 배포 커밋 8372ed1a0f1428c54ba43399f8d9b1dbaaf55d5f를 기반으로 191개 화면·상태를 공유 화면에 연결했습니다. 80개 상황은 검토 화면에서 활동·역할·통신 환경을 같은 공유 UI에 적용합니다.

## 실행

- npm ci
- npm test
- npm run build
- npm start

## 데이터와 실제 연동 범위

활동, 메모, 메시지, 일정, 구성원·작업은 localStorage에 저장됩니다. 실제 외부 메시지, PSTN, WebRTC 상대 연결, AI 음성·자동요약, 인증, 결제·배송은 연결 전입니다. 장치 점검은 사용자가 버튼을 누른 경우에만 브라우저 권한을 요청합니다. 역할 전환은 UI 검토용이며 서버 인가를 대체하지 않습니다.

검토 메뉴: 전체 화면 연결표, 80개 상황 검토, 변경 전후 비교.

Railway 서비스 rootDirectory=/hitel-ui-flow, buildCommand=npm ci && npm run build, startCommand=node server.mjs. 기존 서비스를 수정하지 않고 별도 서비스로 배포합니다.
