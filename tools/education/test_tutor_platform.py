#!/usr/bin/env python3
"""Regression: multi-school/multi-subject textbook tutors, group-scoped questions,
assignments, shared learning materials, exams and mobile direct navigation.
This verifies browser-local implementation, not production multi-user sync or LLM.
"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv("HITEL_BASE_URL","https://hitel-education-zocbo-unified-production.up.railway.app").rstrip("/")
OUT=Path("tutor-platform-mobile-evidence");OUT.mkdir(exist_ok=True,parents=True)
RESULT={"checks":[],"screens":[]}
def check(ok,title):
    if not ok:raise AssertionError(title)
    RESULT["checks"].append(title)
def snap(page,width,name):
    page.screenshot(path=str(OUT/f"{width}-{name}.png"),full_page=False)
def data(page):
    return page.evaluate("window.HITEL_TUTOR_PLATFORM.getModel()")
def screen(page):
    return page.evaluate("window.HITEL_TUTOR_PLATFORM.getState().screen")
def nav(page,route):
    page.locator(f'#phone .bottomnav [data-go="{route}"]').click()
def choose(page,command,value=None):
    selector=f'#phone [data-tp="{command}"]'
    if value is not None:selector+=f'[data-value="{value}"]'
    page.locator(selector).first.click()
def register_book(page,name,subject="수학",grade="고2"):
    nav(page,"groupAITutor")
    page.locator('#tp-register-book [name="subject"]').select_option(subject)
    page.locator('#tp-register-book [name="grade"]').select_option(grade)
    page.locator('#tp-register-book [name="name"]').fill(name)
    page.locator('#tp-register-book button[type=submit]').click()
    check(screen(page)=="groupCoachProfile","custom book opens coach profile")
    check(name in page.locator("#phone .tp-profile").inner_text(),"profile matches registered textbook")
    choose(page,"createFromBook")
    check(screen(page)=="groupCreate","coach profile starts group creation")
def create_group(page,school,title,typ="school",grade="고2",subject="수학"):
    form=page.locator("#tp-group-create-form")
    form.locator('[name="institutionType"]').select_option(typ)
    form.locator('[name="institutionName"]').fill(school)
    form.locator('[name="grade"]').select_option(grade)
    form.locator('[name="subject"]').select_option(subject)
    form.locator('[name="name"]').fill(title)
    book_id=form.locator('[name="bookId"]').input_value()
    check(bool(book_id),"textbook is preselected during group creation")
    form.locator("button[type=submit]").click()
    check(screen(page)=="groupDetail","group creation opens independent study page")
    g=next(g for g in data(page)["groups"] if g["id"]==data(page)["activeGroupId"])
    check(g["bookId"]==book_id and g["coachId"]=="coach:"+book_id,"group fixed to matching textbook coach")
    check(g["institutionName"]==school and g["subject"]==subject and g["grade"]==grade,"group school/grade/subject correct")
    check(g["members"]==["나"],"new group initialized to one local member")
    return g["id"]
def ask(page,question):
    choose(page,"openChat")
    check(screen(page)=="groupTeacherChat","group directly opens its assigned teacher")
    page.locator("#tp-chat-compose [name=question]").fill(question)
    page.locator("#tp-chat-compose button[type=submit]").click()
    check(page.locator("#phone .tp-bubble.student").count()==1,"student question saved")
    check(page.locator("#phone .tp-bubble.teacher").count()==1,"clearly rule-based demo answer shown")
def learning(page):
    nav(page,"groupLearning")
    check(screen(page)=="groupLearning","learning screen route")
    check(page.locator(".tp-study-tabs .tp-btn").count()==3,"three original learning tabs maintained")
    choose(page,"toggleForm","assignments")
    page.locator("#tp-task-form [name=title]").fill("연립방정식 복습")
    page.locator("#tp-task-form button[type=submit]").click()
    check("연립방정식 복습" in page.locator("#phone .tp-panel").inner_text(),"assignment created")
    choose(page,"learningTab","materials")
    choose(page,"toggleForm","materials")
    page.locator("#tp-material-form [name=title]").fill("풀이 과정 필기")
    page.locator("#tp-material-form [name=text]").fill("두 식을 더한 다음 정리했습니다.")
    page.locator("#tp-material-form button[type=submit]").click()
    check("풀이 과정 필기" in page.locator("#phone .tp-panel").inner_text(),"material created")
    choose(page,"learningTab","exams")
    choose(page,"toggleForm","exams")
    page.locator("#tp-exam-form [name=title]").fill("중간고사")
    page.locator("#tp-exam-form [name=scope]").fill("1~3단원")
    page.locator("#tp-exam-form button[type=submit]").click()
    check("중간고사" in page.locator("#phone .tp-panel").inner_text(),"exam added with its own group scope")
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
    for width in (320,390):
        ctx=browser.new_context(viewport={"width":width,"height":844},locale="ko-KR",timezone_id="Asia/Seoul",is_mobile=True,has_touch=True)
        page=ctx.new_page()
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        page.goto(BASE+"/?screen=groupAITutor&group=demo-five",wait_until="domcontentloaded",timeout=60000)
        page.locator("#phone .tp-book-grid .tp-book-item").first.wait_for(timeout=30000)
        check(screen(page)=="groupAITutor","direct AI tutoring URL shows tutor finder")
        check(page.locator("#phone .tp-book-item").count()>=33,"existing textbook catalog retained")
        check(page.locator("#phone .bottomnav button").count()==5,"five bottom tabs")
        snap(page,width,"teacher-finder")
        before=data(page)["groups"]
        check(any(g["id"]=="demo-five" for g in before),"legacy demo groups were preserved")
        # School-specific textbook AI coaches, independent study group IDs.
        register_book(page,"쎈 고등 수학Ⅱ")
        g1=create_group(page,"등촌고등학교","등촌고 2학년 쎈 수학")
        snap(page,width,"group-dashboard")
        ask(page,"등촌고등학교 중간고사 범위를 알려 주세요.")
        check("공식 출제범위" in page.locator(".tp-bubble.teacher").inner_text(),"unknown school exam scope is not invented")
        snap(page,width,"teacher-chat")
        learning(page)
        snap(page,width,"learning-exams")
        register_book(page,"풍산자 수학Ⅱ")
        g2=create_group(page,"풍산고등학교","풍산고 수학")
        ask(page,"이차함수의 원리가 어려워요.")
        d=data(page)
        check(g1!=g2 and len(d["teacherChats"][g1]["me"])==2 and len(d["teacherChats"][g2]["me"])==2,"separate group chat histories")
        check("등촌고등학교" not in page.locator(".tp-chat-history").inner_text(),"school context not leaked across groups")
        register_book(page,"독해 학습 교재","영어")
        g3=create_group(page,"중앙학원","영어 독해 스터디",typ="academy",subject="영어")
        check(data(page)["groups"][-1]["institutionType"]=="academy","academy groups supported")
        ask(page,"이 문장의 문법이 이해되지 않습니다.")
        nav(page,"groupQuestions")
        check(screen(page)=="groupQuestions","bottom question tab goes to teacher picker")
        check(page.locator("#phone .tp-chat-item").count()==3,"one teacher per joined configured group")
        snap(page,width,"teacher-picker")
        choose(page,"openChat",g1)
        check(data(page)["activeGroupId"]==g1,"teacher picker changes active group to chosen teacher")
        check("등촌고등학교" in page.locator(".tp-chat-history").inner_text(),"selected teacher resumes original school chat")
        check("중앙학원" not in page.locator(".tp-chat-history").inner_text(),"english academy history isolated")
        nav(page,"groupLearning")
        check("연립방정식 복습" in page.locator(".tp-study-tabs").locator("..").inner_text() or
              "연립방정식 복습" in page.locator("#phone .tp-app").inner_text(),"learning task scoped to selected school")
        select=page.locator("#phone select[data-tp-select=group]")
        select.select_option(g2)
        check(data(page)["activeGroupId"]==g2,"learning group switcher sets current group")
        check("연립방정식 복습" not in page.locator("#phone .tp-app").inner_text(),"other school's assignment hidden")
        nav(page,"groups")
        check(page.locator(".tp-group-item").count()>=5,"multiple groups listed without 1000-group directory")
        check(page.locator("#phone .tp-app").evaluate("(n)=>getComputedStyle(n).display")!="none","visible single mobile app pane")
        check(page.evaluate("document.documentElement.scrollWidth <= innerWidth+2"),"no horizontal scrolling")
        # Verify original exercise tool remains reachable from a catalog-linked group.
        nav(page,"groupAITutor")
        choose(page,"chooseBook","ssen-중2-1")
        choose(page,"createFromBook")
        g4=create_group(page,"등촌중학교","중2 쎈 스터디",grade="중2",subject="수학")
        check(page.locator("[data-tp=practice]").count()==1,"existing problem reader is exposed as a lesson tool")
        choose(page,"practice",g4)
        check(screen(page)=="groupPractice","practice remains reachable inside group")
        check(page.locator("#phone .cs-problem").count()==6,"math practice tool still works")
        check(page.evaluate("window.HITEL_COACH_INSPECT().problemCount")==6,"coach suite group scoped math questions")
        snap(page,width,"exercise-tool")
        check(not errors,"no browser JavaScript errors "+str(errors))
        RESULT["screens"].append({"width":width,"groupsCreated":4,"teacherEntries":3,"checks":len(RESULT["checks"]),"errors":errors})
        ctx.close()
    browser.close()
(OUT/"report.json").write_text(json.dumps(RESULT,ensure_ascii=False,indent=2),encoding="utf8")
print("TUTOR_GROUP_PLATFORM_E2E_SUCCESS",json.dumps({"screens":RESULT["screens"],"checkCount":len(RESULT["checks"])},ensure_ascii=False),flush=True)
