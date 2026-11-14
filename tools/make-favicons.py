#!/usr/bin/env python3
"""Make the browser-tab and iPhone home-screen icons from the PWA icons (run after pwa/icons/icon-*512.png change; macOS, sips).

  pwa/icons/favicon-32.png  -> <link rel="icon"> in the web app and on the site pages
  pwa/icons/favicon.ico     -> 16/32/48 px, served at /favicon.ico (deploy/build.py), where browsers look by default
  pwa/icons/apple-touch-icon.png -> 180 px, opaque, cropped from icon-maskable-512.png to its centre 400 px so the mascot
                               fills ~85 % of the tile instead of ~74 % (iOS adds no padding, only rounded corners)
"""
import struct
import subprocess
import tempfile
from pathlib import Path

ICONS = Path(__file__).resolve().parent.parent / "pwa" / "icons"


def png(size: int, out: Path) -> bytes:
    subprocess.run(["sips", "-z", str(size), str(size), str(ICONS / "icon-512.png"), "--out", str(out)],
                   check=True, capture_output=True)
    return out.read_bytes()


def apple_touch_icon(tmp: Path) -> None:
    crop = tmp / "crop.png"
    subprocess.run(["sips", "--cropToHeightWidth", "400", "400", str(ICONS / "icon-maskable-512.png"), "--out", str(crop)],
                   check=True, capture_output=True)
    subprocess.run(["sips", "-z", "180", "180", str(crop), "--out", str(ICONS / "apple-touch-icon.png")],
                   check=True, capture_output=True)


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        imgs = [(s, png(s, Path(tmp) / f"{s}.png")) for s in (16, 32, 48)]
        apple_touch_icon(Path(tmp))
    (ICONS / "favicon-32.png").write_bytes(imgs[1][1])
    # ICO with PNG payloads: header, one 16-byte entry per size, then the PNGs.
    head = struct.pack("<HHH", 0, 1, len(imgs))
    offset = len(head) + 16 * len(imgs)
    entries, data = b"", b""
    for size, blob in imgs:
        entries += struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(blob), offset + len(data))
        data += blob
    (ICONS / "favicon.ico").write_bytes(head + entries + data)
    print("wrote favicon-32.png, favicon.ico and apple-touch-icon.png in", ICONS)


if __name__ == "__main__":
    main()
