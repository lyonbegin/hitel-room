#!/usr/bin/env python3
"""Read-only by default: prove that the deployed Railway page receives real
native noVNC frames. Never reserve the already-busy Android slot by accident.

Optional HITEL_E2E_CREATE_SESSION=1 starts a device session only when free,
records its ID, and always releases that exact session in finally.
"""
import asyncio
import json
import os
import time
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("mobile-test-results/android-native-browser-e2e")
OUT.mkdir(parents=True, exist_ok=True)
SITE = "https://hitel-communication-web-production.up.railway.app/sdk-lab"

def say(k, v):
    print("HITEL_NATIVE_BROWSER_" + k + "=" + json.dumps(v, ensure_ascii=False, default=str), flush=True)

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
