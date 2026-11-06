plugins { id("com.android.application") }
android {
  namespace = "app.hitel.callnative"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.callnative"
    minSdk = 29
    targetSdk = 35
    versionCode = 2
    versionName = "0.2.0"
  }
  buildTypes { getByName("release") { isMinifyEnabled = false } }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

dependencies {
  implementation("dev.rikka.shizuku:api:13.1.5")
  implementation("dev.rikka.shizuku:provider:13.1.5")
}
