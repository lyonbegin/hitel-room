#!/usr/bin/env python3
"""Install pinned DH_live mini 2.0 runtime and PUBLIC demo avatar.

Binary assets are not checked into HITEL. Every file is SHA-1 Git-blob verified.
This is an experimental developer build, not a commercial redistribution grant.
"""
import hashlib
import pathlib
import sys
import tempfile
import urllib.request

COMMIT = "4467e97cd97194c2c54762043cf121c6d313db12"
BASE = f"https://raw.githubusercontent.com/kleinlee/DH_live/{COMMIT}/web_demo/static/"
FILES = {
    "vendor/js/MiniMateLoader.js": ("js/MiniMateLoader.js", "4a34e4a176ac58a364279cad8bedaf80928daf34"),
    "vendor/js/MiniLive2.js": ("js/MiniLive2.js", "28cddecbf9eb14f709e73da88ae3e566288ef68b"),
    "vendor/js/DHLiveMini.js": ("js/DHLiveMini.js", "8c824a3d0187aec4b4480b3c97fc1d0d1d01d8ce"),
    "vendor/js/pako.min.js": ("js/pako.min.js", "05a54a215321c86bb86d33a2a83de4bacefffa6b"),
    "vendor/js/DHLiveMini.wasm": ("DHLiveMini.wasm", "745fb2f4a85f5c398e1d0d40eea35103349c86b6"),
    "common/bs_texture_halfFace.png": ("common/bs_texture_halfFace.png", "f28a247372d66d4ffc6e7e48aadd7c469d4665f7"),
    "common/test.wav": ("common/test.wav", "c5003c395c4d2c2a77ea90e0cd34d71b4041d70f"),
    "assets/01.mp4": ("assets/01.mp4", "2a458ad01ffbf255e11022369c54075ecf748634"),
    "assets/combined_data.json.gz": ("assets/combined_data.json.gz", "26efd6037aca59eb01d8c03d8bbca5662f37b5f7"),
}
DEST = pathlib.Path(__file__).resolve().parents[1] / "app/src/main/assets"

def git_blob_sha1(payload: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()

def install_one(target: str, upstream: str, blob: str) -> None:
    output = DEST / target
    if output.exists() and git_blob_sha1(output.read_bytes()) == blob:
        print(f"  OK {target} (cached)")
        return
    print(f"  Fetch {target} at {COMMIT[:12]}")
    request = urllib.request.Request(BASE + upstream, headers={"User-Agent": "HITEL-S2-Android-Dev"})
    with urllib.request.urlopen(request, timeout=35) as response:
        payload = response.read(12 * 1024 * 1024 + 1)
    if len(payload) > 12 * 1024 * 1024:
        raise RuntimeError(f"Unexpectedly large upstream resource: {target}")
    actual = git_blob_sha1(payload)
    if actual != blob:
        raise RuntimeError(f"Git blob mismatch for {target}: expected {blob}, got {actual}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=output.parent, delete=False) as tmp:
        tmp.write(payload)
        tmp_path = pathlib.Path(tmp.name)
    tmp_path.replace(output)
    print(f"  Verified {target} ({len(payload)} bytes)")

if __name__ == "__main__":
    try:
        print("DH_live mini pinned commit:", COMMIT)
        for dst, (source, blob) in FILES.items():
            install_one(dst, source, blob)
        print("Done. Runtime and demo are packaged into the APK.")
    except Exception as e:
        print(f"DH_live assets installation failed: {e}", file=sys.stderr)
        sys.exit(1)
