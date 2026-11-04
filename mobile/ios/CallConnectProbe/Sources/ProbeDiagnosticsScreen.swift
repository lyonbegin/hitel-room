import SwiftUI

struct ProbeDiagnosticsScreen: View {
    @ObservedObject var monitor: CallConnectionMonitor
    @State private var snapshot = FileProbeEngine.latest()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                GroupBox("iPhone XR · CallKit 실제 통화 상태") {
                    VStack(alignment: .leading, spacing: 9) {
                        LabeledContent("전화 연결", value: monitor.connected ? "YES" : "NO")
                        LabeledContent("상태", value: monitor.state)
                        LabeledContent("현재 통화 수", value: String(monitor.count))
                        LabeledContent("상태 조회 시각", value: monitor.lastChecked)
                        Button("CallKit 다시 확인") {
                            monitor.refresh(reason: "진단 화면 수동 조회")
                            snapshot = FileProbeEngine.latest()
                        }
                        .buttonStyle(.bordered)
                    }.padding(.vertical, 7)
                }

                GroupBox("파일 접근 증거") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("파일이 보이지 않는 것과 파일이 존재하지 않는 것은 다릅니다.")
                            .font(.subheadline.bold())
                        if let s = snapshot {
                            LabeledContent("검사 시각", value: s.sampledAt)
                            LabeledContent("검사 경로", value: s.trigger)
                            ForEach(s.systemRecordingDirectories, id: \.path) { target in
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(target.path)
                                        .font(.system(size: 12, design: .monospaced).bold())
                                        .textSelection(.enabled)
                                    LabeledContent("속성", value: target.attributesStatus)
                                    LabeledContent("열람", value: target.listingStatus)
                                    LabeledContent("검사 파일", value: String(target.filesChecked))
                                    LabeledContent("크기 증가", value: String(target.growingFiles))
                                    LabeledContent("읽기 성공", value: String(target.readableFiles))
                                    ForEach(target.fileDetails, id: \.self) { item in
                                        Text(item)
                                            .font(.system(size: 11, design: .monospaced))
                                            .textSelection(.enabled)
                                    }
                                }
                                Divider()
                            }
                            LabeledContent("Notes 앱 그룹 (별도)", value: s.appleNotesGroup)
                            LabeledContent("공유 앱 그룹 루트", value: s.sharedAppGroupsRoot)
                            LabeledContent("자체 저장소 검사", value: String(s.ownFilesExamined) + "개")
                            LabeledContent("자체 오디오 파일", value: String(s.ownAudioFiles) + "개")
                            LabeledContent("크기 증가 확인", value: String(s.ownAudioFilesGrowing) + "개")
                        } else {
                            Text("파일 검사 기록이 없습니다.")
                        }
                        Button("파일 접근 검사 1회 실행") {
                            snapshot = FileProbeEngine.sample(
                                trigger: "Diagnostics_Manual", callState: monitor.state
                            )
                            monitor.refresh(reason: "진단 파일 수동 검사")
                        }
                        .buttonStyle(.borderedProminent)
                    }.padding(.vertical, 7)
                }

                GroupBox("검사 보고서") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("검사 때마다 하나의 JSON 객체를 줄 단위로 저장합니다. 전화번호 및 실제 통화 음성은 수집하지 않습니다.")
                            .font(.subheadline)
                        if FileManager.default.fileExists(atPath: FileProbeEngine.reportURL.path) {
                            ShareLink(item: FileProbeEngine.reportURL) {
                                Label("JSONL 검사 보고서 공유", systemImage: "square.and.arrow.up")
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        Button("검사 기록 초기화", role: .destructive) {
                            FileProbeEngine.reset()
                            monitor.clearEvents()
                            snapshot = nil
                        }
                        .buttonStyle(.bordered)
                    }.padding(.vertical, 7)
                }

                GroupBox("CallKit 및 파일 검사 이벤트") {
                    VStack(alignment: .leading, spacing: 9) {
                        Button("로그 갱신") {
                            monitor.refresh(reason: "로그 갱신")
                            snapshot = FileProbeEngine.latest()
                        }
                        .buttonStyle(.bordered)
                        if monitor.recentEvidence.isEmpty {
                            Text("기록 없음").foregroundStyle(.secondary)
                        }
                        ForEach(Array(monitor.recentEvidence.enumerated()), id: \.offset) { item in
                            Text(item.element)
                                .font(.system(size: 11, design: .monospaced))
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .textSelection(.enabled)
                            Divider()
                        }
                    }.padding(.vertical, 7)
                }

                Text("두 OS 경로의 파일 목록·크기·읽기 전용 시험 결과를 기록합니다. 파일 열기 실패는 파일 부존재를 의미하지 않습니다. 오디오 원본은 보관하지 않으며, iOS 백그라운드에서 반복 실행을 보장하지 않습니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("녹음 파일 검사 기록")
        .onAppear {
            monitor.refresh(reason: "진단 화면 열림")
            snapshot = FileProbeEngine.latest()
        }
        .onReceive(Timer.publish(every: 2, on: .main, in: .common).autoconnect()) { _ in
            snapshot = FileProbeEngine.latest()
        }
    }
}
