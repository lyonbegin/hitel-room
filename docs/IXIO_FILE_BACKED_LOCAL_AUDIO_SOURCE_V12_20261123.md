# IXIO `LocalAudioRecordSource` 파일 입력형 이식 — STT V12

## 요구사항과 보존 원칙

기존 IXIO STT 성공 기준선 `stt/main`은 변경하지 않는다. 원본 IXIO의 **PCM 공급자 형식**을 활용하되, 원본의 보호된 전화 오디오 소스(`AudioRecord(VOICE_DOWNLINK)`)를 삼성 기본 전화앱이 쓰고 있는 **통화녹음 M4A 파일**로 교체한다. 이미 실기기에서 성공한 **IXIO 원본 `speechSDK.SpeechInference(float[], int, boolean)` 및 JNI/모델 로더는 그대로** 사용한다.

## 역공학 근거

원본 메인 APK `classes18.dex`의 `LocalAudioRecordSource` (2026-11-23 원본 스말리 확인):

- `AudioRecord.read(short[512], 0, 512)`
- 16,000Hz / 모노 / `ENCODING_PCM_16BIT`
- `float[i] = short[i]/32768.0f`
- `ProducerScope.send(float[512])` (재사용 버퍼)
- 수신자 `CallScriptManager$readAndRecognizeDownLinkAudio$2$1.emit(float[], ...)`는 **`Arrays.copyOf()` 후 Channel로 송신**
- `SpeechToTextRepositoryImpl.recognize(float[], ...)` → 원본 `speechSDK.SpeechInference(...)`

원본 APK의 `AudioRecord` 소스 부분만 그대로 이식하면 `CAPTURE_AUDIO_OUTPUT` 보호 권한 문제가 생길 수 있다. 또한 `AudioRecord`는 파일을 입력받는 API가 아니므로, **원본 클래스의 목적·PCM 계약을 보존한 파일 기반 동등 구현**으로 치환했다. 원본 DEX 전체를 옮긴 것은 아니다.

## 이번 V12 구성

1. `SpeakerEngine`: 원래의 삼성 통화녹음 SAF 파일 발견/증가 감시, 필요할 때 임시 증가 파일 및 FFmpeg AAC 프레임 follower 유지 (원본 M4A는 AAC 압축이므로 디코딩 없이 PCM으로 사용할 수 없음).
2. `StreamingAacPcmDecoder`: 기존 지속적인 MediaCodec/AAC 디코드 + FIR 48kHz → 16kHz 모노 PCM16. 출력 윈도우만 200ms에서 **512샘플(32ms)**로 축소. 중간 M4A 파일·PCM 파일은 새로 만들지 않음.
3. **`FileBackedLocalAudioRecordSource`**: 디코더가 연속 공급하는 PCM16LE 바이트를 반쪽 샘플까지 보관하며 16비트 `short[512]`로 결합, 원본 수식으로 `float[512]`을 만들고 연속 emit.
4. `DirectPcmKoreanStt.acceptFloat(float[])`: 원본 `CallScriptManager`와 마찬가지로 생산자가 재사용하는 float 버퍼를 `clone()`한 뒤 **원본 IXIO 인식 SDK의 입력 큐**로 전송.
5. `DirectPcmKoreanStt.work()`: 큐에서 바로 float을 받아 `SpeechInference()` 실행. 기존 `byte[]` 재인코딩/재변환 단계 제거. 기존 모델/JNI ClassLoader/자막·endpoint 처리 보존.
6. 종료 시 `FileBackedLocalAudioRecordSource.finish()`가 마지막 512샘플 미만의 나머지도 정확한 길이로 배출, `pcmBytes / 2 == emittedSamples` 검증. 버퍼 끝 1바이트가 홀로 남으면 조용히 버리지 않고 오류 기록.

## 기존 시스템과의 차이

| 구간 | 기존 V11 | 새 V12 |
|---|---|---|
| 삼성 녹음파일 발견 | 3회 파일 증가 확인 | **변경 없음** |
| AAC 추출·복호화 | Native follower + MediaCodec + FIR | **동일 코드 사용** |
| 디코더 PCM 출력 주기 | 최대 200ms | **32ms** |
| PCM 공급 | 임의 길이 `byte[]`를 STT에 직접 큐잉 | **원본 IXIO 계약의 512샘플 `float[]` 스트림** |
| 바이트→float 변환 | STT worker 내부 변환 | **원본 `LocalAudioRecordSource` 동등 소스에서 1회만 변환** |
| 재사용 버퍼 소유권 | `byte[].clone()` | **원본 Collector 방식에 준한 `float[].clone()`** |
| SDK·모델 | 원본 IXIO | **변경 없음** |

## 시험과 미검증 조건

- `FileBackedLocalAudioRecordSourceTest.java`는 WAV에 해당하는 16비트 샘플을 불규칙한 바이트 단위로 나눠도 512+잔여 프레임이 원래 순서·진폭대로 전달되는지 검사한다.
- 종료 시 패딩 무음 추가/샘플 누락·복제/홀수 바이트 누락을 검사한다.
- V12 전용 APK 앱 ID: `app.hitel.recording.ixio.filepcm.v12`; V10/V11 기존 앱과 별도 설치.
- **삼성 M4A가 생성되고 처음 발견될 때까지의 ~3.4초 초기 대기 조건은 이번 변경에서 아직 제거되지 않았다.** 소스 객체 변경으로 그 시간이 자동으로 사라지는 것은 아니다.
- V12이 실제 삼성 통화 전체에서 STT를 성공시키는지, 화면 자막이 얼마나 빨라지는지는 **실기기 시험 결과가 나와야 검증**된다.
- 원본 IXIO 메인과 녹음 APK의 보호 권한을 우회하거나 공유했다고 주장하지 않는다.

## 증거

- [원본 PCM/Dex 분석](https://github.com/lyonbegin/hitel-room/actions/runs/45146100580)
- [원본 PCM 연결 역공학](https://github.com/lyonbegin/hitel-room/blob/research/ixio-original-pcm-to-speechsdk-20261123/docs/IXIO_ORIGINAL_DIRECT_PCM_BRIDGE_REVERSE_20261123.md)
- [V12 수정 코드](https://github.com/lyonbegin/hitel-room/tree/feature/stt-file-backed-local-audio-source-v12-20261123/speaker-standalone)
- [V12 빌드·테스트](https://github.com/lyonbegin/hitel-room/actions/workflows/ixio-file-backed-original-pcm-v12-20261123.yml)
