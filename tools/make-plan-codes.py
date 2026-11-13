"""Real BMP codes for the demo plans.

The paper Medikationsplan carries its XML in an ISO/IEC 16022 Data Matrix code
(ECC 200, ISO-8859-1 bytes, at most 1400 bytes – KBV BMP spec, Anlage 3).
This script encodes every ios/PillSnap/Examples/plans/*.xml as such a code, decodes
the image again, checks the round trip byte for byte, and writes
ios/PillSnap/Examples/plans/<name>.png (crisp: whole pixels per module, quiet zone).

    python3 -m venv .venv && .venv/bin/pip install zxing-cpp==3.1.1 pillow
    .venv/bin/python -I tools/make-plan-codes.py
"""

import pathlib
import sys

import zxingcpp
from PIL import Image

PLANS = pathlib.Path(__file__).resolve().parent.parent / "ios" / "PillSnap" / "Examples" / "plans"
MODULE_PX = 8          # pixels per module: readable from a phone photo of the printed sheet
MAX_BYTES = 1400       # BMP limit per code


def main() -> int:
    ok = True
    for xml_path in sorted(PLANS.glob("*.xml")):
        text = xml_path.read_text(encoding="utf-8").replace("\r\n", "\n").strip()
        data = text.encode("iso-8859-1")
        if len(data) > MAX_BYTES:
            print(f"✗ {xml_path.name}: {len(data)} bytes > {MAX_BYTES}")
            ok = False
            continue

        barcode = zxingcpp.create_barcode(data, zxingcpp.BarcodeFormat.DataMatrix)
        img = zxingcpp.write_barcode_to_image(barcode, scale=MODULE_PX, add_quiet_zones=True)
        pil = Image.fromarray(img).convert("1")   # pure black/white, no grey edges

        # Round trip: decode the image we just made and compare byte for byte.
        hits = zxingcpp.read_barcodes(pil, formats=zxingcpp.BarcodeFormat.DataMatrix)
        if not hits or hits[0].bytes != data:
            print(f"✗ {xml_path.name}: round trip failed")
            ok = False
            continue

        out = xml_path.with_suffix(".png")
        pil.save(out, optimize=True)
        print(f"✓ {out.name}: {len(data)} bytes → Data Matrix {pil.width}×{pil.height} px ({pil.width // MODULE_PX} modules incl. quiet zone)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
