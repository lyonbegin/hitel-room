#!/usr/bin/env python3
"""Restore the PINNED 2026-11-22 WG128 diagnostic stack on BOTH SDK routes.

Source files in essence2_ab_verified/ are literal blobs from commit bf7290b661,
unchanged. Only the test assembly copies gain process-specific .so recognition.
Both routes share exactly the SAME instrumented classes.jar and HitelSdkProbe.
"""
import argparse
import hashlib
import json
from pathlib import Path

PKG="android/src/main/kotlin/ai/bithuman/flutter"

def once(src,old,new,label):
    n=src.count(old)
    if n!=1:
        raise AssertionError(f"GPU_AB_ANCHOR_{label} expected=1 actual={n}")
    return src.replace(old,new,1)

def prepare(plugin,source,report,cppout):
    dest=plugin/PKG
    assert dest.is_dir()
    kotlin=(source/"HitelSdkProbe.kt").read_text()
    kotlin=once(kotlin,
      'if (nativeAvailable) nativePrepareGpuAudit() else 0',
      'if (nativeAvailable) nativePrepareGpuAudit(HitelSdkLoader.libraryForProcess()) else 0',
      "KOTLIN_ROUTE_SELECTED_PROBE")
    kotlin=once(kotlin,
      "    private external fun nativePrepareGpuAudit(): Int",
      "    private external fun nativePrepareGpuAudit(sdkLibrary: String): Int",
      "KOTLIN_DECLARATION")
    kotlin=once(kotlin,
      'HitelE2Trace.event("sdk.probe.ready", "nativeLibrary" to nativeAvailable, "captureFlags" to flags,',
      'HitelE2Trace.event("sdk.probe.ready", "sdkRoute" to HitelSdkLoader.route(), "nativeLibrary" to nativeAvailable, "captureFlags" to flags,',
      "KOTLIN_TRACE_ROUTE")
    (dest/"HitelSdkProbe.kt").write_text(kotlin)

    original=(source/"hitel_e2_probe.cpp").read_text()
    cpp=once(original,
      "int install_gpu_audit() {",
      "int install_gpu_audit(const char* selected) {",
      "CPP_CLAIM_NATIVE_ROUTE")
    cpp=once(cpp,
      "        void* lib = dlopen(\"lible_jni.so\", RTLD_NOW | RTLD_NOLOAD);",
      '        const bool wg128 = std::strcmp(selected, "le_jni_wg128") == 0;\n'
      '        const bool baseline = std::strcmp(selected, "le_jni") == 0;\n'
      '        if (!wg128 && !baseline) {\n'
      '            capture("[hitel-cl] hook unavailable: invalid selected SDK library", "cl-api", true);\n'
      '            return;\n'
      '        }\n'
      '        const char* chosen = wg128 ? "lible_jni_wg128.so" : "lible_jni.so";\n'
      '        void* lib = dlopen(chosen, RTLD_NOW | RTLD_NOLOAD);',
      "CPP_LOAD_MATCH_SELECTED")
    cpp=once(cpp,
      "            *reinterpret_cast<const unsigned*>(base + 0x20906c) != 0x93407d16 ||\n"
      "            *reinterpret_cast<const unsigned*>(base + 0x20b5f0) != 0x937f7d08 ||\n"
      "            *reinterpret_cast<const unsigned*>(base + 0x215f44) != 0x5280002b ||\n"
      "            *reinterpret_cast<const unsigned*>(base + 0x215f88) != 0x52800037) {",
      "            *reinterpret_cast<const unsigned*>(base + 0x20906c) != (wg128 ? 0x93407d16u : 0x937d7d16u) ||\n"
      "            *reinterpret_cast<const unsigned*>(base + 0x20b5f0) != (wg128 ? 0x937f7d08u : 0x937c7d08u) ||\n"
      "            *reinterpret_cast<const unsigned*>(base + 0x215f44) != (wg128 ? 0x5280002bu : 0x5280010bu) ||\n"
      "            *reinterpret_cast<const unsigned*>(base + 0x215f88) != (wg128 ? 0x52800037u : 0x52800117u)) {",
      "CPP_VALIDATE_BASELINE_AND_WG128")
    cpp=once(cpp,
      '        capture("[hitel-cl] hook installed: real create/wg_limit/enqueue/release; no driver return changes", "cl-api", true);',
      '        capture(wg128 ? "[hitel-cl] hook installed: WG128 real create/wg_limit/enqueue/release" :\n'
      '                        "[hitel-cl] hook installed: BASELINE real create/wg_limit/enqueue/release", "cl-api", true);',
      "CPP_LOG_INSTALLED_ROUTE")
    cpp=once(cpp,
      'Java_ai_bithuman_flutter_HitelSdkProbe_nativePrepareGpuAudit(JNIEnv*, jobject) {\n'
      '    return install_gpu_audit();\n}',
      'Java_ai_bithuman_flutter_HitelSdkProbe_nativePrepareGpuAudit(JNIEnv* env, jobject, jstring sdkName) {\n'
      '    if (!sdkName) return 0;\n'
      '    const char* selected = env->GetStringUTFChars(sdkName, nullptr);\n'
      '    if (!selected) return 0;\n'
      '    const int result = install_gpu_audit(selected);\n'
      '    env->ReleaseStringUTFChars(sdkName, selected);\n'
      '    return result;\n}',
      "CPP_JNI_ROUTE_PARAM")
    # Old C++ std::call_once lambda must CAPTURE selected from lexical function.
    cpp=once(cpp,
      "    std::call_once(gpu_once, [] {",
      "    std::call_once(gpu_once, [selected] {",
      "CPP_ONCE_CAPTURE_SELECTED")
    cppout.parent.mkdir(parents=True,exist_ok=True)
    cppout.write_text(cpp)

    # Attach the old probe BEFORE SDK create, not after native operations.
    pluginfile=dest/"BithumanPlugin.kt"
    body=pluginfile.read_text()
    body=once(body,
      "        HitelE2Trace.init(context)\n",
      "        HitelE2Trace.init(context)\n"
      "        HitelSdkProbe.install(context)\n"
      "        HitelSdkProbe.setTurn(1)\n",
      "PLUGIN_EARLY_PROBE_INSTALL")
    pluginfile.write_text(body)

    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
      "pinned_gpu_diagnostics_commit":"bf7290b6615117a4cb6a8cbb6b509282669b5765",
      "same_probe_kotlin_both_routes":True,
      "same_cpp_probe_both_routes":True,
      "existing_gpu_kernel_hook":"OpenCL API function pointer table, four hooks (create,wg_limit,enqueue,release)",
      "only_probe_change":"choose SDK process native name and validate ORIGINAL vs WG128 instruction identity",
      "native_source_sha256":hashlib.sha256(original.encode()).hexdigest(),
      "instrumented_calls_sdk_jvm":"same HitelProbeBridge both native variants",
      "backend_debug_capture":True,
      "probe_log_events":["sdk.probe.ready","sdk.backend.clhook","sdk.backend.create_args",
             "sdk.backend.native","sdk.backend.snapshot","sdk.internal.call",
             "sdk.library.mapped","sdk.worker.cpu"]
    },indent=2)+"\n")
    print("PASS_RESTORED_PINNED_GPU_PROBE_APPLIED_IDENTICALLY_TO_TWO_SDK_ROUTES")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--plugin",required=True,type=Path)
    p.add_argument("--sources",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    p.add_argument("--cpp-out",required=True,type=Path)
    a=p.parse_args()
    prepare(a.plugin,a.sources,a.report,a.cpp_out)
