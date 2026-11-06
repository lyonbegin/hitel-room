plugins { id("com.android.application") }
android {
    namespace = "app.hitel.samsungdirect"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.hitel.samsungdirect.v2"
        minSdk = 33
        targetSdk = 34
        versionCode = 2
        versionName = "0.2.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
