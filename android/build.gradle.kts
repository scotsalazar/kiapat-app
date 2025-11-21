plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.kiapat"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.kiapat"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    // existing Kiapat mobile app dependencies
}
