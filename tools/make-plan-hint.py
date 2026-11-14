#!/usr/bin/env python3
"""The "where is the code?" pictures on the welcome screen: a synthetic BMP 2.8 page and a close-up of its code.

    python3 -I tools/make-plan-hint.py      (from the repo root; needs Pillow, macOS for the Arial font)

The page is example plan A (ios/PillSnap/Examples/plans/plan-a.xml, synthetic patient "Max Muster") laid out like a
printed BMP: header with the real Data Matrix code of plan A top right, then the medication table. Names come from the
example catalog (fictitious makers). The code is framed in yellow, like the corner brackets in the scan-plan mascot.

Writes (same files on both clients):
  plan-hint.png       the whole page, code framed       -> ios/PillSnap/Assets.xcassets/plan-hint.imageset, pwa/img/
  plan-hint-code.png  the code alone, filling the frame -> ios/PillSnap/Assets.xcassets/plan-hint-code.imageset, pwa/img/
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PLAN = ROOT / "ios" / "PillSnap" / "Examples" / "plans"
CATALOG = ROOT / "ios" / "PillSnap" / "Data" / "catalog.json"
ASSETS = ROOT / "ios" / "PillSnap" / "Assets.xcassets"
PWA_IMG = ROOT / "pwa" / "img"
FONTS = Path("/System/Library/Fonts/Supplemental")

W, H = 1600, 1131            # A4 landscape
INK, GREY, LINE = (20, 20, 20), (90, 90, 90), (150, 150, 150)
HEAD_BG = (228, 228, 228)
MARK = (245, 180, 0)         # yellow of the scan-plan mascot's corner brackets
SECTIONS = {"411": "Bedarfsmedikation", "425": "Wöchentliche Anwendung"}


def font(size, bold=False):
    return ImageFont.truetype(str(FONTS / ("Arial Bold.ttf" if bold else "Arial.ttf")), size)


def form(name):
    for word, short in [("Filmtabletten", "Filmtabl."), ("Retardtabletten", "Retardtabl."),
                        ("magensaftresistente", "msr. Tabl."), ("Hartkapseln", "Kaps."), ("Tabletten", "Tabl.")]:
        if word in name:
            return short
    return ""


def brand(name, strength):
    return name.split(f" {strength}")[0]


def rows():
    catalog = {c["pzn"]: c for c in json.loads(CATALOG.read_text(encoding="utf-8"))}
    xml = (PLAN / "plan-a.xml").read_text(encoding="utf-8")
    out = []
    for section in re.finditer(r'<S( c="(\d+)")?>(.*?)</S>', xml):
        code = section.group(2)
        if code in SECTIONS:
            out.append(("section", SECTIONS[code]))
        for m in re.finditer(r"<M ([^>]*)/>", section.group(3)):
            a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
            c = catalog[a["p"].zfill(8)]
            dose = [a.get(k, "0") for k in ("m", "d", "v", "h")]
            if "t" in a:
                dose = [a["t"]]
            out.append(("med", [c["substance"], brand(c["name"], c["strength"]), c["strength"], form(c["name"]),
                                dose, "Stück", a.get("i", ""), a.get("r", "")]))
    return out


def brackets(d, box, color, width, arm):
    x0, y0, x1, y1 = box
    for (x, y, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        d.line([(x, y + dy * arm), (x, y), (x + dx * arm, y)], fill=color, width=width, joint="curve")


def page():
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    m = 48
    # Header: title and patient left, code right.
    code_size = 250
    cx0, cy0 = W - m - code_size, m
    code = Image.open(PLAN / "plan-a.png").convert("L").resize((code_size, code_size), Image.NEAREST)
    img.paste(code, (cx0, cy0))
    d.rectangle([m, m, cx0 - 24, m + code_size], outline=INK, width=3)
    d.text((m + 24, m + 18), "Medikationsplan", font=font(52, True), fill=INK)
    d.text((cx0 - 220, m + 30), "Seite 1 von 1", font=font(26), fill=GREY)
    d.text((m + 24, m + 104), "für:", font=font(26), fill=GREY)
    d.text((m + 84, m + 98), "Max Muster", font=font(34, True), fill=INK)
    d.text((m + 420, m + 104), "geb. am: 01.01.1940", font=font(26), fill=INK)
    d.text((m + 24, m + 160), "ausgedruckt von:", font=font(24), fill=GREY)
    d.text((m + 230, m + 160), "Beispielpraxis", font=font(24), fill=INK)
    d.text((m + 24, m + 198), "ausgedruckt am:", font=font(24), fill=GREY)
    d.text((m + 230, m + 198), "01.11.2026", font=font(24), fill=INK)
    # Table.
    cols = [("Wirkstoff", 200), ("Handelsname", 250), ("Stärke", 100), ("Form", 130), ("mo", 46), ("mi", 46),
            ("ab", 46), ("zN", 46), ("Einheit", 90), ("Hinweise", 360), ("Grund", 0)]
    xs, x = [], m
    for _, w in cols:
        xs.append(x)
        x += w
    top, rh = m + code_size + 30, 47
    d.rectangle([m, top, W - m, top + rh], fill=HEAD_BG, outline=LINE, width=2)
    for (name, _), x in zip(cols, xs):
        d.text((x + 8, top + 12), name, font=font(22, True), fill=INK)
    y = top + rh
    body = font(22)
    for kind, r in rows():
        if y + rh > H - m:
            break
        if kind == "section":
            d.rectangle([m, y, W - m, y + rh], outline=LINE, width=1)
            d.text((m + 8, y + 12), r, font=font(22, True), fill=INK)
        else:
            d.rectangle([m, y, W - m, y + rh], outline=LINE, width=1)
            sub, brand_name, strength, frm, dose, unit, note, why = r
            cells = [sub, brand_name, strength, frm] + (dose if len(dose) == 4 else [dose[0], "", "", ""]) + [unit, note, why]
            for i, (text, x) in enumerate(zip(cells, xs)):
                f = body
                room = sum(w for _, w in cols[4:8]) if i == 4 and len(dose) == 1 else (cols[i][1] or W - m - x)
                while text and d.textlength(text, font=f) > room - 14 and f.size > 15:
                    f = font(f.size - 1)
                if 4 <= i <= 7 and len(dose) == 4:
                    d.text((x + cols[i][1] / 2, y + rh / 2), text, font=f, fill=INK, anchor="mm")
                else:
                    d.text((x + 8, y + 12), text, font=f, fill=INK)
        y += rh
    # The code, marked.
    pad = 16
    box = (cx0 - pad, cy0 - pad, cx0 + code_size + pad, cy0 + code_size + pad)
    d.rounded_rectangle(box, radius=14, outline=MARK, width=10)
    return img


def closeup():
    size, pad = 600, 70
    img = Image.new("RGB", (size, size), "white")
    code = Image.open(PLAN / "plan-a.png").convert("L").resize((size - 2 * pad, size - 2 * pad), Image.NEAREST)
    img.paste(code, (pad, pad))
    d = ImageDraw.Draw(img)
    brackets(d, (18, 18, size - 18, size - 18), MARK, 16, 110)
    return img


def save(img, name):
    small = img.convert("P", palette=Image.ADAPTIVE, colors=32)
    PWA_IMG.mkdir(parents=True, exist_ok=True)
    small.save(PWA_IMG / f"{name}.png", optimize=True)
    folder = ASSETS / f"{name}.imageset"
    folder.mkdir(parents=True, exist_ok=True)
    small.save(folder / f"{name}.png", optimize=True)
    (folder / "Contents.json").write_text(json.dumps({
        "images": [{"filename": f"{name}.png", "idiom": "universal"}],
        "info": {"author": "xcode", "version": 1},
    }, indent=2) + "\n")
    print(name, img.size, (PWA_IMG / f"{name}.png").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    save(page(), "plan-hint")
    save(closeup(), "plan-hint-code")
