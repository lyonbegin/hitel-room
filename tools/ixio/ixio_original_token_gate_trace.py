#!/usr/bin/env python3
"""Isolated QA bytecode markers for ORIGINAL IXIO token interceptor.

Only adds fixed-label Log.i events to entry/exit of existing token middleware
and the DataStore token read. Does not change any predicates, tokens, headers,
URLs, server responses, crypto, model worker or recorder code.
"""
from __future__ import annotations
import argparse,hashlib,json,re
from pathlib import Path

TOKEN="com/lguplus/aicallagent/network/interceptor/ixio/IxITokenInterceptor.smali"
CORO="com/lguplus/aicallagent/network/interceptor/ixio/IxITokenInterceptor$intercept$1.smali"
STORE="com/lguplus/aicallagent/datastore/DatastoreHandler.smali"
AUTH="com/lguplus/aicallagent/network/authenticator/IxIAuthenticator.smali"
PROBE="com/lguplus/aicallagent/network/interceptor/ixio/HitelTokenGateTrace.smali"
DESC="L"+PROBE[:-6]+";"
M=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
EVENTS={
 0:"TOKEN_INTERCEPT_ENTER",
 1:"TOKEN_BEFORE_RUNBLOCKING",
 2:"TOKEN_AFTER_RUNBLOCKING_RESPONSE_RETURNED",
 3:"TOKEN_COROUTINE_INVOKE_ENTER",
 4:"TOKEN_BEFORE_DATASTORE_GET_TOKEN",
 5:"TOKEN_GET_TOKEN_CALL_RETURNED_OR_SUSPENDED",
 6:"TOKEN_DATASTORE_RESULT_READY_FOR_VALIDATION",
 7:"TOKEN_ORIGINAL_CHAIN_PROCEED",
 8:"DATASTORE_GET_TOKEN_ENTER",
 9:"TOKEN_BEFORE_MUTEX_LOCK",
 10:"TOKEN_MUTEX_CALL_RETURNED_OR_SUSPENDED",
 11:"TOKEN_MUTEX_ACQUIRED",
 12:"TOKEN_BEFORE_DATASTORE_GET_TYPE",
 13:"TOKEN_GET_TYPE_CALL_RETURNED_OR_SUSPENDED",
 14:"TOKEN_TYPE_READY",
 15:"TOKEN_BEFORE_EXPIRY_CHECK",
 16:"TOKEN_EXPIRY_CHECK_RETURNED",
 17:"TOKEN_EMPTY_BRANCH",
 18:"TOKEN_NONEMPTY_BRANCH",
 19:"TOKEN_BEFORE_ORIGINAL_AUTOLOGIN",
 20:"TOKEN_AUTOLOGIN_CALL_RETURNED_OR_SUSPENDED",
 21:"TOKEN_AUTOLOGIN_RESULT_READY",
 22:"TOKEN_UNEXPIRED_BRANCH",
 23:"TOKEN_ORIGINAL_EXCEPTION_UNLOCK",
 24:"TOKEN_ORIGINAL_CHAIN_RESPONSE_RETURNED",
 25:"ORIGINAL_AUTHENTICATOR_ENTER",
 26:"ORIGINAL_AUTHENTICATOR_CUSTOM_REQUEST_ENTER",
 27:"ORIGINAL_AUTHENTICATOR_REFRESH_TOKEN_ENTER"
}
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def mk(n):return f"    invoke-static {{}}, {DESC}->m{n}()V"
def meth(src,name):
    arr=[m for m in M.finditer(src) if re.search(r'(?<![\w$])'+re.escape(name)+r'\(',m.group().splitlines()[0])]
    if len(arr)!=1:raise RuntimeError(f"expected one {name} method; got {len(arr)}")
    return arr[0]
def inject(p,name,fn):
    s=p.read_text();m=meth(s,name);old=m.group();new=fn(old)
    if old==new or old.splitlines()[0]!=new.splitlines()[0]:
        raise RuntimeError(f"Bad or missing instrumentation {p}:{name}")
    p.write_text(s[:m.start()]+new+s[m.end():])
    return {"file":str(p),"method":name,"old_sha256":sha(old),"new_sha256":sha(new)}
def insert_at_opcode(b,n):
    ls=b.splitlines(keepends=True)
    for i,line in enumerate(ls):
        t=line.strip()
        if t.startswith((".",":","#")) or not t:continue
        if re.match(r"^(invoke-|move-|iget|sget|const|instance-of|new-instance|return-|check-cast|if-)",t):
            ls.insert(i,mk(n)+"\n")
            return "".join(ls)
    raise RuntimeError("no initial opcode")
def require_once_replace(block,old,new,label):
    n=block.count(old)
    if n!=1:raise RuntimeError(f"{label} expected once, found {n}")
    return block.replace(old,new,1)
def new_class():
    lines=[f".class public final {DESC}",".super Ljava/lang/Object;","",
         ".method public constructor <init>()V",
         "    .registers 1",
         "    invoke-direct {p0}, Ljava/lang/Object;-><init>()V",
         "    return-void",".end method"]
    for i,label in EVENTS.items():
        lines+=["",f".method public static m{i}()V","    .registers 2",
           '    const-string v0, "IXIO_TOKEN_TRACE"',
           "    const-string v1, "+json.dumps(label),
           "    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I",
           "    return-void",".end method"]
    return "\n".join(lines)+"\n"
