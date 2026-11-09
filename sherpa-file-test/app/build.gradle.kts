plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "app.hitel.sherpafiletest"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.hitel.sherpafiletest"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "3.0.0"
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    externalNativeBuild {
        cmake { path = file("src/main/cpp/CMakeLists.txt"); version = "3.22.1" }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { getByName("release") { isMinifyEnabled = false } }
}
