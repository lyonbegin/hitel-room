#!/usr/bin/env python3
"""Insert non-bypassing ARM64 SDK library-load diagnostics in the public Android hello app."""
from pathlib import Path
import sys

def patch(path):
    p=Path(path)
    source=p.read_text(encoding="utf-8")
    anchor="        super.onCreate(savedInstanceState)"
    assert source.count(anchor)==1, "Unexpected vendor MainActivity.kt layout"
    payload=r"""
        // Development-only ABI probe. No network, credentials or renderer invocation.
        Log.i("BITHUMAN_ARM_BRIDGE", "PROBE_BEGIN sdk=expression2")
        for (name in listOf("LiteRt", "expr2jni")) {
            try {
                System.loadLibrary(name)
                Log.i("BITHUMAN_ARM_BRIDGE", "LOAD_OK:" + name)
            } catch (error: Throwable) {
                Log.e(
                    "BITHUMAN_ARM_BRIDGE",
                    "LOAD_FAIL:" + name + ":" + error.javaClass.simpleName + ":" + error.message
                )
            }
        }
        Log.i("BITHUMAN_ARM_BRIDGE", "PROBE_END")
"""
    source=source.replace(anchor,anchor+"\n"+payload)
    p.write_text(source,encoding="utf-8")
    print("INJECTED_PUBLIC_NATIVE_LOAD_PROBE",p)

if __name__=="__main__":
    if len(sys.argv)!=2: raise SystemExit("Usage: python3 patch_arm_probe.py MainActivity.kt")
    patch(sys.argv[1])
