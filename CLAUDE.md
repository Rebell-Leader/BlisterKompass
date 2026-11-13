# CLAUDE.md

BlisterKompass: the German medication plan (BMP 2.8) as a large-print picture sheet for the older person and a scanner app for the carer.
iPhone app (`ios/`) + web app (`pwa/`), one product. Public repo, MIT, synthetic data only.

@AGENTS.md

Read first: `AGENTS.md`, `ARCHITECTURE.md` (incl. the iOS ↔ PWA code map), `TODO.md`, `docs/PRD-*.md`, `docs/DECISIONS.md`.

```bash
cd pwa && npm install && npm test                  # web-app tests (Node 22); CI runs them on every PR
cd pwa && npm run sync              # after editing ios/PillSnap/Data or Examples
ios/checks/run.sh                   # iOS checks (macOS + swiftc); the app needs Xcode 26
python3 -m http.server 8090         # from the repo root → http://localhost:8090/pwa/
python3 -I deploy/build.py          # what Vercel publishes → deploy/dist
```

Gotchas:
- BMP XML: ISO-8859-1, no prolog, ≤ 1400 bytes per code; `M/@p` is the PZN without leading zeros (zero-pad to 8).
- zxing: parse the result's bytes, not the human-readable text (GS separators become "␝" there).
- Any web-app file change → bump `VERSION` in `pwa/sw.js`; new file → add it to `PRECACHE`.
- Every change goes into both clients, or into a TODO item for the missing side (`AGENTS.md` §3).
- Never commit the full PZN list or leaflet quotes (CI data guard); no secrets in the repo.
- The Xcode target and folder are still named `PillSnap`; the app's display name is BlisterKompass.
