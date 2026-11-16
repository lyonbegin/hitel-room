#!/usr/bin/env python3
"""Recover actual method prototypes/cross-class invoke edges from IXIO main DEX.

Read-only static analysis of original class data and invoke instructions.
No runtime call to carrier servers and no auth state/return value changes.
No network URLs, credentials, subscriber data, bytecode payloads exported.
"""
from __future__ import annotations
from collections import defaultdict,Counter
import argparse, json, pathlib, re, struct, zipfile

def u16(b,o): return struct.unpack_from("<H",b,o)[0]
def u32(b,o): return struct.unpack_from("<I",b,o)[0]
def leb(b,p):
    v=0
    for i in range(5):
        k=b[p];p+=1
        v|=(k&127)<<(7*i)
        if k<128:return v,p
    raise ValueError("broken ULEB128")
def decode_sig(t):
    primitives={"V":"void","Z":"boolean","B":"byte","S":"short","C":"char",
                "I":"int","J":"long","F":"float","D":"double"}
    if t.startswith("["):return decode_sig(t[1:])+"[]"
    if t.startswith("L") and t.endswith(";"):
        return t[1:-1].replace("/",".")
    return primitives.get(t,t)

PATTERNS=[
    (70,r"/VerifyCtnUseCase(?:\$|;)"),
    (70,r"/ResolveOnboardingLoginEntryUseCase(?:\$|;)"),
    (75,r"/MemberVerificationRepository(?:Impl|\$|;)"),
    (68,r"/IsLoginCheckRepository(?:\$|;)"),
    (62,r"/TelephonySimRepository(?:Impl|\$|;)"),
    (70,r"/IxIOUserServiceWithTokenRepository(?:Impl|\$|;)"),
    (67,r"/IxIOUserService(?:Impl|\$|;)"),
    (60,r"/NetworkUrlConfigImpl(?:\$|;)"),
    (68,r"/IXIBuildConfig(?:\$Api|\$Servers|\$HostType|;)"),
    (60,r"/GetCtn[A-Za-z0-9_$]*[;]"),
    (52,r"/TokenRepository(?:Impl|\$|;)"),
    (45,r"/[A-Za-z0-9_]*Auth[A-Za-z0-9_]*(?:Repository|RemoteSource|Service|Api)(?:Impl|\$|;)"),
    (42,r"/[A-Za-z0-9_]*(?:Login|Member|Registration|Subscription|Join|SignIn)[A-Za-z0-9_]*(?:Repository|RemoteSource|Service|Api)(?:Impl|\$|;)"),
]
IGNORE_PARTS=("$Companion;","_Factory;","_MembersInjector;","$$ExternalSyntheticLambda",
              "$$serializer;")
INTERESTING=re.compile(r"(?i)verify|login|token|ctn|join|register|authenticate|auth|refresh|password|"
                       r"sign.?in|session|member|user|sim|subscription|term|agreement|check|request|"
                       r"call|client|response|post|retrofit|http|api|service|invoke|execute|consent|"
                       r"provision|onboard")
MODIFIERS={0x1:"public",0x2:"private",0x4:"protected",0x8:"static",0x10:"final",
           0x100:"native",0x400:"abstract",0x1000:"synthetic"}

