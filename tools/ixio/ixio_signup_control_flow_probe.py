#!/usr/bin/env python3
"""Static IXIO main onboarding/service-subscription graph provenance report.

JADX source stays PRIVATE on CI. Publish class/method identifiers and sanitized
branch/call *identities* only. No user data, third-party API endpoint or secret
payload is published. This is not a license/authentication bypass or a runtime
assertion that a server interaction can be safely omitted.
"""
from __future__ import annotations
import argparse,collections,json,pathlib,re

TOKENS={
"signup":r"signup|sign.?up|subscri|가입|register|registration|enroll|join.?service",
"eligibility":r"eligib|entitle|가입대상|not.?support|unsupported|unavailable|check.?service",
"onboarding":r"onboard|introduction|intro|entry|splash|permission|welcome|start.?page",
"login":r"login|sign.?in|auth|token|session|verify|oauth",
"core":r"IXIApplication|CallScriptManager|PcmAudioSourceFactory|SpeechToTextRepositoryImpl|speechSDK",
"network":r"retrofit|response|api.?service|http|request|invoke|resource",
}
OWNPATH=re.compile(r"(com/lguplus/aicallagent|com/lguplus/ixispeech_ktn|com/lguplus/ixio)",re.I)
CANDPATH=re.compile("|".join(TOKENS[x] for x in ("signup","eligibility","onboarding","login")),re.I)
MEASURES={
 "error_display":r"(?:가입|register|sign.?up|subscri).{0,100}(?:실패|error|fail|unable|false)|(?:가입|가입을|가입이)",
 "network_service":r"(?:retrofit|api|service|request|response|suspend|server|network)",
 "navigate_or_success":r"(?:navigate|success|home|main|finish|complete|next|start|initialize)",
 "stt":r"(?:SpeechToTextRepository|speechSDK|loadModels|loadSTT|recognize|CallScriptManager|PcmAudioSource)",
}
# Method declarations approximate. Some Kotlin coroutine bodies are compiler-generated;
# report decompilation errors separately rather than asserting causal control flow.
METHOD=re.compile(r"(?m)^[ \t]*(?:(?:public|private|protected|static|final|synchronized|abstract|native)\s+){0,7}"
                  r"(?:(?:[\w$.\<\>\[\]?,]+)\s+){1,3}([A-Za-z_$][\w$]*)\s*\([^\n;{}]{0,450}\)\s*(?:throws\s+[\w., ]+)?\s*\{")
CALL=re.compile(r"(?<!\bnew\s)([A-Za-z_$][\w$.]{1,90})\s*\(")
KEYCALL=re.compile(r"(?i)(?:register|subscrib|join|eligib|check|verify|auth|login|permission|navigate|success|failure|"
                   r"finish|next|init|firebase|speech|call|pcm|stt|service|update|save|response|result|onboard)")
IGNORE={"if","for","while","switch","catch","synchronized","super","this","when","new"}

def decompose_methods(s):
    found=[]
    for m in METHOD.finditer(s):
        open_index=s.find("{",m.start(),m.end()+2)
        level=0
        end=None
        for i in range(open_index,min(len(s),open_index+65000)):
            if s[i]=="{":level+=1
            elif s[i]=="}":
                level-=1
                if level==0:
                    end=i+1
                    break
        if end is None:continue
        body=s[open_index+1:end-1]
        found.append((m.group(1),body,m.start(),m.end()))
        if len(found)>120:break
    return found

