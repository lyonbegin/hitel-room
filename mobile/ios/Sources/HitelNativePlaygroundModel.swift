import SwiftUI
import Combine
import Foundation
import CallKit
import AVFoundation
import WebRTC

/// Direct native iOS WSS client for HITEL's 16-route playground.
/// No WebView JS bridge and no fake successful PSTN/media states.
final class HitelNativePlaygroundModel: NSObject, ObservableObject, CXProviderDelegate {
    @Published var pairingCode = ""
    @Published var connected = false
    @Published var side = ""
    @Published var route = ""
    @Published var routeId = 0
    @Published var phase = "미연결"
    @Published var message = "웹 Playground의 N 코드 8자리를 입력하십시오."
    @Published var logs: [String] = []
    @Published var inCall = false
    @Published var muted = false
    @Published var cameraEnabled = true
    @Published var mediaState = "미디어 미연결"
    @Published var localTrack: RTCVideoTrack?
    @Published var remoteTrack: RTCVideoTrack?

    private let server = "https://hitel-communication-web-production.up.railway.app/lab-sandbox/playground"
    private var connection: URLSessionWebSocketTask?
    private var secret: String?
    private var sessionId: String?
    private var shouldReconnect = false
    private var sequence = 0
    private var media: HitelNativeCallMedia?
    private let provider: CXProvider
    private var callUuid: UUID?
    private var pendingIncoming = false

