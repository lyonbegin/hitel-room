#!/usr/bin/env python3
"""Insert observations at recovered original call boundaries, not replacement logic.

Every insertion calls a generated fail-closed logger. No original instruction,
register declaration, result, label or exception handler is rewritten. A full
site map and an exact strip-and-compare proof accompany each rebuilt APK.
"""
from __future__ import annotations
import argparse, hashlib, json, re, shutil
from collections import Counter
from pathlib import Path

METHOD = re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
PREFIX = 'com/lguplus/aicallagent/'
TRACE = 'Lcom/lguplus/aicallagent/hitelqa/DiagTrace;'
FOCUS = re.compile(
    r'(?:^|/)(?:SettingViewModel|DownloadViewModel|CallRecord\w*ViewModel|'
    r'Record\w*ViewModel|InCallAiSettingViewModel|SpamAiAutoAnswer\w*ViewModel|'
    r'AntiPhishing\w*ViewModel|AiModelUpdateRepositoryImpl|AiModelRepositoryImpl|'
    r'UpdateAiModelUseCaseImpl|CheckAiModelAvailabilityUseCaseImpl|'
    r'CheckRecordingAvailabilityUseCaseImpl|CallRecordingSettingRepositoryImpl|'
    r'CallRecordingManager|RecordRepository|AiModelDownloadServiceManagerImpl|'
    r'DownloadWorker|FileUnzipWorker|AiEngine\w*|\w*SttManager)(?:\$|\.smali$)')
GENERATED = re.compile(r'(?:_Factory|_HiltModules|_MembersInjector|_AssistedFactory|\$WhenMappings)')
SKIP_METHOD = re.compile(r'^(?:<init>|<clinit>|component\d+|copy(?:\$default)?|equals|hashCode|toString|getStable|access\$get|access\$set)')
CALL = re.compile(r'^invoke-\S+ \{[^}]*\}, (?P<owner>L[^;]+;)->(?P<name>[^ (]+)\((?P<args>[^)]*)\)(?P<result>\S+)')
REG = re.compile(r'^[vp]\d+$')
PROBE_CALL = re.compile(r'^invoke-static(?:/range)? \{[^\n]*\}, Lcom/lguplus/aicallagent/hitelqa/FlowTraceShard\d+;->s(\d+)\([^\n]*\)V$')
CATCH = re.compile(r'^\s*(\.catchall|\.catch L[^;]+;)\s+\{(:\w+)\s+\.\.\s+(:\w+)\}\s+(:\w+)\s*$')


def sha(s): return hashlib.sha256(s.encode()).hexdigest()


def executable(lines):
    """Skip annotation and switch/array data; preserve every original line."""
    depth = 0
    payload = False
    result = []
    for i, line in enumerate(lines):
        t = line.strip()
        if t.startswith(('.annotation ', '.subannotation ')): depth += 1
        if t.startswith(('.end annotation', '.end subannotation')): depth -= 1; continue
        if depth: continue
        if t.startswith(('.packed-switch ', '.sparse-switch', '.array-data ')): payload = True
        if t.startswith(('.end packed-switch', '.end sparse-switch', '.end array-data')): payload = False; continue
        if payload or not t or t.startswith(('.', ':', '#')): continue
        result.append(i)
    return result


def arg_types(s): return re.findall(r'\[*L[^;]+;|\[*[ZBCSIJFD]', s)


def simple(owner): return owner.strip('L;').rsplit('/', 1)[-1]


def exception_coverage(block, ignore_probes=False):
    lines=block.splitlines();labels={s.strip():i for i,s in enumerate(lines) if s.strip().startswith(':')}
    catches=[CATCH.match(s).groups() for s in lines if CATCH.match(s)]
    result=[]
    for i in executable(lines):
        op=lines[i].strip()
        if ignore_probes and PROBE_CALL.match(op):continue
        handlers=tuple((kind,handler) for kind,start,end,handler in catches if labels[start]<=i<labels[end])
        result.append((op,handlers))
    return result


