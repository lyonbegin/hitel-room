# IXIO 신규 Native STT: 87.316초 원본 통화 M4A 실시간 증가파일 시뮬레이션 비교
검증일: 2026-11-24 / 브랜치: `feature/ixio-native-stt-reimplementation-20261123`

## 정확한 시험 대상 및 무결성
- 사용자 제공 `통화 녹음 100_261112_235500.m4a`, AAC-LC 48kHz 모노, 87.316초, 1,415,360 bytes
- 녹음 SHA-256: `677df9640436b5c8f18d18f1eff4742133fd25e91b06c19e2e5c17174623c342`
- 개인 원본 IXIO 모델 `IXIO_STT_Original_4.0.4.zip`에서 encoder.ort, decoder.ort, joiner.ort, tokens.txt를 **로컬에서만** 사용; 원본 ZIP 및 음성 바이트를 공개 GitHub에 게시하지 않음
- 독립 x86_64 CPU 런타임: ONNX Runtime 1.21.0 C API, 모형화한 80-bin Kaldi Fbank, RNNT greedy
- M4A 파일을 새로 생성해 32ms마다 원본 AAC 패킷 끝까지 증가시키는 테스트와, 새로운 가상 SAF 미러를 250ms마다 덧붙이는 테스트를 각각 실시
- AAC 실 패킷 4,093개, FAAD2 NeAACDecDecode 4,093회, AAC 디코딩 오류 0
- FAAD2가 출력한 48kHz PCM에 현 앱 GithubFaad2PcmSource.java와 같은 63-tap Hamming-window FIR (cutoff=.145), 3:1 decimation, PCM512 정렬 적용
- 가상 증가 M4A, 완료 후 미러 M4A의 SHA-256이 원본과 **바이트 단위 일치**. 트랜스크립트 문자열/파일 자체는 공개 보고서에 포함하지 않음.

## 실제 연산 비교 — 기존 모델 재실행 (동일 가중치, 같은 통화음성)
| 경로 | A. 과거 CPU 입력 방식 (FFmpeg 원본 전체 WAV, 가상 시계 1× 게이트) | B. 현 앱 입력 방식 (증가 M4A→실제 FAAD2→현행 63탭 FIR, 32ms 감지) | C. B + 현행 SpeakerEngine 250ms 미러링/120ms 초기 선택 |
| --- | ---: | ---: | ---: |
| 처음 부분 자막 발생 (파일 공급 기준, 초) | 0.800 | 0.832 | 0.896 |
| 부분 자막 변경 횟수 | 100 | 100 | 100 |
| 부분 자막 변경 간격 중앙값 | 640ms | **640ms** | **736ms** |
| 부분 자막 간격 p95 | 1,280ms | 1,280ms | 1,274ms |
| 가장 긴 공백 (무음 포함) | 6.400s | 6.400s | 6.496s |
| encoder.ort 실제 실행 | 137청크 | 137청크 | 137청크 |
| 유효 RNNT 토큰 | 378 | 378 | 378 |
| Decoder+Joiner 실행 | 2,550회 | 2,548회 | 2,548회 |
| 자막 변경당 2토큰 이상 모이는 회수 | 원본 약 90% | 91/100 | **91/100** |
| 인코더+RNNT 1회 전체 스텝 추론시간 p50 | 35.8ms | 35.5ms | 36.1ms |

- 동일 B 입력으로 **실제 경과 시간 1배속 87.3초** 공급도 재실행 완료: 자막 변경 간격 실시간 중앙값 640ms, p95 1.274초, 최대 6.428초.
- B→C 미러링의 추가 이벤트 지연: 평균 109.8ms, 중앙값 96ms, p95 224ms, 최대 224ms. 별도 파일 접근/스케줄러 지연은 추가될 수 있음.
- 모든 문장 변경 시 `GetResult()` 결과를 지체 없이 내보내도, 인코더가 64개의 새로운 10ms feature frame을 모아 처리한 후에야 다음 결과를 내므로 **640ms 입력 병목은 남는다**.
- 이전 실기기 보고에서는 세션→첫 PCM 3.61초, 세션→첫 부분 자막 4.37초였으나, 별도 Galaxy 기기의 통화 중 감지 시계이므로 위 CPU 재생 시작시각과 직접적인 latency 승패 비교는 금지.

