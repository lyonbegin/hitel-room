import SwiftUI
import Combine
import Foundation
import CallKit
import AVFoundation
import WebRTC

/// Direct native iOS WSS client for HITEL's 16-route playground.
/// No WebView JS bridge and no fake successful PSTN/media states.
final class HitelCallModel: NSObject, ObservableObject, CXProviderDelegate {
    @Published var pageURL = ""
    @Published var deviceStatus = "고유 웹 주소 준비 중"
    @Published var connected = false
    @Published var side = ""
    @Published var route = ""
    @Published var routeId = 0
    @Published var endpointType = "N"
    @Published var phase = "미연결"
    @Published var message = "앱을 열면 고유 웹 주소를 발급하고 통화 서버에 자동 연결합니다."
    @Published var logs: [String] = []
    @Published var inCall = false
    @Published var muted = false
    @Published var cameraEnabled = true
    @Published var mediaState = "미디어 미연결"
    @Published var aiBusy = false
    @Published var aiResponse = ""
    @Published var aiStatus = "AI Counselor 대기"
    @Published var localTrack: RTCVideoTrack?
    @Published var remoteTrack: RTCVideoTrack?

    private let server = "https://hitel-communication-web-production.up.railway.app/lab-sandbox/playground"
    private var connection: URLSessionWebSocketTask?
    private var secret: String?
    private var sessionId: String?
    private var shouldReconnect = false
    private var sequence = 0
    private var media: HitelNativeCallMedia?
    private var cameraPermissionRequested = false
    private var videoCore: HitelNativeVideoCore?
    private let communicationSDK = HitelNativeCommunicationSDK.create()
    private let deviceClient=HitelCallDeviceClient()
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

    func activate() {
        prepareCameraPreview()
        deviceClient.onPageURL={ [weak self] value in
            self?.pageURL=value
            self?.note("앱 전용 웹 주소 생성 · 직접 연결 준비")
        }
        deviceClient.onStatus={ [weak self] value in
            self?.deviceStatus=value
            self?.note(value)
        }
        deviceClient.onAssignment={ [weak self] assignment in
            guard let self,
                  let id=assignment["id"] as? String,
                  let secret=assignment["secret"] as? String,
                  let role=assignment["side"] as? String,
                  let route=assignment["route"] as? [String:Any] else{return}
            if self.sessionId == id && self.side == role && self.connected {
                self.note("기존 통화 세션 유지 · 중복 앱 배정 무시")
                return
            }
            self.stopMedia()
            self.connection?.cancel(with:.normalClosure,reason:nil)
            self.connected=false
            self.sessionId=id;self.secret=secret;self.side=role
            self.routeId=route["id"] as? Int ?? 0
            self.route=(route["from"] as? String ?? "?")+" → "+(route["to"] as? String ?? "?")
            self.endpointType=(role=="A" ? route["from"]:route["to"]) as? String ?? "N"
            self.sequence=0;self.phase=assignment["phase"] as? String ?? "idle"
            self.shouldReconnect=true
            self.openSocket()
            self.note("고유 웹 주소에서 통화 세션 자동 연결: SC-"+String(self.routeId))
        }
        deviceClient.start()
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
            NSLog("HITEL_NATIVE_CALL_WSS_HELLO side=%@ route=%d",side,routeId)
            #if targetEnvironment(simulator)
            if side == "A" && ProcessInfo.processInfo.arguments.contains("-HITEL_CALL_SIMULATOR_AUTODIAL") {
                note("SIMULATOR_ACTUAL_SWIFT_AUTODIAL")
                dial()
            }
            #endif
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
                if side == "B" && sender != "B" {
                    // P+ observes the real iOS Phone call separately. A
                    // Playground signal is NOT a carrier incoming call.
                    if endpointType == "N" {incomingCall()}
                    #if targetEnvironment(simulator)
                    if ProcessInfo.processInfo.arguments.contains("-HITEL_NATIVE_AUTOANSWER") {
                        note("SIMULATOR_TEST_AUTOANSWER_CALLKIT_EVENT")
                        accept()
                    }
                    #endif
                }
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
        deviceClient.resume()
        // Restores native signaling only; system screen recording or a new
        // incoming VoIP call cannot be started without platform authorization.
        if shouldReconnect && !connected {
            connection?.cancel(with:.goingAway,reason:nil)
            connection=nil
            openSocket()
        }
    }