def isolate_probe_exception_edges(original, patched):
    """New invokes must not merge new register states into original catches.

    A logger catches its own exceptions, but ART still treats its caller's
    invoke as throwable. Split only the original protected ranges around
    logger invokes; retain the same handlers on every original instruction.
    """
    lines=patched.splitlines(keepends=True)
    catches=[CATCH.match(s).groups() for s in lines if CATCH.match(s)]
    if not catches:return patched
    labels={s.strip():i for i,s in enumerate(lines) if s.strip().startswith(':')}
    probes={i:PROBE_CALL.match(s.strip()).group(1) for i,s in enumerate(lines) if PROBE_CALL.match(s.strip())}
    original_ops={i for i in executable(lines) if i not in probes}
    used=set();rewritten=[]
    for kind,start,end,handler in catches:
        lo,hi=labels[start],labels[end]
        inside=[i for i in probes if lo<=i<hi]
        at,at_label=lo,start
        for i in inside:
            sid=probes[i];a=f':hitel_flow_exclude_{sid}_a';b=f':hitel_flow_exclude_{sid}_b'
            if any(at<=j<i for j in original_ops):rewritten.append(f'    {kind} {{{at_label} .. {a}}} {handler}\n')
            used.add(i);at=i+1;at_label=b
        if any(at<=j<hi for j in original_ops):rewritten.append(f'    {kind} {{{at_label} .. {end}}} {handler}\n')
    out=[]
    for i,line in enumerate(lines):
        if CATCH.match(line):continue
        if line.strip()=='.end method':out.extend(rewritten)
        if i in used:out.append(f'    :hitel_flow_exclude_{probes[i]}_a\n')
        out.append(line)
        if i in used:out.append(f'    :hitel_flow_exclude_{probes[i]}_b\n')
    new=''.join(out)
    assert exception_coverage(original)==exception_coverage(new,True), 'An original exception edge changed'
    assert all(not handlers for op,handlers in exception_coverage(new) if PROBE_CALL.match(op)), 'Probe still enters original catch handler'
    return new


def relevant_call(m):
    owner, name = m['owner'], m['name']
    if name.startswith('<') or '/hitelqa/' in owner or 'Hitel' in owner: return False
    if owner.startswith('L'+PREFIX):
        if '/util/logging/' in owner or '/analytics/' in owner or 'Datadog' in owner:return False
        if name=='isStopped':return False  # polled for each file buffer
        return not re.search(r'(?:sendGa|Datadog|analytics|logDebug|logInfo|logError)', name, re.I)
    if owner.startswith('Lcom/lguplus/aicallagentaidl/'): return True
    if owner.startswith('Landroidx/work/'):
        return bool(re.search(r'enqueue|begin|then|cancel|success|failure|retry|getState|getProgress|isFinished', name, re.I))
    if owner in ('Lkotlinx/coroutines/flow/MutableStateFlow;', 'Lkotlinx/coroutines/flow/MutableSharedFlow;'):
        return name in ('setValue', 'compareAndSet', 'emit', 'tryEmit')
    if owner in ('Ljava/io/File;', 'Ljava/net/HttpURLConnection;', 'Ljava/net/URLConnection;'):
        return name not in ('getPath', 'getAbsolutePath', 'getName', 'toString')
    if owner.startswith(('Ljava/util/zip/', 'Lnet/lingala/zip4j/')):
        return not re.search(r'read|write|getName|getNextEntry', name)
    return False


def result_kind(desc):
    if desc.startswith(('L', '[')): return 'Object'
    return {'Z':'Int', 'B':'Int', 'C':'Int', 'S':'Int', 'I':'Int', 'J':'Long', 'F':'Float', 'D':'Double'}.get(desc)


