#!/bin/sh
# Builds the Android app (the PWA in a WebView) into android/dist/. Publish it as the GitHub release asset the landing page
# links to: gh release upload <tag> dist/blister-kompass.apk --clobber (releases/latest/download/blister-kompass.apk).
# Needs JDK 17+ and the Android SDK (platform 35); sdk.dir in local.properties or ANDROID_HOME.
set -e
cd "$(dirname "$0")"
./gradlew --no-daemon -q assembleRelease
mkdir -p dist
cp app/build/outputs/apk/release/app-release.apk dist/blister-kompass.apk
ls -lh dist/blister-kompass.apk
