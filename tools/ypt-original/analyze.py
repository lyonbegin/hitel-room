#!/usr/bin/env python3
"""Read-only original YPT XAPK structural inventory; no inferred app screens."""
import json, pathlib, re, subprocess, sys, zipfile, collections, xml.etree.ElementTree as ET

root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
xapk=root/"ypt.xapk"
with zipfile.ZipFile(xapk) as z:
    package=[dict(name=i.filename,bytes=i.file_size) for i in z.infolist() if i.filename.lower().endswith(".apk")]
    other=[dict(name=i.filename,bytes=i.file_size) for i in z.infolist() if not i.filename.lower().endswith(".apk")]
(out/"xapk-manifest.json").write_text(json.dumps({"apk_splits":package,"other":other},ensure_ascii=False,indent=2))
files=sorted(root.glob("**/*.apk")); records=[]
for apk in files:
    with zipfile.ZipFile(apk) as z:
        items=z.infolist()
        important=[dict(name=i.filename,size=i.file_size) for i in items
            if i.filename.startswith(("assets/","res/")) and (
            i.filename.endswith((".xml",".json",".js",".bundle",".hbc",".db",".sqlite",".proto",".pb",".html",".ttf",".otf")) or "navigation" in i.filename)]
        framework=[i.filename for i in items if any(k in i.filename.lower() for k in (
           "index.android.bundle","hermes","flutter","reactnative","react_native","expo","kotlin","compose","libapp.so","libflutter.so","libreact","unbundle"))]
        records.append({"apk":apk.name,"file_count":len(items),"dex":sum(i.filename.endswith(".dex") for i in items),
                        "framework_clues":framework[:250],"key_files":important[:2000]})
(out/"apk-index.json").write_text(json.dumps(records,ensure_ascii=False,indent=2))
assets=[]
for p in root.rglob("*"):
    if p.is_file() and len(p.parts)<35 and p.suffix.lower() in {".json",".js",".bundle",".hbc",".db",".sqlite",".html"}:
        assets.append({"path":str(p.relative_to(root)),"bytes":p.stat().st_size})
(out/"extracted-asset-index.json").write_text(json.dumps(assets[:3000],ensure_ascii=False,indent=2))
decoded=root/"decoded"
mapping={"layout":[],"menu":[],"navigation":[],"xml":[],"values":[],"drawable":[],"mipmap":[]}
if decoded.exists():
    for p in sorted((decoded/"res").rglob("*")):
        if not p.is_file():continue
        rel=str(p.relative_to(decoded))
        for k in mapping:
            if rel.startswith("res/"+k):
                mapping[k].append(rel)
                break
    (out/"decoded-res-index.json").write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
    for category in ("menu","navigation"):
        for p in (decoded/"res").rglob("*.xml"):
            if p.parent.name.startswith(category):
                target=out/"xml"/p.parent.name;target.mkdir(parents=True,exist_ok=True)
                (target/p.name).write_bytes(p.read_bytes())
    texts=[]
    for p in sorted((decoded/"res").rglob("strings.xml")):
        try:
            tree=ET.parse(p)
            for x in tree.getroot():
                if x.tag=="string":
                    texts.append({"lang":p.parent.name,"id":x.attrib.get("name"),"value":"".join(x.itertext())[:350]})
        except Exception:continue
    (out/"resource-strings.json").write_text(json.dumps(texts,ensure_ascii=False,indent=2))
    for p in sorted((decoded/"res").rglob("*.xml")):
        if p.parent.name.startswith(("navigation","menu","layout")):
            target=out/"xml"/p.parent.name;target.mkdir(parents=True,exist_ok=True)
            (target/p.name).write_bytes(p.read_bytes())
source=root/"jadx"/"sources"
candidates=[]
if source.exists():
    # Class/file names are evidence of classes, not proof of visible menus.
    rx=re.compile(r'(screen|navigation|navigator|fragment|activity|bottomtab|tabbar|dashboard|timetable|timer|study|group|challenge|ranking|planner|friend|subject|mypage|profile|setting|login|signup|school|notification|home)',re.I)
    for p in source.rglob("*.java"):
        if rx.search(p.stem) and len(candidates)<2500:
            candidates.append(str(p.relative_to(source)))
(out/"source-class-candidates.json").write_text(json.dumps(candidates,ensure_ascii=False,indent=2))
summary={"apk_split_count":len(package),"split_names":[x["name"] for x in package],"framework_clues":list(dict.fromkeys(k for r in records for k in r["framework_clues"]))[:100],"resource_counts":{k:len(v) for k,v in mapping.items()},"class_candidates":len(candidates),"key_assets":assets[:200]}
(out/"SUMMARY.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
