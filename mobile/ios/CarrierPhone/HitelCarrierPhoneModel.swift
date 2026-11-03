import Foundation
import Combine
import CallKit
import Speech
import AVFoundation
import UIKit

/// Carrier Phone features belong exclusively to this independent iOS target.
/// No WebRTC, embedded browser, server, screen recording, or video SDK is used.
///
/// A stock iPhone does not expose the Phone app's ongoing cellular-call audio
/// to this third-party app. Consequently imported recordings are transcribed
/// only AFTER they are shared from the native Phone/Notes/Files workflow.
final class HitelCarrierPhoneModel: NSObject, ObservableObject,
                                    CXCallObserverDelegate, AVSpeechSynthesizerDelegate {
    @Published private(set) var callStatus = "현재 일반전화 통화 확인 중"
    @Published private(set) var hasCall = false
    @Published private(set) var callConnected = false
    @Published private(set) var isOutgoing = false
    @Published private(set) var isOnHold = false
    @Published private(set) var recognitionStatus = "저장된 통화 녹음 파일을 불러오면 이 iPhone에서 음성 인식을 진행합니다."
    @Published private(set) var transcript = ""
    @Published private(set) var transcriptionActive = false
    @Published private(set) var isSpeaking = false
    @Published private(set) var injectionStatus = "통화 중 합성 음성 추가: 확인 전"
    @Published private(set) var injectionRequested = false
    @Published private(set) var lastError = ""

    private let callObserver = CXCallObserver()
    private let synthesizer = AVSpeechSynthesizer()
    private var recognitionTask: SFSpeechRecognitionTask?
    private var tempRecording: URL?
    private var currentCallID: UUID?
    private var locale = Locale(identifier: "ko-KR")

    override init() {
        super.init()
        callObserver.setDelegate(self, queue: .main)
        synthesizer.delegate = self
        refreshCallStatus()
        refreshInjectionStatus()
    }

    func refreshCallStatus() {
        guard let call = callObserver.calls.first(where: { !$0.hasEnded }) else {
            currentCallID = nil
            hasCall = false
            callConnected = false
            isOutgoing = false
            isOnHold = false
            callStatus = "현재 관찰되는 일반전화 통화가 없습니다."
            return
        }
        currentCallID = call.uuid
        hasCall = true
        callConnected = call.hasConnected
        isOutgoing = call.isOutgoing
        isOnHold = call.isOnHold
        let direction = call.isOutgoing ? "발신" : "수신"
        callStatus = direction + (call.isOnHold ? " · 보류" :
                                  call.hasConnected ? " · 통화 연결" : " · 연결 대기")
    }

    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        DispatchQueue.main.async { [weak self] in self?.refreshCallStatus() }
    }

    func openCarrierDialer(_ rawNumber: String) {
        let sanitized = String(rawNumber.unicodeScalars.filter {
            CharacterSet(charactersIn: "+0123456789").contains($0)
        })
        guard sanitized.count >= 3 && sanitized.count <= 24,
              let url = URL(string: "tel:" + sanitized) else {
            lastError = "전화번호를 확인해 주십시오."
            return
        }
        lastError = ""
        UIApplication.shared.open(url, options: [:]) { [weak self] success in
            DispatchQueue.main.async {
                guard let self else { return }
                if !success { self.lastError = "iPhone 기본 전화 앱을 열지 못했습니다." }
            }
        }
    }

    func recognizeStoredRecording(_ selectedURL: URL, languageCode: String) {
        let scoped = selectedURL.startAccessingSecurityScopedResource()
        defer { if scoped { selectedURL.stopAccessingSecurityScopedResource() } }

        let name = UUID().uuidString + "-" + selectedURL.lastPathComponent
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        do {
            try FileManager.default.copyItem(at: selectedURL, to: destination)
        } catch {
            recognitionStatus = "녹음 파일을 읽지 못했습니다: " + error.localizedDescription
            return
        }
        cancelRecognition()
        tempRecording = destination
        recognitionStatus = "iPhone 음성 인식 사용 권한 확인 중"
        SFSpeechRecognizer.requestAuthorization { [weak self] permission in
            DispatchQueue.main.async {
                guard let self else { return }
                guard permission == .authorized else {
                    self.recognitionStatus = "설정에서 음성 인식 권한을 허용해 주십시오."
                    self.cleanRecording()
                    return
                }
                self.startFileRecognition(file: destination, languageCode: languageCode)
            }
        }
    }

    private func startFileRecognition(file: URL, languageCode: String) {
        locale = Locale(identifier: languageCode)
        guard let recognizer = SFSpeechRecognizer(locale: locale),
              recognizer.isAvailable else {
            recognitionStatus = "선택한 언어의 음성 인식 서비스를 사용할 수 없습니다."
            cleanRecording()
            return
        }
        let request = SFSpeechURLRecognitionRequest(url: file)
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        recognitionStatus = "가져온 녹음 파일을 음성 인식 중"
        transcriptionActive = true
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                    if result.isFinal {
                        self.transcriptionActive = false
                        self.recognitionStatus = "저장된 녹음 파일의 음성 인식 완료"
                        self.cleanRecording()
                        self.recognitionTask = nil
                    }
                }
                if let error {
                    self.transcriptionActive = false
                    self.recognitionStatus = "음성 인식 실패: " + error.localizedDescription
                    self.cleanRecording()
                    self.recognitionTask = nil
                }
            }
        }
    }

    func cancelRecognition() {
        recognitionTask?.cancel()
        recognitionTask = nil
        transcriptionActive = false
        cleanRecording()
        recognitionStatus = "음성 인식 중지"
    }

    private func cleanRecording() {
        if let tempRecording {
            try? FileManager.default.removeItem(at: tempRecording)
        }
        tempRecording = nil
    }

    func clearTranscript() { transcript = "" }

    func speak(_ text: String, voice: String) {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            lastError = "읽어 줄 문장을 입력해 주십시오."
            return
        }
        stopSpeaking()
        let utterance = AVSpeechUtterance(string: normalized)
        utterance.voice = AVSpeechSynthesisVoice(language: voice)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        lastError = ""
        synthesizer.speak(utterance)
        isSpeaking = true
    }

    func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in self?.isSpeaking = false }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { [weak self] in self?.isSpeaking = false }
    }

    func refreshInjectionStatus() {
        guard #available(iOS 18.2, *) else {
            injectionStatus = "합성 음성 통화 추가는 iOS 18.2 이상에서만 지원됩니다."
            return
        }
        let permission = AVAudioApplication.shared.microphoneInjectionPermission
        switch permission {
        case .granted:
            let available = AVAudioSession.sharedInstance().isMicrophoneInjectionAvailable
            injectionStatus = available
                ? "통화 음성 추가 가능 · 실제 전달은 통화 중 실기기 확인 필요"
                : "권한 허용 · 현재 통화 음성 추가 기능 사용 불가"
        case .denied:
            injectionStatus = "음성 추가 권한이 거부되었습니다."
        case .serviceDisabled:
            injectionStatus = "설정의 손쉬운 사용에서 통화 음성 추가를 허용해 주십시오."
        case .undetermined:
            injectionStatus = "통화 음성 추가 권한을 요청하지 않았습니다."
        @unknown default:
            injectionStatus = "통화 음성 추가 상태 확인 불가"
        }
    }

    func requestInjection() {
        guard #available(iOS 18.2, *) else {
            refreshInjectionStatus()
            return
        }
        Task { @MainActor [weak self] in
            guard let self else { return }
            let result = await AVAudioApplication.requestMicrophoneInjectionPermission()
            guard result == .granted else {
                self.injectionRequested = false
                self.refreshInjectionStatus()
                return
            }
            do {
                try AVAudioSession.sharedInstance().setPreferredMicrophoneInjectionMode(.spokenAudio)
                self.injectionRequested = true
            } catch {
                self.injectionStatus = "음성 추가 활성화 실패: " + error.localizedDescription
                self.injectionRequested = false
                return
            }
            self.refreshInjectionStatus()
        }
    }

    func disableInjection() {
        guard #available(iOS 18.2, *) else { return }
        do {
            try AVAudioSession.sharedInstance().setPreferredMicrophoneInjectionMode(.none)
            injectionRequested = false
            refreshInjectionStatus()
        } catch {
            injectionStatus = "통화 음성 추가 해제 실패: " + error.localizedDescription
        }
    }
}
