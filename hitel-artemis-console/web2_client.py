"""API transport extracted verbatim from lyonbegin/hitel-scribd-runner@24aed60fb99e7fc2ec3867521419a8ab51571bd8:universal/engine.py. No batch engine or job data."""
import base64,hashlib,json,os,urllib.request,urllib.error,urllib.parse
API="https://hitel-integration-api-production.up.railway.app/integrations/v1/public"
AUD="urn:lyonbegin:procureflow:hitel-isolated-task-submit"
class Blocked(Exception): pass
def canon(v): return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False)
def http(url,body=None,headers=None):
    req=urllib.request.Request(url,data=None if body is None else canon(body).encode(),headers={"Accept":"application/json","Content-Type":"application/json",**(headers or {})},method="GET" if body is None else "POST")
    with urllib.request.urlopen(req,timeout=45) as r: return r.status,json.load(r)
def get(path):
    try: return http(API+path)[1]
    except urllib.error.HTTPError as e:
        if e.code==404:return None
        raise
def submit(p,b,text):
    url=os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    url+=("&" if "?" in url else "?")+"audience="+urllib.parse.quote(AUD,safe="")
    token=http(url,headers={"Authorization":"Bearer "+os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})[1]["value"]
    code,obj=http(API+"/isolated/tasks/"+p["task_id"]+"/chat",{"request_id":b["request_id"],"room_name":b["room_name"],"text":text},{"X-HITEL-PRODUCER-OIDC":token})
    if code!=202 or obj.get("accepted") is not True: raise Blocked("not accepted")
    return obj
def result(job,r):
    n=r.get("result_length_bytes"); h=r.get("result_sha256")
    if type(n) is not int or not 0<n<=2000000 or not isinstance(h,str): raise Blocked("result proof")
    if isinstance(r.get("result_text"),str): raw=r["result_text"].encode()
    else:
        raw=bytearray()
        while len(raw)<n:
            c=get("/jobs/"+job+"/result?offset="+str(len(raw))+"&limit=65536")
            if not c or c.get("job_id")!=job or c.get("room_id")!=r.get("room_id") or c.get("offset")!=len(raw) or c.get("result_sha256")!=h or c.get("result_length_bytes")!=n: raise Blocked("chunk identity")
            v=base64.b64decode(c["content_base64"],validate=True)
            if not v or len(v)!=c.get("bytes_returned") or c.get("next_offset")!=len(raw)+len(v): raise Blocked("chunk size")
            raw.extend(v)
    if len(raw)!=n or hashlib.sha256(raw).hexdigest()!=h: raise Blocked("result hash")
    return raw.decode()
