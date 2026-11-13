# AGENTS.md – rules for coding agents (and people) working on BlisterKompass

Read this file, [ARCHITECTURE.md](ARCHITECTURE.md), [TODO.md](TODO.md) and the two PRDs ([print sheet](docs/PRD-print-sheet.md),
[scanner app](docs/PRD-scanner-app.md)) before changing code. To change a rule here, add a question to
[docs/DECISIONS.md](docs/DECISIONS.md) instead of deciding it yourself.

## 1. What we build, and what we don't

BlisterKompass helps an older person on many medicines, and the people who look after them, read the German medication plan (BMP 2.8)
and recognise their own pills. Two ends (D-12):

- **The older person:** the printable sheet "Meine Medikamente mit Bildern" (A4 PDF from the app), next to the paper BMP.
- **The carer or skilled patient:** the mobile app with a scanner (iPhone app in `ios/`, web app in `pwa/`): plan code → day view,
  pack code → PZN, pill photo → candidates, read-aloud, print.

We don't build: a physician or clinician app; a prescribing or dose engine; an interaction checker that drives decisions; photo
recognition as proof of identity; an ePA/TI integration; a server backend or accounts.

## 2. Hard rules

1. **Synthetic data only.** No real patient data in code, fixtures, screenshots, logs or commits.
2. **INV-05: unknown stays unknown.** Never fill a missing field (look, size, dose, unit, reason) from a default, a "typical" value
   or another product. A medicine without picture data shows a grey outline of its dosage form and "Aussehen unbekannt".
3. **INV-12: patient-facing text comes from fixed templates** over structured plan data. No generated wording.
4. **INV-15: identity = plan entry + PZN** (plan code, pack code, catalog) or a professional's confirmation. Appearance only proposes
   candidates; even a single candidate is "probably", never "identified".
5. **INV-16: never tell anyone to remove, add, replace or re-sort a tablet** in a prepared container (dosette, weekly box, blister).
   Name the medicine, the time slot and who to ask, nothing more.
6. **INV-17: changes to prepared doses go to the responsible professional** (pharmacy, care service, practice). The app never decides.
7. **INV-19: the app's list is not a regimen change.** Adding a pack is the patient's own list; only the physician changes therapy.
8. **No BMP code built from the phone's list** (D-09). The paper BMP from the practice stays the valid plan; our sheet is titled
   "Meine Medikamente mit Bildern" and says it belongs to that plan.
9. **Privacy.** The plan reader never reads `P`, `A` or `O` (patient, issuer, parameters). The web app makes no network request after
   the first load (strict CSP); the only other hosts in its code are the two leaflet links the person opens themselves
   (`pwa/js/leaflet-parser.js`). Only `myMeds`, `unknownPZNs` and `learnedLeaflets` (products whose look was read from a leaflet
   PDF the person picked, no person data) are stored on the phone. Photos are never stored or uploaded.
10. **Data licences.** This repo is public. Never commit the full BfArM PZN list or verbatim package-leaflet quotes; the CI data guard
    fails on both. Details in [docs/DATA.md](docs/DATA.md).
11. **Never weaken a test to make it pass.** If a test encodes behaviour that is now wrong, change it on purpose, say why in the
    commit, and change its twin on the other client.
12. **No secrets in the repo.** Tokens and keys live in GitHub or Vercel settings, never in files.

## 3. Two clients, one product

BlisterKompass ships as an iPhone app (`ios/`, SwiftUI) and a web app (`pwa/`, deployed on every merge to `main`). They are one product:
same features, same rules, same German texts, same data. Deliver them together.

1. **Every feature, fix and text change lands in both clients in the same PR.** If one side really can't be done now (for example, no
   Mac to build iOS), the PR adds a [TODO.md](TODO.md) item for the missing side (ID, file:line, fix, test) and says so in its
   description. Never let one client diverge silently.
2. **Port module to module.** The logic files are paired 1:1 (code map in [ARCHITECTURE.md](ARCHITECTURE.md#code-map-ios--pwa)). Keep
   names, rules, thresholds and wording identical, and put a fix into the paired file, not somewhere else.
3. **Pair the checks.** A new or changed rule gets a check with the same name on both sides: `ios/checks/main.swift` and
   `pwa/tests/checks.test.js`. Run `cd pwa && npm test` (CI runs it on every PR) and `ios/checks/run.sh` (macOS only). If you couldn't
   run the iOS checks, say so in the PR.
4. **One data source.** `ios/PillSnap/Data/` and `ios/PillSnap/Examples/` are the source of truth. Edit there, then run
   `npm run sync` in `pwa/`. A test fails if the copies differ.
5. **Web-app housekeeping.** A new web-app file goes into `PRECACHE` in `pwa/sw.js`. Any change to a web-app file bumps `VERSION` in
   `sw.js`, or installed apps keep the old build.
6. **Docs move with the code.** Update [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md) (code map), [pwa/README.md](pwa/README.md),
   [TODO.md](TODO.md) and, if a requirement changes, the PRD in the same PR.
7. **The §2 rules apply to both clients.** The open gaps are in [TODO.md](TODO.md).

## 4. Definition of done

- The change is in both clients with paired checks, or the missing side is a TODO item (§3).
- `cd pwa && npm test` is green; CI (web-app tests, site build + data guard, print tests) is green; the Vercel preview loads.
- Patient-facing text follows §2: no tablet-handling instruction, no identity from appearance, nothing inferred.
- Every displayed fact has a source: the plan, the pack code, the catalog entry with its `look.source`, or a person who confirmed it.
- Errors are visible states ("Nicht erkannt", "Aussehen unbekannt", "Seite 2 fehlt"), not swallowed exceptions.
- Docs updated (§3.6).

## 5. Decisions

Open clinical, regulatory, licensing or product questions go into [docs/DECISIONS.md](docs/DECISIONS.md) as a new row (question,
options, recommendation, whether it blocks). Stop that capability, continue with other work, and don't guess.
