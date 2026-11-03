import Foundation
import Combine
import CallKit
import AVFoundation
import Speech

/// Device-only evidence model. The app and ReplayKit extension communicate
/// exclusively through an isolated App Group container, never a web service.
@MainActor
final class HitelAudioProbeStore: NSObject, ObservableObject, CXCallObserverDelegate, AVAudioPlayerDelegate {
    static let groupID = "group.app.hitel.carrieraudioprobe"
    static let eventsName = "hitel-probe-events.jsonl"
    static let sampleName = "hitel-probe-optional-5s.wav"

    @Published private(set) var hasSharedContainer = false
    @Published private(set) var callStatus = "일반전화 상태 확인 중"
    @Published private(set) var activeCall = false
    @Published private(set) var isBroadcasting = false
    @Published private(set) var broadcastStatus = "방송 시작 전"
    @Published private(set) var appBuffers = 0
    @Published private(set) var micBuffers = 0
    @Published private(set) var appSilentBuffers = 0
    @Published private(set) var micSilentBuffers = 0
    @Published private(set) var appInvalidBuffers = 0
    @Published private(set) var micInvalidBuffers = 0
    @Published private(set) var appPeak = 0.0
    @Published private(set) var appRMS = 0.0
    @Published private(set) var micPeak = 0.0
    @Published private(set) var micRMS = 0.0
    @Published private(set) var audioFormat = "오디오 포맷 수신 대기"
    @Published private(set) var lastEventAt = ""
    @Published private(set) var recentEvents: [String] = []
    @Published private(set) var sampleSaved = false
    @Published private(set) var sampleDuration = 0.0
    @Published private(set) var notice = ""
    @Published private(set) var recognizedText = ""
    @Published private(set) var transcriptionStatus = "오디오 샘플이 있으면 통화 후 온디바이스 전사를 검사할 수 있습니다."
    @Published private(set) var isRecognizing = false
    @Published private(set) var isPlaying = false
    @Published var saveSample = false
    @Published var sampleDelay = 15
    @Published var phase = "대조 · 무음"

    private let observer = CXCallObserver()
    private var recognizerTask: SFSpeechRecognitionTask?
    private var player: AVAudioPlayer?
    private var runID = ""
    private var lastLoggedCall = ""

