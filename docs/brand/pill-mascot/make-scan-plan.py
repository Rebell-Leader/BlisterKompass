"""Mascot state "scan-plan": the waving blister mascot of the app icon next to a paper Medikationsplan, scan corners on its code.

Run after slice.py: python3 docs/brand/pill-mascot/make-scan-plan.py   (needs Pillow)
Builds on pwa/icons/mascot-wave.png (art by Anna P., the app icon's mascot) and writes the same two places as slice.py:
pwa/img/mascot/scan-plan.png and ios/PillSnap/Assets.xcassets/mascot-scan-plan.imageset.
The plan is the welcome card's example plan (pwa/img/plan-hint.png): A4 landscape, code top right, framed in yellow.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SIZE, SS = 512, 2  # output size, supersampling
INK = (2, 45, 58, 255)  # mascot outline
SCAN = (255, 196, 46, 255)  # the yellow of the mascot's sparkles
MASCOT_H = 300  # blister mascot height on the 512 canvas


def s(v):
    return int(round(v * SS))


def plan_sheet() -> Image.Image:
    """The paper plan, upright, on its own layer (supersampled): the welcome card's example plan (pwa/img/plan-hint.png,
    made by tools/make-plan-hint.py, code already framed in yellow) with rounded corners and the mascot's outline."""
    w, h, line = 300, 212, 5
    im = Image.new("RGBA", (s(w + 40), s(h + 40)), (0, 0, 0, 0))
    x0, y0 = s(20), s(20)
    paper = Image.open(ROOT / "pwa/img/plan-hint.png").convert("RGBA").resize((s(w), s(h)), Image.LANCZOS)
    mask = Image.new("L", paper.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s(w) - 1, s(h) - 1), radius=s(14), fill=255)
    im.paste(paper, (x0, y0), mask)
    ImageDraw.Draw(im).rounded_rectangle((x0, y0, x0 + s(w), y0 + s(h)), radius=s(14), outline=INK, width=s(line))
    return im


def main():
    canvas = Image.new("RGBA", (s(SIZE), s(SIZE)), (0, 0, 0, 0))
    sheet = plan_sheet()
    tilted = sheet.rotate(-6, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(tilted, (s(SIZE - 6) - tilted.width, s(74)))
    # Sparkles next to the code, like on the other states.
    d = ImageDraw.Draw(canvas)
    for (x0, y0, x1, y1) in ((438, 52, 446, 30), (466, 62, 486, 50)):
        d.line((s(x0), s(y0), s(x1), s(y1)), fill=SCAN, width=s(7))
        for x, y in ((x0, y0), (x1, y1)):
            d.ellipse((s(x) - s(3.5), s(y) - s(3.5), s(x) + s(3.5), s(y) + s(3.5)), fill=SCAN)
    # The blister mascot, mirrored so the waving hand points at the plan, in front of the sheet's lower left.
    pill = Image.open(ROOT / "pwa/icons/mascot-wave.png").convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT)
    pill = pill.crop(pill.getbbox())
    k = s(MASCOT_H) / pill.height
    pill = pill.resize((round(pill.width * k), round(pill.height * k)), Image.LANCZOS)
    canvas.alpha_composite(pill, (s(0), s(SIZE - 14) - pill.height))
    out = canvas.resize((SIZE, SIZE), Image.LANCZOS)

    out.save(ROOT / "pwa/img/mascot/scan-plan.png", optimize=True)
    ios = ROOT / "ios/PillSnap/Assets.xcassets/mascot-scan-plan.imageset"
    ios.mkdir(parents=True, exist_ok=True)
    out.save(ios / "mascot-scan-plan.png", optimize=True)
    (ios / "Contents.json").write_text(json.dumps(
        {"images": [{"filename": "mascot-scan-plan.png", "idiom": "universal"}], "info": {"author": "xcode", "version": 1}},
        indent=2) + "\n")
    print("wrote scan-plan")


if __name__ == "__main__":
    main()
