plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.example.x2hello"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.example.x2hello"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0-expression2-original-dsp-oracle"
        ndk { abiFilters += "arm64-v8a" }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    // No LiteRT wrapper or custom model engine: this app directly tests
    // a numeric subroutine inside the unmodified original ARM64 SDK.
}
