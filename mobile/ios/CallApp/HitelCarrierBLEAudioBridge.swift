import Foundation
import Combine
import CoreBluetooth
import Speech
import AVFoundation

/// Carries the REAL remote-party audio only when a separate, user-paired
/// HFP headset accessory supplies BLE notifications. The iPhone Phone app
/// does not expose carrier-call PCM to third-party code.
///
/// Wire contract for characteristic notifications:
///   0: 0x48 ('H')  1: version=1  2: codec=1 (IMA ADPCM 4-bit)
///   3: flags (reserved) 4..5: sequence LE
///   6..7: initial signed PCM16 predictor LE
///   8: initial IMA index [0,88] 9: reserved
///  10..n: 4-bit IMA ADPCM samples, low nibble first, 8 kHz mono.
/// Each packet is self-contained: lost packets do not corrupt the decoder.
/// The bridge decodes and doubles samples to 16k for Speech recognition.
/// An ESP32 HFP adapter must capture the remote/downlink SCO audio and encode
/// this exact format. No such hardware is claimed connected without packets.
final class HitelCarrierBLEAudioBridge: NSObject, ObservableObject,
                                      CBCentralManagerDelegate, CBPeripheralDelegate {
    static let shared = HitelCarrierBLEAudioBridge()

    static let service = CBUUID(string: "7D2B1000-9BC7-4E76-BAC0-A2C581C1A301")
    static let rxAudio = CBUUID(string: "7D2B1001-9BC7-4E76-BAC0-A2C581C1A301")
    static let restoreID = "app.hitel.call.carrier.hfp.ble.central"

    @Published private(set) var status = "외부 통화 오디오 장치 연결 전"
    @Published private(set) var captionStatus = "원격 통화 음성 입력 없음"
    @Published private(set) var isRunning = false
    @Published private(set) var connected = false
    @Published private(set) var receivedFrames = 0
    @Published private(set) var transcript = ""
    @Published private(set) var actualRemoteAudioSeen = false
    @Published private(set) var backgroundEvents = 0
    @Published private(set) var lastPacketTime = ""
    @Published private(set) var droppedFrames = 0

    private var manager: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var audioCharacteristic: CBCharacteristic?
    private var expectedSequence: UInt16?
    private var optedIn = false
    private var speechAllowed = false
    private var recognition: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var pendingPartial = ""
    private var committed = ""
    private var restartRequested = false
    private let captionKey = "hitel.carrier.realRX.captionHistory"
    private let enabledKey = "hitel.carrier.realRX.enabled"

    private override init() {
        super.init()
        committed = UserDefaults.standard.string(forKey: captionKey) ?? ""
        transcript = committed
        optedIn = UserDefaults.standard.bool(forKey: enabledKey)
        isRunning = optedIn
        // Instantiated by the app at launch so CoreBluetooth may restore
        // subscriptions when iOS relaunches it for a permitted BLE event.
        manager = CBCentralManager(
            delegate: self,
            queue: .main,
            options: [
                CBCentralManagerOptionRestoreIdentifierKey: Self.restoreID,
                CBCentralManagerOptionShowPowerAlertKey: true
            ])
        if optedIn {
            // Re-establish STT authorization as well as BLE subscriptions when
            // iOS brings the app back after a qualifying background BLE event.
            requestSpeechPermission()
        }
    }

    func start() {
        optedIn = true
        UserDefaults.standard.set(true, forKey: enabledKey)
        isRunning = true
        status = "HFP 오디오 장치의 BLE 데이터를 검색합니다."
        requestSpeechPermission()
        scanOrResume()
    }

    func stop() {
        optedIn = false
        UserDefaults.standard.set(false, forKey: enabledKey)
        isRunning = false
        manager.stopScan()
        if let peripheral {
            manager.cancelPeripheralConnection(peripheral)
        }
        connected = false
        audioCharacteristic = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        request?.endAudio()
        request = nil
        pendingPartial = ""
        status = "외부 통화 오디오 수신 중지"
        captionStatus = "음성 인식 중지"
    }

    func clearTranscript() {
        committed = ""
        pendingPartial = ""
        transcript = ""
        UserDefaults.standard.removeObject(forKey: captionKey)
    }

    private func requestSpeechPermission() {
        SFSpeechRecognizer.requestAuthorization { [weak self] authorization in
            DispatchQueue.main.async {
                guard let self else { return }
                self.speechAllowed = authorization == .authorized
                if !self.speechAllowed {
                    self.captionStatus = "음성 인식 권한이 없습니다. 설정에서 권한을 허용해야 합니다."
                } else {
                    self.captionStatus = "음성 인식 준비됨 · 외부 오디오 프레임 대기"
                }
            }
        }
    }

    private func scanOrResume() {
        guard optedIn, manager.state == .poweredOn else {
            status = "블루투스 활성화 및 장치 검색 대기"
            return
        }
        if let peripheral, peripheral.state == .connected {
            connected = true
            peripheral.discoverServices([Self.service])
            return
        }
        manager.scanForPeripherals(withServices: [Self.service], options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ])
        status = "HITEL HFP 오디오 어댑터 검색 중"
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            scanOrResume()
        case .poweredOff:
            connected = false
            status = "iPhone 블루투스가 꺼져 있습니다."
        case .unauthorized:
            connected = false
            status = "iPhone 설정에서 HITEL 블루투스 접근을 허용해 주십시오."
        case .unsupported:
            status = "이 기기에서는 BLE가 지원되지 않습니다."
        default:
            status = "블루투스 준비 중"
        }
    }

    func centralManager(_ central: CBCentralManager,
                        willRestoreState dict: [String: Any]) {
        backgroundEvents += 1
        status = "iOS 블루투스 상태 복원"
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral],
           let candidate = peripherals.first {
            peripheral = candidate
            candidate.delegate = self
            if optedIn {
                central.connect(candidate, options: nil)
                if candidate.state == .connected {
                    candidate.discoverServices([Self.service])
                }
            }
        }
    }

    func centralManager(_ central: CBCentralManager,
                        didDiscover candidate: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard optedIn else { return }
        central.stopScan()
        peripheral = candidate
        candidate.delegate = self
        status = "HITEL 오디오 어댑터 발견 · 연결 중"
        central.connect(candidate, options: nil)
    }

    func centralManager(_ central: CBCentralManager,
                        didConnect peripheral: CBPeripheral) {
        guard optedIn else {
            central.cancelPeripheralConnection(peripheral)
            return
        }
        connected = true
        status = "BLE 장치 연결 · 오디오 서비스 검색 중"
        peripheral.delegate = self
        peripheral.discoverServices([Self.service])
    }

    func centralManager(_ central: CBCentralManager,
                        didFailToConnect peripheral: CBPeripheral, error: Error?) {
        connected = false
        status = "BLE 장치 연결 실패: " + (error?.localizedDescription ?? "알 수 없는 오류")
        scanOrResume()
    }

    func centralManager(_ central: CBCentralManager,
                        didDisconnectPeripheral peripheral: CBPeripheral,
                        error: Error?) {
        connected = false
        audioCharacteristic = nil
        expectedSequence = nil
        captionStatus = "통화 오디오 장치 연결 해제"
        status = "BLE 연결 중단 · 재연결 요청"
        if optedIn {
            // Reconnect to known peripheral; iOS can restore this pending
            // request after a qualifying BLE event, but not after force-quit.
            central.connect(peripheral, options: nil)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            status = "BLE 서비스 검색 실패: " + error.localizedDescription
            return
        }
        for service in peripheral.services ?? [] where service.uuid == Self.service {
            peripheral.discoverCharacteristics([Self.rxAudio], for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        if let error {
            status = "BLE 오디오 특성 검색 실패: " + error.localizedDescription
            return
        }
        if let characteristic = service.characteristics?.first(where: { $0.uuid == Self.rxAudio }) {
            audioCharacteristic = characteristic
            peripheral.setNotifyValue(true, for: characteristic)
            status = "HITEL BLE 오디오 구독 요청 · 실제 음성 프레임 대기"
        } else {
            status = "장치가 HITEL 원격 음성 특성을 제공하지 않습니다."
        }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didUpdateNotificationStateFor characteristic: CBCharacteristic,
                    error: Error?) {
        if let error {
            status = "BLE 음성 구독 실패: " + error.localizedDescription
        } else {
            status = characteristic.isNotifying
                ? "외부 오디오 특성 구독됨 · 음성 프레임 대기"
                : "외부 오디오 특성 구독 해제"
        }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard optedIn, characteristic.uuid == Self.rxAudio,
              error == nil, let data = characteristic.value else { return }
        guard let (sequence, samples) = Self.decodePacket(data) else {
            captionStatus = "BLE 음성 프레임 형식 오류"
            return
        }
        if let previous = expectedSequence {
            let diff = UInt16(truncatingIfNeeded: Int(sequence) - Int(previous))
            if diff != 0 && diff < 1000 {
                droppedFrames += Int(diff)
            }
        }
        expectedSequence = sequence &+ 1
        receivedFrames += 1
        actualRemoteAudioSeen = true
        if receivedFrames % 25 == 1 {
            lastPacketTime = Date().formatted(date: .omitted, time: .standard)
            status = "원격 오디오 프레임 실수신 · " + String(receivedFrames) + "개"
        }
        guard speechAllowed else { return }
        ensureRecognition()
        guard let request else { return }
        // 8k HFP audio decoded into 16k PCM mono for SFSpeech.
        let format = AVAudioFormat(commonFormat: .pcmFormatInt16,
                                   sampleRate: 16000, channels: 1, interleaved: false)!
        let count = samples.count * 2
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format,
                                            frameCapacity: AVAudioFrameCount(count)),
              let channel = buffer.int16ChannelData?[0] else { return }
        buffer.frameLength = AVAudioFrameCount(count)
        for index in 0..<samples.count {
            let current = samples[index]
            let following = index + 1 < samples.count ? samples[index + 1] : current
            channel[index * 2] = current
            channel[index * 2 + 1] = Int16((Int32(current) + Int32(following)) / 2)
        }
        request.append(buffer)
    }

    private func ensureRecognition() {
        guard request == nil, recognitionTask == nil else { return }
        guard let speech = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
              speech.isAvailable else {
            captionStatus = "이 iPhone에서 한국어 STT 엔진을 이용할 수 없습니다."
            return
        }
        recognition = speech
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if speech.supportsOnDeviceRecognition {
            req.requiresOnDeviceRecognition = true
        }
        request = req
        pendingPartial = ""
        captionStatus = "외부 통화 음성 STT 시작"
        recognitionTask = speech.recognitionTask(with: req) { [weak self, weak req] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let result {
                    self.pendingPartial = result.bestTranscription.formattedString
                    self.transcript = self.committed + self.pendingPartial
                    self.captionStatus = "외부 장치 음성 → 한국어 자막 표시 중"
                    if result.isFinal {
                        self.finishRecognitionSegment(req)
                    }
                }
                if let error {
                    self.captionStatus = "음성 인식 구간 종료: " + error.localizedDescription
                    self.finishRecognitionSegment(req)
                }
            }
        }
    }

    private func finishRecognitionSegment(_ finishedRequest: SFSpeechAudioBufferRecognitionRequest?) {
        guard request === finishedRequest else { return }
        let latest = pendingPartial.trimmingCharacters(in: .whitespacesAndNewlines)
        if !latest.isEmpty {
            committed += (committed.isEmpty ? "" : "\n") + latest
            if committed.count > 30000 { committed = String(committed.suffix(30000)) }
            UserDefaults.standard.set(committed, forKey: captionKey)
        }
        pendingPartial = ""
        transcript = committed
        request?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        request = nil
        // A subsequent BLE audio frame starts the next segment.
    }

    /// A pure decoder: versioned BLE data from actual HFP RX audio.
    /// Frames whose magic, version, codec or step index are invalid are
    /// rejected rather than showing invented captions.
    static func decodePacket(_ data: Data) -> (UInt16, [Int16])? {
        let bytes = [UInt8](data)
        guard bytes.count >= 11,
              bytes[0] == 0x48, bytes[1] == 1, bytes[2] == 1,
              bytes[8] <= 88 else { return nil }
        let sequence = UInt16(bytes[4]) | UInt16(bytes[5]) << 8
        var predictor = Int(Int16(bitPattern: UInt16(bytes[6]) | UInt16(bytes[7]) << 8))
        var index = Int(bytes[8])
        let stepTable: [Int] = [
            7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,
            34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,
            157,173,190,209,230,253,279,307,337,371,408,449,494,544,
            598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,
            1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,
            4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,
            12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767
        ]
        let indexShift = [-1,-1,-1,-1,2,4,6,8]
        var pcm: [Int16] = []
        pcm.reserveCapacity((bytes.count - 10) * 2)
        for byte in bytes.dropFirst(10) {
            for nibble in [Int(byte & 0x0F), Int(byte >> 4)] {
                let step = stepTable[index]
                var delta = step >> 3
                if (nibble & 1) != 0 { delta += step >> 2 }
                if (nibble & 2) != 0 { delta += step >> 1 }
                if (nibble & 4) != 0 { delta += step }
                predictor += (nibble & 8) != 0 ? -delta : delta
                predictor = max(-32768, min(32767, predictor))
                index = max(0, min(88, index + indexShift[nibble & 7]))
                pcm.append(Int16(predictor))
            }
        }
        return (sequence, pcm)
    }
}
