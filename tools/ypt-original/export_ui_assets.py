#!/usr/bin/env python3
"""Extract UI-relevant files from the *hash-verified* original YPT base APK.
Read only. Fonts are inventoried but never included in redistributed assets.
"""
import json, zipfile, pathlib, hashlib, re, collections
base=pathlib.Path("source/unpacked/com.pallo.passiontimerscoped.apk")
out=pathlib.Path("report-assets")
out.mkdir(exist_ok=True)
manifest=[]
cnt=collections.Counter()
with zipfile.ZipFile(base) as z:
    for info in z.infolist():
        n=info.filename
        if n.startswith("assets/flutter_assets/assets/") and n.endswith((".png",".jpg",".jpeg",".webp",".svg",".json",".avif")):
            if info.file_size>5000000:continue
            p=out/n
            p.parent.mkdir(exist_ok=True,parents=True)
            raw=z.read(n);p.write_bytes(raw)
            manifest.append({"path":n,"bytes":len(raw),"sha256":hashlib.sha256(raw).hexdigest()})
            cnt["flutter_assets"]+=1
        elif n in ("assets/flutter_assets/AssetManifest.json","assets/flutter_assets/FontManifest.json","assets/flutter_assets/AssetManifest.bin.json"):
            p=out/n;p.parent.mkdir(exist_ok=True,parents=True);p.write_bytes(z.read(n));cnt["manifest"]+=1
        elif n.startswith("assets/flutter_assets/fonts/") and (n.endswith(".otf") or n.endswith(".ttf")):
            manifest.append({"path":n,"bytes":info.file_size,"FONT_NOT_EXPORTED":True});cnt["fonts_inventory"]+=1
        elif n.startswith("res/drawable") and re.search(r'(calendar|rank|study|timer|planner|todo|group|home|subject|medal|avatar|profile|clock|check|list)',n,re.I) and n.endswith((".png",".webp",".xml",".svg")):
            p=out/n;p.parent.mkdir(exist_ok=True,parents=True);raw=z.read(n);p.write_bytes(raw);manifest.append({"path":n,"bytes":len(raw)});cnt["android_relevant"]+=1
(out/"MANIFEST.json").write_text(json.dumps({"count":dict(cnt),"files":manifest},ensure_ascii=False,indent=2))
print(dict(cnt))
