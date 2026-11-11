plugins { id("com.android.application") }
android {
  namespace = "app.hitel.sherpaoriginalcli"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.koreanzipformer.integrity14"
    minSdk = 26
    targetSdk = 28
    versionCode = 14
    versionName = "14.0.0-ko-174m-fifo-drain"
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
