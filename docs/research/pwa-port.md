# Porting BlisterKompass to a PWA

> **Done (13 Nov 2026).** The PWA is in [`../pwa/`](../../pwa/README.md); this page is kept as the porting record. The current iOS ↔ PWA
> code map is in [`../ARCHITECTURE.md`](../../ARCHITECTURE.md#code-map-ios--pwa), and every change goes into both clients (`AGENTS.md` → “Two clients, one product”).

BlisterKompass is a native iPhone app today. A Progressive Web App would run on Android and iPhone without an App Store, fit the team's
web stack (AGENTS.md §4, decision D-07) and keep the same promise: **everything on the phone, nothing sent anywhere.**
This guide says what carries over unchanged, what needs a web replacement, and in which order to build it.

## What carries over 1:1

About 720 lines of plain logic have no iOS dependency and translate line by line to TypeScript. Port them first, together with their checks.

| Swift | TypeScript module | Notes |
|---|---|---|
| `PlanReader.swift` | `plan-reader.ts` | BMP XML → plan items. Decode the code's bytes as ISO-8859-1 **before** parsing; parse with `DOMParser(…, "text/xml")`; walk only `S`, `M`, `W`, never read `P`, `A`, `O` (privacy boundary). Keep `num()` for `½`/`1/2`/`0,5` and `sectionCode()` for as-needed / weekly headings given as text. |
| `PackCode.swift` | `pack-code.ts` | IFA / GS1 / Code 39 parsing, PZN check digit, expiry, `PackResult.evaluate`. Pure string work. |
| `Matcher.swift` | `matcher.ts` | Scoring weights, look-alike glyphs, information-gain question, other-maker / not-on-plan. Pure arithmetic. |
| `Models.swift` (`Day`, `Med`, `Look`, `Schedule`, …) | `model.ts` | Types become interfaces; `Day.sections` stays a pure function of `(meds, date)`. |
| `DoseForm.swift` | `dose-form.ts` | Lookup table; the outline becomes an inline SVG. |
| `Data/catalog.json`, `Data/pzn-names.json` | same files | Unchanged. 7 KB and 349 KB gzipped. |
| `ios/checks/main.swift` (57 checks) | `*.test.ts` (Vitest) | Same fixtures from `Examples/plans/*.xml`, same expectations. Port the checks before the UI; they are the spec. |

## What needs a web replacement

| On iPhone | On the web | Notes |
|---|---|---|
| Camera (`UIImagePickerController`) | `<input type="file" accept="image/*" capture="environment">` | Works in Safari, Chrome and installed PWAs, no permission code. A live viewfinder (`getUserMedia`) can come later. |
| zxing-cpp Swift package | [`zxing-wasm`](https://github.com/Sec-ant/zxing-wasm) (npm) | The same zxing-cpp library compiled to WebAssembly. `readBarcodes(blob, { formats: ["DataMatrix", "QRCode", "Code39"] })`; use the result's `bytes`, not `text`, and decode with `new TextDecoder("iso-8859-1")`. About 1 MB WASM, cache it offline. |
| Pill pixels (`CoreImage`) in `PillRecognizer` | Canvas 2D `getImageData` | Same algorithm: border median as background, largest differing region, CIELAB mean, principal axes. Run it in a Web Worker. |
| Imprint OCR (Apple Vision) | none in v1 | Browsers have no built-in OCR (the Shape Detection `TextDetector` is not available in Safari). Tesseract.js reads printed text but does poorly on embossed imprints. For v1, ask "Was steht auf der Tablette?" with a short text field; the matcher already takes an imprint string. |
| `UserDefaults` (`myMeds`, `unknownPZNs`) | `localStorage`, same two keys | Call `navigator.storage.persist()`. Nothing else is stored, as today. |
| Read-aloud (`AVSpeechSynthesizer`) | `speechSynthesis` with `lang = "de-DE"` | Voices load asynchronously; pick a German voice on `voiceschanged`. |
| `TimelineView(.everyMinute)` | `setInterval` every 60 s | Recompute `Day.sections(meds, new Date())`. |
| SwiftUI screens | any light framework (Preact, Svelte, Lit) or plain TS | Keep the rules: big buttons, icon plus word, no scrolling at normal text size, light/dark via `prefers-color-scheme`. |

## Offline and privacy

- **Service worker** precaches the app shell, the WASM decoder, `catalog.json` and `pzn-names.json`. After the first visit the app works in flight mode.
- **No network at runtime:** no analytics, no fonts or CDNs. Enforce it with a Content Security Policy:
  `default-src 'self'; connect-src 'self'; img-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'`.
- **No person data:** the plan reader port keeps skipping `P`/`A`/`O`. Photos stay `Blob`s in memory and are never uploaded or stored.
- **HTTPS** is required (camera, service worker). Any static host works; inside the team stack, FastAPI `StaticFiles` serves the folder.

## iPhone specifics

- Users should **add the app to the home screen**. In a normal Safari tab, data of a site not used for 7 days can be deleted; an installed web app keeps its own storage.
- `capture="environment"` opens the camera directly, also in the installed app.
- Speech needs a user tap first (the speaker button already is one).

## Order and effort

| Step | Effort |
|---|---|
| 1. `web/` folder with Vite + TypeScript + Vitest; copy `catalog.json`, `pzn-names.json`, `Examples/` | 0.5 h |
| 2. Port `PlanReader`, `PackCode`, `Day`, `DoseForm` + their checks | 2 h |
| 3. `zxing-wasm` decoding of the bundled example codes (plan, IFA, GS1, Code 39) | 1 h |
| 4. Home (day plan), plan import, pack result, add to plan | 3 h |
| 5. Port `Matcher` + `PillRecognizer` (canvas, worker), imprint as typed text | 3 h |
| 6. Service worker, manifest, icons, CSP, offline test in flight mode | 1 h |

About 1.5 days for one developer to reach the current feature set, without imprint OCR.

## Before publishing

- `pzn-names.json` comes from the BfArM Festbetrag list, which has no explicit open licence. A public PWA redistributes it, so check first (README → Data and licences).
- Leaflet looks quote package leaflets with their source URL; keep the quote and the source when shipping.
- The known gaps in ARCHITECTURE.md (INV-15, INV-16, INV-19, INV-21) apply to the web version too.
