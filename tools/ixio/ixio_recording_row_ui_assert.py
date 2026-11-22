#!/usr/bin/env python3
"""End-to-end actual Android accessibility UI assertions; no simulated result."""
import re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path
OUT=Path('evidence');OUT.mkdir(exist_ok=True)
def adb(*args,raw=False):
    x=subprocess.check_output(['adb',*args],timeout=35)
    return x if raw else x.decode(errors='replace')
def snap(name):
    adb('shell','uiautomator','dump','/sdcard/hitel-row.xml')
    xml=adb('shell','cat','/sdcard/hitel-row.xml')
    (OUT/(name+'.xml')).write_text(xml)
    (OUT/(name+'.png')).write_bytes(adb('exec-out','screencap','-p',raw=True))
    return ET.fromstring(xml)
def label(n):return ' '.join((n.get('text',''),n.get('content-desc',''))).strip()
def bounds(n):return tuple(map(int,re.findall(r'\d+',n.get('bounds',''))))
def tap(n):
    x1,y1,x2,y2=bounds(n);adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2));time.sleep(2)
def find(r,words):
    hits=[n for n in r.iter('node') if label(n) in words]
    assert hits,('missing actual screen control',words,[label(n) for n in r.iter('node') if label(n)])
    return hits[0]
def row(r):
    n=find(r,{'통화 녹음','통화녹음','통화 자동 녹음','통화 녹음 설정'})
    x1,y1,x2,y2=bounds(n); yc=(y1+y2)//2
    candidates=[m for m in r.iter('node') if label(m).upper() in {'ON','OFF','켜짐','꺼짐','사용','미사용','켜기','끄기'} and len(bounds(m))==4 and abs((bounds(m)[1]+bounds(m)[3])//2-yc)<=max(40,y2-y1)]
    assert len(candidates)==1,('actual row status not uniquely visible',[(label(m),bounds(m)) for m in candidates])
    return n,label(candidates[0])
def toggle_and_return(root,name):
    n,prev=row(root);tap(n);detail=snap(name+'-detail')
    switches=[m for m in detail.iter('node') if m.get('checkable')=='true' or 'Switch' in m.get('class','')]
    assert len(switches)==1,('actual switch not unique',[(label(m),m.attrib) for m in switches])
    tap(switches[0]);snap(name+'-toggled');adb('shell','input','keyevent','4');time.sleep(3)
    after=snap(name+'-returned');_,new=row(after)
    assert prev!=new,('visible row unchanged',prev,new)
    print('UI_ROW_ACTUAL_TRANSITION',prev,new,flush=True)
    return after,prev,new
r=snap('initial')
try:row(r)
except AssertionError:
    tap(find(r,{'설정'}));r=snap('settings')
r,before,first=toggle_and_return(r,'toggle-one')
r,mid,last=toggle_and_return(r,'toggle-two')
assert mid==first and last==before,(before,first,mid,last)
log=adb('logcat','-d','-b','crash')
(OUT/'crash.txt').write_text(log)
assert 'FATAL EXCEPTION' not in log
print('ACTUAL_RECORDING_ROW_ON_OFF_ON_VERIFIED=YES',flush=True)
