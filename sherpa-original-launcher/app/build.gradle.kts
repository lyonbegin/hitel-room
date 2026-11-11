plugins { id("com.android.application") }
android {
  namespace = "app.hitel.sherpaoriginalcli"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.koreanzipformer.stream21"
    minSdk = 26
    targetSdk = 28
    versionCode = 21
    versionName = "21.0.0-ko-per-stage-native-arm64"
    ndk { abiFilters.add("arm64-v8a") }
  }
  packaging {
    jniLibs {
      useLegacyPackaging = true
      keepDebugSymbols.add("**/libsensevoice-stream.so")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildTypes { getByName("release") { isMinifyEnabled = false } }
}

dependencies {
  implementation(files("libs/ffmpeg-kit-min.aar"))
  implementation("com.arthenica:smart-exception-java:0.2.1")
  implementation("androidx.documentfile:documentfile:1.0.1")
}
