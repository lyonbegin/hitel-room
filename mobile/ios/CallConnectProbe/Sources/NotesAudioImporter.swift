import Foundation
import Combine
import AVFoundation
import CryptoKit

struct ImportedCallAudio: Codable, Identifiable {
    let id: String
    let name: String
    let storedName: String
    let bytes: Int64
    let sha256: String
    let audioTracks: Int
    let duration: Double?
    let time: String
}

@MainActor
final class NotesAudioImporter: ObservableObject {
    static let shared = NotesAudioImporter()
    @Published private(set) var items: [ImportedCallAudio] = []
    @Published private(set) var status = "메모 통화 녹음 파일을 아직 가져오지 않았습니다."
    @Published private(set) var busy = false

    private let cacheKey = "hitel.imported.call.recordings"
    private init() {
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let restored = try? JSONDecoder().decode([ImportedCallAudio].self, from: data) {
            items = restored
        }
    }
    nonisolated static var directory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("NotesCallAudio", isDirectory: true)
    }
    static var report: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("HITEL-Notes-Audio-Report.json")
    }
    func fileURL(_ item: ImportedCallAudio) -> URL {
        Self.directory.appendingPathComponent(item.storedName)
    }
    func reportError(_ error: Error) {
        let e = error as NSError
        status = "파일 선택 실패: \(e.domain):\(e.code)"
        ProbeEvidence.append("NOTES_IMPORT FAILED \(status)")
    }
    func receive(_ url: URL, source: String) async {
        guard !busy else { return }
        busy = true
        status = "오디오 파일 복사 및 검증 중"
        defer { busy = false }
        do {
            let copy = try await Task.detached(priority: .userInitiated) {
                try Self.copyFile(url)
            }.value
            let asset = AVURLAsset(url: copy.url)
            let tracks = try await asset.loadTracks(withMediaType: .audio)
            guard !tracks.isEmpty else {
                try? FileManager.default.removeItem(at: copy.url)
                throw ImportFailure.noAudioTrack
            }
            let length = try? await asset.load(.duration)
            let value = length.map { CMTimeGetSeconds($0) }
            let duration = value.flatMap { $0.isFinite && $0 >= 0 ? $0 : nil }
            let result = ImportedCallAudio(
                id: UUID().uuidString, name: copy.name,
                storedName: copy.url.lastPathComponent, bytes: copy.bytes,
                sha256: copy.sha256, audioTracks: tracks.count,
                duration: duration, time: ISO8601DateFormatter().string(from: Date())
            )
            items.insert(result, at: 0)
            items = Array(items.prefix(30))
            if let data = try? JSONEncoder().encode(items) {
                UserDefaults.standard.set(data, forKey: cacheKey)
                try? data.write(to: Self.report, options: .atomic)
            }
            status = "실제 오디오 검증 성공: \(result.bytes)바이트 · 트랙 \(tracks.count)개"
            ProbeEvidence.append("NOTES_IMPORT SUCCESS from=\(source) bytes=\(result.bytes) audioTracks=\(tracks.count)")
        } catch {
            let e = error as NSError
            status = "가져오기 실패: \(error.localizedDescription) (\(e.domain):\(e.code))"
            ProbeEvidence.append("NOTES_IMPORT FAILURE \(status)")
        }
    }

    private enum ImportFailure: LocalizedError {
        case unsupported
        case empty
        case noAudioTrack
        var errorDescription: String? {
            switch self {
            case .unsupported: return "지원하지 않는 오디오 파일 형식입니다."
            case .empty: return "파일 크기가 0바이트입니다."
            case .noAudioTrack: return "실제 오디오 트랙을 찾지 못했습니다."
            }
        }
    }
    private struct Copy {
        let url: URL
        let name: String
        let bytes: Int64
        let sha256: String
    }
    nonisolated private static func copyFile(_ source: URL) throws -> Copy {
        let allowed: Set<String> = ["m4a", "mov", "mp4", "aac", "wav", "caf", "mp3", "aiff"]
        guard allowed.contains(source.pathExtension.lowercased()) else {
            throw ImportFailure.unsupported
        }
        let scope = source.startAccessingSecurityScopedResource()
        defer { if scope { source.stopAccessingSecurityScopedResource() } }
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let dest = directory.appendingPathComponent(UUID().uuidString + "-" + source.lastPathComponent)
        try FileManager.default.copyItem(at: source, to: dest)
        do {
            let attr = try FileManager.default.attributesOfItem(atPath: dest.path)
            let bytes = (attr[.size] as? NSNumber)?.int64Value ?? 0
            guard bytes > 0 else { throw ImportFailure.empty }
            let handle = try FileHandle(forReadingFrom: dest)
            defer { try? handle.close() }
            var hash = SHA256()
            while let piece = try handle.read(upToCount: 1_048_576), !piece.isEmpty {
                hash.update(data: piece)
            }
            let digest = hash.finalize().map { String(format: "%02x", $0) }.joined()
            return Copy(url: dest, name: source.lastPathComponent, bytes: bytes, sha256: digest)
        } catch {
            try? FileManager.default.removeItem(at: dest)
            throw error
        }
    }
}
