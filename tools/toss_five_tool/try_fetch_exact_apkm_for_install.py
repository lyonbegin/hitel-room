#!/usr/bin/env python3
import requests,re,html,hashlib,sys
from urllib.parse import urljoin
src='https://www.apkmirror.com/apk/viva-republica/%ED%86%A0%EC%8A%A4/toss-5-285-0-release/'
sha='3757c1f52bf5ef47febd98266b81dd016174085278f5cd0db31cfa7526c70a95'
s=requests.Session();s.headers['User-Agent']='Mozilla/5.0'
def page(url):
 r=s.get(url,timeout=30);print('PAGE',r.status_code,r.url,len(r.content),flush=True)
 r.raise_for_status();return r.text
def links(t,b):
 return list(dict.fromkeys(urljoin(b,html.unescape(x)) for x in re.findall(r'href\s*=\s*["\']([^"\']+)["\']',t,re.I)))
html0=page(src)
variants=[u for u in links(html0,src) if 'toss-5-285-0-android-apk-download' in u]
print('variants',variants[:4],flush=True)
if not variants:sys.exit('NO_VARIANT_LINK')
html1=page(variants[0]); candidates=[u for u in links(html1,variants[0]) if 'download.php' in u or ('/download/' in u and 'key=' in u)]
print('candidates',candidates[:6],flush=True)
if not candidates:sys.exit('NO_DOWNLOAD_URL')
for u in candidates[:4]:
 r=s.get(u,stream=True,timeout=40)
 print('download',r.status_code,r.url,r.headers.get('content-type'),r.headers.get('content-length'),flush=True)
 if r.status_code!=200:continue
 h=hashlib.sha256();n=0
 with open('/tmp/toss_exact.apkm','wb') as f:
  for c in r.iter_content(4*1024*1024):
   if c:n+=len(c);h.update(c);f.write(c)
 print('result',n,h.hexdigest(),flush=True)
 if n>190_000_000 and h.hexdigest()==sha:sys.exit(0)
sys.exit('DOWNLOAD_FAILED_OR_SHA_MISMATCH')
