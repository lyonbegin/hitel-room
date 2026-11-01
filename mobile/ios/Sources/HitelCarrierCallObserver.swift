import Foundation
import Combine
import CallKit

/// Observes iOS system call state but never call audio, caller number, or the
/// identity of the telephony provider. CallKit may include VoIP calls as well
/// as cellular calls; this MUST NOT be treated as proof of PSTN connectivity.
final class HitelCarrierCallObserver: NSObject,ObservableObject,CXCallObserverDelegate {
    @Published private(set) var state = "idle"
    @Published private(set) var summary = "관찰된 iOS 시스템 통화 없음"
    private let observer = CXCallObserver()

    override init() {
        super.init()
        observer.setDelegate(self,queue:.main)
        if let current=observer.calls.first {
            update(current)
        }
    }
    func callObserver(_ callObserver:CXCallObserver,callChanged call:CXCall) {
        update(call)
    }
    private func update(_ call:CXCall) {
        let next:String
        let text:String
        if call.hasEnded {
            next="ended";text="iOS 시스템 통화 종료"
        } else if call.isOnHold {
            next="held";text="iOS 시스템 통화 보류 중"
        } else if call.hasConnected {
            next="connected";text="iOS 시스템 통화 연결 중"
        } else if call.isOutgoing {
            next="dialing";text="iOS 시스템 전화 발신 진행 중"
        } else {
            next="ringing";text="iOS 시스템 전화 수신 중"
        }
        state=next
        summary=text+" · 통신사/VoIP 유형은 확인 불가"
    }
}
