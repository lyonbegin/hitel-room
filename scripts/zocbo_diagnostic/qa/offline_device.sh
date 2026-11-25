#!/usr/bin/env bash
set -euo pipefail
production_apk=$1
qa_dir=$(mktemp -d)
qa_source=$(cd "$(dirname "$0")/../src/com/hitel/zocbodiag" && pwd)
tools_dir=$(ls -d "${ANDROID_HOME}"/build-tools/* | sort -V | tail -1)
android_jar=$(ls -d "${ANDROID_HOME}"/platforms/android-*/android.jar | sort -V | tail -1)
adb install -r "$production_apk"
adb shell svc wifi disable
adb shell svc data disable
adb shell settings put global airplane_mode_on 1
adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state true >/dev/null
sleep 3
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n com.eduzone.eduzoneviewer/.ui.activities.SplashActivity
wait_text() {
  for i in $(seq 1 18); do
    adb shell uiautomator dump /data/local/tmp/papers-ui.xml >/dev/null 2>&1 || true
    adb shell cat /data/local/tmp/papers-ui.xml >"$qa_dir/ui.xml"
    if python3 - "$qa_dir/ui.xml" "$1" <<'PY'
import sys, xml.etree.ElementTree as ET
try: ok=any(n.get("text") == sys.argv[2] for n in ET.parse(sys.argv[1]).iter("node"))
except ET.ParseError: ok=False
sys.exit(0 if ok else 1)
PY
    then return; fi
    sleep 1
  done
  adb shell dumpsys activity activities | grep -E 'mResumed|topResumed' || true
  adb logcat -d -s AndroidRuntime:E | tail -n 60
  return 1
}
tap_text() {
  read -r x y < <(python3 - "$qa_dir/ui.xml" "$1" <<'PY'
import sys, re, xml.etree.ElementTree as ET
node = next(n for n in ET.parse(sys.argv[1]).iter("node") if n.get("text") == sys.argv[2])
a,b,c,d = map(int, re.findall(r'\d+', node.get('bounds')))
print((a+c)//2,(b+d)//2)
PY
)
  adb shell input tap "$x" "$y"
}
wait_text '저장한 시험지'
echo 'PASS signed APK airplane-mode cold launch'
# Exercise the same reader, storage and HTTP freshness code in an isolated
# fixture package. Its synthetic identity and PDF exist only in the fixture.
mkdir -p "$qa_dir/src/com/hitel/zocbodiag" "$qa_dir/classes" "$qa_dir/dex"
dest="$qa_dir/src/com/hitel/zocbodiag"
cp "$qa_source"/{NativePdfEntryActivity,PrivatePapers,PaperFreshness}.java "$dest"
cat > "$dest/Diag.java" <<'JAVA'
package com.hitel.zocbodiag;
import android.content.Context;
public final class Diag {
  static boolean showViewer(Context a) { return a.getSharedPreferences("test",0).getBoolean("on",true); }
  static android.content.Context applicationContext() { return null; }
  static void log(String tag,String text) { android.util.Log.w(tag,text); }
}
JAVA
mkdir -p "$qa_dir/src/com/eduzone/eduzoneviewer/"{repository,ui/networkmodels} "$qa_dir/src/okhttp3" "$qa_dir/src/retrofit2" "$qa_dir/src/v3" "$qa_dir/src/com/google/gson/annotations"
cat > "$qa_dir/src/com/eduzone/eduzoneviewer/repository/k.java" <<'JAVA'
package com.eduzone.eduzoneviewer.repository;
public final class k { public static Object b(String name,Object value){return value;} }
JAVA
cat > "$qa_dir/src/com/eduzone/eduzoneviewer/ui/networkmodels/ResMine.java" <<'JAVA'
package com.eduzone.eduzoneviewer.ui.networkmodels;
public class ResMine { public ResMine getMemberInfo(){return this;} public int getUserId(){return 34;} }
JAVA
cat > "$qa_dir/src/com/google/gson/annotations/SerializedName.java" <<'JAVA'
package com.google.gson.annotations;
@java.lang.annotation.Retention(java.lang.annotation.RetentionPolicy.RUNTIME)
public @interface SerializedName { String value(); }
JAVA
cat > "$qa_dir/src/v3/n.java" <<'JAVA'
package v3;
import com.google.gson.annotations.SerializedName;
public class n {
  @SerializedName("expapr_no") int id=741;
  @SerializedName("file_type") String type="Q";
  @SerializedName("pk") String pk="";
  @SerializedName("short_url") String url="";
}
JAVA
cat > "$qa_dir/src/retrofit2/Invocation.java" <<'JAVA'
package retrofit2;
public class Invocation { public java.util.List<?> arguments(){return java.util.Collections.singletonList(new v3.n());} }
JAVA
cat > "$qa_dir/src/okhttp3/Request.java" <<'JAVA'
package okhttp3;
public class Request { public Object tag(Class<?> t){return new retrofit2.Invocation();} }
JAVA
cat > "$qa_dir/src/okhttp3/Response.java" <<'JAVA'
package okhttp3;
public class Response {
  public Headers headers(){return new Headers();} public int code(){return 200;} public ResponseBody peekBody(long n){return new ResponseBody();}
  public static class Headers { public String get(String name){return "Cache-Control".equals(name)?"private, max-age=3600":null;} }
}
JAVA
cat > "$qa_dir/src/okhttp3/ResponseBody.java" <<'JAVA'
package okhttp3;
public class ResponseBody { public String string(){return "{\"pdf_path\":\"https://example.invalid/sample\"}";} }
JAVA
cat > "$dest/Fixture.java" <<'JAVA'
package com.hitel.zocbodiag;
import android.app.Activity;
import android.content.Intent;
import android.graphics.pdf.PdfDocument;
import android.os.Bundle;
import java.io.*;
public class Fixture extends Activity {
  public void onCreate(Bundle b) {
    super.onCreate(b);
    try {
      if(!"seed".equals(getIntent().getAction())) {
        startActivity(new Intent(this,NativePdfEntryActivity.class)); finish(); return;
      }
      getIntent().putExtra(PrivatePapers.EXAM,"741").putExtra(PrivatePapers.TYPE,"Q");
      Object vm=new Object();
      getSharedPreferences("test",0).edit().putBoolean("on",true).commit();
      PrivatePapers.begin(this,vm);
      if(PrivatePapers.prepare(vm,"two-page fixture","https://example.invalid/sample"))throw new AssertionError("ON intercepted");
      getSharedPreferences("test",0).edit().putBoolean("on",false).commit();
      PrivatePapers.begin(this,vm);
      okhttp3.Response response = new okhttp3.Response();
      PrivatePapers.recordModel(response,new okhttp3.Request(),PrivatePapers.account());
      if(!PrivatePapers.prepare(vm,"두 페이지 시험지","https://example.invalid/sample"))throw new AssertionError("OFF not selected");
      File source=new File(getCacheDir(),"sample.pdf");
      try(PdfDocument pdf=new PdfDocument(); FileOutputStream out=new FileOutputStream(source)) {
        for(int i=1;i<=2;i++){PdfDocument.Page page=pdf.startPage(new PdfDocument.PageInfo.Builder(240,320,i).create());
          page.getCanvas().drawColor(i==1?android.graphics.Color.YELLOW:android.graphics.Color.CYAN);pdf.finishPage(page);}
        pdf.writeTo(out);
      }
      PrivatePapers.received(vm,source,response);
      if(PrivatePapers.list(this,PrivatePapers.account()).size()!=1 || !PrivatePapers.list(this,"different").isEmpty())
        throw new AssertionError("offline index isolation");
      if(PaperFreshness.deadline("no-store",null,null,null,100)!=0 || PaperFreshness.deadline("no-cache",null,null,null,100)!=0 ||
         PaperFreshness.deadline("private, max-age=8",null,null,"2",100)!=6100)
        throw new AssertionError("cache directives");
      android.util.Log.i("PAPER_QA","PASS save callback, ON, OFF, account and freshness");
    } catch(Exception e){ throw new RuntimeException(e); }
  }
}
JAVA
cat > "$qa_dir/AndroidManifest.xml" <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="dev.hitel.paperfixture">
  <uses-sdk android:minSdkVersion="23" android:targetSdkVersion="28" />
  <application android:label="Paper fixture" android:theme="@android:style/Theme.Material.Light">
    <activity android:name="com.hitel.zocbodiag.Fixture" android:exported="true"/>
    <activity android:name="com.hitel.zocbodiag.NativePdfEntryActivity" android:exported="false"/>
  </application>
</manifest>
XML
javac -encoding UTF-8 -source 8 -target 8 -Xlint:-options -cp "$android_jar" -d "$qa_dir/classes" $(find "$qa_dir/src" -name '*.java')
"$tools_dir/d8" --min-api 23 --lib "$android_jar" --output "$qa_dir/dex" $(find "$qa_dir/classes" -name '*.class')
"$tools_dir/aapt" package -f -M "$qa_dir/AndroidManifest.xml" -I "$android_jar" -F "$qa_dir/qa.apk"
(cd "$qa_dir/dex" && zip -q "$qa_dir/qa.apk" classes.dex)
keytool -genkeypair -keystore "$qa_dir/test.jks" -storepass android -keypass android -alias qa -dname CN=QA -keyalg RSA -validity 3 >/dev/null 2>&1
"$tools_dir/apksigner" sign --ks "$qa_dir/test.jks" --ks-pass pass:android "$qa_dir/qa.apk"
adb install -r "$qa_dir/qa.apk"
adb logcat -c
adb shell am start -W -a seed -n dev.hitel.paperfixture/com.hitel.zocbodiag.Fixture
for i in $(seq 1 15); do
  if adb logcat -d -s PAPER_QA:I | grep -q 'PASS save callback'; then break; fi
  sleep 1
done
adb logcat -d -s PAPER_QA:I | grep 'PASS save callback'
adb shell am force-stop dev.hitel.paperfixture
adb shell am start -W -a read -n dev.hitel.paperfixture/com.hitel.zocbodiag.Fixture
wait_text '두 페이지 시험지'
tap_text '두 페이지 시험지'
wait_text '1 / 2'
tap_text '다음'
wait_text '2 / 2'
tap_text '이전'
wait_text '1 / 2'
echo 'PASS saved two-page PDF after process restart with networking disabled'
