"""Client of the original HITEL Universal API; no server, engine or direct relay calls."""
import base64, csv, hashlib, io, json, os, re, time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

REPO = "lyonbegin/hitel-scribd-runner"
BRANCH = "feature/hitel-universal-ai-ui-api-20261127"
BASE = "https://api.github.com/repos/" + REPO
REF = "?ref=" + quote(BRANCH, safe="")
ID = re.compile(r"^[a-z][a-z0-9-]{2,63}$")
class ContractError(ValueError): pass
class ApprovalError(PermissionError): pass

def api(method, path, body=None, token=None):
    headers = {"Accept":"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"}
    if token: headers["Authorization"]="Bearer "+token
    req=Request(BASE+path, data=None if body is None else json.dumps(body,ensure_ascii=False).encode(), headers=headers, method=method)
    try:
        with urlopen(req,timeout=45) as r:
            raw=r.read()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        if method=="GET" and exc.code==404: return None
        raise

def file_bytes(path, *, call=api, token=None):
    item=call("GET","/contents/"+path+REF,token=token)
    if item is None: return None
    if item.get("encoding")!="base64": raise ContractError("Unsupported GitHub contents encoding")
    return base64.b64decode(item["content"])

def read_json(path, *, call=api, token=None):
    data=file_bytes(path,call=call,token=token)
    return None if data is None else json.loads(data)

def approved_task():
    # Task supplied by the caller must already be approved on the original service.
    # No locally invented task ID, local live flag, or approval bypass.
    task=os.environ.get("task_id","")
    if not ID.fullmatch(task) or task=="scribd-18109":
        raise ApprovalError("An approved, dedicated task_id from the original API is required")
    if not os.environ.get("GH_TOKEN"):
        raise ApprovalError("Original API requires an authorized GitHub connection (GH_TOKEN)")
    return task

def project_for(prompt, task, run):
    if not isinstance(prompt,str) or not prompt.strip() or len(prompt)>20000:
        raise ContractError("Text must fit the original API 24,000-character batch prompt limit")
    key=hashlib.sha256((task+"\0"+run+"\0"+prompt).encode()).hexdigest()[:32]
    pid="artemis-"+key
    return {"project_id":pid,"command":"start","provider":"hitel","task_id":task,
            "batch_size":1,"prompt":"For the one input record, follow its text as the ARTEMIS model instructions. Return the requested JSON model response serialized as a string in the answer field. Follow the outer Universal engine row schema; do not include any extra fields.",
            "fields":{"answer":"string"},"records":[{"record_id":"turn-1","text":prompt}]}

def register(p, *, call=api, token):
    path="universal/projects/"+p["project_id"]+"/project.json"
    existing=read_json(path,call=call,token=token)
    if existing is not None:
        if existing!=p: raise ContractError("Project identity conflict; no overwrite")
        return None
    body={"message":"Register public ARTEMIS API project "+p["project_id"],"branch":BRANCH,
          "content":base64.b64encode(json.dumps(p,ensure_ascii=False).encode()).decode()}
    try:
        return call("PUT","/contents/"+path,body,token=token)
    except Exception:
        # Never blindly repeat an uncertain PUT.
        existing=read_json(path,call=call,token=token)
        if existing==p: return None
        raise

def verified_answer(state, csv_bytes):
    if state.get("status")!="complete" or state.get("provider")!="hitel" or state.get("total")!=1 or state.get("verified_ai_completed")!=1 or state.get("mock_completed")!=0:
        raise ContractError("Original API has not verified one real AI result")
    rows=state.get("results")
    if not isinstance(rows,list) or len(rows)!=1 or rows[0].get("record_id")!="turn-1" or not isinstance(rows[0].get("answer"),str):
        raise ContractError("Original result identity/schema mismatch")
    if csv_bytes is None: raise ContractError("Original results.csv missing")
    exported=list(csv.DictReader(io.StringIO(csv_bytes.decode("utf-8-sig"))))
    if len(exported)!=1 or exported[0].get("record_id")!="turn-1" or exported[0].get("answer")!=rows[0]["answer"]:
        raise ContractError("Original CSV and state differ")
    return rows[0]["answer"]

def complete(prompt, *, timeout=145, call=api, sleep=time.sleep, clock=time.monotonic):
    task=approved_task()
    token=os.environ["GH_TOKEN"]
    run=os.environ.get("GITHUB_RUN_ID") or os.environ.get("ARTEMIS_REQUEST_ID")
    if not run: raise ContractError("Stable run/request ID required")
    p=project_for(prompt,task,run)
    registration=register(p,call=call,token=token)
    pid=p["project_id"]; prefix="universal/state/"+pid+"/"
    print("Original API project: "+pid,flush=True)
    deadline=clock()+timeout
    seen=set(); dispatched=False; began=clock()
    while clock()<deadline:
        state=read_json(prefix+"state.json",call=call,token=token)
        events=read_json(prefix+"events.json",call=call,token=token)
        for item in (events or {}).get("events",[]):
            payload=item.get("payload",{}); event_id=payload.get("event_id")
            if event_id and event_id not in seen:
                seen.add(event_id); print("Original API event: "+str(payload.get("event")),flush=True)
        if state:
            status=state.get("status")
            print("Original API status: "+str(status),flush=True)
            if status=="complete":
                return verified_answer(state,file_bytes(prefix+"results.csv",call=call,token=token))
            if status in ("blocked","paused"): raise ContractError("Original API project "+str(status)+"; review its state")
        elif registration and not dispatched and clock()-began>=30:
            # Only check the documented workflow; dispatch at most once if no push run is visible.
            commit=(registration.get("commit") or {}).get("sha")
            if not commit: raise ContractError("Registration commit identity unavailable")
            runs=call("GET","/actions/workflows/universal-ai.yml/runs?"+urlencode({"branch":BRANCH,"per_page":20}),token=token)
            if runs is None: raise ContractError("Original workflow access unavailable")
            if not any(v.get("head_sha")==commit for v in runs.get("workflow_runs",[])):
                dispatched=True
                call("POST","/actions/workflows/universal-ai.yml/dispatches",{"ref":BRANCH,"inputs":{"handoff":pid,"depth":"0"}},token=token)
            else: dispatched=True
        sleep(min(10,max(0,deadline-clock())))
    raise TimeoutError("Original API project pending: "+pid+"; poll the same project, do not resubmit")
