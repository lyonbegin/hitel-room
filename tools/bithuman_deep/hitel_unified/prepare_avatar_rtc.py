"""Install the receiver-only wrapper into the pinned Android plugin."""
import argparse
from pathlib import Path
from shutil import copyfile

parser = argparse.ArgumentParser()
parser.add_argument("--plugin", type=Path, required=True)
plugin = parser.parse_args().plugin
folder = plugin / "android/src/main/kotlin/ai/bithuman/flutter"
copyfile(Path(__file__).parent / "android/OfficialEssence2FileEngine.kt", folder / "OfficialEssence2FileEngine.kt")
(folder / "HitelVoiceSync.kt").unlink()
f = folder / "BithumanPlugin.kt"
s = f.read_text()
a = s.index("                if (avatar is OfficialEssence2FileEngine) {")
b = s.index("                val p: AvatarPlayer?", a)
s = s[:a] + s[b:]
a = s.index("        val sync = ", s.index("private fun loadEssence2("))
b = s.index("        if (hit != null)", a)
s = s[:a] + '        val e = OfficialEssence2FileEngine(avatar)\n' + s[b:]
old = 'if (debuggable && AvatarPlayer.devInt("debug.bh.e2.height") == 720) 720 else 0'
assert s.count(old) == 1
s = s.replace(old, 'if (debuggable && AvatarPlayer.devInt("debug.bh.e2.height") == 1920) 0 else 720')
old = '            "pushAudio" -> {'
assert s.count(old) == 1
s = s.replace(old, '''            "hitelPlayRtcPcm" -> {
                val engine = session(call)?.avatar as? OfficialEssence2FileEngine
                if (engine == null) return result.error("no_session", "RTC avatar unavailable", null)
                engine.playPcm { context.assets.open("hitel_voice.pcm") }
                result.success(null)
            }
''' + old)
for line in ('    private var fileAudio: HitelFileAudioSource? = null',
             '        fileAudio = HitelFileAudioSource(binding)',
             '        fileAudio?.close(); fileAudio = null'):
    assert s.count(line) == 1
    s = s.replace(line + '\n', '')
(folder / 'HitelFileAudioSource.kt').unlink()
(plugin / 'android/src/main/java/ai/bithuman/flutter/FilePcmStream.java').unlink()
f.write_text(s)
g = plugin / "android/build.gradle"
g.write_text(g.read_text() + "\ndependencies { implementation project(':flutter_webrtc') }\n")
print("PASS_HITEL_RTC_ONLY_NO_DIRECT_AUDIO_OR_VIDEO")
