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
 8:"DATASTORE_GET_TOKEN_ENTER"
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
    target=("    invoke-static {v0, v1}, Lkotlinx/coroutines/BuildersKt;"
            "->runBlocking(Lkotlin/coroutines/CoroutineContext;Lkotlin/jvm/functions/Function2;)Ljava/lang/Object;\n"
            "    move-result-object p0")
    b=require_once_replace(b,target,mk(1)+"\n"+target+"\n"+mk(2),"runBlocking")
    return b
def tracer_coroutine(b):
    b=insert_at_opcode(b,3)
    # Exact original token datastore method call and its suspended-value return.
    q=("    invoke-virtual {v14, v0}, "
       "Lcom/lguplus/aicallagent/datastore/IxIDataStoreRepository;"
       "->getTokenData(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;\n"
       "    move-result-object v6")
    b=require_once_replace(b,q,mk(4)+"\n"+q+"\n"+mk(5),"getTokenData")
    t=("    :goto_103\n"
       "    :try_start_103\n"
       "    check-cast v6, Lcom/lguplus/aicallagent/model/api/dto/ixio/userservice/InnerTokenData;")
    b=require_once_replace(b,t,"    :goto_103\n"+mk(6)+"\n"
             "    :try_start_103\n"
             "    check-cast v6, Lcom/lguplus/aicallagent/model/api/dto/ixio/userservice/InnerTokenData;",
             "model token result branch")
    # Before original chain.proceed invoked; token/header values never logged.
    matches=list(re.finditer(r"(?m)^    invoke-interface \{v(?:11|12), v(?:0|13)\}, Lokhttp3/Interceptor\$Chain;->proceed\(Lokhttp3/Request;\)Lokhttp3/Response;",b))
    if len(matches)<2:raise RuntimeError(f"expected >=2 original proceed branches, got {len(matches)}")
    # Add marker to each EXACT existing chain.proceed instruction. Native control flow unchanged.
    for m in reversed(matches):
        b=b[:m.start()]+mk(7)+"\n"+b[m.start():]
    return b
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--smali16",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    a=p.parse_args();root=a.smali16
    for rel in [TOKEN,CORO,STORE]:
        if not (root/rel).is_file():raise RuntimeError("original missing "+rel)
    outroot=root/PROBE
    if outroot.exists():raise RuntimeError("already installed token trace")
    changes=[
      inject(root/TOKEN,"intercept",tracer_intercept),
      inject(root/CORO,"invokeSuspend",tracer_coroutine),
      inject(root/STORE,"getTokenData",lambda b:insert_at_opcode(b,8))
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
