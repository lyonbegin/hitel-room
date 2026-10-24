# 당근 단일 사이트 오픈소스 브라우저 감사
Playwright MCP + Chrome DevTools MCP + REA를 동일한 별도 Chromium CDP 세션에 연결합니다.
- 공개 URL: https://www.daangn.com/kr/search/local-profile/
- 화면 캡처, DOM·CSS·이미지 원본 URL, 기본 검색·지역 UI 작동 확인
- 비교 URL은 HITEL 통합 전 임시 시제품으로 한정
- 제3자 로그인·거래·메시지 전송하지 않음
- REA와 각 MCP 실행 성공·실패는 JSON에 구분 기록
- 브라우저 디버그 포트는 loopback에만 노출
- 사용: /report (감사 결과), /image/original.png, /image/previous.png, /status
