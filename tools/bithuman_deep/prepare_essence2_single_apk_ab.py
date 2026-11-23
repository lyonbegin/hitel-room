#!/usr/bin/env python3
"""One APK, two isolated Android SDK processes, one UI selector, persistent A/B logs.

Do not load the two copies of lible_jni in the same JVM: both export/register
identical native methods and the SDK's NativeBridge uses static initialization.
Each SDK process shares the same app data directory and Sofía Korean PCM asset.
"""
import argparse
import json
import re
from pathlib import Path

PKG="android/src/main/kotlin/ai/bithuman/flutter"
ACTIVITY="android/app/src/main/kotlin/ai/bithuman/example/avatar_chat/MainActivity.kt"
MANIFEST="android/app/src/main/AndroidManifest.xml"

def once(s,a,b,label):
    n=s.count(a)
    if n!=1: raise AssertionError("SDK_AB_ANCHOR_"+label+" expected=1 count="+str(n))
    return s.replace(a,b,1)

ACTIVITIES=r'''package ai.bithuman.example.avatar_chat

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.content.ClipData
import java.io.File
import java.util.zip.ZipOutputStream
import java.util.zip.ZipEntry
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/** Launcher only: DO NOT load the vendor JNI into this neutral main process. */
class MainActivity : Activity() {
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        val outer=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(42, 60, 42, 36)
            setBackgroundColor(Color.rgb(22,23,29))
            gravity=Gravity.CENTER
        }
        val title=TextView(this).apply {
            text="Sofia 한국어 10초 · Essence2 SDK 비교"
            textSize=22f
            setTextColor(Color.WHITE)
            gravity=Gravity.CENTER
        }
        val desc=TextView(this).apply {
            text="하나의 APK 안에서 SDK 두 개를 선택합니다.\n"+
                 "원본과 WG128은 각각 별도 Android 프로세스에서 실행하여 JNI 충돌을 피합니다.\n"+
                 "같은 한국어 음성과 Sofia 모델을 사용합니다."
            textSize=15f
            setTextColor(Color.LTGRAY)
            setPadding(0,30,0,36)
            gravity=Gravity.CENTER
        }
        outer.addView(title)
        outer.addView(desc)
        fun button(label:String, target:Class<*>) {
            outer.addView(Button(this).apply {
                text=label
                textSize=18f
                setOnClickListener { startActivity(Intent(this@MainActivity,target)) }
            },LinearLayout.LayoutParams(-1,-2).apply { bottomMargin=20 })
        }
        button("① 원본 Essence2 SDK 실행", OriginalSdkActivity::class.java)
        button("② WG128 GPU 수정 SDK 실행", Wg128SdkActivity::class.java)
        val info=TextView(this).apply {
            text="각 실행 화면에서 SDK 변경·로그 복사·두 경로 비교를 선택할 수 있습니다."
            textSize=13f
            setTextColor(Color.LTGRAY)
        }
        outer.addView(info)
        setContentView(outer)
    }
}

open class SdkFlutterActivity : FlutterActivity() {
    override fun configureFlutterEngine(engine: FlutterEngine) {
        super.configureFlutterEngine(engine)
        MethodChannel(engine.dartExecutor.binaryMessenger,"hitel.sdk.ab")
            .setMethodCallHandler { call,result ->
                when (call.method) {
                    "route" -> {
                        val proc=android.app.Application.getProcessName()
                        result.success(if(proc.endsWith(":hitel_wg128")) "WG128" else "BASELINE")
                    }
                    "switch" -> {
                        val route=call.argument<String>("route")
                        val target=when(route) {
                            "BASELINE" -> OriginalSdkActivity::class.java
                            "WG128" -> Wg128SdkActivity::class.java
                            else -> { result.error("UNKNOWN_SDK",route,null); return@setMethodCallHandler }
                        }
                        val proc=android.app.Application.getProcessName()
                        android.util.Log.i("HITEL_SDK_AB","switch from="+proc+" to="+route)
                        result.success("switch_requested")
                        startActivity(Intent(this,target))
                        finish()
                    }
                    "exportLogs" -> {
                        try {
                            val dir=File(filesDir.parentFile ?: filesDir, "app_flutter")
                            val archive=File(cacheDir, "HITEL_Sofia_GPU_SDK_AB_Logs.zip")
                            val names=listOf(
                                "hitel_e2_trace_BASELINE.log",
                                "hitel_e2_trace_BASELINE.previous.log",
                                "hitel_sdk_backend_BASELINE.log",
                                "hitel_e2_trace_WG128.log",
                                "hitel_e2_trace_WG128.previous.log",
                                "hitel_sdk_backend_WG128.log",
                                "hitel_sdk_ab_comparison.txt",
                                "boot_status.txt"
                            )
                            ZipOutputStream(archive.outputStream().buffered()).use { zip ->
                                for(name in names) {
                                    val file=File(dir,name)
                                    if(file.isFile) {
                                        zip.putNextEntry(ZipEntry(name))
                                        file.inputStream().use { it.copyTo(zip) }
                                        zip.closeEntry()
                                    }
                                }
                            }
                            val uri=FileProvider.getUriForFile(
                                this,packageName+".hitel.sdk.ab",archive)
                            val intent=Intent(Intent.ACTION_SEND).apply {
                                type="application/zip"
                                putExtra(Intent.EXTRA_STREAM,uri)
                                clipData=ClipData.newRawUri("SDK A/B full logs",uri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            startActivity(Intent.createChooser(intent,"SDK 원본/WG128 전체 GPU 로그 보내기"))
                            result.success(archive.length())
                        } catch(error:Exception) {
                            result.error("SDK_AB_ZIP_EXPORT",error.toString(),null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
class OriginalSdkActivity : SdkFlutterActivity()
class Wg128SdkActivity : SdkFlutterActivity()
'''
def update_manifest(m):
    begin=m.index("        <activity\n")
    close=m.index("        </activity>",begin)+len("        </activity>")
    head=r'''        <activity
            android:name="ai.bithuman.example.avatar_chat.MainActivity"
            android:exported="true"
            android:theme="@android:style/Theme.Material.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
'''
    tail=""
    for name,proc in (("OriginalSdkActivity","hitel_original"),("Wg128SdkActivity","hitel_wg128")):
        tail+=f'''        <activity
            android:name="ai.bithuman.example.avatar_chat.{name}"
            android:process=":{proc}"
            android:screenOrientation="portrait"
            android:exported="false"
            android:launchMode="singleTop"
            android:taskAffinity=""
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustNothing">
            <meta-data android:name="io.flutter.embedding.android.NormalTheme"
                       android:resource="@style/NormalTheme"/>
        </activity>
'''
    provider='''        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.hitel.sdk.ab"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/hitel_sdk_ab_paths"/>
        </provider>
'''
    return m[:begin]+head+tail+provider+m[close:]

