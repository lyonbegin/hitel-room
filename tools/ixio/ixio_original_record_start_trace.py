#!/usr/bin/env python3
"""Trace the recovered recording handshake without changing decisions or payloads."""
import argparse
import hashlib
import json
from pathlib import Path

BASE = 'com/lguplus/aicallagent/incall/call/service/'
PROBE = BASE + 'HitelOriginalRecordStartTrace.smali'
DESC = 'L' + PROBE[:-6] + ';'


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--smali18', required=True, type=Path)
    p.add_argument('--report', required=True, type=Path)
    a = p.parse_args()
    events = []
    changes = []
    if (a.smali18 / PROBE).exists():
        raise RuntimeError('Recording trace already installed')

    def instrument(name, patches):
        path = a.smali18 / (BASE + name + '.smali')
        old = new = path.read_text()
        for anchor, event, before in patches:
            if new.count(anchor) != 1:
                raise RuntimeError(f'{name}: expected one {event} anchor, got {new.count(anchor)}')
            call = f'    invoke-static {{}}, {DESC}->{event}()V\n'
            new = new.replace(anchor, call + anchor if before else anchor + '\n' + call, 1)
            events.append(event)
        path.write_text(new)
        changes.append({'path': str(path.relative_to(a.smali18)),
                        'before': hashlib.sha256(old.encode()).hexdigest(),
                        'after': hashlib.sha256(new.encode()).hexdigest()})

    instrument('CallRecordingManager$startRecord$2', [
        ('    invoke-interface {v2, v9}, Lcom/lguplus/aicallagentaidl/IInCallAidlInterface;->registerCallRecordListener(Lcom/lguplus/aicallagentaidl/ICallRecordEventAidlInterface;)V', 'LISTENER_REGISTER_RETURNED', False),
        ('    invoke-virtual {p1, p0}, Lcom/lguplus/aicallagent/datastore/IxIDataStoreRepository;->getTokenData(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;', 'TOKEN_READ_ENTER', True),
        ('    :goto_74\n', 'TOKEN_READ_READY', False),
        ('    invoke-interface {v2, p1}, Lcom/lguplus/aicallagentaidl/IInCallAidlInterface;->setUserId(Ljava/lang/String;)V', 'SET_USER_ID_ENTER', True),
        ('    invoke-interface {v2, p1}, Lcom/lguplus/aicallagentaidl/IInCallAidlInterface;->setUserId(Ljava/lang/String;)V', 'SET_USER_ID_RETURNED', False),
        ('    invoke-virtual {p1, v2}, Lcom/lguplus/aicallagent/incall/call/data/RecordRepository;->registerUpdateDatadogListener(Lcom/lguplus/aicallagentaidl/IUpdateDatadogAidlInterface;)V', 'DATADOG_REGISTER_ENTER', True),
        ('    invoke-virtual {p1, v2}, Lcom/lguplus/aicallagent/incall/call/data/RecordRepository;->registerUpdateDatadogListener(Lcom/lguplus/aicallagentaidl/IUpdateDatadogAidlInterface;)V', 'DATADOG_REGISTER_RETURNED', False),
        ('    invoke-static {p1, v2}, Lcom/lguplus/aicallagent/incall/call/service/CallRecordingManager;->access$validateCallDetails(Lcom/lguplus/aicallagent/incall/call/service/CallRecordingManager;Lcom/lguplus/aicallagent/model/call/CallDetails;)V', 'CALL_DETAILS_VALIDATED', False),
        ('    invoke-static {p1, v2}, Lcom/lguplus/aicallagent/incall/call/service/CallRecordingManager;->access$setCallerInformation(Lcom/lguplus/aicallagent/incall/call/service/CallRecordingManager;Lcom/lguplus/aicallagent/model/call/CallDetails;)V', 'CALLER_INFORMATION_SET', False),
        ('    :goto_e4\n', 'START_RESPONSE_READY', False),
        ('    :goto_12b\n', 'START_EXCEPTION_CAUGHT', False),
    ])
    instrument('CallRecordingManager', [
        ('    .line 1016\n', 'REQUEST_START_ENTER', True),
        ('    invoke-interface {v1, p1}, Lcom/lguplus/aicallagentaidl/IInCallAidlInterface;->startRecording(Ljava/lang/String;)V', 'AIDL_START_ENTER', True),
        ('    invoke-interface {v1, p1}, Lcom/lguplus/aicallagentaidl/IInCallAidlInterface;->startRecording(Ljava/lang/String;)V', 'AIDL_START_RETURNED', False),
    ])
    instrument('CallRecordingManager$recordingCallback$1', [
        ('.method public onStarted()V\n    .registers 6\n', 'CALLBACK_STARTED_ENTER', False),
        ('.method public onError(II)V\n    .registers 12\n', 'CALLBACK_ERROR_ENTER', False),
        ('.method public onCompleted()V\n    .registers 9\n', 'CALLBACK_COMPLETED_ENTER', False),
    ])
    probe = '.class public final ' + DESC + '\n.super Ljava/lang/Object;\n'
    for event in events:
        probe += f'''\n.method public static {event}()V
    .registers 2
    const-string v0, "IXIO_RECORD_START_TRACE"
    const-string v1, "{event}"
    invoke-static {{v0, v1}}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    return-void
.end method
'''
    (a.smali18 / PROBE).write_text(probe)
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.report.write_text(json.dumps({'mode': 'ORIGINAL_RECORDING_HANDSHAKE_FIXED_LABELS_ONLY',
        'changes': changes, 'events': events, 'tokens_and_payloads_logged': False,
        'original_control_flow_and_return_values_unchanged': True}, indent=2) + '\n')
    print('ORIGINAL_RECORD_START_TRACE_INSTALLED=YES')


if __name__ == '__main__':
    main()