def helper_source(desc, sites):
    rows=[f'.class public final {desc}', '.super Ljava/lang/Object;']
    for s in sites:
        kind=s['value_kind']
        typ={'None':'', 'Object':'Ljava/lang/Object;', 'Int':'I', 'Long':'J', 'Float':'F', 'Double':'D'}[kind]
        width=2 if kind in ('Long','Double') else int(kind!='None')
        args='{v0}' if not width else ('{v0, p0, p1}' if width==2 else '{v0, p0}')
        java='flow' if kind=='None' else 'flow'+kind
        rows.extend(['', f'.method public static s{s["id"]}({typ})V',f'    .registers {3+width}',
          '    :try_start', '    const-string v0, '+json.dumps(s['label']),
          f'    invoke-static {args}, {TRACE}->{java}(Ljava/lang/String;{typ})V',
          '    :try_end', '    .catchall {:try_start .. :try_end} :ignored', '    return-void',
          '    :ignored', '    move-exception v0', '    return-void', '.end method'])
    return '\n'.join(rows)+'\n'


def instrument_method(block, context, add_site, branches):
    lines=block.splitlines(keepends=True)
    ops=executable(lines)
    if not ops: return block, []
    before, after={}, {}
    added=[]

    def emit(i, phase, detail='', register=None, kind=None, placement='before'):
        call, site=add_site(context, i, phase, detail, register, kind)
        (before if placement=='before' else after).setdefault(i, []).append(call)
        added.append(site)
        return site

    header=lines[0].strip()
    static=' static ' in header
    emit(ops[0], 'ENTER', register=None if static else 'p0', kind=None if static else 'Object')
    # Capture event/destination types and actual boolean/error-code arguments;
    # never serialize account objects, strings, audio or response bodies.
    signature=re.search(r'\(([^)]*)\)',header).group(1)
    pn=0 if static else 1
    for n,typ in enumerate(arg_types(signature)):
        if (typ=='Z' or ('onError(' in header and typ=='I')):
            emit(ops[0], 'ARG', f'arg{n}', f'p{pn}', 'Int')
        elif typ.startswith('L') and re.search(r'Event;|Destination;|Result;|State;|Throwable;|Exception;',typ):
            emit(ops[0], 'ARG', f'arg{n}', f'p{pn}', 'Object')
        pn+=2 if typ in ('J','D') else 1

    return_type=header.split(')',1)[1]
    for pos,i in enumerate(ops):
        t=lines[i].strip()
        m=CALL.match(t)
        if m and relevant_call(m):
            detail=simple(m['owner'])+'.'+m['name']
            edge=emit(i, 'CALL', detail)['id']
            detail+=' from=S'+str(edge)
            j=ops[pos+1] if pos+1<len(ops) else None
            if j is not None and lines[j].strip().startswith('move-result'):
                reg=lines[j].strip().split()[-1]
                kind=result_kind(m['result'])
                emit(j, 'CALL_RETURN', detail, reg if kind else None, kind, 'after')
            else:
                emit(i, 'CALL_RETURN', detail, placement='after')
        if t.startswith('move-exception '):
            emit(i, 'CATCH', register=t.split()[-1], kind='Object', placement='after')
        elif t.startswith('throw '):
            emit(i, 'THROW', register=t.split()[-1], kind='Object')
        elif t.startswith('return'):
            if t=='return-void': emit(i,'RETURN')
            else: emit(i,'RETURN',register=t.split()[-1],kind=result_kind(return_type))
        if branches and t.startswith(('if-', 'packed-switch ', 'sparse-switch ')):
            emit(i,'BRANCH',t)
            emit(i,'FALLTHROUGH',t,placement='after')
        # Persist the actual data emitted into UI/status flows, not just entry.
        if m and m['owner'] in ('Lkotlinx/coroutines/flow/MutableStateFlow;', 'Lkotlinx/coroutines/flow/MutableSharedFlow;') and m['name'] in ('emit','tryEmit','setValue','compareAndSet'):
            regs=re.search(r'\{([^}]+)\}',t).group(1)
            if '..' in regs:
                first,last=[r.strip() for r in regs.split('..')]
                rr=[first[0]+str(n) for n in range(int(first[1:]),int(last[1:])+1)]
            else:rr=[r.strip() for r in regs.split(',')]
            arg=2 if m['name']=='compareAndSet' else 1
            if len(rr)>arg:emit(i,'STATE_VALUE',m['name'],rr[arg],'Object')
        if t.startswith(('iput-boolean ', 'sput-boolean ')):
            reg=t.split()[1].rstrip(',');field=t.rsplit('->',1)[-1]
            emit(i,'STATE_WRITE',field,reg,'Int',placement='after')

    # Mark executable jump destinations. Catch handlers must retain
    # move-exception as their first instruction; move-result stays adjacent.
    if branches:
        targets=set(re.findall(r'(?m)^\s*(?:if-[^\n]*,\s*|goto(?:/\d+)?\s+)(:\w+)',block))
        for pos,i in enumerate(ops):
            prev=ops[pos-1]+1 if pos else 0
            labels=[lines[j].strip() for j in range(prev,i) if lines[j].strip() in targets]
            if labels:
                is_move=lines[i].strip().startswith(('move-exception ', 'move-result'))
                emit(i,'BLOCK',','.join(labels),placement='after' if is_move else 'before')
    patched=[]
    for i,line in enumerate(lines):
        patched.extend(before.get(i,[]));patched.append(line);patched.extend(after.get(i,[]))
    new=''.join(patched)
    restored=re.sub(r'(?m)^    invoke-static(?:/range)? \{[^\n]*\}, Lcom/lguplus/aicallagent/hitelqa/FlowTraceShard\d+;->s\d+\([^\n]*\)V\n','',new)
    assert restored==block, 'An original instruction or metadata line changed'
    new=isolate_probe_exception_edges(block,new)
    return new,added


