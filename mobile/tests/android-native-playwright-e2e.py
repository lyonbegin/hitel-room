#!/usr/bin/env python3
"""Read-only by default: prove that the deployed Railway page receives real
native noVNC frames. Never reserve the already-busy Android slot by accident.

Optional HITEL_E2E_CREATE_SESSION=1 starts a device session only when free,
records its ID, and always releases that exact session in finally.
"""
import asyncio
import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("mobile-test-results/android-native-browser-e2e")
OUT.mkdir(parents=True, exist_ok=True)
SITE = "https://hitel-communication-web-production.up.railway.app/sdk-lab"

def say(k, v):
    print("HITEL_NATIVE_BROWSER_" + k + "=" + json.dumps(v, ensure_ascii=False, default=str), flush=True)

def adb(*args):
    command=["docker","exec","android-emulator-1","adb",*args]
    return subprocess.check_output(command,text=True,stderr=subprocess.STDOUT,timeout=35).strip()

def ui_xml():
    adb("shell","uiautomator","dump","/sdcard/hitel-window.xml")
    return adb("exec-out","cat","/sdcard/hitel-window.xml")

def android_size():
    value=adb("shell","wm","size")
    match=re.search(r"(?:Physical|Override) size:\s*(\d+)x(\d+)",value)
    if not match:
        match=re.search(r"(\d+)x(\d+)",value)
    assert match,"Cannot determine Android framebuffer size: "+value
    return int(match.group(1)),int(match.group(2))

def node_bounds(root, candidates):
    lowered=[x.lower() for x in candidates]
    for node in root.iter("node"):
        label=((node.attrib.get("text") or "")+" "+(node.attrib.get("content-desc") or "")).strip()
        if label and any(w in label.lower() for w in lowered):
            m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",node.attrib.get("bounds",""))
            if m:
                x1,y1,x2,y2=map(int,m.groups())
                return label,((x1+x2)/2,(y1+y2)/2)
    return None,None

def ui_texts(xml):
    root=ET.fromstring(xml)
    return {((n.attrib.get("text") or "")+" "+(n.attrib.get("content-desc") or "")).strip()
            for n in root.iter("node")
            if ((n.attrib.get("text") or "")+" "+(n.attrib.get("content-desc") or "")).strip()}

def ui_geometry(xml):
    root=ET.fromstring(xml)
    found={}
    for n in root.iter("node"):
        label=((n.attrib.get("text") or "")+" "+(n.attrib.get("content-desc") or "")).strip()
        m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n.attrib.get("bounds",""))
        if label and m and label not in found:
            found[label]=tuple(map(int,m.groups()))
    return found

async def canvas_geometry(frame):
    canvas=frame.locator("canvas").first
    await canvas.wait_for(state="visible",timeout=20000)
    box=await canvas.bounding_box()
    assert box and box["width"]>40 and box["height"]>80,"Native noVNC canvas has no usable geometry"
    return canvas,box

def scaled_point(box,remote,screen):
    x,y=remote; w,h=screen
    return {
      "x":max(1,min(box["width"]-1,x/w*box["width"])),
      "y":max(1,min(box["height"]-1,y/h*box["height"]))
    }

