# W03 한국어 STT 심층 진단 — 실단말 비교 절차

기존 삼성 기본 전화·Bixby 문자통화를 유지합니다. 이 진단은 동일한 HITEL 마이크 AudioRecord에만 연결됩니다. 별도 전화 오디오 캡처/루팅/녹음기를 실행하지 않습니다.

## 1. 시험 방법

1. HITEL W03 → **한국어 말하기** 누르고 통화 전 일상적인 한국어 문장을 8초 이상 말씀해 주십시오.
2. 원하는 경우 **통화 중 내 목소리 12초 WAV 진단 (ZIP 포함)** 버튼을 누르면, **그 시점부터 최대 12초간 동일 PCM**이 녹음됩니다. 버튼을 누르지 않으면 음성 파일은 생성하지 않습니다.
3. 마이크가 켜진 상태에서 삼성 문자통화에 진입하시고, 연결 이후 다시 **12초 WAV 진단** 버튼을 누른 다음 통화 전과 같은 문장을 말씀해 주십시오. 진단 버튼을 누를 때마다 새 파일을 만듭니다.
4. 통화를 종료하고 동일 문장을 다시 발화해 보십시오. 같은 실행 ID의 통화 전·중·후 세션을 구별합니다.
5. **마이크 인식 중지** 후 **W03 종료 · 결과 ZIP 저장**을 누르십시오. 모델 해제와 WAV 마무리가 끝나고 나서 ZIP을 저장하는 것이 정확합니다.

## 2. ZIP 내용

- `events.jsonl`: 기존 이벤트 + 상세 음향·디코더 진단
- `diagnostic_audio/sherpa_mic_*.wav`: 사용자가 샘플 버튼을 누른 경우에만 저장되는 16 kHz / mono / PCM16 / 12초 이하 WAV
- `transcripts.jsonl`, `screens/*.xml`, `steps/*.json`: 기존 W03 로그 유지
- `run.json`: 실행 기기/모델 정보

개인 음성이 포함될 수 있으므로 파일은 기기에 로컬로 보관되며 HITEL이 서버로 자동 전송하지 않습니다. 진단 ZIP을 외부로 공유할 때 WAV 포함 여부를 확인하십시오.

## 3. 이벤트 사전

| 이벤트 | 필드 및 해석 |
|---|---|
| `SHERPA_DIAG_START` | 세션 ID(sid), 요청 소스, 캡처 샘플레이트, 오디오 버퍼, UID, 네이티브 힙 |
| `SHERPA_DIAG_AUDIO_ROUTE_CHANGE` | `audioManagerMode`(일반/통화), `recordSource`, `requestedClientSource`, `actualCaptureSource`, `routed`, `actualCaptureDevice`, `isClientSilenced`, 클라이언트/서버 포맷, Android 효과 |
| `SHERPA_DIAG_AUDIO_TIMESTAMP` | AudioRecord의 누적 오디오 프레임 시간 및 장치 타임스탬프 수집 여부 |
| `SHERPA_DIAG_PCM_1S` | 매 1초 `rmsDbFS`, `peakDbFS`, `nearZeroPct`, `clippingPct`, `zeroCrossPct`, `dcOffset`, 실 수집 프레임 수 및 오디오/실시간 차이 |
| `SHERPA_DIAG_PCM_1S` | `readMsTotal`, `readMaxMs`, `decoderSteps`, `decoderMsTotal`, `decoderMaxMs`, `decodeLoadPct` |
| `SHERPA_DIAG_FIRST_PARTIAL` | 마이크 시작부터 **첫 중간 문자**까지 걸린 시간 |
| `SHERPA_DIAG_PARTIAL` | 디코딩 중간 문장: 최대 500 ms 간격으로 기록 |
| `SHERPA_DIAG_ENDPOINT` | sherpa-onnx 발화 구간 종료(침묵) 검출 및 해당 결과 |
| `SHERPA_DIAG_FINAL` | 확정 문장; 실시간 PCM 수집 중 한 번도 없으면 원인 분석 대상 |
| `SHERPA_DIAG_PCM_READ_ERROR` | 오디오 읽기 실패 코드 |
| `SHERPA_DIAG_WAV_ARMED/START/DONE` | 사용자 수동 요청 → WAV 기록 시작 → 완료, 파일 경로/길이 |
| `SHERPA_DIAG_END` | 세션 총 입력 시간, 중간·최종 결과 횟수, 엔드포인트 수 |
| `SHERPA_KO_MODEL_RELEASED` | 마이크 종료 후 ONNX 모델 메모리 해제 전후 네이티브 힙 |

## 4. 판단 규칙

1. **통화 중 WAV가 실제 본인 목소리를 또렷하게 포함하고 같은 구간 `PARTIAL`/ `FINAL`이 없다면**: 입력은 확보됐으므로 모델 포맷·전처리·인식기 스트림·디코더 처리 문제를 우선 조사합니다.
2. **WAV가 소음이나 다른 소리만 포함한다면**: PCM 진폭이 존재해도 사용자 발화 입력은 실패한 것이므로 마이크 경로를 조사합니다.
3. **`isClientSilenced=true` 또는 `routed/actualCaptureSource`가 통화 직후 변한다면**: Android 동시 캡처 정책이나 장치 라우팅 문제를 우선 조사합니다. `actualCaptureSource`가 `recordSource`와 다르다고 해서 반드시 오류는 아닙니다.
4. **`decodeLoadPct`가 100에 가까워지거나 `totalAudioMs`가 실제 벽시계보다 크게 지연되면**: CPU/모델 디코딩 병목, 오디오 버퍼 처리 지연을 조사합니다.
5. **`ENDPOINT`만 있고 `FINAL` 문장이 없다면**: 종결 판정은 일어났지만 결과 문자열이 비어 있었던 경우입니다. 음성인식 정확도나 잘못된 오디오를 조사합니다.

`rmsDbFS`가 0보다 크거나 오디오 샘플이 0이 아니어도 **사람의 발화가 확실히 포함되었다는 증거는 아닙니다**. WAV를 재생해 직접 확인해야 합니다.

## 5. 성능·범위

- 오디오 통계는 1초 단위로 집계하여 `LabStore.log`에 기록하며, 기존 100 ms PCM 처리 흐름에서 직접 계산합니다.
- 라우팅·Android 녹음 설정은 약 3초 간격으로 검사합니다.
- WAV는 요청 없이는 절대 생성하지 않으며 최대 12초(약 384KB)로 제한합니다.
- 모델 메모리는 마이크 중지 시 계속 해제하며, 기존 한국어 STT·VoxSherpa 원본 소스는 유지합니다.
- 새 코드를 컴파일·서명 검증했더라도 갤럭시 Z Flip3의 실제 통화 중 경로가 맞는지는 단말 ZIP 결과로만 판정합니다.
