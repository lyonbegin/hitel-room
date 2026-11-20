#!/usr/bin/env python3
"""Regression cases for false positive speech tests and production auth routing."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest

from analyze_essence2_e2trace import (
    REQUIRED_AUDIO, REQUIRED_BOOT, lipsync_failures, summarize,
)
from prepare_essence2_authenticated_baseline import prepare, tree_hashes


class SpeechAcceptanceTest(unittest.TestCase):
    def report(self, unique=19, due=20, lost=0):
        return {
            'missing_boot': [], 'missing_speech': [], 'lost_log_events': lost,
            'speech': {'last_counter_snapshot': {
                'uniqueShown': str(unique), 'due': str(due),
            }},
        }

    def test_old_success_with_three_of_sixty_frames_is_failure(self):
        self.assertIn('low_lipsync_coverage:3/60<0.9',
                      lipsync_failures(self.report(3, 60)))

    def test_idle_zero_zero_is_not_speech(self):
        self.assertEqual(2, len(lipsync_failures(self.report(0, 0))))

    def test_one_frame_does_not_prove_a_turn(self):
        self.assertTrue(lipsync_failures(self.report(1, 1)))

    def test_sufficient_coverage_passes_only_trace_gate(self):
        self.assertEqual([], lipsync_failures(self.report()))

    def test_missing_audio_stages_fail(self):
        r = self.report()
        r['missing_speech'] = ['audio.track.write']
        self.assertTrue(lipsync_failures(r))

    def test_log_loss_and_unknown_log_loss_fail(self):
        for lost in (None, 2):
            with self.subTest(lost=lost):
                self.assertTrue(lipsync_failures(self.report(lost=lost)))

    def test_inconsistent_or_malformed_counters_fail(self):
        for unique, due in ((21, 20), (-1, 20), ('NaN', 20), (1, 'inf')):
            with self.subTest(unique=unique, due=due):
                self.assertTrue(lipsync_failures(self.report(unique, due)))

    def test_missing_counters_fail(self):
        r = self.report()
        r['speech']['last_counter_snapshot'] = {}
        self.assertTrue(lipsync_failures(r))

    def test_invalid_thresholds_are_rejected(self):
        for coverage, due in ((0, 10), (1.1, 10), (float('nan'), 10), (.9, 0)):
            with self.subTest(coverage=coverage, due=due):
                with self.assertRaises(ValueError):
                    lipsync_failures(self.report(), coverage, due)

    def test_parser_keeps_counters_in_same_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'trace.log'
            path.write_text(
                'seq=1 stage=display.present lost=0 uniqueShown=3 due=60\n'
                'seq=2 stage=display.present lost=0 due=100\n', encoding='utf-8')
            result = summarize(path)
            self.assertEqual('60', result['speech']['last_counter_snapshot']['due'])
            self.assertTrue(lipsync_failures(result))

    def test_complete_trace_can_pass_but_still_needs_physical_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'trace.log'
            lines = [f'seq={i} stage={stage} lost=0'
                     for i, stage in enumerate(REQUIRED_BOOT + REQUIRED_AUDIO)]
            lines.append('stage=display.present lost=0 uniqueShown=19 due=20')
            path.write_text('\n'.join(lines), encoding='utf-8')
            self.assertEqual([], lipsync_failures(summarize(path)))


class AuthenticatedSourceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.upstream = Path(os.environ['ESSENCE2_UPSTREAM'])
        cls.plugin = Path(os.environ['ESSENCE2_PLUGIN'])

    def test_real_source_adaptation_retains_every_vendor_plugin_byte(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            app, plugin = root / 'app', root / 'plugin'
            (app / 'lib').mkdir(parents=True)
            shutil.copy2(self.upstream / 'app/avatar_chat/lib/main.dart', app / 'lib/main.dart')
            shutil.copytree(self.plugin, plugin)
            before = tree_hashes(plugin)
            output = root / 'report.json'
            prepare(app, plugin, output)
            result = json.loads(output.read_text(encoding='utf-8'))
            text = (app / 'lib/main.dart').read_text(encoding='utf-8')
            self.assertEqual(before, tree_hashes(plugin))
            self.assertTrue(result['all_plugin_files_byte_identical'])
            self.assertIn('speechReady: avatar.ready,', text)
            self.assertLess(text.index('if (isHitelDemoCredential(secret))'),
                            text.index('await BithumanAvatar.load('))
            self.assertIn('apiKey: secret,', text)
            self.assertFalse(result['lipsync_verified'])
            for needle in ('htdemo.v1.offline.', 'mock_realtime', 'debugEndpointOverride',
                           'hitel_offline_runtime'):
                self.assertNotIn(needle, text)

    def test_upstream_drift_is_rejected_instead_of_silently_patching(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'app/lib').mkdir(parents=True)
            (root / 'app/lib/main.dart').write_text('// incompatible upstream\n')
            with self.assertRaises(AssertionError):
                prepare(root / 'app', self.plugin, root / 'report.json')


if __name__ == '__main__':
    unittest.main()
