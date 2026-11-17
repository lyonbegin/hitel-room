#!/usr/bin/env python3
"""Offline, credential-free tests of Samsung RTL reservation and Linux RDB unpack."""
from __future__ import annotations

import importlib.util
import io
import os
import struct
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent


def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/(name+".py"))
    mod=importlib.util.module_from_spec(spec)
    sys.modules[name]=mod
    spec.loader.exec_module(mod)
    return mod


def fake_elf(machine=62):
    content=bytearray(10000)
    content[0:4]=b"\x7fELF"
    content[4]=2
    content[18:20]=struct.pack("<H",machine)
    return bytes(content)


class LinuxRdbDistributionTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)
        self.dls=self.root/"Downloads"
        self.dls.mkdir()
        self.probe=load("rtl_galaxy_rdb_probe")

    def archive(self,files):
        with zipfile.ZipFile(self.dls/"rdb.zip","w") as z:
            for name,body in files.items():
                z.writestr(name,body)

    def test_preserves_sibling_libraries(self):
        self.archive({"rdb":fake_elf(),"lib/libhelper.so":b"library"})
        exe=self.probe.detect_rdb(self.dls,self.root/"rdb")
        self.assertIsNotNone(exe)
        self.assertTrue(exe.exists())
        self.assertEqual((exe.parent/"lib"/"libhelper.so").read_bytes(),b"library")
        self.assertTrue(exe.stat().st_mode & 0o100)

    def test_rejects_wrong_architecture(self):
        self.archive({"rdb":fake_elf(183)})
        self.assertIsNone(self.probe.detect_rdb(self.dls,self.root/"rdb"))

    def test_rejects_path_traversal(self):
        self.archive({"rdb":fake_elf(),"../escape":b"x"})
        self.assertIsNone(self.probe.detect_rdb(self.dls,self.root/"rdb"))
        self.assertFalse((self.root/"escape").exists())


class GalaxyReservationSelectorTest(unittest.TestCase):
    def test_reservation_region_duration_start(self):
        from playwright.sync_api import sync_playwright
        auto=load("rtl_galaxy_browser_automation")
        with sync_playwright() as p:
            b=p.chromium.connect_over_cdp("http://127.0.0.1:9222",timeout=20000)
            page=b.contexts[0].new_page()
            try:
                page.set_content("""
                <html><body>
                <h1>Galaxy Z Fold8</h1>
                <section role="dialog" aria-label="Reserve Galaxy Fold">
                  <button>Seoul</button>
                  <button>30 minutes</button>
                  <button>Start</button>
                </section>
                </body></html>
                """)
                auto.visible_pages=lambda _:[page]
                stage={"fold_selected":True}
                self.assertTrue(auto.booking_phase(b,stage))
                self.assertTrue(stage.get("region_selected"))
                self.assertTrue(auto.booking_phase(b,stage))
                self.assertTrue(stage.get("duration_selected"))
                self.assertTrue(auto.booking_phase(b,stage))
                self.assertTrue(stage.get("reserve_requested"))
                print("RTL_OFFLINE_RESERVATION_SELECTORS_PASS",flush=True)
            finally:
                page.close()


if __name__=="__main__":
    unittest.main(verbosity=2)
