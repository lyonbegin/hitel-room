"""Opt-in avatar media route in assembled external wrapper. No vendor JNI modification."""
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
s=r(s,"                receiving = true\n","""                receiving = true
                rtcTurn = if (HitelAvatarMediaBus.enabled()) currentTurn else 0
                if (rtcTurn != 0) HitelAvatarMediaBus.begin(rtcTurn.toLong())
""")
s=r(s,"        soundQueue.offer(Packet.Chunk(turn, copy))","        if (rtcTurn != turn) soundQueue.offer(Packet.Chunk(turn, copy))")
s=r(s,"        soundQueue.offer(Packet.End(turn))","        if (rtcTurn != turn) soundQueue.offer(Packet.End(turn))")
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
s=r(s,"                if (presenter?.full == true) {","""                val rtc = rtcTurn == turn
                if ((rtc && !HitelAvatarMediaBus.canPull(turn.toLong())) || (!rtc && presenter?.full == true)) {""")
s=r(s,"                    val ordinal = if (lastSdkIndex >= 0) lastSdkIndex else shownInTurn","""                    if (rtc && lastSdkIndex < 0) {
                        hw?.close()
                        HitelAvatarMediaBus.cancel(turn.toLong())
                        Log.e(TAG,"RTC_INVALID_SDK_ORDINAL")
                        continue
                    }
                    val ordinal = if (lastSdkIndex >= 0) lastSdkIndex else shownInTurn""")
s=r(s,"                        if (presenter != null) presenter.offer(turn, ordinal, pts, wrapped, delivered)","""                        if (rtc) {
                            if (!HitelAvatarMediaBus.frame(turn.toLong(),ordinal,wrapped,Runnable { delivered.release() })) delivered.release()
                        } else if (presenter != null) presenter.offer(turn, ordinal, pts, wrapped, delivered)""")
s=r(s,"                            if (presenter != null) presenter.offer(turn, ordinal, pts, pixels, null)","""                            if (rtc) {
                                if (!HitelAvatarMediaBus.frame(turn.toLong(),ordinal,pixels,Runnable { pixels.recycle() })) pixels.recycle()
                            } else if (presenter != null) presenter.offer(turn, ordinal, pts, pixels, null)""")
f.write_text(s)
g=a.plugin/"android/build.gradle"
s=g.read_text()
s += "\n// HITEL wrapper: share the exact Flutter WebRTC engine, no second libwebrtc.\ndependencies { implementation project(':flutter_webrtc') }\n"
g.write_text(s)
print("PASS_HITEL_OPT_IN_NATIVE_AVATAR_PAIRED_RTC_ROUTE_PATCHED")
