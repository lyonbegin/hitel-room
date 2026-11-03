import Foundation
import AVFoundation
import Vision
import CoreImage
import CoreVideo
import WebRTC

/// Native iOS Video Core: AVCapture camera -> Vision face masking -> native
/// WebRTC video source. Filter is applied BEFORE encoding/sending to browsers.
/// This is independent from the browser-only JavaScript VideoCore SDK.
final class HitelNativeVideoCore: NSObject, RTCVideoCapturerDelegate {
    enum Mode: String { case original, mask }
    static let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory(encoderFactory:RTCDefaultVideoEncoderFactory(),
                                        decoderFactory:RTCDefaultVideoDecoderFactory())
    }()
    let videoSource: RTCVideoSource
    let videoTrack: RTCVideoTrack
    let audioTrack: RTCAudioTrack
    private var capturer: RTCCameraVideoCapturer!
    private let context = CIContext(options:[.useSoftwareRenderer:false])
    private var modeValue = Mode.original
    private let lock = NSLock()
    private var frameCounter = 0
    private let originalMask = HitelNativeTexturedFaceMask()
    var hasOriginalFaceMask: Bool { originalMask.hasOriginalTexture }
    func enableOriginalFaceMask() throws {
        guard originalMask.hasOriginalTexture else {
            throw HitelNativeAPIError(message:"기존 웹 Video Core 가면 텍스처를 찾지 못했습니다. iOS 앱 리소스를 확인해 주십시오.")
        }
        mode = .mask
        originalMask.reset()
    }
    #if targetEnvironment(simulator)
    private var syntheticTimer:DispatchSourceTimer?
    private var syntheticIndex=0
    #endif
    var mode:Mode {
        get {lock.lock();defer{lock.unlock()};return modeValue}
        set {lock.lock();modeValue=newValue;lock.unlock()}
    }
    override init() {
        let factory=Self.factory
        videoSource=factory.videoSource()
        videoTrack=factory.videoTrack(with:videoSource,trackId:"hitel-public-video")
        let audioSource=factory.audioSource(with:RTCMediaConstraints(mandatoryConstraints:nil,optionalConstraints:nil))
        audioTrack=factory.audioTrack(with:audioSource,trackId:"hitel-public-audio")
        super.init()
        capturer=RTCCameraVideoCapturer(delegate:self)
    }
    func start() throws {
        let session=AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord,mode:.voiceChat,options:[.allowBluetooth,.defaultToSpeaker])
        try session.setActive(true)
        guard let device=RTCCameraVideoCapturer.captureDevices().first(where:{$0.position == .front}) ??
             RTCCameraVideoCapturer.captureDevices().first,
              let format=RTCCameraVideoCapturer.supportedFormats(for:device).sorted(by:{
                  let a=CMVideoFormatDescriptionGetDimensions($0.formatDescription)
                  let b=CMVideoFormatDescriptionGetDimensions($1.formatDescription)
                  return abs(Int(a.width)-640)+abs(Int(a.height)-480) <
                         abs(Int(b.width)-640)+abs(Int(b.height)-480)
              }).first else {
            throw HitelNativeAPIError(message:"사용 가능한 iPhone 카메라가 없습니다.")
        }
        capturer.startCapture(with:device,format:format,fps:24)
    }
    #if targetEnvironment(simulator)
    /// Opt-in CI test camera on iOS Simulator only. Never used by device build
    /// or real end users. Produces real encoded WebRTC frames without camera.
    func startSyntheticForSimulator() {
        guard syntheticTimer == nil else{return}
        let timer=DispatchSource.makeTimerSource(queue:DispatchQueue(label:"app.hitel.publicroom.synthetic-video"))
        timer.schedule(deadline:.now(),repeating:.milliseconds(100))
        timer.setEventHandler{[weak self] in
            guard let self else{return}
            self.syntheticIndex += 1
            let width=320,height=240
            var pixel:CVPixelBuffer?
            let attrs:[CFString:Any]=[
                kCVPixelBufferCGImageCompatibilityKey:true,
                kCVPixelBufferCGBitmapContextCompatibilityKey:true,
                kCVPixelBufferIOSurfacePropertiesKey:[:] as [String:String]
            ]
            guard CVPixelBufferCreate(kCFAllocatorDefault,width,height,
                  kCVPixelFormatType_32BGRA,attrs as CFDictionary,&pixel)==kCVReturnSuccess,
                  let buffer=pixel else{return}
            let moving=CGFloat((self.syntheticIndex%100))/100.0
            let bg=CIImage(color:CIColor(red:0.25 + moving*0.06,
                                        green:0.26,blue:0.28,alpha:1))
                .cropped(to:CGRect(x:0,y:0,width:width,height:height))
            self.context.render(bg,to:buffer)
            if ProcessInfo.processInfo.arguments.contains("-HITEL_E2E_NATIVE_MASK"),
               self.mode == .mask,
               let blueMask=self.originalMask.renderSimulatedFace(buffer,frameIndex:self.syntheticIndex) {
                self.context.render(blueMask,to:buffer)
            }
            let frame=RTCVideoFrame(buffer:RTCCVPixelBuffer(pixelBuffer:buffer),
                 rotation:RTCVideoRotation._0,timeStampNs:Int64(Date().timeIntervalSince1970*1_000_000_000))
            self.videoSource.capturer(self.capturer,didCapture:frame)
        }
        syntheticTimer=timer
        timer.resume()
    }
    #endif
    func setMicrophoneEnabled(_ enabled:Bool) {audioTrack.isEnabled=enabled}
    func setCameraEnabled(_ enabled:Bool) {videoTrack.isEnabled=enabled}
    func stop() {
        #if targetEnvironment(simulator)
        syntheticTimer?.cancel()
        syntheticTimer=nil
        #endif
        capturer.stopCapture()
        audioTrack.isEnabled=false
        videoTrack.isEnabled=false
        try? AVAudioSession.sharedInstance().setActive(false)
    }
    func capturer(_ capturer:RTCVideoCapturer,didCapture frame:RTCVideoFrame) {
        lock.lock()
        let applyMask = modeValue == .mask
        frameCounter += 1
        let index = frameCounter
        lock.unlock()
        guard applyMask,
              let buffer=frame.buffer as? RTCCVPixelBuffer,
              let image=originalMask.composite(buffer.pixelBuffer,frameIndex:index)
        else {
            videoSource.capturer(capturer,didCapture:frame)
            return
        }
        let pixel=buffer.pixelBuffer
        let width=CVPixelBufferGetWidth(pixel),height=CVPixelBufferGetHeight(pixel)
        var output:CVPixelBuffer?
        let attributes:[CFString:Any]=[
            kCVPixelBufferCGImageCompatibilityKey:true,
            kCVPixelBufferCGBitmapContextCompatibilityKey:true,
            kCVPixelBufferIOSurfacePropertiesKey:[:] as [String:String]
        ]
        guard CVPixelBufferCreate(kCFAllocatorDefault,width,height,
                                  kCVPixelFormatType_32BGRA,attributes as CFDictionary,&output)==kCVReturnSuccess,
              let final=output else {
            videoSource.capturer(capturer,didCapture:frame)
            return
        }
        context.render(image,to:final)
        let outgoing=RTCVideoFrame(buffer:RTCCVPixelBuffer(pixelBuffer:final),
                                   rotation:frame.rotation,timeStampNs:frame.timeStampNs)
        // The fully textured, alpha-composited image is sent to the browser,
        // rather than painting a black box in the local SwiftUI view.
        videoSource.capturer(capturer,didCapture:outgoing)
    }
}

