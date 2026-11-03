import Foundation
import Vision
import CoreImage
import CoreVideo
import ImageIO

/// The native counterpart of video-town-front/src/mask/MaskedCamera.ts.
///
/// Uses THE SAME alpha PNG from MindAR v1.2.5 as the existing browser VideoCore,
/// but tracks landmarks on-device with Vision. The actual RGB/alpha pixels
/// are composited INTO the outgoing RTCVideoFrame, before WebRTC encoding.
/// No black rectangle, solid privacy block, or UI-only fake overlay.
final class HitelNativeTexturedFaceMask {
    private struct FacePose {
        let leftEye: CGPoint
        let rightEye: CGPoint
        let mouth: CGPoint
        func interpolated(toward other: FacePose, amount: CGFloat) -> FacePose {
            func lerp(_ a: CGPoint, _ b: CGPoint) -> CGPoint {
                CGPoint(x: a.x + (b.x-a.x)*amount, y: a.y+(b.y-a.y)*amount)
            }
            return FacePose(leftEye:lerp(leftEye,other.leftEye),
                            rightEye:lerp(rightEye,other.rightEye),
                            mouth:lerp(mouth,other.mouth))
        }
    }

    private let asset: CIImage?
    private var smoothed: FacePose?
    private var lastDetectedAt: TimeInterval = 0
    private var lastWidth: Int = 0
    private var lastHeight: Int = 0
    private let textureSize = CGSize(width:1024,height:1024)

    /// Same file as MindAR's THREE.TextureLoader(FACE_TEXTURE_URL).
    init(bundle: Bundle = .main) {
        if let url = bundle.url(forResource:"face-mask",withExtension:"png"),
           let image = CIImage(contentsOf:url),
           image.extent.width == 1024, image.extent.height == 1024 {
            asset = image
        } else {
            asset = nil
        }
    }

    var hasOriginalTexture: Bool { asset != nil }

    func reset() {
        smoothed=nil
        lastDetectedAt=0
    }

    private func centroid(_ region:VNFaceLandmarkRegion2D?,
                          observation:VNFaceObservation,
                          width:CGFloat,height:CGFloat) -> CGPoint? {
        guard let region,region.pointCount>0 else { return nil }
        let points=region.normalizedPoints
        let sx=points.reduce(CGFloat(0)) { $0+$1.x } / CGFloat(region.pointCount)
        let sy=points.reduce(CGFloat(0)) { $0+$1.y } / CGFloat(region.pointCount)
        let b=observation.boundingBox
        return CGPoint(x:(b.minX+b.width*sx)*width,
                       y:(b.minY+b.height*sy)*height)
    }

    private func detect(_ buffer:CVPixelBuffer) -> FacePose? {
        let request=VNDetectFaceLandmarksRequest()
        request.constellation = .constellation76Points
        let handler=VNImageRequestHandler(cvPixelBuffer:buffer,
                                          orientation:.up,
                                          options:[:])
        do { try handler.perform([request]) }
        catch {return nil}
        guard let face=request.results?.max(by:{
            $0.boundingBox.width*$0.boundingBox.height <
            $1.boundingBox.width*$1.boundingBox.height
        }),let landmarks=face.landmarks else{return nil}
        let width=CGFloat(CVPixelBufferGetWidth(buffer))
        let height=CGFloat(CVPixelBufferGetHeight(buffer))
        guard let a=centroid(landmarks.leftEye,observation:face,width:width,height:height),
              let b=centroid(landmarks.rightEye,observation:face,width:width,height:height),
              let mouth=centroid(landmarks.outerLips,observation:face,width:width,height:height)
                ?? centroid(landmarks.innerLips,observation:face,width:width,height:height)
              else {return nil}
        let left=a.x<=b.x ? a:b
        let right=a.x<=b.x ? b:a
        let distance=hypot(right.x-left.x,right.y-left.y)
        guard distance > width*0.025 else{return nil}
        return FacePose(leftEye:left,rightEye:right,mouth:mouth)
    }

    /// Centerpoints sampled on original 1024² PNG:
    /// left eye (356,388) and right eye (672,388), mouth (512,696).
    /// Convert from PNG top-left pixels to CIImage bottom-left coordinates.
    /// 3 non-collinear feature anchors determine the native affine face pose.
    private func textureTransform(_ p:FacePose) -> CGAffineTransform {
        let sourceLeft=CGPoint(x:356,y:1024-388)
        let sourceRight=CGPoint(x:672,y:1024-388)
        let sourceMouth=CGPoint(x:512,y:1024-696)
        let sourceDx=sourceRight.x-sourceLeft.x
        let sourceDy=sourceMouth.y-sourceLeft.y
        let a=(p.rightEye.x-p.leftEye.x)/sourceDx
        let b=(p.rightEye.y-p.leftEye.y)/sourceDx
        let c=(p.mouth.x-p.leftEye.x-a*(sourceMouth.x-sourceLeft.x))/sourceDy
        let d=(p.mouth.y-p.leftEye.y-b*(sourceMouth.x-sourceLeft.x))/sourceDy
        let tx=p.leftEye.x-a*sourceLeft.x-c*sourceLeft.y
        let ty=p.leftEye.y-b*sourceLeft.x-d*sourceLeft.y
        return CGAffineTransform(a:a,b:b,c:c,d:d,tx:tx,ty:ty)
    }

    /// Native Vision pass is throttled, while the last confirmed pose stays
    /// visible only for 120ms, matching web FACE_LOSS_GRACE_MS.
    /// The face texture is NOT black; its real alpha reveals eyes and mouth.
    func composite(_ buffer:CVPixelBuffer,
                   frameIndex:Int,
                   now:TimeInterval=Date().timeIntervalSince1970) -> CIImage? {
        guard let asset else{return nil}
        let width=CVPixelBufferGetWidth(buffer),height=CVPixelBufferGetHeight(buffer)
        if width != lastWidth || height != lastHeight {
            reset()
            lastWidth=width;lastHeight=height
        }
        if frameIndex%2 == 0 || smoothed == nil {
            if let found=detect(buffer) {
                smoothed=smoothed?.interpolated(toward:found,amount:0.55) ?? found
                lastDetectedAt=now
            } else if now-lastDetectedAt > 0.120 {
                smoothed=nil
            }
        }
        guard let pose=smoothed else {
            // Face lost: do not show a stale floating mask or privacy rectangle.
            return CIImage(cvPixelBuffer:buffer)
        }
        let raw=CIImage(cvPixelBuffer:buffer)
        let transformed=asset.transformed(by:textureTransform(pose))
        let composed=transformed.composited(over:raw)
        // Web VideoCore mirrors camera + face mesh into the transmitted canvas.
        let flipped=composed.transformed(by:CGAffineTransform(a:-1,b:0,c:0,d:1,
                                                   tx:CGFloat(width),ty:0))
        return flipped.cropped(to:CGRect(x:0,y:0,width:width,height:height))
    }
}
