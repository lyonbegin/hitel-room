#!/usr/bin/env python3
"""Strict original XAPK/Dex reverse trace of Retrofit DotComAPI baseUrl & resources.
Only exact hash-matched already JADX-decompiled files under /tmp/zocbo_jadx.
"""
from pathlib import Path
import re, json, zipfile, subprocess, shutil, hashlib
root=Path('/tmp/zocbo_jadx/sources')
assert root.exists() and (root/'com/eduzone/eduzoneviewer/repository/I.java').exists(),"original jadx sources missing"
dest=Path('evidence/zocbo-original-dex/dotcomapi_baseurl_deep_trace.txt')
dest.parent.mkdir(parents=True, exist_ok=True)
patterns={
 'dotcom_binding':re.compile(r'DotComAPI|TrackerAPI|@Named\(|@Provides\b|@Binds\b',re.I),
 'retrofit_creation':re.compile(r'\.baseUrl\s*\(|new\s+Retrofit\.Builder|Retrofit\$Builder|Retrofit\.Builder|retrofit2\.Retrofit|new\s+Retrofit|RetrofitKt',re.I),
 'hostname_config':re.compile(r'(?:https?://(?:m\.|www\.)?zocbo\.com)|(?:https?://[a-z0-9.-]*zocbo\.[a-z]+)|(?:BASE_URL|base_url|baseUrl|DOMAIN_URL|domainUrl|domain_url|dotComBase|dotcomUrl|endpointUrl)',re.I),
 'retrofit_interface':re.compile(r'app\.api\.asp|VIEWER_FILE_PATH|@POST\b|@GET\b')
}
groups={k:[] for k in patterns}
for f in root.rglob('*.java'):
  rp=str(f.relative_to(root))
  # Ignore known vendor library code unless direct domain injection found
  if rp.startswith(('androidx/','kotlin/','kotlinx/','retrofit2/','okhttp3/','com/google/','com/facebook/','com/airbnb/')):
    continue
  try: ls=f.read_text('utf-8','replace').splitlines()
  except: continue
  for k,p in patterns.items():
    matches=[i for i,s in enumerate(ls) if p.search(s)]
    if matches:
      groups[k].append((rp,matches,ls))
groups['dotcom_binding'].sort(key=lambda r:(not any('DotComAPI' in r[2][i] for i in r[1]),not any('@Provides' in r[2][i] for i in r[1]),r[0]))
groups['retrofit_creation'].sort(key=lambda r:(not any('.baseUrl(' in r[2][i] for i in r[1]),r[0]))
chunks=[]
index={}
for group, arr in groups.items():
    index[group] = [{'file':name,'hits':[i+1 for i in indices[:60]]} for name,indices,_ in arr[:220]]
    chunks.append('*********** '+group+' FILES='+str(len(arr))+' ***********')
    for name,ind,ls in arr[:180 if group in ('dotcom_binding','retrofit_creation') else 95]:
      # Dagger bindings and Retrofit setup need full source to prove exact origin.
      full=(group=='dotcom_binding' and any('DotComAPI' in ls[i] or '@Provides' in ls[i] for i in ind)) or (group=='retrofit_creation' and any('.baseUrl(' in ls[i] or 'Retrofit.Builder' in ls[i] for i in ind))
      spans=[]
      for i in ind[:40]:
        start=max(0,i-(30 if full else 8));stop=min(len(ls),i+(50 if full else 13))
        if spans and start<=spans[-1][1]:spans[-1]=(spans[-1][0],max(spans[-1][1],stop))
        else:spans.append((start,stop))
      if full and len(ls)<=800:spans=[(0,len(ls))]
      lines=[]
      for start,stop in spans[:25]:
        lines += [f'{j+1}: {ls[j][:550]}' for j in range(start,min(stop,start+500))]
        lines.append('----------')
      section='======= '+name+' TOTAL_LINES '+str(len(ls))+' HITS '+str([i+1 for i in ind[:45]])+' =======\n'+'\n'.join(lines)
      chunks.append(section)
      print('SOURCE',group,name,'HITS',[i+1 for i in ind[:18]],flush=True)
# collect all java resource method and BuildConfig literals linked to URL
addtargets=['com/eduzone/eduzoneviewer/BuildConfig.java','com/eduzone/eduzoneviewer/EdApplication.java','com/eduzone/eduzoneviewer/repository/I.java']
for name in addtargets:
 f=root/name
 if f.exists():
  chunks.append('=== EXTRA TARGET '+name+' ===\n'+'\n'.join(f'{i+1}: {s[:500]}' for i,s in enumerate(f.read_text('utf8','replace').splitlines()[:800])))
# raw Android compiled resources scan: apk names / manifest host strings / aapt output if installed
xapk=Path('source/jokbo.xapk')
if xapk.exists():
  h=hashlib.file_digest(xapk.open('rb'),'sha256').hexdigest()
  chunks.append('=== XAPK SHA256 ===\n'+h)
  assert h=='d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5'
  with zipfile.ZipFile(xapk) as z:
    apks=sorted((e for e in z.infolist() if e.filename.endswith('.apk')),key=lambda e:('base' not in e.filename.lower(),-e.file_size))
    apk=Path('/tmp/zocbo_for_aapt.apk')
    if apks:
      apk.write_bytes(z.read(apks[0].filename))
      aapt=shutil.which('aapt') or shutil.which('aapt2')
      if aapt:
        for args in [['dump','resources',str(apk)],['dump','badging',str(apk)]]:
          try:
            p=subprocess.run([aapt]+args,capture_output=True,text=True,timeout=50)
            txt=p.stdout
            lines=txt.splitlines()
            ix=[i for i,l in enumerate(lines) if re.search('zocbo|retrofit|dotcom|base.url|api.asp|server.url',l,re.I)]
            subset=['\n'.join(f'{j+1}: {lines[j][:500]}' for j in range(max(0,i-2),min(len(lines),i+3))) for i in ix[:200]]
            chunks.append('=== AAPT RESOURCE '+str(args)+' / HIT '+str(len(ix))+' ===\n'+'\n\n'.join(subset))
          except Exception as e:chunks.append('AAPT ERROR '+str(e))
      else:chunks.append('AAPT_RESOURCE_TOOL_UNAVAILABLE')
      apk.unlink(missing_ok=True)
content='\n\n'.join(chunks)
dest.write_text(content[:2600000],encoding='utf8')
(Path('evidence/zocbo-original-dex/dotcomapi_baseurl_index.json')).write_text(json.dumps(index,indent=2),encoding='utf8')
print('RESULT_FILE',str(dest),'LENGTH',len(content),'INDEX',json.dumps({k:len(v) for k,v in groups.items()}),flush=True)
