import SwiftUI
import UIKit
import WebRTC

/// SwiftUI reimplementation of /webrtc-room: same labels, room title,
/// member list, room creation and media controls. All state comes from Railway.
struct HitelNativePublicRoomScreen:View {
    @ObservedObject var store:HitelNativeRoomStore
    @State private var userId=""
    @State private var name=""
    @State private var role="user"
    @State private var createPresented=false
    @State private var aiPresented=false
    @State private var roomTitle="새 영상 대화방"
    @State private var capacity=8
    @State private var confirmEnd=false

    private let ink=Color.primary
    var body:some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:19) {
                    header
                    if !store.error.isEmpty {
                        Text(store.error).font(.callout).foregroundStyle(.red)
                            .padding(12).frame(maxWidth:.infinity,alignment:.leading)
                            .background(.red.opacity(0.07),in:RoundedRectangle(cornerRadius:8))
                            .accessibilityIdentifier("public-room-error")
                    }
                    if store.identity == nil {
                        loginScreen
                    }else if let room=store.room {
                        liveRoom(room)
                    }else{
                        roomList
                    }
                }.padding(17)
            }
            .background(Color(uiColor:.systemGroupedBackground))
            .toolbar(.hidden,for:.navigationBar)
            .sheet(isPresented:$createPresented){createSheet}
            .sheet(isPresented:$aiPresented){aiSheet}
            .confirmationDialog("모든 사용자의 공개방을 종료하시겠습니까?",
                                isPresented:$confirmEnd,titleVisibility:.visible) {
                Button("대화방 종료",role:.destructive){Task{await store.endRoom()}}
            }
        }.tint(ink)
    }

    private var header:some View {
        HStack(alignment:.center,spacing:10) {
            Text("ㅎ")
                .font(.system(size:22,weight:.bold))
                .frame(width:39,height:39)
                .background(Color.primary,in:RoundedRectangle(cornerRadius:9))
                .foregroundStyle(Color(uiColor:.systemBackground))
            VStack(alignment:.leading,spacing:2) {
                Text("하이텔 방").font(.headline)
                Text("Communication SDK · 공개 영상방").font(.caption2).foregroundStyle(.secondary)
            }
            Spacer()
            if let user=store.identity {
                VStack(alignment:.trailing,spacing:2) {
                    Text(user.name).font(.footnote.bold())
                    Text("@"+user.userId).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                }
                if store.room == nil {
                    Button("로그아웃"){store.logout()}
                        .font(.caption).buttonStyle(.bordered)
                }else{
                    Button("방 목록"){store.leave()}
                        .font(.caption).buttonStyle(.bordered)
                }
            }
        }
    }

    private var loginScreen:some View {
        VStack(alignment:.leading,spacing:14) {
            intro(title:"이야기가 모이고,\n사람이 연결됩니다.",
                  subtitle:"방을 만들면 공개 목록에 표시됩니다. 누구나 목록에서 선택해 영상통화에 자동 입장합니다.")
            VStack(alignment:.leading,spacing:12) {
                Text("대화 시작하기").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text("내 이름으로 입장").font(.title2.bold())
                Text("로그인하시면 공개 영상방을 만들거나 목록에서 바로 입장할 수 있습니다.")
                    .font(.footnote).foregroundStyle(.secondary)
                TextField("사용자 ID",text:$userId)
                    .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .accessibilityIdentifier("native-user-id")
                TextField("표시 이름",text:$name)
                    .textContentType(.nickname).accessibilityIdentifier("native-display-name")
                Picker("접속 유형",selection:$role) {
                    Text("방 개설 사용자").tag("doctor")
                    Text("공개방 입장 사용자").tag("user")
                }
                Button {
                    Task {await store.login(id:userId,name:name,role:role)}
                } label:{
                    Label(store.busy ? "인증 중…" : "대화방 입장하기",systemImage:"arrow.right")
                        .frame(maxWidth:.infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(store.busy || userId.trimmingCharacters(in:.whitespaces).isEmpty
                          || name.trimmingCharacters(in:.whitespaces).isEmpty)
                .accessibilityIdentifier("native-login")
                Text("공개방 목록과 WebRTC 연결은 동일한 Railway 서버를 사용합니다.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            .textFieldStyle(.roundedBorder)
            .padding(18)
            .background(Color(uiColor:.secondarySystemGroupedBackground),
                        in:RoundedRectangle(cornerRadius:14))
        }
    }

    private var roomList:some View {
        VStack(alignment:.leading,spacing:16) {
            intro(title:"공개 영상 대화방",
                  subtitle:"방을 만들면 모든 사용자의 방 목록에 나타나며, 다른 사용자는 목록에서 선택하여 자동 입장합니다. 초대 ID는 필요하지 않습니다.")
            HStack {
                Button {createPresented=true} label:{
                    Label("공개방 만들기",systemImage:"plus")
                }.buttonStyle(.borderedProminent).accessibilityIdentifier("native-create-room")
                Button {Task {await store.refresh()}} label:{
                    Label("새로고침",systemImage:"arrow.clockwise")
                }.buttonStyle(.bordered)
            }
            HStack {
                Text("참여 가능한 방").font(.title3.bold())
                Text(String(store.rooms.count)).font(.title3.bold())
                Spacer()
                Text("4초 자동 갱신").font(.caption2).foregroundStyle(.secondary)
            }
            if store.rooms.isEmpty {
                VStack(spacing:12) {
                    Image(systemName:"video.bubble").font(.largeTitle).foregroundStyle(.secondary)
                    Text("현재 공개된 방이 없습니다.").font(.headline)
                    Text("새 영상방을 개설하면 다른 사용자에게 즉시 표시됩니다.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
                .frame(maxWidth:.infinity).padding(30)
                .background(Color(uiColor:.secondarySystemGroupedBackground),
                            in:RoundedRectangle(cornerRadius:12))
            }
            ForEach(store.rooms){room in
                Button {
                    Task{await store.enter(room)}
                }label:{
                    VStack(alignment:.leading,spacing:12) {
                        HStack {
                            Image(systemName:"person.2.wave.2").font(.title2)
                            Spacer()
                            Text("공개방").font(.caption.weight(.medium))
                        }
                        Text(room.title).font(.title3.bold())
                            .lineLimit(2).multilineTextAlignment(.leading)
                        Text("정원 \(room.policy.maxParticipants)명 · 현재 \(room.memberCount)명")
                            .font(.subheadline).foregroundStyle(.secondary)
                        HStack{
                            Text("방장 "+(room.hostUserIds.first ?? ""))
                            Spacer()
                            Text("바로 입장 →").fontWeight(.semibold)
                        }.font(.caption)
                    }.padding(16)
                        .frame(maxWidth:.infinity,alignment:.leading)
                        .background(Color(uiColor:.secondarySystemGroupedBackground),
                                    in:RoundedRectangle(cornerRadius:12))
                }.buttonStyle(.plain)
                    .disabled(store.busy)
                    .accessibilityIdentifier("native-room-"+room.id)
            }
            Text(store.status).font(.footnote).foregroundStyle(.secondary)
        }
    }

    private func liveRoom(_ room:HitelPublicRoom)->some View {
        VStack(alignment:.leading,spacing:15) {
            Text("LIVE · 공개 영상 대화방").font(.caption.bold()).foregroundStyle(.secondary)
            Text(room.title).font(.title.bold())
            Text("\(room.memberCount)명 · "+store.status)
                .font(.caption).foregroundStyle(.secondary)
            if !room.participants.isEmpty {
                ScrollView(.horizontal,showsIndicators:false){
                    HStack {
                        ForEach(room.participants){member in
                            Text(member.displayName ?? member.userId)
                                .font(.caption).padding(.horizontal,9).padding(.vertical,6)
                                .background(Color(uiColor:.secondarySystemGroupedBackground),
                                            in:Capsule())
                        }
                    }
                }
            }
            LazyVGrid(columns:[GridItem(.flexible()),GridItem(.flexible())],spacing:9) {
                HitelNativeVideoTile(track:store.localTrack,
                                     name:(store.identity?.name ?? "나")+" (나)")
                    .frame(height:210)
                ForEach(store.remote){person in
                    HitelNativeVideoTile(track:person.track,name:person.name)
                        .frame(height:210)
                }
            }
            HStack(spacing:7) {
                Button("가면 영상"){store.changeCameraMode(.mask)}
                    .buttonStyle(.borderedProminent)
                    .disabled(store.cameraMode == .mask)
                Button("원본 영상"){store.changeCameraMode(.original)}
                    .buttonStyle(.borderedProminent)
                    .disabled(store.cameraMode == .original)
            }
            HStack(spacing:7){
                Button(store.microphoneEnabled ? "마이크 끄기":"마이크 켜기"){
                    store.toggleMic()
                }.buttonStyle(.bordered)
                Button(store.cameraEnabled ? "카메라 끄기":"카메라 켜기"){
                    store.toggleCamera()
                }.buttonStyle(.bordered)
            }
            HStack {
                Button("참가자 새로고침"){Task{await store.refresh()}}
                    .buttonStyle(.bordered)
                if store.isHost {
                    Button("대화방 종료",role:.destructive){confirmEnd=true}
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("native-end-room")
                }else {
                    Button("방에서 나가기"){store.leave()}
                        .buttonStyle(.bordered)
                }
            }
            Text("영상 송신과 상대방 수신 상태는 다릅니다. ICE 연결 후 실제 미디어 수신 여부를 확인합니다.")
                .font(.caption2).foregroundStyle(.secondary)
        }
    }

    private var createSheet:some View {
        NavigationStack {
            Form {
                TextField("방 이름",text:$roomTitle)
                    .accessibilityIdentifier("native-room-title")
                Stepper("정원 \(capacity)명",value:$capacity,in:2...12)
                Text("상대방을 지정하지 않습니다. 로그인한 누구나 입장할 수 있습니다.")
                    .font(.caption).foregroundStyle(.secondary)
                Button("방을 만들고 입장"){
                    createPresented=false
                    Task {await store.create(title:roomTitle,capacity:capacity)}
                }
                .disabled(store.busy || roomTitle.trimmingCharacters(in:.whitespaces).isEmpty)
            }
            .navigationTitle("영상 대화방 만들기")
            .toolbar{ToolbarItem(placement:.topBarTrailing){
                Button("취소"){createPresented=false}
            }}
        }
    }

    private var aiSheet:some View {
        NavigationStack{
            Form{
                Picker("AI 상담 분야",selection:$store.aiProfile) {
                    ForEach(HitelNativeAISDK.profiles){item in
                        Text(item.label).tag(item)
                    }
                }
                Text(store.aiStatus)
                Text("AI 상담 기능은 별도의 기존 Railway 런타임을 이용합니다. 서버가 실제로 참여하지 않은 AI를 통화 참가자로 표시하지 않습니다.")
                    .font(.footnote).foregroundStyle(.secondary)
            }.navigationTitle("AI 상담 SDK")
        }
    }

    private func intro(title:String,subtitle:String)->some View {
        VStack(alignment:.leading,spacing:10) {
            Text("HITEL COMMUNICATION SDK · PUBLIC ROOMS")
                .font(.caption2.bold()).foregroundStyle(.secondary)
            Text(title).font(.largeTitle.bold()).fixedSize(horizontal:false,vertical:true)
            Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
        }.padding(.vertical,13)
    }
}

/// Native Metal rendering. This is NOT WKWebView, a snapshot, or an iframe.
struct HitelNativeVideoTile:View {
    let track:RTCVideoTrack?
    let name:String
    var body:some View {
        ZStack(alignment:.bottomLeading){
            Color.black
            if let track {HitelRTCVideoView(track:track)}
            else {
                Image(systemName:"person.crop.circle")
                    .font(.system(size:46)).foregroundStyle(.white.opacity(0.6))
                    .frame(maxWidth:.infinity,maxHeight:.infinity)
            }
            Text(name).font(.caption.bold())
                .foregroundStyle(.white)
                .padding(7)
                .background(.black.opacity(0.66),in:RoundedRectangle(cornerRadius:6))
                .padding(7)
        }.clipShape(RoundedRectangle(cornerRadius:10))
    }
}

struct HitelRTCVideoView:UIViewRepresentable {
    let track:RTCVideoTrack
    final class Coordinator {
        var current:RTCVideoTrack?
    }
    func makeCoordinator()->Coordinator {Coordinator()}
    func makeUIView(context:Context)->RTCMTLVideoView {
        let view=RTCMTLVideoView()
        view.videoContentMode = .scaleAspectFill
        return view
    }
    func updateUIView(_ view:RTCMTLVideoView,context:Context) {
        if context.coordinator.current === track {return}
        context.coordinator.current?.remove(view)
        track.add(view)
        context.coordinator.current=track
    }
    static func dismantleUIView(_ view:RTCMTLVideoView,coordinator:Coordinator){
        coordinator.current?.remove(view)
    }
}
