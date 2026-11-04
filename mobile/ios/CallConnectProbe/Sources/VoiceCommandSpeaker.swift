import AVFoundation
import Combine
import Foundation

/// Manual positive control only. Does not record or access call audio.
/// iOS may interrupt local speech while a carrier call is active.
final class VoiceCommandSpeaker: NSObject, ObservableObject, AVSpeechSynthesizerDelegate {
    @Published private(set) var status = "재생 전"
    private let synthesizer = AVSpeechSynthesizer()

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func play() {
        guard !synthesizer.isSpeaking else { return }
        status = "음성 명령 시험 재생 요청"
        ProbeEvidence.append("사용자가 'Start Recording' 시험음 재생 요청")
        let utterance = AVSpeechUtterance(string: "Start Recording")
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.43
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        status = "재생 중단"
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.status = "음성 합성 시작" }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        DispatchQueue.main.async {
            self.status = "재생 완료 (Voice Control 인식 여부는 미확인)"
            ProbeEvidence.append("음성 합성 종료 콜백")
        }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        DispatchQueue.main.async { self.status = "재생 취소" }
    }
}
