#!/usr/bin/env python3
"""Real UI/ContentProvider smoke, not just APK install. Fails if combined recorder trace is missing."""
import subprocess,time,xml.etree.ElementTree as ET,re,zipfile,pathlib
base=pathlib.Path('evidence');base.mkdir(exist_ok=True)
def adb(*args,timeout=30):
    return subprocess.run(['adb',*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
def dump(step):
    r=adb('shell','uiautomator','dump','/sdcard/ixio-unified-test.xml',timeout=45)
    raw=adb('exec-out','cat','/sdcard/ixio-unified-test.xml',timeout=20).stdout
    (base/f'ui_{step}.xml').write_bytes(raw)
    with (base/f'ui_{step}.png').open('wb') as f:
        f.write(adb('exec-out','screencap','-p',timeout=20).stdout)
    try:return ET.fromstring(raw)
    except ET.ParseError:return None
def tap(node):
    b=node.get('bounds','')
    n=re.findall(r'\d+',b)
    if len(n)!=4:raise RuntimeError('NO_UI_BOUNDS')
    x=(int(n[0])+int(n[2]))//2
    y=(int(n[1])+int(n[3]))//2
    adb('shell','input','tap',str(x),str(y))
def select_text(root,needles):
    if root is None:return None
    for el in root.iter():
        text=(el.get('text','')+' '+el.get('content-desc',''))
        if any(x in text for x in needles):return el
    return None

log=None
for attempt in range(30):
    root=dump('before_'+str(attempt))
    # Pixel-6 system launcher ANR obscures real IXIO UI in the captured screenshot.
    if select_text(root,["Pixel Launcher isn't responding"]):
        dismiss=select_text(root,['Wait']) if attempt<3 else select_text(root,['Close app'])
        if dismiss:
            tap(dismiss)
            time.sleep(3)
            continue
    log=select_text(root,['HITEL 진단 로그 열기','로그'])
    if log:break
    time.sleep(2)
if log is None:raise RuntimeError('MAIN_LOG_BUTTON_NOT_VISIBLE_EMULATOR')
tap(log)
time.sleep(1)
root=dump('dialog')
collect=select_text(root,['전체 로그 저장·복사'])
if collect is None:raise RuntimeError('UNIFIED_COLLECT_BUTTON_NOT_FOUND')
tap(collect)
path=None
for retry in range(25):
    time.sleep(2)
    ls=adb('shell','ls','-1','/sdcard/Download/IXIO_Logs/').stdout.decode(errors='replace')
    names=re.findall(r'IXIO_ALL_LOGS_\d{8}_\d{6}\.zip',ls)
    if names:
        path=names[-1];break
if path is None:raise RuntimeError('COMBINED_ZIP_NOT_EXPORTED')
target=base/path
r=adb('pull','/sdcard/Download/IXIO_Logs/'+path,str(target),timeout=40)
assert r.returncode==0,r.stderr.decode(errors='replace')
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    names=z.namelist()
    assert '01_IXIO_MAIN_INTERNAL_TRACE.txt' in names
    assert '02_IXIO_RECORDER_INTERNAL_TRACE.txt' in names
    status=z.read('00_README_STATUS.txt').decode()
    assert 'MAIN_LOG=OK' in status,status
    assert 'RECORDER_LOG=OK' in status,status
    recorder=z.read('02_IXIO_RECORDER_INTERNAL_TRACE.txt').decode()
    assert 'HITEL IXIO RECORDER INTERNAL TRACE' in recorder,recorder[:300]
    assert 'UNIFIED_PROVIDER_EXPORT_BEGIN' in recorder,recorder[:1000]
(base/'unified_verified.txt').write_text(
    'EMULATOR_UNIFIED_UI_AND_PROVIDER_ZIP_VERIFIED=YES\n'
    +'filename='+path+'\n'+status+'\n')
print('EMULATOR_UNIFIED_UI_AND_PROVIDER_ZIP_VERIFIED=YES',path)
