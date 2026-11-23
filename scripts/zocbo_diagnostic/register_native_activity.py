#!/usr/bin/env python3
"""Register native original-DEX PDF viewer entry Activity in decoded AndroidManifest.

Minimal insertion, preserve all original manifest nodes. No exported intents.
"""
from pathlib import Path
import sys,re
manifest=Path(sys.argv[1])
raw=manifest.read_text(encoding="utf-8")
name="com.hitel.zocbodiag.NativePdfEntryActivity"
if name in raw:
    raise SystemExit("ABORT native entry Activity already registered")
if "xmlns:android=" not in raw:
    raise SystemExit("ABORT missing standard Android XML namespace")
if raw.count("</application>") != 1:
    raise SystemExit("ABORT unexpected application close count")
entry='''        <activity
            android:name="com.hitel.zocbodiag.NativePdfEntryActivity"
            android:exported="false"
            android:label="원본 PDF"
            android:theme="@android:style/Theme.Material.Light.NoActionBar" />
'''
changed=raw.replace("</application>",entry+"    </application>",1)
manifest.write_text(changed,encoding="utf-8")
assert changed.count(name)==1
print("ORIGINAL_NATIVE_PDF_ENTRY_MANIFEST_REGISTERED",name,flush=True)
print("ORIGINAL_VIEWER_NOT_REPLACED",("com.eduzone.eduzoneviewer.ui.activities.ViewerActivity" in changed),flush=True)
