import SwiftUI
import AVFoundation
import Speech
import UniformTypeIdentifiers

/// HITEL's native RX/TX speech-processing foundation.
///
/// RX: accepts user-supplied call recordings now; a future authorized audio
/// provider can feed the same recognition pipeline. iOS does not expose the
/// other party's live cellular-call PCM through public third-party APIs.
/// TX: microphone dictation -> text -> synthesized voice. iOS 18.2+ permits
/// adding that voice to an active Phone call with consent; it does not replace
/// or suppress the cellular microphone. Never present injection as replacement.
@MainActor
final class HitelNativeAudioProcessing: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    @Published var incomingText = ""
    @Published var outgoingText = ""
    @Published var incomingStatus = "수신 대기 · 전화 녹음 파일을 선택해 음성 인식을 시험할 수 있습니다."
    @Published var outgoingStatus = "송신 대기 · 내 마이크 음성 인식 또는 직접 입력 후 합성 음성을 재생할 수 있습니다."
    @Published var injectionStatus = "통화 음성 추가 권한 미확인"
    @Published var injectionEnabled = false
    @Published var isDictating = false
    @Published var isSpeaking = false
    @Published var outputLanguage = "ko-KR"
    @Published var incomingLanguage = "ko-KR"

    private let synthesizer = AVSpeechSynthesizer()
    private let captureEngine = AVAudioEngine()
    private var captureRequest: SFSpeechAudioBufferRecognitionRequest?
    private var captureTask: SFSpeechRecognitionTask?
    private var recordingTask: SFSpeechRecognitionTask?
    private var tapInstalled = false
    private var currentSpeechIsIncoming = false

    override init() {
        super.init()
        synthesizer.delegate = self
        refreshInjectionStatus()
    }

    var canRequestInjection: Bool {
        if #available(iOS 18.2, *) { return true }
        return false
    }

    func refreshInjectionStatus() {
        guard #available(iOS 18.2, *) else {
            injectionStatus = "iOS 18.2 이상에서 통화 음성 추가를 지원합니다."
            injectionEnabled = false
            return
        }
        let permission = AVAudioApplication.shared.microphoneInjectionPermission
        switch permission {
        case .granted:
            let available = AVAudioSession.sharedInstance().isMicrophoneInjectionAvailable
            injectionStatus = injectionEnabled
                ? (available ? "통화 음성 추가 모드 활성 · 실제 상대방 청취는 실기기로 확인해야 합니다." : "추가 모드 설정됨 · 현재 통화 오디오 입력이 활성 상태인지 확인되지 않았습니다.")
                : "통화 음성 추가 권한 허용 · 현재 비활성"
        case .denied:
            injectionEnabled = false
            injectionStatus = "통화 음성 추가 권한 거부 · iPhone 손쉬운 사용 설정을 확인하십시오."
        case .serviceDisabled:
            injectionEnabled = false
            injectionStatus = "설정 → 손쉬운 사용 → 오디오 및 시각 효과 → 통화에 오디오 추가를 켜야 합니다."
        case .undetermined:
            injectionStatus = "통화 음성 추가 권한을 요청하지 않았습니다."
        @unknown default:
            injectionStatus = "통화 음성 추가 권한 상태를 확인할 수 없습니다."
        }
    }

    func enableCallAudioInjection() {
        guard #available(iOS 18.2, *) else {
            refreshInjectionStatus()
            return
        }
        Task {
            let permission = await AVAudioApplication.requestMicrophoneInjectionPermission()
            guard permission == .granted else {
                injectionEnabled = false
                refreshInjectionStatus()
                return
            }
            do {
                try AVAudioSession.sharedInstance().setPreferredMicrophoneInjectionMode(.spokenAudio)
                injectionEnabled = true
                refreshInjectionStatus()
            } catch {
                injectionEnabled = false
                injectionStatus = "통화 음성 추가 활성화 실패: \(error.localizedDescription)"
            }
        }
    }

    func disableCallAudioInjection() {
        guard #available(iOS 18.2, *) else { refreshInjectionStatus(); return }
        do {
            try AVAudioSession.sharedInstance().setPreferredMicrophoneInjectionMode(.none)
            injectionEnabled = false
            refreshInjectionStatus()
        } catch {
            injectionStatus = "음성 추가 해제 실패: \(error.localizedDescription)"
        }
    }

    /// Text originating from an RX audio provider can be passed directly
    /// through this same speech synthesis path without changing the UI.
    func receiveRecognizedText(_ text: String) {
        incomingText = text
        incomingStatus = "수신 텍스트 준비됨 · 음성으로 재생할 수 있습니다."
    }

    func synthesizeIncoming() {
        let text = incomingText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { incomingStatus = "수신 텍스트 또는 녹음 파일이 필요합니다."; return }
        speak(text: text, language: incomingLanguage, incoming: true)
        incomingStatus = "변환된 수신 음성을 로컬 재생 중입니다. 실시간 일반전화 수신 PCM 연결은 미지원입니다."
    }

    func synthesizeOutgoing() {
        let text = outgoingText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { outgoingStatus = "송신할 텍스트가 필요합니다."; return }
        if isDictating { stopDictation() }
        speak(text: text, language: outputLanguage, incoming: false)
        if #available(iOS 18.2, *), injectionEnabled && AVAudioSession.sharedInstance().isMicrophoneInjectionAvailable {
            outgoingStatus = "합성 음성 재생 중 · 통화 음성 추가 모드 활성(원음 차단/대체 기능 아님)"
        } else {
            outgoingStatus = "합성 음성 로컬 재생 중 · 통화 송신 연결은 확인되지 않았습니다."
        }
    }

    func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }

    private func speak(text: String, language: String, incoming: Bool) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        currentSpeechIsIncoming = incoming
        synthesizer.speak(utterance)
        isSpeaking = true
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }

    /// Imports an existing Phone recording with the user's explicit selection.
    /// This is not live interception of a cellular call.
    func importIncomingRecording(_ file: URL) {
        let hasAccess = file.startAccessingSecurityScopedResource()
        defer { if hasAccess { file.stopAccessingSecurityScopedResource() } }
        let copy = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + "-" + file.lastPathComponent)
        do {
            try FileManager.default.copyItem(at: file, to: copy)
        } catch {
            incomingStatus = "수신 녹음 파일 읽기 실패: \(error.localizedDescription)"
            return
        }
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self else { return }
                guard status == .authorized else {
                    self.incomingStatus = "음성 인식 권한이 허용되지 않았습니다."
                    try? FileManager.default.removeItem(at: copy)
                    return
                }
                self.recognizeFile(copy)
            }
        }
    }

    private func recognizeFile(_ file: URL) {
        recordingTask?.cancel()
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
              recognizer.isAvailable else {
            incomingStatus = "한국어 음성 인식 서비스를 사용할 수 없습니다."
            try? FileManager.default.removeItem(at: file)
            return
        }
        incomingStatus = "선택한 녹음 파일에서 한국어 음성 인식 중…"
        let request = SFSpeechURLRecognitionRequest(url: file)
        request.shouldReportPartialResults = true
        recordingTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.incomingText = result.bestTranscription.formattedString
                    if result.isFinal {
                        self.incomingStatus = "녹음 파일 음성 인식 완료 · 수신 TTS로 재생할 수 있습니다."
                    }
                }
                if let error {
                    self.incomingStatus = "녹음 파일 음성 인식 실패: \(error.localizedDescription)"
                }
                if error != nil || result?.isFinal == true {
                    self.recordingTask = nil
                    try? FileManager.default.removeItem(at: file)
                }
            }
        }
    }

    /// Microphone transcription is an explicit test source. On an active
    /// cellular call do not commandeer AVAudioSession away from Phone.
    func startDictation() {
        guard !isDictating else { return }
        if #available(iOS 18.2, *), AVAudioSession.sharedInstance().isMicrophoneInjectionAvailable {
            outgoingStatus = "일반전화 중 앱이 마이크 입력을 독점하지 않도록 음성 인식 시작을 차단했습니다. 텍스트를 직접 입력해 TTS로 전송하십시오."
            return
        }
        SFSpeechRecognizer.requestAuthorization { [weak self] authorization in
            guard authorization == .authorized else {
                Task { @MainActor in self?.outgoingStatus = "음성 인식 접근 권한이 없습니다." }
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
                Task { @MainActor in
                    guard let self else { return }
                    guard granted else {
                        self.outgoingStatus = "마이크 접근 권한이 없습니다."
                        return
                    }
                    self.startMicrophoneCapture()
                }
            }
        }
    }

    private func startMicrophoneCapture() {
        guard !captureEngine.isRunning else { return }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
              recognizer.isAvailable else {
            outgoingStatus = "한국어 음성 인식을 사용할 수 없습니다."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            captureRequest = request
            let input = captureEngine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }
            tapInstalled = true
            captureEngine.prepare()
            try captureEngine.start()
            isDictating = true
            outgoingStatus = "내 마이크 음성 인식 중 · 일반전화 원음 차단 기능은 아닙니다."
            captureTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let result { self.outgoingText = result.bestTranscription.formattedString }
                    if let error {
                        self.outgoingStatus = "마이크 음성 인식 실패: \(error.localizedDescription)"
                        self.stopDictation()
                    }
                }
            }
        } catch {
            outgoingStatus = "마이크 음성 인식 시작 실패: \(error.localizedDescription)"
            stopDictation()
        }
    }

    func stopDictation() {
        if captureEngine.isRunning { captureEngine.stop() }
        if tapInstalled {
            captureEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        captureRequest?.endAudio()
        captureTask?.cancel()
        captureTask = nil
        captureRequest = nil
        if isDictating {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            outgoingStatus = "내 음성 인식 종료 · 합성 음성으로 재생할 수 있습니다."
        }
        isDictating = false
    }

    func shutdown() {
        stopDictation()
        stopSpeaking()
        disableCallAudioInjection()
        recordingTask?.cancel()
        recordingTask = nil
    }
}