async def verify_native_input(page,phone_frame):
    # Put Android in a deterministic Settings state using ADB only for setup and
    # observation. The actions under test themselves are sent by the browser
    # through the original noVNC RFB canvas.
    adb("shell","input","keyevent","KEYCODE_WAKEUP")
    try: adb("shell","wm","dismiss-keyguard")
    except Exception: pass
    adb("shell","am","start","-W","-a","android.settings.SETTINGS")
    await page.wait_for_timeout(2200)

    screen=android_size()
    canvas,box=await canvas_geometry(phone_frame)

    before=ui_xml()
    root=ET.fromstring(before)
    label,remote=node_bounds(root,[
      "Network & internet","Connected devices","Apps & notifications",
      "Battery","Display","Sound"
    ])
    assert remote,"Could not locate a stable clickable Settings row in the real Android UI"
    point=scaled_point(box,remote,screen)
    await canvas.click(position=point)
    await page.wait_for_timeout(1600)
    after=ui_xml()
    diff=len(ui_texts(before).symmetric_difference(ui_texts(after)))
    assert diff>=3,"Browser tap did not materially change the Android UI tree"
    say("INPUT_TAP",{"target":label,"remote":remote,"canvasPoint":point,"changedTexts":diff})

    # Browser drag/scroll. Reset to the top-level Settings list first.
    adb("shell","am","start","-W","-a","android.settings.SETTINGS")
    adb("shell","input","keyevent","KEYCODE_HOME")
    adb("shell","am","start","-W","-a","android.settings.SETTINGS")
    await page.wait_for_timeout(1400)
    before_drag=ui_xml()
    canvas,box=await canvas_geometry(phone_frame)
    start={"x":box["x"]+box["width"]*0.52,"y":box["y"]+box["height"]*0.78}
    end={"x":box["x"]+box["width"]*0.52,"y":box["y"]+box["height"]*0.30}
    await page.mouse.move(start["x"],start["y"])
    await page.mouse.down()
    await page.mouse.move(end["x"],end["y"],steps=14)
    await page.mouse.up()
    await page.wait_for_timeout(1300)
    after_drag=ui_xml()
    drag_diff=len(ui_texts(before_drag).symmetric_difference(ui_texts(after_drag)))
    before_geo=ui_geometry(before_drag)
    after_geo=ui_geometry(after_drag)
    shifted=[
      label for label in set(before_geo).intersection(after_geo)
      if abs(before_geo[label][1]-after_geo[label][1])>=12
      or abs(before_geo[label][3]-after_geo[label][3])>=12
    ]
    assert drag_diff>=2 or len(shifted)>=2,(
      "Browser drag did not scroll/change the Android Settings UI; "
      f"changedTexts={drag_diff} shifted={len(shifted)}")
    say("INPUT_DRAG",{"from":start,"to":end,"changedTexts":drag_diff,
      "shiftedRows":len(shifted),"sampleShifted":shifted[:5]})

    # Keyboard input goes through the focused noVNC canvas into Android Settings
    # search. Verify the Android accessibility tree contains the exact typed text.
    adb("shell","am","start","-W","-a","android.settings.SETTINGS")
    await page.wait_for_timeout(1400)
    search_xml=ui_xml()
    search_root=ET.fromstring(search_xml)
    search_label,search_remote=node_bounds(search_root,["Search settings","Search Settings"])
    assert search_remote,"Android Settings search control not found"
    canvas,box=await canvas_geometry(phone_frame)
    await canvas.click(position=scaled_point(box,search_remote,screen))
    await page.wait_for_timeout(1000)
    # noVNC focusOnClick keeps RFB keyboard capture active.
    await page.keyboard.type("hitel",delay=90)
    await page.wait_for_timeout(1100)
    typed_xml=ui_xml()
    typed=[n.attrib.get("text","") for n in ET.fromstring(typed_xml).iter("node")]
    assert any("hitel" in t.lower() for t in typed),"Browser keyboard text did not reach Android"
    say("INPUT_KEYBOARD",{"typed":"hitel","androidTextMatched":True})

    # Restore a neutral home state after the destructive-free interaction test.
    adb("shell","input","keyevent","KEYCODE_HOME")
    await page.wait_for_timeout(600)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = await browser.new_context(viewport={"width":1450,"height":1000}, locale="ko-KR")
        page = await context.new_page()
        errors = []
        sockets = []
        frames = []
        native_page = None
        created_session = None
        native = ""

        def monitor(socket):
            sockets.append(socket.url)
            socket.on("framereceived", lambda payload: frames.append(len(payload) if isinstance(payload,(str,bytes)) else 0))

        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("websocket", monitor)
        try:
            response = await page.goto(SITE, wait_until="domcontentloaded", timeout=45000)
            assert response and response.status == 200, "Production SDK webpage HTTP != 200"
            say("SDK_HTTP", response.status)
            started = time.monotonic()
            while time.monotonic() - started < 310:
                result = await page.evaluate("""async () => {
                    const r=await fetch('/lab-api/android-native/status',{cache:'no-store',credentials:'same-origin'});
                    return {http:r.status,body:await r.json()};
                }""")
                if result["http"] == 200 and result["body"].get("online") and result["body"].get("url"):
                    native = result["body"]["url"]
                    break
                await page.wait_for_timeout(8000)
            assert native, "No active native Android KVM host; no fake viewer passes this test"
            say("HOST_URL",native)

            # Assert that the ACTUAL deployed SDK embeds the original phone, not a
            # management dashboard that tries to allocate an already-busy slot.
            await page.reload(wait_until="domcontentloaded",timeout=45000)
            await page.wait_for_timeout(8000)
            sdk_iframes = [f.url for f in page.frames]
            say("SDK_IFRAMES",sdk_iframes)
            required = native + "/stream/1/phone.html"
            assert required in sdk_iframes, "Railway Android iframe is not the existing noVNC phone"
            await page.screenshot(path=str(OUT/"sdk-existing-android.png"), full_page=True)
            phone_frame=next(f for f in page.frames if f.url==required)

            if os.getenv("HITEL_VERIFY_NATIVE_INPUT") == "1":
                await verify_native_input(page,phone_frame)
                say("INPUT_RESULT","REAL_NOVNC_TAP_DRAG_KEYBOARD_PASS")

            # Observe the genuine original UI, but never use its Tap to Start
            # unless this particular test explicitly requests a disposable slot.
            native_page = await context.new_page()
            native_page.on("pageerror",lambda error:errors.append(str(error)))
            native_page.on("websocket",monitor)
            original = await native_page.goto(native+"/",wait_until="domcontentloaded",timeout=45000)
            assert original and original.status == 200
            await native_page.wait_for_timeout(1800)
            sessions_resp = await context.request.get(native+"/api/emulator/sessions",timeout=15000)
            assert sessions_resp.ok, "Original session inventory API failed"
            inventory = await sessions_resp.json()
            preexisting = inventory.get("sessions",[])
            say("PREEXISTING_SESSIONS",{"count":len(preexisting),
              "free":inventory.get("free"),
              "ids":[s.get("sessionId") for s in preexisting]})

            if os.getenv("HITEL_E2E_CREATE_SESSION") == "1":
                if preexisting:
                    say("SESSION_ACTION","REUSE_EXISTING_NO_ALLOCATION")
                else:
                    # Explicit opt-in only. Stop this exact session in finally.
                    created = await context.request.post(native+"/api/emulator/session",
                      data={"device":"Samsung Galaxy S10","timeout":2},timeout=45000)
                    assert created.status == 201, "Cannot create real Android session: "+(await created.text())[:400]
                    created_session = (await created.json())["sessionId"]
                    say("CREATED_TEST_SESSION",created_session)

            # Playwright records incoming noVNC binary frames from actual
            # Android. HTTP 200 and an iframe alone cannot satisfy this.
            await page.wait_for_timeout(8500)
            await page.screenshot(path=str(OUT/"native-screen-and-websocket.png"),full_page=True)
            say("WEBSOCKETS",sockets)
            say("RECEIVED_FRAMES",len(frames))
            say("BROWSER_ERRORS",errors[:12])
            assert not errors, "Runtime React or noVNC error: "+str(errors)
            assert any("/stream/1/websockify" in url for url in sockets), "Native noVNC WebSocket did not connect"
            assert len(frames)>0, "No actual native Android video frames reached Chromium"
            say("RESULT","LIVE_ORIGINAL_ANDROID_PHONE_RECONNECTED_WITHOUT_SECOND_SESSION")
        finally:
            if created_session and native:
                try:
                    released = await context.request.delete(native+"/api/emulator/session/"+created_session,timeout=35000)
                    say("TEST_SESSION_RELEASE",{"sessionId":created_session,"http":released.status})
                    assert released.ok, "Owned test session could not be released"
                    verify = await context.request.get(native+"/api/emulator/sessions",timeout=15000)
                    assert verify.ok, "Failed to verify slot reset"
                    current = (await verify.json()).get("sessions",[])
                    assert all(s.get("sessionId")!=created_session for s in current), "Test session leaked"
                    say("TEST_SESSION_CLEANUP","PASS")
                except Exception as error:
                    say("TEST_SESSION_CLEANUP_FAILED",str(error))
                    raise
            await browser.close()

if __name__=="__main__":
    asyncio.run(main())
