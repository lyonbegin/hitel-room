#!/usr/bin/env python3
"""Offline IMX v2 parser / boundary / member extraction / hashes tests."""
import hashlib
import importlib.util
import json
import struct
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("bithuman_imx_v2", Path(__file__).with_name("imx_v2.py"))
imx = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imx)


def build_imx(path, records):
    # Encoder exists solely for synthetic test fixtures, not production IMX generation.
    size_header = 8 + sum(18 + len(name.encode("utf-8")) for name, data in records)
    offset = size_header
    result = bytearray(b"IMX\x00")
    result += struct.pack("<HH", 2, len(records))
    for name, data in records:
        raw = name.encode("utf-8")
        result += struct.pack("<H", len(raw)) + raw + struct.pack("<QQ", offset, len(data))
        offset += len(data)
    for name, data in records:
        result += data
    path.write_bytes(bytes(result))


class IMXTests(unittest.TestCase):
    def test_synthetic_table_and_extract(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "test.imx"
            image = b"\x00\x01\x02" * 13
            manifest = {
                "files": {
                    "image": {
                        "path": "payload/canon.bin",
                        "sha256": hashlib.sha256(image).hexdigest(),
                    }
                }
            }
            build_imx(path, [
                ("manifest.json", json.dumps(manifest).encode()),
                ("payload/canon.bin", image),
            ])
            listing = imx.parse(path)
            self.assertEqual(listing["version"], 2)
            self.assertEqual(listing["member_count"], 2)
            self.assertEqual(listing["index_gaps"], 0)
            self.assertEqual(listing["trailing_bytes"], 0)
            self.assertEqual(listing["table_bytes"] + listing["payload_bytes"], path.stat().st_size)
            self.assertEqual(imx.verify_member_hashes(path, listing)["ok"], 1)
            out = imx.extract(path, listing, "payload/canon.bin", Path(d) / "out")
            self.assertEqual(out.read_bytes(), image)
            with self.assertRaises(FileExistsError):
                imx.extract(path, listing, "payload/canon.bin", Path(d) / "out")

    def test_bad_magic(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "x.imx"
            path.write_bytes(b"ZIP\x00\x02\x00\x00\x00")
            with self.assertRaises(imx.IMXFormatError):
                imx.parse(path)

    def test_bad_overlapping_offset(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "x.imx"
            build_imx(path, [("one", b"a"), ("two", b"b")])
            contents = bytearray(path.read_bytes())
            # Offset of first member: 8 + 2 nameLength + 3 nameBytes
            struct.pack_into("<Q", contents, 13, 0)
            path.write_bytes(contents)
            with self.assertRaises(imx.IMXFormatError):
                imx.parse(path)

    def test_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "x.imx"
            build_imx(path, [("../escape", b"bad")])
            with self.assertRaises(imx.IMXFormatError):
                imx.parse(path)


if __name__ == "__main__":
    unittest.main()