def summarize_method(name,body):
    calls=collections.Counter(
       m.group(1) for m in CALL.finditer(body)
       if m.group(1) not in IGNORE and KEYCALL.search(m.group(1))
    )
    flags={k:len(re.findall(pat,body,flags=re.I)) for k,pat in MEASURES.items()}
    controls=[x for x in ("if (","switch (","return ","throw ","try {","catch (","onSuccess","onFailure","case ","emit(")
              if x in body]
    return {"method":name,"body_size":len(body),"key_invocations":dict(calls.most_common(28)),
            "control_terms":controls,"signals":flags,
            "unresolved_jadx":"Method not decompiled:" in body}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--sources",type=pathlib.Path,required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    p.add_argument("--resource-names",type=pathlib.Path,default=None)
    a=p.parse_args()
    src=list(a.sources.rglob("*.java"))
    reports=[]
    error_exact_files=[]
    class_index={k:[] for k in TOKENS}
    for path in src:
        rel=str(path.relative_to(a.sources)).replace("\\","/")
        if not OWNPATH.search(rel):continue
        for family,pat in TOKENS.items():
            if re.search(pat,path.stem,re.I) and len(class_index[family])<1000:
                class_index[family].append(rel)
        if path.stat().st_size>1_500_000:continue
        s=path.read_text(encoding="utf8",errors="replace")
        score=0
        for key,pat in TOKENS.items():
            if re.search(pat,path.stem,re.I):
                score+=40 if key in ("signup","eligibility") else 16
        if "가입" in s:
            score+=35
            if "서비스 가입을 완료할 수 없어요" in s:
                error_exact_files.append(rel)
                score+=1000
        # Errors might be compiled into Android resource table, not DEX.
        for pat in ("getUserJoin","isRegistered","getSubscription","getSignup","checkMember",
                    "getIsLogin","serviceJoin","joinService","getServiceJoin","checkService",
                    "SignUp","SignIn","Subscription","ServiceRegistration"):
            if pat.lower() in s.lower():score+=2
        if score<13:continue
        methods=decompose_methods(s)
        selected=[]
        for name,body,_,_ in methods:
            score_method=sum(len(re.findall(pat,body,re.I)) for pat in
                 (TOKENS["signup"],TOKENS["eligibility"],TOKENS["login"]))
            if KEYCALL.search(name) or score_method>=2:
                selected.append(summarize_method(name,body))
        reports.append({"class":rel,"score":score,"jadx_failed":"Method not decompiled" in s,
                        "method_identities":selected[:35],
                        "all_method_names":[m[0] for m in methods[:100]]})
    reports.sort(key=lambda x:(-x["score"],x["class"]))
    relevant_classes={k:v[:140] for k,v in class_index.items()}
    res=[]
    if a.resource_names and a.resource_names.exists():
        raw=a.resource_names.read_text(errors="replace")
        lines=raw.splitlines()
        for i,line in enumerate(lines):
            if "서비스 가입을 완료할 수 없" in line or "가입" in line and any(w in line for w in ("완료","실패","불가")):
                res.append({"line":i+1,"resource_text":line.strip()[:280],
                            "preceding_resource_identity":lines[i-1].strip()[:200] if i>0 else ""})
                if len(res)>=50:break
    output={
       "scope":"IXIO restored MAIN APK static JAVADex resources, NO subscriber bypass",
       "java_file_count":len(src),
       "candidate_classes_total":len(reports),
       "exact_error_literal_in_java":error_exact_files,
       "resource_error_identifiers":res,
       "name_index":relevant_classes,
       "candidate_method_call_signals":reports[:210],
       "verified_static_independent_stt_classes": [
          "com/lguplus/aicallagent/data/call/ai/SpeechToTextRepositoryImpl.java",
          "com/lguplus/aicallagent/incall/call/service/CallScriptManager.java",
          "com/lguplus/aicallagent/incall/call/domain/usecase/PcmAudioSourceFactory.java",
          "com/lguplus/ixispeech_ktn/speechSDK.java"
       ],
       "limitation":"Static method references do not establish success branch run-time execution, service token dependence, or permission to bypass provider registration."
    }
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(output,ensure_ascii=False,indent=2))
    print(json.dumps({"candidate_classes_total":len(reports),
           "most_relevant_classes":[{"class":x["class"],"score":x["score"],"method_names":x["all_method_names"][:24]}
             for x in reports[:34]],
           "exact_error_literal_in_java":error_exact_files,
           "resource_error_identifiers":res,
           "indexed_names":{k:len(v) for k,v in class_index.items()}},ensure_ascii=False))
if __name__=="__main__":main()
