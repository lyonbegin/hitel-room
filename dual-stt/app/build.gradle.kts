plugins { id("com.android.application") }
android {
    namespace = "app.hitel.dualaudiostt"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.hitel.dualaudiostt"
        minSdk = 29
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0-mic-playback-sherpa"
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation("com.github.k2-fsa:sherpa-onnx:1.12.26")
}
