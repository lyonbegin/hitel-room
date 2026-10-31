import SwiftUI
import ReplayKit
import UIKit

// Free Apple ID: no App Group entitlement or pasteboard sharing is needed.
// The ReplayKit setup extension requests the eight-digit code directly
// and sends it to the broadcast upload extension in setupInfo.
struct HitelPhysicalBroadcastSetup: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("실제 iPhone 전체 화면 방송").font(.title2.bold())
                    Text("Windows의 HITEL SDK Lab에서 '실제 iPhone 연결 준비'를 누르신 후, 다음 단계의 방송 설정 창에서 연결코드를 직접 입력하십시오.")
                        .font(.subheadline)
                    Text("① 화면 방송 연결 시작 → ② HITEL 방송 설정 창에서 8자리 입력 → ③ 방송 시작")
                        .font(.subheadline.bold())
                        .padding(10)
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .cornerRadius(8)
                    HitelBroadcastLaunchView()
                        .frame(height: 165)
                    Text("기존의 '연결코드 저장'은 필요하지 않습니다. 앱과 방송 확장 사이에서 클립보드를 읽지 않습니다.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Text("본인의 무료 Apple ID로 설치한 앱에서도 이 방식은 공유 App Group 권한을 요구하지 않습니다. 화면은 원격 제어 없이 방송만 수행합니다.")
                        .font(.footnote)
                }
                .padding(18)
            }
            .navigationTitle("HITEL Screen")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("닫기") { dismiss() }
                }
            }
        }
    }
}

private struct HitelBroadcastLaunchView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> HitelBroadcastLaunchController {
        HitelBroadcastLaunchController()
    }
    func updateUIViewController(_ uiViewController: HitelBroadcastLaunchController, context: Context) {}
}

final class HitelBroadcastLaunchController: UIViewController,
    RPBroadcastActivityViewControllerDelegate, RPBroadcastControllerDelegate {

    private var controller: RPBroadcastController?
    private let info = UILabel()
    private let begin = UIButton(type: .system)
    private let stop = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        begin.setTitle("화면 방송 연결 시작", for: .normal)
        begin.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        begin.accessibilityIdentifier = "hitel-start-broadcast-setup"
        begin.addTarget(self, action: #selector(openSetup), for: .touchUpInside)
        begin.backgroundColor = .systemBlue
        begin.setTitleColor(.white, for: .normal)
        begin.layer.cornerRadius = 10
        begin.heightAnchor.constraint(equalToConstant: 48).isActive = true

        stop.setTitle("방송 중지", for: .normal)
        stop.addTarget(self, action: #selector(stopBroadcast), for: .touchUpInside)
        stop.isEnabled = false

        info.text = "HITEL 방송 설정에서 8자리 코드를 입력하십시오."
        info.numberOfLines = 0
        info.textAlignment = .center
        info.font = .preferredFont(forTextStyle: .footnote)

        let stack = UIStackView(arrangedSubviews: [begin, stop, info])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.topAnchor.constraint(equalTo: view.topAnchor)
        ])
    }

    @objc private func openSetup() {
        info.text = "ReplayKit 방송 설정 화면을 여는 중입니다."
        RPBroadcastActivityViewController.load(
            withPreferredExtension: "app.hitel.native.broadcastsetup") { [weak self] activity, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let error = error {
                    self.info.text = "방송 설정 실패: " + error.localizedDescription
                    return
                }
                guard let activity = activity else {
                    self.info.text = "방송 설정 화면을 열 수 없습니다. 방송 확장이 설치되어 있는지 확인하십시오."
                    return
                }
                activity.delegate = self
                activity.modalPresentationStyle = .fullScreen
                self.present(activity, animated: true)
            }
        }
    }

    func broadcastActivityViewController(_ activity: RPBroadcastActivityViewController,
        didFinishWith broadcastController: RPBroadcastController?, error: Error?) {
        activity.dismiss(animated: true) { [weak self] in
            guard let self = self else { return }
            if let error = error {
                self.info.text = "방송 설정 오류: " + error.localizedDescription
                return
            }
            guard let broadcast = broadcastController else {
                self.info.text = "방송 시작이 취소되었습니다."
                return
            }
            self.controller = broadcast
            broadcast.delegate = self
            broadcast.startBroadcast { [weak self] error in
                DispatchQueue.main.async {
                    if let error = error {
                        self?.info.text = "방송 시작 실패: " + error.localizedDescription
                    } else {
                        self?.info.text = "방송 시작 요청 성공 · SDK Lab 영상 수신을 확인하십시오."
                        self?.stop.isEnabled = true
                        self?.begin.isEnabled = false
                    }
                }
            }
        }
    }

    func broadcastController(_ broadcastController: RPBroadcastController,
        didFinishWithError error: Error?) {
        DispatchQueue.main.async {
            self.controller = nil
            self.stop.isEnabled = false
            self.begin.isEnabled = true
            self.info.text = error == nil ? "방송이 종료되었습니다." : "방송 오류: " + error!.localizedDescription
        }
    }

    @objc private func stopBroadcast() {
        controller?.finishBroadcast { [weak self] error in
            DispatchQueue.main.async {
                self?.stop.isEnabled = false
                self?.begin.isEnabled = true
                self?.info.text = error == nil ? "방송을 종료했습니다." : "방송 종료 오류: " + error!.localizedDescription
                self?.controller = nil
            }
        }
    }
}