    var containerURL: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.groupID) }
    var eventsURL: URL? {
        containerURL?.appendingPathComponent(Self.eventsName)
    }
    var sampleURL: URL? {
        guard let url = containerURL?.appendingPathComponent(Self.sampleName),
              FileManager.default.fileExists(atPath: url.path) else { return nil }
        return url
    }
    var exportURL: URL? {
        guard let url = eventsURL, FileManager.default.fileExists(atPath: url.path) else { return nil }
        return url
    }

    override init() {
        super.init()
        hasSharedContainer = containerURL != nil
        if let settings = UserDefaults(suiteName: Self.groupID) {
            saveSample = settings.bool(forKey: "probe.saveSample")
            sampleDelay = settings.object(forKey: "probe.sampleDelay") == nil
                ? 15 : settings.integer(forKey: "probe.sampleDelay")
            phase = settings.string(forKey: "probe.phase") ?? "대조 · 무음"
            runID = settings.string(forKey: "probe.runID") ?? ""
            if runID.isEmpty {
                runID = UUID().uuidString
                settings.set(runID, forKey: "probe.runID")
            }
        }
        observer.setDelegate(self, queue: .main)
        refreshCall()
        refresh()
    }

    func refreshCall() {
        guard let call = observer.calls.first(where: { !$0.hasEnded }) else {
            activeCall = false
            callStatus = "활성 일반전화 없음"
            if lastLoggedCall != "none" {
                appendMarker("CallKit: 활성 일반전화 없음")
                lastLoggedCall = "none"
            }
            return
        }
        activeCall = true
        let direction = call.isOutgoing ? "발신" : "수신"
        callStatus = direction + (call.isOnHold ? " · 보류" :
                                  call.hasConnected ? " · 연결됨" : " · 연결 대기")
        let key = call.uuid.uuidString + ":" + callStatus
        if lastLoggedCall != key {
            appendMarker("CallKit: " + callStatus)
            lastLoggedCall = key
        }
    }

    nonisolated func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        Task { @MainActor in refreshCall() }
    }

    func configureSample(_ enabled: Bool) {
        saveSample = enabled
        UserDefaults(suiteName: Self.groupID)?.set(enabled, forKey: "probe.saveSample")
        appendMarker(enabled ? "5초 오디오 보관 동의 ON" : "5초 오디오 보관 OFF")
    }

    func configureDelay(_ seconds: Int) {
        sampleDelay = seconds
        UserDefaults(suiteName: Self.groupID)?.set(seconds, forKey: "probe.sampleDelay")
        appendMarker("원음 수집 지연: " + String(seconds) + "초")
    }

    func setPhase(_ name: String) {
        phase = name
        UserDefaults(suiteName: Self.groupID)?.set(name, forKey: "probe.phase")
        appendMarker("검사 구간: " + name)
        refresh()
    }

    func startFreshRun() {
        guard !isBroadcasting else {
            notice = "방송이 작동 중입니다. iOS 방송을 먼저 종료하신 후 새 검사를 시작하십시오."
            return
        }
        guard let directory = containerURL else {
            notice = "App Group 저장소가 없습니다. 서명 시 두 앱 대상의 App Groups 권한을 확인해 주십시오."
            return
        }
        runID = UUID().uuidString
        UserDefaults(suiteName: Self.groupID)?.set(runID, forKey: "probe.runID")
        for name in [Self.eventsName, Self.sampleName] {
            try? FileManager.default.removeItem(at: directory.appendingPathComponent(name))
        }
        recognizedText = ""
        transcriptionStatus = "새 측정 준비 완료"
        appendMarker("새 실기기 검사 시작 · " + phase)
        refresh()
    }

    func appendMarker(_ label: String) {
        guard let url = eventsURL else { return }
        let event: [String: Any] = [
            "type": "user_marker", "source": "host",
            "label": label, "at": ISO8601DateFormatter().string(from: Date()),
            "runID": runID
        ]
        guard var data = try? JSONSerialization.data(withJSONObject: event, options: [.sortedKeys]) else { return }
        data.append(0x0A)
        if !FileManager.default.fileExists(atPath: url.path) {
            _ = FileManager.default.createFile(atPath: url.path, contents: nil)
        }
        guard let file = try? FileHandle(forWritingTo: url) else { return }
        defer { try? file.close() }
        _ = try? file.seekToEnd()
        try? file.write(contentsOf: data)
    }

    func refresh() {
        hasSharedContainer = containerURL != nil
        guard let url = eventsURL, let raw = try? String(contentsOf: url, encoding: .utf8) else {
            broadcastStatus = hasSharedContainer ? "시작 전 · 방송 기록 없음" : "App Groups 권한 없음"
            appBuffers = 0; micBuffers = 0
            appPeak = 0; appRMS = 0; micPeak = 0; micRMS = 0
            sampleSaved = false
            return
        }
        var appPower = 0.0, micPower = 0.0
        var appSamples = 0, micSamples = 0
        var latestBroadcastAt = Date.distantPast
        var lastStatus = ""
        var rows: [String] = []
        var currentApp = 0, currentMic = 0
        var appSilent = 0, micSilent = 0, appInvalid = 0, micInvalid = 0
        var apeak = 0.0, mpeak = 0.0
        var lastFormat = "오디오 포맷 수신 대기"
        var saved = false, savedDuration = 0.0
        var lastAt = ""

        for row in raw.split(separator: "\n") {
            guard let bytes = String(row).data(using: .utf8),
                  let item = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any],
                  item["runID"] as? String == runID else { continue }
            let type = item["type"] as? String ?? ""
            let source = item["source"] as? String ?? ""
            let at = item["at"] as? String ?? ""
            lastAt = at
            if type == "audio_window" {
                let b = item["buffers"] as? Int ?? 0
                let invalid = item["invalidBuffers"] as? Int ?? 0
                let quiet = item["silentBuffers"] as? Int ?? 0
                let n = item["samples"] as? Int ?? 0
                let rms = item["rms"] as? Double ?? 0
                let peak = item["peak"] as? Double ?? 0
                if source == "audioApp" {
                    currentApp += b; appSilent += quiet; appInvalid += invalid
                    appSamples += n; appPower += rms * rms * Double(n); apeak = max(apeak, peak)
                    lastFormat = "audioApp · " + String(item["sampleRate"] as? Double ?? 0) +
                        "Hz · " + String(item["channels"] as? Int ?? 0) + "ch · " +
                        String(item["bits"] as? Int ?? 0) + "bit · " +
                        ((item["bigEndian"] as? Bool ?? false) ? "BE" : "LE")
                } else if source == "audioMic" {
                    currentMic += b; micSilent += quiet; micInvalid += invalid
                    micSamples += n; micPower += rms * rms * Double(n); mpeak = max(mpeak, peak)
                }
            } else if type == "broadcast_started" ||
                        type == "broadcast_finished" ||
                        type == "broadcast_paused" ||
                        type == "broadcast_resumed" {
                lastStatus = type
                if let date = ISO8601DateFormatter().date(from: at) { latestBroadcastAt = date }
            } else if type == "sample_saved" {
                saved = true
                savedDuration = item["durationSeconds"] as? Double ?? 0
            }
            var text = "[" + at + "] " + type
            if type == "audio_window" {
                text += " " + source + " · RMS=" +
                    String(format: "%.5f", item["rms"] as? Double ?? 0) +
                    " · peak=" + String(format: "%.4f", item["peak"] as? Double ?? 0)
            } else if let label = item["label"] as? String {
                text += " · " + label
            } else if let error = item["error"] as? String {
                text += " · " + error
            }
            rows.append(text)
        }
        recentEvents = Array(rows.suffix(35).reversed())
        appBuffers = currentApp; micBuffers = currentMic
        appSilentBuffers = appSilent; micSilentBuffers = micSilent
        appInvalidBuffers = appInvalid; micInvalidBuffers = micInvalid
        appPeak = apeak; micPeak = mpeak
        appRMS = appSamples > 0 ? sqrt(appPower / Double(appSamples)) : 0
        micRMS = micSamples > 0 ? sqrt(micPower / Double(micSamples)) : 0
        audioFormat = lastFormat
        lastEventAt = lastAt
        sampleSaved = saved && sampleURL != nil
        sampleDuration = savedDuration
        let age = Date().timeIntervalSince(latestBroadcastAt)
        isBroadcasting = lastStatus != "broadcast_finished" &&
                         lastStatus != "" && age < 120 &&
                         (lastAt.isEmpty ? false : (ISO8601DateFormatter().date(from: lastAt)
                           .map { Date().timeIntervalSince($0) < 8 } ?? false))
        switch lastStatus {
        case "broadcast_started", "broadcast_resumed":
            broadcastStatus = isBroadcasting ? "방송 실행 중 · 버퍼 수신 관찰" : "방송 중단 또는 연결 기록 갱신 대기"
        case "broadcast_paused": broadcastStatus = "방송 일시정지"
        case "broadcast_finished": broadcastStatus = "방송 종료 · 분석 가능"
        default: broadcastStatus = "측정 기록 대기"
        }
    }

    func playSavedSample() {
        guard !activeCall else {
            notice = "통화 중에는 재생하지 않습니다. 통화 종료 후 검사해 주십시오."
            return
        }
        guard let url = sampleURL else {
            notice = "저장된 WAV 샘플이 없습니다."
            return
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            let player = try AVAudioPlayer(contentsOf: url)
            self.player = player
            player.delegate = self
            isPlaying = player.play()
        } catch { notice = "오디오 재생 실패: " + error.localizedDescription }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in isPlaying = false }
    }

    func stopPlayback() {
        player?.stop()
        isPlaying = false
    }

    func transcribeSavedSample() {
        guard !activeCall else {
            transcriptionStatus = "통화 중에는 실행하지 않습니다."
            return
        }
        guard let url = sampleURL else {
            transcriptionStatus = "사용자께서 명시적으로 저장을 허용한 실제 WAV 샘플이 없습니다."
            return
        }
        SFSpeechRecognizer.requestAuthorization { [weak self] auth in
            Task { @MainActor in
                guard let self else { return }
                guard auth == .authorized else {
                    self.transcriptionStatus = "음성 인식 권한이 없습니다."
                    return
                }
                guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
                      recognizer.isAvailable,
                      recognizer.supportsOnDeviceRecognition else {
                    self.transcriptionStatus = "한국어 온디바이스 STT가 이 기기에서 지원되지 않습니다."
                    return
                }
                self.recognizerTask?.cancel()
                self.recognizedText = ""
                let request = SFSpeechURLRecognitionRequest(url: url)
                request.requiresOnDeviceRecognition = true
                request.shouldReportPartialResults = true
                self.isRecognizing = true
                self.transcriptionStatus = "저장된 실제 샘플을 iPhone 내에서 한국어로 전사 중"
                self.recognizerTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                    Task { @MainActor in
                        guard let self else { return }
                        if let result {
                            self.recognizedText = result.bestTranscription.formattedString
                            if result.isFinal {
                                self.isRecognizing = false
                                self.transcriptionStatus = "실제 샘플의 온디바이스 전사 완료"
                                self.recognizerTask = nil
                            }
                        }
                        if let error {
                            self.isRecognizing = false
                            self.transcriptionStatus = "음성 인식 오류: " + error.localizedDescription
                            self.recognizerTask = nil
                        }
                    }
                }
            }
        }
    }

    /// Deterministic positive control: a 440 Hz, 3 s mono WAV from this
    /// application's own AVAudioPlayer; never run it during a carrier call.
    func playReferenceTone() {
        guard !activeCall else {
            notice = "일반전화 통화 중에는 시험음을 재생하지 않습니다."
            return
        }
        let rate = 44_100
        let duration = 3
        let frames = rate * duration
        var pcm = Data()
        for i in 0..<frames {
            let time = Double(i) / Double(rate)
            let value = Int16(sin(2 * .pi * 440 * time) * 9000)
            let raw = UInt16(bitPattern: value)
            pcm.append(UInt8(truncatingIfNeeded: raw))
            pcm.append(UInt8(truncatingIfNeeded: raw >> 8))
        }
        var wav = Data()
        func put16(_ value: UInt16) {
            wav.append(UInt8(truncatingIfNeeded: value))
            wav.append(UInt8(truncatingIfNeeded: value >> 8))
        }
        func put32(_ value: UInt32) {
            wav.append(UInt8(truncatingIfNeeded: value))
            wav.append(UInt8(truncatingIfNeeded: value >> 8))
            wav.append(UInt8(truncatingIfNeeded: value >> 16))
            wav.append(UInt8(truncatingIfNeeded: value >> 24))
        }
        wav.append(contentsOf: Array("RIFF".utf8))
        put32(UInt32(pcm.count + 36))
        wav.append(contentsOf: Array("WAVEfmt ".utf8))
        put32(16); put16(1); put16(1); put32(UInt32(rate))
        put32(UInt32(rate * 2)); put16(2); put16(16)
        wav.append(contentsOf: Array("data".utf8))
        put32(UInt32(pcm.count)); wav.append(pcm)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("hitel-440hz-positive-control.wav")
        do {
            try wav.write(to: url, options: [.atomic])
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            let player = try AVAudioPlayer(contentsOf: url)
            self.player = player
            player.delegate = self
            isPlaying = player.play()
            appendMarker("440Hz 양성 대조 시험음 3초 재생")
            notice = isPlaying ? "440Hz 양성 대조 시험음 재생 중" : "시험음 재생을 시작하지 못했습니다."
        } catch {
            notice = "시험음 재생 실패: " + error.localizedDescription
        }
    }

}
