#!/usr/bin/env python3
"""HITEL Android 11 RX/TX lab patch for JemRec 0.27 (Apache-2.0).

Test paths are based on real shell daemon and existing recording/greeting paths,
not a simulated phone call. On-device compatibility remains unverified.
"""
from pathlib import Path
import sys

p = Path(sys.argv[1]).resolve()

def edit(name, pairs):
    f = p / name
    s = f.read_text(encoding='utf-8')
    for old, new in pairs:
        count = s.count(old)
        if count != 1:
            raise RuntimeError(f'{name}: expected exactly one hit, got {count}: {old[:80]!r}')
        s = s.replace(old, new, 1)
    f.write_text(s, encoding='utf-8')

edit('app/build.gradle.kts', [
    ('applicationId = "com.jemcik.jemrec"', 'applicationId = "app.hitel.rxtxlab"'),
    ('minSdk = 31', 'minSdk = 30'),
    ('minSdk     31  - the run-time floor. Android 12 is where the shell-side',
     'minSdk     30  - HITEL validation floor; Android 11 RX/TX remains unverified.'),
])
edit('shellserver/build.sh', [
    ('--min-api 31 --output', '--min-api 30 --output'),
])
edit('app/src/main/res/values/strings.xml', [
    ('<string name="app_name">JemRec</string>', '<string name="app_name">HITEL RX/TX Lab</string>'),
])
edit('app/src/main/java/com/jemcik/jemrec/ui/theme/Looks.kt', [
    ('import android.content.Context', 'import android.content.Context\nimport android.os.Build'),
    ('runCatching { context.getSystemService(UiModeManager::class.java)?.setApplicationNightMode(mode) }',
     'if (Build.VERSION.SDK_INT >= 31) {\n            runCatching { context.getSystemService(UiModeManager::class.java)?.setApplicationNightMode(mode) }\n        }'),
])
edit('app/src/main/java/com/jemcik/jemrec/capture/RecordingStore.kt', [
    ('const val FOLDER = "JemRec"', 'const val FOLDER = "HITEL-RXTX-Lab"'),
])
edit('app/src/main/java/com/jemcik/jemrec/capture/RecordingStore.kt', [
    ('import android.content.Intent', 'import android.content.Intent\nimport android.os.Build'),
    ('private fun relativePath(): String = "${Environment.DIRECTORY_RECORDINGS}/$FOLDER"',
     'fun relativePath(): String = "${if (Build.VERSION.SDK_INT >= 31) Environment.DIRECTORY_RECORDINGS else Environment.DIRECTORY_MUSIC}/$FOLDER"'),
])
edit('app/src/main/java/com/jemcik/jemrec/capture/Recording.kt', [
    ('"%${Environment.DIRECTORY_RECORDINGS}/${RecordingStore.FOLDER}%"',
     '"%${RecordingStore.relativePath()}%"'),
])
edit('app/src/main/java/com/jemcik/jemrec/capture/Trash.kt', [
    ('"%${Environment.DIRECTORY_RECORDINGS}/${RecordingStore.FOLDER}%"',
     '"%${RecordingStore.relativePath()}%"'),
])
edit('app/src/main/java/com/jemcik/jemrec/capture/CaptureDaemon.kt', [
    ('private const val DEVICE_PATH = "/data/local/tmp/jemrec-capture.jar"',
     'private const val DEVICE_PATH = "/data/local/tmp/hitel-rxtxlab-capture.jar"'),
])
edit('app/src/main/java/com/jemcik/jemrec/capture/RecordingMode.kt', [
    ('getString(KEY, AUTOMATIC.name)', 'getString(KEY, ON_DEMAND.name)'),
    ('valueOf(stored ?: AUTOMATIC.name)', 'valueOf(stored ?: ON_DEMAND.name)'),
    ('}.getOrDefault(AUTOMATIC)', '}.getOrDefault(ON_DEMAND)'),
])
edit('app/src/main/java/com/jemcik/jemrec/ui/SettingsScreen.kt', [
    ('        SettingsGroup("Look") {', '''        // Explicit test entry points; only remote-party hearing validates TX.
        SettingsGroup("HITEL Android 11 - RX / TX test") {
            row {
                SettingsRow(
                    title = "RX - phone audio capture",
                    summary = "Run Self-test, then use the normal Phone app; check BOTH voices on playback.",
                    icon = Icons.Filled.Phone,
                    onClick = { vm.showScreen(Screen.DIAGNOSTICS) },
                )
            }
            row {
                SettingsRow(
                    title = "TX - send test greeting",
                    summary = "Run Checks, record greeting and Test call; confirm hearing on the OTHER phone.",
                    icon = Icons.Filled.Phone,
                    onClick = { vm.showScreen(Screen.ANSWERING_MACHINE) },
                )
            }
        }

        SettingsGroup("Look") {'''),
])
(p / 'HITEL_ANDROID11_TEST.md').write_text('''# HITEL Android 11 RX/TX Lab - JemRec 0.27 derivative

Apache-2.0 license; upstream LICENSE and NOTICE retained.
This is an EXPERIMENTAL phone-audio test app, NOT a streaming AI phone caller.

- Existing Android Phone app remains unchanged.
- Android min SDK 30 (Android 11), app id app.hitel.rxtxlab.
- Shell-UID recorder remains required, installed through Wireless debugging/ADB.
- RX: existing VOICE_CALL / mixer capture via the shell daemon.
- TX: existing Answering machine > Checks > Test call for a recorded greeting.
- The microphone is muted by the original answering-machine implementation during its greeting; not a universal interception mode.
- Automatic recording defaults OFF; original JemRec 0.27 upstream defaults ON.
- Recordings folder is Music/HITEL-RXTX-Lab on Android 11, Recordings/HITEL-RXTX-Lab on Android 12+; shell jar path is distinct.
- Android 11 availability of the RX and TX routes must be confirmed on an actual handset. A build or command acknowledgement is not proof.

### Test
1. Install APK and enable Android Wireless debugging under Developer options. Pair in app.
2. Settings > HITEL Android 11 - RX / TX test > RX; self-test.
3. Place a consented call in original Phone app. Start recording in the test app; play result and verify whether you hear both parties.
4. TX: Settings > HITEL Android 11 - RX / TX test > TX. Run Checks, record greeting, Test call. A person on the OTHER handset must confirm audibility and that microphone is muted.
5. Log handset model, Android version, call mode (2G/VoLTE/Wi-Fi Calling), capture test, RX audio, TX remote audibility. Stop all tests afterward.
Never use on emergency calls.
''', encoding='utf-8')
print('HITEL patch OK:', p)
