#!/usr/bin/env bash
set -euo pipefail
root=$(pwd)
scripts=$root/scripts/zocbo_diagnostic
mkdir -p work/decoded work/classes work/helper-dex work/manifest-classes
sdk=$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)
android_jar=$(find "$ANDROID_HOME/platforms" -maxdepth 2 -name android.jar | sort -V | tail -1)
APP_ID=jokbo APP_PACKAGE=com.eduzone.eduzoneviewer APP_VERSION='4.3.11(2)' \
APP_SHA256=d45ba34990d4f4eaaad126371023bba74be0ca120b4b26e78af2c4a8fa2ba3a5 \
GITHUB_REPOSITORY=lyonbegin/hitel-room python3 scripts/zocbo_original_dex/download_verified_xapk.py work/source
curl -fLsS --retry 2 --max-time 100 -o work/APKEditor.jar https://github.com/REAndroid/APKEditor/releases/download/V1.4.9/APKEditor-1.4.9.jar
java -jar work/APKEditor.jar m -i work/source/jokbo.xapk -o work/universal.apk
for n in 1 2 3; do
  suffix=$n
  if [ "$n" = 1 ]; then suffix=; fi
  unzip -p work/universal.apk "classes${suffix}.dex" > "work/original$n.dex"
  java -cp '/usr/share/java/*' org.jf.baksmali.Main disassemble --api 23 -o "work/decoded/smali${suffix}" "work/original$n.dex"
done
python3 "$scripts/patch_smali.py" work/decoded work/diag-patch-report.json
python3 "$scripts/patch_pdf_api_smali.py" work/decoded work/pdf-api-patch-report.json
python3 "$scripts/patch_private_papers.py" work/decoded
for n in 1 2 3; do
  suffix=$n
  if [ "$n" = 1 ]; then suffix=; fi
  java -cp '/usr/share/java/*' org.jf.smali.Main assemble --api 23 -o "work/patched$n.dex" "work/decoded/smali${suffix}"
done
javac -encoding UTF-8 -source 8 -target 8 -Xlint:-options -cp "$android_jar" -d work/classes $(find "$scripts/src" -name '*.java')
"$sdk/d8" --min-api 23 --lib "$android_jar" --output work/helper-dex $(find work/classes -name '*.class')
git clone -q https://github.com/WindySha/ManifestEditor.git work/manifest-editor
git -C work/manifest-editor checkout -q 24ad7ef3bc13ceed6a51bf7402efc4d723044fa1
javac -source 8 -target 8 -Xlint:-options -cp "$android_jar" -d work/manifest-classes $(find work/manifest-editor/lib/src/main/java -name '*.java') "$scripts/build/LocalManifest.java"
unzip -p work/universal.apk AndroidManifest.xml > work/manifest-original.bin
java -cp work/manifest-classes LocalManifest work/manifest-original.bin work/manifest-local.bin
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
import re
with ZipFile('work/universal.apk') as original, ZipFile('work/unsigned.apk','w') as out:
    for item in original.infolist():
        name=item.filename
        if re.match(r'^META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC))$',name,re.I):continue
        dex=re.fullmatch(r'classes(\d*)\.dex', name)
        if dex:
            data=Path('work/patched'+(dex[1] or '1')+'.dex').read_bytes()
        elif name=='AndroidManifest.xml':data=Path('work/manifest-local.bin').read_bytes()
        else:data=original.read(item)
        out.writestr(item,data)
    out.write('work/helper-dex/classes.dex','classes4.dex',compress_type=ZIP_STORED)
PY
"$sdk/zipalign" -P 16 -f 4 work/unsigned.apk work/aligned.apk
