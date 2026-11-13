#!/bin/sh
# Builds the Android app (the PWA in a WebView) and puts the APK where the landing page links to it.
# Needs JDK 17+ and the Android SDK (platform 35); sdk.dir in local.properties or ANDROID_HOME.
set -e
cd "$(dirname "$0")"
./gradlew --no-daemon -q assembleRelease
mkdir -p ../docs/download
cp app/build/outputs/apk/release/app-release.apk ../docs/download/blister-kompass.apk
ls -lh ../docs/download/blister-kompass.apk