def process(root, inventory):
    report={'mode':'ORIGINAL_METHOD_CALL_RESULT_BRANCH_AND_CALLBACK_TRACE','sites':[], 'changes':[], 'helpers':[], 'original_instructions_preserved':True,'original_exception_coverage_preserved':True,'new_probe_invokes_excluded_from_original_catch_ranges':True}
    exact={}
    for s in inventory['sites']:exact.setdefault(s['class'].removeprefix('L').removesuffix(';')+'.smali',set()).add(s['method'])
    # Inventory class is a relative .smali path in the existing evidence.
    for s in inventory['sites']:
        if s['class'].endswith('.smali'):exact.setdefault(s['class'],set()).add(s['method'])
    for folder in sorted(root.glob('smali[0-9]*')):
        num=int(folder.name[5:]);desc=f'Lcom/lguplus/aicallagent/hitelqa/FlowTraceShard{num};'
        shard=[]
        def add_site(ctx,index,phase,detail,reg,kind):
            kind=kind or 'None';sid=len(report['sites'])+1
            label=f'S{sid} {ctx["short"]} {phase}'+(' '+detail if detail else '')
            typ={'None':'','Object':'Ljava/lang/Object;','Int':'I','Long':'J','Float':'F','Double':'D'}[kind]
            if kind=='None':args='{}';op='invoke-static'
            else:
                end=reg
                if kind in ('Long','Double'):end=reg[0]+str(int(reg[1:])+1)
                args='{'+reg+' .. '+end+'}';op='invoke-static/range'
            call=f'    {op} {args}, {desc}->s{sid}({typ})V\n'
            site={**ctx,'id':sid,'line':index+1,'phase':phase,'detail':detail,'value_kind':kind,'label':label}
            report['sites'].append(site);shard.append(site)
            return call,site
        for path in sorted((folder/PREFIX).rglob('*.smali')):
            rel=path.relative_to(folder).as_posix()
            if GENERATED.search(rel) or '/hitelqa/' in rel or '/Hitel' in rel:continue
            focused=bool(FOCUS.search(rel))
            setting_click='/setting/screen/SettingScreenKt$' in rel
            if not focused and not setting_click and rel not in exact:continue
            old=path.read_text();parts=[];end=0;count=0
            if setting_click and not focused and not any(x in old for x in ('->showVasErrorRetryToast()', 'SettingEvent$NavigateTo;')):continue
            for m in METHOD.finditer(old):
                b=m.group();header=b.splitlines()[0]
                name=re.search(r'\s([^\s(]+)\(',header).group(1)
                if SKIP_METHOD.search(name) or ' abstract ' in header or ' native ' in header:continue
                exact_method=any(x in header or header in x for x in exact.get(rel,()))
                if not focused and not setting_click and not exact_method:continue
                if not focused and setting_click and name not in ('invoke','invokeSuspend'):continue
                # No byte-buffer loop instrumentation. Workers still log
                # real file/HTTP outcomes, retries, exceptions and Result.
                branches=('Worker' not in path.name and len(executable(b.splitlines()))<350)
                ctx={'dex':f'classes{num}.dex','class':rel,'method':header,'short':path.stem+'.'+name}
                new,sites=instrument_method(b,ctx,add_site,branches)
                if new!=b:
                    parts.extend([old[end:m.start()],new]);end=m.end();count+=len(sites)
            if end:
                parts.append(old[end:]);new=''.join(parts);path.write_text(new)
                report['changes'].append({'dex':f'classes{num}.dex','class':rel,'before':sha(old),'after':sha(new),'site_count':count})
        if shard:
            helper=folder/'com/lguplus/aicallagent/hitelqa'/f'FlowTraceShard{num}.smali'
            if helper.exists():raise RuntimeError('Duplicate flow instrumentation')
            helper.parent.mkdir(parents=True,exist_ok=True);helper.write_text(helper_source(desc,shard))
            report['helpers'].append(str(helper.relative_to(root)))
    report['site_count']=len(report['sites'])
    report['phase_counts']=dict(Counter(x['phase'] for x in report['sites']))
    report['changed_dex']=sorted({x['dex'] for x in report['changes']})
    report['class_count']=len(report['changes'])
    assert any('/DownloadWorker.smali' in x['class'] for x in report['changes'])
    assert any('/FileUnzipWorker.smali' in x['class'] for x in report['changes'])
    assert any('recordingCallback$1.smali' in x['class'] for x in report['changes'])
    assert any(x['phase']=='ARG' and 'onError(' in x['method'] for x in report['sites'])
    return report


