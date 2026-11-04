import SwiftUI
import UIKit

/// First-run experience: 5 small steps, one primary action per screen.
/// Settings/Shortcuts cannot be silently configured by a sandboxed iOS app.
struct ProbeHomeScreen: View {
    @ObservedObject var monitor: CallConnectionMonitor
    @StateObject private var audio = VoiceCommandAudioStore()
    @AppStorage("hitel.callprobe.onboardingStep") private var step = 0
    @AppStorage("hitel.callprobe.accessibilityMarked") private var accessibilityMarked = false
    @AppStorage("hitel.callprobe.gestureMarked") private var gestureMarked = false
    @AppStorage("hitel.callprobe.shortcutMarked") private var shortcutMarked = false
    @State private var showDiagnostics = false

    private let headings = [
        "명령 소리 만들기",
        "음성 명령 켜기",
        "녹음 버튼 누르는 명령 만들기",
        "전화 자동화 연결하기",
        "실제 시험하기"
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    intro
                    progress
                    mainStep
                    if step > 0 {
                        Button("이전 단계") { step = max(step - 1, 0) }
                            .foregroundStyle(.secondary)
                    }
                    Button("통화 감지 상태와 측정 로그 보기") {
                        monitor.refresh()
                        showDiagnostics = true
                    }
                    .font(.subheadline)
                    .padding(.top, 6)
                    Text("중요: iOS가 허용하지 않는 음성 명령 등록·통화 버튼 터치는 앱이 직접 설정할 수 없습니다. 연결 중 오디오가 재생되더라도 실제 통화 녹음 성공은 보장되지 않습니다.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("자동 녹음 설정 도우미")
            .navigationDestination(isPresented: $showDiagnostics) {
                ProbeDiagnosticsScreen(monitor: monitor)
            }
            .onAppear { audio.generateIfNeeded() }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text("한 번만 따라 해 주세요")
                .font(.title2.bold())
            Text("복잡한 용어 없이 5단계를 마치면 통화 연결 감지와 음성 명령 재생을 시험할 수 있습니다. 만든 파일은 iPhone에 저장됩니다.")
                .font(.subheadline).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }

    private var progress: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("설정 \(step + 1) / 5")
                .font(.subheadline.bold())
            ProgressView(value: Double(step + 1), total: 5)
            Text(headings[step])
                .font(.title3.bold())
        }
    }

    @ViewBuilder
    private var mainStep: some View {
        switch step {
        case 0: voiceStep
        case 1: accessibilityStep
        case 2: gestureStep
        case 3: shortcutStep
        default: testingStep
        }
    }

    private var voiceStep: some View {
        VStack(alignment: .leading, spacing: 15) {
            explanation("앱이 사람 목소리 대신 영어로 “Start Recording”을 읽은 소리를 직접 만듭니다. 사용자의 마이크 녹음이 필요하지 않습니다.")
            VStack(alignment: .leading, spacing: 8) {
                Label(audio.ready ? "소리 파일 준비 완료" : "소리 파일 만드는 중", systemImage: audio.ready ? "checkmark.circle.fill" : "waveform")
                    .font(.headline)
                Text(audio.status).font(.footnote).foregroundStyle(.secondary)
                Text("저장 위치: 파일 > 나의 iPhone > HITEL 연결 검증")
                    .font(.caption).foregroundStyle(.secondary)
                Text("파일 이름: HITEL-Start-Recording.wav")
                    .font(.caption).foregroundStyle(.secondary)
            }
            if !audio.ready {
                Button("영어 명령 음성 파일 만들기") { audio.generate() }
                    .buttonStyle(.borderedProminent).disabled(audio.busy)
            }
            Button("저장된 소리 들어 보기") { audio.play() }
                .buttonStyle(.bordered)
                .disabled(!audio.ready)
            if audio.ready {
                ShareLink(item: VoiceCommandAudioStore.commandURL) {
                    Label("파일 앱·메시지로 음성 내보내기", systemImage: "square.and.arrow.up")
                }.buttonStyle(.bordered)
            }
            nextButton("이 소리로 진행하기", enabled: audio.ready)
        }
        .groupBoxStyleHint()
    }

    private var accessibilityStep: some View {
        VStack(alignment: .leading, spacing: 13) {
            explanation("아이폰에 “음성 명령” 기능을 켜는 단계입니다. 이 작업은 처음 한 번만 하시면 됩니다.")
            steps(["아래 ‘아이폰 설정 열기’를 누르세요.",
                   "설정 → 손쉬운 사용 → 음성 명령으로 이동하세요.",
                   "음성 명령을 켜세요. 처음이라면 언어 파일을 내려받으세요.",
                   "언어는 영어(미국)를 선택해 주세요."])
            Button("아이폰 설정 열기") { ProbeSystemNavigator.voiceControl() }
                .buttonStyle(.borderedProminent)
            Text("해당 세부 화면을 직접 여는 것은 iOS에서 보장되지 않습니다. 다른 화면이 열리면 위 경로를 따라가시면 됩니다.")
                .font(.caption).foregroundStyle(.secondary)
            Toggle("음성 명령을 직접 켰습니다", isOn: $accessibilityMarked)
            nextButton("다음: 명령 등록", enabled: accessibilityMarked)
        }.groupBoxStyleHint()
    }

    private var gestureStep: some View {
        VStack(alignment: .leading, spacing: 13) {
            explanation("음성 명령에 ‘Start Recording’이라는 소리가 들리면 전화의 녹음 버튼을 누르는 동작을 등록합니다.")
            steps(["설정 → 손쉬운 사용 → 음성 명령 → 명령 사용자화를 여세요.",
                   "‘새로운 명령 생성’을 선택하세요.",
                   "문구 입력 칸에 아래 영어를 붙여넣으세요.",
                   "동작을 ‘사용자 설정 제스처 실행’으로 선택하세요.",
                   "통화 화면의 녹음 버튼 위치를 누르는 제스처를 기록해 저장하세요."])
            HStack {
                Text(VoiceCommandAudioStore.phrase)
                    .font(.title3.monospaced())
                    .textSelection(.enabled)
                Spacer()
                Button("문구 복사") {
                    UIPasteboard.general.string = VoiceCommandAudioStore.phrase
                }.buttonStyle(.borderedProminent)
            }
            .padding()
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            recordingPositionExample
            Button("음성 명령 설정 다시 열기") { ProbeSystemNavigator.voiceControl() }
                .buttonStyle(.bordered)
            Toggle("명령과 터치 위치를 저장했습니다", isOn: $gestureMarked)
            nextButton("다음: 자동 실행 연결", enabled: gestureMarked)
        }.groupBoxStyleHint()
    }

    private var shortcutStep: some View {
        VStack(alignment: .leading, spacing: 13) {
            explanation("통화가 연결되면 앞에서 만든 음성을 재생하도록 단축어를 만듭니다. 앱에서 ‘연결 감지 + 소리 재생’을 한 동작으로 제공합니다.")
            steps(["아래 ‘단축어 앱 열기’를 누르세요.",
                   "‘자동화’ → ‘+’ → ‘앱’을 선택하세요.",
                   "앱을 ‘전화’로, 조건을 ‘열릴 때’로 지정하세요.",
                   "‘즉시 실행’을 선택하고 새 빈 자동화를 만드세요.",
                   "동작 검색에서 ‘HITEL 연결되면 녹음 명령 재생’을 한 개 추가하세요.",
                   "자동화를 저장하고 이 앱으로 돌아오세요."])
            Button("단축어 앱 열기") { ProbeSystemNavigator.shortcuts() }
                .buttonStyle(.borderedProminent)
            Button("새 단축어 편집 화면 열기") { ProbeSystemNavigator.createShortcut() }
                .buttonStyle(.bordered)
            Text("전화 앱이 열리는 시점은 실제 연결 시점과 다릅니다. HITEL 동작이 최대 15초 동안 연결을 기다리지만, iOS가 백그라운드 단축어를 중단할 수 있습니다.")
                .font(.footnote).foregroundStyle(.secondary)
            Toggle("단축어 자동화를 저장했습니다", isOn: $shortcutMarked)
            nextButton("다음: 실제 동작 확인", enabled: shortcutMarked)
        }.groupBoxStyleHint()
    }

    private var testingStep: some View {
        VStack(alignment: .leading, spacing: 14) {
            explanation("설정을 마쳤습니다. 안전하게 순서대로 시험하시고, 녹음이 실제 생성되었는지 직접 확인하세요.")
            steps(["통화를 하지 않은 상태에서 ‘명령음 시험 재생’을 눌러 인식 여부를 확인하세요.",
                   "상대방의 녹음 동의를 받은 다음 전화 연결 시험을 진행하세요.",
                   "통화가 연결되면 접근성 명령이 녹음 버튼을 눌렀는지 확인하세요.",
                   "통화 종료 후 메모 앱에 녹음 파일이 생성됐는지 확인하세요."])
            Button("명령음 시험 재생") { audio.play() }
                .buttonStyle(.borderedProminent).disabled(!audio.ready)
            Text(audio.status).font(.caption).foregroundStyle(.secondary)
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("전화 연결 상태").font(.headline)
                    Text(monitor.connected ? "연결됨" : "현재 연결된 전화 없음")
                    Text("실제 기록은 상태·로그 메뉴에서 확인하세요.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Button("새로고침") { monitor.refresh(reason: "완료 화면 수동 갱신") }
                    .buttonStyle(.bordered)
            }
            .padding()
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            Button("설정 단계 다시 시작") { step = 0 }
                .buttonStyle(.bordered)
            Text("녹음 시작을 보장하는 기능이 아니라, 접근성 자동화 실험입니다. 정상 통화 중에도 오디오가 차단될 수 있습니다.")
                .font(.footnote).foregroundStyle(.secondary)
        }.groupBoxStyleHint()
    }

    private var recordingPositionExample: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("화면 위치 안내(실제 전화 화면이 아닌 예시)")
                .font(.caption.bold()).foregroundStyle(.secondary)
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 15)
                    .fill(Color(uiColor: .secondarySystemGroupedBackground))
                    .frame(height: 145)
                VStack(alignment: .leading, spacing: 12) {
                    Label("이 부근에 iOS 18 녹음 아이콘", systemImage: "waveform.circle.fill")
                        .foregroundStyle(.blue)
                        .font(.subheadline.bold())
                    Text("실제 통화가 연결된 화면을 보고 위치를 확인하신 뒤 제스처를 기록하세요.")
                        .font(.caption)
                    Spacer()
                    HStack {
                        Spacer()
                        Label("통화 중", systemImage: "phone.fill")
                        Spacer()
                    }
                }.padding(15)
            }
        }
    }

    private func explanation(_ message: String) -> some View {
        Text(message)
            .font(.body)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func steps(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 11) {
            ForEach(items.indices, id: \.self) { i in
                HStack(alignment: .top, spacing: 9) {
                    Text("\(i + 1)")
                        .font(.caption.bold())
                        .foregroundStyle(.white)
                        .frame(width: 23, height: 23)
                        .background(Color.blue)
                        .clipShape(Circle())
                    Text(items[i]).fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func nextButton(_ title: String, enabled: Bool) -> some View {
        Button {
            step = min(step + 1, 4)
        } label: {
            HStack {
                Spacer()
                Text(title).fontWeight(.semibold)
                Image(systemName: "arrow.right")
                Spacer()
            }.padding(.vertical, 7)
        }
        .buttonStyle(.borderedProminent)
        .disabled(!enabled)
    }
}

private extension View {
    func groupBoxStyleHint() -> some View {
        self.padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(uiColor: .systemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 15))
    }
}
