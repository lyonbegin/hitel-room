#!/usr/bin/env python3
"""Keep the real handset's support check intact; unblock emulator-only UI QA."""
from pathlib import Path
import argparse, hashlib, json, re

DESC = 'Lcom/lguplus/aicallagent/hitelqa/EmulatorDialogFixture;'
METHOD = re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')
TARGETS = (
    ('smali16', 'com/lguplus/aicallagent/splash/welcomepage/unit/SplashDialogsKt.smali'),
    ('smali17', 'com/lguplus/aicallagent/ui/dialog/unit/ErrorDialogsKt.smali'),
)

def patch(src):
    hits = [m for m in METHOD.finditer(src)
            if ' NotSupportedModelDialog(' in m.group().splitlines()[0]]
    if len(hits) != 1:
        raise RuntimeError('Original unsupported-model dialog signature changed')
    m = hits[0]; old = m.group()
    if not re.search(r'(?m)^\s*\.registers (?:1[6-9]|[2-9]\d+)\s*$', old):
        raise RuntimeError('Dialog has no verified free v0 register')
    # Insert after all annotations and immediately before the original first opcode.
    at = re.search(r'(?m)^    const v0, -?0x[0-9a-f]+[ \t]*$', old)
    if not at:
        raise RuntimeError('Original dialog first opcode changed')
    added = (f'    invoke-static {{}}, {DESC}->skipUnsupportedDialog()Z\n'
             '    move-result v0\n'
             '    if-eqz v0, :hitel_original_handset_dialog\n'
             '    return-void\n'
             '    :hitel_original_handset_dialog\n')
    new = old[:at.start()] + added + old[at.start():]
    assert new.replace(added, '', 1) == old
    return src[:m.start()] + new + src[m.end():]

def helper():
    return f'''.class public final {DESC}
.super Ljava/lang/Object;

.method public static skipUnsupportedDialog()Z
    .registers 2
    sget-object v0, Landroid/os/Build;->HARDWARE:Ljava/lang/String;
    const-string v1, "ranchu"
    invoke-virtual {{v1, v0}}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :emulator
    const-string v1, "goldfish"
    invoke-virtual {{v1, v0}}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :emulator
    const/4 v0, 0x0
    return v0
    :emulator
    :log_start
    const-string v0, "IXIO_EMULATOR_UI_QA"
    const-string v1, "EMULATOR_UNSUPPORTED_MODEL_DIALOG_SKIPPED_FOR_UI_QA"
    invoke-static {{v0, v1}}, Lcom/lguplus/aicallagent/hitelqa/DiagTrace;->fixedTag(Ljava/lang/String;Ljava/lang/String;)V
    :log_end
    const/4 v0, 0x1
    return v0
    .catch Ljava/lang/Throwable; {{:log_start .. :log_end}} :log_failed
    :log_failed
    move-exception v0
    const/4 v0, 0x1
    return v0
.end method
'''

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    a = p.parse_args(); changes = []; planned = []
    target = a.root / 'smali17' / (DESC[1:-1] + '.smali')
    if target.exists():
        raise RuntimeError('Emulator dialog fixture already present')
    for shard, rel in TARGETS:
        path = a.root / shard / rel
        src = path.read_text(encoding='utf-8'); new = patch(src)
        changes.append({'dex': shard, 'file': rel,
                        'before': hashlib.sha256(src.encode()).hexdigest(),
                        'after': hashlib.sha256(new.encode()).hexdigest()})
        planned.append((path, new))
    planned.append((target, helper()))
    for path, text in planned:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8', newline='\n')
    a.report.write_text(json.dumps({'emulator_only': True, 'hardware': ['ranchu', 'goldfish'],
        'support_check_results_changed': False, 'physical_handset_dialog_unchanged': True,
        'recording_or_stt_success_forced': False, 'changes': changes}, indent=2), encoding='utf-8')
    print('EMULATOR_ONLY_UNSUPPORTED_DIALOG_UI_FIXTURE_INSTALLED=YES', flush=True)

if __name__ == '__main__':
    main()
