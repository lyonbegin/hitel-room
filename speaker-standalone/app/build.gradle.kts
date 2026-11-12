plugins { id("com.android.application") }
android {
  namespace = "app.hitel.speakeronly"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.recording.speakeronly"
    minSdk = 26
    targetSdk = 28
    versionCode = 3
    versionName = "1.0.1-16k-media-capturable-log"
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
}
