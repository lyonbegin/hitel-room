import SwiftUI
import ReplayKit
import UIKit

private let screenGroup = "group.app.hitel.native.screen"
private let broadcastBundleId = "app.hitel.native.broadcast"

/// Android's physical-phone mode equivalent for a real, Apple-signed iPhone.
/// The actual full-device capture happens exclusively in the ReplayKit extension.
struct HitelPhysicalBroadcastSetup: View {
    @State private var pin = ""
    @State private var saved = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("실제 iPhone 화면 공유").font(.title2).bold()
                    Text("컴퓨터의 HITEL SDK Lab에서 '실제 iPhone 연결 준비'를 누르신 뒤 표시된 8자리 연결코드를 입력하십시오.")
                        .font(.subheadline)
                    TextField("8자리 연결코드", text: $pin)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .onChange(of: pin) { next in
                            pin = String(next.filter(\.isNumber).prefix(8))
                            saved = false
                        }
                        .padding(12)
                        .background(Color(uiColor: .secondarySystemBackground))
                        .cornerRadius(10)
                    Button("연결코드 저장") {
                        guard pin.count == 8 else { return }
                        UserDefaults(suiteName: screenGroup)?.set(pin, forKey: "broadcastCode")
                        UserDefaults(suiteName: screenGroup)?.removeObject(forKey: "broadcastDeviceKey")
                        saved = true
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(pin.count != 8)
                    if saved {
                        Label("연결코드를 저장했습니다. 아래 화면 방송 버튼을 누르십시오.", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green).font(.footnote)
                    }
                    VStack(alignment: .leading, spacing: 9) {
                        Text("iPhone 화면 방송 시작").font(.headline)
                        Text("방송 대상을 'HitelScreenBroadcast'로 선택하고 '방송 시작'을 눌러 주십시오. 아이폰의 다른 앱과 홈 화면도 전송할 수 있습니다.")
                            .font(.footnote)
                        HitelBroadcastPicker()
                            .frame(width: 70, height: 70)
                        Text("방송 중에는 iPhone 상단의 화면 공유 표시가 나타납니다. 중지하려면 화면 방송 메뉴에서 방송 중지를 선택하십시오.")
                            .font(.footnote)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .cornerRadius(14)
                    Text("화면 전송만 지원하며 웹에서 터치·키보드 원격 제어는 하지 않습니다. iOS 앱 서명과 App Group 구성이 필요합니다.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding(18)
            }
            .navigationTitle("HITEL Screen")
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                Button("닫기") { dismiss() }
            }}
            .onAppear {
                pin = UserDefaults(suiteName: screenGroup)?.string(forKey: "broadcastCode") ?? ""
                saved = pin.count == 8
            }
        }
    }
}

struct HitelBroadcastPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 70, height: 70))
        picker.preferredExtension = broadcastBundleId
        picker.showsMicrophoneButton = false
        return picker
    }
    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}
