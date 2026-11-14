"""Cut install.png (mascot jumping out of a phone, ChatGPT, white background) into the transparent install icon.

Run: python3 docs/brand/pill-mascot/make-install.py   (needs Pillow + numpy)
Writes pwa/icons/mascot-install.png, used on every install / download button of the landing page.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SIZE, PAD = 256, 6
SENTINEL = (255, 0, 255)


def cutout(img: Image.Image) -> Image.Image:
    """White background -> transparent. Flood fill from the edges so white inside the drawing stays."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if rgb.getpixel(seed) != SENTINEL:
            ImageDraw.floodfill(rgb, seed, SENTINEL, thresh=28)
    a = np.array(rgb)
    bg = np.all(a == SENTINEL, axis=-1)
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.convert("RGBA")
    out.putalpha(alpha)
    return out


def main() -> None:
    icon = cutout(Image.open(HERE / "install.png"))
    icon = icon.crop(icon.getbbox())
    scale = (SIZE - 2 * PAD) / max(icon.size)
    icon = icon.resize((round(icon.width * scale), round(icon.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE))
    canvas.paste(icon, ((SIZE - icon.width) // 2, (SIZE - icon.height) // 2), icon)
    canvas.save(ROOT / "pwa" / "icons" / "mascot-install.png", optimize=True)


if __name__ == "__main__":
    main()
