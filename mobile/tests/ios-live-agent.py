#!/usr/bin/env python3
"""GitHub macOS iPhone Simulator -> HITEL same-origin websocket.
Only authentic screenshots/Meta idb frames are transmitted. No fake screens.
"""
import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
import websockets

BASE = os.getenv('HITEL_IOS_BASE', 'https://hitel-communication-web-production.up.railway.app')
UDID = os.environ['HITEL_IOS_UDID']
APP = os.getenv('HITEL_IOS_APP', '/tmp/hitel-ios-build/Build/Products/Debug-iphonesimulator/HitelNative.app')
BUNDLE = 'app.hitel.native'
STOPPED = False

def ticket():
    url=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']
    url+=('&' if '?' in url else '?')+'audience=hitel-ios-live'
    request=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with urllib.request.urlopen(request,timeout=25) as response:
        bearer=json.load(response)['value']
    request=urllib.request.Request(BASE+'/lab-sandbox/ios/runner-ticket',
        data=b'{}',headers={'Authorization':'Bearer '+bearer,'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(request,timeout=25) as response:
        return json.load(response)['ticket']

async def run_action(command):
    def call(args,timeout=40):
        p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                         text=True,timeout=timeout)
        if p.returncode!=0:raise RuntimeError((p.stdout or '')[-270:])
        return (p.stdout or '').strip()[-270:]
    action=command.get('action')
    data=command.get('data') or {}
    if action=='home':
        return await asyncio.to_thread(call,['idb','ui','button','HOME','--udid',UDID])
    if action=='rotate':
        angle='LANDSCAPE_LEFT' if data.get('angle')=='landscape' else 'PORTRAIT'
        return await asyncio.to_thread(call,['idb','ui','rotate',angle,'--udid',UDID])
    if action=='tap':
        return await asyncio.to_thread(call,['idb','ui','tap',str(int(data['x'])),str(int(data['y'])),'--udid',UDID])
    if action=='swipe':
        return await asyncio.to_thread(call,['idb','ui','swipe',
            str(int(data['x'])),str(int(data['y'])),str(int(data['x2'])),str(int(data['y2'])),'--udid',UDID])
    if action=='text':
        value=str(data.get('text') or '')
        if not value or len(value)>300:raise ValueError('INVALID_TEXT')
        # HID text input works for ASCII. For Hangul use Simulator pasteboard.
        if value.isascii():
            return await asyncio.to_thread(call,['idb','ui','text',value,'--udid',UDID])
        def paste_unicode():
            cp=subprocess.run(['xcrun','simctl','pbcopy',UDID],input=value,text=True,
                capture_output=True,timeout=20)
            if cp.returncode!=0:raise RuntimeError('SIMULATOR_UNICODE_CLIPBOARD_UNAVAILABLE '+cp.stderr[-100:])
            return call(['idb','ui','key','25','--command','--udid',UDID])
        return await asyncio.to_thread(paste_unicode)
    if action=='install':
        if not Path(APP).is_dir():raise FileNotFoundError('HITEL_SIMULATOR_APP_NOT_BUILT')
        return await asyncio.to_thread(call,['xcrun','simctl','install',UDID,APP],120)
    if action=='launch':
        def launch():
            p=subprocess.run(['xcrun','simctl','launch',UDID,BUNDLE],
                env={**os.environ,'SIMCTL_CHILD_HITEL_LAB_URL':BASE+'/sdk-lab/device?side=ios'},
                text=True,capture_output=True,timeout=45)
            if p.returncode!=0:raise RuntimeError((p.stderr or p.stdout)[-250:])
            return p.stdout[-250:]
        return await asyncio.to_thread(launch)
    if action=='safari':
        return await asyncio.to_thread(call,['xcrun','simctl','openurl',UDID,'https://hitel-communication-web-production.up.railway.app/sdk-lab/device?side=ios'])
    raise ValueError('UNSUPPORTED_ACTION')

async def stream_frames(ws):
    proc=await asyncio.create_subprocess_exec('idb','video-stream','--format','mjpeg',
        '--fps','10','--scale-factor','0.65','--udid',UDID,
        stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    print('IDB_VIDEO_STARTED',flush=True)
    buffer=bytearray()
    count=0
    try:
        while True:
            data=await proc.stdout.read(32768)
            if not data:raise RuntimeError('IDB_VIDEO_STREAM_ENDED')
            buffer.extend(data)
            while True:
                start=buffer.find(b'\xff\xd8')
                if start<0:
                    buffer.clear()
                    break
                if start>0:del buffer[:start]
                end=buffer.find(b'\xff\xd9',2)
                if end<0:break
                jpg=bytes(buffer[:end+2]);del buffer[:end+2]
                if len(jpg)>1500000:continue
                await ws.send(jpg)
                count+=1
                if count==1:print('FIRST_ACTUAL_IDB_FRAME_SENT',flush=True)
            if len(buffer)>4_000_000:buffer.clear()
    finally:
        if proc.returncode is None:
            proc.terminate()
            try:await asyncio.wait_for(proc.wait(),timeout=4)
            except asyncio.TimeoutError:proc.kill()
        err=(await proc.stderr.read()).decode(errors='replace')[-500:]
        if err:print('IDB_STDERR',err,flush=True)

async def receive(ws):
    global STOPPED
    async for data in ws:
        if not isinstance(data,str):continue
        try:message=json.loads(data)
        except json.JSONDecodeError:continue
        if message.get('type')=='stop':
            STOPPED=True
            print('IOS_OPERATOR_STOP',flush=True)
            return
        if message.get('type')!='command':continue
        try:
            result=await run_action(message)
            await ws.send(json.dumps({'type':'result','id':message.get('id'),
                'ok':True,'message':result or message.get('action')+' completed'}))
        except Exception as exc:
            await ws.send(json.dumps({'type':'result','id':message.get('id'),
                'ok':False,'message':str(exc)[-300:]}))

async def main():
    global STOPPED
    attempts=0
    while not STOPPED:
        try:
            t=await asyncio.to_thread(ticket)
            wsurl=BASE.replace('https://','wss://').replace('http://','ws://')+'/lab-sandbox/ios/socket?role=runner&ticket='+t
            async with websockets.connect(wsurl,max_size=2_000_000,ping_interval=15,ping_timeout=30) as ws:
                print('IOS_RUNNER_PAIRED',flush=True)
                attempts=0
                sender=asyncio.create_task(stream_frames(ws))
                receiver=asyncio.create_task(receive(ws))
                done,pending=await asyncio.wait({sender,receiver},return_when=asyncio.FIRST_COMPLETED)
                for job in pending:job.cancel()
                await asyncio.gather(*pending,return_exceptions=True)
                for job in done:
                    if job.exception():print('IOS_TASK_ERROR',repr(job.exception()),flush=True)
        except urllib.error.HTTPError as e:
            if e.code==409:
                print('IOS_SESSION_STOPPED_BY_CONTROLLER',flush=True)
                return
            print('IOS_TICKET_HTTP_ERROR',e.code,flush=True)
        except Exception as e:
            print('IOS_CONNECTION_ERROR',repr(e),flush=True)
        if STOPPED:return
        attempts+=1
        await asyncio.sleep(min(15,2+attempts))
if __name__=='__main__':
    try:asyncio.run(main())
    except KeyboardInterrupt:pass
