import SwiftUI
import CallKit
import AVFoundation
import Speech
import UIKit

/// Reports the limited call-state data exposed by CallKit.
/// CXCall does NOT expose the cellular counterparty's telephone number or PCM.
final class HitelCarrierCallWatcher: NSObject, ObservableObject, CXCallObserverDelegate {
    @Published private(set) var stateText = "활성 통화 확인 중"
    @Published private(set) var hasActiveCall = false
    @Published private(set) var connected = false
    @Published private(set) var outgoing = false
    @Published private(set) var callIdentifier = ""
    @Published private(set) var held = false

    private let observer = CXCallObserver()

    override init() {
        super.init()
        observer.setDelegate(self, queue: .main)
        refresh()
    }

    func refresh() {
        guard let call = observer.calls.first(where: { !$0.hasEnded }) else {
            stateText = "현재 감지되는 통화 없음"
            hasActiveCall = false
            connected = false
            outgoing = false
            held = false
            callIdentifier = ""
            return
        }
        callIdentifier = call.uuid.uuidString
        hasActiveCall = true
        outgoing = call.isOutgoing
        connected = call.hasConnected
        held = call.isOnHold
        let direction = call.isOutgoing ? "발신" : "수신"
        if call.isOnHold {
            stateText = direction + " · 보류 중"
        } else if call.hasConnected {
            stateText = direction + " · 연결됨"
        } else {
            stateText = direction + " · 연결 대기 중"
        }
    }

    func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        refresh()
    }
}

/// Explicit, experimental ambient-microphone caption input.
/// The microphone may be unavailable during a cellular call. This is NOT
/// a cellular receive-audio API and does NOT identify which party is talking.
final class HitelCarrierAmbientCaption: NSObject, ObservableObject {
    @Published private(set) var transcript = ""
    @Published private(set) var status = "대기 · 외부 음성 입력 없음"
    @Published private(set) var isRunning = false

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var tapAttached = false

    func start(whileCallActive: Bool) {
        guard !isRunning else { return }
        SFSpeechRecognizer.requestAuthorization { [weak self] auth in
            DispatchQueue.main.async {
                guard let self else { return }
                guard auth == .authorized else {
                    self.status = "iPhone 설정에서 HITEL 음성 인식 권한을 허용해야 합니다."
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { [weak self] allowed in
                    DispatchQueue.main.async {
                        guard let self else { return }
                        guard allowed else {
                            self.status = "마이크 사용 권한이 없습니다."
                            return
                        }
                        self.openAudio(whileCallActive: whileCallActive)
                    }
                }
            }
        }
    }

    private func openAudio(whileCallActive: Bool) {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ko-KR")),
              recognizer.isAvailable else {
            status = "한국어 음성 인식 서비스를 사용할 수 없습니다."
            return
        }
        do {
            // During a cellular call, do not change the Phone app audio route
            // or forcibly activate a competing session.
            if !whileCallActive {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
            }
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                status = "현재 사용할 수 있는 마이크 입력 형식이 없습니다."
                return
            }
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            request = req
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                req.append(buffer)
            }
            tapAttached = true
            engine.prepare()
            try engine.start()
            isRunning = true
            status = whileCallActive
                ? "통화 중 주변 마이크 인식 시험 중 · 통화 상대방의 직접 음성은 아닙니다."
                : "주변 마이크 음성 실시간 인식 중"
            task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self else { return }
                    if let result {
                        self.transcript = result.bestTranscription.formattedString
                        if result.isFinal {
                            self.status = "음성 인식 구간 종료 · 다시 시작하면 새 구간을 인식합니다."
                            self.stop(keepStatus: true)
                        }
                    }
                    if let error {
                        self.status = "음성 인식 중단: " + error.localizedDescription
                        self.stop(keepStatus: true)
                    }
                }
            }
        } catch {
            status = "마이크 시작 실패: " + error.localizedDescription
                + " · 일반전화 중 iOS가 앱의 오디오 입력을 제한할 수 있습니다."
            stop(keepStatus: true)
        }
    }

    func stop(keepStatus: Bool = false) {
        if engine.isRunning { engine.stop() }
        if tapAttached {
            engine.inputNode.removeTap(onBus: 0)
            tapAttached = false
        }
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        isRunning = false
        if !keepStatus { status = "주변 마이크 인식 중지" }
    }

    func clear() { transcript = "" }
}

struct HitelCarrierCaptionScreen: View {
    @AppStorage("hitel.carrier.caption.targetNumber")
    private var savedNumber = ""
    @StateObject private var call = HitelCarrierCallWatcher()
    @StateObject private var ambient = HitelCarrierAmbientCaption()
    @Environment(\.scenePhase) private var scenePhase
    @State private var manuallyConfirmed = false
    @State private var dialingError = ""

    private var cleanedNumber: String {
        let permitted = CharacterSet(charactersIn: "+0123456789")
        return String(savedNumber.unicodeScalars.filter { permitted.contains($0) })
    }

