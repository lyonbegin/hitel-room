#!/bin/bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
echo ANDROID_INSTALL_APT_START
sudo apt-get update -qq
sudo apt-get install -y -qq --no-install-recommends curl ca-certificates unzip openjdk-17-jre-headless libgl1 libx11-6 libpulse0 libnss3 libxkbcommon0 >/tmp/hitel-apt.log 2>&1
echo ANDROID_INSTALL_CLI_START
mkdir -p "$ANDROID_HOME/cmdline-tools"
curl -fsSL --retry 2 --max-time 100 https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip -o /tmp/hitel-android-tools.zip
unzip -oq /tmp/hitel-android-tools.zip -d /tmp/hitel-unpacked
mv /tmp/hitel-unpacked/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
echo ANDROID_INSTALL_SDK_START
(yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses > /dev/null 2>&1) || true
sdkmanager --sdk_root="$ANDROID_HOME" --channel=0 "platform-tools" "emulator" "system-images;android-30;google_apis;x86_64" > /tmp/hitel-sdk.log 2>&1
echo ANDROID_INSTALL_AVD_START
printf 'no\n' | avdmanager create avd --force -n HITEL_ANDROID_11 -k "system-images;android-30;google_apis;x86_64" >/tmp/hitel-avd.log 2>&1
echo ANDROID_INSTALL_DONE
