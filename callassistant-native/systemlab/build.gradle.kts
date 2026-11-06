plugins { id("com.android.application") }
android {
  namespace = "app.hitel.systemlab"
  compileSdk = 35
  defaultConfig {
    applicationId = "app.hitel.systemlab"
    minSdk = 30
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}
dependencies {
  testImplementation("junit:junit:4.13.2")
}
