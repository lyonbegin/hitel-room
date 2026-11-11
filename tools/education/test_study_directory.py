#!/usr/bin/env python3
"""Browser regression for the restored study-group discovery home.
The sample directory is explicitly marked demo; no claims about real users/remote join.
"""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT=Path("study-directory-mobile-evidence")
OUT.mkdir(parents=True,exist_ok=True)
REPORT=[]
def eq(value,expected,label):
    if value!=expected:raise AssertionError(f"{label}: expected={expected!r} actual={value!r}")
def check(value,label):
    if not value:raise AssertionError(label)
def snap(page,width,name):
    page.screenshot(path=str(OUT/f"{width}-{name}.png"),full_page=False)
def click(page,action,value=None):
    sel=f'#phone [data-tp="{action}"]'
    if value is not None:sel+=f'[data-value="{value}"]'
    page.locator(sel).first.click()
def model(page):
    return page.evaluate("window.HITEL_TUTOR_PLATFORM.getModel()")
def state(page):
    return page.evaluate("window.HITEL_TUTOR_PLATFORM.getState()")
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  for width in (320,390):
    context=browser.new_context(viewport={"width":width,"height":844},locale="ko-KR",timezone_id="Asia/Seoul",is_mobile=True,has_touch=True)
    page=context.new_page();errors=[]
    page.on("pageerror",lambda e:errors.append(str(e)))
    page.goto(BASE+"/?screen=groups",wait_until="domcontentloaded",timeout=60000)
    page.locator("#phone .tp-main-tabs").wait_for(timeout=35000)
    eq(state(page)["screen"],"groups","initial URL group home")
    eq(state(page)["mainTab"],"discover","discovery is default—not enrolled group listing")
    eq(page.locator("#phone .tp-discover-item").count(),5,"five explicitly labeled demonstration listings")
    check("실시간 그룹 데이터는 연결되지 않았습니다" in page.locator("#phone .tp-directory-warning").inner_text(),"accurate no-backend disclosure")
    check(page.locator(".tp-discover-item .tp-list-meta").all_inner_texts()==["예시"]*5,"every sample identified as demo")
    check(page.locator("#phone .bottomnav button").count()==5,"original bottom tabs preserved")
    before=model(page)
    check(len(before["groups"])>=2,"original saved groups preserved")
    snap(page,width,"01-study-discovery-home")

    page.locator('#phone select[data-tp-select="findInstitution"]').select_option("academy")
    eq(page.locator("#phone .tp-discover-item").count(),1,"academy filter")
    check("예시학원" in page.locator("#phone .tp-discover-list").inner_text(),"academy listed")
    page.locator('#phone select[data-tp-select="findInstitution"]').select_option("all")
    page.locator('#phone select[data-tp-select="findGrade"]').select_option("중2")
    eq(page.locator("#phone .tp-discover-item").count(),3,"grade filter")
    page.locator('#phone select[data-tp-select="findGrade"]').select_option("전체")
    page.locator('#phone select[data-tp-select="findSubject"]').select_option("영어")
    eq(page.locator("#phone .tp-discover-item").count(),1,"English subject filter")
    page.locator('#phone select[data-tp-select="findSubject"]').select_option("전체")
    page.locator("#tp-directory-search-form [name=q]").fill("예시중학교")
    page.locator("#tp-directory-search-form button").click()
    eq(page.locator("#phone .tp-discover-item").count(),3,"school-name search")
    page.locator("#tp-directory-search-form [name=q]").fill("")
    page.locator("#tp-directory-search-form button").click()
    eq(page.locator("#phone .tp-discover-item").count(),5,"clear search")
    snap(page,width,"02-search-filters")

    # Preview a full group; must not let the student join.
    page.locator('#phone .tp-discover-item[data-listing-id="sample-full"] [data-tp=previewListing]').first.click()
    eq(state(page)["screen"],"groupPreview","full group preview route")
    check("모집이 마감" in page.locator("#phone .tp-app").inner_text(),"full status clearly reported")
    eq(page.locator("#phone [data-tp=joinListing]").count(),0,"full group cannot be joined")
    snap(page,width,"03-closed-group-preview")
    click(page,"route","groups")

    # Pre-join comparison and explicit consent on a sample group.
    page.locator('#phone .tp-discover-item[data-listing-id="sample-math-ssen"] [data-tp=previewListing]').first.click()
    eq(state(page)["screen"],"groupPreview","chosen group preview")
    check("쎈" in page.locator("#phone .tp-app").inner_text(),"target textbook in preview")
    check("실제 학생이 모집한 스터디가 아닙니다" in page.locator("#phone .tp-app").inner_text(),"sample join is not presented as real remote enrollment")
    snap(page,width,"04-join-decision")
    click(page,"joinListing","sample-math-ssen")
    eq(state(page)["screen"],"groupDetail","join leads to group detail")
    joined=model(page)
    eq(len(joined["groups"]),len(before["groups"])+1,"join adds exactly one group without deleting existing groups")
    g=next(g for g in joined["groups"] if g.get("sourceListingId")=="sample-math-ssen")
    check(g["bookId"]=="ssen-중2-1" and g["coachId"]=="coach:ssen-중2-1","assigned textbook-specific teacher")
    eq(len(g["members"]),3,"join updates sample member count locally")
    eq(joined["activeGroupId"],g["id"],"new membership selected")
    snap(page,width,"05-joined-study-detail")

    click(page,"openChat",g["id"])
    eq(state(page)["screen"],"groupTeacherChat","inside group asks the correct teacher directly")
    check("쎈" in page.locator("#phone .tp-chat-top-details").inner_text(),"group teacher is correct")
    page.locator("#tp-chat-compose [name=question]").fill("연립일차방정식이 어려워요.")
    page.locator("#tp-chat-compose button").click()
    eq(page.locator("#phone .tp-bubble.student").count(),1,"teacher question saved in own group")
    snap(page,width,"06-tutor-from-study")

    page.locator('#phone .bottomnav button[data-go="groups"]').click()
    click(page,"mainTab","mine")
    eq(page.locator("#phone .tp-group-item").count(),len(joined["groups"]),"all old groups plus joined sample remain in My Study")
    button_rects=page.locator("#phone .tp-group-item").first.locator(".tp-actions .tp-btn").evaluate_all(
        "(els)=>els.map(e=>({l:e.getBoundingClientRect().left,r:e.getBoundingClientRect().right,w:e.getBoundingClientRect().width}))")
    check(len(button_rects)==2 and all(0<=b["l"] and b["r"]<=width+1 and b["w"]>55 for b in button_rects)
          and button_rects[0]["r"]<=button_rects[1]["l"],"My Study actions fit side-by-side inside mobile width")
    snap(page,width,"07-my-study-separated")
    click(page,"mainTab","discover")
    check("참여 중" in page.locator('#phone .tp-discover-item[data-listing-id="sample-math-ssen"]').inner_text(),"joined status visible in directory")
    page.reload(wait_until="domcontentloaded")
    page.locator("#phone .tp-main-tabs").wait_for(timeout=30000)
    eq(len(model(page)["groups"]),len(joined["groups"]),"enrollments persist on reload")
    click(page,"previewListing","sample-math-ssen")
    eq(state(page)["screen"],"groupPreview","preview route after reload")
    eq(page.locator("#phone [data-tp=joinListing]").count(),0,"duplicate enrollment prevented")
    click(page,"openListing","sample-math-ssen")
    eq(state(page)["screen"],"groupDetail","previously joined study reopens")
    check(page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),"no horizontal scrolling")
    eq(errors,[],"no JS runtime errors")
    REPORT.append({"width":width,"initialGroupCount":len(before["groups"]),"afterJoin":len(joined["groups"]),"directorySamples":5,"errors":errors})
    context.close()
  browser.close()
(OUT/"results.json").write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding="utf8")
print("STUDY_GROUP_DIRECTORY_E2E_SUCCESS",json.dumps(REPORT,ensure_ascii=False),flush=True)
