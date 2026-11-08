#!/usr/bin/env python3
"""Read-only mobile original menu sweep: discovered from real 2026-11-08 navigation.
Anonymous GET only, no checkout forms, login, click, or file access.
"""
import json,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
PART=sys.argv[1] if len(sys.argv)>1 else "A"
SOURCES={
"A":{
 "middle-final-mock":"/M/?menu=6",
 "middle-gangnam":"/M/?menu=2&type=4",
 "high-gangnam":"/H/?menu=2&type=4",
 "concept-math":"/M/?menu=1&group=0&subject=2",
 "calculation-math":"/M/?menu=1&group=1&subject=2",
 "literature":"/M/?menu=5&group=4&subject=0&grade=2",
 "grammar":"/M/?menu=5&group=4&subject=1&grade=2",
 "textbook-variant":"/M/?menu=5&group=4&subject=2&grade=2",
 "eng-reading":"/M/?menu=1&group=2&subject=1",
 "korean-grammar":"/M/?menu=5&group=5&subject=0&grade=2",
 "written-answers":"/M/?menu=5&group=0&subject=2&grade=2",
 "math-master":"/M/?menu=4&group=1&subject=2&grade=2",
 "school-assignment":"/M/?menu=5&group=5&subject=2&grade=2",
 "middle-practical-math":"/exam/examListWeb.asp?menu_cd=000010000300001&siteid=M&subject_cd=MT",
 "high-practical-math":"/exam/examListWeb.asp?menu_cd=000020000300001&siteid=H&subject_cd=MT",
 "high-mistakes":"/exam/examListWeb.asp?menu_cd=000020000300003&siteid=H&grade=3",
 "high-supplement-eng":"/exam/examListWeb.asp?menu_cd=000020000600001&siteid=H&subject_cd=EG",
 "high-supplement-olympos":"/exam/examListWeb.asp?menu_cd=000020000800002&siteid=H",
 "high-supplement-kr":"/exam/examListWeb.asp?menu_cd=000020000800001&siteid=H&subject_cd=KR",
 "middle-english-grammar":"/exam/examListWeb.asp?menu_cd=000010000100002&siteid=M&subject_cd=EG",
 "middle-math-master":"/exam/examListWeb.asp?menu_cd=000010000200002&siteid=M&subject_cd=MT",
 "high-types":"/exam/examListWeb.asp?menu_cd=000020000600001&siteid=H&subject_cd=KR",
 "pre-high":"/prego1/highschool/default.asp",
 "pre-high-index":"/prego1/",
 "pre-high-exam":"/prego1/zocboExam/achievement_test.asp",
 "pre-middle-exam":"/premid1/zocboexam/pretest.asp",
 "pre-middle-school":"/premid1/midschool/schoolLife.asp"
},
"B":{
 "customer-main":"/Customer/default.asp",
 "customer-faq":"/Customer/faq.asp",
 "customer-notice":"/customer/notice.asp",
 "customer-upload":"/customer/upload.asp",
 "my-inquiry":"/MyPage/myInfo1to1.asp",
 "book-store":"/payment/",
 "events-main":"/Event/main.asp",
 "events-filter":"/Event/main.asp?filter=S",
 "benefits":"/Freetrial/main_s.asp",
 "service-guide":"/Freetrial/zocbo.asp",
 "mock-midterm":"/event/pre-test2026c/",
 "mock-midterm-old":"/event/pre-test2024c/default.asp",
 "mock-october":"/event/pre_achievement_test_2610/",
 "mock-october-old":"/freetrial/pre_achievement_test_2410/noti.asp",
 "revision-high":"/guide/revision/default_H.asp",
 "grade-change":"/guide/yearChange/",
 "study-news":"/ZocboLetter/News_UploadD.asp",
 "tutoring":"/skytab/tutoring.asp",
 "skytab-teacher":"/skytab/teacher.asp",
 "skytab-main":"/skytab/",
 "skytab-howto":"/skytab/howto.asp",
 "skytab-review":"/skytab/review.asp",
 "member-terms":"/Member/zagreement.asp",
 "member-privacy":"/Member/Private.asp",
 "real-free-reading-lowercase":"/freetrial/freereading.asp",
 "diagnostic-type":"/freetrial/learningtest.asp?type=0"
}}
OUT=Path("zocbo-extended-evidence");OUT.mkdir(exist_ok=True)
targets=SOURCES.get(PART,{})
report={"part":PART,"pages":{}}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--disable-dev-shm-usage","--no-sandbox"])
 context=browser.new_context(viewport={"width":390,"height":844},device_scale_factor=1,is_mobile=True,locale="ko-KR")
 page=context.new_page()
 for name,path in targets.items():
  url="https://m.zocbo.com"+path
  item={"requested":url}
  try:
   res=page.goto(url,wait_until="domcontentloaded",timeout=17000)
   page.wait_for_timeout(1100)
   item.update(page.evaluate("""() => ({
      endUrl:location.href,title:document.title,
      textChars:(document.body?.innerText||'').trim().length,
      textPreview:(document.body?.innerText||'').trim().slice(0,115),
      examMain:document.querySelector('#examMain')?.children.length||0,
      publicActions:document.querySelectorAll('button,input,select').length,
      iframeCount:document.querySelectorAll('iframe').length
   })"""))
   item["status"]=res.status if res else None
  except Exception as e:item["error"]=str(e)[:240]
  report["pages"][name]=item
  print("ORIGINAL_MORE",name,item.get("status"),item.get("textChars"),item.get("endUrl"),item.get("error",""),flush=True)
 context.close();browser.close()
(OUT/(PART+".json")).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
print("AUDITED",PART,len(targets),flush=True)
