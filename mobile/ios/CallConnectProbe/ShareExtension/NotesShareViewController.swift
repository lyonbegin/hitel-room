import UIKit
import UniformTypeIdentifiers
import CryptoKit
import Foundation

/// Diagnostic only. Inspects bytes explicitly handed to the Share Extension.
/// Does not read Apple's private Notes sandbox or claim a live audio stream.
final class NotesShareViewController: UIViewController {
    private let logView = UITextView()
    private var providers: [NSItemProvider] = []
    private var jobs: [DispatchWorkItem] = []
    private var lines: [String] = []
    private var previous: [String: (Int64, String)] = [:]
    private let started = Date()

    override func viewDidLoad() {
        super.viewDidLoad()
        buildUI()
        providers = ((extensionContext?.inputItems as? [NSExtensionItem]) ?? [])
            .flatMap { $0.attachments ?? [] }
        event(["kind": "opened",
               "count": providers.count,
               "types": providers.enumerated().map {
                   "\($0.offset):" + $0.element.registeredTypeIdentifiers.joined(separator: ",")
               }])
        show("메모 공유 항목 \(providers.count)개 수신")
        for seconds in [0, 15, 30, 60] {
            let job = DispatchWorkItem { [weak self] in self?.sample(at: seconds) }
            jobs.append(job)
            DispatchQueue.main.asyncAfter(deadline: .now() + .seconds(seconds), execute: job)
        }
    }

