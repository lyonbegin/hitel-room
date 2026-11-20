#!/usr/bin/env python3
"""Install the built app, open the real key form, and record its actual scope.

No secret is entered; no vendor network or native-engine success is inferred.
ADB coordinate selection uses bounds read from the actual UI hierarchy.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

APP = 'ai.bithuman.example.avatar_chat.essence2'


def adb(*args):
    return subprocess.check_output(['adb', *args], stderr=subprocess.STDOUT,
                                   timeout=120).decode(errors='replace')


def wait_for_node(text, deadline, output):
    diagnostics = []
    while time.monotonic() < deadline:
        try:
            dump = adb('shell', 'uiautomator', 'dump', '--compressed', '/sdcard/hitel-auth-ui.xml')
            diagnostics.append(dump)
            xml = adb('shell', 'cat', '/sdcard/hitel-auth-ui.xml')
            root = ET.fromstring(xml[xml.index('<?xml'):])
            (output / 'last-ui.xml').write_text(xml, encoding='utf-8')
            for node in root.iter('node'):
                if text in node.get('text', '') or text in node.get('content-desc', ''):
                    return node, xml
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired,
                ValueError, ET.ParseError) as error:
            # uiautomator can report success before writing its XML while a
            # fresh Flutter activity is starting. Retain evidence and retry the
            # observation, not the install or a guessed coordinate click.
            diagnostics.append(str(error))
            data = getattr(error, 'output', b'') or b''
            diagnostics.append(data.decode(errors='replace') if isinstance(data, bytes) else str(data))
        (output / 'ui-observer.txt').write_text('\n'.join(diagnostics), encoding='utf-8')
        time.sleep(2)
    raise RuntimeError('Expected UI node did not appear: ' + text)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--apk', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args()
    a.output.mkdir(parents=True, exist_ok=True)
    result = {
        'test_scope': 'INSTALL_AND_REAL_CREDENTIAL_FORM_ONLY',
        'package': APP, 'apk_sha256': hashlib.sha256(a.apk.read_bytes()).hexdigest(),
        'installed': False, 'credential_form_displayed': False,
        'credential_submitted': False, 'engine_authenticated': False,
        'model_rendered': False, 'lipsync_verified': False,
        'physical_audibility_verified': False,
        'final_status': 'INCOMPLETE',
    }
    try:
        result['primary_abi'] = adb('shell', 'getprop', 'ro.product.cpu.abi').strip()
        result['qemu'] = adb('shell', 'getprop', 'ro.kernel.qemu').strip()
        installation = adb('install', '-r', str(a.apk))
        (a.output / 'adb-install.txt').write_text(installation)
        if 'Success' not in installation:
            raise RuntimeError('adb did not confirm installation')
        result['installed'] = True
        adb('logcat', '-c')
        launch = adb('shell', 'am', 'start', '-S', '-n', APP + '/ai.bithuman.example.avatar_chat.MainActivity')
        (a.output / 'adb-launch.txt').write_text(launch, encoding='utf-8')
        if 'Error' in launch or 'Exception' in launch:
            raise RuntimeError('Activity launch failed: ' + launch)
        node, _ = wait_for_node('Load Essence 2 avatar', time.monotonic() + 120, a.output)
        bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if bounds is None:
            raise RuntimeError('Button has no usable UI bounds')
        x1, y1, x2, y2 = map(int, bounds.groups())
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
        _, xml = wait_for_node('metering_no_credential', time.monotonic() + 90, a.output)
        if 'bitHuman API secret' not in xml or 'Save and start' not in xml:
            raise RuntimeError('Credential refusal appeared without the credential form')
        logs = adb('logcat', '-d', '-v', 'time')
        if 'FATAL EXCEPTION' in logs or 'boot:load:ok' in logs or 'hitel:essence2:local_test_session_started' in logs:
            raise RuntimeError('Crash or unexpected engine/mock boot during missing-key test')
        (a.output / 'credential-form.xml').write_text(xml, encoding='utf-8')
        (a.output / 'credential-form-logcat.txt').write_text(logs, encoding='utf-8')
        result['credential_form_displayed'] = True
        result['final_status'] = 'UI_SMOKE_PASSED_ENGINE_BLOCKED_MISSING_API_SECRET'
        print('PASS_INSTALLED_APP_DISPLAYS_REAL_VENDOR_KEY_FORM')
    finally:
        # Always retain app failure evidence, even before the first UI dump.
        try:
            (a.output / 'final-logcat.txt').write_text(adb('logcat', '-d', '-v', 'time'), encoding='utf-8')
            screen = subprocess.check_output(['adb', 'exec-out', 'screencap', '-p'], timeout=20)
            (a.output / 'final-screen.png').write_bytes(screen)
        except (subprocess.SubprocessError, OSError) as error:
            (a.output / 'capture-error.txt').write_text(str(error), encoding='utf-8')
        (a.output / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
