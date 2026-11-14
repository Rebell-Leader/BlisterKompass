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
        // ML Kit's OCR library is ~11 MB per ABI; phones are ARM (and Apple-silicon emulators arm64), so no x86 copies.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
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
    // Imprint OCR, on the phone: the Latin model is bundled in the APK, nothing is downloaded.
    implementation("com.google.mlkit:text-recognition:16.0.1")
    // ML Kit pulls kotlin-stdlib-jdk7/8 1.6 next to androidx's stdlib 1.8 (duplicate classes): align them.
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.8.22"))
}
