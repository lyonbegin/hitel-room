#!/usr/bin/env python3
"""Second-pass public GET inspection of every distinct mobile navigation path
identified by the first Playwright run. No credential, form submission, purchase,
logout, download, or mutation. All results are source-observed.
"""
import asyncio,json
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright

P=Path("zocbo-discovered-navigation-audit");P.mkdir(exist_ok=True)
ROOT="https://m.zocbo.com"
# Actual 36 distinct mobile anchor targets verified by 2026-11-08 first-pass DOM audit.
PATHS={
"coupon":"/Customer/coupon.asp",
"diagnostic":"/Freetrial/learningtest.asp",
"service_intro":"/Freetrial/zocbo.asp",
"member_freetrial":"/Freetrial/main_s.asp",
"reading":"/Freetrial/FreeReading.asp",
"2024_midterm":"/event/pre-test2024c/default.asp",
"2024_achievement":"/freetrial/pre_achievement_test_2410/noti.asp",
"pre_middle_life":"/premid1/midschool/schoolLife.asp",
"pre_middle_works":"/premid1/zocboexam/pretest.asp",
"middle_concept":"/exam/examListWeb.asp?menu_cd=000010000100001&siteid=M&subject_cd=MT",
"middle_expected":"/M/expected.asp",
"middle_revision":"/guide/revision/default_M.asp",
"pre_high_exam":"/prego1/zocboExam/achievement_test.asp",
"pre_high_school":"/prego1/highschool/default.asp",
"high_expected":"/H/expected.asp",
"high_revision":"/guide/revision/default_H.asp",
"skytab_tutoring":"/skytab/tutoring.asp",
"skytab_curriculum":"/skytab/curriculum.asp",
"skytab_teacher":"/skytab/teacher.asp",
"skytab_howto":"/skytab/howto.asp",
"skytab_reviews":"/skytab/review.asp",
"notice":"/customer/notice.asp",
"upload_schedule":"/ZocboLetter/News_UploadD.asp",
"events":"/Event/main.asp",
"upload_status":"/customer/upload.asp",
"2026_summer_event":"/event/2026_s/2608_s_dft.asp",
"skytab_main":"/Skytab/Default.asp",
"2025_achievement":"/event/pre_achievement_test_202509/default.asp",
"service_intro_lower":"/freetrial/zocbo.asp",
"faq":"/Customer/faq.asp",
"my_questions":"/MyPage/myInfo1to1.asp",
"publishers":"/Customer/publish.asp",
"terms":"/Member/zagreement.asp",
"privacy":"/member/private.asp",
"customer_home":"/Customer/default.asp",
"clean_center":"/Customer/cleancenter.asp",
}
def category(key):
 if key.startswith("skytab"):return "과외/튜터"
 if key.startswith("pre_"):return "예비학년"
 if key in ("middle_expected","high_expected","middle_revision","high_revision","middle_concept","reading","diagnostic","member_freetrial","service_intro","service_intro_lower"):return "학습 핵심"
 if "20" in key or key in ("events",):return "기획전/이벤트"
 return "고객/회원/기타"

async def inspect(browser,sem,key,path):
 async with sem:
  ctx=await browser.new_context(viewport={"width":390,"height":844},is_mobile=True,device_scale_factor=1,locale="ko-KR")
  page=await ctx.new_page()
  errors=[]
  page.on("pageerror",lambda e:errors.append(str(e)[:160]))
  result={"url":ROOT+path,"category":category(key)}
  try:
   response=await page.goto(ROOT+path,wait_until="domcontentloaded",timeout=20000)
   await page.wait_for_timeout(1500)
   result.update({"http":response.status if response else None,"resolved":page.url})
   result["page"]=await page.evaluate("""() => ({
    title:document.title,bodyChars:(document.body?.innerText||'').trim().length,
    bodyPreview:(document.body?.innerText||'').trim().slice(0,180),
    examMainChars:(document.querySelector('#examMain')?.innerText||'').length,
    navigationAnchors:document.querySelectorAll('a[href]').length,
    controls:document.querySelectorAll('button,input[type=button],input[type=submit]').length,
    passwordField:!!document.querySelector('input[type=password]'),
    inputFields:document.querySelectorAll('input:not([type=hidden])').length,
    iframeCount:document.querySelectorAll('iframe').length,
    viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth
   })""")
   result["redirected"]=urlparse(page.url).path.lower()!=urlparse(ROOT+path).path.lower()
   result["errors"]=errors[:3]
   if key in ("middle_revision","high_revision","pre_middle_works","pre_high_exam","service_intro","reading","skytab_main","customer_home"):
    try:await page.screenshot(path=str(P/(key+".png")),full_page=False,timeout=5000)
    except Exception as e:result["screenshotFailed"]=str(e)[:130]
  except Exception as e:
   result["failure"]=str(e)[:230]
  finally:
   await ctx.close()
  print("NAV",key,result.get("http"),"BODY",result.get("page",{}).get("bodyChars"),"TO",result.get("resolved"),"FAIL",result.get("failure"),flush=True)
  return key,result

async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  sem=asyncio.Semaphore(6)
  items=await asyncio.gather(*[inspect(b,sem,key,path) for key,path in PATHS.items()])
  await b.close()
 report=dict(items)
 (P/"all-36.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8")
 lines=["# 원본 모바일 홈페이지에서 발견한 추가 36개 경로 접속 검증","","로그인·결제·다운로드를 발생시키지 않고 공개 GET만 확인했습니다. HTTP 200 단독은 기능 정상으로 간주하지 않습니다.","","| 구분 | 원본 링크 | HTTP | 본문자수 | 실제 최종주소 | 결과 |","|---|---|---:|---:|---|---|"]
 for k,x in report.items():
  chars=x.get("page",{}).get("bodyChars",0)
  result="접속 실패" if x.get("failure") else ("본문 비어 있음" if chars<10 else ("리디렉션" if x.get("redirected") else "공개 화면 표시"))
  lines.append(f"| {x['category']} | {k} | {x.get('http','ERR')} | {chars} | {x.get('resolved','')[:110]} | {result} |")
 lines.extend(["","### 주의","검사된 36개 경로는 홈페이지에서 실제 발견된 링크이며, 이 숫자가 족보닷컴의 모든 내부 페이지를 의미하지 않습니다. 인증 이후 화면과 개별 유료 자료는 미검증입니다."])
 (P/"all-36.md").write_text("\n".join(lines),encoding="utf8")
 print("DISCOVERED_36_AUDIT_COMPLETE",json.dumps({"checked":len(report),"http200":sum(v.get("http")==200 for v in report.values()),"empty":sum(v.get("page",{}).get("bodyChars",0)<10 and not v.get("failure") for v in report.values()),"failed":sum(bool(v.get("failure")) for v in report.values())},ensure_ascii=False),flush=True)

if __name__=="__main__":asyncio.run(main())
