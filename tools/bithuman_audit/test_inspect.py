"""Local smoke tests: no vendor binaries or network needed."""
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from inspect import audit, render_markdown


class InspectorTests(unittest.TestCase):
    def test_missing_binaries_are_explicit(self):
        result = audit(None, None, None)
        self.assertEqual(result["imx"]["status"], "NOT_DOWNLOADED")
        self.assertEqual(result["aar"]["status"], "NOT_DOWNLOADED")
        self.assertIn("NOT_DOWNLOADED", render_markdown(result))

    def test_mock_zip_inventory(self):
        with tempfile.TemporaryDirectory() as work:
            root = Path(work)
            imx = root / "public-sample.imx"
            aar = root / "sdk.aar"
            pom = root / "sdk.pom"
            with zipfile.ZipFile(imx, "w") as z:
                z.writestr("manifest.json", '{"family":"expression-2"}')
                z.writestr("model/data.bin", b"sample")
            with zipfile.ZipFile(aar, "w") as z:
                z.writestr("AndroidManifest.xml", '<manifest package="test"/>')
                z.writestr("jni/arm64-v8a/libdemo.so", b"not real ELF")
            pom.write_text(
                '<project><dependencies><dependency>'
                '<groupId>com.example</groupId><artifactId>runtime</artifactId>'
                '<version>1.0</version></dependency></dependencies></project>',
                encoding="utf-8",
            )
            result = audit(imx, aar, pom)
            self.assertEqual(result["imx"]["zip"]["entries"], 2)
            self.assertIn("jni/arm64-v8a/libdemo.so", result["aar"]["zip"]["native_libraries"])
            self.assertEqual(result["pom"]["dependencies"][0]["artifactId"], "runtime")
            self.assertEqual(result["aar"]["android"]["native_libraries"]
                             ["jni/arm64-v8a/libdemo.so"]["exported_symbols"], 0)


if __name__ == "__main__":
    unittest.main()
