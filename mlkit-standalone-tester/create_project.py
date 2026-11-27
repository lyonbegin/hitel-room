from pathlib import Path
import shutil, sys, hashlib, urllib.request
root=Path(sys.argv[1]).resolve()
src=Path(__file__).resolve().parent
root.mkdir(parents=True,exist_ok=True)
def write(path, body):
    p=root/path
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(body,encoding="utf-8")
write("settings.gradle.kts",'''pluginManagement { repositories { google(); maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2") }; mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    exclusiveContent {
      forRepository { maven { url = uri("sdk-repository"); metadataSources { mavenPom(); ignoreGradleMetadataRedirection() } } }
      filter { includeModule("com.google.mlkit", "genai-speech-recognition"); includeModule("com.google.mlkit", "genai-common") }
    }
    google()
    maven { url = uri("https://maven-central.storage-download.googleapis.com/maven2") }
    mavenCentral()
  }
}
rootProject.name = "HitelMlKitTester"
include(":app")
''')
write("gradle.properties","android.useAndroidX=true\norg.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\n")
write("app/build.gradle.kts",'''import org.jetbrains.kotlin.gradle.dsl.JvmTarget
plugins { id("com.android.application") version "9.0.1" }
android {
  namespace = "com.hitel.mlkit.tester"
  compileSdk { this.version = release(37) { minorApiLevel = 0 } }
  defaultConfig {
    applicationId = "com.hitel.mlkit.tester"
    minSdk = 31
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
  }
}
kotlin {
  compilerOptions {
    jvmTarget.set(JvmTarget.JVM_11)
    freeCompilerArgs.add("-Xskip-metadata-version-check")
  }
}
dependencies {
  implementation("com.google.mlkit:genai-speech-recognition:1.0.0-alpha2")
  implementation("com.google.mlkit:genai-common:1.0.0-beta5")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
}
''')
write("app/src/main/AndroidManifest.xml",'''<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.RECORD_AUDIO"/>
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <queries>
    <package android:name="com.google.android.tts"/>
    <package android:name="com.google.android.googlequicksearchbox"/>
    <package android:name="com.google.android.gms"/>
    <package android:name="com.google.android.aicore"/>
    <intent><action android:name="android.speech.RecognitionService"/></intent>
  </queries>
  <application android:label="HITEL ML Kit Tester" android:theme="@android:style/Theme.Material.Light.NoActionBar" android:allowBackup="false">
    <activity android:name=".MainActivity" android:exported="true">
      <intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
    </activity>
  </application>
</manifest>''')
p=root/"app/src/main/java/com/hitel/mlkit/tester/MainActivity.kt"
p.parent.mkdir(parents=True,exist_ok=True)
shutil.copyfile(src/"MainActivity.kt",p)
# Use exactly the same original AARs and local Maven routing as the Gallery build.
for name,version,expected in [
 ("genai-speech-recognition","1.0.0-alpha2","a7bef8c8eef655240f4d2cd10bfe5b583c22ec0f384b634691e634fa5d6063f6"),
 ("genai-common","1.0.0-beta5","cefcd33b43fb3078f7d10da169316ae146c0a67b28aa6bf5008f10571d646a4c")]:
    rel=f"com/google/mlkit/{name}/{version}"
    for ext in ("aar","pom"):
        path=f"{rel}/{name}-{version}.{ext}"
        dest=root/"sdk-repository"/path
        dest.parent.mkdir(parents=True,exist_ok=True)
        urllib.request.urlretrieve("https://dl.google.com/dl/android/maven2/"+path,dest)
        digest=hashlib.sha256(dest.read_bytes()).hexdigest()
        if ext=="aar": assert digest==expected,(name,digest)
        print("SDK_INPUT",path,digest,flush=True)
