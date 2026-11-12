#!/usr/bin/env bash
# Exact JVM bytecode inventory, not a reconstructed substitute for SDK code.
# Never downloads Essence2. Never edits the original AAR/classes.jar.
set -euo pipefail
AAR="$1"
OUT="$2"
mkdir -p "$OUT/classes"
unzip -p "$AAR" classes.jar > "$OUT/original-classes.jar"
printf 'source-aar\t%s\n' "$AAR" > "$OUT/inventory.tsv"
sha256sum "$AAR" "$OUT/original-classes.jar" >> "$OUT/inventory.tsv"
jar tf "$OUT/original-classes.jar" | grep '^ai/bithuman/.*\.class$' |
    sed -e 's#/#.#g' -e 's/\.class$//' > "$OUT/class-names.txt"
count=0
failed=0
while IFS= read -r name; do
  count=$((count+1))
  file="$OUT/classes/$(printf '%05d' "$count").javap.txt"
  if ! javap -p -c -s -l -classpath "$OUT/original-classes.jar" "$name" > "$file" 2>&1; then
    failed=$((failed+1))
  fi
  sha256sum "$file" | sed "s#$OUT/##" >> "$OUT/javap-hashes.txt"
  printf '%s\t%s\t%s\n' "$count" "$name" "$(wc -l < "$file")" >> "$OUT/jvm-class-coverage.tsv"
done < "$OUT/class-names.txt"
printf 'EXPRESSION2_JVM_CLASSES=%s\n' "$count"
printf 'EXPRESSION2_JAVAP_FAILURES=%s\n' "$failed"
printf -- '- Original classes.jar is immutable. javap output describes actual JVM instructions.\n' > "$OUT/README.md"
printf -- '- No method body truncation and no class-name matching filters are used.\n' >> "$OUT/README.md"
printf -- '- Bytecode is not original Kotlin source; Kotlin constructs may be compiled away.\n' >> "$OUT/README.md"
printf -- '- This report is Expression 2 only, with code drawn from the unmodified SDK AAR.\n' >> "$OUT/README.md"
printf -- '- Class count: %s; javap failures: %s.\n' "$count" "$failed" >> "$OUT/README.md"
test "$count" -gt 20
test "$failed" -eq 0
# Do not upload vendor classes.jar in the evidence artifact.
rm "$OUT/original-classes.jar"
