// Writes the plan's 2D code: Data Matrix (ECC 200) from the payload bytes, drawn as SVG so it prints sharp.
// Encoder: zxing-cpp compiled to WebAssembly (vendor/zxing-wasm, MIT), loaded from this folder – never from a CDN.

import { prepareZXingModule, writeBarcode } from "../vendor/zxing-wasm/es/writer/index.js";

let prepared = false;

/** Point zxing at the local .wasm (its default is a CDN). In Node tests, pass the bytes instead. */
export function prepare(wasmBinary) {
  if (prepared) return;
  prepared = true;
  const overrides = wasmBinary
    ? { wasmBinary }
    : { locateFile: (path, prefix) => (path.endsWith(".wasm") ? new URL("../vendor/zxing-wasm/zxing_writer.wasm", import.meta.url).href : prefix + path) };
  prepareZXingModule({ overrides, fireImmediately: false });
}

/** { width, height, dark(x, y) } of the Data Matrix for these bytes (square symbols only, as on a BMP). */
export async function dataMatrix(bytes) {
  prepare();
  const r = await writeBarcode(bytes, { format: "DataMatrix", options: "forceSquare" });
  if (r.error || !r.symbol) throw new Error(r.error || "no symbol");
  const { width, height, data } = r.symbol;
  return { width, height, dark: (x, y) => data[y * width + x] === 0 };
}

/** One <path> of 1×1 squares, two modules of quiet zone; size in mm on paper. */
export function svgOf(m, sizeMm) {
  const q = 2, n = m.width + 2 * q;
  let d = "";
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.dark(x, y)) d += `M${x + q} ${y + q}h1v1h-1z`;
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: `0 0 ${n} ${n}`, width: `${sizeMm}mm`, height: `${sizeMm}mm`, "shape-rendering": "crispEdges", role: "img", "aria-label": "2D-Code des Medikationsplans" })) s.setAttribute(k, v);
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("width", n); bg.setAttribute("height", n); bg.setAttribute("fill", "#fff");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", d); p.setAttribute("fill", "#000");
  s.append(bg, p);
  return s;
}
