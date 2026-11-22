import subprocess,time,xml.etree.ElementTree as ET,re
def adb(*a):return subprocess.check_output(['adb',*a],text=True)
def dump(n):
    adb('shell','uiautomator','dump','/sdcard/recorder-qa.xml')
    adb('pull','/sdcard/recorder-qa.xml','evidence/'+n+'.xml')
    with open('evidence/'+n+'.png','wb') as f:subprocess.run(['adb','exec-out','screencap','-p'],stdout=f,check=True)
    return ET.parse('evidence/'+n+'.xml').getroot()
for i in range(12):
    time.sleep(3)
    try:
        root=dump('recorder-'+str(i))
        button=next((n for n in root.iter('node') if n.get('text')=='녹음 로그'),None)
        if button is not None:break
    except Exception as e:print(type(e).__name__,flush=True)
else:raise AssertionError('RECORDER_LOG_BUTTON_NOT_VISIBLE')
print('RECORDER_LOG_BUTTON_VISIBLE=YES',flush=True)
x1,y1,x2,y2=map(int,re.findall(r'\d+',button.get('bounds')))
adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
time.sleep(2)
r=dump('recorder-dialog')
texts=[n.get('text') for n in r.iter('node')]
assert '로그 복사' in texts and '로그 지우기' in texts,texts
print('RECORDER_LOG_DIALOG_COPY_CLEAR_VISIBLE=YES',flush=True)
n=next(n for n in r.iter('node') if n.get('text')=='로그 복사')
x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
time.sleep(1)
adb('shell','pidof','com.lguplus.callrecorder')
with open('evidence/recorder-logcat.txt','w') as f:f.write(adb('logcat','-d','-s','HITEL_RECORDER_TRACE'))
s=open('evidence/recorder-logcat.txt').read()
assert 'RECORDER_PROCESS_INIT' in s and 'UI_RECORDER_LOG_BUTTON_ATTACHED' in s and 'UI_RECORDER_LOG_DIALOG_OPENED' in s and 'UI_RECORDER_LOG_COPY_COMPLETED' in s
print('RECORDER_PROCESS_AND_ACTUAL_LOG_EVENTS_VERIFIED=YES',flush=True)
