#!/usr/bin/env python3
"""Route-isolated persistent baseline/WG128 traces and on-phone comparison."""
import argparse
import json
from pathlib import Path

FOLDER="android/src/main/kotlin/ai/bithuman/flutter"

def replace_once(s,old,new,label):
    n=s.count(old)
    if n!=1:
        raise AssertionError("AB_TRACE_"+label+" anchor expected 1 got "+str(n))
    return s.replace(old,new,1)

def apply(app,plugin,route,report):
    assert route in ("BASELINE","WG128")
    trace=plugin/FOLDER/"HitelE2Trace.kt"
    k=trace.read_text()
    k=replace_once(k,'    private const val TAG = "HITEL_E2TRACE"\n',
       '    private const val TAG = "HITEL_E2TRACE"\n    private const val ROUTE = "'+route+'"\n',"route")
    k=replace_once(k,'4L * 1024L * 1024L','16L * 1024L * 1024L',"size")
    k=replace_once(k,'120000L','350000L',"records")
    k=replace_once(k,'val output = File(folder, "hitel_e2_trace.log")',
       'val output = File(folder, "hitel_e2_trace_" + ROUTE + ".log")',"file")
    k=replace_once(k,'val old = File(folder, "hitel_e2_trace.previous.log")',
       'val old = File(folder, "hitel_e2_trace_" + ROUTE + ".previous.log")',"old")
    k=replace_once(k,'var writer = FileOutputStream(output, false)\n                var length = 0L',
       'var writer = FileOutputStream(output, true)\n                var length = output.length()',"append")
    k=replace_once(k,'" stage=" + safe(stage) + " lost="',
       '" stage=" + safe(stage) + " route=" + ROUTE + " lost="',"event")
    k=replace_once(k,'event("trace.start", "version" to 1, "maxFileBytes" to MAX_BYTES)',
       """val so = File(context.applicationInfo.nativeLibraryDir, "lible_jni.so")
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        if (so.exists()) so.inputStream().use { input ->
            val buf = ByteArray(65536)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                digest.update(buf, 0, n)
            }
        }
        val soHash = if (so.exists()) digest.digest().joinToString("") { "%02x".format(it) } else "not-extracted"
        event("trace.start", "route" to ROUTE, "sdkNativeSha256" to soHash,
              "sdkNativeBytes" to so.length(), "version" to 2,
              "apiLevel" to android.os.Build.VERSION.SDK_INT,
              "device" to android.os.Build.DEVICE,
              "board" to android.os.Build.BOARD,
              "maxFileBytes" to MAX_BYTES)
""","native-hash")
    trace.write_text(k)

    path=app/"lib/main.dart"
    s=path.read_text()
    s=replace_once(s,"import 'dart:io';\n",
      "import 'dart:io';\nconst String hitelSdkRoute = String.fromEnvironment('HITEL_SDK_AB_ROUTE', defaultValue: 'BASELINE');\n","dart-constant")
    s=replace_once(s,"/hitel_e2_trace.log'","/hitel_e2_trace_' + hitelSdkRoute + '.log'","dart-file")
    s=replace_once(s,"/hitel_e2_trace.previous.log'","/hitel_e2_trace_' + hitelSdkRoute + '.previous.log'","dart-prev")
    method=r'''  Future<void> _hitelCopySdkAbComparison() async {
    try {
      final dir=await _appFilesDir();
      final a=File(dir.path + '/hitel_e2_trace_BASELINE.log');
      final b=File(dir.path + '/hitel_e2_trace_WG128.log');
      final rawA=await a.exists()?await a.readAsString():'';
      final rawB=await b.exists()?await b.readAsString():'';
      Map<String,List<String>> events(String src) {
        final map=<String,List<String>>{};
        for (final line in src.split('\n')) {
          final match=RegExp(r' stage=([^\s]+)').firstMatch(line);
          if (match!=null) {
            final key=match.group(1)!;
            map.putIfAbsent(key, ()=><String>[]).add(line);
          }
        }
        return map;
      }
      String describe(List<String> lines) {
        if(lines.isEmpty)return 'count=0';
        final duration=<int>[];
        for(final s in lines) {
          final v=RegExp(r'\bdurationUs=(\d+)').firstMatch(s)?.group(1);
          if(v!=null)duration.add(int.parse(v));
        }
        if(duration.isEmpty)return 'count=' + lines.length.toString();
        duration.sort();
        return 'count=' + lines.length.toString() +
          ' avgUs=' + (duration.reduce((x,y)=>x+y)~/duration.length).toString() +
          ' p50Us=' + duration[duration.length~/2].toString() +
          ' maxUs=' + duration.last.toString();
      }
      final aa=events(rawA),bb=events(rawB);
      final stages={...aa.keys,...bb.keys}.toList()..sort();
      final out=<String>[
        'HITEL Essence2 SDK Korean 10s A/B diagnosis',
        'Original JNI / Adreno WG128 four-instruction JNI',
        'Both runs use identical source, Korean 10s PCM, model and audio pipeline',
        'BASELINE_PRESENT=' + rawA.isNotEmpty.toString(),
        'WG128_PRESENT=' + rawB.isNotEmpty.toString(),
        'NOTE: OpenCL kernel -54 and GPU-to-CPU fallback require device logcat.',
        'NO GPU SUCCESS CLAIM from merely loading hardware buffers.',
        'stage | BASELINE | WG128',
      ];
      for(final stage in stages) {
        out.add(stage + ' | ' + describe(aa[stage]??<String>[]) +
          ' | ' + describe(bb[stage]??<String>[]));
      }
      for(final pair in <List<String>>[['BASELINE',rawA],['WG128',rawB]]) {
        final errors=pair[1].split('\n').where((s)=>
          RegExp(r'(?i)(exception|error|failed|fallback|demot|stalled|stale|lost=[1-9])').hasMatch(s)).toList();
        out.add(pair[0]+' exception_or_fallback_candidates='+errors.length.toString());
        out.addAll(errors.take(150));
      }
      final summary=out.join('\n');
      final full=summary+'\n\n===== BASELINE ALL EVENTS =====\n'+rawA+
        '\n===== WG128 ALL EVENTS =====\n'+rawB;
      final save=File(dir.path+'/hitel_sdk_ab_comparison.txt');
      await save.writeAsString(full,flush:true);
      await Clipboard.setData(ClipboardData(text:
        full.length>90000?full.substring(0,90000):full));
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:Text('A/B 로그 비교 복사 완료. 전체 파일: '+save.path)));
    } catch(err) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:Text('A/B 로그 비교 실패: '+err.toString())));
    }
  }

'''
    s=replace_once(s,"  Future<void> _hitelCopyDiagnostics() async {\n",
      method+"  Future<void> _hitelCopyDiagnostics() async {\n","compare-method")
    old='''floatingActionButton: Platform.isAndroid
          ? FloatingActionButton.small(
              tooltip: 'Essence 2 진단 로그 복사',
              onPressed: _hitelCopyDiagnostics,
              child: const Icon(Icons.copy_all_rounded),
            )
          : null,'''
    new='''floatingActionButton: Platform.isAndroid
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('SDK ' + hitelSdkRoute,
                  style: const TextStyle(color: Colors.white,
                    backgroundColor: Colors.black54)),
                FloatingActionButton.small(
                  heroTag: 'hitel_trace_copy',
                  tooltip: '현재 SDK 상세 로그 복사',
                  onPressed: _hitelCopyDiagnostics,
                  child: const Icon(Icons.copy_all_rounded),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'hitel_ab_compare',
                  tooltip: '원본 및 WG128 SDK 로그 비교·복사',
                  onPressed: _hitelCopySdkAbComparison,
                  child: const Icon(Icons.difference_outlined),
                ),
              ],
            )
          : null,'''
    s=replace_once(s,old,new,"controls")
    path.write_text(s)
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
      "route":route,
      "logs":["hitel_e2_trace_BASELINE.log","hitel_e2_trace_WG128.log"],
      "comparison":"hitel_sdk_ab_comparison.txt",
      "full_log_coverage":"plugin JNI entry/exit, feed, pull, player, surface, timing, SDK native SHA",
      "native_cl_error_capture":"ADB logcat required",
      "sequential_install_required":True
    },indent=2)+"\n")
    print("PASS_KOREAN_AB_ROUTE_LOGGING",route)

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--app",required=True,type=Path)
    p.add_argument("--plugin",required=True,type=Path)
    p.add_argument("--route",required=True,choices=["BASELINE","WG128"])
    p.add_argument("--report",required=True,type=Path)
    a=p.parse_args()
    apply(a.app,a.plugin,a.route,a.report)
