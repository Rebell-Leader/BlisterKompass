// Downloads real consumer-grade pill photos for BlisterKompass testing from the NLM
// Computational Photography Project for Pill Identification (C3PI), public domain:
// https://data.lhncbc.nlm.nih.gov/public/Pills/
//
//   node tools/fetch-test-photos.js [perSubstance=2]
//     → test-photos/<substance>-<n>.jpg + manifest.json (ground truth)
//
// One substance per drug on the demo patient's plan (US strengths). Each photo
// comes with NLM's own colour/shape/imprint/size/background record, so the app's
// recognition can be checked against it. Photos are taken on varied real
// backgrounds (paper, gray card, scrubs, countertop), which is the point.

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE = 'https://data.lhncbc.nlm.nih.gov/public/Pills';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'test-photos');
const CACHE = join(tmpdir(), 'blisterkompass-c3pi');
const PER = Number(process.argv[2] ?? 2);
const UA = { 'User-Agent': 'blisterkompass/0.1' };

const TARGETS = [
  { de: 'Ramipril', re: /RAMIPRIL 5 ?MG/ },
  { de: 'Metformin', re: /METFORMIN[^|]*1,?000 ?MG|GLUCOPHAGE 1000/, not: /ER|EXTENDED|XR|GLIPIZIDE|GLYBURIDE|SITAGLIPTIN|PIOGLITAZONE/ },
  { de: 'Atorvastatin', re: /ATORVASTATIN[^|]*\b20 ?MG|LIPITOR 20/, not: /AMLODIPINE|EZETIMIBE/ },
  { de: 'Bisoprolol', re: /BISOPROLOL[^|]*\b5 ?MG/, not: /HYDROCHLOROTHIAZIDE|HCTZ/ },
  { de: 'Torasemid', re: /TORSEMIDE 10|DEMADEX 10/ },
  { de: 'Pantoprazol', re: /PANTOPRAZOLE[^|]*\b20 ?MG|PROTONIX 20/ },
  { de: 'Levothyroxin-Natrium', re: /LEVOTHYROXINE[^|]*\b75|SYNTHROID 75|LEVOXYL 75|UNITHROID 75/ },
  { de: 'Methotrexat', re: /METHOTREXATE[^|]*2\.5/ },
  { de: 'Ibuprofen', re: /IBUPROFEN 400/ },
  { de: 'Pregabalin', re: /PREGABALIN 75|LYRICA 75/ },
  { de: 'Amlodipin', re: /AMLODIPINE[^|]*\b5 ?MG|NORVASC 5/, not: /BENAZEPRIL|VALSARTAN|OLMESARTAN|ATORVASTATIN|TELMISARTAN/ },
  { de: 'Allopurinol', re: /ALLOPURINOL 300/ },
];

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/""/g, '"');

async function cached(path, url) {
  const file = join(CACHE, path);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const text = await res.text();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return text;
}

/** The <Image> record for one file from the disc's XML. */
async function meta(disc, fileName) {
  const xml = await cached(`${disc}.xml`, `${BASE}/ALLXML/${disc}.xml`);
  const at = xml.indexOf(`<Name>${fileName}</Name>`);
  if (at < 0) return null;
  const block = xml.slice(xml.lastIndexOf('<Image>', at), xml.indexOf('</Image>', at));
  const f = (tag) => { const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block); return m ? unescape(m[1]) : null; };
  return {
    name: f('ProprietaryName'), labeler: f('LabeledBy'), color: f('Color'), shape: f('Shape'), imprint: f('Imprint'),
    imprintType: f('ImprintType'), score: f('Score'), sizeMm: Number(f('Size')) || null, background: f('Background'),
    ratings: { imprint: f('RatingImprint'), shape: f('RatingShape'), color: f('RatingColor'), shadow: f('RatingShadow') },
    camera: f('Camera'),
  };
}

const index = await cached('directory_of_images.txt', `${BASE}/directory_of_images.txt`);
const rows = index.split('\n').map((l) => l.trim().split('|')).filter((r) => r[3] === 'C3PI_Test' && r[2]?.endsWith('.JPG'));
mkdirSync(OUT, { recursive: true });
const manifest = [];

for (const t of TARGETS) {
  const hits = rows.filter((r) => t.re.test(r[4]) && !(t.not?.test(r[4])));
  const picked = [];
  const seenBg = new Set();
  // Clear photos first; then spread over backgrounds and products (NDCs).
  const seenNdc = new Set();
  const ok = { strict: (x) => x === 'Clear', relaxed: (x) => x === 'Clear' || x === 'Somewhat' };
  for (const pass of ['strict', 'relaxed']) {
    for (const r of hits.slice(0, 120)) {
      if (picked.length >= PER) break;
      if (picked.some((p) => p.path === r[2])) continue;
      const [disc, , file] = r[2].split('/');
      const m = await meta(disc, file).catch(() => null);
      if (!m || !ok[pass](m.ratings.imprint) || !ok[pass](m.ratings.shape)) continue;
      if (seenBg.has(m.background) || (pass === 'strict' && seenNdc.has(r[0]))) continue;
      seenBg.add(m.background); seenNdc.add(r[0]);
      picked.push({ ndc: r[0], path: r[2], ...m });
    }
  }
  for (const [i, p] of picked.entries()) {
    const out = `${slug(t.de)}-${i + 1}.jpg`;
    if (!existsSync(join(OUT, out))) {
      const res = await fetch(`${BASE}/${p.path}`, { headers: UA });
      if (!res.ok) { console.warn(`✗ ${out}: ${res.status}`); continue; }
      writeFileSync(join(OUT, out), Buffer.from(await res.arrayBuffer()));
    }
    manifest.push({
      file: out,
      expect: { substance: t.de, product: p.name, ndc11: p.ndc, labeler: p.labeler },
      look: { color: p.color, shape: p.shape, imprint: p.imprint, imprintType: p.imprintType, score: p.score, sizeMm: p.sizeMm },
      photo: { background: p.background, camera: p.camera, ratings: p.ratings },
      source: { url: `${BASE}/${p.path}`, dataset: 'NLM C3PI', license: 'US public domain (National Library of Medicine)' },
    });
    console.log(`✓ ${out.padEnd(28)} ${p.name} | ${p.color} ${p.shape} "${p.imprint}" | ${p.background}`);
  }
  if (!picked.length) console.warn(`– ${t.de}: no clear photo`);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.length} photos → ${OUT}`);
