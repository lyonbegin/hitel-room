#!/usr/bin/env python3
"""Log keyboard -> WebSocket -> reply PCM/status in a disposable test build.

Metadata only: no user text, secrets, request payloads, or PCM.
The original vendor plugin/JNI/model are kept unchanged; modifications are
applied only to temporary copies used for internal CI validation.
"""
from pathlib import Path
import argparse
import json

def once(path,before,after,label):
    s=path.read_text()
    n=s.count(before)
    if n!=1:
        raise AssertionError(f"HITEL_AI_E2E_ANCHOR {label}: {n}")
    path.write_text(s.replace(before,after,1))
    return label

def main(app:Path, plugin:Path, report:Path, trace_transport=True):
    tags=[]
    ui=app/"lib/main.dart"
    transport=plugin/"lib/bithuman_realtime.dart"
    runtime=app/"lib/hitel_offline_runtime.dart"
    tags.append(once(ui,
        "    _session!.sendText(t);\n",
        """    debugPrint('[HITEL_AI_E2E] ui.text.submit chars=__DOLLAR__{t.length} wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
    _session!.sendText(t);
""","keyboard-submit"))
    tags.append(once(ui,
        "    session.statusStream.listen((s) { if (mounted) setState(() => _status = _describe(s)); });",
        """    session.statusStream.listen((s) {
      debugPrint('[HITEL_AI_E2E] ui.status=__DOLLAR__{s.name} wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
      if (mounted) setState(() => _status = _describe(s));
    });""","ui-session-status"))
    tags.append(once(ui,
        "    session.botTranscriptStream.listen((d) { if (mounted) setState(() => _caption = 'agent: $d'); });",
        """    session.botTranscriptStream.listen((d) {
      debugPrint('[HITEL_AI_E2E] ui.botTranscript chars=__DOLLAR__{d.length} wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
      if (mounted) setState(() => _caption = 'agent: $d');
    });""","bot-transcript"))
    if trace_transport:
        tags.append(once(transport,
            """    if (ws == null) return;
        ws.sink.add(jsonEncode(evt));""",
            """    final kind = evt['type']?.toString() ?? 'unknown';
        if (ws == null) {
          print('[HITEL_AI_E2E] client.tx.dropped type=$kind reason=no_socket');
          return;
        }
        if (kind != 'input_audio_buffer.append') {
          print('[HITEL_AI_E2E] client.tx type=$kind wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
        }
        ws.sink.add(jsonEncode(evt));""","ws-outbound"))
        tags.append(once(transport,
            "    final type = evt['type'] as String?;\n",
            """    final type = evt['type'] as String?;
        if (type != 'response.output_audio.delta') {
          print('[HITEL_AI_E2E] client.rx type=$type wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
        } else if (_deltaN == 0) {
          print('[HITEL_AI_E2E] client.rx type=response.output_audio.delta first=true wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
        }
    ""","ws-inbound"))
        tags.append(once(transport,
            "      await _ws!.ready;\n",
            """      await _ws!.ready;
          print('[HITEL_AI_E2E] client.ws.ready=true wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
    ""","ws-ready"))
    tags.append(once(runtime,
        "        switch (event.type) {\n",
        """        if (event.type != 'input_audio_buffer.append') {
          print('[HITEL_AI_E2E] mock.rx type=__DOLLAR__{event.type} wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
        }
        switch (event.type) {
""","mock-request-received"))
    tags.append(once(runtime,
        "    conn.sendResponseCreated();\n    conn.sendTranscriptDelta('Hello, this is a spoken language test.');",
        """    print('[HITEL_AI_E2E] mock.tx type=response.created wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
    conn.sendResponseCreated();
    conn.sendTranscriptDelta('Hello, this is a spoken language test.');""","mock-response-created"))
    tags.append(once(runtime,
        "      conn.sendAudioDelta(Uint8List.sublistView(data,i,end));\n",
        """      if (i == 0) print('[HITEL_AI_E2E] mock.tx type=response.output_audio.delta first=true pcmBytes=__DOLLAR__{end - i}');
      conn.sendAudioDelta(Uint8List.sublistView(data,i,end));
""","mock-voice-first"))
    tags.append(once(runtime,
        "    conn.sendResponseDone();\n",
        """    print('[HITEL_AI_E2E] mock.tx type=response.done wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');
    conn.sendResponseDone();
""","mock-response-done"))
    for item in ((ui, transport, runtime) if trace_transport else (ui, runtime)):
        content=item.read_text()
        item.write_text(content.replace("__DOLLAR__","$"))
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
        "source_patch_count":len(tags),
        "anchors":tags,
        "scope":"temporary app/Flutter transport logging only",
        "records_credentials":False,
        "records_user_text":False,
        "records_pcm":False,
        "backend":"LOCAL_MOCK_PRE-RECORDED_VOICE_NOT_REAL_AI",
        "verifiable_stages":["ui.text.submit","client.tx response.create","mock.rx response.create",
                             "mock.tx response.created","client.rx response.created",
                             "mock.tx response.output_audio.delta","client.rx response.output_audio.delta",
                             "mock.tx response.done","client.rx response.done","ui.status=responseDone"]
    },indent=2)+"\n")
    print("PASS_E2_KEYBOARD_AI_REQUEST_RESPONSE_TRACE_ADAPTER_INSTALLED count="+str(len(tags)))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--app",type=Path,required=True)
    p.add_argument("--plugin",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    p.add_argument("--preserve-transport",action="store_true")
    a=p.parse_args()
    main(a.app,a.plugin,a.report,trace_transport=not a.preserve_transport)
