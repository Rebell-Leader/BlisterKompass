#!/bin/sh
# Regenerates the Android launcher icons from the PWA icons (run after pwa/icons change).
set -e
cd "$(dirname "$0")"
RES=app/src/main/res
cp ../pwa/icons/icon-maskable-512.png $RES/drawable/icon_maskable.png
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  n=${d%%:*}; s=${d##*:}
  mkdir -p $RES/mipmap-$n
  sips -z $s $s ../pwa/icons/icon-512.png --out $RES/mipmap-$n/ic_launcher.png >/dev/null
done
