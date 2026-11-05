plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "dev.fixture.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.fixture.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    testImplementation(libs.junit)
}
