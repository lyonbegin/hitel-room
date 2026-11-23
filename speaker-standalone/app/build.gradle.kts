plugins { id("com.android.application") }
android {
  namespace = "app.hitel.speakeronly"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.recording.directstt"
    minSdk = 26
    targetSdk = 28
    versionCode = 9
    versionName = "1.0.9-ixio-pcm-contract-endpoint"
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
  // IXIO speechSDK and native libraries are staged from the original IXIO APK.
  // The HITEL14 public Sherpa-ONNX dependency is explicitly prohibited.
  implementation("org.jetbrains.kotlin:kotlin-stdlib:2.0.21")
}