def network_routes(root, report):
    """Name API requests by static Retrofit definitions, never a live URL."""
    routes={('/v1/ai-asset/check','AUTH_CATALOG'),('/v2/ai-model/check','VERSION_CATALOG')}
    for folder in root.glob('smali[0-9]*'):
        for path in (folder/PREFIX/'network/api').rglob('*.smali'):
            for m in METHOD.finditer(path.read_text()):
                b=m.group();h=b.splitlines()[0]
                name=re.search(r'\s([^\s(]+)\(',h).group(1)
                for a in re.finditer(r'(?s)\.annotation runtime Lretrofit2/http/(?:GET|POST|PUT|PATCH|DELETE|HEAD);(.*?)\.end annotation',b):
                    v=re.search(r'value\s*=\s*"([^"]+)"',a.group(1))
                    if not v:continue
                    prefix=v.group(1).split('{',1)[0].split('?',1)[0]
                    if '://' in prefix or len(prefix.strip('/'))<4:continue
                    prefix='/'+prefix.lstrip('/')
                    if prefix not in ('/v1/ai-asset/check','/v2/ai-model/check'):
                        routes.add((prefix,path.stem+'.'+name))
    desc='Lcom/lguplus/aicallagent/hitelqa/FlowHttpRoutes;'
    out=[f'.class public final {desc}','.super Ljava/lang/Object;',
         '.method public static route(Ljava/lang/String;)Ljava/lang/String;', '    .registers 4']
    for i,(prefix,label) in enumerate(sorted(routes,key=lambda x:(-len(x[0]),x))):
        out.extend(['    const-string v0, '+json.dumps(prefix),
            '    invoke-virtual {p0, v0}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z',
            '    move-result v1', f'    if-eqz v1, :next{i}',
            '    const-string v0, '+json.dumps(label), '    return-object v0', f'    :next{i}'])
    out.extend(['    const-string v0, "OTHER_VENDOR_API"','    return-object v0','.end method'])
    helper=root/'smali16/com/lguplus/aicallagent/hitelqa/FlowHttpRoutes.smali'
    helper.parent.mkdir(parents=True,exist_ok=True);helper.write_text('\n'.join(out)+'\n')
    wire=root/'smali16/com/lguplus/aicallagent/network/client/HitelModelWireTrace.smali'
    old=wire.read_text()
    m=next(m for m in METHOD.finditer(old) if ' route(Lokhttp3/Request;)' in m.group().splitlines()[0])
    new='''.method private static route(Lokhttp3/Request;)Ljava/lang/String;
    .registers 3
    invoke-virtual {p0}, Lokhttp3/Request;->url()Lokhttp3/HttpUrl;
    move-result-object v0
    invoke-virtual {v0}, Lokhttp3/HttpUrl;->encodedPath()Ljava/lang/String;
    move-result-object v0
    invoke-static {v0}, '''+desc+'''->route(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v0
    return-object v0
.end method'''
    wire.write_text(old[:m.start()]+new+old[m.end():])
    gate=root/'smali18/com/lguplus/aicallagent/hitelqa/ModelCatalogQaTrace.smali'
    g=gate.read_text()
    start='    if-eqz p0, :original\n'
    assert g.count(start)==1
    g=g.replace(start,'    const-string v0, "QA_VAS_GATE INPUT"\n'
        '    invoke-static {v0, p0}, '+TRACE+'->flowInt(Ljava/lang/String;I)V\n'
        '    const-string v0, "QA_VAS_GATE DESTINATION"\n'
        '    invoke-static {v0, p1}, '+TRACE+'->flowObject(Ljava/lang/String;Ljava/lang/Object;)V\n'+start,1)
    g=g.replace('    :original\n    return p0','    :original\n'
        '    const-string v0, "QA_VAS_GATE OUTPUT"\n'
        '    invoke-static {v0, p0}, '+TRACE+'->flowInt(Ljava/lang/String;I)V\n    return p0',1)
    gate.write_text(g)
    report['static_http_route_count']=len(routes)
    report['static_http_routes']=[{'prefix':p,'label':l} for p,l in sorted(routes)]


