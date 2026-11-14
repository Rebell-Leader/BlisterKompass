// Leaflet PDF → look: the leaflet checks of ios/checks/main.swift (LeafletParser), plus the PWA's own path:
// PDF bytes → pdf.js text → parser → product, and the check that a picked leaflet belongs to the scanned PZN.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as LeafletParser from "../js/leaflet-parser.js";
import { pdfText, fromText, productWords, namesProduct } from "../js/leaflet-pdf.js";
// The PDF → text tests need pdf.js for Node (devDependency pdfjs-dist: `npm install` once). Without it they are skipped,
// so `npm test` still runs with no install; CI installs it and runs them.
const pdfjs = await import("../node_modules/pdfjs-dist/legacy/build/pdf.mjs").catch(() => null);
const pdfTest = (name, fn) => test(name, { skip: pdfjs ? false : "pdfjs-dist not installed (npm install)" }, fn);

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const names = JSON.parse(fs.readFileSync(here("../data/pzn-names.json"), "utf8"));
const check = (name, ok) => test(name, () => assert.ok(ok()));
const leaf = (s6, strength) => LeafletParser.parseSection6(s6, strength, "leaflet:test")?.[0] ?? null;

check("leaflet: Naratriptan – green, round, imprint NT 2,5, no score stated", () => {
  const l = leaf("Grüne, bikonvexe, runde Filmtabletten mit Prägung „NT 2,5“ auf einer Seite und glatter anderer Seite. Packung mit 2 Filmtabletten.", "2,5 mg");
  return l?.color === "green" && l.shape === "round" && l.imprint === "NT 2,5" && l.score == null;
});
check("leaflet: capsule halves (Cefaclor) → white body, blue cap", () => {
  const l = leaf("Kapseloberteil: hellblau. Kapselunterteil: weiß opak mit weißem bis leicht gelblichem Pulver. Packungen mit 10 Hartkapseln.", "500 mg");
  return l?.shape === "capsule" && l.color === "white" && l.color2 === "blue";
});
const twoStrengths = "Die 5 mg Tabletten sind weiße, runde Tabletten. Die 10 mg Tabletten sind gelbe, runde Tabletten mit Bruchkerbe.";
check("leaflet: other strengths in other colours, ours not named → nothing guessed", () => leaf(twoStrengths, "2,5 mg") === null);
check("leaflet: our strength named → its sentence (10 mg yellow, score)", () => { const l = leaf(twoStrengths, "10 mg"); return l?.color === "yellow" && l.score === "single"; });
check("leaflet: spray, no tablet shape → nil", () => leaf("Nitrolingual akut Spray ist eine klare, farblose Lösung in einer roten, durchsichtigen Kunststoffflasche.", null) === null);
check("leaflet: 'weiß bis gebrochen weiß, oblong, 15,5 mm x 8,1 mm' → white oblong with size", () => {
  const l = leaf("Weiße bis gebrochen weiße, oblonge Tabletten 15,5 mm x 8,1 mm.", null);
  return l?.color === "white" && l.shape === "oblong" && l.lengthMm === 15.5 && l.widthMm === 8.1;
});
check("leaflet: flatten joins split words ('wei ße', 'Film- tabletten')", () => LeafletParser.flatten("wei ße Film- tabletten") === "weiße Filmtabletten");
check("leaflet: PZN → its page at Apotheken Umschau, PZN without leading zeros, PDF section", () =>
  LeafletParser.leafletPage("09321616") === "https://www.apotheken-umschau.de/medikamente/beipackzettel/pzn-9321616.html#pdf-dokumente"
  && LeafletParser.leafletPage("123") === null);
check("leaflet: PZN → leaflet PDF, same URL as the iPhone app's", () =>
  LeafletParser.leafletPdf("09321616") === "https://cdn.shop-apotheke.com/PDF/D09/321/616/D09321616-bp.pdf");

// A one-page PDF with the given lines (Helvetica, WinAnsi, so ä/ö/ü/ß/„“ survive), built here so no real leaflet is committed.
function pdf(lines) {
  const enc = (s) => Buffer.from([...s].map((c) => ({ "„": 0x84, "“": 0x93 })[c] ?? c.charCodeAt(0)));
  const esc = (b) => Buffer.from([...b].flatMap((x) => (x === 0x28 || x === 0x29 || x === 0x5c ? [0x5c, x] : [x])));
  const stream = Buffer.concat(lines.flatMap((l, i) => [Buffer.from(`BT /F1 9 Tf 20 ${800 - i * 12} Td (`), esc(enc(l)), Buffer.from(") Tj ET\n")]));
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ].map((o) => Buffer.from(o));
  objs.push(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("\nendstream")]));
  const parts = [Buffer.from("%PDF-1.4\n")], offsets = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => { const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]); offsets.push(pos); parts.push(b); pos += b.length; });
  const xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return new Uint8Array(Buffer.concat(parts));
}

