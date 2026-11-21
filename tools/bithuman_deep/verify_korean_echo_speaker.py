#!/usr/bin/env python3
"""Measure the captured virtual speaker against the installed app's neural PCM.

This reports capture quality separately from functional app acceptance: QEMU's
WAV backend can drop host buffers. It never fabricates or substitutes audio.
"""
import argparse
import json
from pathlib import Path
import wave
import numpy as np
from scipy.signal import fftconvolve, resample_poly


def verify(root):
    captured = next(root.rglob('emulator-speaker.wav'))
    with wave.open(str(captured), 'rb') as reader:
        assert reader.getsampwidth() == 2
        channels, rate = reader.getnchannels(), reader.getframerate()
        audio = np.frombuffer(reader.readframes(reader.getnframes()), '<i2').astype(np.float64)
        audio = audio.reshape(-1, channels).mean(axis=1)
    signal = resample_poly(audio, 8000, rate)
    square = np.concatenate(([0.0], np.cumsum(signal ** 2)))
    results = []
    for path in sorted(root.rglob('korean-echo-*.pcm')):
        native = np.frombuffer(path.read_bytes(), '<i2').astype(np.float64)
        reference = resample_poly(native, 1, 3)  # actual original player's wire is 24 kHz
        window = min(3200, len(reference))
        assert window > 0
        anchors = []
        for fraction in (.2, .5, .8):
            start = max(0, min(int(len(reference) * fraction) - window // 2, len(reference) - window))
            pattern = reference[start:start + window]
            pattern = pattern - pattern.mean()
            power = np.dot(pattern, pattern)
            if power < window * 20 ** 2:
                continue
            cross = fftconvolve(signal, pattern[::-1], mode='valid')
            energy = np.maximum(1.0, square[window:] - square[:-window])
            correlation = cross / np.sqrt(energy * power)
            at = int(np.argmax(correlation))
            anchors.append({'reference_seconds': start / 8000, 'speaker_seconds': at / 8000,
                            'ncc': float(correlation[at])})
        results.append({'reference': path.name, 'samples24k': len(native),
                        'peak': float(np.max(np.abs(native))),
                        'rms': float(np.sqrt(np.mean(native ** 2))), 'anchors': anchors,
                        'capture_match': any(a['ncc'] >= .65 for a in anchors)})
    report = {'captured_file': str(captured), 'capture_rate': rate,
              'capture_channels': channels, 'capture_seconds': len(signal) / 8000,
              'capture_peak': float(np.max(np.abs(signal))), 'references': results,
              'status': 'MATCHED' if len(results) >= 2 and all(r['capture_match'] for r in results)
                        else 'CAPTURE_UNVERIFIED', 'physical_device_audibility': False}
    (root / 'korean-speaker-correlation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('evidence', type=Path)
    verify(parser.parse_args().evidence)