def code_instruction_size(code,pos,lim):
    opword=u16(code,2*pos);op=opword&0xff
    if op==0:
        if opword==0x0100:
            return min(lim-pos,4+2*u16(code,2*pos+2))
        if opword==0x0200:
            return min(lim-pos,2+4*u16(code,2*pos+2))
        if opword==0x0300:
            width=u16(code,2*pos+2)
            size=u32(code,2*pos+4)
            return min(lim-pos,4+(width*size+1)//2)
        return 1
    if op in (0x03,0x06,0x09,0x14,0x17,0x1b,0x24,0x25,0x26,
              0x2a,0x2b,0x2c,0x6e,0x6f,0x70,0x71,0x72,
              0x74,0x75,0x76,0x77,0x78,0xfc,0xfd):return 3
    if op==0x18:return 5
    if op in (0xfa,0xfb):return 4
    if op in (0x02,0x05,0x08,0x13,0x15,0x16,0x19,0x1a,0x1c,0x1f,0x20,0x22,
              0x23,0x29,0xfe,0xff):return 2
    if 0x2d<=op<=0x3d or 0x44<=op<=0x6d or 0x90<=op<=0xaf or 0xd0<=op<=0xe2:return 2
    return 1

def scan_dex(name,b,ret):
    if b[:4]!=b"dex\n":raise ValueError("bad dex")
    strings={}
    ns,os=u32(b,0x38),u32(b,0x3c)
    nt,ot=u32(b,0x40),u32(b,0x44)
    np,op=u32(b,0x48),u32(b,0x4c)
    nm,om=u32(b,0x58),u32(b,0x5c)
    nc,oc=u32(b,0x60),u32(b,0x64)
    def string(i):
        if i not in strings:
            p=u32(b,os+4*i)
            _,p=leb(b,p)
            q=b.index(b"\0",p)
            strings[i]=b[p:q].decode("utf8","replace")
        return strings[i]
    types=[string(u32(b,ot+i*4)) for i in range(nt)]
    protos=[]
    for i in range(np):
        _,rtype,poff=struct.unpack_from("<III",b,op+12*i)
        params=()
        if poff:
            count=u32(b,poff)
            if count>500:raise ValueError("bad proto parameter count")
            params=tuple(types[u16(b,poff+4+2*j)] for j in range(count))
        protos.append((types[rtype],params))
    methods=[]
    for i in range(nm):
        tidx,pidx,nidx=struct.unpack_from("<HHI",b,om+8*i)
        methods.append((types[tidx],string(nidx),protos[pidx]))
    candidates=[]
    for i in range(nc):
        p=oc+32*i
        type_idx,flags,super_idx,interfaces_off,source_idx,annotations_off,class_data_off,_=struct.unpack_from("<IIIIIIII",b,p)
        cls=types[type_idx]
        if not cls.startswith("Lcom/lguplus/aicallagent/"):continue
        if any(skip in cls for skip in IGNORE_PARTS):continue
        score=max((score for score,pat in PATTERNS if re.search(pat,cls)),default=0)
        if not score:continue
        if cls.count("$")>=2:score-=20
        if score<=20:continue
        candidates.append((score,cls,flags,class_data_off,types[super_idx] if super_idx!=0xffffffff else None))
    candidates.sort(key=lambda t:(-t[0],t[1]))
    for score,cls,flags,class_data_off,superclass in candidates[:160]:
        defined=[]
        direct_calls=[]
        if class_data_off:
            p=class_data_off
            fs,p=leb(b,p);fi,p=leb(b,p);direct,p=leb(b,p);virtual,p=leb(b,p)
            for _ in range(fs+fi):
                _,p=leb(b,p);_,p=leb(b,p)
            for count in (direct,virtual):
                index=0
                for _ in range(count):
                    delta,p=leb(b,p);index+=delta
                    acc,p=leb(b,p);code_off,p=leb(b,p)
                    if index>=len(methods):continue
                    _,mname,(rtype,param)=methods[index]
                    signature=f"{decode_sig(rtype)} {mname}("+", ".join(map(decode_sig,param))+")"
                    if len(defined)<140:
                        defined.append({"method":mname,"signature":signature,
                          "access":" ".join(label for bit,label in MODIFIERS.items() if acc&bit),
                          "has_body":bool(code_off)})
                    if not code_off:continue
                    # Bytecode invoke edges. Count references by caller + callee signature.
                    lim=u32(b,code_off+12)
                    if lim>1000000 or code_off+16+2*lim>len(b):continue
                    ins=b[code_off+16:code_off+16+2*lim]
                    pos=0
                    while pos<lim:
                        word=u16(ins,2*pos);opcode=word&255
                        if opcode in (0x6e,0x6f,0x70,0x71,0x72,0x74,0x75,0x76,0x77,0x78) and pos+2<lim:
                            ref=u16(ins,2*(pos+1))
                            if ref<len(methods):
                                callee,cn,(rt,params)=methods[ref]
                                if (callee.startswith("Lcom/lguplus/aicallagent/") or
                                    callee.startswith(("Lretrofit2/","Lokhttp3/","Landroid/telephony/","Lkotlinx/coroutines/"))):
                                    if INTERESTING.search(cn) or INTERESTING.search(callee):
                                        if len(direct_calls)<140:
                                            direct_calls.append({
                                              "caller":mname,"callee_class":decode_sig(callee),
                                              "callee":cn,"callee_signature":f"{decode_sig(rt)} {cn}("+", ".join(map(decode_sig,params))+")"})
                        pos+=max(1,code_instruction_size(ins,pos,lim))
        entry={"class_name":decode_sig(cls),"dex":name,"priority":score,"extends":decode_sig(superclass) if superclass else None,
               "declared_methods":defined,"direct_calls":direct_calls}
        ret["classes"].append(entry)
        ret["matched_class_count"]+=1

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--apk",type=pathlib.Path,required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    a=p.parse_args()
    out={"source":"TESTED IXIO single APK original DEX method_ids/proto_ids and class_data",
         "classes":[],"matched_class_count":0,"limitations":[
           "Method signatures reflect DEX descriptors; Java generic type erasure applies",
           "Direct invokes are static bytecode refs, not proof of runtime execution",
           "Only representative class matches retained; Kotlin generated methods may be renamed"
         ]}
    with zipfile.ZipFile(a.apk) as z:
        dex_files=[x for x in z.namelist() if re.fullmatch(r"classes\d*\.dex",x)]
        for f in sorted(dex_files,key=lambda x:int(x[7:-4]) if x[7:-4] else 1):
            print("READ",f,flush=True)
            scan_dex(f,z.read(f),out)
    out["classes"].sort(key=lambda x:(-x["priority"],x["class_name"]))
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(out,ensure_ascii=False,indent=2))
    print("MATCHED",out["matched_class_count"])
    for item in out["classes"][:65]:
        if "$" in item["class_name"] and not item["class_name"].endswith("$Servers"):continue
        print("CLASS",item["class_name"],"DEX",item["dex"],"SUPER",item["extends"])
        for method in item["declared_methods"][:42]:
            if INTERESTING.search(method["method"]) or item["priority"]>=60:
                print("  SIGNATURE",method["access"],method["signature"])
        for edge in item["direct_calls"][:28]:
            print("  CALL",edge["caller"],"->",edge["callee_class"]+"."+edge["callee_signature"])
if __name__=="__main__":main()
