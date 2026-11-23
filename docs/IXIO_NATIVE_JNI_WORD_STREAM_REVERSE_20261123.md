# IXIO JNI 네이티브 음성 토큰/자막 갱신 경계 역공학 — 2026-11-23

## 검증한 원본
- 공개 V10 릴리스 APK: `HITEL_IXIO_FullM4A_SingleLoader_V10_20261123.apk`
- APK 검증 SHA-256: `8c4245bed2fab624d4ad160ae50445a8eee167c93b4e5a9567622e632a5e5092` (Actions sha256sum PASS)
- 내부 라이브러리: `lib/arm64-v8a/libsherpa-onnx-jni.so`, 4,370,136 bytes
- ELF: AArch64, Android 28, NDK r28-beta2, stripped (.symtab 부재)이나 .dynsym JNI export는 보존
- 바이너리 검증 실행: https://github.com/lyonbegin/hitel-room/actions/runs/45190966259
- ARM64 JNI 디스어셈블 실행: https://github.com/lyonbegin/hitel-room/actions/runs/45191420134
- 내부 C API 분기 디스어셈블 실행: https://github.com/lyonbegin/hitel-room/actions/runs/45191676616

## 실제 ELF 동적 심볼 주소
| JNI 함수 | ELF 가상주소 | 핵심 명령과 실제 내부 분기 |
| --- | --- | --- |
| `CombinedSTTKWS_isReady` | `0x1e1c90` | `mov x1,x3; mov x0,x2; b 0x2b059c` |
| `CombinedSTTKWS_decode` | `0x1e1ca8` | `bl 0x2b05ac` |
| `CombinedSTTKWS_decodeStreams` | `0x1e1cd4` | JNI 배열 처리 후 `bl 0x2b05ac` |
| `CombinedSTTKWS_getResult` | `0x1e1ed0` | `bl 0x2b05bc`, 결과를 JNI Java 객체로 변환 |
| `CombinedSTTKWS_isEndpoint` | `0x1e1c9c` | `b 0x2b05cc` |
| `CombinedSTTKWS_reset` | `0x1e1c84` | `b 0x2b05dc` |

## 함수 포인터 테이블을 통한 확정 경로 (AArch64 원본 명령)
C API trampoline 실제 기계어를 확인했다.

`0x2b059c` (IsReady):
```asm
ldr x0, [x0]
ldr x8, [x0]
ldr x2, [x8, #32]
br x2
```
`0x2b05ac` (Decode):
```asm
ldr x0, [x0]
ldr x8, [x0]
ldr x3, [x8, #48]
br x3
```
`0x2b05bc` (GetResult):
```asm
ldr x0, [x0]
ldr x9, [x0]
ldr x2, [x9, #56]
br x2
```
따라서 자바 JNI 직후 네이티브는 **가상함수 테이블(vtable) 오프셋 32/48/56**으로 `IsReady`/`Decode`/`GetResult`를 분기한다. 구체 구현 함수의 vtable 대상 주소는 이번 정적 분석에서 아직 식별하지 않았다. 이 수준을 넘어 실제 Zipformer2 Encoder→RNNT Joiner의 명령을 확인했다고 주장하지 않는다.

## 원본 SDK 전용 코드 존재 증거
라이브러리 strings에 로컬 빌드 원본 소스 경로가 그대로 남았다.
- `/Users/bmingo/sdklib/sherpa-onnx/sherpa-onnx/csrc/combined-stt-kws-impl.cc`
- `/Users/bmingo/sdklib/sherpa-onnx/sherpa-onnx/csrc/combined-stt-kws-impl.h`
- `/Users/bmingo/sdklib/sherpa-onnx/sherpa-onnx/csrc/combined-stt-kws-transducer-impl.h`
- `/Users/bmingo/sdklib/sherpa-onnx/sherpa-onnx/csrc/combined-stt-kws.cc`
이것은 IXIO 통합 SDK가 공개 sherpa-onnx와 동일하다고 단정할 수 없다는 직접 증거다.

