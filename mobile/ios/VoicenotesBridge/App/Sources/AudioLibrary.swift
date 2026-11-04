import Foundation
import Combine
import AVFoundation
import Speech
import UIKit

struct HITELAudioClip: Identifiable, Codable {
    let id: String
    let name: String
    let storedFilename: String
    let bytes: Int64
    let sha256: String
    let duration: Double
    let created: Date
}

@MainActor
final class HITELAudioLibrary: ObservableObject {
    static let shared = HITELAudioLibrary()

    @Published private(set) var clips: [HITELAudioClip] = []
    @Published private(set) var status = "Apple 메모에서 오디오를 공유하시면 HITEL에서 받을 수 있습니다."
    @Published private(set) var busy = false
    @Published private(set) var transcripts: [String: String] = [:]

    private let storedIndex = "HITEL-Notes-Audio-Library.json"
    private let decoder = JSONDecoder()
    private var recognitionTask: SFSpeechRecognitionTask?

    private var directory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("ImportedNotesAudio", isDirectory: true)
    }
    private var indexFile: URL {
        directory.appendingPathComponent(storedIndex)
    }

    private init() {
        if let data = try? Data(contentsOf: indexFile),
           let persisted = try? decoder.decode([HITELAudioClip].self, from: data) {
            clips = persisted
        }
    }

    func fileURL(_ clip: HITELAudioClip) -> URL {
        directory.appendingPathComponent(clip.storedFilename)
    }

    func collectIncomingFiles() async {
        guard !busy, let groupDir = AudioHandoff.incomingDirectory,
              let files = try? FileManager.default.contentsOfDirectory(
                at: groupDir, includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]) else { return }
        let sources = files.filter { !$0.lastPathComponent.hasSuffix(".json") }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        for source in sources {
            let metaURL = source.appendingPathExtension("json")
            let meta = (try? Data(contentsOf: metaURL)).flatMap {
                try? JSONSerialization.jsonObject(with: $0) as? [String: String]
            }
            let sourceName = meta?["name"] ?? source.lastPathComponent
            let success = await importFile(source, name: sourceName)
            if success {
                try? FileManager.default.removeItem(at: source)
                try? FileManager.default.removeItem(at: metaURL)
            }
        }
    }

    func importFromClipboard() async {
        guard let data = UIPasteboard.general.data(forPasteboardType: AudioHandoff.payloadType),
              !data.isEmpty else {
            status = "HITEL로 공유된 오디오가 클립보드에 없습니다."
            return
        }
        let meta = UIPasteboard.general.data(forPasteboardType: AudioHandoff.metadataType)
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }
        let originalName = meta?["name"] ?? "NotesAudio.m4a"
        let candidate = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString + "." +
                ((originalName as NSString).pathExtension.isEmpty
                 ? "m4a" : (originalName as NSString).pathExtension))
        do {
            try data.write(to: candidate, options: .atomic)
            defer { try? FileManager.default.removeItem(at: candidate) }
            let received = await importFile(candidate, name: originalName)
            if received {
                // Clear only when the data still belongs to this extension.
                if UIPasteboard.general.contains(pasteboardTypes: [AudioHandoff.payloadType]) {
                    UIPasteboard.general.items = []
                }
            }
        } catch {
            status = "클립보드 파일 저장 실패: \(error.localizedDescription)"
        }
    }

    func importDocument(_ url: URL) async {
        let security = url.startAccessingSecurityScopedResource()
        defer { if security { url.stopAccessingSecurityScopedResource() } }
        _ = await importFile(url, name: url.lastPathComponent)
    }

    @discardableResult
    private func importFile(_ source: URL, name: String) async -> Bool {
        guard !busy else { return false }
        busy = true
        status = "공유된 실제 오디오를 확인하고 있습니다."
        defer { busy = false }

        let ext = source.pathExtension.lowercased()
        let extOK = ["m4a", "mov", "mp4", "mp3", "wav", "aac",
                     "caf", "aiff", "flac", "mpeg", "m4b"]
        guard extOK.contains(ext) else {
            status = "지원하지 않는 확장자: \(ext)"
            return false
        }

        let dest = directory.appendingPathComponent(UUID().uuidString + "." + ext)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: source, to: dest)

            let (size, digest) = try AudioHandoff.digest(dest)
            guard size > 0 else { throw ImportError.invalidAudio }
            let asset = AVURLAsset(url: dest)
            let tracks = try await asset.loadTracks(withMediaType: .audio)
            guard !tracks.isEmpty else { throw ImportError.invalidAudio }
            let time = try await asset.load(.duration)
            let seconds = CMTimeGetSeconds(time)
            let clip = HITELAudioClip(
                id: UUID().uuidString, name: name, storedFilename: dest.lastPathComponent,
                bytes: size, sha256: digest,
                duration: seconds.isFinite && seconds >= 0 ? seconds : 0,
                created: Date()
            )
            clips.insert(clip, at: 0)
            try JSONEncoder().encode(clips).write(to: indexFile, options: .atomic)
            status = "실제 오디오 수신 완료: \(name) · \(size)바이트"
            return true
        } catch {
            try? FileManager.default.removeItem(at: dest)
            status = "파일 수신 실패: \(error.localizedDescription)"
            return false
        }
    }

    private enum ImportError: LocalizedError {
        case invalidAudio
        var errorDescription: String? { "정상적인 오디오 트랙을 확인할 수 없습니다." }
    }

    func transcribeOnDevice(_ clip: HITELAudioClip) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
              recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
            status = "이 iPhone에는 한국어 기기 내 음성 인식이 준비되어 있지 않습니다."
            return
        }
        SFSpeechRecognizer.requestAuthorization { [weak self] permission in
            DispatchQueue.main.async {
                guard let self = self else { return }
                guard permission == .authorized else {
                    self.status = "음성 인식 권한이 허용되지 않았습니다."
                    return
                }
                self.recognitionTask?.cancel()
                let request = SFSpeechURLRecognitionRequest(url: self.fileURL(clip))
                request.requiresOnDeviceRecognition = true
                request.shouldReportPartialResults = true
                self.status = "기기 내 한국어 음성 인식을 실행하고 있습니다."
                self.recognitionTask = recognizer.recognitionTask(with: request) {
                    [weak self] result, error in
                    DispatchQueue.main.async {
                        guard let self = self else { return }
                        if let result = result {
                            self.transcripts[clip.id] = result.bestTranscription.formattedString
                            if result.isFinal { self.status = "기기 내 음성 인식 완료" }
                        }
                        if let error = error {
                            self.status = "음성 인식: \(error.localizedDescription)"
                        }
                    }
                }
            }
        }
    }
}
