import SwiftUI
import UIKit

/// No App Group or special entitlement is required: the user explicitly copies
/// diagnostic JSON Lines from Share Extension into this app.
struct NotesShareInboxScreen: View {
    @State private var importedLog = ""
    @State private var message = "Apple 메모의 '오디오 공유' 메뉴에서 HITEL을 선택하십시오."
    @State private var lines = 0

    private var destination: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("HITEL-Notes-LiveShare-Evidence.jsonl")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Apple 메모 통화 녹음 공유 검사")
                    .font(.title3.bold())
                Text("통화 녹음 중 메모의 '오디오 공유'에서 HITEL 메모 공유 검사를 선택하십시오. 공유 화면을 60초 유지한 후 '검사 로그 복사'를 누르고 이 화면으로 돌아오시면 됩니다.")
                    .font(.subheadline)
                Button {
                    importedLog = UIPasteboard.general.string ?? ""
                    saveValidJSONL()
                } label: {
                    Label("클립보드의 검사 로그 가져오기", systemImage: "doc.on.clipboard")
                }
                .buttonStyle(.borderedProminent)

                Text(message).font(.subheadline).textSelection(.enabled)
                if lines > 0 {
                    LabeledContent("저장된 검사 항목", value: String(lines))
                    ShareLink(item: destination) {
                        Label("검사 기록 JSONL 내보내기", systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.bordered)
                }
                if !importedLog.isEmpty {
                    TextEditor(text: $importedLog)
                        .font(.system(size: 11, design: .monospaced))
                        .frame(minHeight: 260)
                        .border(Color.secondary.opacity(0.3))
                }

                Text("판정 기준: 0초와 15·30·60초에서 같은 파일 유형의 bytes 증가 또는 sha256 변경을 비교합니다. 변경되지 않으면 공유용 사본일 수 있습니다. iOS가 공유 확장을 중단한 경우 예정된 측정이 실행되지 않을 수 있습니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("메모 공유 검사 로그")
        .onAppear {
            if let contents = try? String(contentsOf: destination, encoding: .utf8) {
                lines = contents.split(separator: "\n").count
            }
        }
    }

    private func saveValidJSONL() {
        let entries = importedLog.split(separator: "\n").map(String.init)
        let valid = entries.filter {
            guard let bytes = $0.data(using: .utf8),
                  let value = try? JSONSerialization.jsonObject(with: bytes) else { return false }
            return value is [String: Any]
        }
        guard !valid.isEmpty else {
            message = "유효한 JSONL 검사 기록이 없습니다. 공유 확장의 '검사 로그 복사'를 먼저 사용하십시오."
            return
        }
        do {
            let line = valid.joined(separator: "\n") + "\n"
            let data = Data(line.utf8)
            if FileManager.default.fileExists(atPath: destination.path) {
                let file = try FileHandle(forWritingTo: destination)
                defer { try? file.close() }
                try file.seekToEnd()
                try file.write(contentsOf: data)
            } else {
                try data.write(to: destination, options: .atomic)
            }
            lines += valid.count
            message = "검사 기록 \(valid.count)개 저장했습니다."
        } catch {
            message = "로그 저장 실패: \((error as NSError).domain):\((error as NSError).code)"
        }
    }
}
