#!/usr/bin/env python3
"""Capture PCM from the actual Android Emulator speaker via its own gRPC service.
No guest microphone, app audio file, or source PCM is used as the capture source.
The service is loopback-only and authenticated with its ephemeral discovery token.
"""
import glob, os, signal, struct, sys, time, wave
from pathlib import Path
import grpc
PORT=8554
def discovery():
    roots=[Path.home()/".android",Path(os.environ.get("ANDROID_EMULATOR_HOME",str(Path.home()/".android"))),Path("/tmp")/("android-"+os.environ.get("USER","runner")),Path("/tmp"),Path(os.environ.get("XDG_RUNTIME_DIR","/run/user/"+str(os.getuid())))]
    if "ANDROID_AVD_HOME" in os.environ: roots.append(Path(os.environ["ANDROID_AVD_HOME"]).parent)
    for _ in range(20):
        for root in dict.fromkeys(roots):
            for p in list(root.glob("avd/running/pid_*.ini"))+list(root.glob("running/pid_*.ini")):
                try:
                    values=dict(line.strip().split("=",1) for line in p.read_text().splitlines() if "=" in line)
                    if values.get("grpc.port")==str(PORT) and values.get("grpc.token"):
                        return values["grpc.token"]
                except OSError: pass
        time.sleep(.5)
    raise RuntimeError("Authenticated loopback emulator gRPC discovery not found")
def varint(v):
    out=bytearray()
    while v>=128:
        out.append((v&127)|128);v>>=7
    out.append(v);return bytes(out)
def readvar(data,i):
    v=0;shift=0
    while i<len(data) and shift<70:
        b=data[i];i+=1;v|=(b&127)<<shift
        if b<128:return v,i
        shift+=7
    raise ValueError("invalid protobuf varint")
def packet(data):
    i=0;audio=None
    while i<len(data):
        key,i=readvar(data,i);field=key>>3;kind=key&7
        if kind==0:
            _,i=readvar(data,i)
        elif kind==2:
            n,i=readvar(data,i);end=i+n
            if end>len(data):raise ValueError("truncated packet")
            if field==3:audio=data[i:end]
            i=end
        elif kind in (1,5):i+=8 if kind==1 else 4
        else:raise ValueError("unsupported protobuf field")
    return audio
def run(out):
    token=discovery()
    channel=grpc.insecure_channel("127.0.0.1:"+str(PORT))
    grpc.channel_ready_future(channel).result(timeout=15)
    fn=channel.unary_stream("/android.emulation.control.EmulatorController/streamAudio",request_serializer=lambda x:x,response_deserializer=lambda x:x)
    request=b"\x08"+varint(16000)+b"\x18\x01" # mono, signed PCM16
    call=fn(request,metadata=(("authorization","Bearer "+token),),timeout=360)
    stop=False
    def halt(*_):
        nonlocal stop
        stop=True;call.cancel()
    signal.signal(signal.SIGINT,halt);signal.signal(signal.SIGTERM,halt)
    count=0
    with wave.open(out,"wb") as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000)
        print("EMULATOR_GRPC_CAPTURE_STARTED",flush=True)
        try:
            for data in call:
                pcm=packet(data)
                if pcm:
                    assert len(pcm)%2==0
                    wav.writeframesraw(pcm);count+=len(pcm)
        except grpc.RpcError as e:
            if not stop:raise
    channel.close()
    print(f"EMULATOR_GRPC_SPEAKER_BYTES={count}",flush=True)
    if count<32000:raise RuntimeError("No actual guest audio output captured")
if __name__=="__main__":run(sys.argv[1])
