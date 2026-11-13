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
        versionName = "original-expression2-0.6.2-emulator-smoke"
        ndk { abiFilters += "arm64-v8a" }
        buildConfigField("String", "BITHUMAN_API_SECRET", "\"\"")
    }
    buildFeatures { buildConfig = true }
    packaging { jniLibs { useLegacyPackaging = true } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    // An official unmodified SDK from the vendor Maven repository.
    implementation("ai.bithuman:expression2-android:0.6.2")
}
