"""App icons from the BlisterKompass mascot (icons/mascot-wave.png, art by Anna P.).

    python3 -I pwa/scripts/make-icons.py      (from the repo root; needs pillow)

icon-192/512: mascot on transparent; icon-maskable-512 and apple-touch-icon: mascot inside the 80 % safe zone on a light
background, so the teal outline stays visible on dark and light home screens.
"""
import pathlib
from PIL import Image

ICONS = pathlib.Path(__file__).resolve().parent.parent / "icons"
BG = (238, 247, 249, 255)   # light teal-white, matches the landing page


def fit(src, size, scale):
    m = src.copy()
    box = int(size * scale)
    m.thumbnail((box, box), Image.LANCZOS)
    return m


def main():
    src = Image.open(ICONS / "mascot-wave.png").convert("RGBA")
    src = src.crop(src.getbbox())
    for name, size, bg, scale in [("icon-192.png", 192, None, 0.96), ("icon-512.png", 512, None, 0.96),
                                  ("icon-maskable-512.png", 512, BG, 0.72), ("apple-touch-icon.png", 180, BG, 0.82)]:
        out = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
        m = fit(src, size, scale)
        out.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
        out.save(ICONS / name, optimize=True)
        print(name, out.size)


if __name__ == "__main__":
    main()
