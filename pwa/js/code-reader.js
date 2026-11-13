// Reads the 2D code of a Medikationsplan, or the code on a medicine pack, from a photo.
// Port of ios/PillSnap/Bmp.swift (CodeReader). Decoder: zxing-cpp compiled to WebAssembly
// (vendor/zxing-wasm, MIT), loaded from this folder – never from a CDN.

import { prepareZXingModule, readBarcodes } from "../vendor/zxing-wasm/es/reader/index.js";
import { parse as parsePack } from "./pack-code.js";

const FORMATS = ["DataMatrix", "QRCode", "Aztec", "PDF417", "Code39", "PZN"];
let prepared = false;

/** Point zxing at the local .wasm (its default is a CDN). In Node tests, pass the bytes instead. */
export function prepare(wasmBinary) {
  if (prepared) return;
  prepared = true;
  const overrides = wasmBinary
    ? { wasmBinary }
    : { locateFile: (path, prefix) => (path.endsWith(".wasm") ? new URL("../vendor/zxing-wasm/zxing_reader.wasm", import.meta.url).href : prefix + path) };
  prepareZXingModule({ overrides, fireImmediately: false });
}

const latin1 = new TextDecoder("iso-8859-1");

/** All texts zxing finds: payload bytes as ISO-8859-1 (BMP XML) plus its text output (GS1 HRI, PZN). */
export async function texts(input) {
  prepare();
  const results = await readBarcodes(input, { formats: FORMATS, tryHarder: true, tryRotate: true, tryInvert: false, maxNumberOfSymbols: 8 });
  return results.filter((r) => r.isValid).flatMap((r) => [latin1.decode(r.bytes), r.text]);
}

/** { kind: "plan", xml } | { kind: "pack", code } | null. Never reads anything else out of the code. */
export function classify(found) {
  const plan = found.find((t) => t.includes("<MP"));
  if (plan) return { kind: "plan", xml: plan };
  for (const t of found) {
    const code = parsePack(t);
    if (code) return { kind: "pack", code };
  }
  return null;
}

export async function scan(input) {
  return classify(await texts(input));
}
