import SwiftUI

/// One-screen iPhone XR trial. No custom Voice Control gesture registration.
struct ProbeHomeScreen: View {
    @ObservedObject var monitor: CallConnectionMonitor
    @StateObject private var grid = GridCommandEngine.shared
    @State private var showDiagnostics = false
    @State private var showAdvanced = false
    @State private var directLinkStatus = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:18) {
                    VStack(alignment:.leading,spacing:7) {
                        Text("음성 명령으로 녹음 버튼 누르기").font(.title2.bold())
                        Text("기본 음성 명령을 사용하므로 'Start Recording' 제스처를 새로 만들 필요가 없습니다.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    GroupBox("자동 준비") {
                        VStack(alignment:.leading,spacing:11) {
                            Label(grid.ready ? "명령 음성 저장 완료" : "명령 음성 만들기",systemImage:grid.ready ? "checkmark.circle.fill" : "waveform")
                                .font(.headline)
                            Text("Show Grid → One → Tap \(grid.tapCell)")
                                .font(.system(.title3,design:.monospaced).bold())
                            Text(grid.status).font(.footnote).foregroundStyle(.secondary)
                            Button("음성 명령 3개 시험 재생") {
                                Task { await grid.playSequence() }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(grid.busy)
                            if !grid.ready {
                                Button("음성 파일 다시 만들기") {
                                    Task { await grid.prepare() }
                                }.buttonStyle(.bordered)
                            }
                            if grid.ready {
                                ShareLink(item: GridCommandEngine.files(cell:grid.tapCell)[0].1) {
                                    Label("저장된 음성 파일 공유",systemImage:"square.and.arrow.up")
                                }.font(.caption)
                            }
                        }.padding(.vertical,6)
                    }
                    GroupBox("처음 한 번만") {
                        VStack(alignment:.leading,spacing:12) {
                            Button {
                                ProbeSystemNavigator.voiceControl { directLinkStatus = $0 }
                            } label: {
                                Label("① 음성 명령 설정 화면 바로 열기", systemImage: "gearshape.fill")
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 9)
                            }
                            .buttonStyle(.borderedProminent)
                            Text("음성 명령을 켜고 영어(미국)를 선택해 주세요.")
                                .font(.subheadline)
                            Divider()
                            Button {
                                ProbeSystemNavigator.shortcutsAutomation { directLinkStatus = $0 }
                            } label: {
                                Label("② 단축어 새 자동화 화면 바로 열기", systemImage: "bolt.fill")
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 9)
                            }
                            .buttonStyle(.borderedProminent)
                            Text("‘전화’ 앱이 열릴 때 → 즉시 실행 → ‘HITEL 연결되면 격자 명령 실행’을 추가해 주세요.")
                                .font(.subheadline)
                            if !directLinkStatus.isEmpty {
                                Text(directLinkStatus)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Text("음성 명령 및 자동화 생성 화면 링크는 비공식 주소여서 iOS가 앱 첫 화면으로 이동시킬 수 있습니다. 설정값 자체를 앱이 강제로 변경하지는 않습니다.")
                                .font(.caption).foregroundStyle(.secondary)
                        }.padding(.vertical,6)
                    }
                    GroupBox("전화 연결 상태") {
                        VStack(alignment:.leading,spacing:10) {
                            HStack {
                                Label(monitor.connected ? "현재 통화 연결됨" : "연결된 전화 없음",
                                      systemImage: monitor.connected ? "checkmark.circle.fill" : "phone")
                                    .foregroundStyle(monitor.connected ? .green : .primary)
                                Spacer()
                                Button("새로고침") { monitor.refresh(reason:"홈 화면 수동 조회") }
                                    .buttonStyle(.bordered)
                            }
                            Text("통화가 연결되면 단축어에서 명령음 재생을 시도합니다. 실제 전화 화면의 녹음 시작 여부는 아이폰에서 확인해야 합니다.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }.padding(.vertical,6)
                    }
                    DisclosureGroup("버튼 위치가 다를 때만 조정",isExpanded:$showAdvanced) {
                        VStack(alignment:.leading,spacing:8) {
                            Text("iOS 격자 번호는 화면과 설정에 따라 달라집니다. 기본값 4가 녹음 버튼을 누르지 않으면 번호를 바꿔 시험하십시오.")
                                .font(.caption)
                            Picker("격자 번호",selection:$grid.tapCell) {
                                ForEach(1...9,id:\.self) { n in
                                    Text(String(n)).tag(n)
                                }
                            }.pickerStyle(.segmented)
                            Button("선택 위치 명령 만들기") { Task { await grid.prepare() } }
                                .buttonStyle(.bordered)
                        }
                    }
                    .padding(12)
                    .background(Color(uiColor:.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius:12))
                    Button("연결 기록 및 오류 보기") {
                        monitor.refresh()
                        showDiagnostics = true
                    }.font(.subheadline)
                    Text("주의: iOS가 통화 중 자기 스피커의 명령을 인식하는지, 화면을 실제로 누르는지는 아직 실기기 검증되지 않았습니다. 자동 녹음 성공을 보장하지 않습니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }.padding()
            }
            .navigationTitle("HITEL 통화 녹음 실험")
            .navigationDestination(isPresented:$showDiagnostics) {
                ProbeDiagnosticsScreen(monitor:monitor)
            }
            .task { _ = await grid.prepare() }
        }
    }
}
