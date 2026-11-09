plugins { id("com.android.application") }
android {
  namespace = "app.hitel.sherpaoriginalcli"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.sensevoice.koreanfile"
    minSdk = 26
    targetSdk = 28
    versionCode = 1
    versionName = "1.0.0-sensevoice"
    ndk { abiFilters.add("arm64-v8a") }
  }
  packaging {
    jniLibs {
      useLegacyPackaging = true
      keepDebugSymbols.add("**/libsensevoice-cli.so")
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
}
