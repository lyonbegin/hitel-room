plugins { id("com.android.application") }
android {
    namespace = "app.hitel.bridgeprobe"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.hitel.bridgeprobe"
        minSdk = 33
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-probe"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
