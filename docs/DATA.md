# Data in this repository

Everything here is synthetic or published reference data. No real patient data anywhere. This repo is public (D-13), so two datasets
from the hackathon repo were cut down before the move; CI checks that they stay cut down.

## What is in the repo

| File | What | Source | Licence / basis |
|---|---|---|---|
| `ios/PillSnap/Data/catalog.json` (copy: `pwa/data/`) | 108 products with their look (shape, colours, size, score line, imprint) and `look.source` | 22 demo products (fictional makers); 39 FDA/NLM DailyMed; 16 EMA product information; 31 German package leaflets (§6 of each leaflet, link in `look.source`) | demo: –; DailyMed: US public domain; EMA: reuse with attribution; leaflets: the facts only, with the source link, no quotes |
| `ios/PillSnap/Data/pzn-names.json` (copy: `pwa/data/`) | 93 rows: PZN → official name, substance, dosage form, pack size | excerpt of BfArM, *Festbetragsarzneimittel nach § 35 SGB V*, Stand 01.11.2026 | official publication without an open licence; only the demo excerpt is committed |
| `ios/PillSnap/Examples/plans/` (copy: `pwa/examples/`) | example plans A–C (synthetic, BMP 2.8 XML + Data Matrix PNG), the KBV sample plan, the picture sheet of plan A | synthetic; KBV BMP specification 2.8, Anlage 3 | KBV: free to reuse |
| `ios/PillSnap/Examples/packs/` | pack codes in IFA PPN format with batch and expiry | synthetic (`tools/make-pack-codes.py`) | – |
| `ios/PillSnap/Examples/photos/` | 3 pill photos | NLM C3PI | US public domain |
| `pwa/js/dose-form.js` | KBV dosage-form codes (Darreichungsform 1.16) and BMP dosing units (S_BMP_DOSIEREINHEIT 1.01) | KBV key tables | free to reuse |
| `test-photos/manifest.json`, `RESULTS.md` | 15 NLM ground-truth photos (list only; the photos are downloaded by `tools/fetch-test-photos.js`, not committed) and evaluation results | NLM C3PI | US public domain |
| `tools/leaflet-looks.generated.json` | looks found by PZN in package leaflets, without the leaflet sentences | package leaflets | facts with source |
| `tools/bmp/bmp_V2.8.xsd`, `tools/bmp/kbv_darreichungsform.csv` | BMP 2.8 XML schema (print generator validates every plan) and the KBV dosage-form table | KBV `BMP_V2.8.zip` (Anlage 3); KBV key table S_KBV_DARREICHUNGSFORM 1.16 | KBV: the specification is free of third-party rights (Anlage 3, ch. 7); key tables free to reuse |
| `print/` | example sheets (BMP page and picture sheet) for plan A and the KBV sample | generated from the files above | as above |
| `pwa/icons/mascot-*.png`, `docs/brand/` | mascot and app icons | © Anna P. (AnnXQP) | used with permission for this project |
| `docs/fonts/` | Atkinson Hyperlegible | Braille Institute | SIL OFL 1.1 |
| `pwa/vendor/zxing-wasm/` | barcode reader and writer (WebAssembly) | zxing-wasm 3.1.6 | MIT |
| `pwa/vendor/pdfjs/` | PDF text extraction for a leaflet PDF the person picks (eval off, read on the phone) | pdf.js 4.10.38 (Mozilla) | Apache-2.0 |

No leaflet PDF is committed. The leaflet links in `pwa/js/leaflet-parser.js` (Apotheken Umschau and a pharmacy CDN, the same PDF the
iPhone app downloads) are opened by the person; a look read from a picked PDF stays on that phone (`learnedLeaflets`), with its
quote, and is never uploaded. The tests use a synthetic PDF built in code.

## What was cut for the public repo

- **Package-leaflet quotes.** In the hackathon repo each of the 31 German leaflet looks carried the leaflet's own sentence in
  `look.leaflet`. Those sentences are removed here; the look's facts (colour, shape, size, score line, imprint) and the link to the leaflet
  in `look.source` stay. Both apps show "Aussehen laut Packungsbeilage" where they used to show the quote.
- **The PZN list.** The full BfArM list has 36,953 packs. Here it is cut to 93: every PZN of a catalog product (all its pack sizes), every
  PZN on an example plan or pack code, and every PZN named in the tests, checks, tools and docs. Any other scanned pack shows
  "Packung nicht in der Datenbank" with its PZN.
- **Not carried over at all:** the challenge material, research notes about the challenge owner and interviewees, raw downloads, the
  hackathon's specification and test-vector folders.

## How CI keeps it that way

The `site` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) fails if any catalog product has a `look.leaflet` field or if
`pzn-names.json` has more than 500 rows. `pwa/tests/checks.test.js` and `ios/checks/main.swift` check that the 31 leaflet looks keep their
`leaflet:https://…` source link and carry no quote.

## Regenerating with the full data (outside this repo)

`tools/make-pack-codes.py` and `tools/add-leaflet-looks.py` were written for the hackathon repo, where the full Festbetrag CSV and the
leaflet texts live. Run them there, then cut the result the same way before copying it here: keep only the PZNs listed above and drop
`look.leaflet`. Never commit their full output to this repo; the CI guard would fail anyway.
