import Foundation

/// Metadata-only experiment. Never reads or copies telephone audio contents.
/// iOS does not grant this app access to Apple's Notes app-group directory.
struct FileProbeSnapshot: Codable {
    let sampledAt: String
    let trigger: String
    let callState: String
    let appleNotesGroup: String
    let sharedAppGroupsRoot: String
    let ownFilesExamined: Int
    let ownAudioFiles: Int
    let ownAudioFilesGrowing: Int
    let ownAudioDescriptions: [String]
}

enum FileProbeEngine {
    private static let latestKey = "hitel.recordingFileProbe.latest"
    private static let previousKey = "hitel.recordingFileProbe.fileSizes"
    private static let audioExtensions: Set<String> = [
        "mov", "m4a", "caf", "wav", "aac", "mp3", "mp4", "aif", "aiff"
    ]

    static var reportURL: URL {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documents.appendingPathComponent("HITEL-Recording-File-Probe.jsonl")
    }

    static func latest() -> FileProbeSnapshot? {
        guard let data = UserDefaults.standard.data(forKey: latestKey) else {
            return nil
        }
        return try? JSONDecoder().decode(FileProbeSnapshot.self, from: data)
    }

    @discardableResult
    static func sample(trigger: String, callState: String) -> FileProbeSnapshot {
        let fm = FileManager.default
        let formatter = ISO8601DateFormatter()
        let timestamp = formatter.string(from: Date())

        // This app has no entitlement for group.com.apple.notes. An unavailable
        // container does not prove a recording file does not exist.
        let notesStatus: String
        if let notesURL = fm.containerURL(forSecurityApplicationGroupIdentifier: "group.com.apple.notes") {
            do {
                let contents = try fm.contentsOfDirectory(atPath: notesURL.path)
                notesStatus = "unexpectedly_accessible_items_" + String(contents.count)
            } catch {
                notesStatus = "container_found_but_not_readable_" + errorCode(error)
            }
        } else {
            notesStatus = "unavailable_no_shared_entitlement"
        }

        // A second independent check distinguishes a blocked filesystem root
        // from a shared app-group URL that was not granted to the app.
        let sharedRoot = "/private/var/mobile/Containers/Shared/AppGroup"
        let sharedRootStatus: String
        do {
            let entries = try fm.contentsOfDirectory(atPath: sharedRoot)
            sharedRootStatus = "enumerable_item_count_" + String(entries.count)
        } catch {
            sharedRootStatus = "not_enumerable_" + errorCode(error)
        }

        let roots: [URL] = [
            fm.urls(for: .documentDirectory, in: .userDomainMask)[0],
            fm.urls(for: .cachesDirectory, in: .userDomainMask)[0],
            URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        ]
        var seen = Set<String>()
        var ownFilesExamined = 0
        var audioFiles = 0
        var growingFiles = 0
        var details: [String] = []
        let previous = UserDefaults.standard.dictionary(forKey: previousKey) as? [String: Int] ?? [:]
        var nextSizes: [String: Int] = [:]

        for root in roots {
            guard let enumerator = fm.enumerator(
                at: root,
                includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey],
                options: [.skipsHiddenFiles],
                errorHandler: { url, error in
                    ProbeEvidence.append("자체 저장소 탐색 실패: " + url.lastPathComponent + " " + errorCode(error))
                    return false
                }
            ) else { continue }

            while let file = enumerator.nextObject() as? URL {
                if ownFilesExamined >= 400 { break }
                if file.path.contains("/VoiceGridCommands/") ||
                    file.lastPathComponent == "HITEL-Start-Recording.wav" {
                    continue
                }
                guard !seen.contains(file.path) else { continue }
                seen.insert(file.path)
                guard let values = try? file.resourceValues(
                    forKeys: [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]
                ), values.isRegularFile == true else { continue }

                ownFilesExamined += 1
                guard audioExtensions.contains(file.pathExtension.lowercased()) else { continue }
                audioFiles += 1
                let bytes = values.fileSize ?? 0
                nextSizes[file.path] = bytes
                let oldBytes = previous[file.path]
                let change = oldBytes.map { bytes - $0 } ?? 0
                if oldBytes != nil && change > 0 { growingFiles += 1 }
                if details.count < 15 {
                    let modified = values.contentModificationDate.map { formatter.string(from: $0) } ?? "unknown"
                    details.append("own_sandbox/" + file.lastPathComponent +
                        " bytes=" + String(bytes) +
                        " delta=" + String(change) +
                        " modified=" + modified)
                }
            }
        }

        let snapshot = FileProbeSnapshot(
            sampledAt: timestamp,
            trigger: trigger,
            callState: callState,
            appleNotesGroup: notesStatus,
            sharedAppGroupsRoot: sharedRootStatus,
            ownFilesExamined: ownFilesExamined,
            ownAudioFiles: audioFiles,
            ownAudioFilesGrowing: growingFiles,
            ownAudioDescriptions: details
        )

        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: latestKey)
            writeReportLine(data)
        }
        UserDefaults.standard.set(nextSizes, forKey: previousKey)
        ProbeEvidence.append(
            "FILE-PROBE " + trigger +
            " call=" + callState +
            " notes=" + notesStatus +
            " ownAudio=" + String(audioFiles) +
            " growing=" + String(growingFiles)
        )
        return snapshot
    }

    static func reset() {
        UserDefaults.standard.removeObject(forKey: latestKey)
        UserDefaults.standard.removeObject(forKey: previousKey)
        try? FileManager.default.removeItem(at: reportURL)
        ProbeEvidence.append("FILE-PROBE 증거 기록 초기화")
    }

    private static func writeReportLine(_ raw: Data) {
        let url = reportURL
        var line = raw
        line.append(0x0A)
        if !FileManager.default.fileExists(atPath: url.path) {
            FileManager.default.createFile(atPath: url.path, contents: line)
            return
        }
        do {
            let handle = try FileHandle(forWritingTo: url)
            defer { try? handle.close() }
            handle.seekToEndOfFile()
            handle.write(line)
        } catch {
            ProbeEvidence.append("FILE-PROBE JSONL 저장 실패: " + errorCode(error))
        }
    }

    private static func errorCode(_ error: Error) -> String {
        let nsError = error as NSError
        return nsError.domain + ":" + String(nsError.code)
    }
}
