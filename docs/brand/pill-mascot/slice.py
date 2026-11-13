"""Cut the ChatGPT mascot sheet (4 x 2 sprites on white) into transparent, equally scaled PNGs.

Run: python3 docs/brand/pill-mascot/slice.py   (needs Pillow + numpy)
Writes ios/PillSnap/Assets.xcassets/mascot-*.imageset and pwa/img/mascot/*.png.
A single-sprite <name>.png next to this script (also from ChatGPT, white background) replaces that cell,
e.g. scanning.png: the X-ray pill redrawn excited instead of angry.
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NAMES = ["base", "scanning", "found", "check", "other-maker", "not-on-plan", "not-recognized", "not-in-list"]
# Gutters measured on sheet.png (columns/rows with no ink).
COLS = [(0, 396), (396, 769), (769, 1146), (1146, 1536)]
ROWS = [(0, 494), (494, 1024)]
SIZE, PAD = 512, 24
SENTINEL = (255, 0, 255)


def cutout(cell: Image.Image) -> Image.Image:
    """White background -> transparent. Flood fill from the edges so the white half of the pill stays."""
    rgb = cell.convert("RGB")
    w, h = rgb.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if rgb.getpixel(seed) != SENTINEL:
            ImageDraw.floodfill(rgb, seed, SENTINEL, thresh=28)
    a = np.asarray(rgb)
    bg = np.all(a == SENTINEL, axis=2)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    out = cell.convert("RGBA")
    out.putalpha(alpha)
    return out


def main():
    sheet = Image.open(HERE / "sheet.png")
    sprites = []
    for r0, r1 in ROWS:
        for c0, c1 in COLS:
            s = cutout(sheet.crop((c0, r0, c1, r1)))
            sprites.append(s.crop(s.getbbox()))
    # One scale for all, so the pill keeps the same size from state to state.
    biggest = max(max(s.size) for s in sprites)
    scale = (SIZE - 2 * PAD) / biggest
    ios = ROOT / "ios/PillSnap/Assets.xcassets"
    web = ROOT / "pwa/img/mascot"
    web.mkdir(parents=True, exist_ok=True)
    ios.mkdir(parents=True, exist_ok=True)
    (ios / "Contents.json").write_text(json.dumps({"info": {"author": "xcode", "version": 1}}, indent=2) + "\n")
    for name, s in zip(NAMES, sprites):
        override = HERE / f"{name}.png"
        if override.exists():
            s = cutout(Image.open(override))
            s = s.crop(s.getbbox())
            k = (SIZE - 2 * PAD) / max(s.size)  # fits the box, like the biggest sheet sprite
        else:
            k = scale
        s = s.resize((round(s.width * k), round(s.height * k)), Image.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(s, ((SIZE - s.width) // 2, (SIZE - s.height) // 2))
        canvas.save(web / f"{name}.png", optimize=True)
        iset = ios / f"mascot-{name}.imageset"
        iset.mkdir(exist_ok=True)
        canvas.save(iset / f"mascot-{name}.png", optimize=True)
        (iset / "Contents.json").write_text(json.dumps({
            "images": [{"filename": f"mascot-{name}.png", "idiom": "universal"}],
            "info": {"author": "xcode", "version": 1},
        }, indent=2) + "\n")
        print(name, s.size)


if __name__ == "__main__":
    main()