def patch_trace(plugin):
    """Extend the pinned full GPU diagnostic trace, preserve its backend writer."""
    path=plugin/PKG/"HitelE2Trace.kt"
    t=path.read_text()
    t=once(t,'    private const val TAG = "HITEL_E2TRACE"\n',
      '    private const val TAG = "HITEL_E2TRACE"\n    private val ROUTE get() = HitelSdkLoader.route()\n',"trace-route")
    t=once(t,"12L * 1024L * 1024L","16L * 1024L * 1024L","trace-limit")
    t=once(t,"120000L","350000L","trace-count")
    t=once(t,'val output = File(folder, "hitel_e2_trace.log")',
      'val output = File(folder, "hitel_e2_trace_" + ROUTE + ".log")',"trace-file")
    assert t.count('File(folder, "hitel_e2_trace.previous.log")')==2
    t=t.replace('File(folder, "hitel_e2_trace.previous.log")',
      'File(folder, "hitel_e2_trace_" + ROUTE + ".previous.log")')
    t=once(t,'var writer = FileOutputStream(output, false)',
      'var writer = FileOutputStream(output, true)',"trace-initial-append")
    t=once(t,'FileOutputStream(File(folder, "hitel_sdk_backend.log"), false)',
      'FileOutputStream(File(folder, "hitel_sdk_backend_" + ROUTE + ".log"), true)',
      "backend-route-append")
    t=once(t,'var backendLength = 0L',
      'var backendLength = File(folder, "hitel_sdk_backend_" + ROUTE + ".log").length()',
      "backend-current-size")
    t=once(t,'var length = 0L\n                while (true)',
      'var length = output.length()\n                while (true)',"trace-current-size")
    t=once(t,'" stage=" + safe(stage) + " lost="',
      '" stage=" + safe(stage) + " sdkRoute=" + ROUTE + " lost="',"trace-tag")
    t=once(t,'event("trace.start", "version" to 2, "maxFileBytes" to MAX_BYTES)',
      '''val libName = "lib" + HitelSdkLoader.libraryForProcess() + ".so"
        val libFile = File(context.applicationInfo.nativeLibraryDir, libName)
        val md = java.security.MessageDigest.getInstance("SHA-256")
        if (libFile.isFile) libFile.inputStream().use { stream ->
            val block=ByteArray(65536)
            while(true) {
                val n=stream.read(block)
                if(n<0) break
                md.update(block,0,n)
            }
        }
        val soHash=if(libFile.isFile) md.digest().joinToString("") { "%02x".format(it) }
                  else "not-extracted"
        event("trace.start", "version" to 4, "route" to ROUTE,
            "nativeLib" to libName, "nativeSha256" to soHash,
            "nativeFileBytes" to libFile.length(),
            "process" to android.app.Application.getProcessName(),
            "apiLevel" to android.os.Build.VERSION.SDK_INT,
            "device" to android.os.Build.DEVICE,
            "maxFileBytes" to MAX_BYTES)
''',"trace-identity")
    assert 'sdk.backend.' in t and 'backend.write(bytes)' in t
    path.write_text(t)

