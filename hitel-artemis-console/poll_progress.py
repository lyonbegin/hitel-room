"""Report the real mission job, not the monitoring job. No prompts, secrets or results copied."""
import json
import os
import time
import urllib.request
from urllib.error import HTTPError, URLError

repo = os.environ["GITHUB_REPOSITORY"]
run_id = os.environ["GITHUB_RUN_ID"]
issue = os.environ["REPORT_ISSUE"]
attempt = os.environ.get("GITHUB_RUN_ATTEMPT","1")
base = "https://api.github.com/repos/" + repo
url = "https://github.com/" + repo + "/actions/runs/" + run_id

def api(path, body=None):
    req = urllib.request.Request(base+path, data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization":"Bearer "+os.environ["GH_TOKEN"],"Accept":"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},
        method="GET" if body is None else "POST")
    with urllib.request.urlopen(req,timeout=20) as response:
        return json.load(response)

def snapshot(jobs):
    job = next((j for j in jobs if j.get("name")=="mission"),None)
    if not job:
        return ("queued",None,()), "실행 서버 배정 대기 중"
    steps = tuple((s["name"],s["status"],s.get("conclusion")) for s in job.get("steps",[]))
    lines = ["작업: "+job["status"]+((" / "+job["conclusion"]) if job.get("conclusion") else "")]
    for name,status,conclusion in steps:
        if status!="pending":
            lines.append("- "+name+": "+(conclusion or status))
    if job.get("status")=="completed":
        preflight = next((s for s in steps if s[0].startswith("Check live Web2 task approval")),None)
        live = next((s for s in steps if s[0].startswith("Run approved HITEL-backed")),None)
        if preflight and preflight[2]=="failure":
            lines.append("실제 AI 연결 차단: 신규 작업 승인 또는 실행 환경 미충족. 실제 API 요청 없음.")
        elif live and live[2]=="success":
            lines.append("실제 텍스트 계획 단계 성공. 기기 동작 검증은 범위 제외.")
        else:
            lines.append("실제 AI 성공 증거 없음.")
    return (job["status"],job.get("conclusion"),steps),"\n".join(lines)

def report(message):
    text="**ARTEMIS 진행 보고 · 실행 "+run_id+" / 시도 "+attempt+"**\n\n"+message+"\n\n[실행 원문]("+url+")"
    print(text,flush=True)
    try:
        api("/issues/"+issue+"/comments",{"body":text})
    except (HTTPError,URLError,TimeoutError) as exc:
        # Do not retry an uncertain comment POST; logs remain available.
        print("Issue progress delivery failed: "+type(exc).__name__,flush=True)
        return False
    return True

if __name__=="__main__":
    if repo!="lyonbegin/hitel-room" or issue!="17":
        raise SystemExit("Unexpected report destination")
    target=api("/issues/"+issue)
    if target.get("user",{}).get("login")!="lyonbegin" or target.get("state")!="open":
        raise SystemExit("Report issue is not approved/open")
    report("폴링 시작: 10초 간격, 단계 변경 즉시 보고, 60초마다 heartbeat.")
    deadline=time.monotonic()+30*60
    last=None
    last_report=0
    errors=0
    while time.monotonic()<deadline:
        try:
            state,message=snapshot(api("/actions/runs/"+run_id+"/attempts/"+attempt+"/jobs?per_page=100")["jobs"])
            errors=0
        except (HTTPError,URLError,TimeoutError,KeyError) as exc:
            errors+=1
            print("Poll failed: "+type(exc).__name__,flush=True)
            if errors>=5:
                report("상태 조회 5회 연속 실패. 실행 원문 확인 필요.")
                raise SystemExit(1)
            time.sleep(10)
            continue
        now=time.monotonic()
        if state!=last or now-last_report>=60:
            report(message)
            last,last_report=state,now
        if state[0]=="completed":
            raise SystemExit(0)
        time.sleep(10)
    report("모니터 제한 시간 도달: 최종 결과 미확인.")
    raise SystemExit(1)
