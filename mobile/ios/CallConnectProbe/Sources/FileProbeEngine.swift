import Foundation

/// One exact iOS OS directory, not a generic "recording" search.
struct SystemRecordingDirectoryResult: Codable {
    let path: String
    let attributesStatus: String
    let listingStatus: String
    let filesChecked: Int
    let audioFiles: Int
    let growingFiles: Int
    let readableFiles: Int
    let fileDetails: [String]

    var canEnumerate: Bool { listingStatus.hasPrefix("OK") }
}

struct FileProbeSnapshot: Codable {
    let sampledAt: String
    let trigger: String
    let callState: String
    let systemRecordingDirectories: [SystemRecordingDirectoryResult]
    let appleNotesGroup: String
    let sharedAppGroupsRoot: String
    let ownFilesExamined: Int
    let ownAudioFiles: Int
    let ownAudioFilesGrowing: Int
    let ownAudioDescriptions: [String]
}

/// This is a read-only experiment. It never writes to system directories,
/// requests unsupported system privileges, or saves/copies call audio.
/// FileHandle.read(upToCount:) reads at most 4096 bytes only as an
/// access test, and the bytes are discarded immediately.
enum FileProbeEngine {
    private static let latestKey = "hitel.recordingFileProbe.latest"
    private static let previousKey = "hitel.recordingFileProbe.fileSizes"
    private static let systemSizesKey = "hitel.recordingFileProbe.systemSizes"
    private static let mutex = NSRecursiveLock()
    private static let audioExtensions: Set<String> = [
        "mov", "m4a", "caf", "wav", "aac", "mp3", "mp4", "aif", "aiff", "3gp", "amr"
    ]

    /// The exact two user-requested directory targets. No guessed path is
    /// labeled as a verified Apple call-recording file path.
    static let candidateDirectories: [String] = [
        "/var/mobile/Media/Recordings/",
        "/var/mobile/Library/CallServices/Recordings/"
    ]

    static var reportURL: URL {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return documents.appendingPathComponent("HITEL-Recording-File-Probe.jsonl")
    }

    static func latest() -> FileProbeSnapshot? {
        mutex.lock()
        defer { mutex.unlock() }
        guard let data = UserDefaults.standard.data(forKey: latestKey) else {
            return nil
        }
        return try? JSONDecoder().decode(FileProbeSnapshot.self, from: data)
    }

