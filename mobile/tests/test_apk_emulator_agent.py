"""Unit tests of the same Play Store / package verification ADB code used on a real host."""
import importlib.util
from pathlib import Path
import re
from types import SimpleNamespace
import unittest

AGENT = Path(__file__).resolve().parents[1] / "tools" / "apk-emulator-agent.py"
spec = importlib.util.spec_from_file_location("hitel_apk_agent", AGENT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GooglePlayHostTests(unittest.TestCase):
    def setUp(self):
        self.recorded = []
        self.original = module.adb

        def fake_adb(serial, *argv, timeout=0):
            self.recorded.append((serial, list(argv)))
            if list(argv[:4]) == ["shell", "pm", "path", "com.android.vending"]:
                return SimpleNamespace(returncode=0, stdout="package:/data/app/com.android.vending/base.apk")
            if list(argv[:4]) == ["shell", "pm", "path", "com.kakao.taxi"]:
                return SimpleNamespace(returncode=0, stdout="package:/data/app/com.kakao.taxi/base.apk")
            if list(argv[:3]) == ["shell", "am", "start"]:
                return SimpleNamespace(returncode=0, stdout="Starting: Intent { act=android.intent.action.VIEW ... }")
            return SimpleNamespace(returncode=0, stdout="Success")
        module.adb = fake_adb

    def tearDown(self):
        module.adb = self.original

    def test_open_official_kakao_store_with_actual_package_name(self):
        name, status = module.play_store_job("emulator-5554", {
            "operation": "store", "packageName": "com.kakao.taxi"
        })
        self.assertEqual(name, "com.kakao.taxi")
        self.assertIn("user must approve", status)
        args = self.recorded[-1][1]
        self.assertIn("market://details?id=com.kakao.taxi", args)
        self.assertIn("com.android.vending", args)

    def test_verify_true_installation_is_a_separate_action(self):
        name, status = module.play_store_job("emulator-5554", {
            "operation": "verify", "packageName": "com.kakao.taxi"
        })
        self.assertEqual(name, "com.kakao.taxi")
        self.assertIn("Verified", status)
        self.assertEqual(self.recorded[-1][1],
                         ["shell", "pm", "path", "com.kakao.taxi"])

    def test_reject_injected_package_names(self):
        for name in ("", "com.kakao.taxi;id", "com..taxi", "com.kakao.taxi/../../x", "-a"):
            with self.subTest(name=name):
                with self.assertRaisesRegex(RuntimeError, "INVALID_PACKAGE_NAME"):
                    module.play_store_job("emulator-5554", {
                        "operation": "store", "packageName": name
                    })


if __name__ == "__main__":
    unittest.main()
