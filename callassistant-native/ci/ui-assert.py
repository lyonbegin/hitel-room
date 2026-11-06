#!/usr/bin/env python3
"""Drive the *actual* emulator UI. Private activities are opened by in-app taps,
not by exporting them or bypassing Android activity security."""
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

def adb(*args, timeout=30):
    return subprocess.run(["adb", *args], check=True, capture_output=True, timeout=timeout).stdout

def dump():
    adb("shell", "uiautomator", "dump", "/sdcard/hitel-current.xml", timeout=45)
    return ET.fromstring(adb("exec-out", "cat", "/sdcard/hitel-current.xml"))

def nodes(root):
    return list(root.iter("node"))

def target(root, label):
    for node in nodes(root):
        if label in node.attrib.get("text", "") or label in node.attrib.get("content-desc", ""):
            return node
    return None

def click(node):
    m = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not m:
        raise RuntimeError("UI node has no tap bounds")
    a, b, c, d = map(int, m.groups())
    if a == c or b == d:
        raise RuntimeError("UI node has empty bounds")
    adb("shell", "input", "tap", str((a+c)//2), str((b+d)//2))
    print("[HITEL-UI] tapped", node.attrib.get("text"))

def recover_external_anr(root):
    for node in nodes(root):
        text = node.attrib.get("text", "")
        if "HITEL" in text and "isn't responding" in text:
            raise RuntimeError("Our own HITEL app is not responding")
        if "Pixel Launcher isn't responding" in text:
            button = target(root, "Close app")
            if button:
                click(button)
                time.sleep(2)
                return True
    return False

def perform(action, label):
    for attempt in range(15):
        try:
            root = dump()
            if recover_external_anr(root):
                continue
            button = target(root, label)
            if button:
                if action == "tap":
                    click(button)
                print("[HITEL-UI] PASS", action, label, "after", attempt, "retries")
                return
            if action == "tap" and attempt in (3, 7, 11):
                adb("shell", "input", "swipe", "520", "1650", "520", "480", "280")
        except (subprocess.CalledProcessError, ET.ParseError, subprocess.TimeoutExpired) as exc:
            print("[HITEL-UI] transient ADB/UI dump problem", type(exc).__name__, file=sys.stderr)
        time.sleep(2)
    raise RuntimeError(f"UI '{label}' unavailable after 15 attempts")

if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("wait", "tap"):
        raise SystemExit("Usage: ui-assert.py (wait|tap) 'visible text'")
    perform(sys.argv[1], sys.argv[2])
