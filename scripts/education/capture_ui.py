#!/usr/bin/env python3
"""Capture original Android app pixels plus UiAutomator evidence; never draw a mock UI.

All screenshots are adb exec-out screencap -p from a real Android emulator.
Autonomous exploration is bounded and avoids payments/account mutations.
"""
import hashlib
import json
import os
import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from collections import deque

PKG = os.environ['APP_PACKAGE']
APP = os.environ['APP_ID']
BASE = pathlib.Path('evidence') / APP
SHOTS = BASE / 'screenshots'
SHOTS.mkdir(parents=True, exist_ok=True)
MAX_SCREENS = int(os.getenv('MAX_SCREENS', '60'))
MAX_DEPTH = int(os.getenv('MAX_DEPTH', '4'))
MAX_SECONDS = int(os.getenv('MAX_SECONDS', '1200'))
MAX_ATTEMPTS = int(os.getenv('MAX_ATTEMPTS', '180'))


def adb(*args, timeout=50):
    try:
        return subprocess.run(['adb', *map(str, args)], capture_output=True, timeout=timeout)
    except Exception as exc:
        return subprocess.CompletedProcess(args=args, returncode=99, stdout=b'', stderr=str(exc).encode())


def sh(*args, timeout=50):
    return adb('shell', *args, timeout=timeout)


def shell_text(*args, timeout=50):
    return sh(*args, timeout=timeout).stdout.decode('utf-8', errors='replace')


def screenshot():
    raw = adb('exec-out', 'screencap', '-p', timeout=50).stdout
    return raw if raw.startswith(b'\x89PNG\r\n\x1a\n') else None


def hierarchy():
    sh('uiautomator', 'dump', '/sdcard/hitel-edu-window.xml', timeout=45)
    xml = shell_text('cat', '/sdcard/hitel-edu-window.xml', timeout=30)
    return xml if '<hierarchy' in xml else ''


def nodes(xml):
    if not xml:
        return []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []
    result = []
    for node in root.iter('node'):
        bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.attrib.get('bounds', ''))
        if not bounds:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        if x2-x1 < 18 or y2-y1 < 18:
            continue
        result.append({
            'x': (x1+x2)//2, 'y': (y1+y2)//2,
            'label': node.attrib.get('text') or node.attrib.get('content-desc') or '',
            'resource': node.attrib.get('resource-id', ''),
            'package': node.attrib.get('package', ''),
            'class': node.attrib.get('class', ''),
            'clickable': node.attrib.get('clickable') == 'true',
            'scrollable': node.attrib.get('scrollable') == 'true',
            'enabled': node.attrib.get('enabled') == 'true',
        })
    return result


BLOCK = re.compile(r'(결제|구매|구독|유료|탈퇴|삭제|지불|환불|신고|제출|확정|장바구니|구매하기|신청하기|pay|purchase|subscribe|delete|report|checkout|submit)', re.I)