struct HitelNativeAudioProcessingPanel: View {
    @StateObject private var audio = HitelNativeAudioProcessing()
    @State private var showRecordingPicker = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HITEL 네이티브 음성 처리 · RX / TX")
                .font(.headline)
            Text("일반전화 유지 · 음성 처리 엔진. 현재 iOS에서는 통화 상대방의 실시간 원음 추출과 내 원음의 완전 차단은 연결되지 않았습니다.")
                .font(.caption).foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 8) {
                Label("RX · 수신 음성 → STT → TTS", systemImage: "ear")
                    .font(.subheadline.bold())
                Button("기존 통화 녹음 파일 가져오기") { showRecordingPicker = true }
                    .buttonStyle(.bordered)
                TextField("수신 텍스트 (파일 인식 결과 또는 직접 입력)", text: $audio.incomingText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                HStack {
                    Button("수신 음성 재합성·재생") { audio.synthesizeIncoming() }
                        .buttonStyle(.bordered)
                    if audio.isSpeaking {
                        Button("재생 중지") { audio.stopSpeaking() }.buttonStyle(.bordered)
                    }
                }
                Text(audio.incomingStatus).font(.caption2).foregroundStyle(.secondary)
            }
            Divider()
            VStack(alignment: .leading, spacing: 8) {
                Label("TX · 내 음성 → STT → TTS", systemImage: "waveform")
                    .font(.subheadline.bold())
                Button(audio.isDictating ? "마이크 음성 인식 종료" : "내 마이크 음성 인식") {
                    if audio.isDictating { audio.stopDictation() }
                    else { audio.startDictation() }
                }.buttonStyle(.bordered)
                TextField("합성해 말할 문장", text: $audio.outgoingText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                Picker("TTS 언어", selection: $audio.outputLanguage) {
                    Text("한국어").tag("ko-KR")
                    Text("프랑스어").tag("fr-FR")
                    Text("영어").tag("en-US")
                }.pickerStyle(.segmented)
                Text("언어 선택은 해당 언어 TTS 목소리를 선택합니다. 번역 엔진은 아직 연결되지 않았습니다.")
                    .font(.caption2).foregroundStyle(.secondary)
                Button("송신 음성 재합성·재생") { audio.synthesizeOutgoing() }
                    .buttonStyle(.borderedProminent)
                Text(audio.outgoingStatus).font(.caption2).foregroundStyle(.secondary)
            }
            Divider()
            VStack(alignment: .leading, spacing: 7) {
                Label("일반전화에 합성 음성 추가 · iOS 18.2+", systemImage: "phone.arrow.up.right")
                    .font(.subheadline.bold())
                HStack {
                    Button(audio.injectionEnabled ? "통화 음성 추가 해제" : "통화 음성 추가 권한·활성화") {
                        if audio.injectionEnabled { audio.disableCallAudioInjection() }
                        else { audio.enableCallAudioInjection() }
                    }.buttonStyle(.bordered)
                        .disabled(!audio.canRequestInjection)
                    Button("상태 확인") { audio.refreshInjectionStatus() }
                        .buttonStyle(.bordered)
                }
                Text(audio.injectionStatus).font(.caption2).foregroundStyle(.secondary)
                Text("Apple 음성 추가는 마이크 원음과 합성 음성을 혼합합니다. 원음 완전 차단·대체, 실시간 PSTN 수신 오디오 캡처는 구현되지 않았습니다.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .fileImporter(
            isPresented: $showRecordingPicker,
            allowedContentTypes: [.audio],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let files):
                if let file = files.first { audio.importIncomingRecording(file) }
            case .failure(let error):
                audio.incomingStatus = "파일 선택 실패: \(error.localizedDescription)"
            }
        }
        .onDisappear { audio.shutdown() }
    }
}
