#!/usr/bin/env python3
"""Provide a supported device profile only on the Android UI-test emulator.

The original InitScreenUseCase still runs its normal state transitions. Dialogs,
physical-handset support checks, model checks and recording results stay original.
"""
from pathlib import Path
import argparse, hashlib, json, re

DESC = 'Lcom/lguplus/aicallagent/hitelqa/EmulatorDeviceProfile;'
TARGET = 'com/lguplus/aicallagent/model/api/dto/ixio/userservice/DeviceCheck.smali'
METHOD = re.compile(r'(?ms)^\.method[^\n]*\n.*?^\.end method$')

def patch(src):
    hits = [m for m in METHOD.finditer(src)
            if m.group().splitlines()[0] == '.method public final isSupportedModel()Z']
    if len(hits) != 1:
        raise RuntimeError('Original supported-model getter changed')
    m = hits[0]; old = m.group()
    anchor = '    iget-boolean p0, p0, Lcom/lguplus/aicallagent/model/api/dto/ixio/userservice/DeviceCheck;->isSupportedModel:Z'
    if old.count(anchor) != 1 or old.count('    .registers 1\n') != 1 or re.search(r'\bv\d+\b', old):
        raise RuntimeError('Supported-model getter no longer has the verified register shape')
    added = (f'    invoke-static {{}}, {DESC}->isUiEmulator()Z\n'
             '    move-result v0\n'
             '    if-eqz v0, :hitel_original_handset_support\n'
             f'    invoke-static {{}}, {DESC}->profileUsed()V\n'
             '    const/4 v0, 0x1\n'
             '    return v0\n'
             '    :hitel_original_handset_support\n\n'
             '    iget-boolean p0, p0, Lcom/lguplus/aicallagent/model/api/dto/ixio/userservice/DeviceCheck;->isSupportedModel:Z')
    new = old.replace('    .registers 1\n', '    .registers 2\n', 1).replace(anchor, added, 1)
    assert new.replace(added, anchor, 1).replace('    .registers 2\n', '    .registers 1\n', 1) == old
    return src[:m.start()] + new + src[m.end():]

def helper():
    return f'''.class public final {DESC}
.super Ljava/lang/Object;

.method public static isUiEmulator()Z
    .registers 2
    sget-object v0, Landroid/os/Build;->HARDWARE:Ljava/lang/String;
    const-string v1, "ranchu"
    invoke-virtual {{v1, v0}}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :emulator
    const-string v1, "goldfish"
    invoke-virtual {{v1, v0}}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v0
    return v0
    :emulator
    const/4 v0, 0x1
    return v0
.end method

.method public static profileUsed()V
    .registers 2
    :log_start
    const-string v0, "IXIO_EMULATOR_UI_QA"
    const-string v1, "EMULATOR_SUPPORTED_DEVICE_PROFILE_USED_FOR_UI_QA"
    invoke-static {{v0, v1}}, Lcom/lguplus/aicallagent/hitelqa/DiagTrace;->fixedTag(Ljava/lang/String;Ljava/lang/String;)V
    :log_end
    return-void
    .catch Ljava/lang/Throwable; {{:log_start .. :log_end}} :log_failed
    :log_failed
    move-exception v0
    return-void
.end method
'''

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--root', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    a = p.parse_args()
    path = a.root / 'smali17' / TARGET
    target = a.root / 'smali17' / (DESC[1:-1] + '.smali')
    if target.exists():
        raise RuntimeError('Emulator profile already present')
    src = path.read_text(encoding='utf-8'); new = patch(src)
    target.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new, encoding='utf-8', newline='\n')
    target.write_text(helper(), encoding='utf-8', newline='\n')
    a.report.write_text(json.dumps({'emulator_only': True, 'hardware': ['ranchu', 'goldfish'],
        'emulator_supported_model_result_overridden': True,
        'physical_handset_support_result_unchanged': True,
        'original_dialogs_and_init_state_transitions_unchanged': True,
        'recording_or_stt_success_forced': False,
        'changes': [{'dex': 'smali17', 'file': TARGET,
                     'before': hashlib.sha256(src.encode()).hexdigest(),
                     'after': hashlib.sha256(new.encode()).hexdigest()}]}, indent=2), encoding='utf-8')
    print('EMULATOR_ONLY_SUPPORTED_DEVICE_PROFILE_INSTALLED=YES', flush=True)

if __name__ == '__main__':
    main()
