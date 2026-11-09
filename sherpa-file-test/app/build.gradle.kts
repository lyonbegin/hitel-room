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
        versionCode = 2
        versionName = "2.0.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { getByName("release") { isMinifyEnabled = false } }
}
dependencies {
    implementation("com.github.k2-fsa:sherpa-onnx:1.12.26")
    implementation("dev.ffmpegkit-maintained:ffmpeg-kit-min:8.1.7")
}
