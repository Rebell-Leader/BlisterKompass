#!/usr/bin/env python3
"""Assemble the static site for Vercel (or any static host) in deploy/dist/.

  /                   -> redirect to /docs/landing.html (vercel.json)
  /docs/landing.html  -> docs/landing.html wrapped in a full HTML document (same for impressum.html, datenschutz.html)
  /docs/screens/*     -> the screenshots the landing page shows
  /docs/fonts/*       -> self-hosted Atkinson Hyperlegible (no Google Fonts request, no IP sent to Google)
  /docs/download/*    -> the Android APK (built by android/build-apk.sh, committed as a binary)
  /pwa/*              -> the PWA as it is, without tests, scripts and package files

docs/landing.html stays an Artifact-style fragment (no doctype, head or charset), so the build adds them here.
Run:  python3 deploy/build.py   (from the repo root)

Vercel runs this as the build command (vercel.json in the repo root; Git integration) and
publishes only deploy/dist. Redirects and headers live in that vercel.json, not in dist/.
"""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "deploy" / "dist"

HEAD = """<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="referrer" content="no-referrer">
<link rel="icon" type="image/png" sizes="192x192" href="../pwa/icons/icon-192.png">
<link rel="apple-touch-icon" href="../pwa/icons/apple-touch-icon.png">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
@font-face { font-family: 'Atkinson Hyperlegible'; font-style: normal; font-weight: 400; font-display: swap;
  src: url(fonts/atkinson-hyperlegible-400-latin.woff2) format('woff2'); }
@font-face { font-family: 'Atkinson Hyperlegible'; font-style: normal; font-weight: 700; font-display: swap;
  src: url(fonts/atkinson-hyperlegible-700-latin.woff2) format('woff2'); }
</style>
"""

PWA_SKIP = {"tests", "scripts", "node_modules", "package.json", "package-lock.json", "README.md", ".gitignore"}
PAGES = ("landing.html", "impressum.html", "datenschutz.html")


def page(name: str) -> str:
    src = (ROOT / "docs" / name).read_text(encoding="utf-8")
    # Google Fonts would send every visitor's IP to Google; the font is self-hosted instead.
    src = re.sub(r'<link rel="(preconnect|stylesheet)" href="https://fonts\.(googleapis|gstatic)\.com[^>]*>\n?', "", src)
    if "fonts.googleapis.com" in src or "fonts.gstatic.com" in src:
        raise SystemExit(f"{name} still references Google Fonts")
    head, sep, body = src.partition("</style>")
    if not sep:
        raise SystemExit(f"{name}: no </style> found")
    return HEAD + head + sep + "\n</head>\n<body>\n" + body.lstrip("\n") + "\n</body>\n</html>\n"


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    docs = DIST / "docs"
    docs.mkdir(parents=True)
    shots = set()
    for name in PAGES:
        html = page(name)
        (docs / name).write_text(html, encoding="utf-8")
        shots |= set(re.findall(r'src="screens/([^"]+)"', html))
    for name in sorted(shots):
        (docs / "screens").mkdir(exist_ok=True)
        shutil.copy2(ROOT / "docs" / "screens" / name, docs / "screens" / name)
    shutil.copytree(ROOT / "docs" / "fonts", docs / "fonts")
    if (ROOT / "docs" / "download").exists():
        shutil.copytree(ROOT / "docs" / "download", docs / "download")
    shutil.copytree(ROOT / "pwa", DIST / "pwa", ignore=lambda d, names: [n for n in names if n in PWA_SKIP])
    files = [p for p in DIST.rglob("*") if p.is_file()]
    print(f"{len(files)} files, {sum(p.stat().st_size for p in files) / 1e6:.1f} MB in {DIST}")


if __name__ == "__main__":
    main()
