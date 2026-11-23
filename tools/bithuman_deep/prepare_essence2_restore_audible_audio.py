#!/usr/bin/env python3
"""Restore sound with minimum host-only change. Do not touch original/WG128 JNI, GPU hooks, or frame pipelines.

Evidence: previous working Essence2SpeechPlayer used USAGE_MEDIA.
Restored default AvatarPlayer has 'capturable=false' so USAGE_VOICE_COMMUNICATION,
which may route audio to handset earpiece. AvatarPlayer also ignored 0 / short
AudioTrack.write results. Use MEDIA and log actual device/play state.
"""
import argparse,json
from pathlib import Path

PKG="android/src/main/kotlin/ai/bithuman/flutter"
def one(text,before,after,label):
    n=text.count(before)
    if n!=1: raise AssertionError(f"AUDIO_FIX_ANCHOR_{label} count={n}")
    return text.replace(before,after,1)

def patch(plugin,report):
    root=plugin/PKG
    host=root/"BithumanPlugin.kt"
    text=host.read_text()
    text=one(text,
      "return AvatarPlayer(s.avatar, workers, debuggable = debuggable, capturable = false,",
      "return AvatarPlayer(s.avatar, workers, debuggable = debuggable, capturable = true,",
      "media_route")
    host.write_text(text)

    p=root/"AvatarPlayer.kt"
    s=p.read_text()
    # No change to the audio source or rendering SDK; audible media routes are
    # selected by the existing captureOn switch. Verify what it actually does.
    assert s.count("private val captureOn: Boolean = capturable ||") == 1
    assert s.count("AudioAttributes.USAGE_MEDIA else AudioAttributes.USAGE_VOICE_COMMUNICATION") == 1
    s=one(s,
       "        track.play()\n        started = true",
       """        track.play()
        HitelE2Trace.event("audio.route.start",
            "usage" to track.audioAttributes.usage,
            "trackState" to track.state, "playState" to track.playState,
            "routedType" to track.routedDevice?.type,
            "routedName" to track.routedDevice?.productName,
            "sampleRate" to track.sampleRate,
            "bufferFrames" to track.bufferSizeInFrames)
        started = true""",
       "log_audio_route")

    old="""                    val write = runCatching { track.write(u.audio, 0, u.audio.size) }"""
    new="""                    val write = runCatching {
                        var offset = 0
                        var zeroRetries = 0
                        while (offset < u.audio.size && running && u.epoch == epoch) {
                            val n = track.write(u.audio, offset, u.audio.size - offset,
                                AudioTrack.WRITE_BLOCKING)
                            when {
                                n > 0 -> { offset += n; zeroRetries = 0 }
                                n == 0 && zeroRetries < 4 -> {
                                    zeroRetries++
                                    // Reset / device-route transitions can yield a zero
                                    // write. Do not misreport it as successfully heard.
                                    HitelE2Trace.event("audio.track.zero_write",
                                        "seq" to u.seq, "kind" to u.kind,
                                        "epoch" to u.epoch, "attempt" to zeroRetries,
                                        "route" to track.routedDevice?.type,
                                        "state" to track.state,
                                        "playState" to track.playState,
                                        "offset" to offset)
                                    if (track.playState != AudioTrack.PLAYSTATE_PLAYING &&
                                        running && u.epoch == epoch) {
                                        synchronized(trackLock) {
                                            if (running && u.epoch == epoch &&
                                                track.playState != AudioTrack.PLAYSTATE_PLAYING)
                                                track.play()
                                        }
                                    }
                                    Thread.sleep(10)
                                }
                                else -> {
                                    HitelE2Trace.event("audio.track.write_error",
                                        "seq" to u.seq, "kind" to u.kind,
                                        "returned" to n, "offset" to offset,
                                        "expected" to u.audio.size)
                                    break
                                }
                            }
                        }
                        offset
                    }"""
    s=one(s,old,new,"retry_incomplete_writes")
    s=one(s,
       '                            "writeQueue" to toWrite.size)',
       '''                            "writeQueue" to toWrite.size,
                            "routedType" to track.routedDevice?.type,
                            "playState" to track.playState,
                            "pcmHasSignal" to u.audio.any { it != 0.toByte() })''',
       "log_written_pcm_signal_and_actual_route")
    s=one(s,
       '                    write.exceptionOrNull()?.let {',
       '''                    if (write.getOrNull() != u.audio.size) {
                        HitelE2Trace.event("audio.track.short_write",
                            "seq" to u.seq, "kind" to u.kind,
                            "expectedBytes" to u.audio.size,
                            "actualBytes" to (write.getOrNull() ?: -999),
                            "epoch" to u.epoch, "currentEpoch" to epoch,
                            "trackState" to track.state,
                            "playState" to track.playState,
                            "route" to track.routedDevice?.type)
                    }
                    write.exceptionOrNull()?.let {''',
       "short_write_never_silently_ignored")
    p.write_text(s)
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
      "issue":"AvatarPlayer (injected during GPU logging restoration) routed USAGE_VOICE_COMMUNICATION instead of previously audible vendor player USAGE_MEDIA and ignored 0-byte AudioTrack writes",
      "scope":"host Android audio playback only: one plugin argument, writer retry/logging, actual routed device trace",
      "unchanged":["original lible_jni.so bytes","WG128 lible_jni_wg128.so bytes","GPU instrumentation","Korean PCM asset","Sofia model","GPU HardwareBuffer output","JNI call structure"],
      "media_route_with_existing_flag":"capturable=true",
      "repeated_zero_write":"4 retries at 10 milliseconds; logged; no claim of confirmed audible phone playback",
      "added_events":["audio.route.start","audio.track.zero_write","audio.track.short_write","audio.track.write_error","audio.track.write"]
    },ensure_ascii=False,indent=2)+"\n")
    print("PASS_RESTORE_MEDIA_SPEAKER_AUDIO_ROUTE_AND_FAIL_LOUDLY_ON_UNWRITTEN_PCM")

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--plugin",type=Path,required=True)
    ap.add_argument("--report",type=Path,required=True)
    a=ap.parse_args();patch(a.plugin,a.report)
