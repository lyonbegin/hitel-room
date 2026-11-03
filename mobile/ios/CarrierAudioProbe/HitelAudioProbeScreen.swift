import SwiftUI
import Combine
import ReplayKit
import UIKit

/// Genuine system broadcast picker. The screenshot/video frames are discarded
/// by the extension; only audio levels and optional 5-second WAV are retained.
private struct NativeReplayKitPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 54, height: 54))
        #if HITEL_FREE_SIGNING
        picker.preferredExtension = "app.hitel.carrieraudioprobe.free.broadcast"
        #else
        picker.preferredExtension = "app.hitel.carrieraudioprobe.broadcast"
        #endif
        picker.showsMicrophoneButton = true
        picker.tintColor = .label
        return picker
    }
    func updateUIView(_ view: RPSystemBroadcastPickerView, context: Context) {}
}

struct HitelAudioProbeScreen: View {
    @ObservedObject var probe: HitelAudioProbeStore
    @State private var telephoneNumber = ""
    @State private var showHelp = false
    private let refreshTicker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let stages = [
        "대조 · 무음",
        "대조 · 440Hz 시험음",
        "대조 · 다른 앱 오디오",
        "일반전화 · 발신",
        "일반전화 · 수신",
        "일반전화 · 스피커",
        "일반전화 · 수화기",
        "일반전화 · 블루투스",
        "일반전화 · 보류",
        "일반전화 · 잠금 화면",
        "일반전화 · 종료 후"
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("HITEL · iPhone 음성 검증").font(.title2.bold())
                            Text("기본 일반전화 유지 · 순수 SwiftUI · 네이티브 오디오 계측")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button { showHelp.toggle() } label: {
                            Image(systemName: "questionmark.circle").font(.title2)
                        }.accessibilityLabel("검사 방법")
                    }

                    section {
                        Label("실기기 상태", systemImage: "iphone.gen3")
                            .font(.headline)
                        HStack(alignment: .center) {
                            Circle().fill(probe.hasSharedContainer ? .green : .red)
                                .frame(width: 9, height: 9)
                            Text(probe.hasSharedContainer
                                 ? "App Group 저장소 연결됨"
                                 : "무료 서명 · 로컬 알림 경로로 측정 결과를 회수합니다.")
                                .font(.subheadline)
                        }
                        Divider()
                        Text(probe.callStatus).font(.headline)
                        Text("CallKit: 발신·수신·연결·보류 상태만 관찰합니다. 상대방 번호나 통화 오디오를 직접 얻는 API가 아닙니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        HStack {
                            Button("상태 다시 읽기") { probe.refreshCall(); probe.refresh() }
                                .buttonStyle(.bordered)
                            Spacer()
                            Text(probe.broadcastStatus)
                                .font(.caption.bold())
                                .multilineTextAlignment(.trailing)
                        }
                    }

