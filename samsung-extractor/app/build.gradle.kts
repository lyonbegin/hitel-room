plugins { id("com.android.application") }
android {
  namespace = "app.hitel.samsungapkexport"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.samsungapkexport"
    minSdk = 29
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}
