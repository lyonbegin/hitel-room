#!/usr/bin/env bash
# One-time checkpoint preparation INSIDE a Railway Sandbox VM.
# Abort before downloading anything if accelerated x86 Android is impossible.
set -euo pipefail
if [[ ! -c /dev/kvm || ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  echo "UNSUPPORTED_KVM: /dev/kvm is not available to this Railway Sandbox." >&2
  exit 40
fi
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y curl unzip openjdk-17-jre-headless xvfb x11vnc websockify novnc scrcpy libgl1
export ANDROID_HOME=/opt/android
export ANDROID_SDK_ROOT="$ANDROID_HOME"
sudo mkdir -p "$ANDROID_HOME/cmdline-tools" /opt/hitel /root/.android
sudo chown -R "$(id -un)" "$ANDROID_HOME" /opt/hitel /root/.android
curl -fL --retry 3 \
  "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip" \
  -o /tmp/android-cmdline.zip
unzip -q /tmp/android-cmdline.zip -d /tmp/android-tools
mv /tmp/android-tools/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses >/dev/null || true
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" "emulator" "system-images;android-30;google_apis;x86_64"
printf 'no\n' | avdmanager create avd -n HITEL_ANDROID_11 \
  -k "system-images;android-30;google_apis;x86_64" --force
cat >/opt/hitel/start-android.sh <<'LAUNCH'
#!/usr/bin/env bash
set -euo pipefail
export ANDROID_HOME=/opt/android
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export DISPLAY=:99
# Dedicated X display, not a synthetic frame: scrcpy renders the live ADB stream.
Xvfb :99 -screen 0 1100x800x24 -nolisten tcp >/tmp/hitel-xvfb.log 2>&1 &
sleep 2
x11vnc -display :99 -rfbport 5900 -forever -shared -nopw \
  -listen 127.0.0.1 >/tmp/hitel-vnc.log 2>&1 &
websockify --web=/usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 \
  >/tmp/hitel-websockify.log 2>&1 &
"$ANDROID_HOME/emulator/emulator" -avd HITEL_ANDROID_11 \
  -no-snapshot -no-boot-anim -no-audio -gpu swiftshader_indirect \
  -no-window -accel on >/tmp/hitel-emulator.log 2>&1 &
adb wait-for-device
for i in $(seq 1 120); do
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]];then
    break
  fi
  sleep 1
done
adb shell input keyevent 3 || true
# scrcpy window is the actual Android screen and receives pointer/keyboard.
scrcpy --serial emulator-5554 --max-size 860 --window-title "HITEL Android 11" \
  >/tmp/hitel-scrcpy.log 2>&1
LAUNCH
chmod +x /opt/hitel/start-android.sh
echo "PREPARED: capture checkpoint as 'hitel-android11-ready'; no Android was faked."
