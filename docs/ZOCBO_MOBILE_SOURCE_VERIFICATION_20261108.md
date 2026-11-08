# 족보닷컴 모바일 소스 기반 기능 검증 보고 (2026-11-08)
## 근거
- GitHub Actions: https://github.com/lyonbegin/hitel-room/actions/runs/42444273566
- artifact ID: 13601894799 / zip SHA256: 7ce6db3110f7eacc096df7291b24f08954959e6088e12a5147045401d625272d
- artifact에는 app-home.html, login.html, event-documents.html, middle-exam-list.html, high-exam-list.html, school-expect.html, free-reading.html, free-reading-web.html과 CSS/JS가 있음.
- high-exam-list.html 및 middle-exam-list.html의 #examMain은 텍스트 길이 0, 자식 요소 0: 초기 HTML만으로 검색 결과 복원 불가.
- event-documents.html의 .promotion__section.is-data에는 익명 공개 자료 명칭과 다운로드 버튼이 존재함.
## 이번 브랜치에서 변경
- public/zocbo-integration.js: 외부 iframe 제거. 원본 메뉴별 모바일 내비게이션을 HITEL 영역 안에 직접 렌더링하고, 실제 원본 URL로 이동하도록 명시.
- public/zocbo-integration.css: 중첩 웹뷰 없이 한 화면의 단일 스크롤로 동작하도록 CSS 추가.
- 기존 35개 공개자료 목록 / 상세 / 학년 필터 / 검색 코드는 유지.
## 상태 판단
| 기능 | 판정 |
| --- | --- |
| 원본 모바일 정적 HTML/CSS/JS 증거 확보 | 수집 확인 |
| 외부 iframe 제거 | 코드 변경 |
| 기존 공개자료 35개 목록 및 내부 검색 | 기존 코드 유지, 재검증 필요 |
| 원본 문제은행 서버 실시간 결과 | 미구현 |
| 문제 본문/정답/해설 | 미확보, 미구현 |
| 인증 및 다운로드 | 공식 원본 링크로 이동, HITEL 내부 수행 미구현 |
| 모바일 실기기 테스트 / 실제 다운로드 파일 | 미검증 |
## 다음 개발 범위
1. 원본 브라우저에서 비로그인 동적 요청/응답 계약의 공개 범위를 HAR로 검증.
2. 합법적으로 접근 가능한 원본 응답의 데이터 스키마, 상태 코드, 페이지네이션을 테스트.
3. 실시간 결과가 검증된 경우에만 API 어댑터 구현; 보호된 인증 쿠키나 다운로드 토큰을 우회하지 않음.
4. Android 360px 및 iPhone 390px 화면에서 1회만 스크롤되는지 실측 테스트.
