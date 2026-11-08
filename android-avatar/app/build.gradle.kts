plugins {
    id("com.android.application")
}
android {
    namespace = "kr.hitel.s2avatar"
    compileSdk = 36
    defaultConfig {
        applicationId = "kr.hitel.s2avatar"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation("androidx.webkit:webkit:1.18.0")
}
val hostPython = if (System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
    listOf("py", "-3")
} else {
    listOf("python3")
}
val syncDhLive = tasks.register<Exec>("syncDhLiveAssets") {
    workingDir = rootProject.projectDir
    commandLine(hostPython + listOf("tools/sync_dhlive.py"))
}
tasks.named("preBuild") {
    dependsOn(syncDhLive)
}
