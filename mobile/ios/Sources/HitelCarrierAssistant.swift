import SwiftUI
import UIKit
import AVFoundation

/// Companion UI for carrier telephone scenarios. This does not and cannot
/// secretly extract remote carrier-call audio from iOS Phone.app. Signaling
/// notes and local TTS are separate from system cellular/PSTN media.
struct HitelCarrierAssistant: View {
    @ObservedObject var model:HitelNativePlaygroundModel
    @StateObject private var systemCall=HitelCarrierCallObserver()
    @State private var shareCallState=false
    @State private var phoneNumber=""
    @State private var note=""
    @State private var speechText=""
    @State private var confirmDial=false
    @State private var notice="통신사 통화는 iPhone 전화 앱에서 진행됩니다. HITEL은 상대방 음성을 자동 수집하지 않습니다."
    @State private var localSpeech=AVSpeechSynthesizer()
    private let allowed=CharacterSet(charactersIn:"+0123456789")
    var body:some View{
        VStack(alignment:.leading,spacing:12){
            HStack{
                Label("P+ 통신사 전화 · 개인 보조",systemImage:"phone.badge.waveform")
                    .font(.headline)
                Spacer()
                Text("전화 음성 직접 접근 불가").font(.caption2).foregroundStyle(.orange)
            }
            Text("HITEL 전화망 게이트웨이가 연결되지 않았습니다. 통신사 전화 연결과 Playground 신호 시험은 별개입니다.")
                .font(.caption).foregroundStyle(.secondary)
            VStack(alignment:.leading,spacing:5) {
                Text("실제 iOS 통화 상태 감지").font(.subheadline.bold())
                Text(systemCall.summary).font(.caption)
                Toggle("이 통화 상태를 Playground에 알림",isOn:$shareCallState)
                    .font(.caption)
                Text("CallKit은 통신사 통화와 다른 앱의 VoIP 통화를 구분하지 못하며, 전화 상대의 음성·번호는 제공하지 않습니다.")
                    .font(.caption2).foregroundStyle(.secondary)
            }.padding(10).background(Color(uiColor:.tertiarySystemFill)).clipShape(RoundedRectangle(cornerRadius:8))
                .onChange(of:systemCall.state){newValue in
                    if shareCallState {model.reportSystemCallState(newValue)}
                }
                .font(.caption).foregroundStyle(.secondary)
            HStack{
                TextField("전화번호 (실제로 연결할 번호)",text:$phoneNumber)
                    .keyboardType(.phonePad)
                    .textFieldStyle(.roundedBorder)
                Button("시스템 전화 열기"){confirmDial=true}
                    .buttonStyle(.borderedProminent)
                    .disabled(!validNumber)
            }
            .confirmationDialog("iPhone 전화 앱으로 번호를 전달하시겠습니까?",
                                isPresented:$confirmDial,titleVisibility:.visible){
                Button("전화 앱 열기"){
                    guard validNumber,let url=URL(string:"tel:"+phoneNumber) else{return}
                    UIApplication.shared.open(url){opened in
                        notice=opened ? "iOS 전화 앱으로 전달했습니다. 실제 통화 연결 여부는 HITEL에서 확인되지 않습니다.":
                                        "iOS에서 전화 앱을 열 수 없습니다."
                    }
                }
                Button("취소",role:.cancel){}
            }message:{Text("Playground의 WS 통화 성공과 무관한 별도 통신사 발신입니다.")}
            Text("상담 메모 (사용자가 직접 입력)").font(.subheadline.bold())
            TextEditor(text:$note)
                .frame(height:76)
                .scrollContentBackground(.hidden)
                .padding(5)
                .background(Color(uiColor:.tertiarySystemFill))
                .clipShape(RoundedRectangle(cornerRadius:9))
            Button("상담 메모를 Playground에 전송"){
                model.sendAssistanceNote(note)
                notice="직접 입력하신 메모를 같은 Playground 세션에 전달했습니다."
            }
            .buttonStyle(.bordered)
            .disabled(!model.connected || note.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
            Text("로컬 TTS · 사전 작성한 안내 읽기").font(.subheadline.bold())
            TextField("읽을 안내 문장",text:$speechText,axis:.vertical)
                .textFieldStyle(.roundedBorder)
            HStack{
                Button("아이폰 스피커로 읽기"){
                    let utterance=AVSpeechUtterance(string:String(speechText.prefix(700)))
                    utterance.voice=AVSpeechSynthesisVoice(language:"ko-KR")
                    utterance.rate=0.48
                    localSpeech.speak(utterance)
                }.buttonStyle(.bordered)
                    .disabled(speechText.isEmpty)
                Button("중지"){localSpeech.stopSpeaking(at:.immediate)}
                    .buttonStyle(.bordered)
            }
            Text("이 음성은 아이폰 기기에서만 재생됩니다. 통신사 상대방에게 삽입되는 음성이 아니며 AI 자동 응답도 아닙니다.")
                .font(.caption2).foregroundStyle(.secondary)
            Text(notice).font(.caption2).foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Color(uiColor:.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius:12))
    }
    private var validNumber:Bool {
        let trimmed=phoneNumber.trimmingCharacters(in:.whitespacesAndNewlines)
        return (2...24).contains(trimmed.count) && trimmed.unicodeScalars.allSatisfy{allowed.contains($0)}
    }
}
