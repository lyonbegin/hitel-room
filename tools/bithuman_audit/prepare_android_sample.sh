#!/usr/bin/env bash
set -euo pipefail
echo "ANDROID_HOME=$ANDROID_HOME"
manager="$ANDROID_HOME/cmdline-tools/16.0/bin/sdkmanager"
if [ ! -x "$manager" ]; then
  manager="$(find "$ANDROID_HOME/cmdline-tools" -maxdepth 3 -type f -name sdkmanager | head -n 1)"
fi
test -x "$manager"
yes | "$manager" --licenses >/dev/null || true
"$manager" "platforms;android-35" "build-tools;34.0.0" "platform-tools"
test -f "$ANDROID_HOME/platforms/android-35/android.jar"
git clone --depth 1 https://github.com/bithuman-product/bithuman-examples.git "$GITHUB_WORKSPACE/vendor"
cd "$GITHUB_WORKSPACE/vendor/android/expression2-hello"
sed -i 's/expression2-android:0.6.1/expression2-android:0.6.2/g' app/build.gradle.kts
grep -F 'ai.bithuman:expression2-android:0.6.2' app/build.gradle.kts
chmod +x ./gradlew
./gradlew :app:assembleDebug :app:testDebugUnitTest --no-daemon --max-workers=2
mkdir -p "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug"
cp app/build/outputs/apk/debug/app-debug.apk "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
test -s "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
sha256sum "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
