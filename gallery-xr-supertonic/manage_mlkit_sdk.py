#!/usr/bin/env python3
"""Stage pinned ML Kit artifacts into a managed local Maven repository.

No runtime changes: retain the original Google SDK, POM dependencies, and external
Speech Services. An explicitly supplied local repository may replace the upstream
artifact source only when its AAR matches the checked-in lock.
"""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET

LOCK = {
    "genai-speech-recognition": ("1.0.0-alpha2", "a7bef8c8eef655240f4d2cd10bfe5b583c22ec0f384b634691e634fa5d6063f6"),
    "genai-common": ("1.0.0-beta5", "cefcd33b43fb3078f7d10da169316ae146c0a67b28aa6bf5008f10571d646a4c"),
}
BASE = "https://dl.google.com/dl/android/maven2/"
root = Path(sys.argv[1]).resolve() / "Android/src"
repository = root / "hitel-mlkit-sdk/repository"
source = os.getenv("HITEL_MLKIT_SDK_INPUT_REPO")
for name, (version, expected) in LOCK.items():
    rel = Path("com/google/mlkit") / name / version
    dest = repository / rel
    dest.mkdir(parents=True, exist_ok=True)
    for ext in ("aar", "pom"):
        fn = f"{name}-{version}.{ext}"
        target = dest / fn
        if source:
            shutil.copyfile(Path(source) / rel / fn, target)
        else:
            subprocess.run(["curl", "-fL", "--retry", "3", BASE + (rel / fn).as_posix(), "-o", str(target)], check=True)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()
        if ext == "aar":
            if digest != expected:
                raise ValueError(f"SDK hash mismatch: {name}: {digest}")
            with zipfile.ZipFile(target) as archive:
                assert archive.testzip() is None and "classes.jar" in archive.namelist()
        else:
            pom = ET.parse(target).getroot()
            ns = {"m": "http://maven.apache.org/POM/4.0.0"}
            for key, value in (("groupId", "com.google.mlkit"), ("artifactId", name), ("version", version)):
                assert pom.findtext("m:" + key, namespaces=ns) == value, f"Unexpected POM {key}: {name}"
        print(f"MANAGED_SDK {digest} {target.relative_to(root)}", flush=True)

settings = root / "settings.gradle.kts"
text = settings.read_text()
anchor = "  repositories {\n    //        mavenLocal()\n"
if text.count(anchor) != 1:
    raise ValueError("Unexpected upstream repository layout")
block = """    exclusiveContent {
      forRepository {
        maven {
          name = "HitelManagedMlKit"
          url = uri("hitel-mlkit-sdk/repository")
          metadataSources {
            mavenPom()
            ignoreGradleMetadataRedirection()
          }
        }
      }
      filter {
        includeModule("com.google.mlkit", "genai-speech-recognition")
        includeModule("com.google.mlkit", "genai-common")
      }
    }
"""
settings.write_text(text.replace(anchor, anchor + block, 1))
print("MANAGED_MLKIT_REPOSITORY_EXCLUSIVE")
