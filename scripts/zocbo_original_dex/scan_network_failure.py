#!/usr/bin/env python3
"""Locate the original Zocbo network-error dialog resource and its originating callsites.
Only emits annotated excerpts, not source archives or sensitive credentials.
"""
from pathlib import Path
import json,re,xml.etree.ElementTree as ET

out=Path("evidence/zocbo-original-dex/network_failure_audit.json")
src=Path("/tmp/zocbo_jadx/sources")
res=Path("/tmp/zocbo_resdecoded/res/values")
msg_terms=("서비스 연결이 원활하지","네트워크 상태를 확인","서버 점검중","네트워크 연결시간")
strings={}
for f in res.glob("strings.xml"):
 try:
  tree=ET.parse(f)
  for x in tree.findall("string"):
   name=x.attrib.get("name","")
   value="".join(x.itertext()).strip()
   if any(t in value for t in msg_terms):strings[name]=value
 except Exception as e:print("RESOURCE_XML_READ_ERROR",str(e),flush=True)
pub={}
for f in res.glob("public.xml"):
 try:
  for x in ET.parse(f).findall("public"):
   if x.attrib.get("type")=="string" and x.attrib.get("name") in strings:
    pub[x.attrib["name"]]=x.attrib.get("id","")
 except Exception as e:print("PUBLIC_XML_ERROR",str(e),flush=True)
print("NETWORK_ERROR_RESOURCES",json.dumps(strings,ensure_ascii=False),flush=True)
print("RESOURCE_IDS",json.dumps(pub,ensure_ascii=False),flush=True)
keys=set(strings)
keywords=[
 "onFailure","HttpException","UnknownHostException","SSLHandshakeException",
 "SocketTimeoutException","ConnectException","IOException","ErrorResponse",
 "NETWORK_ERROR","NetworkError","networkError","onReceivedError",
 "onReceivedHttpError","getStatusCode","R.string","internet",
 "네트워크 상태를 확인", "서비스 연결이 원활하지", "connectivityManager",
 "isNetworkAvailable", "NetworkResult", "ErrorCode", "Retrofit",
 "setCookie.asp","SERVICETYPECD", "onetime_token_key",
]
finds={}
error_refs=[]
http_refs=[]
for f in sorted(src.rglob("*.java")):
 p=str(f.relative_to(src))
 if any(q in p for q in [
  "com/google/","org/chromium/","com/facebook/","com/kakao/",
  "okhttp3/","retrofit2/","kotlin/","androidx/","com/bumptech/",
  "com/appsflyer/","com/airbnb/","com/amplitude/","com/google/",
  "com/clevertap/","org/jetbrains/"]):continue
 try:ls=f.read_text("utf8","replace").splitlines()
 except Exception:continue
 if len(ls)>35000: continue
 exact=[]
 for i,line in enumerate(ls):
  if any("R.string."+name in line for name in keys) or any(v.lower() in line.lower() for v in pub.values()):
   exact.append(i)
 if exact:
  excerpt=[]
  for i in exact[:18]:
   excerpt.append({"line":i+1,"text":"\n".join(f"{j+1}: {ls[j][:280]}" for j in range(max(0,i-16),min(len(ls),i+24)))})
  error_refs.append({"file":p,"matches":len(exact),"excerpts":excerpt})
 if any(s in p for s in ("/modules/","/ui/","/repository/","/network/","/di/","/api/")) or re.search(r"sources/(?:[A-Za-z]\d/|p\d+[a-z]\d/)",str(f)):
  lines=[]
  for i,line in enumerate(ls):
   if re.search(r"\b(onFailure|onReceivedError|onReceivedHttpError|SSLHandshakeException|HttpException|UnknownHostException|ConnectException|SocketTimeoutException|NETWORK_ERROR|networkError)\b",line):
    lines.append(i)
  if lines and len(http_refs)<160:
   samples=[]
   for i in lines[:6]:
    samples.append({"line":i+1,"text":"\n".join(f"{j+1}: {ls[j][:220]}" for j in range(max(0,i-5),min(len(ls),i+13)))})
   http_refs.append({"file":p,"matches":len(lines),"excerpts":samples})
resobj={"error_resource_strings":strings,"error_resource_ids":pub,"exact_error_call_sites":error_refs,"http_network_exception_sites":http_refs}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(resobj,ensure_ascii=False,indent=2),encoding="utf8")
print("NETWORK_ERROR_REFERENCE_FILES",len(error_refs),"HTTP_EXCEPTION_FILES",len(http_refs),flush=True)
for f in error_refs:
 print("ERROR_RESOURCE_CONSUMER",f["file"],"count",f["matches"],flush=True)
 for ex in f["excerpts"][:7]:print(ex["text"][:2400],flush=True)
for f in http_refs[:25]:
 print("ERROR_HANDLER",f["file"],"count",f["matches"],flush=True)
 for ex in f["excerpts"][:2]:print(ex["text"][:1800],flush=True)
