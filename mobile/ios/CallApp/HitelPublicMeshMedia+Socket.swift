import Foundation
import WebRTC

extension HitelPublicMeshMedia {
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
