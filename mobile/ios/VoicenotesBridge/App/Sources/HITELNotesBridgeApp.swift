import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

@main
struct HITELNotesBridgeApp: App {
    @StateObject private var library = HITELAudioLibrary.shared
    var body: some Scene {
        WindowGroup {
            HITELNotesBridgeHome()
                .environmentObject(library)
                .onOpenURL { url in
                    guard url.scheme == "hitelnotes" else { return }
                    Task {
                        await library.collectIncomingFiles()
                        await library.importFromClipboard()
                    }
                }
        }
    }
}

struct HITELNotesBridgeHome: View {
    @EnvironmentObject private var library: HITELAudioLibrary
    @Environment(\.scenePhase) private var scenePhase
    @State private var player: AVPlayer?
    @State private var selectedClip: String?
    @State private var filePicker = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Apple 메모의 ‘오디오 공유’에서 HITEL 오디오 가져오기를 선택하면 실제 오디오 파일을 받아옵니다.")
                        .font(.subheadline)
                    Text(library.status).font(.subheadline).textSelection(.enabled)
                    if library.busy { ProgressView() }

                    Button {
                        Task { await library.collectIncomingFiles() }
                    } label: {
                        Label("받은 오디오 새로고침", systemImage: "arrow.clockwise")
                    }
                    Button {
                        Task { await library.importFromClipboard() }
                    } label: {
                        Label("무료 서명: 공유된 오디오 받기", systemImage: "doc.on.clipboard")
                    }
                    Button {
                        filePicker = true
                    } label: {
                        Label("파일에서 오디오 가져오기", systemImage: "folder")
                    }
                } header: {
                    Text("Apple 메모 ↔ HITEL")
                } footer: {
                    Text("서명된 App Group 권한이 있으면 자동으로 공유 저장소를 확인합니다. 무료 Apple ID 설치에서는 공유 확장이 기기 클립보드에 전달한 파일을 가져옵니다. 녹음 중 원본 스트리밍을 보장하지 않습니다.")
                }

                Section("수신한 실제 오디오 · \(library.clips.count)개") {
                    if library.clips.isEmpty {
                        Text("아직 수신한 오디오가 없습니다.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(library.clips) { clip in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(clip.name)
                                .font(.headline)
                                .textSelection(.enabled)
                            LabeledContent("크기", value: ByteCountFormatter.string(
                                fromByteCount: clip.bytes, countStyle: .file))
                            LabeledContent("길이", value: String(format: "%.1f초", clip.duration))
                            Text("SHA-256 " + clip.sha256)
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)

                            HStack(spacing: 12) {
                                Button {
                                    if selectedClip == clip.id {
                                        player?.pause()
                                        selectedClip = nil
                                    } else {
                                        player?.pause()
                                        player = AVPlayer(url: library.fileURL(clip))
                                        player?.play()
                                        selectedClip = clip.id
                                    }
                                } label: {
                                    Label(selectedClip == clip.id ? "중지" : "재생",
                                          systemImage: selectedClip == clip.id
                                          ? "stop.fill" : "play.fill")
                                }
                                .buttonStyle(.bordered)

                                Button("기기 내 전사") {
                                    library.transcribeOnDevice(clip)
                                }
                                .buttonStyle(.bordered)

                                ShareLink(item: library.fileURL(clip)) {
                                    Label("공유", systemImage: "square.and.arrow.up")
                                }.buttonStyle(.bordered)
                            }
                            if let transcript = library.transcripts[clip.id] {
                                Text(transcript)
                                    .textSelection(.enabled)
                                    .font(.body)
                            }
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
            .navigationTitle("HITEL 오디오 연동")
            .fileImporter(isPresented: $filePicker, allowedContentTypes: [.audio, .movie]) { result in
                if case .success(let url) = result {
                    Task { await library.importDocument(url) }
                }
            }
            .task { await library.collectIncomingFiles() }
            .onChange(of: scenePhase) { phase in
                if phase == .active {
                    Task { await library.collectIncomingFiles() }
                }
            }
        }
    }
}
