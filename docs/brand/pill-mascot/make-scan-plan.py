"""Mascot state "scan-plan": the waving pill next to a paper Medikationsplan, scan corners on its code.

Run after slice.py: python3 docs/brand/pill-mascot/make-scan-plan.py   (needs Pillow)
Builds on pwa/img/mascot/base.png and writes the same two places as slice.py:
pwa/img/mascot/scan-plan.png and ios/PillSnap/Assets.xcassets/mascot-scan-plan.imageset.
The plan is drawn, not photographed: A4 landscape, header, table rows, 2D code top right (as on the real BMP).
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SIZE, SS = 512, 2  # output size, supersampling
INK = (2, 45, 58, 255)  # mascot outline
TEAL = (6, 150, 174, 255)
PAPER = (255, 255, 255, 255)
ROW = (196, 210, 216, 255)
SCAN = (255, 196, 46, 255)  # the yellow of the mascot's sparkles


def s(v):
    return int(round(v * SS))


def plan_sheet() -> Image.Image:
    """The paper plan, upright, on its own layer (supersampled)."""
    w, h, line = 300, 212, 9
    im = Image.new("RGBA", (s(w + 40), s(h + 40)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0 = s(20), s(20)
    d.rounded_rectangle((x0, y0, x0 + s(w), y0 + s(h)), radius=s(14), fill=PAPER, outline=INK, width=s(line))
    # Header: title bar and two short text lines.
    d.rounded_rectangle((x0 + s(22), y0 + s(24), x0 + s(150), y0 + s(40)), radius=s(6), fill=TEAL)
    for i, ln in enumerate((96, 70)):
        d.rounded_rectangle((x0 + s(22), y0 + s(52 + i * 16), x0 + s(22 + ln), y0 + s(60 + i * 16)), radius=s(4), fill=ROW)
    # Table rows.
    for i in range(4):
        y = y0 + s(108 + i * 24)
        d.rounded_rectangle((x0 + s(22), y, x0 + s(w - 22), y + s(10)), radius=s(5), fill=ROW)
        d.ellipse((x0 + s(26), y - s(1), x0 + s(38), y + s(11)), fill=TEAL)
    # 2D code top right: L finder on left/bottom, clock track on top/right, random modules inside.
    n, m = 8, 8.5
    cx, cy = x0 + s(w - 22 - n * m), y0 + s(20)
    rnd = random.Random(28)
    for r in range(n):
        for c in range(n):
            on = (c == 0 or r == n - 1 or (r == 0 and c % 2 == 0) or (c == n - 1 and r % 2 == 1)
                  or (0 < r < n - 1 and 0 < c < n - 1 and rnd.random() < 0.5))
            if on:
                d.rectangle((cx + s(c * m), cy + s(r * m), cx + s((c + 1) * m) - 1, cy + s((r + 1) * m) - 1), fill=INK)
    im.info["code"] = (cx, cy, s(n * m))
    return im


def corners(d: ImageDraw.ImageDraw, box, arm, width, fill):
    x0, y0, x1, y1 = box
    for (x, y, dx, dy) in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        d.line((x + dx * arm, y, x, y, x, y + dy * arm), fill=fill, width=width, joint="curve")
        for px, py in ((x + dx * arm, y), (x, y + dy * arm), (x, y)):
            d.ellipse((px - width / 2, py - width / 2, px + width / 2, py + width / 2), fill=fill)


def main():
    canvas = Image.new("RGBA", (s(SIZE), s(SIZE)), (0, 0, 0, 0))
    sheet = plan_sheet()
    cx, cy, cw = sheet.info["code"]
    # Scan corners around the code, drawn on the sheet so they tilt with it.
    d = ImageDraw.Draw(sheet)
    pad = s(9)
    corners(d, (cx - pad, cy - pad, cx + cw + pad, cy + cw + pad), s(16), s(7), SCAN)
    tilted = sheet.rotate(-6, resample=Image.BICUBIC, expand=True)
    canvas.alpha_composite(tilted, (s(SIZE - 6) - tilted.width, s(74)))
    # Sparkles next to the code, like on the other states.
    d = ImageDraw.Draw(canvas)
    for (x0, y0, x1, y1) in ((438, 52, 446, 30), (466, 62, 486, 50)):
        d.line((s(x0), s(y0), s(x1), s(y1)), fill=SCAN, width=s(7))
        for x, y in ((x0, y0), (x1, y1)):
            d.ellipse((s(x) - s(3.5), s(y) - s(3.5), s(x) + s(3.5), s(y) + s(3.5)), fill=SCAN)
    # The pill, mirrored so the waving hand points at the plan, in front of the sheet's lower left.
    pill = Image.open(ROOT / "pwa/img/mascot/base.png").convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT)
    pill = pill.crop(pill.getbbox())
    k = s(300) / pill.width
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
