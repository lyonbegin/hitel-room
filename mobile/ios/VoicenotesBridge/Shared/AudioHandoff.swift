import Foundation
import UIKit
import CryptoKit

/// Independent HITEL implementation of Apple's supported Share Extension handoff.
/// Voicenotes' proprietary implementation is NOT copied.
enum AudioHandoff {
    static let appGroup = "group.app.hitel.notesbridge"
    static let payloadType = "app.hitel.notesbridge.audio"
    static let metadataType = "app.hitel.notesbridge.metadata"
    static let maxPasteboardBytes = 24 * 1024 * 1024

    enum Method: String {
        case appGroup
        case pasteboard
    }

    struct Receipt {
        let method: Method
        let filename: String
        let bytes: Int64
        let sha256: String
    }

    enum BridgeError: LocalizedError {
        case noFile, empty, tooLarge, invalidFile
        var errorDescription: String? {
            switch self {
            case .noFile: return "공유 항목에 읽을 수 있는 파일이 없습니다."
            case .empty: return "전달된 오디오가 0바이트입니다."
            case .tooLarge: return "무료 서명 전달 방식은 최대 24MB입니다. App Group 서명 버전을 사용하십시오."
            case .invalidFile: return "오디오 파일을 읽지 못했습니다."
            }
        }
    }

    static var incomingDirectory: URL? {
        guard let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
            return nil
        }
        return base.appendingPathComponent("Incoming", isDirectory: true)
    }

    static func digest(_ url: URL) throws -> (Int64, String) {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hash = SHA256()
        var total: Int64 = 0
        while let piece = try handle.read(upToCount: 1_048_576), !piece.isEmpty {
            total += Int64(piece.count)
            hash.update(data: piece)
        }
        return (total, hash.finalize().map { String(format: "%02x", $0) }.joined())
    }

    static func transfer(file source: URL, preferredName: String? = nil) throws -> Receipt {
        guard FileManager.default.fileExists(atPath: source.path) else { throw BridgeError.noFile }
        let name = (preferredName ?? source.lastPathComponent)
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
        let (bytes, hash) = try digest(source)
        guard bytes > 0 else { throw BridgeError.empty }

        if let directory = incomingDirectory {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let extensionName = source.pathExtension.isEmpty ? "m4a" : source.pathExtension.lowercased()
            let destination = directory.appendingPathComponent(UUID().uuidString + "." + extensionName)
            try FileManager.default.copyItem(at: source, to: destination)
            let meta: [String: String] = [
                "name": name, "sha256": hash, "bytes": String(bytes)
            ]
            let metaURL = destination.appendingPathExtension("json")
            try JSONSerialization.data(withJSONObject: meta).write(to: metaURL, options: .atomic)
            return Receipt(method: .appGroup, filename: name, bytes: bytes, sha256: hash)
        }

        // Local-only fallback for Apple ID sideloading that cannot obtain the
        // App Groups entitlement. The host app reads only on explicit user action.
        guard bytes <= Int64(maxPasteboardBytes) else { throw BridgeError.tooLarge }
        let data = try Data(contentsOf: source)
        let meta = try JSONSerialization.data(withJSONObject: [
            "name": name, "bytes": String(bytes), "sha256": hash
        ])
        UIPasteboard.general.setItems([[
            payloadType: data,
            metadataType: meta
        ]])
        return Receipt(method: .pasteboard, filename: name, bytes: bytes, sha256: hash)
    }
}