    override init() {
        let config = CXProviderConfiguration(localizedName: "HITEL")
        config.supportsVideo = true
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: .main)
    }

    private func note(_ text: String) {
        DispatchQueue.main.async {
            self.logs.insert(DateFormatter.localizedString(from:Date(),dateStyle:.none,timeStyle:.medium)+"  "+text,at:0)
            if self.logs.count > 80 {self.logs.removeLast()}
        }
    }

    func join() {
        let code = pairingCode.filter { $0.isASCII && $0.isNumber }
        guard code.count == 8 else { message = "정확한 8자리 코드를 입력하십시오.";return }
        message = "웹 서버에서 네이티브 참가 권한을 확인하고 있습니다."
        Task {
            do {
                guard let url = URL(string: server+"/native-join") else {return}
                var request=URLRequest(url:url)
                request.httpMethod="POST"
                request.setValue("application/json",forHTTPHeaderField:"Content-Type")
                request.httpBody=try JSONSerialization.data(withJSONObject:["code":code])
                let (data,response)=try await URLSession.shared.data(for:request)
                guard let status=(response as? HTTPURLResponse)?.statusCode,status==200,
                      let json=try JSONSerialization.jsonObject(with:data) as? [String:Any],
                      let session=json["id"] as? String,
                      let token=json["secret"] as? String,
                      let actor=json["side"] as? String,
                      let route=json["route"] as? [String:Any] else {
                    throw NSError(domain:"HITEL.Native",code:401,userInfo:[NSLocalizedDescriptionKey:"코드가 만료됐거나 N 유형의 기기가 아닙니다."])
                }
                await MainActor.run {
                    self.sessionId=session;self.secret=token;self.side=actor
                    self.routeId=route["id"] as? Int ?? 0
                    self.route=(route["from"] as? String ?? "?")+" → "+(route["to"] as? String ?? "?")
                    self.message="기기 참가 정보 확인됨 · 독립 네이티브 WebSocket 접속 중"
                    self.phase=(json["phase"] as? String) ?? "idle"
                    self.shouldReconnect=true
                    self.openSocket()
                }
            }catch{
                await MainActor.run{self.message="연결 실패: "+error.localizedDescription}
                note("네이티브 참가 실패: "+error.localizedDescription)
            }
        }
    }

    private func openSocket() {
        guard shouldReconnect,let sessionId,let secret else{return}
        var components=URLComponents()
        components.scheme="wss"
        components.host="hitel-communication-web-production.up.railway.app"
        components.path="/lab-sandbox/playground/socket"
        components.queryItems=[URLQueryItem(name:"id",value:sessionId),
                               URLQueryItem(name:"side",value:side),
                               URLQueryItem(name:"secret",value:secret)]
        guard let url=components.url else{return}
        let task=URLSession.shared.webSocketTask(with:url)
        connection=task
        task.resume()
        note("NATIVE WSS 연결 요청: "+side+" / SC-"+String(routeId))
        receive(task)
        // .send does not claim connection success: only server hello does.
    }

    private func receive(_ socket: URLSessionWebSocketTask) {
        socket.receive { [weak self] result in
            guard let self, self.connection===socket else{return}
            switch result {
            case .success(let incoming):
                let data:Data
                switch incoming {
                case .string(let text):data=Data(text.utf8)
                case .data(let value):data=value
                @unknown default:data=Data()
                }
                if let json=try? JSONSerialization.jsonObject(with:data) as? [String:Any] {
                    DispatchQueue.main.async{self.process(json)}
                }
                self.receive(socket)
            case .failure(let error):
                DispatchQueue.main.async {
                    guard self.connection===socket else{return}
                    self.connected=false
                    self.note("WS 끊김: "+error.localizedDescription)
                    self.message="기존 연결 재시도 중 · 통화 세션은 보존"
                    if self.shouldReconnect {
                        self.connection=nil
                        DispatchQueue.main.asyncAfter(deadline:.now()+2.5) { [weak self] in self?.openSocket() }
                    }
                }
            }
        }
    }

    private func process(_ json: [String:Any]) {
        let type=json["type"] as? String ?? ""
        if type=="hello" {
            connected=true
            message="네이티브 WebSocket 연결됨 · 웹 브리지 사용 안 함"
            if let state=json["state"] as? [String:Any] {
                phase=state["phase"] as? String ?? phase
            }
            note("서버 HELLO 확인 · 네이티브 N "+side)
        } else if type=="event",let event=json["event"] as? [String:Any] {
            let eventType=event["type"] as? String ?? ""
            let sender=event["by"] as? String ?? ""
            let nr=event["seq"] as? Int ?? 0
            guard nr>sequence else{return}
            sequence=nr
            note("#"+String(nr)+" "+eventType+" · "+sender)
            switch eventType {
            case "call.ringing":
                phase="ringing"
                if side == "B" && sender != "B" { incomingCall() }
            case "call.accept":
                phase="accepted"
                inCall=true
                if side=="A" { startOffer() }
            case "call.reject":
                phase="rejected";stopMedia()
            case "call.end","call.cancel":
                phase="ended";stopMedia()
            case "rtc.answer":
                phase="media"
            default:break
            }
        } else if type=="rtc.offer",let payload=json["payload"] as? [String:Any] {
            note("원격 RTC Offer 수신")
            startMedia()
            media?.receiveOffer(payload) { [weak self] response in self?.send("rtc.answer",payload:response) }
        } else if type=="rtc.answer",let payload=json["payload"] as? [String:Any] {
            note("원격 RTC Answer 수신");media?.receiveAnswer(payload)
        } else if type=="rtc.ice",let payload=json["payload"] as? [String:Any] {
            media?.addIce(payload)
        } else if type=="ack" {
            if json["ok"] as? Bool == false {note("서버 명령 거부: "+(json["reason"] as? String ?? ""))}
            else {note("서버 ACK: "+(json["phase"] as? String ?? ""))}
        }
    }

    private func send(_ type:String,payload:[String:Any]?=nil) {
        guard connected,let connection else {note("연결되지 않아 명령 중단: "+type);return}
        var request:[String:Any]=["type":type,"requestId":UUID().uuidString]
        if let payload {request["payload"]=payload}
        guard let data=try? JSONSerialization.data(withJSONObject:request),
              let text=String(data:data,encoding:.utf8) else{return}
        connection.send(.string(text)){ [weak self] error in
            if let error {self?.note("명령 전송 실패: "+error.localizedDescription)}
        }
        note("전송: "+type)
    }

    func resumeAfterUnlock() {
        // Restores native signaling only; system screen recording or a new
        // incoming VoIP call cannot be started without platform authorization.
        if shouldReconnect && !connected {
            connection?.cancel(with:.goingAway,reason:nil)
            connection=nil
            openSocket()
        }
    }

    func dial() {send("call.invite")}
    func accept() {pendingIncoming=false;send("call.accept");phase="accepted"}
    func reject() {pendingIncoming=false;send("call.reject");stopCallKit()}
    func end() {send("call.end");stopMedia();phase="ended"}
    func disconnect() {
        shouldReconnect=false
        connection?.cancel(with:.normalClosure,reason:nil)
        connection=nil;connected=false
        secret=nil;sessionId=nil;phase="미연결";side=""
        stopMedia();stopCallKit()
        message="연결 종료 · 새 8자리 코드를 입력하십시오."
    }

    private func startMedia() {
        if media != nil{return}
        let client=HitelNativeCallMedia()
        media=client
        client.onIce={ [weak self] ice in self?.send("rtc.ice",payload:ice) }
        client.onError={ [weak self] error in
            DispatchQueue.main.async{self?.mediaState="오류: "+error;self?.note(error)}
        }
        client.onConnection={ [weak self] result in
            DispatchQueue.main.async {
                guard let self else{return}
                self.mediaState=result
                if result.contains("connected") && !result.contains("disconnected") {
                    self.send("call.mediaConnected",payload:["connectionState":"connected"])
                }
            }
        }
        client.onTrack={ [weak self] track in
            DispatchQueue.main.async{self?.remoteTrack=track;self?.note("네이티브 원격 영상 트랙 수신")}
        }
        client.prepare()
        localTrack=client.localVideoTrack
    }

    private func startOffer() {
        guard routeId>0 else{return}
        // Only N/W combinations have a real WebRTC negotiation path.
        let paths=["N → N","N → W","W → N","W → W"]
        guard paths.contains(route) else{mediaState="전화망 P/P+ 미연동";return}
        startMedia()
        media?.createOffer { [weak self] payload in self?.send("rtc.offer",payload:payload) }
    }

    func toggleMute() {
        muted.toggle();media?.mute(muted)
    }
    func toggleCamera() {
        cameraEnabled.toggle();media?.camera(cameraEnabled)
    }
    private func stopMedia() {
        media?.shutdown();media=nil
        localTrack=nil;remoteTrack=nil
        inCall=false;mediaState="미디어 미연결"
        stopCallKit()
    }

    private func incomingCall() {
        guard !pendingIncoming else{return}
        pendingIncoming=true
        let uuid=UUID()
        callUuid=uuid
        let update=CXCallUpdate()
        update.remoteHandle=CXHandle(type:.generic,value:"HITEL Playground")
        update.localizedCallerName="HITEL N / W 테스트 발신자"
        update.hasVideo = route.contains("N") || route.contains("W")
        provider.reportNewIncomingCall(with:uuid,update:update){[weak self] error in
            if let error {self?.note("CallKit 수신 화면: "+error.localizedDescription)}
            else{self?.note("iOS CallKit 실제 수신 UI 표시")}
        }
    }
    private func stopCallKit() {
        if let uuid=callUuid {
            provider.reportCall(with:uuid,endedAt:Date(),reason:.remoteEnded)
            callUuid=nil
        }
        pendingIncoming=false
    }
    func providerDidReset(_ provider:CXProvider) {stopMedia()}
    func provider(_ provider:CXProvider,perform action:CXAnswerCallAction) {
        accept();action.fulfill()
    }
    func provider(_ provider:CXProvider,perform action:CXEndCallAction) {
        if phase == "ringing" && side == "B" { reject() } else { end() }
        action.fulfill()
    }
    func provider(_ provider:CXProvider,didActivate audioSession:AVAudioSession) {
        RTCAudioSession.sharedInstance().audioSessionDidActivate(audioSession)
    }
    func provider(_ provider:CXProvider,didDeactivate audioSession:AVAudioSession) {
        RTCAudioSession.sharedInstance().audioSessionDidDeactivate(audioSession)
    }
}