    func reportSystemCallState(_ state:String) {
        // This is a CXCallObserver event and may include other VoIP apps.
        // It does NOT confirm a cellular origin or permit recording audio.
        guard endpointType == "P+" else{return}
        send("carrier.status",payload:["state":state])
    }
    func sendAssistanceNote(_ note:String) {
        let trimmed=String(note.trimmingCharacters(in:.whitespacesAndNewlines).prefix(250))
        guard !trimmed.isEmpty else{return}
        send("lab.note",payload:["note":trimmed])
    }
    func dial() {send("call.invite")}
    func accept() {pendingIncoming=false;send("call.accept");phase="accepted"}
    func reject() {pendingIncoming=false;send("call.reject");stopCallKit()}
    func end() {send("call.end");stopMedia();phase="ended"}
    func disconnect() {
        // This ends a call but does not revoke the stable device URL.
        // The device signaling socket remains online for the next assignment.
        shouldReconnect=false
        connection?.cancel(with:.normalClosure,reason:nil)
        connection=nil;connected=false
        secret=nil;sessionId=nil;phase="미연결";side=""
        stopMedia();stopCallKit()
        message="통화 종료 · 고유 웹 주소의 다음 통화 연결 대기"
    }

    /// Initialize the real native local camera before a remote call.
    private func prepareCameraPreview() {
        guard media == nil, !cameraPermissionRequested else { return }
        cameraPermissionRequested = true
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            startMedia()
            mediaState = videoCore?.cameraOpened == true
                ? "로컬 카메라 시작 요청 · 첫 영상 프레임 확인 전"
                : "로컬 카메라 실행 실패 · 로그 확인"
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.cameraPermissionRequested = false
                    if granted { self.prepareCameraPreview() }
                    else {
                        self.mediaState = "카메라 접근 거부 · iOS 설정에서 권한을 허용해 주십시오."
                        self.note(self.mediaState)
                    }
                }
            }
        case .denied, .restricted:
            mediaState = "카메라 접근 불가 · iOS 설정에서 권한을 확인해 주십시오."
            note(mediaState)
        @unknown default:
            mediaState = "카메라 권한 상태 확인 불가"
        }
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
                if result.lowercased().contains("connected") && !result.lowercased().contains("disconnected") {
                    self.send("call.mediaConnected",payload:["connectionState":"connected"])
                }
            }
        }
        client.onTrack={ [weak self] track in
            DispatchQueue.main.async{self?.remoteTrack=track;self?.note("네이티브 원격 영상 트랙 수신")}
        }
        client.prepare()
        videoCore = client.nativeVideoCore
        localTrack = videoCore?.videoTrack
        if videoCore?.cameraOpened != true {
            mediaState = "VideoCore 원본 카메라를 시작하지 못했습니다."
            note(mediaState)
        }
    }

    private func startOffer() {
        guard routeId>0, endpointType == "N" else{return}
        // Only N/W combinations have a real WebRTC negotiation path.
        let paths=["N → N","N → W","W → N","W → W"]
        guard paths.contains(route) else{mediaState="전화망 P/P+ 미연동";return}
        startMedia()
        media?.createOffer { [weak self] payload in self?.send("rtc.offer",payload:payload) }
    }

    /// AI Counselor runtime is called by native Swift. No WKWebView or JavaScript engine.
    func askAI(_ text: String) {
        guard !aiBusy else { return }
        aiBusy = true
        aiStatus = "기존 AI Counselor 서버에 응답 요청 중"
        Task { @MainActor in
            do {
                let result = try await communicationSDK.respondWithAI(text)
                if let value = result["reply"] as? String ?? result["text"] as? String ?? result["answer"] as? String {
                    aiResponse = value
                } else if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]),
                          let value = String(data: data, encoding: .utf8) {
                    aiResponse = value
                } else {
                    aiResponse = "응답 형식 확인 필요"
                }
                aiStatus = "AI Counselor 서버 응답 수신"
            } catch {
                aiResponse = error.localizedDescription
                aiStatus = "AI Counselor 실행 실패"
            }
            aiBusy = false
        }
    }

    func toggleMute() {
        muted.toggle();media?.mute(muted)
    }
    func toggleCamera() {
        cameraEnabled.toggle();media?.camera(cameraEnabled)
    }
    private func stopMedia() {
        videoCore?.stop();videoCore=nil
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