def tracer_intercept(b):
    b=insert_at_opcode(b,0)
    rx=re.compile(r"(?m)^[ \t]*invoke-static[^\n]*Lkotlinx/coroutines/BuildersKt;->runBlocking[^\n]*\n(?:[ \t]*\n)*[ \t]*move-result-object[ \t]+[vp]\d+")
    matched=list(rx.finditer(b))
    if len(matched)!=1:raise RuntimeError(f"runBlocking expression expected once, found {len(matched)}")
    m=matched[0]
    return b[:m.start()]+mk(1)+"\n"+m.group()+"\n"+mk(2)+b[m.end():]
def tracer_coroutine(b):
    b=insert_at_opcode(b,3)
    # Exact original token datastore method call and its suspended-value return.
    token_call=re.compile(r"(?m)^[ \t]*invoke-virtual[^\n]*IxIDataStoreRepository;->getTokenData[^\n]*\n(?:[ \t]*\n)*[ \t]*move-result-object[ \t]+[vp]\d+")
    hits=list(token_call.finditer(b))
    if len(hits)!=1:raise RuntimeError(f"original getTokenData call expected once, found {len(hits)}")
    m=hits[0]
    b=b[:m.start()]+mk(4)+"\n"+m.group()+"\n"+mk(5)+b[m.end():]
    label=re.compile(r"(?m)^    :goto_103[ \t]*$")
    if len(list(label.finditer(b)))!=1:raise RuntimeError("model token result label unexpected")
    b=label.sub("    :goto_103\n"+mk(6),b,count=1)
    # All four original branches, including the v2 chain used by nonempty
    # tokens. The previous restricted expression missed both v2 branches.
    matches=list(re.finditer(r"(?m)^    invoke-interface \{[vp]\d+, [vp]\d+\}, Lokhttp3/Interceptor\$Chain;->proceed\(Lokhttp3/Request;\)Lokhttp3/Response;\n(?:[ \t]*\n)*    move-result-object [vp]\d+",b))
    if len(matches)!=4:raise RuntimeError(f"expected 4 original proceed branches, got {len(matches)}")
    for m in reversed(matches):
        b=b[:m.start()]+mk(7)+"\n"+m.group()+"\n"+mk(24)+b[m.end():]
    # Keep invoke/move-result adjacency and coroutine suspension predicates.
    for target,before,after in (
        (r"invoke-interface[^\n]*Lkotlinx/coroutines/sync/Mutex;->lock\(",9,10),
        (r"invoke-virtual[^\n]*IxIDataStoreRepository;->getTokenType\(",12,13),
        (r"invoke-static[^\n]*IxITokenInterceptorKt;->isTokenExpired\(",15,16),
        (r"invoke-interface[^\n]*IxIOAuthApi;->postAutoLogin\(",19,20),
    ):
        rx=re.compile(r"(?m)^    "+target+r"[^\n]*\n(?:[ \t]*\n)*    move-result-object [vp]\d+")
        hits=list(rx.finditer(b))
        if len(hits)!=1:raise RuntimeError(f"expected one original call {target}, found {len(hits)}")
        m=hits[0]
        b=b[:m.start()]+mk(before)+"\n"+m.group()+"\n"+mk(after)+b[m.end():]
    for label,event in (("goto_cd",11),("goto_14c",14),
                        ("try_start_10b",17),("try_start_123",18),
                        ("goto_1bc",21),("try_start_20a",22),("goto_24c",23)):
        rx=re.compile(r"(?m)^    :"+label+r"[ \t]*$")
        if len(list(rx.finditer(b)))!=1:raise RuntimeError(f"expected original label {label}")
        b=rx.sub(lambda m:m.group()+"\n"+mk(event),b,count=1)
    return b
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--smali16",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    a=p.parse_args();root=a.smali16
    for rel in [TOKEN,CORO,STORE,AUTH]:
        if not (root/rel).is_file():raise RuntimeError("original missing "+rel)
    outroot=root/PROBE
    if outroot.exists():raise RuntimeError("already installed token trace")
    changes=[
      inject(root/TOKEN,"intercept",tracer_intercept),
      inject(root/CORO,"invokeSuspend",tracer_coroutine),
      inject(root/STORE,"getTokenData",lambda b:insert_at_opcode(b,8)),
      inject(root/AUTH,"authenticate",lambda b:insert_at_opcode(b,25)),
      inject(root/AUTH,"getCustomRequest",lambda b:insert_at_opcode(b,26)),
      inject(root/AUTH,"refreshToken",lambda b:insert_at_opcode(b,27))
    ]
    outroot.parent.mkdir(parents=True,exist_ok=True)
    outroot.write_text(new_class())
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({
      "mode":"EXISTING_ORIGINAL_TOKEN_INTERCEPTOR_EXECUTION_MARKERS_ONLY",
      "changes":changes,"events":EVENTS,
      "original_header_and_token_values_logged":False,
      "request_url_headers_body_and_cryptography_unchanged":True,
      "original_downloader_stt_recorder_unchanged":True,
      "test_only":True
    },ensure_ascii=False,indent=2))
    print("ORIGINAL_TOKEN_GATE_TRACE_HOOKED=YES",len(changes),flush=True)
if __name__=="__main__":main()
