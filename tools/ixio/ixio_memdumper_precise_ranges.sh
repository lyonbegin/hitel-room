#!/usr/bin/env bash
# Run upstream kp7742/MemDumper using its existing --manual --fast mode, one
# ACTUAL contiguous IXIO code mapping per request. No custom memory reader.
set -u -o pipefail
OUT="ixio-lab-results/memdumper-precise"
BIN="/data/local/tmp/ixio-memdumper"
RUNNER="/data/local/tmp/ixio-md-range-runner.sh"
PRIVATE=".ixio-memdumper-precise-private"
CERT="tools/ixio/dump-public-20261115.crt"
mkdir -p "$OUT" "$PRIVATE"
test -s .ixio-tools/memdumper && test -f "$CERT" || exit 2
adb push .ixio-tools/memdumper "$BIN" >/dev/null || exit 2
adb push tools/ixio/ixio_memdumper_plan_runner.sh "$RUNNER" >/dev/null || exit 2
adb shell chmod 755 "$BIN" "$RUNNER" || exit 2
success=0
for pkg in com.lguplus.aicallagent com.lguplus.callrecorder; do
 group=main
 test "$pkg" = com.lguplus.callrecorder && group=recorder
 mkdir -p "$OUT/$group"
 adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
 (adb shell monkey -p "$pkg" 1 > "$OUT/$group/launch.log" 2>&1) &
 launcher=$!
 pids=""
 for tick in $(seq 1 60); do
   pids="$(adb shell su -c "pidof $pkg" 2>/dev/null | tr -d '\r')" || true
   test -n "$pids" && break
   sleep 0.1
 done
 adb shell su -c 'ps -A -o PID,NAME' > "$OUT/$group/ps.txt" 2>&1 || true
 remote="$(awk -v pkg="$pkg" 'index($NF,pkg":")==1 && $1 ~ /^[0-9]+$/ {print $1}' "$OUT/$group/ps.txt" | xargs)" || true
 pids="$(printf '%s\n%s\n' "$pids" "$remote" | tr ' ' '\n' | awk '/^[0-9]+$/ {print}' | sort -un | xargs)" || true
 echo "PIDS=$pids" | tee -a "$OUT/$group/status.env"
 wait "$launcher" || true
 for pid in $pids; do
   maps="$OUT/$group/maps-$pid.txt"
   plan="$OUT/$group/plan-$pid.tsv"
   metadata="$OUT/$group/ranges-$pid.json"
   adb shell su -c "cat /proc/$pid/maps" > "$maps" 2>&1 || true
   python3 - "$maps" "$pkg" "$plan" "$metadata" <<'PY'
import sys, json, pathlib
maps,pkg,plan,report=sys.argv[1:]
allowed=(".apk",".dex",".cdex",".so",".oat",".odex",".vdex")
regions=[]; tasks=[]; chunk=2*1024*1024
try: lines=pathlib.Path(maps).read_text().splitlines()
except Exception: lines=[]
for line in lines:
  cols=line.split(None,5)
  if len(cols)<6: continue
  vma,perms,offset,dev,inode,path=cols
  lo,hi=(int(v,16) for v in vma.split("-",1))
  original=path.replace(" (deleted)","")
  app_file=((original.startswith("/data/app/") and pkg in original)
       or original.startswith("/data/user/0/"+pkg+"/")
       or original.startswith("/data/data/"+pkg+"/")) and original.endswith(allowed)
  generated=(original.startswith("[anon:dalvik-jit")
       or original.startswith("[anon:dalvik-classes")
       or original.startswith("/memfd:jit"))
  if not (app_file or generated):continue
  record={"memory_start":hex(lo),"memory_end":hex(hi),"bytes":hi-lo,
          "permissions":perms,"file_offset":int(offset,16),"path":path,
          "kind":"app_file" if app_file else "generated"}
  regions.append(record)
  if not perms.startswith("r"):continue
  for cur in range(lo,hi,chunk):
    stop=min(cur+chunk,hi)
    name=f"r{len(tasks):05d}_{cur:x}_{stop:x}.bin"
    tasks.append({"start":hex(cur),"end":hex(stop),"bytes":stop-cur,
      "name":name,"source_path":original,"source_offset":int(offset,16)+cur-lo,
      "kind":record["kind"],"permission":perms})
