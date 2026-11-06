#!/usr/bin/env python3
"""Capture **actual Android emulator framebuffer** and UI tree for reachable screens.

No mock screens or generated app UI. Avoid irreversible/purchase/account actions.
"""
import hashlib,json,os,pathlib,re,subprocess,time,xml.etree.ElementTree as ET
from collections import deque

pkg=os.environ['APP_PACKAGE']; app=os.environ['APP_ID']; base=pathlib.Path('evidence')/app;base.mkdir(parents=True,exist_ok=True)
shots=base/'screenshots'; shots.mkdir(exist_ok=True)
max_screens=int(os.getenv('MAX_SCREENS','65')); max_depth=int(os.getenv('MAX_DEPTH','4'))

def adb(*args,check=False,timeout=60):
  z=subprocess.run(['adb',*map(str,args)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
  if check and z.returncode:raise RuntimeError(z.stderr.decode(errors='replace')[:500])
  return z

def sh(*args):return adb('shell',*args)

def focus():
  x=sh('dumpsys','window','windows').stdout.decode(errors='replace')
  m=re.search(r'mCurrentFocus=([^\n]+)',x)
  return m.group(1).strip() if m else ''

def launch():
  sh('am','force-stop',pkg);time.sleep(.45)
  adb('shell','monkey','-p',pkg,'-c','android.intent.category.LAUNCHER','1')
  time.sleep(3)

def hierarchy():
  sh('uiautomator','dump','/sdcard/hitel-edu-window.xml')
  x=sh('cat','/sdcard/hitel-edu-window.xml').stdout.decode(errors='replace')
  return x if '<hierarchy' in x else ''

def nodes(xml):
  if not xml:return []
  try:root=ET.fromstring(xml)
  except ET.ParseError:return []
  result=[]
  for n in root.iter('node'):
    b=n.attrib.get('bounds','');m=re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',b)
    if not m:continue
    x1,y1,x2,y2=map(int,m.groups());
    if x2-x1<17 or y2-y1<17:continue
    d={'x':(x1+x2)//2,'y':(y1+y2)//2,'label':n.attrib.get('text','') or n.attrib.get('content-desc',''),'resource':n.attrib.get('resource-id',''),'class':n.attrib.get('class',''),'clickable':n.attrib.get('clickable')=='true','enabled':n.attrib.get('enabled')=='true'}
    if d['clickable'] and d['enabled']:result.append(d)
  return result

BLOCK=re.compile(r'(구매|결제|구독|유료|장바구니|삭제|탈퇴|지불|계정 삭제|로그아웃|신고|제출|확정|환불|신청|회원가입|sign.?up|pay|purchase|subscribe|delete|uninstall|report)',re.I)

def actions(ns):
  seen=set();out=[]
  for x in ns:
    if BLOCK.search(x['label']):continue
    key=(x['x']//15,x['y']//15)
    if key in seen:continue
    seen.add(key);out.append(x)
  return out[:18]

def fingerprint(xml,ns):
  if xml:
    s=[(x['label'],x['resource'],x['class'],x['x']//8,x['y']//8) for x in ns]
    return hashlib.sha256(json.dumps(s,ensure_ascii=False).encode()).hexdigest()
  return ''

state={'app':app,'package':pkg,'screens':[],'events':[],'blocked_reason':None,'device':sh('getprop','ro.product.model').stdout.decode(errors='replace').strip(),'android':sh('getprop','ro.build.version.release').stdout.decode(errors='replace').strip()}
installed=sh('pm','path',pkg).stdout.decode(errors='replace').strip()
if not installed:
  state['blocked_reason']='APP_NOT_INSTALLED'; (base/'screens.json').write_text(json.dumps(state,ensure_ascii=False,indent=2));raise SystemExit(30)

queue=deque([[]]); visited=set(); attempts=0; start=time.monotonic()
while queue and len(state['screens'])<max_screens and attempts<180 and time.monotonic()-start<1350:
  path=queue.popleft();attempts+=1
  try:
    launch()
    for click in path:
      sh('input','tap',str(click['x']),str(click['y']));time.sleep(1.2)
    time.sleep(.8)
    xml=hierarchy();ns=nodes(xml);sig=fingerprint(xml,ns)
    if not sig:
      sig=hashlib.sha256(sh('dumpsys','activity','activities').stdout[:10000]).hexdigest()
    if sig in visited:continue
    visited.add(sig);idx=len(state['screens']);prefix=f'{idx:03d}'
    png=shots/(prefix+'.png');data=adb('exec-out','screencap','-p',timeout=40).stdout
    if not data.startswith(b'\x89PNG'):
      state['events'].append({'path':path,'error':'screencap not PNG'});continue
    png.write_bytes(data)
    (shots/(prefix+'.xml')).write_text(xml,encoding='utf8')
    rec={'index':idx,'file':str(png),'sha256':hashlib.sha256(data).hexdigest(),'focus':focus(),'path':path,'clickable_count':len(ns),'clickables':actions(ns),'captured_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    state['screens'].append(rec)
    if len(path)<max_depth:
      for node in actions(ns):
        queue.append(path+[node])
  except Exception as ex:
    state['events'].append({'path':path,'error':str(ex)[:400]})
if not state['screens']:
  state['blocked_reason']='NO_REAL_SCREEN_CAPTURED'
state['attempts']=attempts;state['unique_screens']=len(state['screens']);state['remaining_paths']=len(queue);state['elapsed_seconds']=round(time.monotonic()-start,2)
(base/'screens.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in state.items() if k!='screens' and k!='events'},ensure_ascii=False,indent=2))
if not state['screens']:raise SystemExit(31)