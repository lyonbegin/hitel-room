import SwiftUI
import ReplayKit
import UIKit

/// iOS 18+ screen sharing uses the system broadcast picker.
/// The removed RPBroadcastActivityViewController is deprecated and can return
/// ReplayKit userDeclined (-5801) even when the old setup UI cannot start.
/// Free Apple ID builds cannot share App Groups with broadcast extensions:
/// a one-time PIN prepares a short-lived server session, and the viewer must
/// separately approve the arriving broadcast BEFORE any frames are forwarded.
struct HitelPhysicalBroadcastSetup: View {
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var registered = false
    @State private var previousConnection = false
    @State private var busy = false
    @State private var message = "관리 웹의 8자리 연결코드를 입력해 주십시오."
    private let endpoint = URL(string:
        "https://hitel-communication-web-production.up.railway.app/lab-sandbox/physical-iphone/prepare")!

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 17) {
                    Text("실제 iPhone 전체 화면 공유").font(.title2.bold())
                    Text(registered && previousConnection
                         ? "기존 HITEL 연결이 복구되었습니다. 8자리 코드를 다시 입력하실 필요가 없습니다."
                         : "① 관리 웹에서 실제 iPhone 연결 준비를 누르고 8자리 코드를 확인하십시오.")
                    TextField("8자리 연결코드", text: $code)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .font(.title3.monospacedDigit())
                        .textFieldStyle(.roundedBorder)
                        .onChange(of: code) { next in
                            let digits = next.filter { $0.isASCII && $0.isNumber }
                            if code != String(digits.prefix(8)) { code = String(digits.prefix(8)) }
                            registered = false
                            previousConnection = false
                        }
                    Button(busy ? "서버 연결 중…" : "② 연결코드를 서버에 등록") {
                        registerCode()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(code.count != 8 || busy)
                    if registered {
                        Text("③ 아래 Apple 시스템 방송 버튼을 누르신 뒤 HitelScreenBroadcast를 선택하고 '방송 시작'을 승인하십시오.")
                            .font(.subheadline.bold())
                        HitelSystemBroadcastButton()
                            .frame(width: 70, height: 75)
                            .frame(maxWidth: .infinity)
                        Text(previousConnection
                             ? "④ 이전에 승인하신 웹 세션에 자동으로 복귀합니다. 웹에서 추가 승인 없이 영상 수신을 다시 시작합니다."
                             : "④ 첫 연결에서는 Windows 관리 웹에서 '방송 연결 승인'을 눌러 주십시오.")
                            .font(.subheadline)
                    }
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(registered ? .green : .secondary)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("구형 ReplayKit 방송 설정 화면은 사용하지 않습니다. 무료 Apple ID 테스트용 앱은 승인된 기기의 화면만 전송하며, 웹 원격 조작은 제공하지 않습니다.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(18)
            }
            .navigationTitle("HITEL Screen")
            .onAppear { restoreSessionIfPresent() }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("닫기") { dismiss() }
                }
            }
        }
    }

    private func restoreSessionIfPresent() {
        guard HitelIphoneResume.savedCredential() != nil else { return }
        busy = true
        message = "기존 연결정보로 관리 서버에 앱 재기동 신호를 전송하고 있습니다."
        Task {
            do {
                if let state = try await HitelIphoneResume.notifyAwake() {
                    registered = true
                    previousConnection = state.paired
                    message = state.online
                        ? "이전 화면 방송이 연결되어 있습니다."
                        : "이전 웹 연결을 복구했습니다. 아래 시스템 방송 버튼으로 영상을 다시 시작해 주십시오."
                }
            } catch {
                registered = false
                message = "기존 연결 복구 실패: " + error.localizedDescription
            }
            busy = false
        }
    }

    private func registerCode() {
        guard code.count == 8 && code.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else {
            message = "8자리 숫자를 입력해 주십시오."
            return
        }
        let submitted = code
        busy = true
        registered = false
        message = "연결코드를 관리 서버에서 확인하고 있습니다."
        Task {
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: ["code": submitted])
            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                let http = response as? HTTPURLResponse
                let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                if http?.statusCode == 200 && (json?["ok"] as? Bool) == true {
                    let secret = json?["resumeToken"] as? String ?? ""
                    let saved = HitelIphoneResume.saveCredential(secret)
                    registered = true
                    previousConnection = false
                    message = saved
                        ? "서버가 연결코드를 확인했습니다. 향후 앱 재기동 시 기존 연결정보로 자동 복구합니다. 첫 방송은 관리 웹에서 승인하십시오."
                        : "서버 연결에는 성공했지만 재연결 인증정보를 아이폰에 저장하지 못했습니다. 방송은 시작할 수 있으나 자동 복구는 사용할 수 없습니다."
                } else {
                    message = "코드 등록 실패: " + (json?["error"] as? String ?? "서버 응답 오류")
                }
            } catch {
                message = "연결 실패: " + error.localizedDescription
            }
            busy = false
        }
    }
}

/// Apple-owned UI is directly tapped by the device user. Never programmatically
/// click internal system picker subviews or bypass screen-capture consent.
struct HitelSystemBroadcastButton: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let view = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 70, height: 70))
        let location = Bundle.main.builtInPlugInsURL?
            .appendingPathComponent("HitelScreenBroadcast.appex")
        if let url = location, let extBundle = Bundle(url: url) {
            view.preferredExtension = extBundle.bundleIdentifier
        }
        view.showsMicrophoneButton = false
        return view
    }
    func updateUIView(_ view: RPSystemBroadcastPickerView, context: Context) {}
}
