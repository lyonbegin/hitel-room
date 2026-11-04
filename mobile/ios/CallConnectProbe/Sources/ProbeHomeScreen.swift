import SwiftUI
import UIKit

/// One page, metadata-only test of whether a running system phone-call
/// recording is exposed as a readable, growing file to this app.
struct ProbeHomeScreen: View {
    @ObservedObject var monitor: CallConnectionMonitor
    @State private var snapshot = FileProbeEngine.latest()
    @State private var showDiagnostics = false

    private var notesAccessText: String {
        guard let snapshot = snapshot else { return "검사 전" }
        if snapshot.appleNotesGroup.hasPrefix("unexpectedly_accessible") {
            return "메모 앱 저장소 목록 접근 감지 — 상세 검증 필요"
        }
        if snapshot.appleNotesGroup.hasPrefix("container_found_but_not_readable") {
            return "저장소 위치는 확인, 읽기 거부"
        }
        return "Apple 메모 앱 저장소 직접 접근 불가"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("통화 중 녹음 파일 접근 검사")
                            .font(.title2.bold())
                        Text("기존 전화 앱은 그대로 표시됩니다. HITEL은 통화 연결을 감지하고 파일의 존재·크기·변경 시각·읽기 권한만 조사합니다.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    GroupBox("통화 상태") {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Image(systemName: monitor.connected ? "phone.fill" : "phone")
                                    .foregroundStyle(monitor.connected ? .green : .secondary)
                                Text(monitor.connected ? "통화 연결됨 · 파일 검사 중" : "통화 연결 대기")
                                    .font(.headline)
                                Spacer()
                                Button("새로고침") {
                                    monitor.refresh(reason: "홈 화면 직접 갱신")
                                    snapshot = FileProbeEngine.latest()
                                }
                                .buttonStyle(.bordered)
                            }
                            LabeledContent("CallKit 상태", value: monitor.state)
                            Text("전화 앱 실행 → 기존 단축어 자동화 → 'HITEL 연결되면 녹음 파일 검사' 동작으로 실행됩니다.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                    }

                    GroupBox("실제 파일 접근 검사") {
                        VStack(alignment: .leading, spacing: 12) {
                            LabeledContent("Apple 메모 앱 저장소", value: notesAccessText)
                            LabeledContent("HITEL 앱 내부 오디오 파일",
                                           value: String(snapshot?.ownAudioFiles ?? 0) + "개")
                            LabeledContent("크기 증가가 확인된 파일",
                                           value: String(snapshot?.ownAudioFilesGrowing ?? 0) + "개")
                            if let snapshot = snapshot {
                                LabeledContent("마지막 검사", value: snapshot.sampledAt)
                                Text("접근 상태 원본: " + snapshot.appleNotesGroup)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(.secondary)
                                Text("공유 폴더 검사: " + snapshot.sharedAppGroupsRoot)
                                    .font(.system(size: 11, design: .monospaced))
                                    .foregroundStyle(.secondary)
                                ForEach(snapshot.ownAudioDescriptions, id: \.self) { entry in
                                    Text(entry).font(.system(size: 11, design: .monospaced))
                                        .textSelection(.enabled)
                                }
                            } else {
                                Text("아직 파일 검사 기록이 없습니다.")
                                    .font(.subheadline).foregroundStyle(.secondary)
                            }
                            Button("지금 파일 접근 직접 검사") {
                                snapshot = FileProbeEngine.sample(
                                    trigger: "Home_Manual", callState: monitor.state
                                )
                                monitor.refresh(reason: "파일 접근 직접 검사")
                            }
                            .buttonStyle(.borderedProminent)
                        }.padding(.vertical, 7)
                    }

                    GroupBox("검증 결과 저장") {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("각 검사 시점과 파일 크기 변화, 접근 실패 코드를 JSONL 보고서에 누적합니다. 통화 음성 자체는 복사하거나 녹음하지 않습니다.")
                                .font(.subheadline)
                            if FileManager.default.fileExists(atPath: FileProbeEngine.reportURL.path) {
                                ShareLink(item: FileProbeEngine.reportURL) {
                                    Label("검사 보고서 내보내기", systemImage: "square.and.arrow.up")
                                }.buttonStyle(.borderedProminent)
                            } else {
                                Text("파일 검사 후 보고서를 내보낼 수 있습니다.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Button("상세 검사 로그 보기") {
                                monitor.refresh(reason: "진단 화면 이동")
                                showDiagnostics = true
                            }.buttonStyle(.bordered)
                        }.padding(.vertical, 7)
                    }

                    Text("중요: Apple 메모 앱 저장소가 읽기 불가인 경우 '녹음 파일이 없다'는 뜻이 아닙니다. iOS 샌드박스가 HITEL의 접근을 막았다는 뜻입니다. 전화 앱을 전면에 둔 상태에서 단축어의 실행 시간은 iOS에 의해 제한될 수 있습니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("HITEL 녹음 파일 검증")
            .navigationDestination(isPresented: $showDiagnostics) {
                ProbeDiagnosticsScreen(monitor: monitor)
            }
            .onAppear {
                monitor.refresh(reason: "녹음 파일 검증 화면 열림")
                snapshot = FileProbeEngine.latest()
            }
            .onReceive(Timer.publish(every: 2, on: .main, in: .common).autoconnect()) { _ in
                snapshot = FileProbeEngine.latest()
            }
        }
    }
}
