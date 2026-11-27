"""Validate a repository secret without logging it; select a working text model."""
import json, os, sys, urllib.request, urllib.error
from pathlib import Path
key=os.environ.get("GEMINI_API_KEY","")
out=Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=True)
def call(path, body=None):
    req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/"+path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"x-goog-api-key":key,"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req,timeout=45) as r:
            return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        return e.code,{}
    except (OSError,ValueError):
        return 0,{}
if not key:
    print("GEMINI_API_KEY is missing")
    sys.exit(2)
status, data=call("models?pageSize=1000")
if status!=200:
    print("Gemini list models HTTP status:",status)
    sys.exit(3)
available={x["name"].removeprefix("models/") for x in data.get("models",[]) if "generateContent" in x.get("supportedGenerationMethods",[])}
candidates=["gemini-3.8-flash","gemini-3.7-flash","gemini-3.1-flash-lite","gemini-3.5-flash-lite","gemini-4-hydrogen","gemini-2.5-flash","gemini-2.5-flash-lite"]
attempts={}
chosen=None
for model in candidates:
    if model not in available: continue
    code,result=call("models/"+model+":generateContent",{"contents":[{"parts":[{"text":"Reply only with OK."}]}],"generationConfig":{"maxOutputTokens":128}})
    attempts[model]=code
    if code==200 and any(part.get("text") for c in result.get("candidates",[]) for part in c.get("content",{}).get("parts",[])):
        chosen=model
        break
er="gemini-robotics-er-2-preview"
er_listed=er in available
report={"list_models_http_status":status,"candidate_attempts":attempts,"chosen_model":chosen,"robotics_er_listed":er_listed}
(out/"gemini-preflight.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report))
if not chosen: sys.exit(4)
# Only alter the disposable ARTEMIS checkout, never the pinned source repo or the key.
from third_party.mobile_use.utils.file import load_jsonc
config=Path("config/artemis.jsonc")
with config.open() as stream: data=load_jsonc(stream)
def replace(obj):
    if isinstance(obj,dict):
        for k,v in obj.items():
            if k=="model" and isinstance(v,str) and v.startswith("gemini-"):
                obj[k]=er if v==er and er_listed else chosen
            else: replace(v)
    elif isinstance(obj,list):
        for v in obj: replace(v)
replace(data)
# Pro Explorer uses UI tree and multimodal reasoning; no ER quota assumption.
data["agent"]["pro"]["explorer"]["mode"]="pro"
data["agent"]["flash"]["explorer_mode"]="pro"
data["agent"]["explorer"]["default_version"]="pro"
config.write_text(json.dumps(data,indent=2))