/// Per-remote-user native WebRTC peer. One shared local camera/mic; same
/// SDP/ICE JSON schema as React's publicMeshAdapter.
final class HitelNativeMeshPeer:NSObject,RTCPeerConnectionDelegate {
    let peerId:String
    let userId:String
    var onSignal:(([String:Any])->Void)?
    var onRemoteTrack:((RTCVideoTrack)->Void)?
    var onICEState:((String)->Void)?
    var onError:((String)->Void)?
    private let connection:RTCPeerConnection
    private var queued:[RTCIceCandidate]=[]
    private var remoteReady=false

    init?(peerId:String,userId:String,video:HitelNativeVideoCore) {
        self.peerId=peerId;self.userId=userId
        let config=RTCConfiguration()
        config.sdpSemantics = .unifiedPlan
        config.iceServers=[RTCIceServer(urlStrings:["stun:stun.l.google.com:19302"])]
        config.continualGatheringPolicy = .gatherContinually
        let constraints=RTCMediaConstraints(mandatoryConstraints:nil,optionalConstraints:nil)
        guard let conn=HitelNativeVideoCore.factory.peerConnection(with:config,
                                    constraints:constraints,delegate:nil) else {return nil}
        connection=conn
        super.init()
        conn.delegate=self
        conn.add(video.audioTrack,streamIds:["hitel-public-stream"])
        conn.add(video.videoTrack,streamIds:["hitel-public-stream"])
    }
    func offer() {
        let constraints=RTCMediaConstraints(
            mandatoryConstraints:["OfferToReceiveAudio":"true","OfferToReceiveVideo":"true"],optionalConstraints:nil)
        connection.offer(for:constraints){[weak self] desc,error in
            guard let self,let desc else {self?.onError?(error?.localizedDescription ?? "SDP Offer 실패");return}
            self.connection.setLocalDescription(desc){[weak self] error in
                if let error {self?.onError?(error.localizedDescription);return}
                self?.onSignal?(["description":["type":"offer","sdp":desc.sdp]])
            }
        }
    }
    func receiveDescription(_ data:[String:Any]) {
        guard let type=data["type"] as? String,let sdp=data["sdp"] as? String else {return}
        let desc=RTCSessionDescription(type:type=="offer" ? .offer : .answer,sdp:sdp)
        connection.setRemoteDescription(desc){[weak self] error in
            guard let self else{return}
            if let error {self.onError?(error.localizedDescription);return}
            self.remoteReady=true
            self.queued.forEach{self.connection.add($0)}
            self.queued.removeAll()
            if type=="offer" {self.answer()}
        }
    }
    private func answer() {
        let constraints=RTCMediaConstraints(
            mandatoryConstraints:["OfferToReceiveAudio":"true","OfferToReceiveVideo":"true"],optionalConstraints:nil)
        connection.answer(for:constraints){[weak self] desc,error in
            guard let self,let desc else {self?.onError?(error?.localizedDescription ?? "SDP Answer 실패");return}
            self.connection.setLocalDescription(desc){[weak self] error in
                if let error {self?.onError?(error.localizedDescription);return}
                self?.onSignal?(["description":["type":"answer","sdp":desc.sdp]])
            }
        }
    }
    func receiveCandidate(_ data:[String:Any]) {
        guard let sdp=data["candidate"] as? String else{return}
        let mid=data["sdpMid"] as? String
        let line=(data["sdpMLineIndex"] as? NSNumber)?.int32Value ?? 0
        let candidate=RTCIceCandidate(sdp:sdp,sdpMLineIndex:line,sdpMid:mid)
        if remoteReady {connection.add(candidate)}else{queued.append(candidate)}
    }
    func close() {connection.close()}
    func peerConnection(_ peerConnection:RTCPeerConnection,didChange stateChanged:RTCSignalingState){}
    func peerConnection(_ peerConnection:RTCPeerConnection,didAdd stream:RTCMediaStream) {
        if let track=stream.videoTracks.first {onRemoteTrack?(track)}
    }
    func peerConnection(_ peerConnection:RTCPeerConnection,didRemove stream:RTCMediaStream){}
    func peerConnectionShouldNegotiate(_ peerConnection:RTCPeerConnection){}
    func peerConnection(_ peerConnection:RTCPeerConnection,didChange newState:RTCIceConnectionState) {
        onICEState?(String(describing:newState))
    }
    func peerConnection(_ peerConnection:RTCPeerConnection,didChange newState:RTCIceGatheringState){}
    func peerConnection(_ peerConnection:RTCPeerConnection,didGenerate candidate:RTCIceCandidate) {
        onSignal?(["candidate":["candidate":candidate.sdp,
                                 "sdpMid":candidate.sdpMid ?? "",
                                 "sdpMLineIndex":Int(candidate.sdpMLineIndex)]])
    }
    func peerConnection(_ peerConnection:RTCPeerConnection,didRemove candidates:[RTCIceCandidate]){}
    func peerConnection(_ peerConnection:RTCPeerConnection,didOpen dataChannel:RTCDataChannel){}
    func peerConnection(_ peerConnection:RTCPeerConnection,didStartReceivingOn transceiver:RTCRtpTransceiver) {
        if let track=transceiver.receiver.track as? RTCVideoTrack {onRemoteTrack?(track)}
    }
}
