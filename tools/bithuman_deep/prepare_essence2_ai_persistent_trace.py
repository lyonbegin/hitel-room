#!/usr/bin/env python3
"""Persist test-only AI protocol events into the app's copyable diagnostic log.

Post-process temporary APK copies AFTER prepare_essence2_keyboard_ai_trace.py.
Never modify original vendor source, JNI, model, protocol, or voice rendering.
Do not record prompts, raw PCM, transcripts or credentials. The diagnostics
only include event types, lengths and timestamps. File is capped at 512 KiB.
"""
import argparse
import json
from pathlib import Path

def change_once(s,a,b,label):
    n=s.count(a)
    if n!=1:
        raise AssertionError("AI_TRACE_"+label+" expected 1 anchor, got "+str(n))
    return s.replace(a,b,1)

def main(app,plugin,report,clipboard=True):
    transport=plugin/"lib/bithuman_realtime.dart"
    ui=app/"lib/main.dart"
    runtime=app/"lib/hitel_offline_runtime.dart"
    t=transport.read_text()
    t=change_once(t,
        "class BithumanRealtimeSession {\n",
        """class BithumanRealtimeSession {
  /// Test-only hook used by the temporary app to persist event metadata.
  static void Function(String)? debugEventSink;
  static void hitelAiTrace(String event) {
    print('[HITEL_AI_E2E] __DOLLAR__event');
    debugEventSink?.call(event);
  }

""", "plugin-trace-sink")
    assert t.count("print('[HITEL_AI_E2E] ") == 6, \
        "Unexpected AI event print anchors in temp transport"
    t=t.replace("print('[HITEL_AI_E2E] ",
                "BithumanRealtimeSession.hitelAiTrace('")
    # The logger itself must continue printing to the system log.
    t=t.replace(
        "static void hitelAiTrace(String event) {\n"
        "    BithumanRealtimeSession.hitelAiTrace('__DOLLAR__event');",
        "static void hitelAiTrace(String event) {\n"
        "    print('[HITEL_AI_E2E] __DOLLAR__event');")
    transport.write_text(t.replace("__DOLLAR__","$"))
    m=runtime.read_text()
    m=change_once(m,"import 'dart:io';\n",
        "import 'dart:io';\nimport 'package:bithuman/bithuman_realtime.dart';\n","mock-import")
    assert m.count("print('[HITEL_AI_E2E] ")==4, "Unexpected mock event print anchors"
    m=m.replace("print('[HITEL_AI_E2E] ",
                "BithumanRealtimeSession.hitelAiTrace('")
    runtime.write_text(m)
    u=ui.read_text()
    u=change_once(u,
        "  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n",
        """  final HitelOfflineRuntime _offline = HitelOfflineRuntime();
  Future<void> _hitelAiTraceWrites = Future<void>.value();
  void _hitelAppendAiTrace(String event) {
    final stamp = DateTime.now().toIso8601String();
    _hitelAiTraceWrites = _hitelAiTraceWrites.then((_) async {
      final dir = await _appFilesDir();
      final file = File('__DOLLAR__{dir.path}/hitel_ai_e2e.log');
      if (await file.exists() && await file.length() > 524288) {
        await file.writeAsString('', mode: FileMode.write);
      }
      await file.writeAsString(
          '__DOLLAR__stamp [HITEL_AI_E2E] __DOLLAR__event\\n',
          mode: FileMode.append, flush: true);
    }).catchError((Object _) {});
  }
""", "app-metadata-file-logger")
    # UI-only: once the agent's response transcript arrives, it is no longer
    # "Thinking". The vendor status emitter remains unmodified; response.done
    # still returns the UI to "Connected" through the existing statusStream.
    u=change_once(u,
        "if (mounted) setState(() => _caption = 'agent: $d');",
        """if (mounted) setState(() {
        _caption = 'agent: $d';
        _status = 'Speaking…';
      });
      BithumanRealtimeSession.hitelAiTrace(
          'ui.status=speakingProxy reason=botTranscript wallMs=__DOLLAR__{DateTime.now().millisecondsSinceEpoch}');""",
        "show-agent-answer-while-streaming")
    u=change_once(u,
        "    final token = await _offline.start();\n",
        """    BithumanRealtimeSession.debugEventSink = _hitelAppendAiTrace;
    final token = await _offline.start();
""","attach-mock-and-transport-events")
    assert u.count("debugPrint('[HITEL_AI_E2E] ")==3, "Unexpected UI event debugPrint anchors"
    u=u.replace("debugPrint('[HITEL_AI_E2E] ",
                "BithumanRealtimeSession.hitelAiTrace('")
    if clipboard:
        u=change_once(u,
            "      final detail = 'HITEL Essence 2 Android diagnostics\\n'\n",
            """      final aiFile = File('__DOLLAR__{dir.path}/hitel_ai_e2e.log');
      final aiTrace = await aiFile.exists()
          ? await aiFile.readAsString() : '(AI event trace not found)';
      final aiTail = aiTrace.length > 40000
          ? aiTrace.substring(aiTrace.length - 40000) : aiTrace;
      final detail = 'HITEL Essence 2 Android diagnostics\\n'
""","copy-ai-protocol-file")
        # Match the unique interpolation suffix, independent of the heading.
        u=change_once(u,
            "$traceTail';",
            r"$traceTail\n'" + "\n" +
            r"           '--- hitel_ai_e2e.log recent ---\n__DOLLAR__aiTail';",
            "copy-event-tail")
    ui.write_text(u.replace("__DOLLAR__","$"))
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
        "status":"applied to disposable app and plugin only",
        "AI_protocol_trace_file":"app_flutter/hitel_ai_e2e.log",
        "size_limit":524288,
        "clipboard_tail_chars":40000 if clipboard else None,
        "contains_prompt":False,"contains_transcript":False,
        "contains_pcm":False,"contains_secret":False,
        "protocol_or_native_changes":False,
    },indent=2)+"\n")
    print("PASS_ESSENCE2_PERSISTENT_AI_PROTOCOL_TRACE_IN_CLIPBOARD")

if __name__=="__main__":
    a=argparse.ArgumentParser()
    a.add_argument("--app",type=Path,required=True)
    a.add_argument("--plugin",type=Path,required=True)
    a.add_argument("--report",type=Path,required=True)
    a.add_argument("--defer-clipboard",action="store_true")
    x=a.parse_args()
    main(x.app,x.plugin,x.report,clipboard=not x.defer_clipboard)
