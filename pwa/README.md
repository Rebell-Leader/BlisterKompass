# BlisterKompass – web app (PWA)

BlisterKompass as an installable web app for Android and iPhone, ported from the iPhone app (porting record:
[`../docs/research/pwa-port.md`](../docs/research/pwa-port.md)). Same promise as the iPhone app:
**everything on the phone, nothing sent anywhere.** German UI, big buttons with icon and word, light and dark mode.

Live: <https://blisterkompass.vercel.app/pwa/> (Vercel's Git integration: a preview for every PR, production on every merge to `main`;
CI in [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml)). This web app
and the iPhone app are one product: every feature, fix and text change goes into both in the same PR (`AGENTS.md` → “Two clients, one product”); the
module pairs are in the code map in [`../ARCHITECTURE.md`](../ARCHITECTURE.md#code-map-ios--pwa).

## Run it

No build step: the folder is served as it is, so the landing page's `../pwa/` link works straight from the repo.

```bash
python3 -m http.server 8090      # from the repo root
```

Open <http://localhost:8090/pwa/> (the landing page is <http://localhost:8090/docs/landing.html>). `localhost` counts as a secure
context, so the service worker and install work there; any other host needs HTTPS.

Test on a phone: serve the folder over HTTPS (any static host, or a tunnel), open it, then **Teilen → Zum Home-Bildschirm** on
iPhone or **Installieren** in the app's own banner on Android/Chrome.

## Test it

```bash
cd pwa && npm test   # node --test, no install needed (Node 22)
```

141 tests (`npm install` once for the leaflet-PDF tests; without it they are skipped): the 64 checks of `ios/checks/main.swift` ported one by one plus the BMP 2.8 checks (`tests/checks.test.js`), the bundled example plan and pack
codes decoded through zxing-wasm (`codes.test.js`), the print sheet, the code writer and meal tags (`print.test.js`), pill pixels on synthetic photos (`recognizer.test.js`), and the PWA rules
(`pwa.test.js`: manifest and icons, strict CSP, every file precached, no other host named in the code apart from the two leaflet links, only `myMeds`,
`unknownPZNs` and `learnedLeaflets` in `localStorage`, data identical to the iPhone app's).

## What is where

| Path | What |
|---|---|
| `index.html`, `app.css`, `manifest.webmanifest`, `sw.js` | Shell, styles, install manifest, offline service worker (cache-first; bump `VERSION` in `sw.js` when a file changes) |
| `js/model.js`, `plan-reader.js`, `pack-code.js`, `matcher.js`, `dose-form.js` | 1:1 ports of `Models`, `PlanReader`, `PackCode`, `Matcher`, `DoseForm` |
| `js/recognizer.js`, `vision.js`, `vision-worker.js` | Pill pixels (port of `PillRecognizer.analyzePixels`) and code reading, in a Web Worker |
| `js/code-reader.js` | zxing-wasm: plan XML from the payload bytes as ISO-8859-1, pack codes from the text |
| `js/print-sheet.js`, `bmp-writer.js`, `code-writer.js` | **Plan drucken**: the companion sheet "Meine Medikamente mit Bildern" (A4 landscape in mm, `window.print()`, [PRD](../docs/PRD-print-sheet.md)) – no BMP code on it (`docs/DECISIONS.md` D-09). `bmp-writer.js` keeps the meal tags (with negation guard) and the code-XML writer, which is no longer printed; `code-writer.js` (zxing-wasm writer) is unused until D-09 is decided |
| `js/app.js`, `ui.js`, `icons.js`, `store.js`, `speech.js`, `install.js` | Screens, building blocks, icons, `localStorage`, `speechSynthesis` (de-DE), install prompt |
| `data/`, `examples/` | Copies of `ios/PillSnap/Data` and `Examples` (`npm run sync`; a test checks they match) |
| `js/leaflet-parser.js`, `leaflet-pdf.js` | Leaflet section 6 → look (port of `LeafletParser`), picked PDF → text (pdf.js) → product |
| `vendor/pdfjs/` | pdf.js 4.10.38 (Apache-2.0), loaded on first use, eval off |
| `vendor/zxing-wasm/` | zxing-wasm 3.1.6 reader and writer (MIT, zxing-cpp compiled to WebAssembly), loaded from here, never from a CDN |
| `scripts/sync.sh`, `scripts/make-icons.py` | Refresh copies and the vendored decoder; make the app icons from the mascot (`icons/mascot-wave.png`, art by Anna P.) |
| `icons/` | App icons, the mascot pictures shown on the welcome screen and the landing page, and the illustrated action icons `ui-plan`, `ui-pack`, `ui-print`, `ui-lookup` (art by Anna P.; picture-only buttons, the title is the accessible label) |
| `img/mascot/` | The pill mascot in one state per screen (scanning, found, check, other maker, not on plan, not recognised, not in list, scan plan); decorative, the banner text says it. Same pictures as `ios/PillSnap/Assets.xcassets/mascot-*`, made by `docs/brand/pill-mascot/` |

## Differences from the guide and the iPhone app

- **Plain ES modules instead of Vite + TypeScript**, so there is nothing to build and the folder runs from any static server
  (and from the repo next to the landing page). Tests use Node's built-in runner instead of Vitest.
- **The plan XML is walked by a small tokenizer** in `plan-reader.js`, not `DOMParser`, so the same code runs in the worker and
  in Node tests. It reads `MP` (version, page, instance id) and the `S` blocks with `M`, `W`, `R`, `X`; `P`, `A`, `O` are never
  touched. `X` free-text lines are shown on the import screen and not stored.
- **BMP 2.8 reading (PWA ahead of the iPhone app, see `TODO.md` T-29):** a line takes a picture only from the catalog product
  with its own PZN; any other line keeps its PZN, name and ingredients (all `<W>`), its schedule and `look: null`, and appears in
  the day view with a grey outline. Weekly `wo` keeps its dose and sits in its slot on its day ("nächster Montag, 16.11."
  otherwise); free-text `t` is shown as written; units from `du` (KBV S_BMP_DOSIEREINHEIT) or `dud`; the plan's own dose
  notation (½, ¾, 1,5); the plan's reason `r` instead of the catalog purpose; `i` and `x` on the card; block headings 411–425;
  pages of one plan (`MP/@U`, `@a`/`@z`) are merged, a missing page is named.
- **No imprint OCR (v1).** After the photo, the app asks "Was steht auf der Tablette?" with a short text field (also in
  "Aussehen antippen"). The matcher takes the typed text as it took the OCR text, look-alike glyphs included.
- **Leaflet lookup by a PDF the person picks, not by download.** The leaflet hosts send no CORS headers, so the browser can't fetch a
  leaflet as the iPhone app does. For a PZN without picture data (pack screen, plan import), the app links to the leaflet PDF
  ("Beipackzettel öffnen" → save the PDF; fallback: the PZN's page at Apotheken Umschau), and "PDF wählen" reads the file on the phone
  with pdf.js and `js/leaflet-parser.js`. A leaflet of another substance is refused; an unclear section 6 leaves the look unknown.
  Found products are kept in `localStorage` (`learnedLeaflets`). The app still fetches nothing from another host.
- **Camera = file input** (`capture="environment"`), no live viewfinder.
- Pack screen buttons show icon **and** word (the iPhone app went icon-only).

## Data and browser support

- `data/` holds the demo-safe data of this public repo: the catalog without package-leaflet quotes (each look keeps its source link) and
  a 93-row excerpt of the BfArM PZN list. Don't put the full list or leaflet quotes back; CI fails if you do ([`../docs/DATA.md`](../docs/DATA.md)).
- The CSP needs `'wasm-unsafe-eval'` for the decoder (Safari 16+, Chrome 97+). Older browsers block the code reader; the rest works.
