import Foundation
import Security

/// Unique persistent identity of this FEATURE APP installation.
/// The already-working ReplayKit screen-streaming app is completely separate.
/// No PIN, QR pairing, WKWebView bridge or platform tracking identifier.
final class HitelCallDeviceClient {
    private let keyService = "app.hitel.call.device.identity.v1"
    private let base = "https://hitel-communication-web-production.up.railway.app/lab-sandbox/playground"
    private var socket: URLSessionWebSocketTask?
    private var active = false
    private var retry = false
    private var registrationInProgress = false
    private var registeredId = ""
    private var registeredSecret = ""

    var onPageURL: ((String) -> Void)?
    var onStatus: ((String) -> Void)?
    var onAssignment: (([String: Any]) -> Void)?

    private func load(_ account:String) -> String? {
        let query:[String:Any]=[
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:keyService,
            kSecAttrAccount as String:account,
            kSecReturnData as String:true,
            kSecMatchLimit as String:kSecMatchLimitOne
        ]
        var output:CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary,&output)==errSecSuccess,
              let data=output as? Data else{return nil}
        return String(data:data,encoding:.utf8)
    }
    private func store(_ account:String,_ value:String) {
        let identity:[String:Any]=[
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:keyService,
            kSecAttrAccount as String:account
        ]
        guard let data=value.data(using:.utf8) else{return}
        if SecItemUpdate(identity as CFDictionary,[kSecValueData as String:data] as CFDictionary)==errSecSuccess {return}
        var insert=identity
        insert[kSecValueData as String]=data
        insert[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(insert as CFDictionary,nil)
    }

    // The Keychain can temporarily be unavailable on a freshly booted
    // Simulator or before first unlock. Keep an app-sandboxed, protected,
    // non-backed-up copy so a restart can NEVER silently rotate the public
    // per-install control URL. This is not shared with the ReplayKit app.
    private struct IdentityRecord: Codable {
        let id: String
        let secret: String
    }
    private func identityFile() -> URL? {
        guard let dir = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        ).first else { return nil }
        do {
            try FileManager.default.createDirectory(
                at: dir, withIntermediateDirectories: true
            )
            return dir.appendingPathComponent("hitel-call-device-identity-v1.json")
        } catch { return nil }
    }
    private func valid(_ record: IdentityRecord) -> Bool {
        UUID(uuidString: record.id) != nil &&
            record.secret.count == 64 &&
            record.secret.allSatisfy { $0.isHexDigit }
    }
    private func persistedIdentity() -> IdentityRecord? {
        if let url = identityFile(),
           let data = try? Data(contentsOf: url),
           let record = try? JSONDecoder().decode(IdentityRecord.self, from: data),
           valid(record) {
            return record
        }
        guard let id = load("id"), let secret = load("secret") else {
            return nil
        }
        let record = IdentityRecord(id: id, secret: secret)
        return valid(record) ? record : nil
    }
    @discardableResult
    private func persistIdentity(_ record: IdentityRecord) -> Bool {
        guard valid(record), let url = identityFile(),
              let data = try? JSONEncoder().encode(record) else { return false }
        do {
            try data.write(to: url, options: [.atomic])
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: url.path
            )
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try url.setResourceValues(values)
        } catch { return false }
        // The Keychain remains the primary native security store where
        // available. A failed SecItemAdd must not lose identity on restart.
        store("id", record.id)
        store("secret", record.secret)
        guard let reloaded = persistedIdentity() else { return false }
        return reloaded.id == record.id && reloaded.secret == record.secret
    }

    private func cryptoSecret()->String {
        var bytes=[UInt8](repeating:0,count:32)
        let ok=SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)
        guard ok==errSecSuccess else{return ""}
        return bytes.map{String(format:"%02x",$0)}.joined()
    }
    private func beginRegistration() {
        guard active && !registrationInProgress && socket == nil else{return}
        registrationInProgress=true
        Task{
            await connectIdentity()
            DispatchQueue.main.async {self.registrationInProgress=false}
        }
    }
    func start() {
        guard !active else{return}
        active=true
        beginRegistration()
    }
    func resume() {
        if !active {start();return}
        if socket==nil {beginRegistration()}
    }
    private func connectIdentity() async {
        let previous = persistedIdentity()
        var id = previous?.id ?? UUID().uuidString.lowercased()
        var secret = previous?.secret ?? cryptoSecret()
        #if targetEnvironment(simulator)
        // Explicit simulation-only credentials permit GitHub's actual iOS
        // Simulator to prove Swift registration and native WebSocket traffic.
        // Never enabled in physical device IPA.
        let arguments=ProcessInfo.processInfo.arguments
        if let i=arguments.firstIndex(of:"-HITEL_CALL_TEST_DEVICE_ID"),
           let k=arguments.firstIndex(of:"-HITEL_CALL_TEST_DEVICE_SECRET"),
           i+1<arguments.count,k+1<arguments.count,
           UUID(uuidString:arguments[i+1]) != nil,
           arguments[k+1].count == 64 {
            id=arguments[i+1].lowercased()
            secret=arguments[k+1]
        }
        #endif
        guard secret.count==64 else{onStatus?("보안 난수 생성 실패");return}
        guard persistIdentity(IdentityRecord(id: id, secret: secret)) else {
            await MainActor.run {
                self.onStatus?("기기 ID 영구 저장 실패 · 임시 주소로 등록하지 않습니다")
            }
            return
        }
        #if targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("-HITEL_CALL_SIMULATOR_VERIFY_KEYCHAIN"),
           let docs=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask).first {
            let audit=docs.appendingPathComponent("hitel-call-keychain-identity-audit.txt")
            let previous=(try? String(contentsOf:audit,encoding:.utf8)) ?? ""
            try? (previous+id+"\n").write(to:audit,atomically:true,encoding:.utf8)
        }
        #endif
        registeredId=id;registeredSecret=secret
        guard let url=URL(string:base+"/device/register") else{return}
        do{
            var req=URLRequest(url:url);req.httpMethod="POST";req.timeoutInterval=15
            req.setValue("application/json",forHTTPHeaderField:"Content-Type")
            req.httpBody=try JSONSerialization.data(withJSONObject:["id":id,"key":secret])
            let (data,res)=try await URLSession.shared.data(for:req)
            guard (res as? HTTPURLResponse)?.statusCode==200,
                let json=try JSONSerialization.jsonObject(with:data) as? [String:Any],
                let pageURL=json["pageUrl"] as? String else{
                throw NSError(domain:"HITEL.Call.Registration",code:1,
                     userInfo:[NSLocalizedDescriptionKey:"앱 고유 주소 등록 실패"])
            }
            #if targetEnvironment(simulator)
            NSLog("HITEL_CALL_SIMULATOR_REGISTERED_ID %@",id)
            #endif
            await MainActor.run{
                self.onPageURL?(pageURL)
                self.onStatus?("고유 주소 등록됨 · 통화 서버 상시 연결 중")
            }
            openDeviceSocket()
        }catch{
            await MainActor.run{self.onStatus?("자동 등록 실패: "+error.localizedDescription)}
            retryConnect()
        }
    }
    private func retryConnect() {
        guard active && !retry else{return}
        retry=true
        DispatchQueue.main.asyncAfter(deadline:.now()+4){[weak self] in
            guard let self else{return}
            self.retry=false
            if self.socket==nil {self.beginRegistration()}
        }
    }
    private func openDeviceSocket() {
        guard active,socket==nil,
              let url=URL(string:base.replacingOccurrences(of:"https:",with:"wss:")+"/device/socket")
        else{return}
        let ws=URLSession.shared.webSocketTask(with:url)
        socket=ws;ws.resume()
        let body:[String:Any]=["type":"device.auth","id":registeredId,"key":registeredSecret]
        if let bytes=try? JSONSerialization.data(withJSONObject:body),
           let text=String(data:bytes,encoding:.utf8){
            ws.send(.string(text)){[weak self] error in
                if let error{DispatchQueue.main.async {self?.onStatus?("기기 인증 전송 오류: "+error.localizedDescription)}}
            }
        }
        receive(ws)
        keepAlive(ws)
    }
    private func keepAlive(_ ws:URLSessionWebSocketTask) {
        DispatchQueue.main.asyncAfter(deadline:.now()+20){[weak self] in
            guard let self,self.active,self.socket === ws else{return}
            ws.sendPing{[weak self] error in
                guard let self else{return}
                if let error {
                    DispatchQueue.main.async {self.onStatus?("통신 연결 재설정: "+error.localizedDescription)}
                    if self.socket === ws {
                        self.socket=nil
                        ws.cancel(with:.goingAway,reason:nil)
                        self.retryConnect()
                    }
                } else {self.keepAlive(ws)}
            }
        }
    }
    private func receive(_ ws:URLSessionWebSocketTask) {
        ws.receive{[weak self] outcome in
            guard let self,self.socket === ws else{return}
            switch outcome {
            case .success(let value):
                let data:Data
                switch value {
                case .string(let text):data=Data(text.utf8)
                case .data(let binary):data=binary
                @unknown default:data=Data()
                }
                if let msg=try? JSONSerialization.jsonObject(with:data) as? [String:Any] {
                    DispatchQueue.main.async {
                        switch msg["type"] as? String {
                        case "device.ready":
                            self.onStatus?("웹 고유주소 연결 대기 · iPhone 온라인")
                        case "device.assign":
                            self.onAssignment?(msg)
                        default:break
                        }
                    }
                }
                self.receive(ws)
            case .failure(let error):
                self.socket=nil
                DispatchQueue.main.async {self.onStatus?("웹 연결 중단 · 자동 재연결: "+error.localizedDescription)}
                self.retryConnect()
            }
        }
    }
}
