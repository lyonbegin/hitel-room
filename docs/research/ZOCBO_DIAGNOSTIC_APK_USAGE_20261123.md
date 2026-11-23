# 족보닷컴 원본 APK 4.3.11(2) 무료기출 진단판 — 사용 및 검증

원본 XAPK SHA-256: `d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5`
패키지: `com.eduzone.eduzoneviewer`.

## 실제 계측한 DEX/Smali 위치

- `com/eduzone/eduzoneviewer/ui/activities/MainActivity.smali`: 진단 도구 표시
- `com/eduzone/eduzoneviewer/ui/activities/CommonWebviewActivity.smali`: 진단 도구 표시
- `com/eduzone/eduzoneviewer/ui/activities/LoginActivity.smali`: 진단 도구 표시
- `com/eduzone/eduzoneviewer/interfaces/WebAppInterface.smali`: `goPreviousExam()`, `goWebViewLink()` 진입 로그
- `z3/m.smali`: `onGoPreviousExam` 허용 Boolean값 기록
- `z3/e.smali`: 실제 `CookieManager.setCookie()` 2곳, JavaScriptInterface 등록 1곳
- `l3/f.smali`: 실제 `CookieManager.setCookie()` 2곳
- `o3/M.smali`, `t/a0.smali`, `t3/A.smali`, `z3/k.smali`: WebView URL 요청 및 브리지 등록 등

**원본 앱의 로그인/접근 통제 코드를 수정하거나 우회하지 않음.** 추가 로그는 원래 함수를 호출하기 전에 기록만 남긴다.

## 로그와 버튼

앱 화면 오른쪽 상단에서 `로그`, `복사`, `공유`, `지우기` 네 버튼.
- `로그`: 기기 화면에서 시간순 추적 확인
- `복사`: 기록을 클립보드로 복사. ChatGPT 대화에 붙여넣기 가능
- `공유`: Android 공유 메뉴에서 텍스트 전송
- `지우기`: 이전 실행 기록 삭제, 이후 동작만 새로 기록

진단 로그는 앱 내부 사유 저장공간 `files/zocbo_free_exam_trace.txt`에 기록됨.
민감 쿠키/토큰/기기 식별값은 원문을 기록하지 않고, 키 이름·존재·길이·짧은 SHA-256 지문만 남긴다. 일반 서비스 유형코드 `SERVICETYPECD=4`, `os-type`, `app_version`, `search_webview` 같은 비민감 항목은 값을 기록한다.

권장 동작 순서: 진단판 실행 → `지우기` → 정상 로그인 → 무료 기출열람실 버튼 → 학교 검색/자료 접근 → `복사` → 채팅에 붙여넣기.

## 설치 주의

원본 앱과 **서명이 다르므로 기존 앱 위에 덮어 설치할 수 없음** (`INSTALL_FAILED_UPDATE_INCOMPATIBLE` 가능).
기존 앱의 로그인·데이터를 잃지 않도록 별도 테스트 단말기 또는 데이터를 백업한 환경을 사용한다.
기존 XAPK는 기본 APK 외에 ARM64·언어·화면밀도 3개 분리 APK를 포함하므로, 단독 APK가 설치되지 않거나 기능이 누락되면 **서명 일치 분리 APK를 포함한 진단판 XAPK**로 설치해야 한다.
재서명으로 원본 앱의 서버측 서명/진위 확인이나 외부 OAuth 기능이 달라질 가능성이 있으며, 실제 사용 조건에 따른 확인이 필요하다.

## 빌드 검증

- 성공 빌드 (원본 일치, Smali 계측, DEX 첨부, APKTool, zipalign, apksigner v1/v2/v3 통과): https://github.com/lyonbegin/hitel-room/actions/runs/45102847087
- 1차 수정 APK SHA-256: `f1e614a418c4cb2eea54814368b509fce2222676225169f7084569328ba0f575`
- 실제 안드로이드 설치·표시 여부는 별도 에뮬레이터 테스트 결과로 판단해야 함. APK 생성 성공을 런타임 성공으로 간주하지 않는다.
