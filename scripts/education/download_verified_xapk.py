#!/usr/bin/env python3
"""Fetch the same APKPure XAPK version, accepting only exact user-supplied SHA256.

Do not claim an external download is the uploaded original unless it hashes identically.
"""
import hashlib,json,os,sys,time,urllib.request,urllib.error,pathlib,subprocess
p=pathlib.Path(sys.argv[1]); p.mkdir(parents=True,exist_ok=True)
app=os.environ['APP_ID']; package=os.environ['APP_PACKAGE']; version=os.environ['APP_VERSION']; expected=os.environ['APP_SHA256'].lower()
urls=[f'https://d.apkpure.net/b/XAPK/{package}?version={version}',f'https://d.apkpure.com/b/XAPK/{package}?version={version}',f'https://d.apkpure.net/b/APK/{package}?version={version}',f'https://d.apkpure.com/b/APK/{package}?version={version}']
status={'app':app,'package':package,'version':version,'expected_sha256':expected,'source':'APKPure public XAPK matching user-supplied file hash','attempts':[],'verified':False}
for url in urls:
  try:
    temp=p/'incoming.part'; h=hashlib.sha256(); n=0
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36','Accept':'application/octet-stream,*/*','Referer':'https://apkpure.net/'})
    with urllib.request.urlopen(req,timeout=90) as res,open(temp,'wb') as f:
      if res.status!=200: raise RuntimeError(f'HTTP {res.status}')
      kind=res.headers.get('Content-Type','');
      while True:
        chunk=res.read(1048576)
        if not chunk:break
        n+=len(chunk)
        if n>400_000_000:raise RuntimeError('file too large')
        f.write(chunk);h.update(chunk)
    digest=h.hexdigest();item={'url':url,'bytes':n,'sha256':digest,'mime':kind,'verified':digest==expected}
    status['attempts'].append(item)
    if digest==expected:
      temp.rename(p/(app+'.xapk')); status['verified']=True; status['source_url']=url;break
    temp.unlink(missing_ok=True)
  except Exception as e:
    status['attempts'].append({'url':url,'error':str(e)[:500]})
finally_status=p/'source_verification.json';finally_status.write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(status,ensure_ascii=False,indent=2))
if not status['verified']:
  print('BLOCKED: exact original hash could not be obtained from public source; no APK has been substituted.',file=sys.stderr)
  sys.exit(28)