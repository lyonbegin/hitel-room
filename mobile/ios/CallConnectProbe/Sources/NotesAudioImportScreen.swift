import SwiftUI
import UniformTypeIdentifiers

struct NotesAudioImportScreen: View {
    @StateObject private var importer = NotesAudioImporter.shared
    @State private var showingPicker = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox("Apple 메모의 실제 통화 녹음 가져오기") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("메모 → 통화 녹음 → 녹음 열기 → … → '오디오 공유'에서 HITEL이 보이면 선택하십시오. 보이지 않는 경우 '오디오 파일 저장'으로 Files에 저장한 후 아래 버튼을 누르십시오.")
                            .font(.subheadline)
                        Button {
                            showingPicker = true
                        } label: {
                            Label("메모에서 저장한 음성 파일 불러오기", systemImage: "square.and.arrow.down")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(importer.busy)
                        if importer.busy {
                            ProgressView("실제 파일 읽기·SHA-256·오디오 트랙 확인")
                        }
                        Text(importer.status).font(.subheadline).textSelection(.enabled)
                    }.padding(.vertical, 6)
                }

                GroupBox("확인된 오디오 파일") {
                    VStack(alignment: .leading, spacing: 12) {
                        if importer.items.isEmpty {
                            Text("불러온 파일 없음")
                                .foregroundStyle(.secondary)
                        }
                        ForEach(importer.items) { item in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(item.name).font(.headline).textSelection(.enabled)
                                LabeledContent("실제 파일 크기", value: String(item.bytes) + "바이트")
                                LabeledContent("오디오 트랙", value: String(item.audioTracks))
                                LabeledContent("녹음 길이",
                                               value: item.duration.map { String(format: "%.1f초", $0) } ?? "확인 안 됨")
                                Text("SHA-256: " + item.sha256)
                                    .font(.system(size: 11, design: .monospaced))
                                    .textSelection(.enabled)
                                ShareLink(item: importer.fileURL(item)) {
                                    Label("검증한 파일 다시 공유", systemImage: "square.and.arrow.up")
                                }
                                .buttonStyle(.bordered)
                            }
                            Divider()
                        }
                    }.font(.subheadline).padding(.vertical, 7)
                }

                if FileManager.default.fileExists(atPath: NotesAudioImporter.report.path) {
                    ShareLink(item: NotesAudioImporter.report) {
                        Label("실제 오디오 검사 결과 JSON 내보내기", systemImage: "doc.text")
                    }
                }

                Text("이 검사는 사용자가 메모에서 명시적으로 공유하거나 저장한 오디오에만 접근합니다. 녹음 중 Notes 앱의 비공개 파일을 자동으로 읽는 기능은 아니며, iPhone XR 실기기에서 '오디오 공유'의 HITEL 표시 여부도 확인이 필요합니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("메모 녹음 파일 확인")
        .fileImporter(isPresented: $showingPicker, allowedContentTypes: [.audio, .movie]) { result in
            switch result {
            case .success(let file):
                Task { await importer.receive(file, source: "FilesPicker") }
            case .failure(let error):
                importer.reportError(error)
            }
        }
    }
}
