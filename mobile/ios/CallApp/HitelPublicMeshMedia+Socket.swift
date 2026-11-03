import Foundation
import WebRTC

extension HitelPublicMeshMedia {
    func listen(_ task:URLSessionWebSocketTask) {
        task.receive {[weak self,weak task] result in
            DispatchQueue.main.async {
                guard let self,let task,self.ws === task,!self.stopped else {return}
                switch result {
                case .success(let message):
                    let bytes:Data
                    switch message {
                    case .string(let text): bytes=Data(text.utf8)
                    case .data(let data): bytes=data
                    @unknown default: bytes=Data()
                    }
                    if let object=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any] {
                        self.handleMessage(object)
                    } else {
                        self.report("공개방 신호 JSON 변환 실패")
                    }
                    self.listen(task)
                case .failure(let error):
                    self.report("공개방 WebSocket 종료: "+error.localizedDescription)
                    self.finishWelcome(.failure(error))
                    self.stop()
                }
            }
        }
    }
    func connect(to url:URL,using ticket:String) async throws {
        try prepareTracks()
        try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<Void,Error>) in
            completed={result in continuation.resume(with:result)}
            let task=URLSession.shared.webSocketTask(
                with:url,protocols:["hitel-public","ticket."+ticket])
            ws=task;task.resume()
            listen(task)
            DispatchQueue.main.asyncAfter(deadline:.now()+12){[weak self,weak task] in
                guard let self,let task,self.ws === task,!self.ready else{return}
                let error=NSError(domain:"HITEL",code:12,
                    userInfo:[NSLocalizedDescriptionKey:"공개방 welcome 12초 초과"])
                self.finishWelcome(.failure(error))
                self.stop()
            }
        }
    }
}
