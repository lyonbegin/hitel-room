#!/usr/bin/env python3
"""Build the existing HITEL education UI as a static GitHub Pages project site.

Only the deploy output is rewritten; the Railway source files are preserved.
Server-only /api routes are deliberately NOT rewritten or mocked.
"""
from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public"
OUTPUT = ROOT / "_pages_site"
ENTRY = "ypt-rebuild.html"
REWRITE_TYPES = {".html", ".js", ".css"}
LITERAL = re.compile(r"""(?P<quote>["'])/(?P<path>[^"'\r\n]{0,250})(?P=quote)""")
CSS_URL = re.compile(r"""(?i)\burl\(\s*/(?P<path>[^)\s]+)\s*\)""")
REFERENCES = re.compile(r"""(?i)\b(?:src|href|poster)\s*=\s*["']([^"']+)["']""")

repository = os.environ.get("GITHUB_REPOSITORY", "lyonbegin/hitel-room")
repo_name = repository.rsplit("/", 1)[-1].strip()
BASE = "/" + repo_name + "/"

if not SOURCE.is_dir() or not (SOURCE / ENTRY).is_file():
    raise SystemExit("PAGES_BUILD_ERROR: public/ypt-rebuild.html not found")
if not repo_name or "/" in repo_name:
    raise SystemExit("PAGES_BUILD_ERROR: invalid repository name")

if OUTPUT.exists():
    shutil.rmtree(OUTPUT)
shutil.copytree(
    SOURCE, OUTPUT,
    ignore=shutil.ignore_patterns(".DS_Store", "__pycache__", "*.pyc"),
)
top_level = {p.name for p in SOURCE.iterdir()}
counts = {"rewritten_files": 0, "rewritten_urls": 0}


def is_public_path(value: str) -> bool:
    if not value:
        return True
    first = re.split(r"[/#?]", value, maxsplit=1)[0]
    return first in top_level


def rewrite_source(text: str) -> str:
    updates = 0

    def quoted(match: re.Match[str]) -> str:
        nonlocal updates
        value = match.group("path")
        if value.startswith("/") or not is_public_path(value):
            return match.group(0)
        updates += 1
        quote = match.group("quote")
        return quote + BASE + value + quote

    def css_url(match: re.Match[str]) -> str:
        nonlocal updates
        value = match.group("path")
        if not is_public_path(value):
            return match.group(0)
        updates += 1
        return "url(" + BASE + value + ")"

    text = LITERAL.sub(quoted, text)
    text = CSS_URL.sub(css_url, text)
    if updates:
        counts["rewritten_files"] += 1
        counts["rewritten_urls"] += updates
    return text


for path in OUTPUT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in REWRITE_TYPES:
        continue
    try:
        original = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise SystemExit("PAGES_BUILD_ERROR: invalid UTF-8 " + str(path))
    converted = rewrite_source(original)
    if converted != original:
        path.write_text(converted, encoding="utf-8")

landing = (OUTPUT / ENTRY).read_text(encoding="utf-8")
(OUTPUT / "index.html").write_text(landing, encoding="utf-8")
(OUTPUT / ".nojekyll").write_text("", encoding="utf-8")

missing = []
for ref in REFERENCES.findall(landing):
    if not ref.startswith(BASE):
        continue
    parsed = urlsplit(ref)
    local_name = parsed.path[len(BASE):]
    if local_name and not (OUTPUT / local_name).is_file():
        missing.append(local_name)
if missing:
    raise SystemExit("PAGES_BUILD_ERROR: missing landing assets: " + ", ".join(sorted(set(missing))))

print(
    f"PAGES_STATIC_BUILD_OK base={BASE} entry={ENTRY} "
    f"rewritten_files={counts['rewritten_files']} "
    f"rewritten_urls={counts['rewritten_urls']}"
)
print("PAGES_STATIC_LIMITATION: /api endpoints need a separately hosted backend")
print("PAGES_STATIC_LIMITATION: browser-local data is not cross-device synced")
