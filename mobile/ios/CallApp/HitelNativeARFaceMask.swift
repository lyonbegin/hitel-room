import Foundation
import UIKit
import ARKit
import SceneKit
import WebRTC
import CoreVideo
import QuartzCore

/// A physical iPhone native 3D face renderer. ARKit owns the front camera
/// while mask mode is active; frames are forwarded to the same RTCVideoSource
/// as original mode, without any JavaScript/WebView or second capture process.
final class HitelNativeARFaceMask: NSObject, ARSCNViewDelegate, ARSessionDelegate {
    let view = ARSCNView(frame:CGRect(x:0,y:0,width:640,height:360))
    private let texture: UIImage
    private let rtcCapturer: RTCVideoCapturer
    private weak var output: RTCVideoCapturerDelegate?
    private var link: CADisplayLink?
    var onError: ((String)->Void)?
    private(set) var running = false

    init(output:RTCVideoCapturerDelegate,texture:UIImage) {
        self.output=output
        self.rtcCapturer=RTCVideoCapturer(delegate:output)
        self.texture=texture
        super.init()
    }

    func start() throws {
        guard ARFaceTrackingConfiguration.isSupported else {
            throw HitelVideoCoreError.faceTrackingUnavailable
        }
        view.scene=SCNScene()
        view.delegate=self
        view.session.delegate=self
        view.automaticallyUpdatesLighting=true
        view.rendersContinuously=true
        let configuration=ARFaceTrackingConfiguration()
        configuration.isLightEstimationEnabled=true
        configuration.maximumNumberOfTrackedFaces=1
        view.session.run(configuration,options:[.resetTracking,.removeExistingAnchors])
        link=CADisplayLink(target:self,selector:#selector(captureRenderedFrame))
        link?.preferredFramesPerSecond=15
        link?.add(to:.main,forMode:.common)
        running=true
    }

    func stop() {
        link?.invalidate();link=nil
        view.session.pause()
        view.delegate=nil
        view.session.delegate=nil
        running=false
    }

    func renderer(_ renderer:SCNSceneRenderer,nodeFor anchor:ARAnchor)->SCNNode? {
        guard anchor is ARFaceAnchor,
              let device=view.device,
              let geometry=ARSCNFaceGeometry(device:device,fillMesh:true) else {return nil}
        let material=geometry.firstMaterial
        material?.diffuse.contents=texture
        material?.lightingModel = .physicallyBased
        material?.isDoubleSided=true
        material?.transparencyMode = .aOne
        return SCNNode(geometry:geometry)
    }

    func renderer(_ renderer:SCNSceneRenderer,didUpdate node:SCNNode,for anchor:ARAnchor) {
        guard let face=anchor as? ARFaceAnchor,
              let geometry=node.geometry as? ARSCNFaceGeometry else {return}
        geometry.update(from:face.geometry)
    }

    func session(_ session:ARSession,didFailWithError error:Error) {
        DispatchQueue.main.async {[weak self] in
            self?.onError?("ARKit face-tracking failure: "+error.localizedDescription)
        }
    }
}

// Snapshot the *actual* AR camera with its tracked 3D face texture, not a
// black placeholder image. The snapshot is encoded into the same WebRTC track.
extension HitelNativeARFaceMask {
    @objc func captureRenderedFrame() {
        guard running,view.window != nil,
              let image=view.snapshot().cgImage else {return}
        let width=640,height=360
        let attrs:[CFString:Any]=[
            kCVPixelBufferCGImageCompatibilityKey:true,
            kCVPixelBufferCGBitmapContextCompatibilityKey:true,
            kCVPixelBufferIOSurfacePropertiesKey:[:]
        ]
        var buffer:CVPixelBuffer?
        let result=CVPixelBufferCreate(kCFAllocatorDefault,width,height,
                                       kCVPixelFormatType_32BGRA,attrs as CFDictionary,&buffer)
        guard result == kCVReturnSuccess,let buffer else {return}
        CVPixelBufferLockBaseAddress(buffer,[])
        defer {CVPixelBufferUnlockBaseAddress(buffer,[])}
        guard let base=CVPixelBufferGetBaseAddress(buffer),
              let context=CGContext(data:base,width:width,height:height,
                bitsPerComponent:8,
                bytesPerRow:CVPixelBufferGetBytesPerRow(buffer),
                space:CGColorSpaceCreateDeviceRGB(),
                bitmapInfo:CGImageAlphaInfo.premultipliedFirst.rawValue |
                           CGBitmapInfo.byteOrder32Little.rawValue) else {return}
        context.translateBy(x:0,y:CGFloat(height))
        context.scaleBy(x:1,y:-1)
        context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
        let videoFrame=RTCVideoFrame(
            buffer:RTCCVPixelBuffer(pixelBuffer:buffer),
            rotation:RTCVideoRotation._0,
            timeStampNs:Int64(CACurrentMediaTime()*1_000_000_000))
        output?.capturer(rtcCapturer,didCapture:videoFrame)
    }
}
