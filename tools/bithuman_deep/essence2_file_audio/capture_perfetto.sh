#!/usr/bin/env bash
set -euo pipefail

duration=${1:-90}
if [[ ! "$duration" =~ ^[1-9][0-9]{0,2}$ ]]; then
    echo "Usage: bash capture_perfetto.sh [seconds (1-999)] [output-directory]" >&2
    exit 2
fi
out=${2:-hitel-essence2-trace-$(date +%Y%m%d-%H%M%S)}
package=ai.bithuman.example.avatar_chat.essence2
adb get-state >/dev/null
mkdir -p "$out"
remote="/data/misc/perfetto-traces/hitel-$(date +%s)-$$.perfetto-trace"
trap 'adb shell rm -f "$remote" >/dev/null 2>&1 || true' EXIT

echo "Recording for $duration seconds. Start playback in HITEL now."
adb shell -T perfetto --txt -c - -o "$remote" <<EOF
duration_ms: $((duration * 1000))
buffers { size_kb: 65536 fill_policy: RING_BUFFER }
write_into_file: true
file_write_period_ms: 2500
max_file_size_bytes: 268435456
data_sources {
  config {
    name: "linux.ftrace"
    ftrace_config {
      ftrace_events: "sched/sched_switch"
      ftrace_events: "sched/sched_wakeup"
      ftrace_events: "sched/sched_waking"
      ftrace_events: "power/cpu_frequency"
      ftrace_events: "power/gpu_frequency"
      atrace_apps: "$package"
      atrace_categories: "gfx"
      atrace_categories: "view"
      atrace_categories: "audio"
    }
  }
}
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
EOF

adb pull "$remote" "$out/hitel.perfetto-trace"
for file in hitel_e2_startup.log hitel_e2_trace.previous.log hitel_e2_trace.log; do
    if ! adb exec-out run-as "$package" cat "app_flutter/$file" > "$out/$file" 2>/dev/null; then
        rm -f "$out/$file"
    fi
done
echo "Saved $out"
