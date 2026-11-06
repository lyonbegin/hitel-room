plugins { id("com.android.application") }
android {
  namespace = "app.hitel.callnative"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.callnative"
    minSdk = 29
    targetSdk = 35
    versionCode = 3
    versionName = "0.3.0"
  }
  buildTypes { getByName("release") { isMinifyEnabled = false } }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