def separate_instrumented_classes(root, report):
    """Keep DEX method references below 65536 without dropping trace sites.

    Android 26+ loads the additional standard classes20.dex automatically.
    Class descriptors, instructions and manifest stay exactly the same.
    Move complete instrumented classes, not only helpers (moving helpers
    alone would leave all the new references in the full original shard).
    """
    destination=root/'smali20'
    if destination.exists():raise RuntimeError('Unexpected original classes20.dex')
    moved=[]
    for item in report['changes']:
        if item['dex']!='classes18.dex':continue
        source=root/'smali18'/item['class'];target=destination/item['class']
        target.parent.mkdir(parents=True,exist_ok=True)
        assert sha(source.read_text())==item['after']
        shutil.move(str(source),str(target))
        moved.append(item['class'])
        item['original_dex']='classes18.dex';item['dex']='classes20.dex'
    source=root/'smali18/com/lguplus/aicallagent/hitelqa/FlowTraceShard18.smali'
    target=destination/'com/lguplus/aicallagent/hitelqa/FlowTraceShard18.smali'
    target.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(source),str(target))
    report['relocated_classes']={'from':'classes18.dex','to':'classes20.dex','count':len(moved),'classes':moved}
    report['new_dex']=['classes20.dex']
    report['changed_dex']=sorted(set(report['changed_dex'])|{'classes20.dex'})


def main():
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--inventory',type=Path,required=True);p.add_argument('--report',type=Path,required=True)
    a=p.parse_args();r=process(a.root,json.loads(a.inventory.read_text()))
    network_routes(a.root,r)
    separate_instrumented_classes(a.root,r)
    a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps(r,ensure_ascii=False,indent=2))
    print('ORIGINAL_FLOW_BOUNDARIES_INSTRUMENTED',json.dumps({k:r[k] for k in ('site_count','class_count','phase_counts','changed_dex','original_instructions_preserved')}),flush=True)


if __name__=='__main__':main()

