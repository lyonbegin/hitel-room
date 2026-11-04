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
                        Text("통화 녹음 실제 파일 및 시스템 경로 검사")
                            .font(.title2.bold())
                        Text("전화 앱은 그대로 표시됩니다. 통화 연결 후 iOS의 두 시스템 녹음 경로를 직접 열어 파일 존재·크기·읽기 권한을 조사합니다.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    NavigationLink {
                        NotesAudioImportScreen()
                    } label: {
                        Label("Apple 메모 통화 녹음 실제 파일 가져오기", systemImage: "waveform.badge.magnifyingglass")
                            .font(.headline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent)

                    Text("메모에서 오디오를 공유하거나 Files로 저장하면, 실제 음성 파일의 크기·SHA-256·오디오 트랙과 길이를 검사합니다.")
                        .font(.subheadline).foregroundStyle(.secondary)

                    NavigationLink {
                        NotesShareInboxScreen()
                    } label: {
                        Label("메모 통화 중 공유 검사 로그", systemImage: "waveform.badge.magnifyingglass")
                            .font(.headline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent)

                    Text("메모의 '오디오 공유' → 'HITEL 메모 공유 검사'를 실행하면 공유 항목과 0·15·30·60초 파일 변화를 확인할 수 있습니다.")
                        .font(.subheadline).foregroundStyle(.secondary)

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

                    GroupBox("iOS 시스템 녹음 경로 직접 검사") {
                        VStack(alignment: .leading, spacing: 12) {
                            if let snapshot = snapshot {
                                LabeledContent("마지막 검사", value: snapshot.sampledAt)
                                ForEach(snapshot.systemRecordingDirectories, id: \.path) { result in
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text(result.path)
                                            .font(.system(size: 12, design: .monospaced).bold())
                                            .textSelection(.enabled)
                                        Label(result.canEnumerate ? "디렉터리 열람 성공" : "디렉터리 열람 실패 / 차단",
                                              systemImage: result.canEnumerate ? "checkmark.circle" : "xmark.circle")
                                            .foregroundStyle(result.canEnumerate ? .green : .red)
                                        Text("경로 속성: " + result.attributesStatus)
                                        Text("목록 조회: " + result.listingStatus)
                                        LabeledContent("검사된 파일", value: String(result.filesChecked))
                                        LabeledContent("크기가 증가한 파일", value: String(result.growingFiles))
                                        LabeledContent("읽기 성공 파일", value: String(result.readableFiles))
                                        ForEach(result.fileDetails, id: \.self) { line in
                                            Text(line)
                                                .font(.system(size: 11, design: .monospaced))
                                                .textSelection(.enabled)
                                        }
                                    }
                                    .font(.caption)
                                    Divider()
                                }
                                Text("별도 참고: Apple Notes 앱 그룹=" + snapshot.appleNotesGroup)
                                    .font(.caption).foregroundStyle(.secondary)
                                Text("대조군: HITEL 앱 자체 폴더 오디오 " +
                                    String(snapshot.ownAudioFiles) + "개")
                                    .font(.caption).foregroundStyle(.secondary)
                            } else {
                                Text("아직 검사 결과가 없습니다.")
                                    .foregroundStyle(.secondary)
                            }
                            Button("두 시스템 경로 지금 검사") {
                                snapshot = FileProbeEngine.sample(
                                    trigger: "Home_Manual", callState: monitor.state
                                )
                                monitor.refresh(reason: "시스템 경로 직접 검사")
                            }
                            .buttonStyle(.borderedProminent)
                        }.padding(.vertical, 7)
                    }

                    GroupBox("검증 결과 저장") {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("두 시스템 경로를 직접 검사한 시각, 파일별 크기 변화, 읽기 시험 및 실패 코드를 JSONL에 누적합니다. 읽기 시험에 사용한 데이터는 저장하지 않습니다.")
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

                    Text("중요: 디렉터리 접근 실패는 녹음 파일이 없다는 증거가 아닙니다. iOS 샌드박스에 의해 차단된 경우가 있습니다. 통화 중 전화 앱이 전면에 있으면 단축어 및 백그라운드 검사가 중단될 수 있습니다.")
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