    private func dial() {
        let number = cleanedNumber
        guard number.count >= 3, number.count <= 24,
              let url = URL(string: "tel:" + number) else {
            dialingError = "유효한 전화번호를 입력해 주십시오."
            return
        }
        dialingError = ""
        UIApplication.shared.open(url, options: [:]) { opened in
            if !opened {
                DispatchQueue.main.async {
                    dialingError = "iPhone 전화 앱을 열지 못했습니다."
                }
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("일반전화 · 실시간 자막 시험")
                        .font(.title2.bold())
                    Text("기존 통신사 전화 앱을 사용합니다. HITEL은 통화 상태를 표시하지만, 전화 상대방의 음성이나 전화번호를 직접 읽을 수는 없습니다.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("① 시험할 전화번호").font(.headline)
                    TextField("01012345678 또는 국제전화번호", text: $savedNumber)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .textFieldStyle(.roundedBorder)
                    HStack {
                        Button {
                            dial()
                        } label: {
                            Label("이 번호로 일반전화 발신", systemImage: "phone.arrow.up.right")
                        }.buttonStyle(.borderedProminent)
                        Button("번호 지우기") {
                            savedNumber = ""
                            manuallyConfirmed = false
                        }.buttonStyle(.bordered)
                    }
                    Text("저장한 번호는 이 iPhone 앱에만 보관됩니다. 전화번호는 자동 전송하지 않습니다.")
                        .font(.caption2).foregroundStyle(.secondary)
                    if !dialingError.isEmpty {
                        Text(dialingError).font(.caption).foregroundStyle(.red)
                    }
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("② 일반전화 상태").font(.headline)
                        Spacer()
                        Button("새로 확인") { call.refresh() }.buttonStyle(.bordered)
                    }
                    Label(call.stateText, systemImage: call.connected ? "phone.fill" : "phone")
                        .font(.subheadline.bold())
                    Text(call.hasActiveCall
                         ? (call.outgoing ? "발신 통화가 감지되었습니다." : "수신 통화가 감지되었습니다.")
                         : "발신하거나 전화를 받은 뒤 이 화면으로 돌아오십시오.")
                        .font(.caption).foregroundStyle(.secondary)
                    if call.hasActiveCall {
                        Toggle("현재 통화가 위에 입력한 번호와 연결된 통화임을 직접 확인했습니다", isOn: $manuallyConfirmed)
                            .font(.caption)
                    }
                    Text("CallKit이 제공하는 것은 발신·수신 방향과 통화 상태입니다. 일반전화 상대방의 실제 번호는 제공하지 않으므로, 입력한 번호와 자동으로 일치한다고 표시하지 않습니다.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 8) {
                    Text("③ 실시간 자막").font(.headline)
                    Text("HITEL 자막 입력")
                        .font(.subheadline.bold())
                    ScrollView {
                        Text(ambient.transcript.isEmpty ? "음성 입력 대기 중입니다. 아직 인식된 자막이 없습니다." : ambient.transcript)
                            .font(.title3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .foregroundStyle(ambient.transcript.isEmpty ? .secondary : .primary)
                            .textSelection(.enabled)
                            .padding(12)
                    }
                    .frame(minHeight: 125, maxHeight: 225)
                    .background(Color(uiColor: .systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 9))
                    HStack {
                        Button(ambient.isRunning ? "주변 마이크 인식 중지" : "주변 마이크 자막 시험") {
                            if ambient.isRunning { ambient.stop() }
                            else { ambient.start(whileCallActive: call.hasActiveCall) }
                        }.buttonStyle(.bordered)
                        Button("자막 지우기") { ambient.clear() }.buttonStyle(.bordered)
                    }
                    Text(ambient.status)
                        .font(.caption2).foregroundStyle(.secondary)
                    Text("이 시험은 기기 주변 마이크 소리만 인식합니다. 통화 중 스피커폰의 소리가 마이크에 실제 들어오고 iOS가 동시 입력을 허용할 때만 문자가 표시될 수 있으며, 본인 음성이나 주변 소음도 포함됩니다. 통화 음성 직접 수신 기능으로 간주하지 않습니다.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 8) {
                    Text("④ iPhone 시스템 통화 자막").font(.headline)
                    Text("iPhone 설정 → 손쉬운 사용 → 실시간 자막 → 켜기")
                        .font(.subheadline)
                    Text("통화 중 iOS 실시간 자막 창을 열어 사용하십시오. Apple의 시스템 자막은 HITEL 앱 내부 텍스트로 자동 전달되지 않습니다. 일부 모델·언어·지역에서 지원되지 않을 수 있습니다.")
                        .font(.caption).foregroundStyle(.secondary)
                    Link("Apple 실시간 자막 공식 사용법",
                         destination: URL(string: "https://support.apple.com/ko-kr/guide/iphone/iphe0990f7bb/27/ios/27")!)
                        .font(.caption)
                }
                .padding(12)
                .background(Color(uiColor: .secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))

                Text("시험 순서: 번호 저장 → 일반전화 발신 또는 수신 → 통화 유지 → HITEL 다시 열기 → 통화 상태 확인 → 시스템 실시간 자막 또는 주변 마이크 실험. 이 앱이 백그라운드에서 지속적으로 통화 음성을 수집하거나, 전화를 받을 때 스스로 실행되지는 않습니다.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding(16)
        }
        .navigationTitle("전화 자막 시험")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { call.refresh() }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                call.refresh()
            } else if phase == .background {
                // Active cellular calls must not be disrupted by a competing mic engine.
                if ambient.isRunning { ambient.stop() }
            }
        }
        .onChange(of: call.callIdentifier) { _ in manuallyConfirmed = false }
        .onDisappear { ambient.stop() }
    }
}
