#!/usr/bin/env python3
"""Collect PUBLICLY INDEXED Scribd /document/ URLs for all middle/high subjects.
Broad workbook/subject terms first, classify after; never infer no book from
blocked/empty search. Metadata only; do not download/reproduce textbook PDFs.
"""
import re,csv,json,html,urllib.parse,urllib.request,xml.etree.ElementTree as ET,argparse
from concurrent.futures import ThreadPoolExecutor,as_completed
from pathlib import Path
from collections import Counter

SUBJECTS={
"중학":{
"국어":"국어 문법 문학 독해 비문학 어휘 한자","영어":"영어 영문법 독해 듣기 영단어",
"수학":"수학 연산","과학":"과학","사회":"사회 지리","역사":"역사 한국사 세계사",
"도덕":"도덕","기술가정":"기술가정","정보":"정보 코딩","제2외국어":"일본어 중국어",
"예체능":"음악 미술 체육","교양":"진로 환경 보건"},
"고등":{
"국어":"공통국어1 공통국어2 문학 독서와작문 화법과언어 독서 언어와매체 화법과작문 고전읽기",
"영어":"공통영어1 공통영어2 영어Ⅰ 영어Ⅱ 영어독해 영어회화 영어발표 심화영어 수능영어",
"수학":"공통수학1 공통수학2 대수 미적분Ⅰ 미적분Ⅱ 확률과통계 기하 수학Ⅰ 수학Ⅱ 경제수학 인공지능수학",
"사회":"통합사회1 통합사회2 한국사1 한국사2 한국지리 세계지리 동아시아사 세계사 경제 정치와법 사회와문화 생활과윤리 윤리와사상",
"과학":"통합과학1 통합과학2 과학탐구실험1 과학탐구실험2 물리학Ⅰ 물리학Ⅱ 화학Ⅰ 화학Ⅱ 생명과학Ⅰ 생명과학Ⅱ 지구과학Ⅰ 지구과학Ⅱ 역학과에너지 물질과에너지 지구시스템과학",
"정보":"정보 인공지능기초 데이터과학 프로그래밍",
"외국어":"일본어 중국어 독일어 프랑스어 스페인어 한문",
"예체능":"음악 미술 미술창작 체육 스포츠생활 연극",
"기술교양":"기술가정 보건 환경 심리학 논술 철학"}}
BRANDS="쎈 개념원리 RPM 라이트쎈 베이직쎈 개념쎈 쎈B 일품 블랙라벨 풍산자 체크체크 최상위수학 마플 수력충전 에이급 숨마쿰라우데 개념플러스유형 우공비 개념풀 완자 오투 하이탑 한끝 올리드 자이스토리 마더텅 기출의미래 수능특강 수능완성 백발백중 내신콘서트 능률보카 워드마스터 천일문 리딩튜터 매3 빠작 국어의기술 1등급만들기 EBS중학 수능기출 평가문제집 자습서 개념해결의법칙 디딤돌 미래엔 천재교육 비상교육".split()
SEEDS=[
("1045496147","(22개정) 라이트쎈 중1-2 본문","사용자 화면"),
("1024768392","풍산자 공통수학1","공개 색인"),
("1072375429","2026 인천예송중학교 과학 3-1 기말 기출변형","공개 색인"),
("1051530184","블랙라벨 중학 수학 1-2","공개 색인")]
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]*>',' ',s or ''))).strip()[:350]
def write_csv(f,headers,rows):
 with open(f,'w',encoding='utf-8-sig',newline='') as stream:
  w=csv.DictWriter(stream,fieldnames=headers,extrasaction='ignore');w.writeheader();w.writerows(rows)
def query(term,start):
 url='https://www.bing.com/search?'+urllib.parse.urlencode({'q':'site:scribd.com/document "'+term+'"','format':'rss','first':start})
 results=[];status=0;error=''
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Accept-Language':'ko-KR'})
  with urllib.request.urlopen(req,timeout=14) as resp:status=resp.status;body=resp.read(500000).decode('utf-8','replace')
  if '<rss' not in body.lower():error='search RSS unavailable'
  else:
   root=ET.fromstring(body)
   for item in root.findall('.//item'):
    m=re.search(r'scribd\.com/document/(\d+)',item.findtext('link',''))
    if m:results.append((m.group(1),clean(item.findtext('title'))))
 except Exception as exc:error=str(exc)[:200]
 return {'term':term,'start':start,'url':url,'http':status,'error':error,'results':results}
