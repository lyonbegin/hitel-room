#!/usr/bin/env python3
"""Instrument the TEST Activity only; do not alter any original SDK bytecode.

Called after copying the existing original-sdk smoke-test MainActivity into the
official hello example. Captures actual original SDK pull(Bitmap) output at
frame 1/2/10/20/40 and timestamps, without fabricating or touching rendering.
"""
from pathlib import Path
import sys

assert len(sys.argv) == 2
target = Path(sys.argv[1])
source = target.read_text()
anchor = '''                    if (frames == 1) {
                            FileOutputStream(File(filesDir, "official-first-frame.png")).use { output ->
                                dest.compress(Bitmap.CompressFormat.PNG, 100, output)
                            }
                            report("SDK_OFFICIAL_FIRST_FRAME_PASS")
                        }
'''
assert source.count(anchor) == 1, "original SDK test probe capture block changed"
additional = '''                    if (frames in setOf(1, 2, 10, 20, 40)) {
                            val snapshot = File(filesDir, "official-frame-$frames.png")
                            FileOutputStream(snapshot).use { output ->
                                dest.compress(Bitmap.CompressFormat.PNG, 100, output)
                            }
                            report("SDK_OFFICIAL_FRAME_SAMPLE index=$frames elapsedMs=" +
                                (SystemClock.elapsedRealtime() - started) +
                                " sizeBytes=" + snapshot.length())
                        }
'''
# Preserve the original first-frame behavior and add independent samples.
source = source.replace(anchor, anchor + additional)
target.write_text(source)
print("CI_ORIGINAL_SDK_TEST_ACTIVITY_FRAME_SAMPLING_INSTALLED frames=1,2,10,20,40")
