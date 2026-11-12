#!/usr/bin/env bash
set -euo pipefail
MODEL="${BITHUMAN_MODEL:-expression2}"
case "$MODEL" in
  expression2) PROJECT="expression2-hello"; MODULE="expression2-android"; FROM="0.6.1"; TO="0.6.2" ;;
  essence2)    PROJECT="essence2-hello"; MODULE="essence2-android"; FROM="0.9.5"; TO="0.10.3" ;;
  *) echo "Unsupported BITHUMAN_MODEL=$MODEL"; exit 2 ;;
esac
echo "Building $MODEL: $MODULE:$TO"
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
cd "$GITHUB_WORKSPACE/vendor/android/$PROJECT"
sed -i "s/$MODULE:$FROM/$MODULE:$TO/g" app/build.gradle.kts
grep -F "ai.bithuman:$MODULE:$TO" app/build.gradle.kts
if [[ "${BITHUMAN_RUNTIME_SECRET_UI:-0}" == "1" ]]; then
  case "$MODEL" in
    expression2) main="app/src/main/java/com/example/x2hello/MainActivity.kt" ;;
    essence2) main="app/src/main/java/com/example/e2hello/MainActivity.kt" ;;
  esac
  python3 "$GITHUB_WORKSPACE/tools/bithuman_audit/patch_runtime_secret.py" "$main"
fi
chmod +x ./gradlew
./gradlew :app:assembleDebug :app:testDebugUnitTest --no-daemon --max-workers=2
mkdir -p "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug"
cp app/build/outputs/apk/debug/app-debug.apk "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
test -s "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
sha256sum "$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
