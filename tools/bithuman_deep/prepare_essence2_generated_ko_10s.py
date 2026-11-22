#!/usr/bin/env python3
"""Build a Korean-language *synthetic TEST fixture*, never label it user M4A."""
from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import subprocess

KOREAN_TEST_TEXT = (
    "안녕하세요. 비트휴먼 에센스 투 소피아 한국어 음성 동기화 시험입니다. "
    "지금부터 한국어 문장을 자연스럽게 읽으며 음성과 입 모양이 함께 움직이는지 확인하겠습니다. "
    "음성이 끝나면 대기 화면으로 돌아가야 합니다. "
    "다시 한번 한국어 음성과 영상이 맞는지 확인하겠습니다. 감사합니다."
)
KOREAN_VOICE = "ko-KR-SunHiNeural"


def run(*argv: str) -> None:
    subprocess.run(list(argv), check=True)


def generate(output_pcm: Path, proof: Path, scratch: Path) -> None:
    import edge_tts

    scratch.mkdir(parents=True, exist_ok=True)
    output_pcm.parent.mkdir(parents=True, exist_ok=True)
    proof.parent.mkdir(parents=True, exist_ok=True)
    mp3 = scratch / "generated-ko-KR-SunHiNeural.mp3"
    m4a = scratch / "generated-ko-KR-SunHiNeural.m4a"

    async def save_ko():
        await edge_tts.Communicate(KOREAN_TEST_TEXT, voice=KOREAN_VOICE).save(str(mp3))

    asyncio.run(save_ko())
    if not mp3.is_file() or mp3.stat().st_size < 1000:
        raise RuntimeError("Korean TTS returned no audio; FAIL rather than inserting English audio")
    run("ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y",
        "-i", str(mp3), "-vn", "-c:a", "aac", "-b:a", "128k", str(m4a))
    run("python3", "tools/bithuman_deep/prepare_essence2_korean_10s.py",
        "--input-m4a", str(m4a), "--output-pcm", str(output_pcm),
        "--report", str(proof))
    data = output_pcm.read_bytes()
    if len(data) != 480_000 or not any(data):
        raise RuntimeError("Korean fixture invalid; refuse English fallback")
    result = json.loads(proof.read_text())
    result.update({
        "language": "ko-KR",
        "voice": KOREAN_VOICE,
        "speech_text": KOREAN_TEST_TEXT,
        "source_kind": "GENERATED_KOREAN_TEST_VOICE_NOT_USER_ORIGINAL_M4A",
        "english_fallback": False,
    })
    proof.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print("PASS_KOREAN_SPEECH_10S_NO_ENGLISH_FALLBACK")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--output-pcm", required=True, type=Path)
    ap.add_argument("--report", required=True, type=Path)
    ap.add_argument("--scratch", required=True, type=Path)
    a = ap.parse_args()
    generate(a.output_pcm, a.report, a.scratch)
