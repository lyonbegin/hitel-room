#!/usr/bin/env python3
"""Non-finalized, incrementally written AAC-in-M4A -> native follower smoke.

This is NOT a Samsung real-device test, nor an Android AudioTrack acoustical
test. It proves the original follower emits valid ADTS while M4A is still
growing, rather than only after the recording is completed.
"""
import os
import pathlib
import select
import struct
import subprocess
import tempfile
import time

with tempfile.TemporaryDirectory() as temp:
    temp=pathlib.Path(temp)
    finished=temp/"full.m4a"
    source=temp/"recording-in-progress.m4a"
    helper=pathlib.Path(os.environ.get("HITEL_FOLLOW_BIN",str(temp/"aac_mdat_follow")))
    subprocess.run([
        "ffmpeg","-nostdin","-hide_banner","-loglevel","error","-y",
        "-f","lavfi","-i","sine=frequency=523:sample_rate=48000:duration=6",
        "-ac","1","-c:a","aac","-b:a","64k",str(finished)
    ],check=True)
    content=finished.read_bytes()
    cursor=0
    box_names=[]
    mdat_start=mdat_end=None
    while cursor+8<=len(content):
        size,kind=struct.unpack_from(">I4s",content,cursor)
        offset=8
        if size==1:
            size=struct.unpack_from(">Q",content,cursor+8)[0]
            offset=16
        if size==0:size=len(content)-cursor
        if size<offset:break
        box_names.append(kind.decode("latin1"))
        if kind==b"mdat":
            mdat_start=cursor+offset
            mdat_end=cursor+size
            break
        cursor+=size
    assert mdat_start is not None,box_names
    # Samsung recording file has a growing mdat, not a completed moov atom.
    original=content[:mdat_end]
    initial=min(mdat_start+250, len(original))
    source.write_bytes(original[:initial])
    proc=subprocess.Popen(
        [str(helper),str(source),"48000","1"],
        stdout=subprocess.PIPE,stderr=subprocess.PIPE
    )
    # A REAL TAILING TEST: append bytes after launch, in small increments,
    # and record how many complete AAC frames appear before final append.
    pos=initial
    buf=bytearray()
    frames=[]
    started=time.monotonic()
    appendedDone=None
    try:
        while time.monotonic()-started<10:
            if pos<len(original):
                chunk=original[pos:pos+620]
                with source.open("ab") as output:
                    output.write(chunk)
                    output.flush()
                pos+=len(chunk)
            elif appendedDone is None:
                appendedDone=time.monotonic()
            canread,_,_=select.select([proc.stdout],[],[],0.04)
            if canread:
                part=os.read(proc.stdout.fileno(),65536)
                if part:
                    buf.extend(part)
                else:
                    break
            while len(buf)>=12:
                n=struct.unpack_from("<I",buf)[0]
                if n<8 or n>8192:
                    raise AssertionError("invalid frame packet length="+str(n))
                if len(buf)<12+n:break
                cursor=struct.unpack_from("<Q",buf,4)[0]
                frame=bytes(buf[12:12+n])
                del buf[:12+n]
                assert frame.startswith(b"\xff\xf1"),frame[:4]
                frames.append((time.monotonic(),cursor,n))
            if len(frames)>=6 and pos<len(original):
                print("LIVE_FRAMES_BEFORE_SOURCE_END",len(frames),"source_position",pos,"source_total",len(original),flush=True)
                break
            if appendedDone and time.monotonic()-appendedDone>2:
                break
            time.sleep(0.007)
    finally:
        proc.terminate()
        try:_,errs=proc.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill();_,errs=proc.communicate()
    print("M4A_BOXES",box_names,"mdat_payload_bytes",len(original)-mdat_start,flush=True)
    print("AAC_FRAME_COUNT",len(frames),"source_bytes_appended",pos,flush=True)
    print("FOLLOWER_STDERR",errs.decode(errors="replace")[-1200:],flush=True)
    assert len(frames)>=6,"original native follower emitted fewer than 6 AAC frames from growing mdat"
    assert pos<len(original),"frames were not proven before recording completed"
    assert all(a[1]<b[1] for a,b in zip(frames,frames[1:])),"source cursor must be monotonic"
    print("PASS: original native AAC follower streams frames BEFORE M4A completion",flush=True)
