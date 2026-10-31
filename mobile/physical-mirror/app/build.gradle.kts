plugins { id("com.android.application") }
android {
 namespace = "app.hitel.screen"
 compileSdk = 35
 defaultConfig {
  applicationId = "app.hitel.screen"
  minSdk = 26
  targetSdk = 33
  versionCode = 3
  versionName = "0.2.1"
 }
 buildTypes { getByName("release") { isMinifyEnabled = false } }
 compileOptions {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
 }
}
dependencies { implementation("com.squareup.okhttp3:okhttp:4.12.0") }