def clickable(ns):
    out = []
    coords = set()
    for n in ns:
        if not n['clickable'] or not n['enabled'] or BLOCK.search(n['label']):
            continue
        key = (n['x']//15, n['y']//15)
        if key in coords:
            continue
        coords.add(key)
        out.append({k: n[k] for k in ('x', 'y', 'label', 'resource')})
    return out[:18]


def os_dialog_kind(xml):
    if 'immersive_cling' in xml or 'Viewing full screen' in xml:
        return 'immersive'
    if 'permissioncontroller' in xml:
        return 'permission'
    return None


def dismiss_os_dialog(xml, history):
    kind = os_dialog_kind(xml)
    if not kind:
        return False
    ns = nodes(xml)
    if kind == 'immersive':
        candidates = [n for n in ns if n['resource'] == 'android:id/ok' or n['label'] == 'Got it']
    else:
        labels = {'while using the app', 'allow only while using the app', 'allow', '허용', '앱 사용 중에만 허용', '앱 사용 중에만', '이번만 허용'}
        candidates = [n for n in ns if n['label'].strip().lower() in labels or 'permission_allow_button' in n['resource']]
    if not candidates:
        return False
    n = candidates[0]
    sh('input', 'tap', n['x'], n['y'])
    history.append({'event': 'os_dialog', 'kind': kind, 'button': n['label'], 'action': 'dismissed'})
    time.sleep(2)
    return True


def wait_until_ready(history, first=False):
    """Wait for app UI after startup, dismiss only OS immersive / permission prompts."""
    start = time.monotonic()
    limit = 42 if first else 13
    last_xml = ''
    while time.monotonic() - start < limit:
        xml = hierarchy()
        if xml:
            last_xml = xml
        if dismiss_os_dialog(xml, history):
            continue
        ns = nodes(xml)
        own = [n for n in ns if n['package'] == PKG]
        active = [n for n in own if n['clickable'] and n['enabled']]
        texts = [n['label'] for n in own if n['label']]
        # A fully initialized UI normally has content beyond a splash icon.
        if (len(active) >= 2 or len(texts) >= 3) and not os_dialog_kind(xml):
            time.sleep(1.5)
            return xml
        time.sleep(2)
    return last_xml


def launch(history, first=False):
    sh('am', 'force-stop', PKG)
    time.sleep(.6)
    adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')
    time.sleep(2)
    return wait_until_ready(history, first=first)


def focus():
    window = shell_text('dumpsys', 'window', 'windows')
    m = re.search(r'mCurrentFocus=([^\n]+)', window)
    if m and m.group(1).strip() and m.group(1).strip() != 'null':
        return m.group(1).strip()
    activities = shell_text('dumpsys', 'activity', 'activities')
    m = re.search(r'(?:topResumedActivity|mResumedActivity|ResumedActivity)[^\n]*', activities)
    return m.group(0).strip() if m else ''


def signature(xml, png):
    if xml:
        ns = nodes(xml)
        desc = [(n['label'], n['resource'], n['class'], n['x']//10, n['y']//10) for n in ns]
        return hashlib.sha256(json.dumps(desc, ensure_ascii=False).encode()).hexdigest()
    return hashlib.sha256(png or b'').hexdigest()


def replay(path, history):
    launch(history, first=not bool(history))
    for step in path:
        if step.get('kind') == 'scroll':
            sh('input', 'swipe', 240, 800, 240, 310, 420)
            time.sleep(2)
            continue
        current = nodes(hierarchy())
        same = [n for n in current if step.get('resource') and n['resource'] == step['resource']]
        if not same and step.get('label'):
            same = [n for n in current if n['label'] == step['label']]
        selected = same[0] if same else step
        sh('input', 'tap', selected['x'], selected['y'])
        time.sleep(2)
        wait_until_ready(history, first=False)


def classify(xml, ns):
    if os_dialog_kind(xml):
        return 'SYSTEM_DIALOG'
    own = [n for n in ns if n['package'] == PKG]
    if any(n['label'] for n in own) or len([n for n in own if n['clickable']]) > 1:
        return 'APP_UI'
    return 'STARTUP_OR_UNKNOWN'


STATE = {
    'app': APP, 'package': PKG, 'device': shell_text('getprop', 'ro.product.model').strip(),
    'android': shell_text('getprop', 'ro.build.version.release').strip(),
    'screens': [], 'events': [], 'blocked_reason': None,
    'coverage_complete': False, 'method': 'adb exec-out screencap -p + uiautomator dump',
}
if 'package:' not in shell_text('pm', 'path', PKG):
    STATE['blocked_reason'] = 'APP_NOT_INSTALLED'
    (BASE/'screens.json').write_text(json.dumps(STATE, ensure_ascii=False, indent=2), encoding='utf-8')
    raise SystemExit(30)

queue = deque([[]])
visited = set()
start = time.monotonic()
attempts = 0
while queue and attempts < MAX_ATTEMPTS and len(STATE['screens']) < MAX_SCREENS and time.monotonic()-start < MAX_SECONDS:
    path = queue.popleft()
    attempts += 1
    try:
        replay(path, STATE['events'])
        xml = hierarchy()
        if dismiss_os_dialog(xml, STATE['events']):
            xml = hierarchy()
        ns = nodes(xml)
        png = screenshot()
        if not png:
            STATE['events'].append({'path': path, 'error': 'ADB_SCREENSHOT_NOT_PNG'})
            continue
        sig = signature(xml, png)
        if sig in visited:
            continue
        visited.add(sig)
        idx = len(STATE['screens'])
        num = f'{idx:03d}'
        filename = SHOTS / (num+'.png')
        filename.write_bytes(png)
        (SHOTS/(num+'.xml')).write_text(xml, encoding='utf-8')
        kind = classify(xml, ns)
        controls = clickable(ns)
        STATE['screens'].append({
            'index': idx, 'file': str(filename), 'sha256': hashlib.sha256(png).hexdigest(),
            'focus': focus(), 'screen_type': kind,
            'path': path, 'clickable_count': len(controls), 'clickables': controls,
            'captured_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        })
        if len(path) < MAX_DEPTH and kind == 'APP_UI':
            for node in controls:
                queue.append(path + [node])
            if any(n['scrollable'] for n in ns):
                queue.append(path + [{'kind': 'scroll'}])
    except Exception as exc:
        STATE['events'].append({'path': path, 'error': str(exc)[:350]})

STATE['attempts'] = attempts
STATE['unique_screens'] = len(STATE['screens'])
STATE['app_ui_screens'] = sum(s['screen_type'] == 'APP_UI' for s in STATE['screens'])
STATE['system_screens'] = sum(s['screen_type'] == 'SYSTEM_DIALOG' for s in STATE['screens'])
STATE['unclassified_screens'] = sum(s['screen_type'] == 'STARTUP_OR_UNKNOWN' for s in STATE['screens'])
STATE['remaining_paths'] = len(queue)
STATE['elapsed_seconds'] = round(time.monotonic()-start, 2)
if not STATE['screens']:
    STATE['blocked_reason'] = 'NO_REAL_SCREEN_CAPTURED'
elif not STATE['app_ui_screens']:
    STATE['blocked_reason'] = 'ONLY_SPLASH_OR_SYSTEM_CAPTURED'
(BASE/'logcat-tail.txt').write_bytes(sh('logcat', '-d', '-t', '400', timeout=40).stdout[-150000:])
(BASE/'screens.json').write_text(json.dumps(STATE, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in STATE.items() if k not in ('screens', 'events')}, ensure_ascii=False, indent=2))
if not STATE['app_ui_screens']:
    raise SystemExit(31)