#!/usr/bin/env bash
# Independent third-party kp7742/MemDumper capture for TWO IXIO apps ONLY.
set -u -o pipefail
OUT="ixio-lab-results/memdumper"
TMP=".ixio-memdumper-private"
BIN="/data/local/tmp/ixio-memdumper"
CERT="tools/ixio/dump-public-20261115.crt"
mkdir -p "$OUT" "$TMP"
printf 'TOOL=kp7742/MemDumper\n' > "$OUT/status.env"
test -s .ixio-tools/memdumper && test -f "$CERT" || exit 2
adb push .ixio-tools/memdumper "$BIN" > "$OUT/push.log" 2>&1 || exit 3
adb shell chmod 755 "$BIN" || exit 3
adb shell su -c "$BIN -h" > "$OUT/help.txt" 2>&1 || true
success=0
for pkg in com.lguplus.aicallagent com.lguplus.callrecorder; do
  group=main
  test "$pkg" = com.lguplus.callrecorder && group=recorder
  mkdir -p "$OUT/$group"
  adb shell am force-stop "$pkg" > "$OUT/$group/stop.log" 2>&1 || true
  (adb shell monkey -p "$pkg" 1 > "$OUT/$group/launch.log" 2>&1) &
  launchpid=$!
  pids=""
  for tick in $(seq 1 45); do
    pids="$(adb shell su -c "pidof $pkg" 2>/dev/null | tr -d '\r')" || true
    test -n "$pids" && break
    sleep 0.1
  done
  wait "$launchpid" || true
  adb shell su -c 'ps -A -o PID,NAME' > "$OUT/$group/ps.txt" 2>&1 || true
  remote="$(awk -v pkg="$pkg" 'index($NF,pkg":")==1 && $1 ~ /^[0-9]+$/ {print $1}' "$OUT/$group/ps.txt" | xargs)" || true
  pids="$(printf '%s\n%s\n' "$pids" "$remote" | tr ' ' '\n' | awk '/^[0-9]+$/ {print}' | sort -un | xargs)" || true
  echo "PIDS=$pids" | tee -a "$OUT/$group/status.env"
  for pid in $pids; do
    maps="$OUT/$group/maps-$pid.txt"
    adb shell su -c "cat /proc/$pid/maps" > "$maps" 2>&1 || true
    # Source names from actual process maps, not a predefined DEX-count list.
    # Only own APK, native code, generated dex and named ART/JIT code mappings.
    awk -v pkg="$pkg" '{
      p=$6
      own=(index(p,"/data/app/")==1 && index(p,pkg)>0) ||
          (index(p,"/data/user/0/"pkg"/")==1) ||
          (index(p,"/data/data/"pkg"/")==1)
      if(own && p ~ /\.(apk|dex|cdex|so|oat|odex|vdex)$/) {
        sub(/.*\//,"",p); print p
      }
      if(index(p,"[anon:dalvik-jit")==1)print "dalvik-jit"
      if(index(p,"[anon:dalvik-classes")==1)print "dalvik-classes"
      if(index(p,"/memfd:jit-cache")==1)print "jit-cache"
    }' "$maps" | sort -u | head -60 > "$OUT/$group/segments-$pid.txt"
    while IFS= read -r segment; do
      test -n "$segment" || continue
      safe="$(printf '%s' "$segment" | tr -c 'A-Za-z0-9_.-' '_')"
      devdir="/data/local/tmp/ixio-md-$group-$pid-$safe"
      adb shell su -c "mkdir -p '$devdir'" >/dev/null 2>&1 || true
      timeout 30 adb shell su -c "$BIN -i $pid -n '$segment' -o '$devdir'" \
        > "$OUT/$group/dump-$pid-$safe.log" 2>&1
      rc=$?
      echo "PID_$pid SEGMENT=$segment EXIT=$rc" >> "$OUT/$group/status.env"
      host="$TMP/$group-$pid-$safe"
      mkdir -p "$host"
      adb pull "$devdir/." "$host" > "$OUT/$group/pull-$pid-$safe.log" 2>&1 || true
      adb shell su -c "rm -rf '$devdir'" >/dev/null 2>&1 || true
    done < "$OUT/$group/segments-$pid.txt"
  done
  if find "$TMP" -type f -path "*/$group-*" -size +0c | grep -q .; then
    find "$TMP" -type f -path "*/$group-*" -printf '%p %s bytes\n' > "$OUT/$group/files.txt"
    folders="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d -name "$group-*" -printf '%f ')"
    tar -czf "$TMP/$group.tar.gz" -C "$TMP" $folders || true
    if test -s "$TMP/$group.tar.gz"; then
      if openssl cms -encrypt -binary -aes256 -in "$TMP/$group.tar.gz" \
           -out "$OUT/$group/$group-memdumper.cms" -outform DER -recip "$CERT" \
           > "$OUT/$group/encrypt.log" 2>&1; then
        echo "ENCRYPTED_BYTES=$(stat -c '%s' "$OUT/$group/$group-memdumper.cms")" \
          | tee -a "$OUT/$group/status.env"
        success=$((success+1))
      fi
    fi
  fi
done
rm -rf "$TMP"
echo "APP_DUMPS_SUCCEEDED=$success" | tee -a "$OUT/status.env"
test "$success" -eq 2
