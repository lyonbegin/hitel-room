#!/system/bin/sh
# Shell-only invocation wrapper for unmodified upstream kp7742/MemDumper.
# Every requested address pair is an individual real /proc/PID/maps VMA chunk.
plan="$1"
pid="$2"
dest="$3"
bin="$4"
mkdir -p "$dest" || exit 6
tab="$(printf '\t')"
completed=0
failed=0
while IFS="$tab" read -r start end name; do
  test -n "$start" || continue
  "$bin" -i "$pid" -m -f -s "$start" -e "$end" -n "$name" -o "$dest" \
    >> "$dest/tool-output.log" 2>&1
  rc=$?
  echo "$start $end $name $rc" >> "$dest/status.log"
  if [ "$rc" -eq 0 ]; then completed=$((completed+1)); else failed=$((failed+1)); fi
done < "$plan"
echo "completed=$completed failed=$failed" >> "$dest/status.log"
test "$failed" -eq 0
