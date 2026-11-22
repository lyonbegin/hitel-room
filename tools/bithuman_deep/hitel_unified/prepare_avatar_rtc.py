"""RTC-only avatar media route in assembled external wrapper. No vendor JNI modification."""
from pathlib import Path
import argparse
p=argparse.ArgumentParser()
p.add_argument("--plugin",type=Path,required=True)
a=p.parse_args()
def r(s,old,new):
    assert s.count(old)==1, old
    return s.replace(old,new)
f=a.plugin/"android/src/main/kotlin/ai/bithuman/flutter/OfficialEssence2FileEngine.kt"
s=f.read_text()
s=r(s,"import android.graphics.Bitmap","import com.cloudwebrtc.webrtc.HitelAvatarMediaBus\nimport android.graphics.Bitmap")
s=r(s,"    @Volatile private var currentTurn = 0","    @Volatile private var currentTurn = 0\n    @Volatile private var rtcTurn = 0")
s=r(s,"            check(!closed) { \"Essence2 SDK already closed\" }","""            check(!closed) { "Essence2 SDK already closed" }
            if (!HitelAvatarMediaBus.enabled()) {
                HitelE2Trace.event("rtc.input.blocked", "reason" to "no_rtc_source")
                return
            }""")
s=r(s,"                receiving = true\n","""                receiving = true
                rtcTurn = currentTurn
                HitelAvatarMediaBus.begin(rtcTurn.toLong())
                HitelE2Trace.event("rtc.turn.begin", "turn" to rtcTurn)
""")
s=r(s,"        soundQueue.offer(Packet.Chunk(turn, copy))","        // RTC-only: no independent PCM speaker queue.")
s=r(s,"        soundQueue.offer(Packet.End(turn))","        // RTC-only: no independent speaker end packet.")
s=r(s,"            currentTurn = counter.incrementAndGet()\n            receiving = false","""            if (rtcTurn != 0) HitelAvatarMediaBus.cancel(rtcTurn.toLong())
            rtcTurn = 0
            currentTurn = counter.incrementAndGet()
            receiving = false""")
s=r(s,"        var sdkFeedCount = 0","        var sdkFeedCount = 0\n        var rtcFedSamples = 0L")
s=r(s,"                            loadedTurn = packet.turn\n","                            loadedTurn = packet.turn\n                            rtcFedSamples = 0L\n")
s=r(s,"                        val feedStart = System.nanoTime()","""                        if (rtcTurn == packet.turn) {
                            while (live(packet.turn) && HitelAvatarMediaBus.live(packet.turn.toLong()) &&
                                !HitelAvatarMediaBus.append(packet.turn.toLong(),rtcFedSamples,packet.bytes)) Thread.sleep(5)
                            if (!live(packet.turn) || !HitelAvatarMediaBus.live(packet.turn.toLong())) continue
                            rtcFedSamples += packet.bytes.size / 2
                        }
                        val feedStart = System.nanoTime()""")
s=r(s,"                        sdkEndedTurn = packet.turn\n","""                        if (rtcTurn == packet.turn) HitelAvatarMediaBus.end(packet.turn.toLong(),rtcFedSamples)
                        sdkEndedTurn = packet.turn
""")
s=r(s,"                if (presenter?.full == true) {","""                val rtc = rtcTurn == turn && HitelAvatarMediaBus.live(turn.toLong())
                if (!rtc || !HitelAvatarMediaBus.canPull(turn.toLong())) {""")
s=r(s,"                    val ordinal = if (lastSdkIndex >= 0) lastSdkIndex else shownInTurn","""                    if (rtc && lastSdkIndex < 0) {
                        hw?.close()
                        HitelAvatarMediaBus.cancel(turn.toLong())
                        Log.e(TAG,"RTC_INVALID_SDK_ORDINAL")
                        continue
                    }
                    val ordinal = if (lastSdkIndex >= 0) lastSdkIndex else shownInTurn""")
s=r(s,"                        if (presenter != null) presenter.offer(turn, ordinal, pts, wrapped, delivered)","""                        if (rtc) {
                            if (!HitelAvatarMediaBus.frame(turn.toLong(),ordinal,wrapped,Runnable { delivered.release() })) delivered.release()
                        } else delivered.release()
                        /* RTC-only: no direct texture callback. */""")
s=r(s,"                            if (presenter != null) presenter.offer(turn, ordinal, pts, pixels, null)","""                            if (rtc) {
                                if (!HitelAvatarMediaBus.frame(turn.toLong(),ordinal,pixels,Runnable { pixels.recycle() })) pixels.recycle()
                            } else pixels.recycle()
                            /* RTC-only: no direct texture callback. */""")
# Remove leftover else branches from the old direct presenter, and never start its sound worker.
s=r(s,'''                        /* RTC-only: no direct texture callback. */
                        else {
                            val callback = renderer
                            if (callback == null) delivered.release()
                            else try { callback(wrapped, delivered) }
                            catch (failure: Throwable) { delivered.release(); throw failure }
                        }''','''                        HitelE2Trace.event("rtc.frame.offer", "turn" to turn, "ordinal" to ordinal, "gpu" to true)''')
s=r(s,'''                            /* RTC-only: no direct texture callback. */
                            else renderer?.invoke(pixels, null) ?: pixels.recycle()''','''                            HitelE2Trace.event("rtc.frame.offer", "turn" to turn, "ordinal" to ordinal, "gpu" to false)''')
s=r(s,"        soundWorker.execute { runSound() }","        // RTC-only: no AudioTrack worker is started.")
s=r(s,"        if (first) presenter?.begin(turn)","        // RTC-only: no local presenter starts.")
assert "soundWorker.execute { runSound() }" not in s
assert "soundQueue.offer(Packet.Chunk(turn, copy))" not in s
assert "presenter.offer(turn, ordinal, pts" not in s
assert "renderer?.invoke(pixels, null)" not in s
f.write_text(s)
g=a.plugin/"android/build.gradle"
s=g.read_text()
s += "\n// HITEL wrapper: share the exact Flutter WebRTC engine, no second libwebrtc.\ndependencies { implementation project(':flutter_webrtc') }\n"
g.write_text(s)
print("PASS_HITEL_RTC_ONLY_NO_DIRECT_AUDIO_OR_VIDEO")
