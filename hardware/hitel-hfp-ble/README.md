# HITEL 일반전화 원격 음성 수신 어댑터 (HFP → BLE → STT)

## 정확한 범위

iPhone의 **기존 일반전화**를 유지하면서, 원격 상대방 음성을 iPhone 앱에 전달할 수 있도록 **별도 ESP32 HFP 헤드셋 역할 장치**를 연결합니다. iPhone Phone 앱이 Classic Bluetooth HFP 음성을 ESP32로 전송하면, ESP32는 해당 하향 PCM을 IMA ADPCM으로 압축해 BLE GATT로 HITEL Call에 보내고, HITEL Call은 실시간 STT를 실행합니다. 일반전화 상대의 음성을 iOS 공개 API로 직접 읽는 것은 아닙니다.

**현재는 소스 구현 단계**입니다. iPhone ARM64 빌드는 확인할 수 있지만 실제 ESP32 보드가 제공되지 않아 HFP 연결·양방향 음성·전화 중 자막·백그라운드 장시간 동작은 아직 실기기 검증되지 않았습니다.

## 준비 장비와 소프트웨어

- Classic Bluetooth 및 BLE를 동시에 지원하는 **기존 ESP32-WROOM-32 / ESP32 DevKit**이 필요합니다. ESP32-S3/C3/C6는 Classic HFP가 없어 사용할 수 없습니다.
- [Espressif ESP-IDF v5.5 HFP HF 예제](https://github.com/espressif/esp-idf/tree/release/v5.5/examples/bluetooth/bluedroid/classic_bt/hfp_hf)를 기반으로 합니다.
- ESP-IDF의 공식 [HFP client API](https://docs.espressif.com/projects/esp-idf/en/v5.5.6/esp32/api-reference/bluetooth/esp_hf_client.html)와 BLE GATT Server API를 사용합니다.

기본 예제를 복제한 후 소스에 있는 patch_reference_hfp.py를 해당 예제의 최상위 경로를 인자로 실행해 주십시오.

    cp -a "$IDF_PATH/examples/bluetooth/bluedroid/classic_bt/hfp_hf" ./hitel-hfp-hf
    python3 hardware/hitel-hfp-ble/patch_reference_hfp.py ./hitel-hfp-hf
    cd ./hitel-hfp-hf
    idf.py set-target esp32
    idf.py menuconfig
    idf.py build
    idf.py -p /dev/ttyUSB0 flash monitor

ESP-IDF에서 BTDM(클래식+BLE), Bluedroid, HFP HF, HCI SCO 오디오를 사용하십시오. 최초 시험에서는 HFP 외부 코덱과 Wideband Speech를 꺼 **8kHz CVSD PCM**으로 지정합니다. BLE SMP bonding도 활성화해야 합니다.

## BLE 오디오 규약

Service UUID: 7D2B1000-9BC7-4E76-BAC0-A2C581C1A301

RX characteristic UUID: 7D2B1001-9BC7-4E76-BAC0-A2C581C1A301

BLE GATT notification은 **90 bytes**: 0=0x48, 1=protocol version 1, 2=IMA ADPCM codec ID 1, 3=flags, 4-5=sequence u16 LE, 6-7=initial PCM predictor i16 LE, 8=step index, 9=reserved, 10-89=4-bit ADPCM 160 samples(low nibble first). 8kHz·16bit mono, 20ms/frame; negotiated ATT MTU 최소 93. 각 패킷은 독립적으로 복호화되며 손실 순번을 계산합니다. BLE GATT 특성에는 암호화된 연결을 요구합니다. 테스트 단계의 Just Works bonding은 MITM 방어가 없으므로 양산 시 인증 페어링이 별도로 필요합니다.

## 실기기 검증 기준

1. ESP32가 iPhone에 HFP 헤드셋으로 페어링되고, 일반전화 오디오 출력 장치로 선택되는지 확인합니다.
2. HITEL Call의 일반전화 자막 화면에서 외부 오디오 수신을 시작합니다.
3. 상대방이 일반전화로 발언할 때 BLE 수신 프레임 수가 **0보다 커져야 합니다**. 데이터가 들어오지 않으면 자막 수신 성공으로 표시하지 않습니다.
4. 실제 상대방 발언으로 STT 자막이 표시되는지 확인합니다.
5. Phone 앱을 전면으로 전환했을 때 BLE 수신과 자막 처리가 중단되지 않는지 측정합니다. CoreBluetooth 백그라운드 상태 복원은 지원하지만 무제한 백그라운드 STT는 보장하지 않습니다.
6. 원음 누출·다른 기기 구독·패킷 손실을 확인합니다.

**중요:** ESP-IDF 기본 HFP 샘플은 수신 음성을 상대방에게 에코로 돌려보냅니다. 이 패치는 처음에는 그 경로를 제거하고 **송신 마이크를 무음 처리한 RX-only 검증 버전**입니다. 따라서 현재 일반전화 상대방에게 본인 목소리를 송신하는 완전한 통화용 어댑터는 아닙니다. TX/TTS 대체 경로를 후속 구현해야 합니다. 실제 하드웨어를 연결하기 전에는 상대방 음성의 실시간 자막 기능이 동작할 수 없습니다.
