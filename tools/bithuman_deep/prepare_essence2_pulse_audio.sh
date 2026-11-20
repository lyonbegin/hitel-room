#!/usr/bin/env bash
# Record the emulator's actual output through a single continuous monitor stream.
set -euo pipefail
if ! command -v pulseaudio >/dev/null || ! command -v parecord >/dev/null; then
  sudo timeout 180 apt-get install -y -qq --no-install-recommends pulseaudio pulseaudio-utils
fi
export XDG_RUNTIME_DIR="$RUNNER_TEMP/essence2-audio-runtime"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
pulseaudio --daemonize=yes --exit-idle-time=-1 --log-target="file:$RUNNER_TEMP/essence2-pulse.log"
export PULSE_SERVER="unix:$XDG_RUNTIME_DIR/pulse/native"
pactl load-module module-null-sink sink_name=essence2_test rate=48000 channels=2
pactl set-default-sink essence2_test
pactl set-sink-volume essence2_test 100%
pactl set-sink-mute essence2_test 0
pactl set-source-volume essence2_test.monitor 100%
pactl set-source-mute essence2_test.monitor 0
pactl info
{
  echo "XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR"
  echo "PULSE_SERVER=$PULSE_SERVER"
  echo "QEMU_PA_SERVER=$PULSE_SERVER"
} >> "$GITHUB_ENV"

