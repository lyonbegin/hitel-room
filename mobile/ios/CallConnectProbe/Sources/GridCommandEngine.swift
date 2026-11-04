import Foundation
import Combine
import AVFoundation

/// Built-in Voice Control: "Show Grid" -> "One" -> "Tap Four" (or selected cell).
/// No custom iOS Voice Control gesture is created.
@MainActor
final class GridCommandEngine: ObservableObject {
    static let shared = GridCommandEngine()
    static let cellKey = "hitel.grid.tapCell"
    @Published var tapCell: Int = 4 {
        didSet {
            UserDefaults.standard.set(tapCell, forKey: Self.cellKey)
            ready = hasFiles()
        }
    }
    @Published private(set) var ready = false
    @Published private(set) var busy = false
    @Published private(set) var status = "음성 파일 준비 중"

    private init() {
        let saved = UserDefaults.standard.integer(forKey: Self.cellKey)
        tapCell = (1...9).contains(saved) ? saved : 4
        ready = hasFiles()
        status = ready ? "명령 음성 파일 3개 저장됨" : "자동 생성 준비"
    }

    static func files(cell: Int) -> [(String, URL)] {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("VoiceGridCommands", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let words = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine"]
        let word = words[max(0, min(8, cell - 1))]
        return [
            ("Show Grid", dir.appendingPathComponent("01-Show-Grid.wav")),
            ("One", dir.appendingPathComponent("02-One.wav")),
            ("Tap " + word, dir.appendingPathComponent("03-Tap-" + String(cell) + ".wav"))
        ]
    }

    private func hasFiles() -> Bool {
        Self.files(cell: tapCell).allSatisfy {
            let bytes = (try? FileManager.default.attributesOfItem(atPath: $0.1.path)[.size] as? NSNumber)?.intValue ?? 0
            return bytes > 1024
        }
    }

    @discardableResult
    func prepare() async -> Bool {
        if hasFiles() { ready = true; status = "명령 음성 파일 3개 저장됨"; return true }
        guard !busy else { return false }
        busy = true
        status = "아이폰에서 영어 명령 음성 생성 중"
        defer { busy = false }
        for (phrase, url) in Self.files(cell: tapCell) {
            let bytes = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber)?.intValue ?? 0
            if bytes > 1024 { continue }
            do {
                try await makeWAV(phrase, url)
                ProbeEvidence.append("TTS WAV 생성: " + phrase)
            } catch {
                status = "명령 생성 실패: " + error.localizedDescription
                ProbeEvidence.append(status)
                return false
            }
        }
        ready = hasFiles()
        status = ready ? "명령 음성 파일 3개 저장됨" : "음성 파일 생성 실패"
        return ready
    }

    private func makeWAV(_ phrase: String, _ url: URL) async throws {
        try? FileManager.default.removeItem(at: url)
        let speech = AVSpeechSynthesizer()
        let utterance = AVSpeechUtterance(string: phrase)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.43
        try await withCheckedThrowingContinuation { (done: CheckedContinuation<Void, Error>) in
            var file: AVAudioFile?
            var count: AVAudioFramePosition = 0
            var finished = false
            speech.write(utterance) { buffer in
                guard !finished, let pcm = buffer as? AVAudioPCMBuffer else { return }
                if pcm.frameLength == 0 {
                    finished = true
                    file = nil
                    if count > 0 { done.resume(returning: ()) }
                    else { done.resume(throwing: NSError(domain:"HITEL",code:1,
                        userInfo:[NSLocalizedDescriptionKey:"TTS PCM 출력 없음"])) }
                    return
                }
                do {
                    if file == nil { file = try AVAudioFile(forWriting:url,settings:pcm.format.settings) }
                    try file?.write(from:pcm)
                    count += AVAudioFramePosition(pcm.frameLength)
                } catch {
                    finished = true
                    file = nil
                    done.resume(throwing:error)
                }
            }
        }
    }

    @discardableResult
    func playSequence() async -> Bool {
        guard await prepare() else { return false }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback,mode:.default,options:[.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
            status = "격자 음성 명령 세 개 재생 중"
            for (i, entry) in Self.files(cell:tapCell).enumerated() {
                if Task.isCancelled { throw CancellationError() }
                let player = try AVAudioPlayer(contentsOf:entry.1)
                guard player.prepareToPlay(),player.play() else { return false }
                ProbeEvidence.append("격자 명령 재생 \(i+1)/3: "+entry.0)
                try await Task.sleep(nanoseconds:UInt64(max(player.duration+0.5,0.6)*1_000_000_000))
                player.stop()
                if i < 2 { try await Task.sleep(nanoseconds:1_600_000_000) }
            }
            status = "명령 재생 완료 (실제 터치·녹음 여부는 미확인)"
            ProbeEvidence.append(status)
            return true
        } catch {
            status = "오디오 실행 실패: "+error.localizedDescription
            ProbeEvidence.append(status)
            return false
        }
    }
}
