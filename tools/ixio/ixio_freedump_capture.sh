#!/usr/bin/env bash
# Upstream androguard/Freedump for IXIO app-owned PIDs only.
set -euo pipefail
OUT="ixio-lab-results/freedump"
PRIVATE=".ixio-freedump-private"
CERT="tools/ixio/dump-public-20261115.crt"
mkdir -p "$OUT" "$PRIVATE"
trap 'rm -rf "$PRIVATE"' EXIT
test -s "$CERT"
openssl x509 -in "$CERT" -noout >/dev/null
test -x ".ixio-tools/venv/bin/frida-ps"
git clone --depth 1 https://github.com/androguard/freedump.git ".ixio-tools/freedump-upstream"
git -C ".ixio-tools/freedump-upstream" fetch --depth 1 origin cc5fbcf8728677992d66010d83aa927499777069
git -C ".ixio-tools/freedump-upstream" checkout --detach cc5fbcf8728677992d66010d83aa927499777069
git -C ".ixio-tools/freedump-upstream" rev-parse HEAD > "$OUT/upstream-commit.txt"
# Only modern-Frida compatibility patches, not a new memory dumper.
python3 - <<'PY'
from pathlib import Path
src = Path(".ixio-tools/freedump-upstream")
p = src / "freedump/__init__.py"
s = p.read_text()
assert "from freedump.helper.logging import LOGGER" in s
p.write_text(s.replace("from freedump.helper.logging import LOGGER",
                       "from freedump.helper.logging import LOGGER\nlogger = LOGGER", 1))
p = src / "freedump/memory/fridajs/core.js"
s = p.read_text()
assert "Process.enumerateRangesSync(prot)" in s
p.write_text(s.replace("Process.enumerateRangesSync(prot)",
                       "Process.enumerateRanges(prot)"))
p = src / "freedump/memory/fridajs/default.js"
s = p.read_text()
assert "Memory.readByteArray(ptr(address), size)" in s
p.write_text(s.replace("Memory.readByteArray(ptr(address), size)",
                       "ptr(address).readByteArray(size)"))
PY
.ixio-tools/venv/bin/pip install --disable-pip-version-check rich "lz4>=4.3.3" "hexdump>=3.3" -e ".ixio-tools/freedump-upstream" > "$OUT/pip.log" 2>&1
.ixio-tools/venv/bin/freedump --help > "$OUT/help.txt"
.ixio-tools/venv/bin/frida-ps -U > "$OUT/frida-process-list.txt" 2>&1
echo "TOOL=androguard/freedump" > "$OUT/status.env"
echo "SCOPE=only_ixio_app_processes" >> "$OUT/status.env"
echo "API_PATCHES=logger,Process.enumerateRanges,NativePointer.readByteArray" >> "$OUT/status.env"
pids_for() {
  local pkg="$1"
  adb shell ps -A -o PID,NAME 2>/dev/null | tr -d '\r' |
    awk -v p="$pkg" '($2 == p || index($2,p ":")==1) && $1 ~ /^[0-9]+$/ {print $1}' | sort -un
}
success_groups=0
for pair in "com.lguplus.aicallagent main" "com.lguplus.callrecorder recorder"; do
  read -r pkg group <<< "$pair"
  mkdir -p "$OUT/$group"
  adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
  adb shell monkey -p "$pkg" 1 > "$OUT/$group/launch.log" 2>&1 &
  launcher=$!
  discovered=""
  for i in $(seq 1 80); do
    discovered="$(pids_for "$pkg" | xargs)" || true
    if [ -n "$discovered" ]; then break; fi
    sleep 0.1
  done
  wait "$launcher" || true
  adb shell ps -A -o PID,NAME > "$OUT/$group/ps.txt" 2>&1 || true
  discovered="$( (printf "%s\n" "$discovered" | tr ' ' '\n'; pids_for "$pkg"; adb shell pidof "$pkg" 2>/dev/null | tr ' ' '\n') |
    awk '/^[0-9]+$/ {print}' | sort -un | xargs)" || true
  echo "PACKAGE=$pkg" > "$OUT/$group/status.env"
  echo "PIDS=$discovered" >> "$OUT/$group/status.env"
  if [ -z "$discovered" ]; then
    echo "CAPTURE=FAIL_NO_APP_PID" >> "$OUT/$group/status.env"
    continue
  fi
  group_ok=0
  for pid in $discovered; do
    dest="$PRIVATE/$group-$pid"
    mkdir -p "$dest"
    echo "FREEDUMP_START app=$group pid=$pid"
    set +e
    timeout --signal=TERM --kill-after=8s 165 \
      .ixio-tools/venv/bin/freedump -u -p "$pid" -o "$dest" \
      > "$OUT/$group/freedump-$pid.log" 2>&1
    rc=$?
    set -e
    printf 'PID_%s_FREEDUMP_EXIT=%s\n' "$pid" "$rc" >> "$OUT/$group/status.env"
    count="$(find "$dest" -name '*.dump' -type f -size +0c | wc -l)"
    printf 'PID_%s_NONEMPTY_MEMORY_REGIONS=%s\n' "$pid" "$count" >> "$OUT/$group/status.env"
    if [ "$count" -lt 1 ]; then
      tail -25 "$OUT/$group/freedump-$pid.log"
      continue
    fi
    python3 tools/ixio/ixio_freedump_validate.py --directory "$dest" \
      --output "$OUT/$group/validation-$pid.json" --originals .ixio-inputs \
      > "$OUT/$group/validation-$pid.log" 2>&1 || true
    tar -czf "$PRIVATE/$group-$pid.tar.gz" -C "$PRIVATE" "$group-$pid"
    if openssl cms -encrypt -binary -aes256 -in "$PRIVATE/$group-$pid.tar.gz" \
        -out "$OUT/$group/$group-$pid-freedump.cms" -outform DER -recip "$CERT" \
        > "$OUT/$group/encrypt-$pid.log" 2>&1; then
      printf 'PID_%s_ENCRYPTED_BYTES=%s\n' "$pid" "$(stat -c %s "$OUT/$group/$group-$pid-freedump.cms")" >> "$OUT/$group/status.env"
      group_ok=1
    else
      printf 'PID_%s_ENCRYPTION_FAILED=yes\n' "$pid" >> "$OUT/$group/status.env"
    fi
    rm -rf "$dest" "$PRIVATE/$group-$pid.tar.gz"
  done
  if [ "$group_ok" -eq 1 ]; then
    success_groups=$((success_groups+1))
    echo "CAPTURE=ENCRYPTED_AT_LEAST_ONE_PID" >> "$OUT/$group/status.env"
  else
    echo "CAPTURE=FAIL_NO_VALID_DUMP" >> "$OUT/$group/status.env"
  fi
done
echo "ENCRYPTED_APP_GROUPS=$success_groups" >> "$OUT/status.env"
test "$success_groups" -eq 2
