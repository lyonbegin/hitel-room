#!/usr/bin/env python3
"""Real FAAD2 source test: decode a missing-moov M4A in fixed and growing modes."""
import os,struct,subprocess,sys,time
from pathlib import Path

exe=Path(sys.argv[1])
original=Path(sys.argv[2]).read_bytes()
offset=0
end=None
while offset+8<=len(original):
    size=int.from_bytes(original[offset:offset+4],"big")
    typ=original[offset+4:offset+8]
    header=8
    if size==1:
        size=int.from_bytes(original[offset+8:offset+16],"big")
        header=16
    if size==0:size=len(original)-offset
    if typ==b"mdat":
        end=offset+size
        break
    if size<header:break
    offset+=size
assert end and end<len(original),"Expect M4A with moov after mdat"
# This is NOT a finalized M4A: the entire moov atom was removed.
mdat=original[:end]
src=Path("/tmp/argano-no-moov.m4a")
src.write_bytes(mdat)
fixed=Path("/tmp/argano-fixed.pcm")
with fixed.open("wb") as output:
    p=subprocess.run([str(exe),str(src),"fixed"],stdout=output,
                     stderr=subprocess.PIPE,timeout=40)
assert p.returncode==0,(p.returncode,p.stderr[-3000:].decode(errors="replace"))
fixed_bytes=fixed.read_bytes()
assert len(fixed_bytes)>150000,("no substantial PCM",len(fixed_bytes))
assert len(fixed_bytes)%2==0,"PCM samples must be 16bit"
print("FIXED_NO_MOOV_OK",len(fixed_bytes),p.stderr[-1000:].decode(errors="replace"))

growing=Path("/tmp/argano-growing.m4a")
growing.write_bytes(mdat[:40])
output=Path("/tmp/argano-growing.pcm")
with output.open("wb") as sink:
    live=subprocess.Popen([str(exe),str(growing),"follow"],
                          stdout=sink,stderr=subprocess.PIPE)
    try:
        with growing.open("ab",buffering=0) as writer:
            for i in range(40,len(mdat),1500):
                writer.write(mdat[i:i+1500])
                os.fsync(writer.fileno())
                time.sleep(.006)
        deadline=time.monotonic()+12
        while time.monotonic()<deadline:
            if output.stat().st_size>=len(fixed_bytes)-4096:break
            time.sleep(.05)
        got=output.stat().st_size
    finally:
        live.terminate()
        try:_,log=live.communicate(timeout=4)
        except subprocess.TimeoutExpired:
            live.kill();_,log=live.communicate(timeout=3)
got=output.stat().st_size  # include the SIGTERM-triggered final resampler flush
print("GROWING_NO_MOOV_RESULT",got,len(fixed_bytes),
      log[-1500:].decode(errors="replace"))
assert got==len(fixed_bytes),("growing PCM output length differs",got,len(fixed_bytes))
assert output.read_bytes()==fixed_bytes,"growing stream PCM differs from fixed"
print("PASS_FAAD2_NO_MOOV_GROWING_STREAM_EXACT_PCM_BYTES")