    private func buildUI() {
        view.backgroundColor = .systemBackground
        let header = UILabel()
        header.text = "HITEL 메모 녹음 · 실제 공유 데이터 검사"
        header.font = .preferredFont(forTextStyle: .headline)
        header.numberOfLines = 0

        logView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        logView.isEditable = false
        logView.text = "Apple 메모에서 전달한 형식(오디오·메모 링크·텍스트)을 먼저 구분하고, 0·15·30·60초에 다시 확인합니다.\n"

        let check = UIButton(type: .system)
        check.setTitle("지금 다시 검사", for: .normal)
        check.addTarget(self, action: #selector(checkNow), for: .touchUpInside)

        let copy = UIButton(type: .system)
        copy.setTitle("검사 로그 복사", for: .normal)
        copy.addTarget(self, action: #selector(copyLog), for: .touchUpInside)

        let done = UIButton(type: .system)
        done.setTitle("검사 종료", for: .normal)
        done.addTarget(self, action: #selector(endProbe), for: .touchUpInside)

        let buttons = UIStackView(arrangedSubviews: [check, copy, done])
        buttons.axis = .vertical
        buttons.spacing = 8
        let stack = UIStackView(arrangedSubviews: [header, logView, buttons])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -14),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -14),
            logView.heightAnchor.constraint(greaterThanOrEqualToConstant: 160)
        ])
    }

    @objc private func checkNow() {
        sample(at: Int(Date().timeIntervalSince(started)))
    }

    @objc private func copyLog() {
        UIPasteboard.general.string = lines.joined(separator: "\n") + "\n"
        show("로그 \(lines.count)개 복사 완료. HITEL 앱의 '메모 공유 검사 로그'에 붙여 넣으십시오.")
    }

    @objc private func endProbe() {
        jobs.forEach { $0.cancel() }
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func sample(at seconds: Int) {
        show("━━ \(seconds)초 파일 재요청 ━━")
        event(["kind": "sample", "elapsed": seconds])
        for (index, provider) in providers.enumerated() {
            let types = provider.registeredTypeIdentifiers
            let preferred = types.filter {
                guard let type = UTType($0) else { return false }
                return type.conforms(to: .audio) || type.conforms(to: .movie) ||
                    type.conforms(to: .data)
            }
            let selected = Array((preferred.isEmpty ? types : preferred).prefix(6))
            if selected.isEmpty {
                event(["kind": "no_type", "index": index, "elapsed": seconds])
                show("공유 항목 \(index): 파일 형식 없음")
                continue
            }
            for type in selected {
                show("항목 \(index) · \(type)")
                if let uti = UTType(type), uti.conforms(to: .url) || uti.conforms(to: .text) {
                    provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, error in
                        let details = Self.inspectSharedReference(item)
                        DispatchQueue.main.async {
                            self?.recordSharedReference(details, error: error,
                                                        index: index, type: type, seconds: seconds)
                        }
                    }
                    continue
                }
                provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, error in
                    // The provider's URL may be deleted when this callback exits.
                    let result = Self.inspect(url)
                    DispatchQueue.main.async {
                        self?.record(result, error: error, index: index, type: type, seconds: seconds)
                    }
                }
                // An in-place representation is useful to distinguish an original
                // handle from a frozen temporary copy. Availability is not guaranteed.
                provider.loadInPlaceFileRepresentation(forTypeIdentifier: type) { [weak self] url, inPlace, error in
                    let attributes = Self.fileAttributes(url)
                    DispatchQueue.main.async {
                        self?.event([
                            "kind": "in_place", "index": index, "type": type,
                            "elapsed": seconds, "inPlace": inPlace,
                            "attributes": attributes,
                            "error": error.map { "\(($0 as NSError).domain):\(($0 as NSError).code)" } ?? "none"
                        ])
                        self?.show("in-place=\(inPlace) · \(attributes)")
                    }
                }
            }
        }
    }

    private struct SharedReference {
        let kind: String
        let bytes: Int
        let isNotesCollaborationLink: Bool
    }

    private static func inspectSharedReference(_ item: NSSecureCoding?) -> SharedReference {
        if let url = item as? URL {
            return SharedReference(
                kind: url.isFileURL ? "file_url" : "url",
                bytes: url.absoluteString.utf8.count,
                isNotesCollaborationLink: url.absoluteString.contains("icloud.com/notes")
            )
        }
        if let text = item as? String {
            return SharedReference(
                kind: "text",
                bytes: text.utf8.count,
                isNotesCollaborationLink: text.contains("icloud.com/notes")
            )
        }
        if let data = item as? Data {
            return SharedReference(kind: "raw_data", bytes: data.count,
                                   isNotesCollaborationLink: false)
        }
        return SharedReference(kind: item == nil ? "nil" : "other_object",
                               bytes: 0, isNotesCollaborationLink: false)
    }

    private func recordSharedReference(_ details: SharedReference, error: Error?,
                                       index: Int, type: String, seconds: Int) {
        let err = error.map { "\(($0 as NSError).domain):\(($0 as NSError).code)" } ?? "none"
        event([
            "kind": "shared_reference",
            "index": index,
            "type": type,
            "elapsed": seconds,
            "representation": details.kind,
            "payloadBytes": details.bytes,
            "notesCollaborationLink": details.isNotesCollaborationLink,
            "error": err
        ])
        if details.isNotesCollaborationLink {
            show("\(seconds)초: 메모 공동작업 초대 링크 감지 (오디오 원본 아님)")
        } else {
            show("\(seconds)초: \(details.kind), 데이터 \(details.bytes)바이트, 오류 \(err)")
        }
    }

    private struct Capture {
        let size: Int64?
        let sha: String?
        let signature: String
        let reason: String
    }

    private static func inspect(_ url: URL?) -> Capture {
        guard let url = url else {
            return Capture(size: nil, sha: nil, signature: "unknown", reason: "no_url")
        }
        do {
            let props = try FileManager.default.attributesOfItem(atPath: url.path)
            let size = (props[.size] as? NSNumber)?.int64Value ?? -1
            let file = try FileHandle(forReadingFrom: url)
            defer { try? file.close() }
            let first = try file.read(upToCount: 12) ?? Data()
            let signature: String
            if first.count >= 8 && String(data: first[4..<8], encoding: .ascii) == "ftyp" {
                signature = "MP4/MOV container (audio not yet verified)"
            } else if first.count >= 4 && String(data: first[0..<4], encoding: .ascii) == "caff" {
                signature = "CAF"
            } else if first.count >= 12 && String(data: first[0..<4], encoding: .ascii) == "RIFF" {
                signature = "RIFF/WAV"
            } else {
                signature = "other"
            }
            try file.seek(toOffset: 0)
            var digest = SHA256()
            while let chunk = try file.read(upToCount: 1_048_576), !chunk.isEmpty {
                digest.update(data: chunk)
            }
            let hash = digest.finalize().map { String(format: "%02x", $0) }.joined()
            return Capture(size: size, sha: hash, signature: signature, reason: "read_ok")
        } catch {
            let ns = error as NSError
            return Capture(size: nil, sha: nil, signature: "unknown",
                           reason: "error=\(ns.domain):\(ns.code)")
        }
    }

    private static func fileAttributes(_ url: URL?) -> String {
        guard let url = url else { return "no_url" }
        do {
            let a = try FileManager.default.attributesOfItem(atPath: url.path)
            let size = (a[.size] as? NSNumber)?.int64Value ?? -1
            return "size=\(size)"
        } catch {
            let ns = error as NSError
            return "error=\(ns.domain):\(ns.code)"
        }
    }

    private func record(_ result: Capture, error: Error?,
                        index: Int, type: String, seconds: Int) {
        let key = "\(index):\(type)"
        var props: [String: Any] = [
            "kind": "file", "index": index, "type": type,
            "elapsed": seconds, "signature": result.signature,
            "result": result.reason,
            "providerError": error.map { "\(($0 as NSError).domain):\(($0 as NSError).code)" } ?? "none"
        ]
        if let size = result.size { props["bytes"] = size }
        if let sha = result.sha { props["sha256"] = sha }
        if let size = result.size, let sha = result.sha {
            if let prev = previous[key] {
                props["deltaBytes"] = size - prev.0
                props["shaChanged"] = sha != prev.1
            }
            previous[key] = (size, sha)
        }
        event(props)
        show("\(seconds)초: 크기 \(result.size.map(String.init) ?? "?") / \(result.reason)" +
             (props["deltaBytes"].map { " / 증가량=\($0)" } ?? ""))
    }

    private func show(_ text: String) {
        logView.text += text + "\n"
        let count = logView.text.utf16.count
        if count > 1 { logView.scrollRangeToVisible(NSRange(location: count - 1, length: 1)) }
    }

    private func event(_ value: [String: Any]) {
        var properties = value
        properties["time"] = ISO8601DateFormatter().string(from: Date())
        guard JSONSerialization.isValidJSONObject(properties),
              let data = try? JSONSerialization.data(withJSONObject: properties),
              let line = String(data: data, encoding: .utf8) else {
            return
        }
        lines.append(line)
    }
}
