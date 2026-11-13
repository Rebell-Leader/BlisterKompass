plugins {
    id("com.android.application")
}

// The app is the PWA from ../../pwa, bundled as assets and served offline from
// https://appassets.androidplatform.net/ inside a WebView. No server, no network permission.
val pwaDir = rootProject.projectDir.resolve("../pwa")
val pwaAssets = layout.buildDirectory.dir("generated/pwa-assets")

val syncPwa by tasks.registering(Sync::class) {
    from(pwaDir) {
        exclude("tests/**", "scripts/**", "node_modules/**", "package.json", "package-lock.json",
            "README.md", ".gitignore", "sw.js")
    }
    into(pwaAssets.map { it.dir("pwa") })
}

android {
    namespace = "de.hackathon.blisterkompass"
    compileSdk = 35

    defaultConfig {
        applicationId = "de.blisterkompass.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Hackathon build: signed with the local debug key so the APK installs by sideloading.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets["main"].assets.srcDir(pwaAssets)
}

tasks.named("preBuild") { dependsOn(syncPwa) }

dependencies {
    implementation("androidx.core:core:1.13.1")
}
