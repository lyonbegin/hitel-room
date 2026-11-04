import SwiftUI

struct ProbeHomeScreen: View {
    @ObservedObject var monitor: CallConnectionMonitor
    @StateObject private var voice = VoiceCommandSpeaker()

    private var stateText: String {
        switch monitor.state {
        case "connected": return "통화 연결 확인"
        case "dialing": return "발신 중 — 연결 전"
        case "ringing": return "전화 수신 중"
        case "held": return "통화 보류 중"
        default: return "현재 통화 없음"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    GroupBox("iPhone XR · iOS 18.7 전용 통화 연결 시험") {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(stateText)
                                .font(.title3.bold())
                                .foregroundStyle(monitor.connected ? .green : .primary)
                            LabeledContent("CallKit", value: monitor.state)
                            LabeledContent("연결된 통화", value: monitor.connected ? "TRUE" : "FALSE")
                            LabeledContent("활성 통화 수", value: String(monitor.count))
                            LabeledContent("마지막 조회", value: monitor.lastChecked)
                            Button("현재 통화 상태 다시 읽기") { monitor.refresh() }
                                .buttonStyle(.borderedProminent)
                        }.padding(.vertical, 8)
                    }
                    GroupBox("음성 명령 재생 단독 시험") {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("설정 > 손쉬운 사용 > 음성 명령에서 'Start Recording' 사용자 지정 제스처를 만든 다음 아래 버튼으로 재생을 시험하십시오.")
                                .font(.subheadline)
                            HStack {
                                Button("Start Recording 재생") { voice.play() }
                                    .buttonStyle(.borderedProminent)
                                Button("중지") { voice.stop() }
                                    .buttonStyle(.bordered)
                            }
                            Text(voice.status).font(.caption).foregroundStyle(.secondary)
                            Text("이 버튼은 직접 통화 녹음을 시작하지 않습니다. iOS가 통화 중 합성음 재생을 중단할 수 있으며, 음성 명령 인식도 보장되지 않습니다.")
                                .font(.caption).foregroundStyle(.secondary)
                        }.padding(.vertical, 8)
                    }
                    GroupBox("단축어 연결 시험") {
                        VStack(alignment: .leading, spacing: 9) {
                            Text("단축어 앱에서 'HITEL 통화 연결 여부 확인' 또는 'HITEL 통화 연결 대기 (최대 15초)'를 검색하십시오.")
                            Text("연결 대기의 결과가 TRUE일 때만 '텍스트 말하기'로 Start Recording을 출력하도록 설정하십시오.")
                            Text("전화 앱 열림 자동화는 실제 통화 연결 트리거가 아닙니다. 잠금 화면·백그라운드·기본 전화 앱 실행 중에는 자동화가 중단될 수 있습니다.")
                                .foregroundStyle(.secondary)
                        }.font(.subheadline).padding(.vertical, 8)
                    }
                    GroupBox("측정 로그 — 실기기 증거") {
                        VStack(alignment: .leading, spacing: 9) {
                            HStack {
                                Button("로그 갱신") { monitor.refresh(reason: "로그 수동 갱신") }
                                Spacer()
                                Button("초기화", role: .destructive) { monitor.clearEvents() }
                            }.buttonStyle(.bordered)
                            if monitor.recentEvidence.isEmpty {
                                Text("기록 없음").foregroundStyle(.secondary)
                            }
                            ForEach(monitor.recentEvidence, id: \.self) { entry in
                                Text(entry)
                                    .font(.system(size: 11, design: .monospaced))
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                Divider()
                            }
                        }.padding(.vertical, 8)
                    }
                    Text("이 앱은 전화 상대방 음성을 녹음하지 않으며, 녹음 버튼을 직접 터치하지 않습니다. CallKit은 통신사 통화와 일부 VoIP 통화를 구분하지 못합니다. 실기기에서 성공 여부를 확인해야 합니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .padding()
            }
            .navigationTitle("HITEL 연결 검증")
        }
    }
}
