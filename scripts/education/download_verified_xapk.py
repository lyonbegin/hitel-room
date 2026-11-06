#!/usr/bin/env python3
"""Fetch the same APKPure XAPK version, accepting only exact user-supplied SHA256.

Do not claim an external download is the uploaded original unless it hashes identically.
"""
import hashlib,json,os,sys,time,urllib.request,urllib.error,urllib.parse,pathlib,subprocess,re,gzip
p=pathlib.Path(sys.argv[1]); p.mkdir(parents=True,exist_ok=True)
app=os.environ['APP_ID']; package=os.environ['APP_PACKAGE']; version=os.environ['APP_VERSION']; expected=os.environ['APP_SHA256'].lower()
urls=[f'https://d.apkpure.net/b/XAPK/{package}?version={version}',f'https://d.apkpure.com/b/XAPK/{package}?version={version}',f'https://d.apkpure.net/b/APK/{package}?version={version}',f'https://d.apkpure.com/b/APK/{package}?version={version}']
status={'app':app,'package':package,'version':version,'expected_sha256':expected,'source':'APKPure public XAPK matching user-supplied file hash','attempts':[],'verified':False}
# APKPure's public app-version API can return version-scoped CDN URLs, whereas
# its public d.apkpure.com endpoint sometimes serves a bot-challenge HTML page.
# Use only the exact requested version; SHA-256 validation remains mandatory.
try:
  endpoint='https://api.pureapk.com/m/v3/cms/app_version?hl=en-US&package_name='+urllib.parse.quote(package)
  request=urllib.request.Request(endpoint,headers={
    'User-Agent':'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
    'x-cv':'3172501','x-sv':'29','x-abis':'arm64-v8a,armeabi-v7a,armeabi,x86,x86_64','x-gp':'1',
    'Accept':'application/json,*/*'})
  with urllib.request.urlopen(request,timeout=25) as res:
    raw=res.read(12_000_000);encoding=res.headers.get('Content-Encoding','')
    if encoding=='gzip':raw=gzip.decompress(raw)
    body=raw.decode('utf-8',errors='replace').replace('\\/','/')
    status['attempts'].append({'type':'APKPure version API','http_status':res.status,'body_bytes':len(raw),'content_type':res.headers.get('Content-Type'),'version_mentioned':version in body,'preview':body[:260]})
    # Match the XAPKJ/APKJ tagged links used by APKPure's own metadata.
    links=[]
    for m in re.finditer(r'(?:XAPKJ|APKJ).{0,14}?(https?://[^"\\\\\\s]+)',body):
      url=m.group(1).rstrip('},')
      segment=body[max(0,m.start()-12000):m.start()]
      if version in segment[-12000:]:links.append(url)
    # Other API revisions may encode a plain URL rather than the APKJ marker.
    if not links:
      for m in re.finditer(r'https?://[^"\\\\\\s]+',body):
        url=m.group(0).rstrip('},')
        context=body[max(0,m.start()-2000):min(len(body),m.end()+300)]
        if version in context and any(x in url.lower() for x in ['.xapk','.apk','download','winudf.com']):
          links.append(url)
    urls[:0]=list(dict.fromkeys(links))[:12]
    status['attempts'].append({'type':'APKPure version API','candidate_urls':len(links),'selected':len(urls)-4})
except Exception as e:
  status['attempts'].append({'type':'APKPure version API','error':str(e)[:450]})
# A release asset can carry the unchanged user XAPK without committing a
# 100+ MB binary to Git. It will still be accepted only when hashes match.
if os.getenv('GITHUB_REPOSITORY') and os.getenv('GH_TOKEN'):
  tag=os.getenv('EDU_XAPK_RELEASE_TAG','hitel-education-original-xapk-20261106')
  try:
    directory=p/'release';directory.mkdir(exist_ok=True)
    cmd=['gh','release','download',tag,'-R',os.environ['GITHUB_REPOSITORY'],'--pattern',app+'.xapk','--dir',str(directory)]
    z=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=120)
    status['attempts'].append({'type':'GitHub Release asset','tag':tag,'exit_code':z.returncode,'message':z.stderr[-350:]})
    file=directory/(app+'.xapk')
    if file.exists():
      sha=hashlib.file_digest(file.open('rb'),'sha256').hexdigest()
      ok=sha==expected
      status['attempts'].append({'type':'GitHub Release asset','bytes':file.stat().st_size,'sha256':sha,'verified':ok})
      if ok:
        file.rename(p/(app+'.xapk'));status['verified']=True;status['source']='GitHub Release original XAPK SHA256 exact'
  except Exception as e:
    status['attempts'].append({'type':'GitHub Release asset','error':str(e)[:500]})
if status['verified']:
  (p/'source_verification.json').write_text(json.dumps(status,ensure_ascii=False,indent=2),encoding='utf8')
  print(json.dumps(status,ensure_ascii=False,indent=2));sys.exit(0)

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
    digest=h.hexdigest();item={'url':url,'bytes':n,'sha256':digest,'mime':kind,'verified':digest==expected,'preview':(temp.open('rb').read(200).decode('utf-8',errors='replace') if n<1_000_000 else '')}
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