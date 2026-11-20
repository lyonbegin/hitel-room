#!/usr/bin/env python3
"""Require the installed APK's speech in the emulator's captured speaker output.

This checks audio beyond app/AudioTrack writes, and rejects silence, system
clicks and unrelated noise. It makes no claim about a physical speaker or AI.
"""
import argparse
import hashlib
import json
from pathlib import Path
import wave

import numpy as np


def to_8k(samples, rate):
    positions = np.arange(int(len(samples) * 8000 / rate)) * rate / 8000
    return np.interp(positions, np.arange(len(samples)), samples)


def compare(captured, reference):
    captured = np.asarray(captured, dtype=np.float64)
    reference = np.asarray(reference, dtype=np.float64)
    failures = []
    peak = float(np.max(np.abs(captured))) if len(captured) else 0.0
    rms = float(np.sqrt(np.mean(captured * captured))) if len(captured) else 0.0
    if peak < 200 or rms < 20:
        failures.append('speaker_silent_or_too_quiet')
    matches = []
    size = 6000  # 750ms at 8kHz: much longer than a system click.
    if len(reference) < 3 * size or len(captured) < size:
        failures.append('insufficient_captured_or_reference_audio')
    else:
        cumulative = np.concatenate(([0.0], np.cumsum(captured * captured)))
        energy = cumulative[size:] - cumulative[:-size]
        sums = np.concatenate(([0.0], np.cumsum(captured)))
        variance = np.maximum(energy - (sums[size:] - sums[:-size]) ** 2 / size, 0)
        for fraction in (0.15, 0.45, 0.75):
            start = min(int(len(reference) * fraction), len(reference) - size)
            segment = reference[start:start + size].copy()
            segment -= np.mean(segment)
            norm = float(np.linalg.norm(segment))
            if norm < 1:
                failures.append('silent_reference_window')
                continue
            fft_size = 1 << (len(captured) + size - 2).bit_length()
            convolution = np.fft.irfft(np.fft.rfft(captured, fft_size) *
                                      np.fft.rfft(segment[::-1], fft_size), fft_size)
            numerator = convolution[size - 1:len(captured)]
            denominator = np.sqrt(variance) * norm
            scores = np.divide(numerator, denominator, out=np.zeros_like(numerator),
                               where=denominator > 1)
            offset = int(np.argmax(np.abs(scores)))
            score = min(1.0, float(abs(scores[offset])))
            matches.append({'reference_seconds': start / 8000,
                            'speaker_seconds': offset / 8000,
                            'normalized_correlation': round(score, 6)})
            if score < 0.70:
                failures.append(f'voice_window_not_reproduced:{fraction}:{score:.4f}')
        offsets = [x['speaker_seconds'] for x in matches]
        if len(offsets) != 3 or any(b <= a for a, b in zip(offsets, offsets[1:])):
            failures.append('speech_windows_missing_or_out_of_order')
    return {'captured_peak_8k': round(peak, 2), 'captured_rms_8k': round(rms, 2),
            'captured_seconds': len(captured) / 8000,
            'reference_seconds': len(reference) / 8000,
            'voice_matches': matches, 'failures': failures,
            'virtual_speaker_speech_verified': not failures,
            'physical_speaker_tested': False, 'real_ai_tested': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wav', required=True, type=Path)
    parser.add_argument('--reference', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    result = {'virtual_speaker_speech_verified': False}
    try:
        raw_reference = args.reference.read_bytes()
        reference = np.frombuffer(raw_reference, dtype='<i2').astype(np.float64)
        with wave.open(str(args.wav), 'rb') as source:
            if source.getsampwidth() != 2:
                raise ValueError('Expected captured PCM16 speaker output')
            rate, channels = source.getframerate(), source.getnchannels()
            captured = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2')
            captured = captured.reshape(-1, channels).astype(np.float64).mean(axis=1)
        result = compare(to_8k(captured, rate), to_8k(reference, 24000))
        result.update({'speaker_sample_rate': rate, 'speaker_channels': channels,
                       'speaker_sha256': hashlib.sha256(args.wav.read_bytes()).hexdigest(),
                       'reference_sha256': hashlib.sha256(raw_reference).hexdigest()})
    except Exception as error:
        result['failures'] = [f'{type(error).__name__}:{error}']
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    if not result['virtual_speaker_speech_verified']:
        raise SystemExit('FAIL_EMULATOR_SPEAKER_SPEECH_NOT_VERIFIED')
    print('PASS_ACTUAL_APK_VOICE_RECORDED_FROM_EMULATOR_SPEAKER')


if __name__ == '__main__':
    main()
