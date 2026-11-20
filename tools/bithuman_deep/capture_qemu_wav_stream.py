#!/usr/bin/env python3
"""Retain QEMU's real WAV backend output across device close/reopen.

Android's wav_init_out opens with wb, replacing a regular file. A FIFO retains
every backend write. wav_fini_out cannot seek a FIFO and closes without rewriting
the header. Strip only each exact zero-size RIFF header and wrap the unchanged
PCM in a valid WAV after emulator shutdown. No reference signal is used here.
Source: platform/external/qemu/emu-master-dev/audio/wavaudio.c.
"""
import argparse
import json
import os
from pathlib import Path
import select
import signal
import struct
import time
import wave

def extract(raw):
    assert len(raw) >= 44 and raw[:4] == b'RIFF', 'No QEMU output header'
    header = raw[:44]
    assert header[8:20] == b'WAVEfmt \x10\x00\x00\x00'
    assert header[20:22] == b'\x01\x00' and header[36:40] == b'data'
    channels, rate = struct.unpack_from('<HI',header,22)
    bits = struct.unpack_from('<H',header,34)[0]
    assert bits == 16 and channels in (1,2), 'Unexpected backend PCM format'
    chunks = raw.split(header)
    assert not chunks[0], 'Unexpected bytes before first device'
    pcm = b''.join(chunks[1:])
    block = channels * 2
    assert len(pcm) % block == 0, 'Truncated backend PCM sample'
    return pcm, rate, channels, len(chunks)-1

def collect(pipe, raw):
    assert not pipe.exists(), 'Refuse to reuse an existing capture path'
    pipe.parent.mkdir(parents=True,exist_ok=True)
    os.mkfifo(pipe,0o600)
    fd = os.open(pipe,os.O_RDWR|os.O_NONBLOCK)
    raw.with_suffix('.pid').write_text(str(os.getpid()))
    raw.with_suffix('.ready').touch()
    running = True
    def stop(*_):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM,stop)
    with raw.open('wb',buffering=0) as out:
        while running:
            if select.select([fd],[],[],.2)[0]:
                data=os.read(fd,65536)
                if data: out.write(data)
        while select.select([fd],[],[],0)[0]:
            data=os.read(fd,65536)
            if not data: break
            out.write(data)
    os.close(fd)
    raw.with_suffix('.done').touch()

def finalize(raw, output):
    pid=int(raw.with_suffix('.pid').read_text())
    os.kill(pid,signal.SIGTERM)
    for _ in range(50):
        if raw.with_suffix('.done').exists(): break
        time.sleep(.1)
    assert raw.with_suffix('.done').exists(), 'Capture did not finish'
    pipe = raw.with_suffix('.fifo')
    if pipe.is_fifo(): pipe.unlink()
    pcm,rate,channels,devices=extract(raw.read_bytes())
    with wave.open(str(output),'wb') as dst:
        dst.setnchannels(channels);dst.setsampwidth(2);dst.setframerate(rate)
        dst.writeframes(pcm)
    report={'backend':'actual QEMU WAV output via FIFO','device_opens':devices,
            'sample_rate':rate,'channels':channels,'pcm_bytes':len(pcm),
            'captured_seconds':len(pcm)/(rate*channels*2),
            'reference_signal_used':False}
    output.with_suffix('.capture.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('mode',choices=['collect','finalize'])
    p.add_argument('--pipe',type=Path);p.add_argument('--raw',type=Path,required=True)
    p.add_argument('--wav',type=Path)
    a=p.parse_args()
    if a.mode=='collect': collect(a.pipe,a.raw)
    else: finalize(a.raw,a.wav)