pathlib.Path(plan).write_text("".join(f"{x['start']}\t{x['end']}\t{x['name']}\n" for x in tasks))
pathlib.Path(report).write_text(json.dumps({"package":pkg,"regions":regions,
 "planned_chunks":tasks,"planned_count":len(tasks),
 "planned_bytes":sum(x["bytes"] for x in tasks)},indent=2))
print("PLAN",pkg,"REGIONS",len(regions),"CHUNKS",len(tasks),
"MB",round(sum(x["bytes"] for x in tasks)/1048576,2))
PY
   test -s "$plan" || { echo "PID_$pid=NO_MAPPED_APP_CODE" >> "$OUT/$group/status.env"; continue; }
   dest="/data/local/tmp/ixio-md-precise-$group-$pid"
   deviceplan="/data/local/tmp/ixio-md-plan-$group-$pid.tsv"
   adb push "$plan" "$deviceplan" >/dev/null || continue
   timeout 120 adb shell su -c "sh '$RUNNER' '$deviceplan' '$pid' '$dest' '$BIN'" \
     > "$OUT/$group/run-$pid.log" 2>&1
   echo "PID_$pid RUN_EXIT=$?" >> "$OUT/$group/status.env"
   localdir="$PRIVATE/$group-$pid"
   mkdir -p "$localdir"
   adb pull "$dest/." "$localdir" > "$OUT/$group/pull-$pid.log" 2>&1 || true
   adb shell su -c "rm -rf '$dest' '$deviceplan'" >/dev/null 2>&1 || true
   # Exact file lengths and known original APK backing bytes are checked here.
   python3 - "$metadata" "$localdir" "$group" "$OUT/$group/verify-$pid.json" <<'PY'
import sys,json,pathlib,hashlib
manifest,where,group,out=sys.argv[1:]
src=json.loads(pathlib.Path(manifest).read_text())
base=pathlib.Path(".ixio-inputs/main-splits/base.apk") if group=="main" else pathlib.Path(".ixio-inputs/recorder.apk")
base_bytes=base.read_bytes() if base.is_file() else b""
rows=[]; valid=0; exact=0; compare=0
for item in src["planned_chunks"]:
 f=pathlib.Path(where)/item["name"]
 row={k:item[k] for k in ("name","start","end","bytes","kind","source_path","source_offset")}
 row["exists"]=f.is_file()
 if not f.is_file():rows.append(row);continue
 data=f.read_bytes()
 row["actual_bytes"]=len(data)
 row["bytes_match"]=len(data)==item["bytes"]
 row["sha256"]=hashlib.sha256(data).hexdigest()
 row["all_zero"]=(not any(data))
 if row["bytes_match"] and not row["all_zero"]:valid+=1
 if item["source_path"].endswith("/base.apk") and base_bytes:
  off=item["source_offset"]
  expected=base_bytes[off:off+len(data)]
  n=len(expected)
  row["compared_bytes"]=n
  row["same_bytes"]=sum(a==b for a,b in zip(data[:n],expected))
  compare+=n;exact+=row["same_bytes"]
 rows.append(row)
pathlib.Path(out).write_text(json.dumps({"planned":len(rows),
 "files_with_valid_length_and_nonzero":valid,
 "file_backed_bytes_compared":compare,"file_backed_bytes_equal":exact,
 "observations":rows},indent=2))
print("VERIFIED",len(rows),"NONZERO_VALID",valid,"FILE_BYTES",compare,"EQUAL",exact)
PY
 done
 rawdirs="$(find "$PRIVATE" -mindepth 1 -maxdepth 1 -type d -name "$group-*" -printf '%f ')" || true
 if test -n "$rawdirs"; then
   tar -czf "$PRIVATE/$group.tar.gz" -C "$PRIVATE" $rawdirs || true
   if test -s "$PRIVATE/$group.tar.gz"; then
     if openssl cms -encrypt -binary -aes256 -in "$PRIVATE/$group.tar.gz" \
       -out "$OUT/$group/$group-memdumper-precise.cms" -outform DER -recip "$CERT"; then
       echo "ENCRYPTED_BYTES=$(stat -c '%s' "$OUT/$group/$group-memdumper-precise.cms")" \
        | tee -a "$OUT/$group/status.env"
       success=$((success+1))
     fi
   fi
 fi
done
rm -rf "$PRIVATE"
echo "ENCRYPTED_APP_GROUPS=$success" | tee "$OUT/status.env"
test "$success" -eq 2
