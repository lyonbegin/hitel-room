# iPhone Video Core — 원본 웹 가면 복구

## 실제 원인
이전 `HitelNativeVideoCore.swift`는 Vision 얼굴 경계 사각형을 추적한 다음, 불투명한 어두운 `CIImage(color:...)`로 그 영역을 덮었습니다. 기존 웹 가면의 텍스처·UV·눈·입 디자인이 전혀 사용되지 않았습니다. 사용자가 본 검은 화면의 직접적인 코드상 원인입니다.

## 웹 원본 확인
- 원본 소스: `lyonbegin/video-town-front/src/mask/MaskedCamera.ts`
- 웹 추적: MindAR 1.2.5 FaceMesh, Mediapipe 3D 얼굴 메시, 추적 안정화/OneEuro/게이트
- 웹 가면 소재: `https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/face-tracking/assets/sparkar/face-mask.png`
- 원본 크기: 1024×1024 RGBA/팔레트 투명 PNG
- SHA-256: `bce04e1c6a9e2e3158fbb81ceed25d6987b56c93253bc9895c8fc31a4299523e`
- 해당 PNG가 `mobile/ios/PublicRoomApp/face-mask.png`에 Git blob SHA `465c61111fa344b4039df39f33949a30407a1dd8`로 그대로 버전 관리됩니다.
- MindAR 프로젝트 MIT 라이선스 및 소스 저작권 고지는 upstream 저장소를 참조하십시오.

## 새로운 iPhone 순수 네이티브 처리
`AVFoundation/RTCCameraVideoCapturer` → `Vision.VNDetectFaceLandmarksRequest`로 양 눈과 입 좌표 추적 → 원본 PNG의 눈/입에 대응하여 `CGAffineTransform` 생성 → Core Image **실제 알파 텍스처 합성** → `RTCVideoSource`에 합성된 `CVPixelBuffer` 전달 → 기존 Railway 공개방 WebRTC 연결 상대에게 프레임 인코딩.

- 검은 사각형은 제거합니다.
- 얼굴 추적을 못 하면 120ms 이후 가면을 숨겨 과거 위치에 떠다니지 않도록 합니다.
- PNG 없으면 `mask` 버튼을 성공 처리하지 않고 오류를 표시합니다.
- 블루/화이트 픽셀이 실제 브라우저의 **원격 영상 캔버스**에서 디코딩되는지 검사합니다.

## 차이와 검증 범위
디자인의 PNG 원본은 **완전히 동일**하지만, 웹은 MindAR/MediaPipe 3D 468-포인트 메시 텍스처 변형이고 iPhone은 Vision 2D 랜드마크 기반 선형 텍스처 워핑입니다. 따라서 *회전·표정 변화 때 메시 형상이 픽셀 단위로 동일하다고 할 수는 없습니다.* 완전히 같은 3D 변형과 필터 상수를 원하시면 MediaPipe native FaceLandmarker와 canonical UV 삼각 메시까지 이식해야 합니다.

별도 iOS CI에서 (1) SHA-256 동일 (2) iOS Simulator Swift 빌드 (3) 실기기용 ARM64 빌드 (4) IPA 파일 내부 원본 디자인 포함 (5) 프로덕션 Railway 공개방에서 웹 브라우저가 iPhone native 송신 프레임의 파랑·흰색 픽셀을 실제 디코딩했는지 확인합니다. 테스트용 합성 얼굴 좌표는 iOS **시뮬레이터에만** 존재하며 실기기에서는 카메라에 비친 얼굴을 Vision으로 추적합니다.

Fly.io와 Railway의 운영 서버, 원래 웹 VideoCore, iPhone 화면 스트리밍 앱은 수정하지 않습니다.
