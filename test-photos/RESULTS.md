# BlisterKompass – recognition on real photos

The app's own Swift recogniser and matcher, run offline on NLM C3PI consumer photos against example plan A (`ios/PillSnap/Examples/plans/plan-a.xml`).
Regenerate: `node tools/fetch-test-photos.js`, then `ios/eval/run.sh`.

Note: plan A holds synthetic German looks, the photos are US products, so "Answer" can be wrong even when colour/shape/imprint were read correctly.

| Photo | Expected | Colour (NLM) | Shape (NLM) | Imprint OCR (NLM) | App state | Answer | Background |
|---|---|---|---|---|---|---|---|
| ramipril-1.jpg | Ramipril | ✅ red (RED) | ❌ oval (CAPSULE) | ❌ – (54;145;54;145) | likely | ❌ Diclofenac-Natrium | BPA3 Domtar EarthChoice Office Paper (Item 2700; 20lb; 92 Brightness) |
| ramipril-2.jpg | Ramipril | ✅ red (RED) | ✅ oblong (CAPSULE) | ❌ – (RP;5) | not_on_plan | ❌ not on plan: Allopurinol | BPA2 Office Depot Copy Paper - standard white paper - item 420-283 |
| metformin-1.jpg | Metformin | ❌  (WHITE) | ❌ – (OVAL) | ❌ – (I;47) | – | ❌ – | Paper 1 - white, laserjet paper 8.5" x 11" |
| metformin-2.jpg | Metformin | ✅ offwhite (WHITE) | ✅ oval (OVAL) | ❌ LTL (C;474) | choose | ✅ Atorvastatin, Ramipril, Metformin | WhiBal Gray Card |
| atorvastatin-1.jpg | Atorvastatin | ❌  (WHITE) | ❌ – (OVAL) | ❌ – (PD;156;20) | – | ❌ – | BPA2 Office Depot Copy Paper - standard white paper - item 420-283 |
| torasemid-1.jpg | Torasemid | ❌  (WHITE) | ❌ – (OVAL) | ❌ – (H;5;7) | – | ❌ – | light laminate, speckled |
| torasemid-2.jpg | Torasemid | ❌ green (WHITE) | ❌ oval (ROUND) | ❌ IR (PA;916) | unknown | ❌ – | clipboard, small |
| pantoprazol-1.jpg | Pantoprazol | ✅ lightyellow (YELLOW) | ✅ oblong (OVAL) | ✅ P20 (P;20) | sure | ✅ Pantoprazol | surgical scrubs, Pink (Shock Trauma) |
| pantoprazol-2.jpg | Pantoprazol | ❌  (WHITE) | ❌ – (OVAL) | ❌ – (KU;180) | – | ❌ – | BPA2 Office Depot Copy Paper - standard white paper - item 420-283 |
| methotrexat-1.jpg | Methotrexat | ✅ lightyellow (YELLOW) | ✅ round (ROUND) | ✅ 323 (54;323) | choose | ✅ Methotrexat, Bisoprolol | WhiBal Gray Card |
| methotrexat-2.jpg | Methotrexat | ❌ brown (YELLOW) | ✅ round (ROUND) | ❌ 3TTOXPOF (54;323) | likely | ❌ Diclofenac-Natrium | Paper 1 - white, laserjet paper 8.5" x 11" |
| ibuprofen-1.jpg | Ibuprofen | ❌  (WHITE) | ❌ – (ROUND) | ❌ – (IP;464) | – | ❌ – | BPA2 Office Depot Copy Paper - standard white paper - item 420-283 |
| ibuprofen-2.jpg | Ibuprofen | ✅ beige (WHITE) | ❌ oval (ROUND) | ✅ IP (IP;464) | likely | ❌ Atorvastatin | WhiBal Gray Card |
| pregabalin-1.jpg | Pregabalin | ❌ brown (WHITE) | ✅ capsule (CAPSULE) | ✅ PGN (Pfizer;PGN;75) | unknown | ❌ – | WhiBal Gray Card |
| allopurinol-1.jpg | Allopurinol | ❌ brown (ORANGE) | ✅ round (ROUND) | ❌ O (DAN;DAN;5544) | likely | ❌ Diclofenac-Natrium | BPA2 Office Depot Copy Paper - standard white paper - item 420-283 |

**15 photos:** colour 6/15 · shape 7/15 · imprint 4/15 · right medication shown 3/15

## Android app (ML Kit)

Same 15 photos through the Android app's real path (`pwa/js/vision.js` crop → `MainActivity.readImprint`), Pixel 7 emulator
(Android 15, arm64, host GPU), 14 Nov 2026. Regenerate: debug build on a device, then `node tools/android-ocr-eval.mjs`.
A hit means the read text contains a part of NLM's imprint (or is ≥ 2 characters of it).

| Photo | Imprint (NLM) | Android read |
|---|---|---|
| ramipril-1.jpg | 54;145;54;145 | ✅ 54455445 |
| ramipril-2.jpg | RP;5 | ✅ RP5 |
| torasemid-2.jpg | PA;916 | ✅ PA |
| pantoprazol-1.jpg | P;20 | ✅ P20 |
| allopurinol-1.jpg | DAN;DAN;5544 | ✅ 554 |
| methotrexat-1.jpg | 54;323 | ❌ 229 |
| ibuprofen-2.jpg | IP;464 | ❌ 6 |
| pregabalin-1.jpg | Pfizer;PGN;75 | ❌ P |
| other 7 | | – (no pill found or nothing read) |

**imprint 5/15** (iPhone Vision above: 4/15); 0.05–0.7 s per photo. Wrong reads happen, so the Android app only pre-fills the
field and the person confirms or corrects it.
