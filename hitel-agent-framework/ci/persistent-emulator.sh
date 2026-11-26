#!/usr/bin/env bash
# Run only on a dedicated, trusted host with a private persistent disk.
# AVD data never travels through GitHub caches, artifacts or source control.
set -Eeuo pipefail
umask 077
: "${HITEL_AVD_ROOT:?Set HITEL_AVD_ROOT on the trusted host to a private persistent directory}"
[[ "$HITEL_AVD_ROOT" = /* && "$HITEL_AVD_ROOT" != "${GITHUB_WORKSPACE:-/nonexistent}"* ]] || { echo "Use storage outside the checkout"; exit 2; }
export ANDROID_AVD_HOME="$HITEL_AVD_ROOT/avd"
export ANDROID_USER_HOME="$HITEL_AVD_ROOT/android-user"
mkdir -p "$ANDROID_AVD_HOME" "$ANDROID_USER_HOME"
chmod 700 "$HITEL_AVD_ROOT" "$ANDROID_AVD_HOME" "$ANDROID_USER_HOME"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
: "${SDK:?Set ANDROID_HOME}"
export PATH="$SDK/platform-tools:$SDK/emulator:$SDK/cmdline-tools/latest/bin:$PATH"
NAME="${HITEL_AVD_NAME:-hitel-play-dev}"
PORT="${HITEL_EMULATOR_PORT:-5554}"
SERIAL="emulator-$PORT"
API="${HITEL_ANDROID_API:-35}"
case "$(uname -m)" in
  x86_64) ABI=x86_64 ;;
  aarch64|arm64) ABI=arm64-v8a ;;
  *) echo "Unsupported host architecture"; exit 2 ;;
esac
IMAGE="system-images;android-$API;google_apis_playstore;$ABI"
case "${1:-status}" in
  provision)
    sdkmanager "platform-tools" "emulator" "$IMAGE"
    if [[ ! -f "$ANDROID_AVD_HOME/$NAME.ini" ]]; then
      printf 'no\n' | avdmanager create avd --name "$NAME" --package "$IMAGE" --device pixel_6
    fi
    ;;
  start)
    test -f "$ANDROID_AVD_HOME/$NAME.ini"
    if adb devices | awk '{print $1}' | grep -Fxq "$SERIAL"; then
      echo "Port already in use; refusing to attach to an unidentified emulator." >&2
      exit 2
    fi
    emulator -avd "$NAME" -port "$PORT" -no-window -noaudio -gpu swiftshader_indirect -no-boot-anim -no-snapshot > "$HITEL_AVD_ROOT/emulator.log" 2>&1 &
    echo "$!" > "$HITEL_AVD_ROOT/emulator.pid"
    timeout 240 adb -s "$SERIAL" wait-for-device
    for _ in $(seq 1 120); do
      if [[ "$(adb -s "$SERIAL" shell getprop sys.boot_completed | tr -d '\r')" = 1 ]]; then
        adb -s "$SERIAL" shell pm path com.android.vending | grep -q '^package:'
        echo "Persistent Google Play device ready: $SERIAL"
        exit 0
      fi
      sleep 2
    done
    echo "Emulator boot timed out"; exit 1
    ;;
  status)
    adb -s "$SERIAL" get-state
    adb -s "$SERIAL" shell getprop ro.build.version.sdk
    adb -s "$SERIAL" shell pm path com.android.vending
    ;;
  stop)
    if [[ -f "$HITEL_AVD_ROOT/emulator.pid" ]]; then
      pid="$(cat "$HITEL_AVD_ROOT/emulator.pid")"
      if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$HITEL_AVD_ROOT/emulator.pid"
        exit 0
      fi
      if ! tr '\0' ' ' < "/proc/$pid/cmdline" | grep -Fq "$NAME"; then
        echo "Refusing to terminate a process not owned by this AVD." >&2
        exit 2
      fi
      if adb devices | awk '{print $1}' | grep -Fxq "$SERIAL"; then
        adb -s "$SERIAL" emu kill
      fi
      for _ in $(seq 1 30); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done
      rm -f "$HITEL_AVD_ROOT/emulator.pid"
    fi
    ;;
  *) echo "Usage: $0 provision|start|status|stop" >&2; exit 2 ;;
esac
