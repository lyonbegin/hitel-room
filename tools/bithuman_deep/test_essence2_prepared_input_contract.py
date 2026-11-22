#!/usr/bin/env python3
"""Source-level contract checks only; not an Android playback verification."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent


class PreparedInputContract(unittest.TestCase):
    def test_input_is_sent_before_done_without_wall_clock_pacing(self):
        text = (ROOT / "prepare_essence2_spoken_voice_mock.py").read_text()
        begin = text.index("  Future<void> _sendVoicedOriginalSdkTestReply")
        end = text.index("  Future<void> _handleClient", begin)
        reply = text[begin:end]
        self.assertLess(reply.index("conn.sendAudioDelta("), reply.index("conn.sendResponseDone()"))
        self.assertIn("input.sent bytes=", reply)
        self.assertNotIn("Future<void>.delayed(const Duration(milliseconds: 100))", reply)
        self.assertIn("bytesPer100ms=24000 * 2 ~/ 10", reply)

    def test_sdk_ready_signal_not_silence_delay_starts_playback(self):
        render = (ROOT / "essence2_local_android" / "Essence2VendorRender.kt").read_text()
        self.assertLess(render.index("avatar.feed(pcm)"), render.index("avatar.endOfAudio()"))
        self.assertLess(render.index("avatar.endOfAudio()"), render.index("while (active())"))
        self.assertIn("count >= expected && available == 0", render)
        self.assertIn('sdk.render.ready', render)
        self.assertIn('sdk.render.stalled', render)
        self.assertNotIn("quietMs", render)
        self.assertLess(render.index('sdk.render.ready'), render.index("avatar.checkRender()"))
        player = (ROOT / "essence2_local_android" / "Essence2SpeechPlayer.kt").read_text()
        self.assertIn("if (item.end && bytes.size() > 0)", player)
        self.assertLess(player.index("renderPrepared(pcm"), player.index("play(pcm, frames,"))
        self.assertIn("player.play()", player)


if __name__ == "__main__":
    unittest.main()
