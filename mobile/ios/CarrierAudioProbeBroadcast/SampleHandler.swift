import Foundation
import ReplayKit
import CoreMedia
import AudioToolbox
import UserNotifications

/// Independent offline diagnostic extension. No uploads, sockets, screen pixels or web dependencies.
final class SampleHandler: RPBroadcastSampleHandler {
    private let groupID = "group.app.hitel.carrieraudioprobe"
    private let eventsFile = "hitel-probe-events.jsonl"
    private let sampleFile = "hitel-probe-optional-5s.wav"
    private let lock = NSLock()
    private var startedAt = ProcessInfo.processInfo.systemUptime
    private var lastFlush = ProcessInfo.processInfo.systemUptime
    private var active = false
    private var runID = ""
    private var videoFrames = 0
    private var appStats = Window()
    private var micStats = Window()
    private var notifyApp = Window()
    private var notifyMic = Window()
    private var lastNotify = ProcessInfo.processInfo.systemUptime
    private var sampleData = Data()
    private var sampleRate: UInt32 = 0
    private var sampleComplete = false
    private var sampleEnabled = false
    private var sampleDelay = 15.0
    private let sampleDuration = 5.0

    private struct Window {
        var buffers = 0
        var silentBuffers = 0
        var invalidBuffers = 0
        var samples = 0
        var sumSquares = 0.0
        var peak = 0.0
        var rate = 0.0
        var channels = 0
        var bits = 0
        var bigEndian = false
        mutating func add(_ m: Metrics) {
            buffers += 1
            samples += m.sampleCount
            sumSquares += m.rms * m.rms * Double(m.sampleCount)
            peak = max(peak, m.peak)
            if m.peak < 0.0005 { silentBuffers += 1 }
            rate = m.sampleRate
            channels = m.channels
            bits = m.bits
            bigEndian = m.bigEndian
        }
        mutating func invalid() { invalidBuffers += 1 }
        mutating func merge(_ other: Window) {
            buffers += other.buffers
            silentBuffers += other.silentBuffers
            invalidBuffers += other.invalidBuffers
            samples += other.samples
            sumSquares += other.sumSquares
            peak = max(peak, other.peak)
            if other.rate > 0 {
                rate = other.rate
                channels = other.channels
                bits = other.bits
                bigEndian = other.bigEndian
            }
        }
        mutating func clear() { self = Window() }
    }
    private struct Metrics {
        let peak: Double
        let rms: Double
        let sampleCount: Int
        let sampleRate: Double
        let channels: Int
        let bits: Int
        let bigEndian: Bool
        let mono: [Int16]?
    }
    private var sharedContainerAvailable: Bool {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID) != nil
    }
    private var directory: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)
        ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
    }

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        lock.lock()
        defer { lock.unlock() }
        active = true
        startedAt = ProcessInfo.processInfo.systemUptime
        lastFlush = startedAt
        let settings = UserDefaults(suiteName: groupID)
        runID = settings?.string(forKey: "probe.runID") ?? UUID().uuidString
        #if HITEL_FREE_SIGNING
        // In the explicitly opted-in free diagnostic build, the extension
        // cannot read app settings without App Groups. The host UI displays
        // its mandatory five-second sample policy before showing the picker.
        sampleEnabled = true
        sampleDelay = 30
        #else
        sampleEnabled = settings?.bool(forKey: "probe.saveSample") ?? false
        sampleDelay = max(0, min(60, settings?.object(forKey: "probe.sampleDelay") == nil ? 15 : settings!.double(forKey: "probe.sampleDelay")))
        #endif
        sampleData = Data()
        sampleRate = 0
        sampleComplete = false
        videoFrames = 0
        appStats.clear()
        micStats.clear()
        notifyApp.clear()
        notifyMic.clear()
        lastNotify = startedAt
        if !sharedContainerAvailable {
            sendNotification(kind: "started")
        }
        record(["type": "broadcast_started", "source": "broadcast",
                "sampleOptIn": sampleEnabled, "sampleDelaySeconds": sampleDelay])
    }

    override func broadcastPaused() {
        lock.lock(); defer { lock.unlock() }
        flush()
        record(["type": "broadcast_paused", "source": "broadcast"])
    }

    override func broadcastResumed() {
        lock.lock(); defer { lock.unlock() }
        record(["type": "broadcast_resumed", "source": "broadcast"])
    }

    override func broadcastFinished() {
        lock.lock(); defer { lock.unlock() }
        guard active else { return }
        flush()
        finishSample()
        if !sharedContainerAvailable {
            sendNotification(kind: "finished")
        }
        record(["type": "broadcast_finished", "source": "broadcast"])
        active = false
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        lock.lock(); defer { lock.unlock() }
        guard active else { return }
        let elapsed = ProcessInfo.processInfo.systemUptime - startedAt
        switch sampleBufferType {
        case .video:
            videoFrames += 1 // Never store video content.
        case .audioApp, .audioMic:
            let isApp = sampleBufferType == .audioApp
            let save = isApp && sampleEnabled && !sampleComplete &&
                elapsed >= sampleDelay && elapsed <= sampleDelay + sampleDuration + 1
            if let metrics = decode(sampleBuffer, includePCM: save) {
                if isApp { appStats.add(metrics) } else { micStats.add(metrics) }
                if save, let samples = metrics.mono {
                    if sampleRate == 0 { sampleRate = UInt32(metrics.sampleRate) }
                    if sampleRate == UInt32(metrics.sampleRate) {
                        for value in samples {
                            let word = UInt16(bitPattern: value)
                            sampleData.append(UInt8(truncatingIfNeeded: word))
                            sampleData.append(UInt8(truncatingIfNeeded: word >> 8))
                        }
                    }
                }
            } else {
                if isApp { appStats.invalid() } else { micStats.invalid() }
            }
            if isApp && sampleEnabled && !sampleComplete &&
                elapsed >= sampleDelay + sampleDuration {
                finishSample()
            }
        @unknown default:
            break
        }
        if ProcessInfo.processInfo.systemUptime - lastFlush >= 1 { flush() }
    }

    private func flush() {
        if appStats.buffers + appStats.invalidBuffers > 0 {
            emit(appStats, source: "audioApp")
            notifyApp.merge(appStats)
        }
        if micStats.buffers + micStats.invalidBuffers > 0 {
            emit(micStats, source: "audioMic")
            notifyMic.merge(micStats)
        }
        if videoFrames > 0 {
            record(["type": "video_count_only", "source": "video", "frames": videoFrames])
        }
        let current = ProcessInfo.processInfo.systemUptime
        if !sharedContainerAvailable && current - lastNotify >= 10 {
            sendNotification(kind: "window")
        }
        lastFlush = current
        appStats.clear()
        micStats.clear()
        videoFrames = 0
    }

    private func emit(_ w: Window, source: String) {
        let rms = w.samples > 0 ? sqrt(w.sumSquares / Double(w.samples)) : 0.0
        record(["type": "audio_window", "source": source, "buffers": w.buffers,
                "silentBuffers": w.silentBuffers, "invalidBuffers": w.invalidBuffers,
                "samples": w.samples, "rms": rms, "peak": w.peak,
                "sampleRate": w.rate, "channels": w.channels, "bits": w.bits,
                "bigEndian": w.bigEndian])
    }

    /// Reads ASBD format flags; ReplayKit app audio may be big endian Int16.
    private func decode(_ buffer: CMSampleBuffer, includePCM: Bool) -> Metrics? {
        guard CMSampleBufferIsValid(buffer),
              let format = CMSampleBufferGetFormatDescription(buffer),
              let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee,
              asbd.mFormatID == kAudioFormatLinearPCM,
              let block = CMSampleBufferGetDataBuffer(buffer) else { return nil }
        let length = CMBlockBufferGetDataLength(block)
        guard length > 0, length < 2_000_000 else { return nil }
        var bytes = [UInt8](repeating: 0, count: length)
        let result = bytes.withUnsafeMutableBytes { raw -> OSStatus in
            guard let addr = raw.baseAddress else { return -1 }
            return CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: addr)
        }
        guard result == noErr else { return nil }
        let big = (asbd.mFormatFlags & kAudioFormatFlagIsBigEndian) != 0
        let floating = (asbd.mFormatFlags & kAudioFormatFlagIsFloat) != 0
        let bits = Int(asbd.mBitsPerChannel)
        let size = bits / 8
        let channels = max(1, Int(asbd.mChannelsPerFrame))
        guard bits == 16 || bits == 32, length >= size * channels else { return nil }
        let frames = length / (size * channels)
        var peak = 0.0
        var square = 0.0
        var mono: [Int16]? = includePCM ? [] : nil
        if includePCM { mono?.reserveCapacity(frames) }

        func value(_ idx: Int) -> Double {
            let i = idx * size
            if bits == 16 {
                let u: UInt16 = big
                    ? (UInt16(bytes[i]) << 8) | UInt16(bytes[i + 1])
                    : UInt16(bytes[i]) | (UInt16(bytes[i + 1]) << 8)
                return Double(Int16(bitPattern: u)) / 32768
            }
            let u: UInt32 = big
                ? (UInt32(bytes[i]) << 24) | (UInt32(bytes[i + 1]) << 16) |
                  (UInt32(bytes[i + 2]) << 8) | UInt32(bytes[i + 3])
                : UInt32(bytes[i]) | (UInt32(bytes[i + 1]) << 8) |
                  (UInt32(bytes[i + 2]) << 16) | (UInt32(bytes[i + 3]) << 24)
            if floating {
                let v = Double(Float(bitPattern: u))
                return v.isFinite ? max(-1, min(1, v)) : 0
            }
            return Double(Int32(bitPattern: u)) / 2147483648
        }
        for frame in 0..<frames {
            var mixed = 0.0
            for channel in 0..<channels {
                let v = value(frame * channels + channel)
                peak = max(peak, abs(v))
                square += v * v
                mixed += v
            }
            if includePCM {
                let v = max(-1, min(1, mixed / Double(channels)))
                mono?.append(Int16(max(-32768, min(32767, Int(v * 32767)))))
            }
        }
        return Metrics(peak: peak, rms: sqrt(square / Double(frames * channels)),
                       sampleCount: frames * channels, sampleRate: asbd.mSampleRate,
                       channels: channels, bits: bits, bigEndian: big, mono: mono)
    }

    private func finishSample() {
        guard sampleEnabled && !sampleComplete else { return }
        sampleComplete = true
        guard !sampleData.isEmpty, sampleRate > 0, let directory else {
            record(["type": "sample_unavailable", "source": "audioApp",
                    "reason": "No audioApp PCM during opted-in interval"])
            return
        }
        var wav = Data()
        func appendU16(_ u: UInt16) {
            wav.append(UInt8(truncatingIfNeeded: u))
            wav.append(UInt8(truncatingIfNeeded: u >> 8))
        }
        func appendU32(_ u: UInt32) {
            wav.append(UInt8(truncatingIfNeeded: u))
            wav.append(UInt8(truncatingIfNeeded: u >> 8))
            wav.append(UInt8(truncatingIfNeeded: u >> 16))
            wav.append(UInt8(truncatingIfNeeded: u >> 24))
        }
        wav.append(contentsOf: Array("RIFF".utf8))
        appendU32(UInt32(sampleData.count + 36))
        wav.append(contentsOf: Array("WAVEfmt ".utf8))
        appendU32(16); appendU16(1); appendU16(1)
        appendU32(sampleRate); appendU32(sampleRate * 2)
        appendU16(2); appendU16(16)
        wav.append(contentsOf: Array("data".utf8))
        appendU32(UInt32(sampleData.count))
        wav.append(sampleData)
        do {
            try wav.write(to: directory.appendingPathComponent(sampleFile), options: [.atomic])
            if !sharedContainerAvailable {
                sendNotification(kind: "sample", attachmentURL: directory.appendingPathComponent(sampleFile))
            }
            record(["type": "sample_saved", "source": "audioApp", "bytes": wav.count,
                    "durationSeconds": Double(sampleData.count / 2) / Double(sampleRate),
                    "sampleRate": sampleRate, "explicitConsent": true])
        } catch {
            record(["type": "sample_write_failed", "source": "audioApp",
                    "error": error.localizedDescription])
        }
        sampleData.removeAll(keepingCapacity: false)
    }

    private func record(_ fields: [String: Any]) {
        guard let directory else { return }
        var object = fields
        object["at"] = ISO8601DateFormatter().string(from: Date())
        object["runID"] = runID
        object["elapsedSeconds"] = ProcessInfo.processInfo.systemUptime - startedAt
        guard JSONSerialization.isValidJSONObject(object),
              var row = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]) else { return }
        row.append(0x0A)
        let url = directory.appendingPathComponent(eventsFile)
        if !FileManager.default.fileExists(atPath: url.path) {
            _ = FileManager.default.createFile(atPath: url.path, contents: nil)
        }
        guard let handle = try? FileHandle(forWritingTo: url) else { return }
        defer { try? handle.close() }
        _ = try? handle.seekToEnd()
        try? handle.write(contentsOf: row)
    }

    /// App-Group-free fallback for Windows/free-Apple-ID signed builds.
    /// The iOS notification center is shared with the containing app, and
    /// notification attachments can transfer a user-approved short WAV.
    /// Every notification remains on-device; there is no network request.
    private func sendNotification(kind: String, attachmentURL: URL? = nil) {
        let center = UNUserNotificationCenter.current()
        let content = UNMutableNotificationContent()
        content.title = "HITEL 전화 음성 검증"
        content.body = kind == "sample" ? "동의하신 원음 샘플이 저장되었습니다."
            : kind == "finished" ? "방송이 종료되었습니다. 측정 결과를 앱에서 확인하십시오."
            : "오디오 수신 여부를 기록했습니다."
        if #available(iOS 15.0, *) { content.interruptionLevel = .passive }
        content.userInfo = [
            "hitelProbe": true,
            "kind": kind,
            "at": ISO8601DateFormatter().string(from: Date()),
            "appBuffers": notifyApp.buffers,
            "appSilent": notifyApp.silentBuffers,
            "appInvalid": notifyApp.invalidBuffers,
            "appSamples": notifyApp.samples,
            "appSquare": notifyApp.sumSquares,
            "appPeak": notifyApp.peak,
            "appRate": notifyApp.rate,
            "appChannels": notifyApp.channels,
            "appBits": notifyApp.bits,
            "appEndian": notifyApp.bigEndian,
            "micBuffers": notifyMic.buffers,
            "micSilent": notifyMic.silentBuffers,
            "micInvalid": notifyMic.invalidBuffers,
            "micSamples": notifyMic.samples,
            "micSquare": notifyMic.sumSquares,
            "micPeak": notifyMic.peak,
            "micRate": notifyMic.rate,
            "micChannels": notifyMic.channels,
            "micBits": notifyMic.bits,
            "micEndian": notifyMic.bigEndian
        ]
        if let attachmentURL {
            if let attachment = try? UNNotificationAttachment(
                identifier: "hitel-probe-wav", url: attachmentURL, options: nil
            ) { content.attachments = [attachment] }
        }
        let request = UNNotificationRequest(
            identifier: "hitel-probe-" + kind + "-" + UUID().uuidString,
            content: content, trigger: nil
        )
        center.add(request, withCompletionHandler: nil)
        notifyApp.clear()
        notifyMic.clear()
        lastNotify = ProcessInfo.processInfo.systemUptime
    }

}
