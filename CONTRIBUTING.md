# Contributing to BlisterKompass

## Flow

1. Branch from `main`: `feat/…`, `fix/…`, `docs/…`.
2. Open a pull request. CI runs (web-app tests, site build + data guard, print tests) and Vercel builds a preview of the site and web app.
3. Someone else reviews. Check the preview on a phone for anything you see.
4. **Squash merge.** `main` is protected: no direct pushes, CI must be green. Merging deploys production.

Rules for the code itself are in [AGENTS.md](AGENTS.md). The most important one: **every change goes into both clients** (iPhone app and
web app) in the same PR, with the same check on both sides. If you can't do one side (no Mac, for example), add a [TODO.md](TODO.md)
item for it and say so in the PR description.

## Commits

`type(scope): what changed`, in the imperative, short. Types: `feat`, `fix`, `docs`, `ci`, `chore`, `test`. Scopes: `ios`, `pwa`,
`print`, `site`, `data`. Example: `fix(pwa,ios): meal tag ignores negated hints`. Explain the why in the body when it isn't obvious.

## Before you open the PR

- `cd pwa && npm test` is green; if you edited `ios/PillSnap/Data` or `Examples`, you ran `npm run sync`.
- `ios/checks/run.sh` on a Mac, or a note in the PR that it didn't run.
- `VERSION` in `pwa/sw.js` bumped if a web-app file changed.
- Patient-facing text: no tablet-handling instruction, no identity from appearance, nothing inferred (AGENTS.md §2).
- Docs updated: README, ARCHITECTURE (code map), pwa/README, TODO, PRD if a requirement changed.

## Porting work from the hackathon repo

The project started in a private hackathon repository. Bring work over as **curated squash commits**, one per meaningful feature, not
a replay of the history:

- Port only what fits the product (the two ends in [docs/DECISIONS.md](docs/DECISIONS.md) D-12) and passes the tests here.
- Credit everyone who worked on it with `Co-authored-by:` trailers using their **GitHub noreply address**
  (`<id>+<login>@users.noreply.github.com`), never a personal email.
- **Never port restricted data**: the full BfArM PZN list, verbatim package-leaflet quotes, the challenge owner's material, research
  notes about people, anything from `data/raw`. See [docs/DATA.md](docs/DATA.md).

## Questions and decisions

Open product, clinical or licensing questions go into [docs/DECISIONS.md](docs/DECISIONS.md) as a new row instead of being decided in
code.
