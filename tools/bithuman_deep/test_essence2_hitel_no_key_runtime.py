#!/usr/bin/env python3
"""Exercise the actual former HITEL source pipeline, not a fake app fixture."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from prepare_essence2_five_samples_original_sdk import patch_app
from prepare_essence2_hitel_no_key_runtime import prepare


class ExistingHitelSessionTest(unittest.TestCase):
    def test_existing_session_is_retained_without_vendor_key_entry(self):
        upstream = Path(os.environ['ESSENCE2_UPSTREAM'])
        archive = Path(os.environ['ESSENCE2_PLUGIN'])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            app, plugin = root/'app', root/'plugin'
            for relative in ('lib/main.dart', 'pubspec.yaml',
                             'android/app/src/main/AndroidManifest.xml'):
                destination = app/relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(upstream/'app/avatar_chat'/relative, destination)
            shutil.copytree(archive, plugin)
            patch_app(app, plugin, root/'samples.json')
            script = Path(__file__).with_name('prepare_essence2_local_debug_loopback.py')
            subprocess.run([sys.executable, str(script), '--app', str(app),
                            '--plugin', str(plugin), '--archive', str(archive),
                            '--report', str(root/'local.json')], check=True)
            runtime_before = (app/'lib/hitel_offline_runtime.dart').read_bytes()
            prepare(app, root/'no-key.json')
            text = (app/'lib/main.dart').read_text(encoding='utf-8')
            result = json.loads((root/'no-key.json').read_text(encoding='utf-8'))
            self.assertFalse(result['vendor_api_secret_input_required'])
            self.assertEqual(runtime_before, (app/'lib/hitel_offline_runtime.dart').read_bytes())
            self.assertIn('final secret = await _hitelAcquireLocalSampleSession();', text)
            self.assertNotIn('final secret = await _resolveSecret();', text)
            self.assertNotIn('isHitelDemoCredential', text)
            self.assertIn('needsKey: false, controller: _keyInput,', text)
            method = text.split('Future<void> _openSession(', 1)[1]
            self.assertLess(method.index('await avatar.ready;'),
                            method.index('BithumanRealtimeSession('))

    def test_wrong_official_credential_build_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            app = Path(folder)
            (app/'lib').mkdir()
            (app/'lib/main.dart').write_text('final secret = await _resolveSecret();')
            (app/'lib/hitel_offline_runtime.dart').write_text('')
            with self.assertRaises(AssertionError):
                prepare(app, app/'report.json')


if __name__ == '__main__':
    unittest.main()
