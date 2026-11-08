#!/usr/bin/env python3
"""Integrate pristine upstream VoxSherpa sources as internal Android library.
Source ref 7f05a35762f033a39c3c8be0d3ff8db982737ea7.
Original classes/assets/layouts remain unchanged; only manifest and Gradle adapt.
"""
import shutil
from pathlib import Path
import xml.etree.ElementTree as ET
root=Path("AndroidProject")
up=Path("voxsherpa-upstream")
orig=up/"app/src/main"
out=root/"voxsherpa/src/main"
required=["ModelsFragmentActivity.java","SettingFragmentActivity.java",
          "VoiceEngine.java","KokoroEngine.java","GenerateFragmentActivity.java"]
for name in required:
    assert (orig/"java/com/CodeBySonu/VoxSherpa"/name).is_file(),name
assert (orig/"java/com/CodeBySonu/VoxSherpa/system/VoxSherpaTtsService.java").is_file()
for folder in ("java","res","assets"):
    shutil.copytree(orig/folder,out/folder,copy_function=shutil.copy2)
shutil.copy2(up/"LICENSE",root/"voxsherpa/UPSTREAM-LICENSE.txt")
(root/"voxsherpa/UPSTREAM-COMMIT.txt").write_text("CodeBySonu95/VoxSherpa-TTS\n7f05a35762f033a39c3c8be0d3ff8db982737ea7\n",encoding="utf-8")
uri="http://schemas.android.com/apk/res/android"
ET.register_namespace("android",uri)
k=lambda x:"{%s}%s"%(uri,x)
tree=ET.parse(orig/"AndroidManifest.xml")
manifest=tree.getroot()
manifest.attrib.pop("package",None)
app=manifest.find("application")
assert app.get(k("name"))==".SketchApplication"
for key in ("allowBackup","resizeableActivity","icon","label","requestLegacyExternalStorage","theme"):
    app.attrib.pop(k(key),None)
for act in app.findall("activity"):
    if k("theme") not in act.attrib:
        act.set(k("theme"),"@style/AppTheme")
    if act.get(k("name"))==".MainActivity":
        for filt in list(act.findall("intent-filter")):
            if any(e.get(k("name"))=="android.intent.action.MAIN" for e in filt.findall("action")):
                act.remove(filt)
for provider in list(app.findall("provider")):
    name=provider.get(k("name"))
    if name in ("androidx.startup.InitializationProvider",
                "com.google.firebase.provider.FirebaseInitProvider"):
        app.remove(provider)
    elif name=="androidx.core.content.FileProvider":
        provider.set(k("authorities"),"com.CodeBySonu.VoxSherpa.HITEL.voxprovider")
tree.write(out/"AndroidManifest.xml",encoding="utf-8",xml_declaration=True)
(root/"voxsherpa/build.gradle.kts").write_text("""plugins { id("com.android.library") }
android {
    namespace = "com.CodeBySonu.VoxSherpa"
    compileSdk = 35
    defaultConfig { minSdk = 30 }
    buildFeatures { viewBinding = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation("com.github.k2-fsa:sherpa-onnx:1.12.26")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.core:core:1.15.0")
    implementation("androidx.viewpager2:viewpager2:1.1.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.squareup.okhttp3:okhttp:5.0.0-alpha.14")
    implementation("com.squareup.okio:okio-jvm:3.9.0")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation(platform("com.google.firebase:firebase-bom:34.1.0"))
    implementation("com.google.firebase:firebase-database")
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
}
""",encoding="utf-8")
b=root/"build.gradle.kts";s=b.read_text(encoding="utf-8")
a='id("com.android.application") version "8.7.3" apply false'
assert a in s
b.write_text(s.replace(a,a+'; id("com.android.library") version "8.7.3" apply false',1),encoding="utf-8")
b=root/"settings.gradle.kts";s=b.read_text(encoding="utf-8")
assert 'include(":app")' in s
b.write_text(s.replace('include(":app")','include(":app", ":voxsherpa")'),encoding="utf-8")
b=root/"app/build.gradle.kts";s=b.read_text(encoding="utf-8")
assert 'versionCode = 15' in s
s=s.replace('versionCode = 15','versionCode = 16',1).replace(
    '0.14.1-sherpa-ko-mic','0.14.2-upstream-vox-integrated',1)
b.write_text(s+'\ndependencies { implementation(project(":voxsherpa")) }\n',encoding="utf-8")
w=root/"app/src/main/java/app/hitel/samsungprobe/W03ConsoleActivity.java"
s=w.read_text(encoding="utf-8")
anchor='        addButtonRow(content,nativeStt,samsungEntry);'
assert anchor in s
s=s.replace(anchor,anchor+'''
        Button voxSettings=btn("VoxSherpa 원본 · 모델 / 음성합성 / 설정",()->{
            log("VOX_UPSTREAM_OPEN","Open original VoxSherpa UI from same HITEL APK");
            try{
                startActivity(new android.content.Intent(
                    this,com.CodeBySonu.VoxSherpa.MainActivity.class));
            }catch(Exception ex){
                log("VOX_UPSTREAM_OPEN_FAILED",ex.toString());
                status("원본 VoxSherpa 화면을 열 수 없습니다: "+ex.getMessage());
            }
        });
        content.addView(voxSettings,new LinearLayout.LayoutParams(-1,dp(48)));''',1)
w.write_text(s,encoding="utf-8")
assert (out/"assets/espeak-ng-data.zip").stat().st_size>8000000
assert (out/"assets/tts_frontend.zip").stat().st_size>8000000
print("PASS: upstream Java/layout/assets/settings/model manager/TTS engine unchanged; existing HITEL STT and Samsung flow preserved")
