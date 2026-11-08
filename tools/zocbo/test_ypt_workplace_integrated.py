#!/usr/bin/env python3
"""Regression and interaction audit on deployed YPT + Zocbo + group workplace UI."""
import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT=Path("ypt-workplace-e2e-evidence")
OUT.mkdir(exist_ok=True,parents=True)
REPORT={"base":BASE,"checks":[],"errors":[],"page_errors":[]}
def check(cond,message):
    if not cond:raise AssertionError(message)
    REPORT["checks"].append(message)
def click(page,sel):
    page.locator(sel).first.click(timeout=30000)
def nav(page,label):
    page.locator("#phone .bottomnav button").filter(has_text=label).click()
def wp(page,action,value=None):
    q='#phone [data-wp="'+action+'"]'
    if value is not None:q+='[data-value="'+value+'"]'
    click(page,q)
def form(page,selector,values):
    for k,v in values.items():
        page.locator(selector+' [name="'+k+'"]').fill(v) if k not in ("groupId","repeat") else page.locator(selector+' [name="'+k+'"]').select_option(v)
    page.locator(selector+' button[type=submit]').click()
def snapshot(page,name):
    page.screenshot(path=str(OUT/name),full_page=False)
def no_overflow(page):
    return page.evaluate('document.documentElement.scrollWidth <= innerWidth+2')

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
 for width in (360,390):
    ctx=browser.new_context(viewport={"width":width,"height":844},is_mobile=True,has_touch=True,locale="ko-KR")
    page=ctx.new_page()
    page.set_default_timeout(35000)
    page.on("pageerror",lambda err:REPORT["page_errors"].append(str(err)))
    page.goto(BASE+"/?screen=bankSearch",wait_until="domcontentloaded",timeout=65000)
    page.locator("#phone .zb-f-main-tabs button").first.wait_for(timeout=55000)
    check(page.locator("#phone .zb-f-main-tabs button").count()==6,"original Zocbo six main menus intact "+str(width))
    check(page.locator("#phone .bottomnav button").count()==5,"original YPT five bottom nav intact "+str(width))
    check(page.locator("#phone .zb-original-footer").count()==0,"no duplicated Zocbo footer "+str(width))
    check(page.locator("#phone iframe").count()==0,"no iframe "+str(width))
    check(page.locator("#phone .wp-group-choice").count()==0,"bank original DOM untouched before detail "+str(width))
    check(no_overflow(page),"bank no horizontal overflow "+str(width))
    snapshot(page,str(width)+"-bank.png")
    # Group UI in original shell, one-member group.
    nav(page,"그룹")
    page.locator("#phone .wp-group-card").first.wait_for()
    check(page.locator("#phone .wp-group-card").count()==2,"two initial group options "+str(width))
    wp(page,"chooseGroup","my-study")
    check("screen=groupDetail" in page.url,"one-member group detail route "+str(width))
    check(page.locator("#phone .wp-group-hero").inner_text().find("1/5명")>=0,"1-member group supported "+str(width))
    snapshot(page,str(width)+"-group-one.png")
    # Create new persistent scheduled group session.
    click(page,'#phone [data-go="calendarAdd"]')
    check("screen=calendarAdd" in page.url,"group session schedule form route "+str(width))
    now=page.evaluate("new Date().toISOString().slice(0,10)")
    name="E2E 테스트 스터디 "+str(width)
    form(page,"#wp-session-form",{"groupId":"my-study","title":name,"date":now,"start":"19:00","end":"20:30","repeat":"매주"})
    check("screen=groupSessionDetail" in page.url,"saved schedule detail route "+str(width))
    check(name in page.locator("#phone .appscroll").inner_text(),"saved group schedule detail title "+str(width))
    check(page.locator("#phone .bottomnav button").count()==5,"session detail retains shell "+str(width))
    snapshot(page,str(width)+"-session-detail.png")
    wp(page,"enterSession")
    check("screen=groupLiveRoom" in page.url,"study room route "+str(width))
    check(page.locator("#phone .bottomnav").count()==0,"immersive study room no duplicate bottom nav "+str(width))
    check(page.locator("#phone .wp-video-grid .wp-video-tile").count()==1,"single member gallery full tile "+str(width))
    check("실제 영상" in page.locator("#phone .wp-room-notice").inner_text(),"honest UI-only call status "+str(width))
    wp(page,"toggleMic")
    check(page.locator("#phone .wp-room-toolbar").inner_text().find("마이크 켬")>=0,"microphone UI toggle "+str(width))
    wp(page,"roomMode","materials")
    check(page.locator("#phone .wp-room-docs").count()==1,"learning materials view mode "+str(width))
    wp(page,"roomMode","whiteboard")
    canvas=page.locator("#phone #wp-board")
    canvas.wait_for()
    bound=canvas.bounding_box()
    page.mouse.move(bound["x"]+20,bound["y"]+20)
    page.mouse.down()
    page.mouse.move(bound["x"]+80,bound["y"]+60,steps=10)
    page.mouse.up()
    check(page.evaluate("Object.values(JSON.parse(localStorage.getItem('hitel.ypt.group-workplace.v1')).boards).flat().length>0"),"local whiteboard stroke stored "+str(width))
    snapshot(page,str(width)+"-whiteboard.png")
    wp(page,"leaveSession")
    check("screen=groupSessionSummary" in page.url,"room exit summary route "+str(width))
    check("이 기기" in page.locator("#phone .appscroll").inner_text(),"local attendance transparency "+str(width))
    # Calendar reflects stored session after navigating away.
    nav(page,"캘린더")
    check("screen=calendar" in page.url,"calendar navigation "+str(width))
    check(name in page.locator("#phone .appscroll").inner_text(),"created group event appears in calendar "+str(width))
    snapshot(page,str(width)+"-calendar.png")
    # Todo create / check and persistence.
    nav(page,"할 일")
    click(page,'#phone [data-go="todoAdd"]')
    task="E2E 그룹 과제 "+str(width)
    form(page,"#wp-task-form",{"title":task,"groupId":"my-study","assignee":"나","date":now})
    check(task in page.locator("#phone .appscroll").inner_text(),"created group task visible "+str(width))
    page.locator('#phone .wp-task-row').filter(has_text=task).locator('[data-wp="toggleTask"]').click()
    check(page.locator('#phone .wp-task-row').filter(has_text=task).locator('.wp-done').count()==1,"group task toggled complete "+str(width))
    page.reload(wait_until="domcontentloaded")
    page.locator("#phone .wp-task-row").filter(has_text=task).wait_for()
    check(page.locator('#phone .wp-task-row').filter(has_text=task).locator('.wp-done').count()==1,"group task persists on browser reload "+str(width))
    # Bank sheet shares captured public metadata into selected group.
    nav(page,"문제은행")
    page.locator("#phone .zb-f-main-tabs button").first.wait_for(timeout=55000)
    wp(page,"zbFSite") if False else None
    click(page,'#phone [data-action="zbFMain"][data-value="gangnam"]')
    page.locator("#phone .zb-f-gangnam-papers button").first.wait_for(timeout=40000)
    check(page.locator("#phone .zb-f-gangnam-papers button").count()==20,"twenty captured gangnam metadata papers remain "+str(width))
    click(page,"#phone .zb-f-gangnam-papers button")
    page.locator("#phone .zb-f-gangnam-detail").wait_for()
    page.locator('#phone [data-wp="sharePaper"]').wait_for()
    wp(page,"sharePaper")
    check(page.locator("#wp-paper-picker").count()==1,"bank detail group share chooser "+str(width))
    wp(page,"confirmPaper","my-study")
    check(page.locator("#wp-paper-picker").count()==0,"bank share confirms and closes without leaving original "+str(width))
    nav(page,"그룹")
    wp(page,"chooseGroup","my-study")
    wp(page,"groupTab","materials")
    check(page.locator("#phone .wp-tab-content").inner_text().find("자료번호")>=0,"shared original bank paper present in group material tab "+str(width))
    check(no_overflow(page),"new group UI no horizontal overflow "+str(width))
    snapshot(page,str(width)+"-shared-material.png")
    # New group is created as one-member group, no fake minimum 2.
    nav(page,"그룹")
    click(page,'#phone [data-go="groupCreate"]')
    form(page,"#wp-create-group",{"name":"E2E 새 그룹 "+str(width),"school":"테스트 학교","subject":"영어"})
    check(page.locator("#phone .wp-group-hero").inner_text().find("1/5명")>=0,"created group has exactly one person "+str(width))
    wp(page,"groupTab","members")
    click(page,'#phone [data-go="groupMembers"]')
    for member in ("회원A","회원B","회원C","회원D"):
        page.locator('#phone [name="memberName"]').fill(member)
        wp(page,"addMember")
    check("5/5명" in page.locator("#phone .appscroll").inner_text(),"five-person maximum attained "+str(width))
    check(page.locator('#phone [data-wp="addMember"]').count()==0,"sixth person addition unavailable "+str(width))
    check(no_overflow(page),"five person group layout no horizontal overflow "+str(width))
    snapshot(page,str(width)+"-group-five.png")
    ctx.close()
 browser.close()
(OUT/"result.json").write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding="utf-8")
assert not REPORT["page_errors"],REPORT["page_errors"]
print("HITEL_GROUP_WORKPLACE_E2E_PASSED",json.dumps({"base":BASE,"checks":len(REPORT["checks"]),"errors":REPORT["errors"],"page_errors":REPORT["page_errors"]},ensure_ascii=False))
