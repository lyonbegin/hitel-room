plugins { id("com.android.application") }
android {
  namespace = "app.hitel.speakeronly"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.recording.directstt"
    minSdk = 26
    targetSdk = 28
    versionCode = 5
    versionName = "1.0.4-direct-korean-stt-experiment"
    ndk { abiFilters.add("arm64-v8a") }
  }
  packaging {
    jniLibs { useLegacyPackaging = true }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}
dependencies {
  implementation("androidx.documentfile:documentfile:1.0.1")
  implementation("com.github.k2-fsa:sherpa-onnx:v1.12.26")
}