                    section {
                        Label("1. 실험 설정", systemImage: "slider.horizontal.3")
                            .font(.headline)
                        Text("검사를 시작하기 전에 설정하십시오. 화면 방송을 시작한 뒤 기본 전화 앱으로 이동하셔도 방송 확장이 별도로 기록합니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        Picker("검사 종류", selection: Binding(
                            get: { probe.phase },
                            set: { probe.setPhase($0) }
                        )) {
                            ForEach(stages, id: \.self) { stage in
                                Text(stage).tag(stage)
                            }
                        }
                        .pickerStyle(.menu)
                        Toggle(isOn: Binding(get: { probe.saveSample },
                                             set: { probe.configureSample($0) })) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("5초 원음 샘플 저장")
                                Text("기본 꺼짐 · 기기 내부에만 저장 · 관련 당사자 동의 후 사용")
                                    .font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        #if HITEL_FREE_SIGNING
                        if probe.saveSample {
                            Text("무료 Apple ID용: 방송 시작 30초 후 audioApp 5초를 기기 내부에 저장하고, 알림 첨부파일로 앱에 전달합니다. 알림 권한을 허용해 주십시오.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        #else
                        if probe.saveSample {
                            Picker("방송 시작 후 원음 저장 대기시간", selection: Binding(
                                get: { probe.sampleDelay },
                                set: { probe.configureDelay($0) }
                            )) {
                                Text("즉시").tag(0)
                                Text("15초 후").tag(15)
                                Text("30초 후").tag(30)
                                Text("60초 후").tag(60)
                            }
                            .pickerStyle(.menu)
                            Text("선택한 지연시간 후 5초 동안 audioApp만 저장합니다. 방송 시작 이후 통화 연결 시점을 고려해 설정하십시오.")
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        #endif
                        HStack {
                            Button("새 검사 시작 · 기존 측정 지우기") { probe.startFreshRun() }
                                .buttonStyle(.bordered)
                                .disabled(probe.isBroadcasting)
                            Button("현재 단계 기록") { probe.appendMarker("검사 단계 표시: " + probe.phase); probe.refresh() }
                                .buttonStyle(.bordered)
                        }
                    }

                    section {
                        Label("2. ReplayKit 방송을 직접 시작", systemImage: "record.circle")
                            .font(.headline)
                        #if HITEL_FREE_SIGNING
                        Button("측정 결과를 받기 위한 로컬 알림 허용") {
                            probe.requestNotificationPermission()
                        }.buttonStyle(.borderedProminent)
                        Text(probe.notificationStatus).font(.caption).foregroundStyle(.secondary)
                        #endif
                        HStack(spacing: 15) {
                            #if HITEL_FREE_SIGNING
                            if probe.saveSample {
                                NativeReplayKitPicker()
                                    .frame(width: 54, height: 54)
                                    .accessibilityLabel("원음 5초 저장에 동의하고 방송 시작")
                            } else {
                                Image(systemName: "lock.shield")
                                    .font(.title2)
                                    .frame(width: 54, height: 54)
                                    .accessibilityLabel("원음 저장 동의 후 방송 활성")
                            }
                            #else
                            NativeReplayKitPicker()
                                .frame(width: 54, height: 54)
                                .accessibilityLabel("iPhone 시스템 방송 선택")
                            #endif
                            VStack(alignment: .leading, spacing: 5) {
                                Text("시스템 방송 버튼을 누르십시오.").font(.subheadline.bold())
                                Text("목록에서 HITEL Audio Probe Broadcast를 선택하고 방송을 시작합니다. 마이크를 켜면 audioMic도 별도 관찰할 수 있습니다.")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        Text("iOS 화면 기록/방송 허가가 필요합니다. 실제 비디오 화면은 기록하거나 전송하지 않습니다. 화면 방송을 끝낼 때에는 iPhone의 빨간 방송 표시 또는 제어센터를 이용하십시오.")
                            .font(.caption2).foregroundStyle(.secondary)
                    }

                    section {
                        Label("3. 음성 수신 계측 결과", systemImage: "waveform.path.ecg")
                            .font(.headline)
                        if probe.appBuffers == 0 && probe.micBuffers == 0 {
                            Text("아직 audioApp 또는 audioMic 버퍼가 도착하지 않았습니다.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        metric("audioApp · 타 앱 재생/시스템 오디오", buffers: probe.appBuffers,
                               silent: probe.appSilentBuffers, invalid: probe.appInvalidBuffers,
                               rms: probe.appRMS, peak: probe.appPeak)
                        Divider()
                        metric("audioMic · iPhone 마이크", buffers: probe.micBuffers,
                               silent: probe.micSilentBuffers, invalid: probe.micInvalidBuffers,
                               rms: probe.micRMS, peak: probe.micPeak)
                        Text(probe.audioFormat)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                        Text("주의: audioApp에서 비무음 신호가 감지되어도 그것이 전화 상대방의 목소리라는 뜻은 아닙니다. 저장한 샘플과 실제 발화 내용의 대조가 필요합니다.")
                            .font(.caption).foregroundStyle(.secondary)
                    }

                    section {
                        Label("4. 재현 가능한 대조 시험", systemImage: "checkmark.seal")
                            .font(.headline)
                        Text("① 방송을 켠 후 5초간 아무 소리도 재생하지 마십시오. ② 음성 신호가 없는 무음 대조 구간을 확인하십시오. ③ 아래 시험음을 틀고 audioApp 수치를 확인합니다. ④ 마지막으로 기본 전화 앱을 이용하여 실제 상대방과 통화하면서 비교하십시오.")
                            .font(.subheadline)
                        Button {
                            probe.setPhase("대조 · 440Hz 시험음")
                            probe.playReferenceTone()
                        } label: {
                            Label("이 iPhone에서 440Hz 시험음 재생", systemImage: "speaker.wave.2")
                        }.buttonStyle(.bordered)
                            .disabled(probe.activeCall)
                        Text("시험음은 다른 앱의 오디오 수신 성공을 증명하지 않지만, 음성 버퍼 파싱과 측정기의 양성 대조군입니다.")
                            .font(.caption2).foregroundStyle(.secondary)
                        HStack {
                            TextField("실제 통화할 번호", text: $telephoneNumber)
                                .keyboardType(.phonePad)
                                .textContentType(.telephoneNumber)
                                .textFieldStyle(.roundedBorder)
                            Button {
                                dialCarrierNumber(telephoneNumber)
                            } label: {
                                Label("기본 전화 앱", systemImage: "phone.arrow.up.right")
                            }.buttonStyle(.borderedProminent)
                        }
                        HStack {
                            Button {
                                telephoneNumber = "100"
                                dialCarrierNumber("100")
                            } label: {
                                Label("100 고객센터로 바로 발신", systemImage: "phone")
                            }
                            .buttonStyle(.borderedProminent)
                            Button("번호 100 입력") {
                                telephoneNumber = "100"
                                probe.appendMarker("단축번호 100 직접 입력")
                            }.buttonStyle(.bordered)
                        }
                        Text("100·112·119 등 단축번호를 허용합니다. 전화 앱이 열리는지까지 결과 기록에 남깁니다.")
                            .font(.caption2).foregroundStyle(.secondary)
                        if !probe.dialStatus.isEmpty {
                            Text(probe.dialStatus)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Text("방송이 켜진 상태에서 발신하십시오. 실제 회선 통화로 연결되어야 결과가 의미 있습니다. 통화 전·중·후에 음성 신호가 중단되는지도 기록합니다.")
                            .font(.caption).foregroundStyle(.secondary)
                    }

                    section {
                        Label("5. 사용자 동의 원음 확인 · 통화 후", systemImage: "waveform")
                            .font(.headline)
                        Text(probe.sampleSaved
                             ? "WAV 원음 저장됨 · " + String(format: "%.2f", probe.sampleDuration) + "초"
                             : "저장된 WAV 원음 없음 (기본 설정에서는 저장하지 않습니다.)")
                            .font(.subheadline)
                        HStack {
                            Button("원음 재생") { probe.playSavedSample() }
                                .disabled(!probe.sampleSaved || probe.activeCall)
                            Button("한국어 온디바이스 전사") { probe.transcribeSavedSample() }
                                .disabled(!probe.sampleSaved || probe.activeCall || probe.isRecognizing)
                        }.buttonStyle(.bordered)
                        Text(probe.transcriptionStatus).font(.caption).foregroundStyle(.secondary)
                        if !probe.recognizedText.isEmpty {
                            Text(probe.recognizedText)
                                .textSelection(.enabled).padding(10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(uiColor: .tertiarySystemGroupedBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        if let url = probe.sampleURL {
                            ShareLink(item: url) {
                                Label("동의받은 5초 WAV 샘플 내보내기", systemImage: "square.and.arrow.up")
                            }
                        }
                    }

                    section {
                        Label("6. 전체 시험 기록 내보내기", systemImage: "doc.text")
                            .font(.headline)
                        Text("버퍼 수·RMS·peak·무음·빅엔디언 여부·시험 시점·오류를 JSONL에 기록합니다. 파일을 내보내시면 동일 데이터로 재분석할 수 있습니다.")
                            .font(.caption).foregroundStyle(.secondary)
                        if let url = probe.exportURL {
                            ShareLink(item: url) {
                                Label("실기기 측정 JSONL 내보내기", systemImage: "square.and.arrow.up")
                            }.buttonStyle(.borderedProminent)
                        } else {
                            Text("측정 파일 없음").font(.caption).foregroundStyle(.secondary)
                        }
                        HStack {
                            Text("최근 이벤트").font(.subheadline.bold())
                            Spacer()
                            Button("새로고침") { probe.refresh() }.buttonStyle(.bordered)
                        }
                        ForEach(Array(probe.recentEvents.prefix(16).enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.system(size: 10, design: .monospaced))
                                .textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        if !probe.notice.isEmpty {
                            Text(probe.notice).font(.caption).foregroundStyle(.red)
                        }
                    }

                    Text("이 앱의 목적은 가설 검증입니다. Apple 기본 전화의 상대방 음성이 수집되는지 현재 보장하지 않으며, 실제 성공은 본인 음성과 상대방 음성을 구분한 후 판정합니다. 통화 중 녹음·저장에 필요한 고지와 동의를 지켜 주십시오.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
                .padding(15)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("전화 음성 실기기 검증")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showHelp) {
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            Text("테스트 순서").font(.title2.bold())
                            Text("1. 새 검사를 시작하고 '대조 · 무음'을 선택합니다.")
                            Text("2. 필요하면 원음 저장을 켜고 지연시간을 정합니다. 이 설정은 방송 시작 시 확정됩니다.")
                            Text("3. 네이티브 방송 버튼 → HITEL Audio Probe Broadcast → 방송 시작.")
                            Text("4. 우선 무음, 그다음 440Hz 시험음을 확인합니다.")
                            Text("5. 방송을 종료하지 않고 기본 전화 앱으로 실제 발신·수신을 실행합니다.")
                            Text("6. 통화 중 스피커/수화기/블루투스/보류/화면 잠금 상황을 각각 확인합니다.")
                            Text("7. 전화를 종료하고 이 앱을 열어 버퍼 통계·오류·동의받은 원음·전사를 검사합니다.")
                            Text("8. JSONL 및 필요한 경우 WAV 파일을 공유합니다.")
                            Text("판정: audioApp 버퍼 도착 ≠ 통화 상대방 음성 확보. 반드시 상대방 발화와 WAV/자막을 비교해야 합니다.")
                        }.font(.body).padding()
                    }
                    .navigationTitle("검사 안내")
                    .toolbar { Button("닫기") { showHelp = false } }
                }
            }
            .onReceive(refreshTicker) { _ in
                #if HITEL_FREE_SIGNING
                probe.importNotificationEvidence()
                #endif
                probe.refresh()
            }
            .onAppear {
                probe.refreshCall()
                probe.refresh()
                #if HITEL_FREE_SIGNING
                probe.importNotificationEvidence()
                #endif
            }
        }
    }

    private func section<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12, content: content)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func dialCarrierNumber(_ number: String) {
        probe.setPhase("일반전화 · 발신")
        guard let url = HitelCarrierDialURL.make(number) else {
            probe.appendMarker("전화번호 정규화 실패 · 입력=" + number)
            probe.setDialStatus("전화번호 형식 오류: " + number)
            return
        }
        let display = url.absoluteString.replacingOccurrences(of: "tel:", with: "")
        probe.appendMarker("전화 앱 실행 요청 · 번호=" + display)
        UIApplication.shared.open(url, options: [:]) { didOpen in
            DispatchQueue.main.async {
                if didOpen {
                    probe.setDialStatus("기본 전화 앱 열기 성공 · " + display + " (통화 연결은 별도 확인)")
                    probe.appendMarker("기본 전화 앱 열기 성공 · " + display)
                } else {
                    probe.setDialStatus("iOS 기본 전화 앱 열기 실패 · " + display)
                    probe.appendMarker("iOS 전화 URL 열기 실패 · " + display)
                }
                probe.refresh()
            }
        }
    }

    private func metric(_ title: String, buffers: Int, silent: Int, invalid: Int,
                        rms: Double, peak: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(.subheadline.bold())
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(String(buffers)).font(.title3.monospacedDigit().bold())
                    Text("수신 버퍼").font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text(String(format: "%.6f", rms)).monospacedDigit()
                    Text("RMS").font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text(String(format: "%.5f", peak)).monospacedDigit()
                    Text("최대 진폭").font(.caption2).foregroundStyle(.secondary)
                }
            }
            Text("무음 버퍼 " + String(silent) + " · 디코딩 실패 " + String(invalid))
                .font(.caption2).foregroundStyle(.secondary)
            ProgressView(value: min(1, rms * 5))
                .tint(.primary)
        }
    }
}