## 모델 청크 길이 단축 직접 검증
실제 원본 `encoder.ort`에 `x` 입력을:
- `[1,77,80]` : PASS, 출력 `[1,16,512]`
- `[1,45,80]` (32+13 프레임으로 320ms 구현 시도): FAIL, ONNX Runtime `input x index:1 Got 45 Expected 77`
- `[1,29,80]` (16+13 프레임으로 160ms 구현 시도): FAIL, 동일한 입력 차원 오류
이는 단순히 `decode_chunk_len=32/16` 또는 RNNT 토큰 콜백을 변경한다고 실제 인코더 갱신 주기가 줄어들지 않는다는 직접 증거다.

## 두 개의 인코더를 320ms 어긋나게 실행하는 별도 탐색
기존 모델의 가중치는 그대로 둔 채 새 독립 스트림 B를 32 Fbank 프레임 뒤에서 시작하도록 시험. A 100회 + B 94회의 원시 부분 자막 변화가 320ms 격자로 나타남. **그러나 완성된 두 텍스트의 SequenceMatcher 일치도는 약 74.11%**이며, 94개의 B 결과 중 후방정합 기준으로 후보 확장으로 받아들일 수 있는 구간은 51개였다. 이 방법을 검증된 정확한 단어별 자막이라고 주장하거나 제품에 병합해서는 안 된다.

## 신뢰 수준과 미해결 부분
**이번에 실제 실행하여 검증한 것:** 사용자가 제공한 동일한 M4A 바이트의 증가 복사, 파일 복사주기, 진짜 AAC/FAAD2 디코딩, Java와 동등한 FIR, 원본 IXIO ONNX 가중치의 CPU 인코더·RNNT 실행, 부분 문자열 변경 시각과 원시 모델 고정 입력 크기, 실제 시계 1배속의 일부 전체 실험.

**이번에 실행하지 않은 것:** 새 Android APK `NativeSttBridge`가 공개 Sherpa-ONNX C API에서 같은 .ort를 실제 로딩하고 화면에 자막을 출력하는 E2E. 이 API는 IXIO 전용 `CombinedSTTKWS`와 다르고 아직 원본 모델 호환성이 미검증. 실제 Android `SpeechInference`와 새 네이티브 엔진 사이 인식 정확도·속도 동등성을 주장하지 않는다. CPU 모델 시뮬레이션의 640ms 갱신 간격과 그 지연을 새 Android APK 실측이라고 표현하지 말 것.

**요약:** 신규 개발 브랜치에서 C++ 자막 변경 콜백은 즉시 호출되지만 **검증된 인코더 청크 개선량은 0ms(640ms→640ms)**. 250ms 미러링은 추가 지연. 인식 주기를 줄이려면 (1) 정확한 단축 청크 모델 재내보내기/호환성 확인 (2) 두 스트림 결합은 정확도 문제 선해결 (3) 이벤트 기반 녹음 미러링으로 입력 지연 단축을 독립적으로 추진해야 한다.

### 관련 소스
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/GithubFaad2PcmSource.java`: 진짜 Java FIR 정의
- `speaker-standalone/app/src/main/java/app/hitel/speakeronly/SpeakerEngine.java`: `POLL_MS=250`, 최신 파일 120ms 확인, FIFO 연결
- `hitel-native-stt/src/native_stt.cpp`: 변경 시각에 따른 즉시 콜백, 시간 제한 없음
- 선행 라이브러리 결과 `IXIO_REAL_STT_CPU_TEST_REPORT_20261123.md`: 동일 가중치 원본 137청크/378토큰 시험
