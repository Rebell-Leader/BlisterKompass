#!/bin/sh
# Copies the data the PWA shares with the iPhone app (ios/PillSnap is the source of truth)
# and, when node_modules has it, the zxing-wasm reader and writer. tests/pwa.test.js checks the copies match.
set -e
cd "$(dirname "$0")/.."
SRC=../ios/PillSnap
mkdir -p data examples vendor/zxing-wasm/es/reader vendor/zxing-wasm/es/writer
cp "$SRC/Data/catalog.json" "$SRC/Data/pzn-names.json" data/
cp "$SRC/Examples/examples.json" examples/
cp "$SRC"/Examples/plans/*.png "$SRC"/Examples/packs/*.png "$SRC"/Examples/photos/*.jpg examples/
ZX=node_modules/zxing-wasm
if [ -d "$ZX" ]; then
  cp "$ZX/dist/es/share.js" vendor/zxing-wasm/es/
  cp "$ZX/dist/es/reader/index.js" vendor/zxing-wasm/es/reader/
  cp "$ZX/dist/reader/zxing_reader.wasm" "$ZX/LICENSE" vendor/zxing-wasm/
  cp "$ZX/dist/es/writer/index.js" vendor/zxing-wasm/es/writer/
  cp "$ZX/dist/writer/zxing_writer.wasm" vendor/zxing-wasm/
  node -p "require('./$ZX/package.json').version" > vendor/zxing-wasm/VERSION
fi
echo "synced"
