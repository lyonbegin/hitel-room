import unittest
import numpy as np
from verify_essence2_emulator_speaker import compare, expected_playback_16k, to_8k


class SpeakerCaptureTest(unittest.TestCase):
    def test_long_preparation_silence_does_not_hide_a_real_reply(self):
        rng = np.random.default_rng(617)
        voice = rng.normal(0, 1000, 40000)
        captured = np.r_[np.zeros(8000*180), voice*.08, np.zeros(8000)]
        result = compare(captured, voice)
        self.assertLess(result['captured_rms_8k'], 20)
        self.assertTrue(result['virtual_speaker_speech_verified'], result)

    def test_silence_and_unrelated_noise_are_rejected(self):
        rng = np.random.default_rng(411)
        voice = rng.normal(0, 1000, 40000)
        self.assertFalse(compare(np.zeros(80000), voice)['virtual_speaker_speech_verified'])
        self.assertFalse(compare(rng.normal(0, 1000, 80000), voice)['virtual_speaker_speech_verified'])

    def test_pcm16_reference_remains_audible_after_antialias_resampling(self):
        t = np.arange(32000) / 16000
        pcm = (12000 * np.sin(2*np.pi*440*t)).astype('<i2')
        result = to_8k(pcm, 16000)
        self.assertGreater(np.sqrt(np.mean(result**2)), 8000)
        np.testing.assert_allclose(result, to_8k(pcm.astype(float),16000))

    def test_reference_uses_the_actual_speaker_pcm_format(self):
        source = np.array([0,1000,2000,3000,4000,5000],dtype=float)
        np.testing.assert_array_equal(expected_playback_16k(source), [0,1500,3000,4500])


if __name__ == '__main__':
    unittest.main()

