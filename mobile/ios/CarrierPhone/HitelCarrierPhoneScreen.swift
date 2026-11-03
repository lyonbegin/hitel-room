import SwiftUI
import UniformTypeIdentifiers
import UIKit

/// Completely native carrier-phone UI. No embedded browser, video room,
/// WebRTC package, Railway backend, or device-management controls.
struct HitelCarrierPhoneScreen: View {
    @ObservedObject var model: HitelCarrierPhoneModel
    @AppStorage("hitel.carrier.phone.last-dialed") private var dialNumber = ""
    @State private var selectedTab: PhoneTab = .phone
    @State private var importingRecording = false
    @State private var recognitionLanguage = "ko-KR"
    @State private var speechLanguage = "ko-KR"
    @State private var speechText = ""

    private enum PhoneTab: Hashable {
        case phone, recording, speech
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack { phoneView }
                .tabItem { Label("일반전화", systemImage: "phone") }
                .tag(PhoneTab.phone)
            NavigationStack { recordingView }
                .tabItem { Label("녹음·전사", systemImage: "text.bubble") }
                .tag(PhoneTab.recording)
            NavigationStack { speechView }
                .tabItem { Label("네이티브 음성", systemImage: "waveform") }
                .tag(PhoneTab.speech)
        }
        .tint(.primary)
        .fileImporter(
            isPresented: $importingRecording,
            allowedContentTypes: [.audio],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    model.recognizeStoredRecording(url, languageCode: recognitionLanguage)
                }
            case .failure(let error):
                // The importer does not invent an imported file or transcript.
                model.cancelRecognition()
                NSLog("HITEL_CARRIER_RECORDING_IMPORT_ERROR %@", error.localizedDescription)
            }
        }
    }

    private var phoneView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("HITEL 전화").font(.largeTitle.bold())
                    Text("iPhone 기본 전화 · 별도 네이티브 앱")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(alignment: .leading, spacing: 10) {
                    Label("통화 상태", systemImage: "phone.connection")
                        .font(.headline)
                    HStack(alignment: .center, spacing: 10) {
                        Circle()
                            .fill(model.callConnected ? Color.green : Color.secondary)
                            .frame(width: 9, height: 9)
                        Text(model.callStatus).font(.subheadline)
                        Spacer()
                        Button {
                            model.refreshCallStatus()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .accessibilityLabel("통화 상태 새로고침")
                    }
                    Text("iOS가 제공하는 발신·수신·연결·보류 상태만 표시합니다. 상대방 전화번호와 원격 음성 데이터는 제공되지 않습니다.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(15)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 14))

                VStack(spacing: 14) {
                    HStack(alignment: .center) {
                        TextField("전화번호", text: $dialNumber)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .font(.system(size: 26, weight: .medium, design: .rounded))
                            .multilineTextAlignment(.center)
                            .textFieldStyle(.plain)
                            .accessibilityLabel("발신할 전화번호")
                        if !dialNumber.isEmpty {
                            Button {
                                dialNumber.removeLast()
                            } label: {
                                Image(systemName: "delete.left")
                                    .font(.title3)
                            }
                            .accessibilityLabel("마지막 번호 지우기")
                        }
                    }
                    .frame(minHeight: 50)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 3), spacing: 12) {
                        ForEach(["1","2","3","4","5","6","7","8","9","*","0","#"], id: \.self) { digit in
                            Button {
                                if dialNumber.count < 24 {
                                    dialNumber.append(digit)
                                }
                            } label: {
                                Text(digit)
                                    .font(.system(size: 27, weight: .medium, design: .rounded))
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 60)
                                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                                    .clipShape(Circle())
                            }
                            .foregroundStyle(.primary)
                            .accessibilityLabel("전화번호 \(digit)")
                        }
                    }

                    Button {
                        model.openCarrierDialer(dialNumber)
                    } label: {
                        Label("기본 전화 앱에서 발신", systemImage: "phone.arrow.up.right.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(dialNumber.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    if !model.lastError.isEmpty {
                        Text(model.lastError)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    Text("기존 통신사 전화번호로 전화를 겁니다. HITEL이 전화망을 대체하거나 웹통화로 전환하지 않습니다.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 5)
            }
            .padding(18)
        }
        .navigationTitle("전화")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var recordingView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 17) {
                Text("통화 녹음·자막")
                    .font(.title2.bold())
                Text("iPhone 전화 앱에서 녹음한 파일을 메모 또는 파일 앱을 통해 이 앱으로 가져와 네이티브 음성 인식을 실행합니다.")
                    .font(.callout)
                    .foregroundStyle(.secondary)

                Picker("녹음 언어", selection: $recognitionLanguage) {
                    Text("한국어").tag("ko-KR")
                    Text("영어").tag("en-US")
                    Text("프랑스어").tag("fr-FR")
                }
                .pickerStyle(.segmented)

                Button {
                    importingRecording = true
                } label: {
                    Label("통화 녹음 파일 가져오기", systemImage: "waveform.badge.plus")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                }
                .buttonStyle(.borderedProminent)

                HStack {
                    Text(model.recognitionStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if model.transcriptionActive {
                        ProgressView()
                    }
                }
                if model.transcriptionActive {
                    Button("음성 인식 중지") { model.cancelRecognition() }
                        .buttonStyle(.bordered)
                }

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("전사 결과").font(.headline)
                        Spacer()
                        if !model.transcript.isEmpty {
                            ShareLink(item: model.transcript) {
                                Label("공유", systemImage: "square.and.arrow.up")
                            }
                            Button("지우기") { model.clearTranscript() }
                        }
                    }
                    ScrollView {
                        Text(model.transcript.isEmpty
                             ? "실제 녹음 파일에서 인식한 문장이 여기에 표시됩니다."
                             : model.transcript)
                            .font(.body)
                            .foregroundStyle(model.transcript.isEmpty ? .secondary : .primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    .frame(minHeight: 210)
                    .padding(10)
                    .background(Color(uiColor: .secondarySystemGroupedBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    if !model.transcript.isEmpty {
                        Button {
                            speechText = model.transcript
                            selectedTab = .speech
                        } label: {
                            Label("전사 결과를 음성으로 재생", systemImage: "speaker.wave.2")
                        }
                        .buttonStyle(.bordered)
                    }
                }

                Text("이 화면은 저장된 녹음 파일을 처리합니다. 기본 전화 앱의 통화 중 원격 음성을 실시간으로 직접 가져왔다고 표시하지 않습니다. 녹음 파일은 인식 후 임시 저장소에서 삭제하며 서버로 보내지 않습니다.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(18)
        }
        .navigationTitle("녹음·전사")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var speechView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("네이티브 음성")
                    .font(.title2.bold())
                Text("iPhone 음성 합성 기능으로 문장을 읽습니다.")
                    .foregroundStyle(.secondary)
                    .font(.callout)
                TextField("재생할 문장을 입력해 주십시오.", text: $speechText, axis: .vertical)
                    .lineLimit(4...8)
                    .textFieldStyle(.roundedBorder)
                Picker("음성 언어", selection: $speechLanguage) {
                    Text("한국어").tag("ko-KR")
                    Text("영어").tag("en-US")
                    Text("프랑스어").tag("fr-FR")
                }
                .pickerStyle(.segmented)
                HStack {
                    Button {
                        model.speak(speechText, voice: speechLanguage)
                    } label: {
                        Label("읽기", systemImage: "speaker.wave.2.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    if model.isSpeaking {
                        Button("중지") { model.stopSpeaking() }
                            .buttonStyle(.bordered)
                    }
                }

                Divider()

                Text("일반전화 합성 음성 추가")
                    .font(.headline)
                Text("iOS가 지원하는 경우, 사용자의 승인을 받아 합성 음성을 진행 중인 일반전화에 추가할 수 있습니다. **기존 마이크 원음을 차단하거나 대체하는 기능은 아닙니다.**")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(model.injectionStatus)
                    .font(.caption)
                HStack {
                    Button("통화 음성 추가 권한·설정") { model.requestInjection() }
                        .buttonStyle(.bordered)
                    if model.injectionRequested {
                        Button("해제") { model.disableInjection() }
                            .buttonStyle(.bordered)
                    }
                    Button {
                        model.refreshInjectionStatus()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("음성 추가 상태 새로고침")
                }
                Text("웹 연결·WebRTC·영상 카메라·서버 녹음 전송 기능은 이 앱에 포함되지 않습니다.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(18)
        }
        .navigationTitle("음성")
        .navigationBarTitleDisplayMode(.inline)
    }
}
