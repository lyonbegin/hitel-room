#!/usr/bin/env bash
set -euo pipefail
adb install -r dist/HITEL_Gallery_Local_SODA.apk
adb install -r -t dist/HITEL_Gallery_Local_SODA_Test.apk
adb logcat -c
pkg=$(adb shell pm list instrumentation | tr -d '\r' | sed -n 's/^instrumentation:\([^ ]*\) (target=com.google.aiedge.gallery)$/\1/p' | head -1)
test -n "$pkg"
adb shell am instrument -w -r -e class com.google.ai.edge.gallery.services.asr.LocalSodaIntegrationTest "$pkg" | tee evidence/local-sdk-test.txt
grep -F 'OK (1 test)' evidence/local-sdk-test.txt
adb shell monkey -p com.google.aiedge.gallery -c android.intent.category.LAUNCHER 1
sleep 5
adb exec-out screencap -p > evidence/gallery-launch.png
adb logcat -d -v threadtime > evidence/gallery-logcat.txt
grep -F 'GALLERY_SDK_NO_FAKE_READY_PASS' evidence/gallery-logcat.txt
