import AVFoundation
import Foundation
import Combine

/// Generates the spoken command as a real audio file in Documents.
/// No microphone or third-party API is involved; this is offline system TTS.
final class VoiceCommandAudioStore: NSObject, ObservableObject {
    static let phrase = "Start Recording"
    static var commandURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("HITEL-Start-Recording.wav")
    }

    @Published private(set) var ready = false
    @Published private(set) var busy = false
    @Published private(set) var status = "음성 파일 확인 중"
    private let synthesizer = AVSpeechSynthesizer()
    private var player: AVAudioPlayer?

    override init() {
        super.init()
        checkExisting()
    }

    func checkExisting() {
        let url = Self.commandURL
        let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue ?? 0
        ready = size > 4096
        if ready { status = "영어 명령 음성이 iPhone에 저장되어 있습니다." }
        else { status = "명령 음성을 만들어 주세요." }
    }

    func generateIfNeeded() {
        if !ready && !busy { generate() }
    }

    func generate() {
        guard !busy else { return }
        busy = true
        ready = false
        status = "아이폰에서 영어 음성을 만드는 중입니다."
        player = nil
        let url = Self.commandURL
        try? FileManager.default.removeItem(at: url)
        let utterance = AVSpeechUtterance(string: Self.phrase)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.43
        utterance.volume = 1.0
        var outputFile: AVAudioFile?
        var framesWritten: AVAudioFramePosition = 0
        var lastError: String?
        synthesizer.write(utterance) { [weak self] buffer in
            guard let pcm = buffer as? AVAudioPCMBuffer else { return }
            if pcm.frameLength == 0 {
                outputFile = nil
                DispatchQueue.main.async {
                    guard let self = self else { return }
                    self.busy = false
                    self.checkExisting()
                    if !self.ready {
                        self.status = "음성 파일 생성 실패: " + (lastError ?? "녹음된 데이터가 없습니다.")
                    } else {
                        ProbeEvidence.append("TTS 명령 파일 생성 완료: \(framesWritten) 프레임")
                    }
                }
                return
            }
            do {
                if outputFile == nil {
                    // Apple's buffer output format is PCM; .wav is inferred from file extension.
                    outputFile = try AVAudioFile(forWriting: url, settings: pcm.format.settings)
                }
                try outputFile?.write(from: pcm)
                framesWritten += AVAudioFramePosition(pcm.frameLength)
            } catch {
                lastError = error.localizedDescription
            }
        }
    }

    func play() {
        guard ready else {
            status = "먼저 명령 음성 파일을 만들어 주세요."
            return
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
            player = try AVAudioPlayer(contentsOf: Self.commandURL)
            player?.prepareToPlay()
            if player?.play() == true {
                status = "저장된 명령 음성을 재생했습니다. 접근성 인식은 별도로 확인하세요."
                ProbeEvidence.append("저장된 명령 오디오 수동 재생")
            } else {
                status = "음성 재생을 시작하지 못했습니다."
            }
        } catch {
            status = "오디오 재생 실패: " + error.localizedDescription
        }
    }
}

/// Used by a single App Intent: wait for the connected call and play the saved
/// command. It cannot click the system Phone UI itself.
enum CallConnectedCommandPlayback {
    static func playSavedCommand() async -> Bool {
        let url = VoiceCommandAudioStore.commandURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            ProbeEvidence.append("자동 재생 실패: 명령 음성 파일이 없음")
            return false
        }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            guard player.play() else {
                ProbeEvidence.append("자동 재생 실패: AVAudioPlayer.play false")
                return false
            }
            let seconds = min(max(player.duration + 0.5, 1), 10)
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
            ProbeEvidence.append("자동 재생 완료: Voice Control 인식은 별도 검증")
            return true
        } catch {
            ProbeEvidence.append("자동 재생 실패: " + error.localizedDescription)
            return false
        }
    }
}
