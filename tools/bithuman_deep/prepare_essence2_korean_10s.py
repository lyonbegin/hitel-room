#!/usr/bin/env python3
"""Prepare a user-supplied Korean M4A for the EXISTING Essence2 voice fixture.

Only the app test fixture's bytes change. The original Kotlin/Dart renderer,
Essence2 model, vendor JNI, A/V clocks, and local mock protocol are untouched.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

SAMPLE_RATE = 24_000
CHANNELS = 1
SAMPLE_WIDTH = 2
DURATION = 10.0
BYTES_EXPECTED = round(SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH * DURATION)


def run(args):
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-m4a', type=Path, required=True)
    parser.add_argument('--output-pcm', type=Path, required=True)
    parser.add_argument('--start-seconds', type=float, default=0)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    if not args.input_m4a.is_file():
        parser.error(f'Original audio is unavailable: {args.input_m4a}')
    if args.start_seconds < 0:
        parser.error('--start-seconds must be >= 0')
    probe = json.loads(run([
        'ffprobe','-v','error','-select_streams','a:0','-show_entries',
        'stream=codec_name,sample_rate,channels:format=duration','-of','json',str(args.input_m4a)
    ]))
    if not probe.get('streams'):
        parser.error('No audio track in source M4A')
    duration = float(probe.get('format', {}).get('duration', 0))
    if duration and duration < args.start_seconds + DURATION:
        parser.error(f'Source is too short for a full 10-second extract: {duration:.3f}s')
    args.output_pcm.parent.mkdir(parents=True, exist_ok=True)
    try:
        run([
            'ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',
            '-i',str(args.input_m4a),'-map','0:a:0','-ss',str(args.start_seconds),
            '-t',str(DURATION),'-ac',str(CHANNELS),'-ar',str(SAMPLE_RATE),
            '-c:a','pcm_s16le','-f','s16le',str(args.output_pcm)
        ])
        data = args.output_pcm.read_bytes()
        if len(data) != BYTES_EXPECTED:
            raise RuntimeError(f'Unexpected PCM length: {len(data)} (expected {BYTES_EXPECTED})')
        if len(data) == 0 or not any(data):
            raise RuntimeError('PCM is empty or silent')
        report = {
            'status':'PASS_ESSENCE2_KOREAN_VOICE_FIXTURE_10S',
            'source_codec':probe['streams'][0].get('codec_name'),
            'source_sample_rate':probe['streams'][0].get('sample_rate'),
            'source_channels':probe['streams'][0].get('channels'),
            'source_duration_seconds':duration,
            'source_sha256':hashlib.sha256(args.input_m4a.read_bytes()).hexdigest(),
            'selection_start_seconds':args.start_seconds,
            'output_format':'PCM16LE mono 24000Hz',
            'output_duration_seconds':DURATION,
            'output_bytes':len(data),
            'output_sha256':hashlib.sha256(data).hexdigest(),
            'changes':'test audio fixture only; no Kotlin/Dart/SDK/player changes',
            'validated':'format and byte length only; phone video/audio output not tested',
        }
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except Exception:
        args.output_pcm.unlink(missing_ok=True)
        raise


if __name__ == '__main__':
    main()