DART_METHODS=r'''  String _hitelAbRoute='SDK 확인 중';
  static const MethodChannel _hitelAbChannel=MethodChannel('hitel.sdk.ab');
  Future<void> _hitelAbGetRoute() async {
    try {
      final v=await _hitelAbChannel.invokeMethod<String>('route');
      if(mounted) setState(()=>_hitelAbRoute=v??'알 수 없음');
    } catch(e) {
      if(mounted) setState(()=>_hitelAbRoute='SDK 조회 오류');
      await _mark('sdk_ab.route.error='+e.toString());
    }
  }
  Future<void> _hitelAbSwitch(String route) async {
    try {
      await _mark('sdk_ab.switch.requested from='+_hitelAbRoute+' to='+route);
      await _hitelAbChannel.invokeMethod('switch',<String,String>{'route':route});
    } catch(e) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text('SDK 전환 실패: '+e.toString())));
    }
  }
  Future<void> _hitelAbShareAllLogs() async {
    try {
      await _hitelAbChannel.invokeMethod('exportLogs');
    } catch(error) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text('GPU 로그 전체 ZIP 내보내기 실패: '+error.toString())));
    }
  }
  Future<void> _hitelAbCompare() async {
    try {
      final dir=await _appFilesDir();
      final srcA=File(dir.path+'/hitel_e2_trace_BASELINE.log');
      final srcB=File(dir.path+'/hitel_e2_trace_WG128.log');
      final base=await srcA.exists()?await srcA.readAsString():'';
      final wg=await srcB.exists()?await srcB.readAsString():'';
      Map<String,List<String>> records(String raw) {
        final result=<String,List<String>>{};
        for(final line in raw.split('\n')) {
          final m=RegExp(r'\bstage=([^\s]+)').firstMatch(line);
          if(m!=null)result.putIfAbsent(m.group(1)!,()=> <String>[]).add(line);
        }
        return result;
      }
      String metrics(List<String> events) {
        final d=<int>[];
        for(final l in events) {
          final match=RegExp(r'\bdurationUs=(\d+)').firstMatch(l);
          if(match!=null)d.add(int.parse(match.group(1)!));
        }
        if(d.isEmpty)return 'count='+events.length.toString();
        d.sort();
        final sum=d.fold<int>(0,(v,x)=>v+x);
        return 'count='+events.length.toString()+
         ',avgUs='+(sum~/d.length).toString()+
         ',p50Us='+d[d.length~/2].toString()+
         ',p95Us='+d[(d.length*0.95).floor()].toString()+
         ',maxUs='+d.last.toString();
      }
      final a=records(base),b=records(wg);
      final allStages={...a.keys,...b.keys}.toList()..sort();
      final comparison=<String>[
        'Sofia 한국어 10초 Essence2 SDK 비교 로그',
        'BASELINE=원본 lible_jni.so',
        'WG128=수정 lible_jni_wg128.so (ARM64 4 instructions)',
        '두 SDK는 동일 APK·PCM·모델·재생 코드이며 Android 분리 프로세스로 동작',
        'A로그 존재='+base.isNotEmpty.toString()+' B로그 존재='+wg.isNotEmpty.toString(),
        'stage | BASELINE count/time | WG128 count/time',
      ];
      for(final stage in allStages)comparison.add(
        stage+' | '+metrics(a[stage]??<String>[])+
        ' | '+metrics(b[stage]??<String>[]));
      for(final pair in <List<String>>[['BASELINE',base],['WG128',wg]]) {
        final matches=pair[1].split('\n').where((l)=>
          RegExp(r'(cl_error|-54|exception|error|fail|demot|fallback|stalled|stale|lost=[1-9])',caseSensitive:false)
            .hasMatch(l)).toList();
        comparison.add(pair[0]+' error/fallback candidate lines='+matches.length.toString());
        comparison.addAll(matches.take(200));
        final frames= <int>{};
        for(final line in (pair[0]=='BASELINE'?a:b)['sdk.pull.result']??<String>[]) {
          if(line.contains('frame=false'))continue;
          final m=RegExp(r'\bordinal=(\d+)').firstMatch(line);
          if(m!=null)frames.add(int.parse(m.group(1)!));
        }
        comparison.add(pair[0]+' unique_sdk_frame_ordinals='+frames.length.toString());
      }
      comparison.add('주의: 실제 OpenCL 커널 내부 -54와 GPU→CPU 전환은 별도 logcat 검증 필요');
      final summary=comparison.join('\n');
      final full=summary+'\n\n--- BASELINE RAW EVENTS ---\n'+base+
        '\n\n--- WG128 RAW EVENTS ---\n'+wg;
      final file=File(dir.path+'/hitel_sdk_ab_comparison.txt');
      await file.writeAsString(full,flush:true);
      await Clipboard.setData(ClipboardData(
          text:full.length>140000?full.substring(0,140000):full));
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text('SDK 차이점 및 로그 복사 완료 (전체 비교 파일 별도 저장)')));
    } catch(e) {
      if(mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text('SDK 로그 비교 실패: '+e.toString())));
    }
  }

'''
def patch_ui(app):
    path=app/"lib/main.dart"
    s=path.read_text()
    if "import 'package:flutter/services.dart';" not in s:
        s=once(s,"import 'dart:io';\n",
          "import 'dart:io';\nimport 'package:flutter/services.dart' show MethodChannel;\n","dart-channel-import")
    else:
        pass
    s=once(s,"  Future<void> _hitelCopyDiagnostics() async {\n",
        DART_METHODS+"  Future<void> _hitelCopyDiagnostics() async {\n","dart-ab-methods")
    s=once(s,"    WidgetsBinding.instance.addObserver(this);\n",
        "    WidgetsBinding.instance.addObserver(this);\n    _hitelAbGetRoute();\n","dart-route-init")
    # The existing clipboard UI reads the per-route native trace.
    s=once(s,"/hitel_e2_trace.log'",
        "/hitel_e2_trace_'+_hitelAbRoute+'.log'","dart-current-log")
    s=once(s,"/hitel_e2_trace.previous.log'",
        "/hitel_e2_trace_'+_hitelAbRoute+'.previous.log'","dart-current-prev")
    anchor="""floatingActionButton: Platform.isAndroid
          ? FloatingActionButton.small(
              tooltip: 'Essence 2 진단 로그 복사',
              onPressed: _hitelCopyDiagnostics,
              child: const Icon(Icons.copy_all_rounded),
            )
          : null,"""
    replacement="""floatingActionButton: Platform.isAndroid
          ? Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('실행 SDK: '+_hitelAbRoute,style:
                    const TextStyle(color:Colors.white,backgroundColor:Colors.black54)),
                Row(mainAxisSize:MainAxisSize.min,children:[
                  TextButton(onPressed:()=>_hitelAbSwitch('BASELINE'),
                    child:const Text('원본 SDK')),
                  TextButton(onPressed:()=>_hitelAbSwitch('WG128'),
                    child:const Text('GPU 수정 SDK')),
                ]),
                FloatingActionButton.small(
                  heroTag:'sdk_ab_copy',tooltip:'현재 SDK 상세 로그 복사',
                  onPressed:_hitelCopyDiagnostics,
                  child:const Icon(Icons.copy_all_rounded)),
                const SizedBox(height:8),
                FloatingActionButton.small(
                  heroTag:'sdk_ab_compare',tooltip:'두 SDK 로그 비교 및 전체 로그 저장',
                  onPressed:_hitelAbCompare,
                  child:const Icon(Icons.difference_outlined)),
                const SizedBox(height:8),
                FloatingActionButton.small(
                  heroTag:'sdk_ab_export_all',tooltip:'원본·WG128 GPU 로그 전체를 ZIP으로 보내기',
                  onPressed:_hitelAbShareAllLogs,
                  child:const Icon(Icons.folder_zip_outlined)),
              ],
            )
          : null,"""
    s=once(s,anchor,replacement,"dart-choice-controls")
    path.write_text(s)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--app",type=Path,required=True)
    p.add_argument("--plugin",type=Path,required=True)
    p.add_argument("--loader-source",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    a=p.parse_args()
    native=a.plugin/PKG/"HitelSdkLoader.kt"
    assert not native.exists()
    native.write_bytes(a.loader_source.read_bytes())
    patch_trace(a.plugin)
    patch_ui(a.app)
    activity=a.app/ACTIVITY
    assert "class MainActivity : FlutterActivity()" in activity.read_text()
    activity.write_text(ACTIVITIES)
    manifest=a.app/MANIFEST
    manifest.write_text(update_manifest(manifest.read_text()))
    path=a.app/"android/app/src/main/res/xml/hitel_sdk_ab_paths.xml"
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text('''<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="hitel_gpu_sdk_ab_logs" path="."/>
</paths>
''')
    assert "android:process=\":hitel_original\"" in manifest.read_text()
    assert "android:process=\":hitel_wg128\"" in manifest.read_text()
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({
      "single_apk":True,"native_variants":["lible_jni.so","lible_jni_wg128.so"],
      "native_loader_binding":"NativeBridge static initializer chooses by process",
      "android_processes":[":hitel_original",":hitel_wg128"],
      "switch":"same APK, Android starts other isolated FlutterActivity",
      "same_app_data":True,"preserved_model_and_korean_pcm":True,
      "persistent_native_logs":["hitel_e2_trace_BASELINE.log","hitel_e2_trace_WG128.log"],
      "full_comparison_file":"hitel_sdk_ab_comparison.txt",
      "share":"all raw GPU baseline+WG128 traces/backend logs in one shareable ZIP via FileProvider",
      "live_same_process_hot_swap":False,
      "opencl_kernel_exact_workgroups_observed":False
    },indent=2,ensure_ascii=False)+"\n")
    print("PASS_SINGLE_APK_SDK_PROCESS_ISOLATION_AND_USER_SELECTOR")

if __name__=="__main__": main()
