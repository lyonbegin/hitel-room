"""Apply the development bridge to the pinned PokeClaw checkout, not Gallery."""
import shutil
import sys
from pathlib import Path
root=Path(sys.argv[1])
sources=Path(__file__).resolve().parents[1]/"android"
target=root/"app/src/main/java/io/agents/pokeclaw/hitel"
target.mkdir(parents=True,exist_ok=True)
for name in ("HitelBridgeActivity.kt","HitelCallbackReceiver.kt","HitelDirectActivity.kt"):
    shutil.copy2(sources/name,target/name)
manifest=root/"app/src/main/AndroidManifest.xml"
text=manifest.read_text()
insertion="""
        <activity android:name="io.agents.pokeclaw.hitel.HitelBridgeActivity"
            android:label="HITEL Bridge" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <activity android:name="io.agents.pokeclaw.hitel.HitelDirectActivity"
            android:label="HITEL Direct" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <receiver android:name="io.agents.pokeclaw.hitel.HitelCallbackReceiver"
            android:exported="false">
            <intent-filter>
                <action android:name="io.agents.pokeclaw.HITEL_TASK_CALLBACK" />
            </intent-filter>
        </receiver>
"""
assert text.count("</application>")==1
manifest.write_text(text.replace("</application>",insertion+"</application>"))