## 단어별 표시를 위한 결론 및 미완료 사항
- 정상 앱은 PCM 512 샘플/32ms씩 `SpeechInference`에 넣지만, 원본 모델 `T=77`, `decode_chunk_len=64`의 공개 Sherpa 계열에서는 약 640ms 입력분마다 새 인코더 결과가 생성될 수 있다.
- 실제 JNI 노출 기능은 `isReady`, `decode`, `getResult` 등이며 `CombinedSTTKWS`에 **토큰 생성 즉시 콜백을 등록하는 JNI export는 확인되지 않았다**. 이 주장은 동적 심볼 표면에 한정된다. 숨겨진 C++ 내부 callback 존재까지 부정한 것은 아니다.
- `getResult()` 호출을 32ms마다 반복하거나 RNNT가 반환한 여러 토큰을 가짜 타이밍으로 순차 표시해도, 실제 단어 발생 시각에 맞춘 조기 인식은 성립하지 않는다.
- 더 짧은 인코더 청크 모델이 가능하려면 원본 학습 체크포인트의 다중 청크 학습 및 재내보내기 가능성 확인이 필요하다. `encoder.ort` 메타데이터 변경은 안전한 해법이 아니다.
- 확정되지 않은 일: 실제 구현 vtable의 함수 주소/로직, 내부 RNNT 토큰 emit 시점의 후킹, IXIO 가중치 320ms 재내보내기, 실기기 비교 테스트.
- 기존 `stt/main` 및 녹음·PCM·FIFO·동작 중 APK는 수정하지 않았다.

## 다음 검증 경로
1. `combined-stt-kws-transducer-impl.h` 구현체 vtable을 `.data.rel.ro`와 RELATIVE relocation에서 복원하고 `IsReady/Decode/GetResult` 대상 함수 주소를 확정한다.
2. 타깃 함수에서 모델 `ChunkSize()/ChunkShift()`, `RunEncoder()`, `RunJoiner()`, 결과 저장 명령을 추적한다.
3. 모든 PCM 호출에 대해 `isReady` true/false, decode 시작·종료, 변경 텍스트와 자막 반영 시각을 **비표본 로그**로 남긴다.
4. 원본 640ms 기준선과 별도로 지원되는 320ms 구성 가능성을 모델 가중치 및 캐시 텐서 구조로 검증한다.

## 추가 네이티브 함수 테이블 탐색 — 2026-11-23 23시대

실행 증거: https://github.com/lyonbegin/hitel-room/actions/runs/45192535528 (성공)

원본 AArch64 ELF의 `.rela.dyn` 상대 재배치(`R_AARCH64_RELATIVE`)를 분석하여 실행 코드 영역(`.text`)을 가리키는 연속 함수 포인터를 추출하였다.

- `.text` 범위: `0x164b00–0x40ce48`
- 상대 재배치 엔트리: **7,780개**
- 이 중 실행 코드 주소를 가리키는 엔트리: **4,621개**
- 실행 코드 포인터가 8개 이상 연속된 후보 테이블: **233개**

발견된 후보 테이블에는 `0x41c7a8`, `0x41cf50`, `0x420d58` 등 다수의 함수 포인터 집합이 들어 있다. 하지만 이들이 모든 C++ 클래스의 테이블을 함께 포함하므로, 현재 기록만으로 특정 테이블을 **CombinedSTTKWS 구현체의 vtable이라고 식별할 수 없다.** 따라서 `#32 / #48 / #56` 가상 호출이 최종 도달하는 구현 주소도 아직 미확정이다.

후속 식별 절차는 생성자에서 저장하는 vptr를 추적하고, 해당 vtable의 32·48·56바이트 함수 포인터와 `IsReady`/`Decode`/`GetResult` 호출을 대조하는 것이다. 이때 `T=77`, `decode_chunk_len=64`, 인코더·캐시 및 RNNT 토큰 저장 경로를 검증해야 한다.

**단어 단위 즉시 자막의 결론:** 이 단계에서 JNI 입구의 원본 명령과 가상함수 간접 호출 구조는 실증되었지만, 내부 디코더가 640ms 청크 도중 토큰을 중간 공개할 수 있는지, 더 짧은 청크를 기존 가중치로 지원하는지까지 검증되지는 않았다. 현재 음성 입력·FIFO·실행 APK는 변경하지 않았으며 새로운 인식 지연 개선을 주장하지 않는다.
