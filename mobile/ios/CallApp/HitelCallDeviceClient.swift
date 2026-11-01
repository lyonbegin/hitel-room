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
    private func cryptoSecret()->String {
        var bytes=[UInt8](repeating:0,count:32)
        let ok=SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes)
        guard ok==errSecSuccess else{return ""}
        return bytes.map{String(format:"%02x",$0)}.joined()
    }
    func start() {
        guard !active else{return}
        active=true
        Task{await connectIdentity()}
    }
    func resume() {
        if !active {start();return}
        if socket==nil {Task{await connectIdentity()}}
    }
    private func connectIdentity() async {
        let id=load("id") ?? UUID().uuidString.lowercased()
        let secret=load("secret") ?? cryptoSecret()
        guard secret.count==64 else{onStatus?("보안 난수 생성 실패");return}
        store("id",id);store("secret",secret)
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
            if self.socket==nil {Task{await self.connectIdentity()}}
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
                if let error{self?.onStatus?("기기 인증 전송 오류: "+error.localizedDescription)}
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
                    self.onStatus?("통신 연결 재설정: "+error.localizedDescription)
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
