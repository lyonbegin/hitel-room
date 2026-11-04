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

        let supported: [String] = [
            UTType.audio.identifier,
            UTType.mpeg4Audio.identifier,
            UTType.mp3.identifier,
            UTType.wav.identifier,
            UTType.movie.identifier,
            UTType.data.identifier,
            UTType.fileURL.identifier
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
        provider.loadFileRepresentation(forTypeIdentifier: type) { [weak self] url, error in
            guard let self = self else { return }
            if let url = url {
                // The system deletes this representation after callback returns.
                let result = Result { try AudioHandoff.transfer(file: url,
                                    preferredName: provider.suggestedName.map { $0 + "." + url.pathExtension }) }
                self.complete(result)
            } else {
                // Some providers implement loadItem but not loadFileRepresentation.
                provider.loadItem(forTypeIdentifier: type, options: nil) { [weak self] item, fallbackError in
                    guard let self = self else { return }
                    let candidate = (item as? URL) ?? (item as? NSURL).map { $0 as URL }
                    if let file = candidate, file.isFileURL {
                        self.complete(Result { try AudioHandoff.transfer(file: file) })
                    } else if let data = item as? Data {
                        do {
                            let temp = FileManager.default.temporaryDirectory
                                .appendingPathComponent(UUID().uuidString + ".m4a")
                            try data.write(to: temp, options: .atomic)
                            defer { try? FileManager.default.removeItem(at: temp) }
                            self.complete(Result { try AudioHandoff.transfer(file: temp,
                                                               preferredName: provider.suggestedName ?? "shared.m4a") })
                        } catch {
                            self.complete(.failure(error))
                        }
                    } else {
                        self.complete(.failure(fallbackError ?? error ?? AudioHandoff.BridgeError.noFile))
                    }
                }
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
