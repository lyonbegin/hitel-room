"""Google Play sign-in on an isolated persistent Android development device.
Never sends credentials to an LLM, uploads screenshots, or automates MFA/CAPTCHA.
Only uses Google's own sign-in UI. Stops on unfamiliar screens.
"""
import logging
import os
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

logging.disable(logging.CRITICAL)
EMAIL = os.environ.get("GOOGLE_TEST_EMAIL", "")
PASSWORD = os.environ.get("GOOGLE_TEST_PASSWORD", "")
PORT = os.environ.get("HITEL_EMULATOR_PORT", "5554")
SERIAL = "emulator-" + PORT

def adb(*args):
    return subprocess.run(["adb", "-s", SERIAL, *args], capture_output=True,
                          text=True, timeout=45, check=False)

def account_present():
    result = adb("shell", "dumpsys", "account")
    return any(EMAIL.casefold() in line.casefold() and "type=com.google" in line
               for line in result.stdout.splitlines())

def main():
    if not EMAIL or not PASSWORD:
        print("BLOCKED: test account secrets are missing")
        return 2
    if not os.environ.get("HITEL_AVD_ROOT") or os.environ.get("RUNNER_ENVIRONMENT") != "self-hosted":
        print("BLOCKED: requires isolated persistent self-hosted device")
        return 2
    if account_present():
        print("SUCCESS: existing Google account session detected; credentials not entered")
        return 0
    import uiautomator2 as u2
    device = u2.connect(SERIAL)
    # Go through native Play Store sign-in, not a browser or arbitrary app.
    device.app_start("com.android.vending")
    email_sent = password_sent = False
    for _ in range(90):
        if account_present():
            print("SUCCESS: Google account present on persistent Android")
            return 0
        current = device.app_current().get("package", "")
        if current not in {"com.android.vending", "com.google.android.gms", "com.google.android.gsf.login"}:
            print("BLOCKED: unexpected app during sign-in; manual review required")
            return 3
        root = ET.fromstring(device.dump_hierarchy())
        nodes = list(root.iter("node"))
        screen = " ".join(n.get("text","")+" "+n.get("content-desc","") for n in nodes).lower()
        if any(x in screen for x in ("2-step verification","verify it's you","verification code","captcha","robot","security key","passkey","check your phone","couldn't sign you in","wrong password","too many attempts","try again later")):
            print("BLOCKED: Google verification or security challenge; manual sign-in required")
            return 3
        def click_text(*labels):
            for label in labels:
                obj = device(text=label)
                if obj.exists:
                    obj.click()
                    return True
            return False
        if not email_sent and not password_sent and click_text("Sign in", "SIGN IN"):
            time.sleep(3)
            continue
        edits = [n for n in nodes if n.get("class") == "android.widget.EditText" and n.get("enabled") == "true"]
        for idx, node in enumerate(edits):
            identity = (node.get("resource-id","")+" "+node.get("text","")+" "+node.get("content-desc","")).lower()
            password_field = node.get("password") == "true" or "password" in identity
            email_field = "identifier" in identity or "email" in identity or "phone" in identity
            if password_field and email_sent and not password_sent:
                # Use the exact visible Google UI element, not shell input.
                obj = device(resourceId=node.get("resource-id")) if node.get("resource-id") else device(className="android.widget.EditText", instance=idx)
                obj.set_text(PASSWORD)
                password_sent = True
                if not click_text("Next","NEXT"):
                    print("BLOCKED: password submit control not recognized")
                    return 3
                break
            if email_field and not email_sent and not password_field:
                obj = device(resourceId=node.get("resource-id")) if node.get("resource-id") else device(className="android.widget.EditText", instance=idx)
                obj.set_text(EMAIL)
                email_sent = True
                if not click_text("Next","NEXT"):
                    print("BLOCKED: email submit control not recognized")
                    return 3
                break
        # Never auto-accept terms, permission grants or account recovery prompts.
        if password_sent and any(x in screen for x in ("i agree","terms of service","google services","accept")):
            print("BLOCKED: Google consent screen requires manual approval")
            return 3
        time.sleep(3)
    print("BLOCKED: account not confirmed; manual review needed")
    return 3

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        # Exception text may contain private UI or transport payloads.
        print("BLOCKED: login helper error:", type(exc).__name__)
        sys.exit(3)
