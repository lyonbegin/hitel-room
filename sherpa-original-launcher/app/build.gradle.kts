plugins { id("com.android.application") }
android {
  namespace = "app.hitel.sherpaoriginalcli"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.sherpaoriginalcli"
    minSdk = 26
    targetSdk = 28
    versionCode = 2
    versionName = "2.0.0"
    ndk { abiFilters.add("arm64-v8a"); abiFilters.add("x86_64") }
  }
  packaging {
    jniLibs {
      useLegacyPackaging = true
      keepDebugSymbols.add("**/liboriginal-cli.so")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildTypes { getByName("release") { isMinifyEnabled = false } }
}