def classify(title):
 s=clean(title)
 mid=bool(re.search(r'중등|중학|중학교|중\s*[123](?!\d)',s))
 high=bool(re.search(r'고등|고교|공통수학|공통국어|공통영어|수능|미적분|수학Ⅰ|수학Ⅱ',s))
 level='중고혼합' if mid and high else '중학' if mid else '고등' if high else '학제미확인'
 m=re.search(r'(?:중등|중학|중)\s*([123])\s*[-–]\s*([12])',s)
 period=m.group(1)+'-'+m.group(2) if m else ''
 if '정오표' in s:kind='정오표'
 elif re.search('정답|해설|답지',s):kind='정답해설'
 elif '교사용' in s:kind='교사용'
 elif re.search('일부|부록|발췌|기출변형',s):kind='일부자료'
 else:kind='본문미검증'
 edition='2022개정' if re.search(r'2022\s*개정|22\s*개정',s) else '2015개정' if re.search(r'2015\s*개정|15\s*개정',s) else '판본미확인'
 candidates=[]
 for grp,subjects in SUBJECTS.items():
  for subject,words in subjects.items():
   if any(w in s for w in words.split()):candidates.append(grp+':'+subject)
 return level,period,kind,edition,';'.join(sorted(set(candidates))[:8])
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--batch',type=int,default=0);ap.add_argument('--batch-size',type=int,default=90)
 ap.add_argument('--out',default='all-school-textbook-catalog')
 args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 terms=list(dict.fromkeys(BRANDS+[word for categories in SUBJECTS.values() for sub in categories.values() for word in sub.split()]))
 write_csv(out/'search_manifest.csv',['기본검색어','배치','Scribd검색주소'],[
 {'기본검색어':q,'배치':i//args.batch_size,'Scribd검색주소':'https://www.scribd.com/search?'+urllib.parse.urlencode({'query':q,'verbatim':'true'})} for i,q in enumerate(terms)])
 active=terms[args.batch*args.batch_size:(args.batch+1)*args.batch_size]
 attempts=[]
 with ThreadPoolExecutor(max_workers=7) as pool:
  futures=[pool.submit(query,t,p) for t in active for p in (1,11)]
  for f in as_completed(futures):attempts.append(f.result())
 write_csv(out/'search_attempts.csv',['검색어','페이지','HTTP','검색주소','발견문서수','오류'],[
 {'검색어':r['term'],'페이지':r['start'],'HTTP':r['http'],'검색주소':r['url'],'발견문서수':len(r['results']),'오류':r['error']} for r in attempts])
 docs={}
 seed_records=list(SEEDS)
 seed_path=Path(__file__).with_name('scribd_seed_document_links.csv')
 if seed_path.exists():
  with seed_path.open(encoding='utf-8-sig',newline='') as f:
   seed_records.extend((x['document_id'],x['title'],x['source']) for x in csv.DictReader(f))
 for docid,title,source in seed_records:
  old=docs.get(docid)
  if old and len(old['title'])>=len(title):continue
  docs[docid]={'id':docid,'title':title,'origin':source,'terms':set()}
 for r in attempts:
  for id,title in r['results']:
   row=docs.setdefault(id,{'id':id,'title':'','origin':'공개 검색 색인','terms':set()})
   if len(title)>len(row['title']):row['title']=title
   row['terms'].add(r['term'])
 entries=[]
 for v in docs.values():
  level,period,kind,edition,candidates=classify(v['title'])
  entries.append({'문서ID':v['id'],'교재·문서명':v['title'],
   'Scribd상세페이지':'https://www.scribd.com/document/'+v['id'],'학교급':level,
   '학년학기':period,'과목후보':candidates,'판본':edition,'문서종류':kind,
   '발견검색어':'; '.join(sorted(v['terms'])),'근거':v['origin'],'전체원문확인':'미검증'})
 entries.sort(key=lambda x:(x['학교급'],x['과목후보'],x['교재·문서명']))
 headers=['문서ID','교재·문서명','Scribd상세페이지','학교급','학년학기','과목후보','판본','문서종류','발견검색어','근거','전체원문확인']
 write_csv(out/'all_document_detail_links.csv',headers,entries)
 for lvl,file in [('중학','middle.csv'),('고등','high.csv'),('중고혼합','mixed.csv'),('학제미확인','unclassified.csv')]:
  write_csv(out/file,headers,[x for x in entries if x['학교급']==lvl])
 write_csv(out/'subjects.csv',['학교급','과목군','포함과목'],[
 {'학교급':g,'과목군':k,'포함과목':v} for g,classes in SUBJECTS.items() for k,v in classes.items()])
 summary={'batch':args.batch,'total_basic_terms':len(terms),'terms_run':len(active),
 'search_attempts':len(attempts),'new_index_documents':len(docs)-len(set(x[0] for x in seed_records)),
 'seed_documents':len(set(x[0] for x in seed_records)),'unique_detail_urls':len(docs),
 'subject_groups':sum(len(g) for g in SUBJECTS.values()),'all_books_verified':False,
 'limitations':'GitHub Chrome Scribd CAPTCHA and public index gaps. No zero-result inference, full-text verification or copyright license claim.'}
 (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
 print('CATALOG_SUMMARY',json.dumps(summary,ensure_ascii=False),flush=True)
if __name__=='__main__':main()
