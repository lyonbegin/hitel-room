import UIKit
import UniformTypeIdentifiers
import Foundation

/// Receives only data explicitly shared by iOS, never private Notes files.
final class HitelNotesShareController: UIViewController {
    private let statusLabel = UILabel()
    private let resultLabel = UILabel()
    private var count = 0
    private var results: [String] = []
    private var processing = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let title = UILabel()
        title.text = "HITEL · 오디오 가져오기"
        title.font = .preferredFont(forTextStyle: .title2)
        title.numberOfLines = 0

        statusLabel.numberOfLines = 0
        statusLabel.text = "공유된 오디오를 가져오고 있습니다."
        resultLabel.numberOfLines = 0
        resultLabel.font = .preferredFont(forTextStyle: .footnote)

        let finish = UIButton(type: .system)
        finish.setTitle("HITEL 열기 / 완료", for: .normal)
        finish.addTarget(self, action: #selector(finishSharing), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [title, statusLabel, resultLabel, finish])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
            stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor)
        ])
        processSharedFiles()
    }

    private func processSharedFiles() {
        guard !processing else { return }
        processing = true
        let providers = ((extensionContext?.inputItems as? [NSExtensionItem]) ?? [])
            .flatMap { $0.attachments ?? [] }

        // The supplied Voicenotes IPA uses NSItemProvider.loadItem and
        // file URLs. Do not interpret a public.url Notes invitation as audio.
        let supported: [String] = [
            "public.file-url",
            "com.apple.m4a-audio",
            "public.mp3",
            "com.microsoft.waveform-audio",
            "com.apple.protected-mpeg-4-audio",
            "public.aac-audio",
            "org.xiph.flac",
            "public.audio",
            "public.movie"
        ]
        let matched = providers.compactMap { provider -> (NSItemProvider, String)? in
            guard let type = supported.first(where: { provider.hasItemConformingToTypeIdentifier($0) }) else {
                return nil
            }
            return (provider, type)
        }
        guard !matched.isEmpty else {
            statusLabel.text = "오디오 파일이 아닌 공유 항목입니다."
            resultLabel.text = "메모 공동작업 초대 링크만 전달된 경우에는 실제 음성 파일을 가져올 수 없습니다."
            return
        }

        count = matched.count
        for (provider, type) in matched {
            load(provider, type: type)
        }
    }

    private func load(_ provider: NSItemProvider, type: String) {
        // Voicenotes calls loadItemForTypeIdentifier first; do likewise.
        // Some providers give a security-scoped file URL rather than an
        // NSItemProvider file representation. Copy while in the callback.
        provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, itemError in
            guard let self = self else { return }
            if let url = (item as? URL) ?? (item as? NSURL).map({ $0 as URL }),
               url.isFileURL {
                let allowed = ["m4a", "mov", "mp4", "mp3", "wav",
                               "aac", "flac", "caf", "aiff", "m4b"]
                guard allowed.contains(url.pathExtension.lowercased()) ||
                      type != "public.file-url" else {
                    self.complete(.failure(ReceiveError.notAudio))
                    return
                }
                let opened = url.startAccessingSecurityScopedResource()
                let result = Result {
                    try AudioHandoff.transfer(file: url,
                        preferredName: provider.suggestedName.map {
                            $0.contains(".") ? $0 : $0 + "." + url.pathExtension
                        })
                }
                if opened { url.stopAccessingSecurityScopedResource() }
                self.complete(result)
                return
            }
            if let data = item as? Data, !data.isEmpty {
                let ext = UTType(type)?.preferredFilenameExtension ?? "m4a"
                let temp = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString + "." + ext)
                do {
                    try data.write(to: temp, options: .atomic)
                    defer { try? FileManager.default.removeItem(at: temp) }
                    self.complete(Result {
                        try AudioHandoff.transfer(file: temp,
                            preferredName: provider.suggestedName ?? "NotesAudio." + ext)
                    })
                } catch {
                    self.complete(.failure(error))
                }
                return
            }
            // A link (https://...) is not an audio file. Attempt an actual
            // file representation, but never download private Notes links.
            provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, error in
                guard let self = self else { return }
                guard let url = url, url.isFileURL else {
                    self.complete(.failure(ReceiveError.noLocalFile))
                    return
                }
                let result = Result {
                    try AudioHandoff.transfer(file: url,
                        preferredName: provider.suggestedName.map {
                            $0.contains(".") ? $0 : $0 + "." + url.pathExtension
                        })
                }
                self.complete(result)
            }
        }
    }

    private enum ReceiveError: LocalizedError {
        case notAudio
        case noLocalFile
        var errorDescription: String? {
            switch self {
            case .notAudio:
                return "공유된 URL이 오디오 파일이 아닙니다."
            case .noLocalFile:
                return "메모의 링크/텍스트가 전달됐으며 오디오 파일은 전달되지 않았습니다."
            }
        }
    }

    private func complete(_ result: Result<AudioHandoff.Receipt, Error>) {
        DispatchQueue.main.async {
            switch result {
            case .success(let receipt):
                let path = receipt.method == .appGroup
                    ? "공유 저장소에 보관" : "기기 클립보드로 전달"
                self.results.append("✓ \(receipt.filename) · \(receipt.bytes)바이트 · \(path)")
            case .failure(let error):
                self.results.append("실패: \(error.localizedDescription)")
            }
            self.count -= 1
            self.resultLabel.text = self.results.joined(separator: "\n")
            if self.count == 0 {
                self.statusLabel.text = "공유 처리 완료"
            }
        }
    }

    @objc private func finishSharing() {
        extensionContext?.open(URL(string: "hitelnotes://import")!) { [weak self] _ in
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
}
