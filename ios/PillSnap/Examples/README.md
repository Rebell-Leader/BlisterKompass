# Examples

Real example files bundled with BlisterKompass. **Beispiele** in each popup opens them (`ExamplesView`, captions in `examples.json`); they run through the same recognition as a camera photo.

| Folder | What | Use it as |
|---|---|---|
| `plans/` | Example Medikationspläne as real Data Matrix codes (`plan-*.png`) plus their XML. `plan-a` 12 meds, `plan-b` 6, `plan-c` 6, `plan-kbv-beispiel` = official KBV sample (BMP 2.8) | **Plan einlesen → Beispiele** |
| `packs/` | Medicine packs as real securPharm Data Matrix codes (IFA format: PZN, batch, expiry) | **Packung → Beispiele** |
| `photos/` | Real pill photos (NLM C3PI, US public domain) | **Tablette → Beispiele** |

Packs against plan A: `pack-30477231` Atorvastatin → on plan · `pack-18342014` Ramipril Medivia → same drug, other maker · `pack-91200130` Amlodipin → not on plan · `pack-72311869` Levothyroxin → on plan, expired · `pack-06453257` HCT 1A Pharma → real PZN, no look (on the KBV sample plan). `pack-05387239` Aspirin N 100 → non-prescription pack with only the striped PZN barcode (Code 39): same substance as ASS on plan A, so other maker; no batch or expiry.

Print a code and photograph it to try the camera path. A new file needs an entry in `examples.json`.

Regenerate the codes: `tools/make-plan-codes.py`, `tools/make-pack-codes.py`.
