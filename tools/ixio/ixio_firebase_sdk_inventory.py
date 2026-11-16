#!/usr/bin/env python3
"""Reproducible static inventory: what Firebase SDKs IXIO main actually packages
and which ones its OWN app bytecode directly invokes.

This does not infer backend database schema or allow carrier authentication bypass.
Only export class/method *names*, counts and Firebase resource *keys*, never
Firebase key values, network credentials, subscriber data or original DEX.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import json, pathlib, re, struct, zipfile

def u16(b,offset): return struct.unpack_from("<H",b,offset)[0]
def u32(b,offset): return struct.unpack_from("<I",b,offset)[0]
def uleb(b,p):
    out=0
    for n in range(5):
        v=b[p];p+=1
        out|=(v&127)<<(n*7)
        if v<128:return out,p
    raise ValueError("malformed uleb")

FB_MODULES={
    "core": "Lcom/google/firebase/FirebaseApp;",
    "messaging": "Lcom/google/firebase/messaging/",
    "crashlytics": "Lcom/google/firebase/crashlytics/",
    "analytics": "Lcom/google/firebase/analytics/",
    "remote_config": "Lcom/google/firebase/remoteconfig/",
    "authentication": "Lcom/google/firebase/auth/",
    "firestore": "Lcom/google/firebase/firestore/",
    "realtime_database": "Lcom/google/firebase/database/",
    "storage": "Lcom/google/firebase/storage/",
    "functions": "Lcom/google/firebase/functions/",
    "app_check": "Lcom/google/firebase/appcheck/",
    "installations": "Lcom/google/firebase/installations/",
    "sessions": "Lcom/google/firebase/sessions/",
    "performance": "Lcom/google/firebase/perf/",
    "in_app_messaging": "Lcom/google/firebase/inappmessaging/",
    "dynamic_links": "Lcom/google/firebase/dynamiclinks/",
    "config": "Lcom/google/firebase/FirebaseOptions;",
    "gms_measurement": "Lcom/google/android/gms/measurement/",
}
CONFIG_KEYS=[
    "google_app_id","google_api_key","gcm_defaultSenderId","project_id","google_project_id",
    "firebase_database_url","google_storage_bucket","default_web_client_id",
    "google_crash_reporting_api_key","firebase_analytics_collection_enabled",
    "firebase_crashlytics_collection_enabled","firebase_performance_collection_enabled",
    "firebase_messaging_auto_init_enabled",
]

def group(desc):
    for m,prefix in FB_MODULES.items():
        if desc.startswith(prefix):return m
    if desc.startswith("Lcom/google/firebase/"):return "firebase_other"
    return None

def instruction_size(code,ix,lim):
    x=u16(code,ix*2)
    op=x&255
    if op==0 and x in (0x0100,0x0200,0x0300):
        if x==0x0100:
            size=4+u16(code,ix*2+2)*2
        elif x==0x0200:
            size=2+u16(code,ix*2+2)*4
        else:
            w=u16(code,ix*2+2);n=u32(code,ix*2+4)
            size=4+(w*n+1)//2
        return max(1,min(size,lim-ix))
    if op in (0x03,0x06,0x09,0x14,0x17,0x1b,0x24,0x25,0x26,
              0x2a,0x2b,0x2c,0x6e,0x6f,0x70,0x71,0x72,0x74,0x75,0x76,
              0x77,0x78,0xfc,0xfd):return 3
    if op==0x18:return 5
    if op in (0xfa,0xfb):return 4
    if op in (0x02,0x05,0x08,0x13,0x15,0x16,0x19,0x1a,0x1c,0x1f,0x20,0x22,
              0x23,0x29,0xfe,0xff):return 2
    if 0x2d<=op<=0x3d or 0x44<=op<=0x6d or 0x90<=op<=0xaf or 0xd0<=op<=0xe2:
        return 2
    return 1

def inspect_dex(name,b,out):
    if b[:4]!=b"dex\n":raise ValueError(f"unsupported DEX magic in {name}")
    ns,os=u32(b,0x38),u32(b,0x3c)
    nt,ot=u32(b,0x40),u32(b,0x44)
    nm,om=u32(b,0x58),u32(b,0x5c)
    nc,oc=u32(b,0x60),u32(b,0x64)
    if max(ns,nt,nm,nc)>1_000_000:raise ValueError("invalid count")
    string_cache={}
    def s(i):
        if i not in string_cache:
            _,pos=uleb(b,u32(b,os+4*i))
            end=b.find(b"\0",pos)
            if end<0: raise ValueError("bad string")
            string_cache[i]=b[pos:end].decode("utf8",errors="replace")
        return string_cache[i]
    types=[s(u32(b,ot+i*4)) for i in range(nt)]
    methods=[]
    for i in range(nm):
        cl,proto,nam=struct.unpack_from("<HHI",b,om+8*i)
        methods.append((types[cl],s(nam)))
    own_classes=0
    for i in range(nc):
        at=oc+i*32
        type_idx,_,super_idx=struct.unpack_from("<III",b,at)
        desc=types[type_idx]
        module=group(desc)
        if module:
            out["sdk_defined_class_counts"][module]+=1
        own=desc.startswith("Lcom/lguplus/aicallagent/")
        if own: own_classes+=1
        # app subclasses of Android Firebase components give direct integration evidence
        if own and super_idx!=0xffffffff and group(types[super_idx]):
            if len(out["app_classes_extending_firebase"])<60:
                out["app_classes_extending_firebase"].append({"app_class":desc,"firebase_super":types[super_idx],"dex":name})
        if own and any(segment in desc for segment in (
            "/data/api/ixio/","/network/","/data/auth/","/data/init/login/",
            "/data/init/","/data/api/","/data/ai/")):
            if len(out["separate_telecom_and_ixio_api_class_paths"])<160:
                out["separate_telecom_and_ixio_api_class_paths"].append(desc)
        if not own:continue
        class_data_off=u32(b,at+24)
        if not class_data_off:continue
        p=class_data_off
        fs,p=uleb(b,p);fi,p=uleb(b,p)
        md,p=uleb(b,p);mv,p=uleb(b,p)
        if max(fs,fi,md,mv)>200000:raise ValueError("bad encoded class counts")
        for _ in range(fs+fi):
            _,p=uleb(b,p)
            _,p=uleb(b,p)
        for count in (md,mv):
            method_idx=0
            for _ in range(count):
                d,p=uleb(b,p);method_idx+=d
                _,p=uleb(b,p)
                offset,p=uleb(b,p)
                if not offset:continue
                if offset+16>len(b):continue
                count_ins=u32(b,offset+12)
                if count_ins>1600000 or offset+16+count_ins*2>len(b):continue
                ins=b[offset+16:offset+16+count_ins*2]
                caller=methods[method_idx][1] if method_idx<len(methods) else "unknown"
                pos=0
                while pos<count_ins:
                    first=u16(ins,pos*2)
                    opcode=first&255
                    if opcode in (0x6e,0x6f,0x70,0x71,0x72,0x74,0x75,0x76,0x77,0x78) and pos+2<count_ins:
                        target_idx=u16(ins,(pos+1)*2)
                        if target_idx<len(methods):
                            td,tn=methods[target_idx]
                            mod=group(td)
                            if mod:
                                out["app_direct_invoke_counts"][mod]+=1
                                if len(out["app_direct_invoke_examples"][mod])<110:
                                    out["app_direct_invoke_examples"][mod].append({
                                        "caller_class":desc,"caller_method":caller,
                                        "callee_class":td,"callee_method":tn,
                                        "opcode_hex":f"{opcode:02x}","dex":name
                                    })
                    step=instruction_size(ins,pos,count_ins)
                    pos+=max(1,step)
    out["dex_inventory"].append({"dex":name,"own_app_classes":own_classes,
                                 "firebase_method_ids_defined_or_referenced":
                                 sum(bool(group(x[0])) for x in methods),
                                 "dex_bytes":len(b)})

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--apk",type=pathlib.Path,required=True)
    p.add_argument("--out",type=pathlib.Path,required=True)
    p.add_argument("--resource-dump",type=pathlib.Path)
    p.add_argument("--manifest-dump",type=pathlib.Path)
    args=p.parse_args()
    out={"scope":"IXIO main delivered single APK - SDK vs original application direct invocations",
         "sdk_defined_class_counts":Counter(),
         "app_direct_invoke_counts":Counter(),
         "app_direct_invoke_examples":defaultdict(list),
         "app_classes_extending_firebase":[],
         "dex_inventory":[],
         "resource_key_presence":{},
         "firebase_manifest_components":[],
         "separate_telecom_and_ixio_api_class_paths":[],
         "limitations":["Static DEX scanning: no actual network responses, server-side schema, cloud project access or subscription outcome is inferred",
                        "Firebase SDK packaged does not imply Firebase product actively configured/used",
                        "Only directly invoked app-owned methods are included; wrapper/reflection/native pathways may not appear",
                        "App package contains vendor API repositories that are NOT automatically redirected by Firebase configuration"]}
    with zipfile.ZipFile(args.apk) as z:
        dex_files=[x for x in z.namelist() if re.fullmatch(r"classes\d*\.dex",x)]
        for name in sorted(dex_files,key=lambda x:int(x[7:-4]) if x[7:-4] else 1):
            print("DEX",name,flush=True)
            inspect_dex(name,z.read(name),out)
    if args.resource_dump and args.resource_dump.exists():
        s=args.resource_dump.read_text(errors="replace")
        out["resource_key_presence"]={k:bool(re.search(r"\b"+re.escape(k)+r"\b",s)) for k in CONFIG_KEYS}
    if args.manifest_dump and args.manifest_dump.exists():
        s=args.manifest_dump.read_text(errors="replace")
        # Show only public SDK class identifiers, not app IDs or project credentials
        known=re.findall(r"(?:com\.google\.firebase|com\.hitel\.ixio\.bootstrap)[A-Za-z0-9_.$]+",s)
        out["firebase_manifest_components"]=list(dict.fromkeys(known))[:65]
    out["sdk_defined_class_counts"]=dict(sorted(out["sdk_defined_class_counts"].items()))
    out["app_direct_invoke_counts"]=dict(sorted(out["app_direct_invoke_counts"].items()))
    out["app_direct_invoke_examples"]=dict(sorted(out["app_direct_invoke_examples"].items()))
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(out,ensure_ascii=False,indent=2))
    print("SUMMARY",json.dumps({
        "sdk_defined_class_counts":out["sdk_defined_class_counts"],
        "app_direct_invoke_counts":out["app_direct_invoke_counts"],
        "resource_key_presence":out["resource_key_presence"],
        "firebase_manifest_components":out["firebase_manifest_components"],
        "app_classes_extending_firebase":out["app_classes_extending_firebase"][:20],
        "app_direct_invoke_examples":{k:v[:16] for k,v in out["app_direct_invoke_examples"].items()},
    },ensure_ascii=False),flush=True)
if __name__=="__main__":main()