    @discardableResult
    static func sample(trigger: String, callState: String) -> FileProbeSnapshot {
        mutex.lock()
        defer { mutex.unlock() }

        let fm = FileManager.default
        let formatter = ISO8601DateFormatter()
        let timestamp = formatter.string(from: Date())

        // Attempt the exact absolute directories even if sandbox is expected
        // to deny access. Log NSError domain/code for actual on-device evidence.
        let priorSystemSizes = UserDefaults.standard.dictionary(forKey: systemSizesKey) as? [String: Int] ?? [:]
        var nextSystemSizes = priorSystemSizes
        let systemResults = candidateDirectories.map { path in
            probeSystemDirectory(path, previous: priorSystemSizes, next: &nextSystemSizes, formatter: formatter)
        }
        UserDefaults.standard.set(nextSystemSizes, forKey: systemSizesKey)

        // Separate check for the Notes app-group entitlement.
        let notesStatus: String
        if let notesURL = fm.containerURL(forSecurityApplicationGroupIdentifier: "group.com.apple.notes") {
            do {
                let contents = try fm.contentsOfDirectory(atPath: notesURL.path)
                notesStatus = "accessible_items=" + String(contents.count)
            } catch {
                notesStatus = "container_unreadable_" + errorCode(error)
            }
        } else {
            notesStatus = "no_app_group_entitlement"
        }

        let sharedRoot = "/private/var/mobile/Containers/Shared/AppGroup"
        let sharedRootStatus: String
        do {
            let entries = try fm.contentsOfDirectory(atPath: sharedRoot)
            sharedRootStatus = "enumerable_item_count=" + String(entries.count)
        } catch {
            sharedRootStatus = "not_enumerable_" + errorCode(error)
        }

        // Control group: this app's OWN sandbox, not system call recordings.
        let roots: [URL] = [
            fm.urls(for: .documentDirectory, in: .userDomainMask)[0],
            fm.urls(for: .cachesDirectory, in: .userDomainMask)[0],
            URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        ]
        var seen = Set<String>()
        var ownFilesExamined = 0
        var ownAudioFiles = 0
        var ownAudioFilesGrowing = 0
        var ownDetails: [String] = []
        let previous = UserDefaults.standard.dictionary(forKey: previousKey) as? [String: Int] ?? [:]
        var nextSizes: [String: Int] = [:]

        for root in roots {
            guard let enumerator = fm.enumerator(
                at: root,
                includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey],
                options: [.skipsHiddenFiles],
                errorHandler: { url, error in
                    ProbeEvidence.append("자체 저장소 접근 거부: " + url.lastPathComponent + " " + errorCode(error))
                    return false
                }
            ) else { continue }

            while let file = enumerator.nextObject() as? URL {
                if ownFilesExamined >= 400 { break }
                if file.path.contains("/VoiceGridCommands/") ||
                    file.lastPathComponent == "HITEL-Start-Recording.wav" {
                    continue
                }
                guard seen.insert(file.path).inserted else { continue }
                guard let values = try? file.resourceValues(
                    forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey]
                ), values.isRegularFile == true, values.isSymbolicLink != true else { continue }

                ownFilesExamined += 1
                guard audioExtensions.contains(file.pathExtension.lowercased()) else { continue }
                ownAudioFiles += 1
                let bytes = values.fileSize ?? 0
                nextSizes[file.path] = bytes
                let change = previous[file.path].map { bytes - $0 } ?? 0
                if previous[file.path] != nil && change > 0 { ownAudioFilesGrowing += 1 }
                if ownDetails.count < 15 {
                    let modified = values.contentModificationDate.map { formatter.string(from: $0) } ?? "unknown"
                    ownDetails.append("OWN_SANDBOX/" + file.lastPathComponent +
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
            systemRecordingDirectories: systemResults,
            appleNotesGroup: notesStatus,
            sharedAppGroupsRoot: sharedRootStatus,
            ownFilesExamined: ownFilesExamined,
            ownAudioFiles: ownAudioFiles,
            ownAudioFilesGrowing: ownAudioFilesGrowing,
            ownAudioDescriptions: ownDetails
        )

        if let data = try? JSONEncoder().encode(snapshot) {
            UserDefaults.standard.set(data, forKey: latestKey)
            writeReportLine(data)
        }
        UserDefaults.standard.set(nextSizes, forKey: previousKey)
        for result in systemResults {
            ProbeEvidence.append(
                "OS-PATH " + result.path +
                " dir=" + result.listingStatus +
                " files=" + String(result.filesChecked) +
                " growing=" + String(result.growingFiles) +
                " readable=" + String(result.readableFiles)
            )
        }
        ProbeEvidence.append("FILE-PROBE " + trigger + " call=" + callState)
        return snapshot
    }

    private static func probeSystemDirectory(
        _ path: String,
        previous: [String: Int],
        next: inout [String: Int],
        formatter: ISO8601DateFormatter
    ) -> SystemRecordingDirectoryResult {
        let fm = FileManager.default
        let directory = URL(fileURLWithPath: path, isDirectory: true)

        let attributesStatus: String
        do {
            let attrs = try fm.attributesOfItem(atPath: path)
            attributesStatus = "OK type=" + String(describing: attrs[.type] ?? "unknown")
        } catch {
            attributesStatus = "ERROR " + errorCode(error)
        }

        let listingStatus: String
        do {
            let entries = try fm.contentsOfDirectory(atPath: path)
            listingStatus = "OK entries=" + String(entries.count)
        } catch {
            listingStatus = "ERROR " + errorCode(error)
            return SystemRecordingDirectoryResult(
                path: path,
                attributesStatus: attributesStatus,
                listingStatus: listingStatus,
                filesChecked: 0, audioFiles: 0,
                growingFiles: 0, readableFiles: 0,
                fileDetails: ["Access denied or path unavailable. This does NOT prove no recording exists."]
            )
        }

        var filesChecked = 0
        var audioFiles = 0
        var growingFiles = 0
        var readableFiles = 0
        var details: [String] = []

        guard let enumerator = fm.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey],
            options: [],
            errorHandler: { url, error in
                if details.count < 20 {
                    details.append("CHILD_ERROR " + url.lastPathComponent + " " + errorCode(error))
                }
                return false
            }
        ) else {
            return SystemRecordingDirectoryResult(
                path: path, attributesStatus: attributesStatus,
                listingStatus: listingStatus + " recursive_enumerator_failed",
                filesChecked: 0, audioFiles: 0, growingFiles: 0, readableFiles: 0,
                fileDetails: ["Directory listed but nested enumeration unavailable."]
            )
        }

