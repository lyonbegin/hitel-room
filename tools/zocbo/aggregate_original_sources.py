#!/usr/bin/env python3
"""Aggregate only observed mobile browser sources from six grade/site archives."""
import csv,json
from pathlib import Path
SRC=Path('archive/zocbo-original-sources-20261108')
OUT=SRC/'REPORT';OUT.mkdir(parents=True,exist_ok=True)
rows=[];subjects={};urls=set();assets={}
for site in ('M','H'):
 for grade in ('1','2','3'):
  label=site+grade
  path=SRC/label/'manifest.json'
  if not path.exists():
   subjects[label]={'missing':True};continue
  data=json.loads(path.read_text(encoding='utf8'))
  subjects[label]=data.get('subjectCatalog',{}).get(label,{})
  for case in data.get('cases',[]):
   snap=case.get('snapshot') or {}
   top=snap.get('topMenus') or []
   sub=snap.get('subMenus') or []
   filt=snap.get('filters') or []
   actual=snap.get('actualUrl','')
   if actual:urls.add(actual)
   parts=case.get('id','').split('_')
   rows.append({
    'site':site,'grade':grade,'subject':parts[2] if len(parts)>2 else '',
    'case':case.get('id',''),'http':case.get('http',''),
    'requested':case.get('requested',''),'actual':actual,
    'activeTop':' | '.join(x.get('name','') for x in top if x.get('active')),
    'topMenus':' | '.join(x.get('name','') for x in top),
    'activeSub':' | '.join(x.get('name','') for x in sub if x.get('active')),
    'subMenus':' | '.join(x.get('name','') for x in sub),
    'filters':' | '.join(x.get('name','') for x in filt),
    'episodeButtons':snap.get('episodes',''),
    'listRecords':snap.get('rowsDOMCount',''),
    'textChars':snap.get('documentTextChars',''),
    'domFile':label+'/'+case.get('domFile',''),
    'error':case.get('error','')
   })
  for asset in (data.get('capturedAssets') or {}):assets.setdefault(asset,set()).add(label)
fields=['site','grade','subject','case','http','requested','actual','activeTop','topMenus','activeSub','subMenus','filters','episodeButtons','listRecords','textChars','domFile','error']
with (OUT/'ALL_GRADE_SUBJECT_MENU_STATES.csv').open('w',newline='',encoding='utf-8-sig') as fp:
 writer=csv.DictWriter(fp,fieldnames=fields);writer.writeheader();writer.writerows(rows)
(OUT/'ALL_SUBJECTS_FROM_ORIGINAL_AJAX.json').write_text(json.dumps(subjects,ensure_ascii=False,indent=2),encoding='utf8')
failed=[r for r in rows if r['error']]
school_math_examples=[r for r in rows if r['subject'] in ('EG','KR','SC') and '수학' in r['activeSub']]
report={'recordedCases':len(rows),'distinctFinalURLs':len(urls),'failedCases':len(failed),
        'distinctJSandCss':len(assets),'subjectsFromOriginal':subjects,'errors':failed[:80],
        'nonMathWithMathMenuEvidence':school_math_examples[:40],
        'limitations':'Public anonymous DOM/UI; does not verify paid study files or account functions.'}
(OUT/'SUMMARY.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
README=[
 '# 족보닷컴 모바일 원본 학년·과목·상단·하위 메뉴 소스 감사',
 '',
 '이 소스 보존 브랜치에서는 HITEL UI 코드를 수정하지 않았습니다.',
 '',
 '- 실제 브라우저 방문 사례: '+str(len(rows)),
 '- 최종 원본 URL: '+str(len(urls)),
 '- 브라우저 접근 실패 사례: '+str(len(failed)),
 '- 서로 다른 CSS/JS 경로 수: '+str(len(assets)),
 '',
 'M1/M2/M3/H1/H2/H3 디렉터리에 각 학년별 원본 DOM, JS/CSS, 공개 AJAX, 필터 조작, 화면 캡처를 보관했습니다.',
 'REPORT/ALL_GRADE_SUBJECT_MENU_STATES.csv에는 각 상태에서 원본이 실제 표시한 이름, 활성 메뉴, 필터와 자료 수를 보관합니다.',
 'REPORT/ALL_SUBJECTS_FROM_ORIGINAL_AJAX.json에는 원본 익명 API가 돌려준 과목 코드만 보관합니다.',
 '',
 'HTTP200 및 DOM 열람은 로그인 이후 유료 자료 열람이나 다운로드가 성공한다는 뜻이 아닙니다.',
 '접근 불가와 자료 0건은 실패/미확인으로 기록하고 가공 자료로 대신하지 않습니다.'
]
(OUT/'README.md').write_text('\n'.join(README),encoding='utf8')
print('SOURCE_AUDIT_AGGREGATED',json.dumps({k:report[k] for k in ('recordedCases','distinctFinalURLs','failedCases','distinctJSandCss')},ensure_ascii=False),flush=True)
