# 네이버 예약 프로모션 UI 분석 및 재현

원본: https://booking.map.naver.com/promotions/home

HITEL UI 레퍼런스 재현 전용 서버. 원본 공개 페이지를 Chromium 1440x900으로 캡처하고 카테고리 필터를 클릭합니다.
- / : 원본·재현 화면 대조
- /clone : 재현 화면
- /report : 비교 보고서
- /artifacts/original.png, clone.png, diff.png
- /artifacts/original.json : 브라우저 DOM / 이미지 / 네트워크
- /tools-report : Playwright MCP / Chrome DevTools MCP / REA 실제 실행 결과
네이버 공식 서비스를 대행하거나 제휴한 서비스가 아닌 시각적 UI 레퍼런스 시제품입니다.