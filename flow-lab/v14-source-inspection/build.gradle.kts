plugins { id("com.android.application") }
android {
    namespace = "app.hitel.samsungprobe"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.hitel.callflowlab.v14"
        minSdk = 33
        targetSdk = 33
        versionCode = 21
        versionName = "0.14.7-voice-access-audio-ab"
    }
    defaultConfig {
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

dependencies { implementation(project(":voxsherpa")) }