// A tablet PZN of the official list: HCT 1A PHARMA 25MG TABL. The synthetic leaflet below names that product (name, maker
// and strength), as a real leaflet for the pack does. Changed with the review fix: it used to say "HCT Muster 25 mg", and a
// leaflet that names another product is now refused ("unbound", test below), so the fixture names the pack's own product.
const [pzn, row] = Object.entries(names).find(([, r]) => r[0] === "HCT 1A PHARMA 25MG TABL");
const leafletLines = [
  "Gebrauchsinformation: Information für Patienten",
  "6. Inhalt der Packung und weitere Informationen",
  "Wie HCT - 1 A Pharma 25 mg aussieht und Inhalt der Packung",
  "HCT - 1 A Pharma 25 mg sind weiße, runde Tabletten mit einer Bruchkerbe und der Prägung „H 25“.",
  "Packungen mit 100 Tabletten.",
  "Pharmazeutischer Unternehmer",
  "Der Wirkstoff ist Hydrochlorothiazid.",
];

pdfTest("PDF → pdf.js text → look: white, round, score, imprint H 25, for the scanned PZN", async () => {
  const text = await pdfText(pdf(leafletLines), pdfjs);
  const r = fromText(text, pzn, names);
  assert.equal(r.state, "found", row[0]);
  assert.equal(r.med.pzn, pzn);
  assert.equal(r.med.substance, "Hydrochlorothiazid");
  assert.equal(r.med.strength, "25 mg");
  assert.deepEqual([r.med.look.color, r.med.look.shape, r.med.look.score, r.med.look.imprint], ["white", "round", "single", "H 25"]);
  assert.ok(r.med.look.source.startsWith("leaflet:"), "shown as 'Aussehen laut Packungsbeilage'");
  assert.match(r.med.look.leaflet, /weiße, runde Tabletten/);
});

pdfTest("a leaflet of another medicine is refused, not read (identity = PZN, never appearance)", async () => {
  const other = leafletLines.map((l) => l.replaceAll("Hydrochlorothiazid", "Naratriptan").replaceAll("HCT - 1 A Pharma 25 mg", "Naratriptan Muster 2,5 mg"));
  const r = fromText(await pdfText(pdf(other), pdfjs), pzn, names);
  assert.equal(r.state, "wrong");
  assert.equal(r.leafletSubstance, "Naratriptan");
});

pdfTest("a leaflet that doesn't state the look stays unclear (unknown stays unknown)", async () => {
  const vague = leafletLines.map((l) => (l.startsWith("HCT - 1 A Pharma 25 mg sind") ? "HCT - 1 A Pharma 25 mg ist in Packungen erhältlich." : l));
  assert.equal(fromText(await pdfText(pdf(vague), pdfjs), pzn, names).state, "unclear");
});

// Submission review: a picked leaflet must name the scanned pack's product, not only its substance (PWA only: the iPhone app
// downloads the leaflet by the pack's PZN and has no picked-file path).
const lisinoprilPuren = "13706285"; // LISINOPRIL PUREN 10MG
const otherProduct = "Gebrauchsinformation: Information für Anwender Anderes-Produkt 10 mg Tabletten Der Wirkstoff ist Lisinopril. "
  + "Wie Anderes-Produkt aussieht und Inhalt der Packung Anderes-Produkt 10 mg sind rosa, runde Tabletten mit einer Bruchkerbe. "
  + "Pharmazeutischer Unternehmer Fremdfirma GmbH";
check("leaflet of another product with the same substance (Anderes-Produkt for LISINOPRIL PUREN) → unbound, not found", () => fromText(otherProduct, lisinoprilPuren, names).state === "unbound");
check("same leaflet text naming Lisinopril PUREN 10 mg → found", () => fromText(otherProduct.replaceAll("Anderes-Produkt", "Lisinopril PUREN"), lisinoprilPuren, names).state === "found");
check("…but in another strength (20 mg) → unbound", () => fromText(otherProduct.replaceAll("Anderes-Produkt 10 mg", "Lisinopril PUREN 20 mg").replaceAll("Anderes-Produkt", "Lisinopril PUREN"), lisinoprilPuren, names).state === "unbound");
check("PZN without an official name → unbound (nothing to tie the leaflet to)", () => fromText(otherProduct, "99999999", names).state === "unbound");
check("product words leave out strength and dose form", () => productWords("HCT 1A PHARMA 25MG TABL").join() === "hct,1a,pharma" && productWords("METFORMIN HEXAL 500MG DO").join() === "metformin,hexal" && productWords("L THYROX HEXAL 50").join() === "thyrox,hexal");
check("product match folds umlauts and joins words: 'HCT - 1 A Pharma' names HCT 1A PHARMA", () => namesProduct("HCT - 1 A Pharma 25 mg Tabletten", { name: "HCT 1A PHARMA 25MG TABL" }));
// Finish only when stated (the parser used to infer matte/glossy from the coating).
check("leaflet: finish only when the text states it; a film coating alone gives none", () => leaf("Weiße, runde Filmtabletten.", null)?.finish == null && leaf("Weiße, runde, glänzende Filmtabletten.", null)?.finish === "glossy" && LeafletParser.finishIn("matte, weiße Tabletten") === "matte");

