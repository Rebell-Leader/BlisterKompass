// A package leaflet PDF the person picked on their phone → catalog product with its look. Counterpart of
// ios/PillSnap/LeafletOnline.swift, but without any network: the browser can't download the leaflet itself (the
// hosts send no CORS headers), so the person opens it at Apotheken Umschau, saves the PDF and picks it here.
// The file is read on the phone with pdf.js (vendor/pdfjs, loaded on first use) and never leaves it.

import * as LeafletParser from "./leaflet-parser.js";
import { pznName, nameStrength } from "./model.js";

let lib = null;
async function pdfjs() {
  if (!lib) {
    lib = await import("../vendor/pdfjs/pdf.min.mjs");
    lib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  }
  return lib;
}

/** All text of a PDF, page by page. `pdf`: the pdf.js module (the app's vendored copy unless given, e.g. in tests). */
export async function pdfText(bytes, pdf = null) {
  const { getDocument } = pdf ?? await pdfjs();
  const doc = await getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    text += content.items.map((it) => (it.str ?? "") + (it.hasEOL ? "\n" : "")).join("") + "\n";
  }
  await doc.destroy();
  return text;
}

const isPdf = (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;   // %PDF

/** Leaflet text for a PZN → { state: found, med } | { state: wrong, leafletSubstance } | { state: unclear }.
 *  "wrong": the official PZN list names a substance the leaflet never mentions, so it belongs to another medicine. */
export function fromText(text, pzn, names) {
  const official = pznName(names, pzn);
  const want = official?.substance?.split(/[\s,-]/)[0]?.toLowerCase();
  const flat = LeafletParser.flatten(text);
  if (want && want.length > 3 && !flat.toLowerCase().includes(want)) return { state: "wrong", leafletSubstance: LeafletParser.substanceIn(flat) };
  // Strength from the official PZN name ("MTX HEXAL 10MG …" → "10 mg"), else from the leaflet.
  const strength = nameStrength(official)?.replace(".", ",") ?? null;
  const r = LeafletParser.parse(text, `leaflet:pdf:${pzn}`, strength);
  if (!r) return { state: "unclear" };
  const med = { pzn, pzns: [], name: r.name ?? official?.name ?? `PZN ${pzn}`,
    substance: official?.substance || r.substance || r.name || `PZN ${pzn}`, strength: r.strength,
    manufacturer: null, atc: "", indication: null, look: r.look, market: "DE" };
  return { state: "found", med };
}

/** A picked file → same outcomes as `fromText`, plus { state: notPdf }. */
export async function read(file, pzn, names) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return { state: "notPdf" };
  let text;
  try { text = await pdfText(bytes); } catch { return { state: "notPdf" }; }
  return fromText(text, pzn, names);
}
