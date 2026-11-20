#!/usr/bin/env python3
"""Functional emulator acceptance; realtime display throughput is reported separately.

The user explicitly accepts slow ARM translation. Require the whole native render,
the complete speaker buffer, and changing frames clocked across the spoken reply.
"""
import argparse
import json
from pathlib import Path
from analyze_essence2_e2trace import parse_line


def verify(path):
    rows = [parse_line(line) for line in path.read_text(errors='replace').splitlines()]
    drain = next((r for r in reversed(rows) if r.get('stage') == 'sdk.utterance.drained'), None)
    assert drain, 'Actual speaker playout did not complete'
    total = int(drain['total16k'])
    assert total >= 32000 and int(drain['played16k']) >= total, 'Incomplete voice buffer'
    turn = drain.get('utterance')
    preparing = next(r for r in reversed(rows) if r.get('stage') == 'speech.prepare.begin')
    assert preparing.get('utterance') == turn, 'A newer reply is still rendering'
    render = next(r for r in reversed(rows) if r.get('stage') == 'sdk.render.complete')
    assert int(render['frames']) >= int(render['expected']) - 1, 'Incomplete native render'
    write = next(r for r in reversed(rows) if r.get('stage') == 'audio.track.write')
    assert int(write['returnedBytes']) == int(write['pcmBytes']) == total * 2, 'Incomplete PCM write'
    shown = [r for r in rows if r.get('stage') == 'display.present'
             and r.get('kind') == 'S' and r.get('utterance') == turn]
    assert len(shown) >= 10, 'No meaningful speech-frame presentation'
    pts = [int(r['pts24k']) for r in shown]
    clocks = [int(r['deviceClock24k']) for r in shown]
    assert all(b > a for a, b in zip(pts, pts[1:])), 'Mouth frame positions are not increasing'
    assert all(b >= a for a, b in zip(clocks, clocks[1:])), 'Speaker clock moved backwards'
    assert all(h >= p for h, p in zip(clocks, pts)), 'Future mouth displayed before its voice'
    assert pts[0] <= 24000 and pts[-1] >= total * 3 // 2 - 24000, 'Frames do not span the spoken reply'
    lags = sorted((h-p)/24 for h, p in zip(clocks, pts))
    return {'functional_playback_passed': True, 'voice_seconds': total/16000,
            'native_frames': int(render['frames']), 'presented_frames': len(shown),
            'presentation_fps': len(shown)/(total/16000),
            'presentation_lag_ms_p95': lags[int((len(lags)-1)*.95)],
            'presentation_lag_ms_max': max(lags),
            'realtime_25fps_required_on_emulator': False,
            'physical_device_tested': False, 'real_ai_tested': False}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--trace', required=True, type=Path)
    p.add_argument('--report', required=True, type=Path)
    a = p.parse_args()
    result = verify(a.trace)
    a.report.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))
    print('PASS_COMPLETE_NATIVE_RENDER_SPEAKER_BUFFER_AND_AUDIO_CLOCKED_MOUTH_FRAMES')

