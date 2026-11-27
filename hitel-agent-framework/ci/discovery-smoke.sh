#!/usr/bin/env bash
# No app catalog is bundled. Test a generic capability query, not a chosen app.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/hitel-framework-results"
mkdir -p "$OUT"
query="document reader"
adb shell am start -W -a android.intent.action.VIEW -d 'market://search?q=document%20reader' -p com.android.vending | tee "$OUT/discovery-launch.txt"
grep -q 'Status: ok' "$OUT/discovery-launch.txt"
sleep 8
adb shell uiautomator dump /sdcard/hitel-discovery.xml >/dev/null
adb pull /sdcard/hitel-discovery.xml "$OUT/discovery.xml" >/dev/null
python3 - "$OUT" <<'PY'
import json,sys,xml.etree.ElementTree as ET
from pathlib import Path
p=Path(sys.argv[1])
root=ET.parse(p/"discovery.xml").getroot()
nodes=[(n.get("text","")+" "+n.get("content-desc","")).strip() for n in root.iter("node")]
joined=" ".join(nodes).lower()
login=any(x in joined for x in ("sign in","sign-in","add account","로그인"))
(p/"discovery-status.json").write_text(json.dumps({"store_search_intent":"launched","login_gate_detected":login,"app_install":"not_attempted","skill_learning":"not_attempted"},indent=2))
print("Play Store login gate detected" if login else "Store UI opened; search results not yet verified")
PY
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Generic Play Store discovery entry verified (installation and login not verified)"
if [[ -z "$GEMINI_API_KEY" ]]; then
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Autonomous app discovery and skill learning require authorized model credentials" blocked
fi
