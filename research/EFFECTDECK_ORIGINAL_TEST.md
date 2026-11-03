# EffectDeck 원본 iPhone 실기기 검증 (HITEL과 완전히 분리)

## 목적
HITEL의 이전 ReplayKit 테스트를 변경하지 않고, iOS 27의 Media Device Extension 기반 **시스템 가상 오디오 출력** 기능 자체를 검증합니다.
이 브랜치는 원본 EffectDeck MIT 코드를 고정된 Git commit으로 가져오는 git submodule과, 검증·빌드 워크플로만 포함합니다. 원본 UI·오디오 엔진·DSP·가상 장치 드라이버는 수정하지 않습니다.

- 원본 프로젝트: https://github.com/satomasahiro2005/EffectDeck
- 고정된 원본 commit: 5d1a558897b868d1249795c7c28b063bbcec196b
- 원본 소스: third_party/EffectDeck (git submodule)
- 라이선스: MIT, Copyright (c) 2026 nemut.ai. 원본 LICENSE, NOTICE.md 보존
- 원본 정식 iPhone 앱: https://apps.apple.com/app/effectdeck/id6812467517
- 요구 시스템: 실제 iPhone + iOS 27 이상
- 이 저장소에서는 HITEL 영상통화·통화 기능 앱·Communication SDK·Railway를 변경하지 않음

## 실제 설치 및 동작 검증: 원본 App Store 앱 우선
가장 빠르고 확실한 iPhone 실기기 검증은 원본 개발자가 서명하여 배포한 EffectDeck의 **정식 App Store 버전 설치**입니다. 단순히 임의로 재서명한 IPA로 대체하면 Media Device Extension entitlement가 사라질 수 있으므로 기능 검증이 불가능할 수 있습니다.

1. 실제 iPhone을 **iOS 27 이상**으로 업데이트했는지 확인합니다.
2. 원본 App Store URL에서 EffectDeck을 설치합니다.
3. 음악·팟캐스트·Safari 등 오디오가 재생되는 앱을 실행합니다.
4. EffectDeck을 실행한 뒤 제어센터의 오디오 출력 장치 선택에서 EffectDeck을 선택합니다.
5. 음악이 스피커·헤드폰으로 유지되고, EffectDeck UI의 미터/효과가 실제로 바뀌는지 확인합니다. 가상 오디오 출력 장치 설치 및 PCM 처리의 기본 합격 조건입니다.
6. 음악을 중지하고 **100번 고객센터로 실제 전화**를 발신합니다. 통화 중 오디오 출력 목록에서 EffectDeck이 존재하는지, 선택 가능한지, 선택이 유지되는지 확인합니다.
7. 통화 중 EffectDeck의 입력 레벨이 변하고 상대방 음성을 실제로 수신하는지 확인합니다. 음악 오디오와 전화 음성을 혼동하지 마십시오.
8. 통화가 끊기거나 장치 선택이 취소되는 경우 즉시 원래 스피커로 복귀한 후, 목록 미노출/선택불가/자동복귀/음성 무음 중 무엇인지 기록합니다.

### 실험 결과 판단
- 음악이 처리된다: **미디어** 출력 장치 및 원본 DSP 작동을 의미. 통화 녹음 성공 아님.
- 100번 통화 화면에 EffectDeck 장치가 없다: 전화 경로의 지원 여부에 추가 분석 필요.
- 100번 통화 중 장치가 선택되고 미터가 움직인다: 통화 음성 경로 참여 가능성을 의심할 수 있으나, **상대방 발화와 직접 일치 확인**이 필요.
- 통화 중 실제 상대방 발화와 미터·PCM 값이 일치해야만 다음 자막 개발을 시작할 근거.
- 통화 음성을 일절 확보하지 못했다면 원본 가상 출력 기능이 통화 경로까지 지원한다는 결론을 낼 수 없음.

## 원본 코드에서 iPhone 오디오가 처리되는 위치
- Sources/Extension/EffeTuneLiveExtension.swift — 가상 출력 장치 설치/라우팅
- Sources/Extension/ETDriver.m — AudioServerPlugIn WriteMix 수신
- Sources/Shared/ — extension↔app 데이터 경로, 127.0.0.1 로컬 연결
- Sources/EffeTuneLive/Audio/ — 네이티브 AVAudioEngine 재생 및 처리
(구체 파일명은 pinned source의 현재 트리와 대조하여 확인하십시오.)

## 동일 원본의 독립 빌드
GitHub Actions의 .github/workflows/ios-effectdeck-original.yml은 위 고정 commit과 그 DSP submodule을 받아 **원본 코드를 수정하지 않고** Xcode 27에서 iPhone ARM64로 unsigned 빌드합니다. 서명 없이 빌드할 수는 있으나, iPhone에 정상 설치·실행하는 데에는 Apple Developer의 Media Device Sharing Extension capability 및 해당 provisioning profile이 필요합니다.

- 원본 앱 bundle ID와 Media Device Extension protocol ID는 원본 그대로 유지됩니다.
- 원본 앱과 이름·아이콘·동작이 같습니다. HITEL 고유 앱 서명/브랜딩으로 복제한 완성품은 아닙니다.
- unsigned IPA는 자체 서명이 없는 **개발 검증 산출물**입니다. 이를 Sideloadly의 무료 Apple ID로 재서명하여도 특별 entitlement가 허용되지 않으므로 가상 출력 장치 기능을 시험할 수 없습니다.
- 실제 테스트는 반드시 정식 App Store 앱 또는 유효한 유료 개발자 권한이 포함된 프로비저닝으로 수행해야 합니다.

## 위험 및 제한
전화 통화가 일반 블루투스 HFP 라우팅을 지원한다는 사실만으로 Media Device Extension의 가상 출력 경로를 허용한다는 증거는 아닙니다. 가상 출력 장치가 재생 중인 일반 미디어에 대해 실제 검증되었다는 점만 확인됩니다.
원본 개발자는 동영상이 재생될 때 오디오 출력 경로가 AirPlay 쪽으로 우회되어 자동복귀할 수 있다고 설명합니다. 그런 경우 영상 재생 없는 음악으로 대조 시험하십시오.

공식 원본 설명: https://github.com/satomasahiro2005/EffectDeck#the-ios-27-media-device-extension
원본 출처 및 라이선스: https://github.com/satomasahiro2005/EffectDeck/blob/main/LICENSE
