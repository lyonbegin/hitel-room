"""Client of the original HITEL Universal API; no server, engine or direct relay calls."""
import base64, csv, hashlib, io, json, os, re, time
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError

REPO = "lyonbegin/hitel-scribd-runner"
BRANCH = "feature/hitel-universal-ai-ui-api-20261127"
BASE = "https://api.github.com/repos/" + REPO
REF = "?ref=" + quote(BRANCH, safe="")
ID = re.compile(r"^[a-z][a-z0-9-]{2,63}$")
class ContractError(ValueError): pass
class ApprovalError(PermissionError): pass
class ProjectRejected(ContractError): pass
class ProjectPending(TimeoutError):
    def __init__(self, project_id):
        self.project_id=project_id
        super().__init__("Original API project pending: "+project_id+"; resume the same project; do not resubmit")
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def log_text(response):
    raw=response.read(10_000_001)
    if len(raw)>10_000_000: raise ContractError("Original run log exceeds review limit")
    return raw.decode("utf-8",errors="replace")

def api(method, path, body=None, token=None):
    headers = {"Accept":"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"}
    if token: headers["Authorization"]="Bearer "+token
    req=Request(BASE+path, data=None if body is None else json.dumps(body,ensure_ascii=False).encode(), headers=headers, method=method)
    is_log=method=="GET" and re.fullmatch(r"/actions/jobs/\d+/logs",path)
    try:
        with build_opener(NoRedirect()).open(req,timeout=45) as r:
            if is_log: return log_text(r)
            raw=r.read()
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        if is_log and exc.code in (301,302,303,307,308):
            dest=exc.headers.get("Location","")
            if urlsplit(dest).scheme!="https" or not urlsplit(dest).hostname:
                raise ContractError("Invalid original log redirect")
            # Signed storage URL is fetched WITHOUT the GitHub Authorization header.
            with urlopen(Request(dest),timeout=45) as r: return log_text(r)
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

def client_task():
    # Validate input and GitHub transport only; original Actions/server own live approval.
    task=os.environ.get("task_id","")
    if not ID.fullmatch(task) or task=="scribd-18109":
        raise ApprovalError("Supply the original API task_id approved for this work")
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
    raw=json.dumps(p,ensure_ascii=False).encode()
    if len(raw)>850000: raise ContractError("Original API project size limit exceeded")
    body={"message":"Register public ARTEMIS API project "+p["project_id"],"branch":BRANCH,
          "content":base64.b64encode(raw).decode()}
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

def rejection_in_log(log, pid):
    if not isinstance(log,str): return None
    marker=re.compile(r"(?:^|\s)PROJECT_REJECTED\s+"+re.escape(pid)+r"(?:\s|$)([^\r\n]*)")
    found=marker.search(log)
    if not found: return None
    reason=found.group(1).strip()
    # Print a fixed diagnostic rather than arbitrary original logs or prompt data.
    return "operator live approval missing" if reason.startswith("operator live approval missing") else "project rejected; inspect original run log"

def inspect_runs(pid, *, call, token, commit=None, inspected=None, run_id=None):
    inspected=inspected if inspected is not None else set()
    if run_id is not None:
        if not str(run_id).isdigit(): raise ContractError("Invalid original run ID")
        item=call("GET","/actions/runs/"+str(run_id),token=token)
        runs=[item] if item else []
    else:
        listing=call("GET","/actions/workflows/universal-ai.yml/runs?"+urlencode({"branch":BRANCH,"per_page":20}),token=token)
        if listing is None: raise ContractError("Original workflow run listing unavailable")
        runs=listing.get("workflow_runs",[])
    matched=False
    for run in runs:
        if run.get("head_branch")!=BRANCH or run.get("path","").split("@")[0]!=".github/workflows/universal-ai.yml":
            continue
        exact=(commit and run.get("head_sha")==commit) or run.get("display_title")=="HITEL Universal "+pid or run_id is not None
        matched=matched or bool(exact)
        if run.get("status")!="completed": continue
        # On resume, the original run may be a watchdog handoff, not the initial commit.
        # Read only recent completed source jobs; reject only an exact project marker.
        key=(run["id"],run.get("run_attempt",1))
        if key in inspected: continue
        if not exact and commit is not None: continue
        jobs=call("GET","/actions/runs/"+str(run["id"])+"/jobs",token=token)
        if jobs is None: continue
        available=True
        for job in jobs.get("jobs",[]):
            if job.get("name")!="run": continue
            log=call("GET","/actions/jobs/"+str(job["id"])+"/logs",token=token)
            if log is None:
                available=False
                continue
            rejection=rejection_in_log(log,pid)
            if rejection:
                raise ProjectRejected("Original API PROJECT_REJECTED "+pid+": "+rejection+"; run="+str(run["id"]))
        if available: inspected.add(key)
    return matched

def wait_project(pid, *, timeout=1200, call=api, token=None, sleep=time.sleep, clock=time.monotonic,
                 registration=None, run_id=None):
    if not ID.fullmatch(pid): raise ContractError("Invalid original project ID")
    prefix="universal/state/"+pid+"/"
    print("Original API project: "+pid,flush=True)
    deadline=clock()+timeout
    seen=set(); inspected=set(); dispatch_attempted=False; began=clock()
    commit=(registration.get("commit") or {}).get("sha") if registration else None
    absent_checks=0; next_runs=0
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
            if status in ("blocked","paused"):
                raise ContractError("Original API project "+str(status)+"; inspect original state.error and events")
        elif clock()>=next_runs:
            # The original engine can reject before writing state.json.
            # Missing log permissions are explicitly distinguishable from pending.
            try:
                observed=inspect_runs(pid,call=call,token=token,commit=commit,inspected=inspected,run_id=run_id)
            except HTTPError as exc:
                if exc.code in (401,403,429):
                    raise ContractError("Original Actions/log access unavailable; project state not yet present") from exc
                raise
            next_runs=clock()+30
            absent_checks=0 if observed else absent_checks+1
            if commit and not observed and not dispatch_attempted and absent_checks>=2 and clock()-began>=30:
                dispatch_attempted=True
                try:
                    call("POST","/actions/workflows/universal-ai.yml/dispatches",{"ref":BRANCH,"inputs":{"handoff":pid,"depth":"0"}},token=token)
                    print("Original API dispatch submitted; not completion",flush=True)
                except (OSError,TimeoutError):
                    print("Original API dispatch uncertain; lookup only; no repeat POST",flush=True)
        sleep(min(10,max(0,deadline-clock())))
    raise ProjectPending(pid)

def complete(prompt, *, timeout=1200, call=api, sleep=time.sleep, clock=time.monotonic):
    task=client_task()
    token=os.environ["GH_TOKEN"]
    request=os.environ.get("ARTEMIS_REQUEST_ID","")
    if not re.fullmatch(r"[a-zA-Z0-9-]{8,64}",request):
        raise ContractError("Stable ARTEMIS_REQUEST_ID required; reuse it on resume")
    p=project_for(prompt,task,request)
    registration=register(p,call=call,token=token)
    return wait_project(p["project_id"],timeout=timeout,call=call,token=token,sleep=sleep,clock=clock,registration=registration)

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser(description="Resume an existing original HITEL project (GET only)")
    parser.add_argument("project_id")
    parser.add_argument("--run-id")
    parser.add_argument("--timeout",type=int,default=1200)
    args=parser.parse_args()
    # Does not register, dispatch, request approval, or require task_id.
    print(wait_project(args.project_id,run_id=args.run_id,timeout=args.timeout,token=os.getenv("GH_TOKEN")))
