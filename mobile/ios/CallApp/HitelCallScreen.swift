import SwiftUI
import WebRTC
import UIKit

/// SwiftUI native N endpoint, not WKWebView and not a JS/native bridge.
struct HitelCallScreen: View {
    @ObservedObject var model:HitelCallModel
    @State private var selectedScenario = 11
    @State private var aiPrompt = ""
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
                    VStack(alignment:.leading,spacing:12) {
                        Text("이 앱의 고유 웹 관리 주소").font(.headline)
                        Text("아이폰에서 앱을 열면 자동으로 서버에 등록됩니다. 아래 웹 주소를 컴퓨터에서 열면 이 앱과 자동 연결됩니다. 8자리 숫자 입력은 필요하지 않습니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        if model.pageURL.isEmpty {
                            ProgressView("앱 전용 페이지 연결 중")
                        } else {
                            Text(model.pageURL)
                                .font(.system(size:12,design:.monospaced))
                                .textSelection(.enabled)
                                .foregroundStyle(.blue)
                            ShareLink(item: model.pageURL) {
                                Label("고유 웹 주소 공유",systemImage:"square.and.arrow.up")
                            }.buttonStyle(.borderedProminent)
                            Button("주소 복사"){
                                UIPasteboard.general.string=model.pageURL
                            }.buttonStyle(.bordered)
                        }
                        Label(model.deviceStatus,systemImage:"wifi")
                            .font(.caption).foregroundStyle(.secondary)
                        Text(model.connected
                            ? "웹에서 자동 연결됨 · SC-"+String(model.routeId)+" · "+model.route
                            : "고유 웹 페이지에서 자동 접속 대기 중")
                            .font(.caption.bold())
                    }
                    .padding(14)
                    .background(Color(uiColor:.secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius:12))
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
                            videoSurface(model.remoteTrack,title:"상대 실제 영상",frameHint:nil)
                            videoSurface(model.localTrack,title:"iPhone 로컬 영상",
                                         frameHint:!model.cameraEnabled ? "카메라 꺼짐"
                                             : (model.localFrameReady ? nil : "실제 카메라 프레임 대기 중"))
                        }.frame(height:190)
                        Text("미디어 상태: "+model.mediaState).font(.caption).foregroundStyle(.secondary)
                        if model.localFrameReady {
                            Text(String(format:"실제 로컬 카메라 캡처: %.1f fps",model.localCaptureFPS))
                                .font(.caption2.monospacedDigit()).foregroundStyle(.secondary)
                        }
                        Text("가면 합성 및 기존 HITEL 공개방 SFU 연결은 아직 구현되지 않았습니다.")
                            .font(.caption2).foregroundStyle(.secondary)
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
                    VStack(alignment:.leading,spacing:10) {
                        Text("AI Counselor · 네이티브 연결").font(.headline)
                        Text("기존 AI Counselor 1.1.0 서버를 Swift에서 직접 호출합니다. 실제 통화 음성의 자동 AI 처리는 아직 연결되지 않았습니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        TextField("AI 상담 메시지 입력", text:$aiPrompt, axis:.vertical)
                            .textFieldStyle(.roundedBorder)
                        Button {
                            model.askAI(aiPrompt)
                        } label: {
                            Label(model.aiBusy ? "AI 응답 요청 중" : "AI Counselor 실행", systemImage:"sparkles")
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(model.aiBusy || aiPrompt.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
                        Text(model.aiStatus).font(.caption).foregroundStyle(.secondary)
                        if !model.aiResponse.isEmpty {
                            Text(model.aiResponse).font(.callout).textSelection(.enabled)
                        }
                    }.padding(14).background(Color(uiColor:.secondarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius:12))
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
    private func videoSurface(_ track: RTCVideoTrack?, title:String, frameHint:String?)->some View {
        ZStack(alignment:.bottomLeading){
            Color.black
            if let track {
                HitelNativeRTCVideo(track:track)
            } else {
                VStack(spacing:6) {
                    Image(systemName:"video.slash").font(.title2)
                    Text("영상 트랙 없음").font(.caption2)
                }
                .foregroundColor(.white)
                .frame(maxWidth:.infinity,maxHeight:.infinity)
                .accessibilityLabel(title + " 영상 미연결")
            }
            if let frameHint {
                Text(frameHint)
                    .font(.caption2)
                    .foregroundColor(.white)
                    .padding(7)
                    .background(.black.opacity(0.8))
                    .frame(maxWidth:.infinity,maxHeight:.infinity)
            }
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
