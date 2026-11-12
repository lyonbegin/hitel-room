#!/usr/bin/env python3
"""Offline smoke tests for the model/SDK inventory."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

spec=importlib.util.spec_from_file_location("bithuman_deep_audit",Path(__file__).with_name("audit_models.py"))
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class AuditTests(unittest.TestCase):
    def test_missing_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(audit.inspect_imx(Path(tmp)/"missing.imx",None)["state"],"MISSING")
            self.assertEqual(audit.inspect_aar(Path(tmp)/"missing.aar")["state"],"MISSING")

    def test_nonzip_imx_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"test.imx"
            path.write_bytes(b"IMX\x00\x02\x00" + b"test" * 30)
            result=audit.inspect_imx(path,None)
            self.assertEqual(result["state"],"FOUND")
            self.assertEqual(result["magic_hex"][:8],"494d5800")
            self.assertFalse(result["is_zip"])
            self.assertEqual(result["official_cli_exit"],"CLI_MISSING")

    def test_aar_java_and_native_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"demo.aar"
            with zipfile.ZipFile(path,"w") as z:
                z.writestr("AndroidManifest.xml","<manifest/>")
                with tempfile.TemporaryDirectory() as another:
                    inner=Path(another)/"classes.jar"
                    with zipfile.ZipFile(inner,"w") as j:
                        j.writestr("ai/bithuman/essence2/Essence2Avatar.class",b"not-class")
                    z.write(inner,"classes.jar")
                z.writestr("jni/arm64-v8a/libdemo.so",b"not-elf")
            result=audit.inspect_aar(path)
            self.assertEqual(result["state"],"FOUND")
            self.assertIn("ai.bithuman.essence2.Essence2Avatar",result["java_classes"])
            self.assertIn("jni/arm64-v8a/libdemo.so",result["native_libraries"])

if __name__ == "__main__":
    unittest.main()