        while let file = enumerator.nextObject() as? URL {
            if filesChecked >= 256 {
                details.append("LIMIT 256 regular files reached")
                break
            }
            do {
                let values = try file.resourceValues(
                    forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentModificationDateKey]
                )
                guard values.isRegularFile == true, values.isSymbolicLink != true else { continue }
                filesChecked += 1

                let size = values.fileSize ?? 0
                let old = previous[file.path]
                let delta = old.map { size - $0 } ?? 0
                if old != nil && delta > 0 { growingFiles += 1 }
                next[file.path] = size

                if audioExtensions.contains(file.pathExtension.lowercased()) { audioFiles += 1 }
                // A real POSIX read access test, not merely checking fileExists().
                // The read bytes are immediately discarded and never logged.
                let readResult = testReadOnly(file, size: size)
                if readResult.hasPrefix("OK") { readableFiles += 1 }

                if details.count < 20 || (delta > 0 && details.count < 28) {
                    let modified = values.contentModificationDate.map { formatter.string(from: $0) } ?? "unknown"
                    details.append(file.path.replacingOccurrences(of: path, with: "") +
                        " size=" + String(size) +
                        " delta=" + String(delta) +
                        " modified=" + modified +
                        " read=" + readResult)
                }
            } catch {
                if details.count < 20 {
                    details.append("STAT_ERROR " + file.lastPathComponent + " " + errorCode(error))
                }
            }
        }

        return SystemRecordingDirectoryResult(
            path: path, attributesStatus: attributesStatus,
            listingStatus: listingStatus,
            filesChecked: filesChecked,
            audioFiles: audioFiles,
            growingFiles: growingFiles,
            readableFiles: readableFiles,
            fileDetails: details
        )
    }

    private static func testReadOnly(_ file: URL, size: Int) -> String {
        do {
            let handle = try FileHandle(forReadingFrom: file)
            defer { try? handle.close() }
            if size > 4096 {
                try handle.seek(toOffset: UInt64(size - 4096))
            }
            let data = try handle.read(upToCount: 4096)
            return "OK read_bytes=" + String(data?.count ?? 0)
        } catch {
            return "ERROR " + errorCode(error)
        }
    }

    static func reset() {
        mutex.lock()
        defer { mutex.unlock() }
        UserDefaults.standard.removeObject(forKey: latestKey)
        UserDefaults.standard.removeObject(forKey: previousKey)
        UserDefaults.standard.removeObject(forKey: systemSizesKey)
        try? FileManager.default.removeItem(at: reportURL)
        ProbeEvidence.append("FILE-PROBE 검사 기록 초기화")
    }

    private static func writeReportLine(_ raw: Data) {
        let url = reportURL
        var line = raw
        line.append(0x0A)
        if !FileManager.default.fileExists(atPath: url.path) {
            _ = FileManager.default.createFile(atPath: url.path, contents: line)
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
