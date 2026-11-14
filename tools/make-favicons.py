#!/usr/bin/env python3
"""Make the small browser-tab icons from the PWA icon (run after pwa/icons/icon-512.png changes; macOS, uses sips).

  pwa/icons/favicon-32.png  -> <link rel="icon"> in the web app and on the site pages
  pwa/icons/favicon.ico     -> 16/32/48 px, served at /favicon.ico (deploy/build.py), where browsers look by default
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


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        imgs = [(s, png(s, Path(tmp) / f"{s}.png")) for s in (16, 32, 48)]
    (ICONS / "favicon-32.png").write_bytes(imgs[1][1])
    # ICO with PNG payloads: header, one 16-byte entry per size, then the PNGs.
    head = struct.pack("<HHH", 0, 1, len(imgs))
    offset = len(head) + 16 * len(imgs)
    entries, data = b"", b""
    for size, blob in imgs:
        entries += struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(blob), offset + len(data))
        data += blob
    (ICONS / "favicon.ico").write_bytes(head + entries + data)
    print("wrote favicon-32.png and favicon.ico in", ICONS)


if __name__ == "__main__":
    main()
