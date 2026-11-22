import Foundation
import Security

/// A host-app-only resume credential. Free Apple ID Personal Team builds do
/// not share App Groups with ReplayKit extensions. Store this in Keychain and
/// send a signed app-awake signal after the iPhone is unlocked and HITEL opens.
enum HitelIphoneResume {
    private static let account = "physical-iphone-resume-v1"
    private static let service = "app.hitel.native.physical-iphone"
    private static let base = "https://hitel-communication-web-production.up.railway.app/lab-sandbox/physical-iphone"

    static func savedCredential() -> String? {
        let q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              value.count == 64 else { return nil }
        return value
    }

    @discardableResult
    static func saveCredential(_ value: String) -> Bool {
        guard value.count == 64,
              value.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }),
              let bytes = value.data(using: .utf8) else { return false }
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let update: [String: Any] = [kSecValueData as String: bytes]
        let status = SecItemUpdate(identity as CFDictionary, update as CFDictionary)
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }
        var add = identity
        add[kSecValueData as String] = bytes
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }

    struct WakeStatus {
        let paired: Bool
        let online: Bool
    }

    static func notifyAwake() async throws -> WakeStatus? {
        guard let secret = savedCredential(),
              let url = URL(string: base + "/app-awake") else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 12
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["resumeToken": secret])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              body["ok"] as? Bool == true else {
            throw NSError(domain: "HITEL.iPhone.Resume", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "기존 HITEL 연결을 찾을 수 없습니다. 새 연결코드 등록이 필요할 수 있습니다."])
        }
        return WakeStatus(paired: body["paired"] as? Bool == true,
                          online: body["online"] as? Bool == true)
    }
}
