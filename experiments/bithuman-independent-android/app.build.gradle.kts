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
        versionName = "1.0-bithuman-independent-encoder"
    }

    androidResources {
        // Required: memory map the 158MB model without decompressing it into memory.
        noCompress += "tflite"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    // Legacy Interpreter API is available on LiteRT 1.x (Google independent runtime).
    implementation("com.google.ai.edge.litert:litert:1.4.2")
}
