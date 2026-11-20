#!/usr/bin/env python3
"""Wait for actual native drain and subsequent idle presentation, not response.done."""
import argparse
import json
from pathlib import Path
import subprocess
import time

from analyze_essence2_e2trace import parse_line


def playout_complete(text):
    rows = [parse_line(line) for line in text.splitlines()]
    fatal = next((r for r in reversed(rows) if r.get('stage') == 'speech.playback.exception'), None)
    if fatal:
        return False, 'fatal_speech_playback:' + fatal.get('message', fatal.get('errorClass', 'unknown'))
    drain = next((row for row in reversed(rows)
                  if row.get('stage') == 'sdk.utterance.drained'), None)
    if drain is None:
        return False, 'native_utterance_not_drained'
    preparing = next((r for r in reversed(rows) if r.get('stage') == 'speech.prepare.begin'), None)
    if preparing and preparing.get('utterance') != drain.get('utterance'):
        return False, 'latest_prepared_utterance_not_drained'
    epochs = [int(row.get('epoch', '0')) for row in rows
              if row.get('stage') in ('speech.cancel', 'speech.prepare.begin')]
    if epochs and int(drain.get('epoch', '-1')) != max(epochs):
        return False, 'latest_utterance_not_drained'
    shown = [row for row in rows if row.get('stage') == 'display.present']
    if not any(row.get('newMouthFrame') == 'true' for row in shown):
        return False, 'no_speech_mouth_presented'
    if not shown:
        return False, 'no_presentation'
    last = shown[-1]
    if last.get('kind') != 'I':
        return False, 'voice_still_playing'
    if last.get('epoch') != drain.get('epoch'):
        return False, 'idle_epoch_does_not_match_drained_utterance'
    if int(last.get('monotonicNs', '0')) <= int(drain.get('monotonicNs', '0')):
        return False, 'idle_frame_predates_native_drain'
    if int(last.get('speechPresented', '0')) <= 0:
        return False, 'no_speech_presented'
    return True, 'native_drained_and_speaker_returned_to_idle'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--timeout', type=float, default=300)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    reason = 'not_started'
    while time.monotonic() - started < args.timeout:
        result = subprocess.run(['adb', 'shell', 'run-as',
            'ai.bithuman.example.avatar_chat.essence2', 'cat',
            './app_flutter/hitel_e2_trace.log'], capture_output=True,
            text=True, timeout=20, encoding='utf-8', errors='replace')
        if result.returncode:
            raise SystemExit('FAIL_NATIVE_TRACE_READ:' + result.stderr)
        complete, reason = playout_complete(result.stdout)
        if reason.startswith('fatal_speech_playback:'):
            (args.output/'native-function-trace-after-voice.txt').write_text(result.stdout, encoding='utf-8')
            raise SystemExit('FAIL_' + reason)
        if complete:
            (args.output/'native-function-trace-after-voice.txt').write_text(
                result.stdout, encoding='utf-8')
            (args.output/'playout-complete.json').write_text(json.dumps({
                'completed': True, 'reason': reason,
                'wait_seconds': round(time.monotonic() - started, 2)
            }, indent=2) + '\n', encoding='utf-8')
            print('PASS_NATIVE_UTTERANCE_AND_COMPLETE_SPEAKER_PLAYOUT')
            return
        print('PENDING_SPEAKER_PLAYOUT:' + reason, flush=True)
        time.sleep(3)
    (args.output/'playout-complete.json').write_text(json.dumps({
        'completed': False, 'reason': reason, 'timeout_seconds': args.timeout
    }, indent=2) + '\n', encoding='utf-8')
    raise SystemExit('FAIL_SPEAKER_PLAYOUT_NOT_COMPLETED:' + reason)


if __name__ == '__main__':
    main()

