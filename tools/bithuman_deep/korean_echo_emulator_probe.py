#!/usr/bin/env python3
"""Use the installed app's real text field, local WebSocket, TTS and avatar sink."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time

PACKAGE = 'ai.bithuman.example.avatar_chat.essence2'
OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)


def adb(*args, binary=False):
    return subprocess.check_output(['adb', *args], timeout=40, text=not binary)


def traces():
    native = adb('shell', 'run-as', PACKAGE, 'cat', './app_flutter/hitel_e2_trace.log')
    protocol = adb('shell', 'run-as', PACKAGE, 'cat', './app_flutter/hitel_ai_e2e.log')
    (OUT / 'final-native-trace.txt').write_text(native)
    (OUT / 'final-ai-protocol.txt').write_text(protocol)
    return native, protocol


def screenshot(name):
    (OUT / name).write_bytes(adb('exec-out', 'screencap', '-p', binary=True))


def submit(text):
    size = re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1]
    width, height = map(int, size)
    adb('shell', 'input', 'tap', str(width // 2), str(height // 2))
    time.sleep(.2)
    adb('shell', 'input', 'tap', str(width * 35 // 100), str(height * 93 // 100))
    time.sleep(1)
    focus = adb('shell', 'dumpsys', 'input_method')
    (OUT / 'ime-focus.txt').write_text(focus)
    assert re.search(r'mInputShown=true|mShowRequested=true', focus), 'Input field not focused'
    encoded = base64.b64encode(text.encode()).decode()
    adb('shell', 'am', 'broadcast', '-a', 'ai.hitel.debug.ECHO_CLIPBOARD', '-p', PACKAGE,
        '--es', 'text_b64', encoded)
    adb('shell', 'input', 'keyevent', 'KEYCODE_PASTE')
    time.sleep(.5)
    screenshot('korean-input-filled.png')
    adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER')
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')


def fields(line):
    return dict(re.findall(r'([\w.]+)=([^\s]+)', line))


try:
    adb('shell', 'cmd', 'media_session', 'volume', '--stream', '3', '--set', '15')
    samples = [
        '안녕하세요. 반갑습니다.',
        '오늘은 한국어 음성을 시험합니다. 입력한 문장을 그대로 읽어 드립니다. '
        '첫 번째 문장을 읽는 동안 다음 문장의 음성을 만듭니다. '
        '입 모양도 같은 음성에 맞추어 움직입니다. 끝까지 잘 들리는지 확인해 주십시오.',
    ]
    evidence = []
    for index, text in enumerate(samples):
        submit(text)
        expected_hash = hashlib.sha256(text.encode()).hexdigest()
        started = time.monotonic()
        last_notice = started
        while time.monotonic() - started < 480:
            native, protocol = traces()
            events = [fields(line) for line in native.splitlines()]
            begin = next((e for e in events if e.get('stage') == 'tts.begin'
                          and e.get('inputSha256') == expected_hash), None)
            if begin:
                turn = begin['turn']
                done = next((e for e in events if e.get('stage') == 'tts.done' and e.get('turn') == turn), None)
                after = [e for e in events if int(e.get('monotonicNs', 0)) >= int(begin['monotonicNs'])]
                presents = [e for e in after if e.get('stage') == 'display.present' and e.get('kind') == 'S']
                drained = [e for e in after if e.get('stage') == 'sdk.utterance.drained']
                idle_after = bool(drained and any(e.get('stage') == 'display.present' and e.get('kind') == 'I'
                    and int(e['monotonicNs']) > int(drained[-1]['monotonicNs']) for e in after))
                if done and presents and drained and idle_after and f'echo.done turn={turn}' in protocol:
                    first = next(e for e in after if e.get('stage') == 'tts.first_pcm' and e.get('turn') == turn)
                    writes = [e for e in after if e.get('stage') == 'audio.track.write' and e.get('kind') in ('S', 'C')]
                    assert writes and all(e['returnedBytes'] == e['pcmBytes'] for e in writes)
                    assert int(first['monotonicNs']) < int(done['monotonicNs'])
                    evidence.append({'input_sha256': expected_hash, 'turn': turn,
                        'samples24k': int(done['samples24k']), 'pcm_sha256': done['pcmSha256'],
                        'mouth_frames_presented': len(presents), 'returned_to_idle': idle_after,
                        'first_pcm_before_tts_done': True,
                        'first_speaker_write_before_tts_done': int(writes[0]['monotonicNs']) < int(done['monotonicNs']),
                        'first_frame_before_tts_done': int(presents[0]['monotonicNs']) < int(done['monotonicNs'])})
                    # Save the exact neural output actually sent through the installed app.
                    (OUT / f'korean-echo-{index}.pcm').write_bytes(adb('exec-out', 'run-as', PACKAGE,
                        'cat', './files/hitel-echo-latest.pcm', binary=True))
                    assert hashlib.sha256((OUT / f'korean-echo-{index}.pcm').read_bytes()).hexdigest() == done['pcmSha256']
                    screenshot(f'korean-echo-{index}-played.png')
                    print('PASS_KOREAN_TEXT_ECHO_TTS_NATIVE_PLAYBACK', json.dumps(evidence[-1]), flush=True)
                    break
            if 'stage=tts.error ' in native or 'echo.error' in protocol:
                raise AssertionError('Local Korean TTS failed; see on-device traces')
            if time.monotonic() - last_notice > 25:
                print(f'Korean turn {index + 1}: waiting for on-device synthesis/playback, elapsed={time.monotonic() - started:.0f}s', flush=True)
                print('\n'.join(native.splitlines()[-3:]), flush=True)
                last_notice = time.monotonic()
            time.sleep(4)
        else:
            raise AssertionError('Korean echo did not finish actual speech playback')
    assert evidence[0]['pcm_sha256'] != evidence[1]['pcm_sha256'], 'Different input reused fixed audio'
    (OUT / 'korean-echo-acceptance.json').write_text(json.dumps({
        'status': 'PASS', 'installed_app': PACKAGE, 'offline': True, 'inputs': evidence,
        'physical_audibility_verified': False}, indent=2) + '\n')
    print('PASS_KOREAN_ECHO_TWO_DIFFERENT_TEXTS_NO_FIXED_AUDIO', flush=True)
finally:
    traces()
    (OUT / 'full-logcat.txt').write_text(adb('logcat', '-d', '-v', 'time'))
