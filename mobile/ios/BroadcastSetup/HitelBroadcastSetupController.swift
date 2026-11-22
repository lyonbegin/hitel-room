import UIKit
import ReplayKit

/// ReplayKit runs this setup screen in its own extension process.
/// A free Apple ID cannot use the App Groups entitlement, so the code
/// is entered here and passed via the official setupInfo dictionary.
final class HitelBroadcastSetupController: UIViewController {
    private let pinField = UITextField()
    private let message = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let title = UILabel()
        title.text = "HITEL 실제 iPhone 연결"
        title.font = .preferredFont(forTextStyle: .title2)
        title.adjustsFontForContentSizeCategory = true
        title.textAlignment = .center

        let instructions = UILabel()
        instructions.text = "PC의 HITEL SDK Lab에 표시된 8자리 연결코드를 아래에 입력하십시오. 이 화면에서 확인해야 방송 확장으로 코드가 직접 전달됩니다."
        instructions.numberOfLines = 0
        instructions.textAlignment = .center
        instructions.font = .preferredFont(forTextStyle: .subheadline)

        pinField.placeholder = "8자리 연결코드"
        pinField.keyboardType = .numberPad
        pinField.textContentType = .oneTimeCode
        pinField.textAlignment = .center
        pinField.font = .monospacedDigitSystemFont(ofSize: 28, weight: .bold)
        pinField.backgroundColor = .secondarySystemBackground
        pinField.layer.cornerRadius = 10
        pinField.heightAnchor.constraint(equalToConstant: 60).isActive = true
        pinField.addTarget(self, action: #selector(validateCode), for: .editingChanged)

        let begin = UIButton(type: .system)
        begin.setTitle("연결하고 화면 방송 시작", for: .normal)
        begin.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        begin.accessibilityIdentifier = "hitel-broadcast-setup-confirm"
        begin.addTarget(self, action: #selector(completeSetup), for: .touchUpInside)
        begin.heightAnchor.constraint(equalToConstant: 52).isActive = true

        message.text = "HITEL 앱의 '연결코드 저장' 버튼은 더 이상 필요하지 않습니다."
        message.numberOfLines = 0
        message.textColor = .secondaryLabel
        message.textAlignment = .center
        message.font = .preferredFont(forTextStyle: .footnote)

        let cancel = UIButton(type: .system)
        cancel.setTitle("취소", for: .normal)
        cancel.addTarget(self, action: #selector(cancelSetup), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [title, instructions, pinField, begin, message, cancel])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 22),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -22),
            stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
        ])
    }

    @objc private func validateCode() {
        let digits = (pinField.text ?? "").filter { $0.isNumber && $0.isASCII }
        if digits != pinField.text || digits.count > 8 {
            pinField.text = String(digits.prefix(8))
        }
    }

    @objc private func completeSetup() {
        let code = pinField.text ?? ""
        guard code.count == 8 && code.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else {
            message.text = "8자리 숫자를 정확히 입력하십시오."
            message.textColor = .systemRed
            return
        }
        pinField.resignFirstResponder()
        // The setup UI extension passes the code directly to the upload
        // extension, without pasteboard or shared UserDefaults.
        let metadata: [String: NSCoding & NSObjectProtocol] = ["hitelPairCode": code as NSString]
        let destination = URL(string: "https://hitel-communication-web-production.up.railway.app/sdk-lab")!
        extensionContext?.completeRequest(withBroadcast: destination, setupInfo: metadata)
    }

    @objc private func cancelSetup() {
        extensionContext?.cancelRequest(withError: NSError(
            domain: "HITEL.ReplayKit.Setup", code: -1,
            userInfo: [NSLocalizedDescriptionKey: "사용자가 화면 방송 준비를 취소했습니다."]))
    }
}
