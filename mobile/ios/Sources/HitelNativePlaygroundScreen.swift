import SwiftUI
import WebRTC
import UIKit

/// SwiftUI native N endpoint, not WKWebView and not a JS/native bridge.
struct HitelNativePlaygroundScreen: View {
    @ObservedObject var model:HitelNativePlaygroundModel
    @State private var selectedScenario = 11
    private let kinds=["P","P+","N","W"]
    private func name(_ id:Int)->String{
        let i=max(0,min(15,id-1))
        return kinds[i/4]+" → "+kinds[i%4]
    }
    var body:some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:17) {
                    VStack(alignment:.leading,spacing:5) {
                        Text("HITEL / COMMUNICATION SDK").font(.caption2.bold()).foregroundStyle(.secondary)
                        Text("iPhone 네이티브 통화").font(.title.bold())
                        Text("Swift WebSocket · Native WebRTC · CallKit")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    VStack(alignment:.leading,spacing:8) {
                        Text("16개 통신 조합").font(.headline)
                        Text("P는 일반 통신사 이용자, P+는 별도 개인 보조, N은 실제 인터넷 네이티브 통화입니다. 기존 통신사 음성은 직접 수집하지 않습니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        LazyVGrid(columns:Array(repeating:GridItem(.flexible(),spacing:7),count:4),spacing:8) {
                            ForEach(1...16,id:\.self){id in
                                Button {
                                    selectedScenario=id
                                } label:{
                                    VStack(spacing:3){
                                        Text(String(format:"%02d",id)).font(.caption2.monospacedDigit())
                                        Text(name(id)).font(.caption2.bold()).lineLimit(1).minimumScaleFactor(0.75)
                                    }.frame(maxWidth:.infinity).frame(height:42)
                                }
                                .buttonStyle(.bordered)
                                .tint(selectedScenario==id ? .blue : .gray)
                            }
                        }
                        Text("선택: SC-\(String(format:"%02d",selectedScenario)) · \(name(selectedScenario))")
                            .font(.caption.bold())
                    }.padding(14).background(Color(uiColor:.secondarySystemGroupedBackground)).clipShape(RoundedRectangle(cornerRadius:12))
                    VStack(alignment:.leading,spacing:12){
                        Text("Playground 네이티브 참가").font(.headline)
                        Text("Windows 웹에서 N 또는 P+가 포함된 시나리오를 선택하고 '새 테스트 세션'을 누르시면 해당 발신자 A·수신자 B의 코드가 표시됩니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        HStack {
                            TextField("8자리 네이티브 참가코드",text:$model.pairingCode)
                                .keyboardType(.numberPad)
                                .textContentType(.oneTimeCode)
                                .font(.title3.monospacedDigit())
                                .textFieldStyle(.roundedBorder)
                                .onChange(of:model.pairingCode){value in
                                    let next=String(value.filter{ $0.isASCII && $0.isNumber }.prefix(8))
                                    if next != model.pairingCode {model.pairingCode=next}
                                }
                            Button("접속") {model.join()}
                                .buttonStyle(.borderedProminent)
                                .disabled(model.connected||model.pairingCode.count != 8)
                        }
                        HStack {
                            Image(systemName:model.connected ? "checkmark.circle.fill":"wifi.slash")
                                .foregroundColor(model.connected ? .green:.orange)
                            Text(model.connected ? "서버 직접 접속 · "+model.side+" / "+model.endpointType+" · "+model.route:"독립 네이티브 연결 대기")
                                .font(.caption.bold())
                        }
                        Text(model.message).font(.caption).foregroundStyle(.secondary)
                        if model.connected {
                            Button("연결 종료") {model.disconnect()}
                                .buttonStyle(.bordered).tint(.red)
                        }
                    }.padding(14).background(Color(uiColor:.secondarySystemGroupedBackground)).clipShape(RoundedRectangle(cornerRadius:12))
                    if model.endpointType == "P+" {
                        HitelCarrierAssistant(model:model)
                    }
                    VStack(alignment:.leading,spacing:10){
                        HStack {
                            Text(model.endpointType == "P+" ? "Playground 제어 신호 (전화망 별도)" : "실제 통화").font(.headline)
                            Spacer()
                            Text(model.phase).font(.caption.bold()).foregroundStyle(model.inCall ? .green:.secondary)
                        }
                        HStack(spacing:9){
                            videoSurface(model.remoteTrack,title:"상대 실제 영상")
                            videoSurface(model.localTrack,title:"iPhone 로컬 영상")
                        }.frame(height:190)
                        Text("미디어 상태: "+model.mediaState).font(.caption).foregroundStyle(.secondary)
                        HStack {
                            Button {model.dial()} label:{Label("발신",systemImage:"phone.arrow.up.right")}
                                .buttonStyle(.borderedProminent)
                                .disabled(!model.connected || model.side != "A" || !["idle","ended","rejected"].contains(model.phase))
                            Button {model.accept()} label:{Label("수락",systemImage:"phone.fill")}
                                .buttonStyle(.borderedProminent).tint(.green)
                                .disabled(!model.connected || model.side != "B" || model.phase != "ringing")
                            Button {model.reject()} label:{Label("거절",systemImage:"phone.down.fill")}
                                .buttonStyle(.bordered).tint(.red)
                                .disabled(!model.connected || model.side != "B" || model.phase != "ringing")
                            Button {model.end()} label:{Label("종료",systemImage:"phone.down")}
                                .buttonStyle(.bordered).tint(.red)
                                .disabled(!model.connected || !["ringing","accepted","media"].contains(model.phase))
                        }.font(.caption)
                        HStack {
                            Button(model.muted ? "마이크 켜기":"마이크 끄기") {model.toggleMute()}
                            Button(model.cameraEnabled ? "카메라 끄기":"카메라 켜기") {model.toggleCamera()}
                        }.buttonStyle(.bordered).disabled(!model.inCall)
                        Text(model.endpointType == "P+"
                         ? "P+에서는 네이티브 통신사 통화 오디오를 제어하지 않습니다. WS 제어 신호와 별도 전화 실행만 가능합니다."
                         : "실제 통화 여부는 원격 미디어·ICE 연결 상태가 connected가 되었을 때만 확정됩니다. PushKit을 통한 앱 종료 상태 수신은 아직 미지원입니다.")
                            .font(.caption2).foregroundStyle(.secondary)
                    }.padding(14).background(Color(uiColor:.secondarySystemGroupedBackground)).clipShape(RoundedRectangle(cornerRadius:12))
                    VStack(alignment:.leading,spacing:9){
                        Text("실시간 네이티브 실행 로그").font(.headline)
                        if model.logs.isEmpty {
                            Text("서버 접속 후 실제 이벤트가 이곳에 기록됩니다.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        ForEach(Array(model.logs.prefix(35).enumerated()),id:\.offset){_,line in
                            Text(line).font(.system(size:11,design:.monospaced))
                                .foregroundStyle(.secondary).textSelection(.enabled)
                        }
                    }.padding(14).frame(maxWidth:.infinity,alignment:.leading)
                        .background(Color(uiColor:.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius:12))
                }
                .padding(16)
            }
            .navigationTitle("HITEL CALL")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of:model.routeId) { newValue in
                if (1...16).contains(newValue) {selectedScenario=newValue}
            }
        }
    }
    private func videoSurface(_ track: RTCVideoTrack?, title:String)->some View {
        ZStack(alignment:.bottomLeading){
            Color.black
            HitelNativeRTCVideo(track:track)
            Text(title).font(.caption2.bold())
                .padding(5).background(.black.opacity(0.6)).foregroundColor(.white)
                .padding(7)
        }.clipShape(RoundedRectangle(cornerRadius:9)).frame(maxWidth:.infinity)
    }
}
private struct HitelNativeRTCVideo: UIViewRepresentable {
    let track:RTCVideoTrack?
    final class Coordinator {
        var current:RTCVideoTrack?
    }
    func makeCoordinator()->Coordinator{Coordinator()}
    func makeUIView(context:Context)->RTCMTLVideoView {
        let view=RTCMTLVideoView()
        view.videoContentMode = .scaleAspectFit
        return view
    }
    func updateUIView(_ view:RTCMTLVideoView,context:Context){
        if context.coordinator.current === track{return}
        context.coordinator.current?.remove(view)
        track?.add(view)
        context.coordinator.current=track
    }
    static func dismantleUIView(_ view:RTCMTLVideoView,coordinator:Coordinator){
        coordinator.current?.remove(view)
    }
}
