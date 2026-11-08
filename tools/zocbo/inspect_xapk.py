#!/usr/bin/env python3
"""Inspect exactly hash-matched Zocbo XAPK splits for real UI, resource and navigation evidence."""
import zipfile,pathlib,json,collections,hashlib,re,subprocess
src=pathlib.Path('source/jokbo.xapk'); out=pathlib.Path('zocbo-audit');out.mkdir(exist_ok=True)
assert src.exists(),src
manifest={"sourceSha256":hashlib.sha256(src.read_bytes()).hexdigest(),"splits":[],"resources":[],"interestingTexts":[],"packageUrls":[],"frameworkHints":[]}
apkpath=pathlib.Path('zocbo-apks');apkpath.mkdir(exist_ok=True)
with zipfile.ZipFile(src) as archive:
  for i in archive.infolist():
    if i.filename.lower().endswith('.apk'):
      dst=apkpath/pathlib.Path(i.filename).name
      dst.write_bytes(archive.read(i))
      manifest["splits"].append({"name":dst.name,"size":i.file_size})
routes=set(); cnt=collections.Counter();urls=set()
file_inventory=[]
for apk in apkpath.glob('*.apk'):
  with zipfile.ZipFile(apk) as z:
    for info in z.infolist():
      path=info.filename
      ext=path.rsplit('.',1)[-1].lower() if '.' in path else ''
      if path.startswith(('res/','assets/','lib/')):
        cnt[path.split('/')[0]]+=1
        if ext in ('png','jpg','jpeg','svg','xml','webp','json','html','js','ttf','otf','woff','css') and (info.file_size<10_000_000):
          file_inventory.append({"apk":apk.name,"path":path,"size":info.file_size})
        if ext in ('png','jpg','jpeg','svg','webp') and re.search(r'logo|icon|home|search|school|subject|problem|question|download|detail|exam|grade|book|test|view|filter|menu|rank|tab|back|pdf|file',path,re.I):
          dst=out/'assets'/apk.stem/path
          dst.parent.mkdir(parents=True,exist_ok=True)
          dst.write_bytes(z.read(info))
          manifest['resources'].append({"source":apk.name+'/'+path,"local":str(dst.relative_to(out)),"bytes":info.file_size,"sha256":hashlib.sha256(dst.read_bytes()).hexdigest()})
        if ext in ('xml','json','js','html','css') and info.file_size<850_000:
          try:
            b=z.read(info); s=b.decode('utf-8','ignore')
            for u in re.findall(r'https?://[^\s"<>\\\x00]{6,250}',s):
              urls.add(u.rstrip(')\'",'))
          except Exception:pass
      if 'flutter' in path.lower() or 'react' in path.lower() or 'cordova' in path.lower():
        if len(manifest["frameworkHints"])<50: manifest["frameworkHints"].append(path)
(out/'files-index.json').write_text(json.dumps(file_inventory,ensure_ascii=False,indent=2))
(out/'resource-inventory.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(out/'package-urls.json').write_text(json.dumps(sorted(urls),ensure_ascii=False,indent=2))
print(json.dumps({"sha":manifest["sourceSha256"],"splits":manifest["splits"],"file_count":len(file_inventory),"copied_assets":len(manifest['resources']),"frameworkHints":manifest["frameworkHints"][:10],"urls":list(urls)[:20]},ensure_ascii=False,indent=2))
