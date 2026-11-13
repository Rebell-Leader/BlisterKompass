"""Demo medicine packs with real securPharm Data Matrix codes, plus the PZN name list.

German prescription packs carry an ISO/IEC 16022 Data Matrix (securPharm / EU FMD)
in IFA format (ISO/IEC 15434 envelope "[)>RS06GS", data identifiers 9N = PPN,
1T = batch, D = expiry YYMMDD, S = serial). The PPN contains the PZN.
Spec and test vectors: the official IFA test vectors (IFA PPN-Code spec V3.06) (IFA PPN-Code V3.06).

This script
  1. encodes the demo packs below (Data Matrix; Code 39 for PZN-only packs), decodes each image again and checks the PZN,
     batch and expiry round trip → ios/PillSnap/Examples/packs/pack-<pzn>.png + packs.json
  2. exports PZN → name / substance / form / pack size from the official
     Festbetrag list (BfArM, § 35 SGB V) → ios/PillSnap/Data/pzn-names.json

    python3 -m venv .venv && .venv/bin/pip install zxing-cpp==3.1.1 pillow
    .venv/bin/python -I tools/make-pack-codes.py
"""

import csv
import json
import pathlib
import sys

import zxingcpp
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "ios" / "PillSnap" / "Data"
FESTBETRAG = ROOT.parent.parent / "data" / "processed" / "festbetrag_2026-11-01.csv"
GS, RS, EOT = "\x1d", "\x1e", "\x04"
MODULE_PX = 8

# Demo packs: PZN, batch, expiry (YYMMDD), label (what is printed on the box).
PACKS = [
    ("18342014", "MV2417", "280331", "Ramipril Medivia 5 mg", "20 Tabletten"),           # other maker than plan A (Nordapharm)
    ("30477231", "AP0912", "271130", "Atorvastatin Alpinmed 20 mg", "30 Filmtabletten"),  # on plan A
    ("91200130", "AL3305", "280630", "Amlodipin Alpinmed 5 mg", "50 Tabletten"),         # not on plan A, on plan B
    ("06453257", "HX1188", "270831", "HCT 1A Pharma 25 mg", "100 Tabletten"),            # real PZN, look from its package leaflet
    ("08693497", "ST4471", "271031", "Cefaclor STADA 500 mg", "Hartkapseln"),            # real PZN, no look known → capsule outline
    ("72311869", "AP7702", "250930", "Levothyroxin Alpinmed 75 µg", "100 Tabletten"),    # on plan A, EXPIRED
]

# Non-prescription packs carry no Data Matrix, only the PZN as a Code 39 barcode ("-" + PZN8).
PZN_ONLY = [
    ("05387239", "Aspirin N 100 mg"),   # real PZN (BfArM list), same substance as ASS on plan A
]


def pzn_ok(pzn: str) -> bool:
    d = [int(c) for c in pzn]
    return len(d) == 8 and sum(d[i] * (i + 1) for i in range(7)) % 11 == d[7]


def ppn(pzn: str) -> str:
    base = "11" + pzn
    return base + f"{sum(ord(c) * (i + 2) for i, c in enumerate(base)) % 97:02d}"


def main() -> int:
    out_dir = ROOT / "ios" / "PillSnap" / "Examples" / "packs"
    out_dir.mkdir(parents=True, exist_ok=True)
    meta, ok = [], True
    for i, (pzn, batch, expiry, label, size) in enumerate(PACKS):
        assert pzn_ok(pzn), pzn
        serial = f"DEMO{pzn}{i:04d}"
        payload = f"[)>{RS}06{GS}9N{ppn(pzn)}{GS}1T{batch}{GS}D{expiry}{GS}S{serial}{RS}{EOT}"
        barcode = zxingcpp.create_barcode(payload.encode("ascii"), zxingcpp.BarcodeFormat.DataMatrix)
        img = Image.fromarray(zxingcpp.write_barcode_to_image(barcode, scale=MODULE_PX, add_quiet_zones=True)).convert("1")
        hit = zxingcpp.read_barcodes(img, formats=zxingcpp.BarcodeFormat.DataMatrix)
        text = hit[0].bytes.decode("ascii") if hit else ""
        if f"9N{ppn(pzn)}" not in text or f"1T{batch}" not in text or f"D{expiry}" not in text:
            print(f"✗ {pzn}: round trip failed")
            ok = False
            continue
        img.save(out_dir / f"pack-{pzn}.png", optimize=True)
        meta.append({"pzn": pzn, "batch": batch, "expiry": expiry, "label": label, "size": size})
        print(f"✓ pack-{pzn}.png  {label}  (PPN {ppn(pzn)}, {img.width}px)")
    for pzn, label in PZN_ONLY:
        assert pzn_ok(pzn), pzn
        barcode = zxingcpp.create_barcode(f"-{pzn}", zxingcpp.BarcodeFormat.Code39)
        img = Image.fromarray(zxingcpp.write_barcode_to_image(barcode, scale=4, add_quiet_zones=True)).convert("1")
        img = img.resize((img.width, img.width // 3), Image.NEAREST)   # bars tall enough to photograph
        hit = zxingcpp.read_barcodes(img, formats=zxingcpp.BarcodeFormat.Code39)
        if not hit or hit[0].text != f"-{pzn}":
            print(f"✗ {pzn}: Code 39 round trip failed")
            ok = False
            continue
        img.save(out_dir / f"pack-{pzn}.png", optimize=True)
        meta.append({"pzn": pzn, "label": label, "code": "Code 39"})
        print(f"✓ pack-{pzn}.png  {label}  (Code 39 -{pzn}, {img.width}px)")
    (out_dir / "packs.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # PZN → [name, substance, form, pack size]  (BfArM Festbetrag list, Stand 01.11.2026)
    names = {}
    with FESTBETRAG.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["pzn_check_ok"] == "True":
                names[r["pzn"]] = [r["arzneimittelname"], r["wirkstoff"], r["darreichungsform"], r["packungsgroesse"]]
    target = DATA / "pzn-names.json"
    target.write_text(json.dumps(names, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"✓ pzn-names.json: {len(names)} PZNs, {target.stat().st_size // 1024} KB")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
