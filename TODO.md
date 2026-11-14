# BlisterKompass TODO

13 Nov 2026. Source: a multi-perspective review of the app in the hackathon repo (skilled user, pharmacist, physician, and a photo→PZN
plus accessibility test run with Playwright and Chromium at 390×844, axe-core and pdf.js), re-checked when the code moved here. Line
numbers refer to the code as moved on 13 Nov 2026 and may drift. Each item gives the problem, the fix, and how to test the fix.
Status: **verified** means it was run or seen; **suspected** means it was found by reading code. The summary's **Status** column says
whether an item is open, fixed or mitigated, and on which client; "fixed" means the fix and its check are in the code, not only a test.
14 Nov 2026: the submission review (`docs/submission_review_2026-11-13.md` in the hackathon repo) re-verified T-01, T-04–T-06, T-13 and
T-15 on this code and added T-51–T-57; the fixes are in PR "fix: safety findings of the submission review".
**Fix both clients** ([`AGENTS.md`](AGENTS.md) → “Two clients, one product”): most items cite the web-app file; apply the same fix to the
paired Swift file from the code map in [`ARCHITECTURE.md`](ARCHITECTURE.md#code-map-ios--pwa), with the same check on both sides, or note
in the PR why one side waits. Requirements behind these items: [PRD print sheet](docs/PRD-print-sheet.md), [PRD scanner app](docs/PRD-scanner-app.md).

## Already done before the move (not repeated below)

- CI and deploy: tests in GitHub Actions (`.github/workflows/ci.yml`), deployment by Vercel's Git integration on this public repo (D-13).
- PWA BMP 2.8 reading: all `<W>` (combination products); the plan PZN is never replaced by another product; no guessed picture for lines without a PZN (INV-05).
- PWA BMP 2.8 day view: plan entries without a look keep their schedule and appear in the day view with a dose-form outline.
- PWA weekly `wo`: keeps dose and slot, shows in its slot on its weekday and "nächster <Tag>, <Datum>" otherwise.
- PWA `t`: free-text dosing shown verbatim ("für 2 Wochen" is no longer weekly; only an explicit "1x wöchentlich …" is). This also covers the as-needed limit "max. 3 pro Tag".
- PWA units `du`/`dud` (Anhang 4); fractions per the BMP pattern, German display, "1½".
- PWA reason `r` from the plan replaces the catalog purpose (UI + read-aloud); Hinweis `i` shown for all schedule kinds; `x` extra line.
- PWA section codes 411–425 and free-text headings; `X`/`R` lines; multi-page `MP/@a/@z/@U` merge with a missing-page notice; an empty plan can't be adopted.
- PWA print (`print-sheet.js`, `bmp-writer.js`): retitled "Meine Medikamente mit Bildern", no BMP code built from the phone's list, slot words, "Größe unbekannt" instead of a default size, units/weekly/reason as above, meal-tag negation fix.
- PWA print layout to [PRD print sheet](docs/PRD-print-sheet.md) §5.4–5.8 (was T-28): ≥ 12 pt body, 14–18 pt names and doses, Nr. column, source line per picture, 5 cm control bar, 6 rows per page with the header repeated, slot words.
- Python demo print (`tools/make-bmp-sheet.py`, `print/*`): faithful BMP page plus a separate picture companion sheet per [PRD print sheet](docs/PRD-print-sheet.md) §5.
- Example plan A: weekly MTX moved into `<S c="425">` (BMP 2.8 §6.2.11), code regenerated; `sheet-plan-a.png` is now the picture sheet carrying the plan's code.
- A card opened from the day list says "Auf Ihrem Plan" (was "Ihre Tablette", also for insulin).

## Summary

| ID | P | Title | Area | Status |
|---|---|---|---|---|
| T-01 | P0 | Home screen timers double every minute, app freezes after ~10 min | skilled user | fixed (web; iOS uses `TimelineView`, n/a) |
| T-02 | P0 | Double-tap on any "back home" button leaves the app | skilled user | open |
| T-03 | P0 | Generic switch or combination pack shows as "Nicht auf Ihrem Plan!" with Add | pharmacist | open |
| T-04 | P0 | Pill photo: "anderer Hersteller" ignores strength | physician | fixed (web + iOS) |
| T-05 | P0 | White pills: one "Wahrscheinlich" pick among 4 look-alikes (metformin demo photo → Atorvastatin) | photo→PZN | fixed (web + iOS) |
| T-06 | P0 | Day view can cause a skipped or doubled dose (11:05, after midnight); no "intake not recorded" | physician | fixed (web + iOS) |
| T-07 | P0 | Demo plan A is clinically implausible | pharmacist, physician | open |
| T-08 | P0 | INV-15/16/19 wording still in the PWA | pharmacist, physician | fixed in the apps (web + iOS); screenshots T-46 |
| T-09 | P0 | Old build after redeploy; saved meds keep stale looks | skilled user, deploy | open |
| T-10 | P1 | Spoken confirmations are cut off after ~6 ms | skilled user, accessibility | open |
| T-11 | P1 | "Fertig" in typed entry wipes no-picture entries; "Ohne Bild" rows dead | skilled user | open |
| T-12 | P1 | Typed entry is a dead end outside the 108-product catalog | skilled user | open |
| T-13 | P1 | Typed / added amounts default to 1 | pharmacist, physician | fixed (web + iOS) |
| T-14 | P1 | Patient list drifts from the BMP; no "laut Plan" vs "selbst eingetragen"; no plan date | physician | open |
| T-15 | P1 | A user's "Apotheke hat bestätigt" tap becomes identity | pharmacist | mitigated: take-over removed (web + iOS) |
| T-16 | P1 | INV-21 substitution-exclusion flag missing | pharmacist | open |
| T-17 | P1 | Strength match ignores dose-form family and concentration | pharmacist | open |
| T-18 | P1 | Other pack size of the same product shows as "andere Packung" | pharmacist | open |
| T-19 | P1 | 1D PZN barcode fails on carton photos (2400 px downscale) | photo→PZN | mitigated in the apps: printed PZN by OCR; browser open |
| T-20 | P1 | Photo of a whole plan sheet never decodes | photo→PZN | open |
| T-21 | P1 | Fake "Packungsbeilage wird gelesen …" animation | photo→PZN, pharmacist | open |
| T-22 | P1 | Malformed saved data locks the app for good | skilled user | open |
| T-23 | P1 | Misleading error messages; "Nochmal" goes home | skilled user | open |
| T-24 | P1 | Hinweise and meal tags missing in day view and read-aloud | physician | open |
| T-25 | P1 | Contrast below 4.5:1 (morning slot, "off" slots, dark slot buttons) | accessibility | open |
| T-26 | P1 | 200% zoom: sideways scroll, names cut to "M…" | accessibility | open |
| T-27 | P1 | "Eigene Fotos" off-screen; the only gallery path on Android | skilled user, accessibility | open |
| T-29 | P1 | iOS: `PlanReader.swift` needs the PWA BMP 2.8 reading fixes | physician, pharmacist | partly fixed (iOS): no substance fallback, all `<W>`, weekly dose, BMP checks |
| T-30 | P1 | iOS: print writes a BMP 2.8 code from the patient list; old layout | pharmacist, physician | open |
| T-31 | P1 | iOS: `MealTiming.swift` inverts negations | pharmacist, physician | fixed (iOS) |
| T-32 | P1 | Decision: may the patient app reprint the original BMP code bytes? | pharmacist | open |
| T-33 | P2 | Other-maker screen hides the scanned PZN | photo→PZN | open |
| T-34 | P2 | PPN mod-97 and NTIN check digits not verified | pharmacist | open |
| T-35 | P2 | Expiry text drops a coded day | pharmacist | open |
| T-36 | P2 | Score-line question says "zum Teilen" (MTX HEXAL Kerbe is not for splitting) | pharmacist | fixed (web + iOS) |
| T-37 | P2 | "Verwerfen" with trash icon reads like "throw the medicine away" | skilled user | open |
| T-38 | P2 | "Aussehen antippen" tile still on the PWA home screen | skilled user, physician | open |
| T-39 | P2 | Focus: imprint field not autofocused, focus lost after adding | accessibility | open |
| T-40 | P2 | Fictional demo PZNs may collide with real products | pharmacist | open |
| T-41 | P2 | Print text extraction splits ligatures ("Wirksto ff") | accessibility | open |
| T-42 | P2 | iOS checks and PWA tests are not paired one to one | skilled user, deploy | open |
| T-43 | P2 | Xcode project, target and folder still named `PillSnap` | deploy | open |
| T-45 | P1 | Verify Vercel deploys teammates' commits on the public repo | deploy | open |
| T-46 | P2 | Screenshots in `docs/screens` predate the rename and the mascot | skilled user | open |
| T-48 | P2 | PWA: tap a pill picture → popup with the pill large (iOS has `PillPopup`) | patient | open |
| T-49 | P2 | PWA precaches pdf.js (~1.8 MB) for an optional feature | skilled user | open |
| T-50 | P2 | Leaflet link points to a commercial pharmacy CDN: check its terms | pharmacist | open |
| T-47 | P1 | Impressum and Datenschutz still have placeholder name, address and e-mail | site | open |
| T-51 | P0 | BMP code that breaks the 2.8 contract is read anyway | physician, pharmacist | fixed (web + iOS) |
| T-52 | P0 | Incomplete multi-page plan could be adopted and then looked complete | physician | fixed (web; iOS refuses multi-page) |
| T-53 | P0 | Picked leaflet PDF accepted for another product with the same substance | pharmacist | fixed (web; iOS n/a) |
| T-54 | P1 | Leaflet finish (matte/glossy) inferred from the coating | pharmacist | fixed for leaflet looks; other sources open |
| T-55 | P1 | Android: camera capture stays in the app cache | site, privacy | fixed in source; APK not rebuilt |
| T-56 | P0 | Site: unqualified "Kein Medizinprodukt", certainty and photo-identity claims, privacy notice gaps | site | fixed (texts) |
| T-57 | P1 | Printed row numbers are not a stable medicine reference | physician, pharmacist | open |

---

## P0: before the Sat 11:00 freeze, demo-breaking or safety

### T-01 Home screen timers double every minute, app freezes (skilled user, verified)

**Status (14 Nov): fixed in the web app.** One module-level `setInterval` redraws only `section.day` in place (scroll kept); `Home()` starts no timer. Check: `pwa/tests/pwa.test.js` "one timer for the day list (T-01)". Still to do: a Playwright run with a fake clock over 15 minutes; the install callbacks still call `render()`.

**Problem.** `Home()` starts a 60 s `setInterval` at `js/app.js:85` and pushes its `clearInterval` into `cleanup`. The interval calls
`render()` (`js/app.js:35`), which builds `Home()` again and starts another interval. `cleanup` only runs in `go()`, not in `render()`.

- The interval count doubles every minute: 1, 2, 4 … 255 renders at minute 8.
- One render takes ~43 ms at 6× CPU throttling, so a phone hangs around minute 10–12.
- `render()` also scrolls to the top every minute (`js/app.js:39`).
- `watchInstall(() => render())` (`js/app.js:762`) and the install card's "Später" (`js/install.js:25`) re-render the same way.

A demo phone left on the home screen before the pitch will freeze.

**Fix.**
- Start one interval at module level: `setInterval(() => { if (route.name === "home") refreshDay(); }, 60_000)`.
- `refreshDay()` replaces only the `section.day` node and keeps `scrollY`.
- Remove the timer from `Home()`. Make the install callbacks call `refreshDay()` or re-render without `scrollTo`.

**Test.** Playwright with a fake clock (`page.clock.install()`), advance 15 min on home. Expect the render count to equal the minute
count and the scroll position to be unchanged.

### T-02 Double-tap on a "back home" button leaves the app (skilled user, verified)

**Problem.** `home()` calls `history.back()` when `history.state.pill` is set (`js/app.js:33`). Two quick taps call it twice before
`popstate`, which goes back two entries. A double-tap on "Verwerfen" or "Abbrechen" landed on `docs/landing.html`. This affects every
button that uses `home`.

**Fix.** Guard with a `leaving` flag. Set it in `home()`, ignore further calls until `popstate`, and clear it there. Alternatively,
drop `pushState`/`back` and use `history.replaceState` plus `go({name:"home"})`.

**Test.** Playwright `dblclick` on "Verwerfen" in the pack result. Expect still `/pwa/` and `data-screen="home"`.

### T-03 Generic switch or combination pack shows as "Nicht auf Ihrem Plan!" with Add (pharmacist, verified)

**Problem.**
- `Pack.evaluate` (`js/pack-code.js:123-124`) matches the substance by exact lower-case string.
- In the hackathon repo's full PZN list, 19,290 of 36,953 rows have an empty substance (this repo ships a 93-row demo excerpt).
- The list drops salt names ("Metoprolol" vs the catalog's "Metoprololsuccinat").

So every non-catalog generic of a plan drug falls through to `notOnPlan` (`js/pack-code.js:141`), and `canAdd` offers "Zu meinem Plan
hinzufügen". Examples: METOHEXAL SUCC vs plan Metoprololsuccinat (demo scene S3), Levothyroxin 50 µg (174 packs), Metformin 500
(241), MTX (32), Pregabalin.

A Ramipril/HCT pack vs plan Ramipril also gives `notOnPlan`. The spoken text says "Neu verordnet? Dann fügen Sie es hinzu"
(`js/app.js:559`).

**Consequence.** Duplicate levothyroxine, MTX or beta-blocker entries on the home screen (INV-20).

**Fix.**
1. Match on ATC (catalog `atc`) where known.
2. Otherwise match on a normalised substance: strip salt and hydrate words (succinat, tartrat, natrium, hydrochlorid, …).
3. Otherwise match on name tokens of the PZN-list name against plan substances.
   ATC and salt normalisation only find candidates; they never make two products interchangeable (ATC is a classification, and
   normalising can hide a real difference). The result stays "ask the pharmacy", never "same medicine".
4. If the substance is still unknown, return a new kind `askPharmacy` ("Diese Packung kennt die App nicht genau – bitte Apotheke
   fragen") with no Add button.
5. A pack whose name contains a plan substance plus another one is `sameSubstance` with difference "Kombinationspräparat".
6. Remove "Neu verordnet? Dann fügen Sie es hinzu" (see T-08).

**Test.** New cases in `tests/checks.test.js`:
- a METOHEXAL SUCC PZN against a plan with Metoprololsuccinat 47,5 mg → not `notOnPlan`;
- a name-only L-Thyroxin 50 µg PZN against Levothyroxin 75 µg → `sameSubstance`;
- a Ramipril/HCT PZN against Ramipril → `sameSubstance`.

### T-04 Pill photo: "anderer Hersteller" ignores strength (physician, verified with catalog looks)

**Status (14 Nov): fixed, web + iOS.** `other_maker` only for the same substance **and** strength; another or unknown strength, or only a shared ATC code → `other_strength` with the look-alike's own title. Checks (both): "Pregabalin 300 mg look on plan A (75 mg) → other_strength …", "no catalog look of another strength of a plan A drug gives other_maker".

**Problem.** `Matcher.answer` (`js/matcher.js:96-106`) sets `other_maker` when the best catalog hit has the same substance as a plan
entry, whatever its strength. The result screen then prints the plan entry's title (`js/app.js:333-337`).

- Pregabalin 300 mg → "Pregabalin 75 mg – anderer Hersteller".
- L-Thyrox 50 µg → 75 µg; Atorvastatin 40 mg → 20 mg.
- A yellow round Bisoprolol 1A without an imprint → "Wahrscheinlich: Methotrexat 7,5 mg".

The pack path does check strength (`js/pack-code.js:126-139`).

**Fix.**
- `other_maker` only when `norm(best.med.strength) === norm(m.strength)`.
- Otherwise return the new state `other_strength`: banner "Anderer Wirkstoffgehalt als auf Ihrem Plan – bitte Apotheke fragen",
  showing the catalog hit's own title, never the plan's.

**Test.** Matcher unit tests with the cues of a Pregabalin 300 mg catalog look against plan A → state `other_strength`.

### T-05 White pills: one "Wahrscheinlich" pick among four look-alikes (photo→PZN, verified)

**Status (14 Nov): fixed, web + iOS.** Without a read imprint and a size, every colour-fitting (≥ 0.7) plan pill whose shape isn't clearly different stays a candidate; `choose` shows up to 6. Check (both): "off-white oval, no imprint, size unknown → choose, Metformin among the candidates". Open: the "Kein Aufdruck" / "Kann ich nicht lesen" split.

**Problem.** The bundled demo photo `examples/nlm-metformin-2.jpg` (pill mode, "Kein Aufdruck") returns **"Wahrscheinlich – bitte
prüfen: Atorvastatin 20 mg"**.

- The cues are off-white, oval.
- Plan A has four white pills: Atorvastatin oval 0.84, and Ramipril, Metformin and Ibuprofen oblong 0.65.
- The close margin is 0.15 (`js/matcher.js:72`), so only Atorvastatin is "close", giving `likely` (`js/matcher.js:84-88`).
- Size isn't measured. The iPhone eval returned `choose` for the same photo.
- "Kein Aufdruck" (`js/app.js:204`) means both "has no imprint" and "can't read it".

A juror tapping the metformin example sees the wrong drug.

**Fix.**
- When the imprint is unread or not given and size is unknown, put every plan entry whose colour matches (≥ 0.7 colour similarity)
  into `close`, and return `choose` when there are ≥ 2.
- Split the button into "Kein Aufdruck" and "Kann ich nicht lesen". The latter counts as unread. "Kein Aufdruck" scores against
  looks with an imprint at −0.5.

**Test.** The recogniser cues for `nlm-metformin-2.jpg` against plan A → `choose` with Metformin among the candidates (add to
`tests/recognizer.test.js` or a new matcher test).

### T-06 Day view can cause a skipped or doubled dose (physician, verified with fake clock)

**Status (14 Nov): fixed, web + iOS.** Sections carry `past` and `lastNight`; `tomorrow` is always false. Headers "Heute vorbei · Morgens" and "Nachts · seit gestern Abend"; "Die App merkt sich nicht, was Sie schon genommen haben." under the heading and at the end of the read-aloud. Checks (both): "11:05 → …", "00:30 → …", "18:30 → night later today, morning earlier today (past, never tomorrow)" (replaced "… morning tomorrow", which asserted the defect).

**Problem.** Slots are morning 4–11, noon 11–15, evening 15–21, night 21–4 (`js/model.js:54-60`). Slots already past come back as
`tomorrow` (`js/model.js:86`).

- At 11:05, seven morning drugs (torasemide, bisoprolol …) show under **"Morgen · Morgens"**. A patient who hasn't taken them yet
  reads "tomorrow" and skips them.
- From 00:30 to 04:00, "Jetzt · Nachts" shows the bedtime pregabalin again (`afterMidnight`, `js/model.js:72`), which invites a
  second dose.
- Nothing on screen says the app doesn't record intake.

**Fix.**
- Today's past slots stay in today's list until 04:00, labelled "Heute morgens · vorbei (bitte selbst prüfen)" in small type, not
  "Morgen".
- Between 00:00 and 04:00, label the night slot "Heute Nacht (seit gestern Abend)".
- Add a fixed line under "Meine Tabletten": "Die App merkt sich nicht, was Sie schon genommen haben."
- Read-aloud (`spokenWhen`, `js/model.js:152`) follows the same labels.

**Test.** `sections()` unit tests at 11:05 (morning entries with `past: true`, not `tomorrow`) and at 00:30 (night labelled
`lastNight`); Playwright screenshot.

### T-07 Demo plan A is clinically implausible (pharmacist + physician, verified)

**Problem.** `ios/PillSnap/Examples/plans/plan-a.xml` (copied to `pwa/examples/`) is a single plan for an elderly heart patient. It has
Diclofenac 75 retard 1-0-1, Ibuprofen 400 as needed, ASS 100, MTX, Ramipril and Torasemid: two NSAIDs, the "triple whammy"
(ACE inhibitor + diuretic + NSAID), MTX with NSAIDs, and PRISCUS drugs. Pharmacist and physician jurors will spot it in seconds.

**Fix.**
- Rebuild plan A from the Erika M. persona ([PRD scanner app](docs/PRD-scanner-app.md) §2), or at least remove Diclofenac and Ibuprofen and use
  paracetamol as needed.
- Regenerate with `tools/make-plan-codes.py` (XSD 2.8-valid, ≤ 1400 bytes), then run `npm run sync`.
- Update the expectations in `tests/checks.test.js` and `ios/checks/main.swift`, the landing page day view, and the README screenshots.

**Test.** `npm test`; validate the XML against `tools/bmp/bmp_V2.8.xsd` with `xmlschema`.

### T-08 INV-15/16/19 wording still in the PWA (pharmacist + physician, verified)

**Status (14 Nov): fixed in both apps.** Banner "Passt zu Ihrem Plan – bitte prüfen" for `sure`; "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern." replaces the tablet-handling lines; "Neu verordnet? …" removed. Check (web): "no tablet handling, sameness or splitting wording in app texts". Open: the add button's label ("Auf meine eigene Liste"), and the screenshots (T-46).

**Problem.**
- INV-15: "Ihre Tablette" as identity from appearance (`js/app.js:301`, `:303`).
- INV-16: "In der Apotheke prüfen lassen. Nicht doppelt einnehmen." (`js/app.js:337`) and "Nicht einnehmen, bevor Apotheke oder Arzt
  Bescheid wissen." (`js/app.js:379`) instruct tablet handling.
- INV-19: "Zu meinem Plan hinzufügen" (`js/app.js:620`) plus the spoken "Neu verordnet? Dann fügen Sie es hinzu" (`js/app.js:559`)
  present a patient edit as a regimen change.

**Fix.**
- `sure`: "Sieht aus wie Ihre …, bitte prüfen". (`confirmed`, a card opened from the list, already says "Auf Ihrem Plan".)
- Replace the instructions with the actor only: "Bitte mit Apotheke oder Praxis klären, bevor Sie etwas ändern."
- Rename the button "Auf meine eigene Liste (kein ärztlicher Plan)" and delete the "Neu verordnet …" sentence.
- Add a text check test that fails on "nicht einnehmen", "doppelt", "nehmen Sie" in `js/*.js` strings (cheap INV-16 checker).

**Test.** The new string test plus `npm test`.

### T-09 Old build after a redeploy; saved meds keep stale looks (skilled user + deploy, suspected)

**Problem.**
- The service worker is cache-first (`sw.js:68-76`). After a deploy, `skipWaiting` (`sw.js:59`) activates the new worker, but the open
  page keeps the old modules until a reload, and nothing prompts for one. The first open of a demo phone after the Saturday morning
  deploy shows the old build.
- `Store.adopt` saves full catalog objects, look included, in `myMeds` (`js/store.js:42`). Catalog look fixes never reach an
  already-imported plan.

**Fix.**
- In `app.js`, on `navigator.serviceWorker.oncontrollerchange`, show a banner "Neue Version – tippen zum Neuladen", or reload when on
  home.
- On `store.load()`, refresh each saved med's catalog fields (name, look) by PZN from `catalog.json`, keeping the plan's own
  `schedule`, indication (`r`), notes and extra line – never replace plan data with catalog defaults.
- Demo checklist: open the app twice on every demo phone after the last deploy.

**Test.** Playwright: load with the cache at `v7`, bump `VERSION`, reload once and expect the banner. Unit-test the refresh in
`store.load()`.

## P1

### T-10 Spoken confirmations are cut off (skilled user + accessibility, verified)

**Problem.** `say(...)` is followed immediately by `home()` → `go()` → `stop()` (`js/app.js:23`, `:250`, `:494`, `:534`, `:613`,
`:622`). "12 Medikamente übernommen." started at t=6793 ms and was cancelled at 6799 ms. Seniors relying on the voice get nothing.

**Fix.** Pass the sentence through the route: `go({ name: "home", announce: "…" })`, and `say(route.announce)` after `render()`.

**Test.** Stub `speechSynthesis` in Playwright and assert the utterance isn't cancelled within 1 s.

### T-11 "Fertig" in typed entry wipes no-picture entries; "Ohne Bild" rows are dead (skilled user, verified)

**Problem.**
- `ManualPlan` "Fertig" calls `store.adopt({ meds, unknown: [], unknownPZNs: [] })` (`js/app.js:533`). After adding a pack without a
  look (e.g. Cefaclor), "Fertig" deletes it.
- The "Ohne Bild" rows (`js/app.js:146-150`) are plain `div`s: not tappable, not removable.

**Fix.**
- Carry the existing `store.unknownPZNs` through (or the look-less entries in `myMeds`, after the current change).
- Render no-picture rows as buttons that open a card with name, form, schedule and "Von meiner Liste entfernen" (own entries only, see T-14).

**Test.** Playwright: add a Cefaclor pack → typed entry → "Fertig" → still listed.

### T-12 Typed entry is a dead end outside the catalog (skilled user, verified)

**Problem.** Typing "Apixaban" shows "Nicht im Katalog – bitte anders schreiben." (`js/app.js:473`). Only the 108 catalog products can
be entered.

**Fix.** When there are no catalog hits, search `pzn-names.json` names (prefix and contains, max 6). Picking one adds a look-less entry
with its dose-form outline. If nothing matches, offer "Nur mit Namen eintragen (ohne Bild)".

**Test.** Typed "Apixaban" → at least one suggestion; adding it shows the entry with "Aussehen unbekannt".

### T-13 Typed and added amounts default to 1 (pharmacist + physician, verified)

**Status (14 Nov): fixed, web + iOS** by not asking: typed entry stores the times only; whenText says "(Menge nicht angegeben)", the day list "Menge nicht angegeben", the card and print "?". Check (web): "no amount on the plan → no number in the dosing text" (iOS: `whenText` lives in `Theme.swift`, outside the macOS checks). Open: an optional amount stepper.

**Problem.**
- `add()` writes amount 1 for every picked slot (`js/app.js:487`).
- Weekly and as-needed entries get no amount (`js/app.js:483-484`).
- `whenText` falls back to `?? 1` (`js/model.js:120`).

The patient never says how many, so the app invents a dose.

**Fix.**
- After picking a slot, show an amount stepper (½, 1, 1½, 2, other) per slot; there's no default until tapped.
- `whenText` shows "Menge nicht angegeben" when the amount is missing.

**Test.** Unit: `whenText` with an empty `amounts` → no number. Playwright: "Hinzufügen" disabled until an amount is set.

### T-14 Patient list drifts from the BMP (physician, verified)

**Problem.**
- Typed entry starts from `store.myMeds` (`js/app.js:453`) and its remove buttons (`js/app.js:479`) can delete prescribed BMP
  entries.
- Added items are mixed in unmarked.
- There's no "Stand: Plan vom …", so the patient can't tell what came from the physician.

**Fix.**
- Add `origin: "plan" | "self"` to each saved med: set by `adopt()` from a scan, and by typed entry or pack add.
- Plan entries can't be removed in typed entry.
- Self entries show the tag "selbst eingetragen" in the day view, card, print and read-aloud.
- Show the scan date ("Plan eingelesen am …") from the adopt time. The plan's own date `A/@t` sits inside the `A` element, which the
  privacy boundary skips; showing it needs a team decision (add to `docs/DECISIONS.md` together with T-32).

**Test.** Unit: `adopt` marks `plan`, `add` marks `self`. Playwright: a plan entry has no remove button.

### T-15 A user's "Apotheke hat bestätigt" tap becomes identity (pharmacist, verified)

**Status (14 Nov): mitigated, web + iOS.** The take-over ("Apotheke hat bestätigt" → "Neues Aussehen übernehmen") is removed and `Store.takeOver` deleted; the "dasselbe Medikament" sentence is gone. Check (web): "a person's tap never replaces the plan's product (T-15)". The `pending` design below stays the way to bring it back.

**Problem.**
- The patient's own tap (`js/app.js:615`) runs `store.takeOver` (`js/store.js:58-63`), which replaces the plan entry's PZN and look
  for good.
- `spoken()` then says "Die Tablette sieht neu aus, es ist aber dasselbe Medikament." (`js/model.js:131`), a sameness claim no
  professional made (INV-15, INV-20).

**Fix.**
- Keep the plan PZN.
- Store the new pack as `pending: { pzn, look, confirmedBy: "patient", at }` on the entry.
- The card shows both looks: "Neue Packung – laut Ihnen von der Apotheke bestätigt".
- Delete the "dasselbe Medikament" sentence.

**Test.** Unit: after `takeOver`, `pzn` is unchanged and `pending.pzn` is set; the spoken text has no "dasselbe".

### T-16 INV-21 substitution-exclusion flag missing (pharmacist, verified)

**Problem.** The catalog has no `de_substitution_excluded` flag. A levothyroxine maker switch gets the routine "Gleicher Wirkstoff,
andere Packung … sagt Ihnen Ihre Apotheke". Today it often lands in `notOnPlan` instead (T-03).

**Fix.**
- Add `substitutionExcluded: true` for ATC H03AA01 and the other G-BA substitution-exclusion list substances in the catalog (via
  `tools/add-leaflet-looks.py`).
- In `evaluate`, `otherMaker` on such a substance → kind `unexpectedSwitch`, banner "Unerwarteter Herstellerwechsel – bitte Apotheke
  oder Praxis fragen", with no take-over button.

**Test.** A levothyroxine pack of another maker against a plan levothyroxine → `unexpectedSwitch`.

### T-17 Strength match ignores dose-form family and concentration (pharmacist, verified)

**Problem.**
- `release()` (`js/pack-code.js:150-155`) only knows gastro-resistant and retard.
- `nameStrength` (`js/model.js:197-204`) drops "/ML".
- Escitalopram 20 mg/ml drops counts as "dieselbe Stärke" as a 20 mg tablet, and Sortis chewable (KTAB) matches film tablets (FTBL).

**Fix.**
- Compare `doseForm(form).family` (tablet / capsule / liquid / …) and keep the concentration unit in `nameStrength` (`20 mg/ml`).
- A different family or a concentration-vs-absolute mismatch → `sameSubstance` with difference "andere Darreichungsform".

**Test.** Unit tests with Escitalopram drops vs tablets and KTAB vs FTBL.

### T-18 Other pack size of the same product shows as "andere Packung" (pharmacist, verified)

**Problem.** `evaluate` looks for `m.pzn === c.pzn` only (`js/pack-code.js:119`). The catalog's `pzns` (other pack sizes) are ignored,
so a 100-pack of the plan's 30-pack product gives "Gleicher Wirkstoff, andere Packung".

**Fix.** `const mine = myMeds.find((m) => m.pzn === c.pzn || (m.pzns ?? []).includes(c.pzn));` → `onPlan`.

**Test.** A pack with a sibling PZN from `pzns` → `onPlan`.

### T-19 1D PZN barcode fails on carton photos (photo→PZN, verified)

**Problem.** `scanCode` scales every photo to 2400 px on the long edge before decoding (`js/vision.js:71`). A Code 39 PZN barcode
(Aspirin N, non-prescription) on a carton photographed at a normal distance fails at 1600, 2400 and 3200 px, and decodes only at the
full 4032 px. DataMatrix codes are unaffected: they decoded rotated 12°, skewed, with glare, EXIF-rotated, at JPEG quality 35 and small.

**Fix.**
- In `scanCode`, if the 2400 px pass finds nothing, run a second pass at full resolution (cap 4096; ~0.6 s).
- Alternatively, run a second pass on a full-resolution centre crop of 60%.
- Show "Bitte näher heran" when both fail.

**Mitigated (iPhone + Android app):** when no code decodes, the printed "PZN 12345678" is read by OCR (`PackCode.fromText`, check
digit required). The browser still needs the second pass below.

**Test.** A generated carton photo (Code 39 at ~11% of frame width, 4032×3024) decodes to PZN 05387239. The generator is in the
review scratch scripts (`make_photos.py`); copy it to `pwa/tests/fixtures`.

### T-20 Photo of a whole plan sheet never decodes (photo→PZN, verified)

**Problem.** A photographed A4 plan (page ~2600 px wide in a 3024×4032 photo, 5° rotation, slight blur) gives no plan code at any
resolution. Close-ups decode at 20–45% of frame width. The example caption "Gedruckter Plan A … (ganze Seite)" suggests whole-page
photos work.

**Fix.**
- Make the `no_plan_code` text (`js/app.js:390`) say "Näher heran: nur den Code oben rechts fotografieren, er soll das Bild füllen".
- Add a second pass on the full-resolution top-right quadrant.
- Change the example caption to say it's a clean scan.

**Test.** A generated full-sheet photo → either decodes via the quadrant pass or shows the new text.

### T-21 Fake "Packungsbeilage wird gelesen …" animation (photo→PZN + pharmacist, verified)

**Problem.** Plan import and pack results show "Aussehen wird nachgeschlagen" and "Packungsbeilage wird gelesen …" with 750 ms or
250 ms pauses per row (`js/app.js:258-266`, `:275`): about 5 s for 12 meds. The network log shows **no request**. The looks come from
bundled `catalog.json`. Only the iPhone app does a live leaflet lookup (`LeafletOnline.swift`). A pharmacist or juror will ask.

**Fix.**
- Drop the per-row delay, or keep at most 150 ms as a reveal.
- Reword to "Aussehen aus der Packungsbeilage (in der App gespeichert)".
- The status line says "gespeichert", never "wird gelesen".

**Test.** Playwright: the plan result appears in < 1.5 s for plan A; no "wird gelesen" string in `js/app.js`.

### T-22 Malformed saved data locks the app for good (skilled user, verified)

**Problem.** `load` only checks that the saved value is an array (`js/store.js:12`). An entry from an older version (missing `look` or
`schedule`) throws in rendering (TypeError in `ui.js`). The boot catch shows "Daten konnten nicht geladen werden … neu laden"
(`js/app.js:771`). Reloading never helps, and there's no reset.

**Fix.**
- Validate each saved med on load (pzn string, substance string, schedule shape, look object or null) and drop invalid ones with a
  console warning.
- Add a "Gespeicherte Liste löschen und neu beginnen" button to the error screen.

**Test.** Unit: `localStorage.myMeds = '[{"pzn":"1"}]'` → app boots to onboarding.

### T-23 Misleading error messages; "Nochmal" goes home (skilled user, verified)

**Problem.**
- An undecodable image (corrupt file, or HEIC on Android Chrome) throws `EncodingError` in `bitmap()` (`js/vision.js`), but the user
  sees "Ich finde keinen Code …" or "Ich sehe keine Tablette".
- A URL QR code in pack mode also says "keinen Code".
- "Nochmal" on result screens calls `home` (`js/app.js:339`, `:382`, `:405`) instead of reopening the camera.

**Fix.**
- New problems `image_unreadable` ("Das Foto kann ich nicht öffnen – bitte als JPG aufnehmen") and `other_code` ("Das ist kein
  Packungs-Code"), set in `Analyzing`.
- "Nochmal" calls `takePhoto(source, mode)` with the same mode.

**Test.** Playwright with a corrupt JPEG and a URL QR in pack mode → the matching texts; "Nochmal" opens a file chooser.

### T-24 Hinweise and meal tags missing in day view and read-aloud (physician, verified)

**Problem.**
- The day rows (`js/app.js:136-144`) and `spokenLines` (`js/model.js:165-186`) show no Hinweis.
- "Jetzt, heute früh. Sieben Medikamente." lumps levothyroxine ("nüchtern, 30 min vor dem Frühstück") with metformin ("zu den
  Mahlzeiten").
- Meal tags are shown in the PWA day rows (`mealLine`, PR #9) with the negation fix of this change, but the Hinweis text itself is not.

**Fix.**
- Show the verbatim Hinweis (one line, clamp 2) under each day row, next to the meal tag.
- `spokenLines` reads "Levothyroxin, nüchtern, 30 Minuten vor dem Frühstück" per entry.

**Test.** Unit test on `spokenLines` for plan A morning; Playwright screenshot.

### T-25 Contrast below 4.5:1 (accessibility, verified with axe-core, light and dark)

**Problem.**
- White text on the morning slot colour `#B86A00` (`js/model.js:13`, used in `sectionHeader` `js/app.js:111` and `.slot-label`)
  is **4.11:1**.
- "Off" slot labels `.slot.off` (`app.css:230`, `color-mix(… 55%, transparent)`) are **2.45:1** in light (`#A5A5A9` on white) and
  **3.02:1** in dark (`#67676C` on `#1C1C1E`).
- Unselected time buttons in dark mode use the slot colour as text (`js/app.js:509` `style: { color: s.hex }`), ~**2:1** for "Nachts".

All appear on every card and every result.

**Fix.**
- Morning hex `#9A5B00` (= the existing `--warn-fill`, 5.4:1 with white).
- `.slot.off { color: var(--muted) }` with solid `#6E6E73` light (5.1:1) and `#8E8E93` dark (5.2:1). Mark "off" with the "–" text,
  not by fading.
- Slot buttons: text in `var(--text)`, slot colour only on the icon and border.

**Test.** An axe `color-contrast` run on home, detail and the slot picker in both colour schemes → 0 violations; add it as a
Playwright check.

### T-26 200% zoom: sideways scroll, names cut to "M…" (accessibility, verified)

**Problem.**
- `.bar-title` can't wrap (`app.css:91`), so the page scrolls sideways at 195 px viewport width.
- Plan-import cards cut names with an ellipsis (`app.css:101`), so Metformin and Methotrexat both show as "M…".
- Day rows cut long names (`app.css:170`, "Hydrochlor…").

**Fix.**
- Remove `white-space: nowrap`/`text-overflow` on these and use `overflow-wrap: anywhere; hyphens: auto` (the page is `lang="de"`).
- Make `.grid3` responsive: `repeat(auto-fill, minmax(9rem, 1fr))`.

**Test.** Playwright at 195 px width: `scrollWidth <= innerWidth`; the plan-A import shows full names.

### T-27 "Eigene Fotos" is off-screen, the only gallery path on Android (skilled user + accessibility, verified)

**Problem.** The Examples header (`js/app.js:661-666`) puts a long title ("Beispielpackungen") and the round "Eigene Fotos" button on
one line. The button ends at x=487 on a 320 px screen. `capture="environment"` on `#camera` forces the camera on Android, so this
hidden button is the only way to pick an existing photo.

**Fix.**
- Add a "Aus Fotos wählen" tile to `photoSourceSheet` and `planSourceSheet` (`js/app.js:64-75`) using `takePhoto("library", kind)`.
- Let the Examples title wrap.

**Test.** Playwright at 320 px: the tile is visible and opens a file chooser without `capture`.

### T-29 iOS: `PlanReader.swift` needs the PWA BMP 2.8 reading fixes (physician + pharmacist, suspected; iOS can't be built here)

**Status (14 Nov): partly fixed.** iOS now has no substance fallback, keeps all `<W>`, keeps the weekly dose, refuses codes that break BMP 2.8 and refuses multi-page codes (it can't merge them). Still open: look-less lines keep no schedule (iOS `Med.look` isn't optional), `t`/`du`/`dud`/`r`/`x`, sections 412–424, `X`/`R`, page merge, and a specific "Plan-Code fehlerhaft" message instead of "kein Medikationsplan".

**Problem.** The same defects as fixed in the PWA now:

- only the last `<W>` is kept (`ios/PillSnap/PlanReader.swift:106`);
- substance fallback overwrites the plan PZN and look (`:36-40`);
- weekly amounts are dropped when `wo` is set (`:89` path);
- `t`, `du`/`dud`, `r`, `x`, sections 412–424, `X`/`R` and multi-page `U/a/z` are not read;
- look-less entries lose their schedule.

**Fix.** Port the PWA's new `plan-reader.js` and `model.js` logic line by line; mirror the new PWA tests into `ios/checks/main.swift`.

**Test.** `ios/checks/run.sh` on macOS.

### T-30 iOS: print writes a BMP 2.8 code from the patient list; old layout (pharmacist + physician, verified in code)

**Problem.**
- `BmpWriter.swift` writes a schema-shaped BMP code from the phone's list: issuer `A n="BlisterKompass"` (`:11`), weekly always `m="1"`
  (`:56-57`), the catalog's lay purpose as `r`, and Hinweise dropped to fit 1400 bytes.
- `PlanPrint.swift` titles it "Medikationsplan", puts the colour picture column inside the BMP table, and says "Originalgröße" for
  default 8 mm drawings (footer `:106`).

A pharmacy scanning it would import a patient-edited list as a professional plan (D-09: no BMP code from the phone's list).

**Fix.** Mirror the PWA print change: no generated code, title "Meine Medikamente mit Bildern", plus the [PRD print sheet](docs/PRD-print-sheet.md) §5 sizes, source lines,
"Größe unbekannt" and slot words. Keep `BmpWriter` only for tests, or delete it.

**Test.** `ios/checks/run.sh`; a visual check of a printed PDF.

### T-31 iOS: `MealTiming.swift` inverts negations (pharmacist + physician, verified)

**Status (14 Nov): fixed (iOS).** `MealTiming.from` returns nil for "nicht", "kein", "Abstand", "oder", "unabhängig", "egal", as the web app's `meal()`. Check: "meal: 'nicht zu den Mahlzeiten', 'Abstand zum Essen', … give no tag".

**Problem.** `ios/PillSnap/MealTiming.swift:43` only excludes "unabhängig", "nicht nüchtern" and "egal":

- "nicht zu den Mahlzeiten" / "nicht mit dem Essen" / "Abstand zum Essen 2 h" → "zum Essen";
- "nicht auf nüchternen Magen" → "nüchtern";
- "1 Std. vor oder 2 Std. nach dem Essen" → "nach dem Essen".

**Fix.** Port the PWA's fixed `meal()`: no tag if the text contains "nicht", "kein", "Abstand", "oder" or "unabhängig"; match whole
phrases only.

**Test.** Add the six wordings above to `ios/checks/main.swift`; expect `nil`.

### T-32 Decision: may the patient app reprint the original BMP code bytes? (pharmacist, open)

**Question.** The plan review behind [PRD print sheet](docs/PRD-print-sheet.md) §5.3 wanted the picture sheet to carry the identical BMP
code of the physician's plan. The PWA can't do that without
storing the scanned XML, which contains `P` (name, birth date, eGK number), `A` and `O`. That breaks "nothing personal is stored".
The current change prints no code at all.

**Options.**
- (a) No code on patient prints (current).
- (b) Store the original bytes encrypted on the device with explicit consent, and reprint only if the list is unchanged.
- The former option (c), "only the physician end prints it", is gone: there is no physician app (D-12).

Logged in `docs/DECISIONS.md`. Blocking only for putting a code back on the patient print.

## P2

### T-33 Other-maker screen hides the scanned PZN (photo→PZN, verified)

**Problem.** `compare()` (`js/app.js:643-652`) shows maker names and looks but no PZN. On the phone with a nurse or pharmacist, the
PZN is the identifier they ask for. Other pack screens show `PZN …` via `productCard`.

**Fix.** Add `h("div.mono.small", null, \`PZN ${r.code.pzn}\`)` under "Diese Packung", and the plan entry's PZN under "Auf Ihrem Plan".

**Test.** Playwright: `pack-18342014.png` → the text contains "PZN 18342014".

### T-34 PPN mod-97 and NTIN check digits not verified (pharmacist, verified)

**Problem.** `parseIFA` takes the PZN from PPN `11…` without checking the PPN's two-digit mod-97 check (`js/pack-code.js:44`).
`parseGS1` and `parseIFA` take it from NTIN `04150…` without checking the GTIN mod-10 digit (`:45`, `:74-77`). Only the PZN check
digit is verified, which still catches most misreads.

**Fix.** Implement the IFA PPN check (ASCII values weighted 2,3,4…, sum mod 97) and the GTIN-14 mod-10 check, and reject on failure.

**Test.** The official IFA/GS1 vectors already inlined in `pwa/tests/checks.test.js` and `ios/checks/main.swift`, plus a corrupted copy of each.

### T-35 Expiry text drops a coded day (pharmacist, verified)

**Problem.** `expiryText` (`js/pack-code.js:91-95`) shows "03/2028" for `280315`, but the pack expires on 15 March 2028. `isExpired`
handles the day correctly.

**Fix.** `dd !== "00"` → "15.03.2028"; else "03/2028".

**Test.** Unit tests for `280315` and `280300`.

### T-36 Score-line question says "zum Teilen" (pharmacist, verified)

**Status (14 Nov): fixed, web + iOS.** The question reads "Hat die Tablette eine Kerbe oder einen Strich?". Checks: "score-line question says nothing about splitting (INV-14)" (both) and the web string test.

**Problem.** The matcher's question reads "Hat die Tablette einen Strich in der Mitte (zum Teilen)?" (`js/matcher.js:119`). MTX HEXAL
10 mg (PZN 03159468) has `look.score: "single"`, but its leaflet says "Die Kerbe dient nicht zum Teilen der Tablette." A score line
never means "may be split" (INV-14).

**Fix.** Ask "Hat die Tablette eine Kerbe oder einen Strich?" with no purpose. Optionally add `look.scoreForSplitting: false` from the
leaflet text and show "Kerbe nicht zum Teilen" on the card.

**Test.** A string test that "zum Teilen" doesn't occur in `js/`.

### T-37 "Verwerfen" with a trash icon (skilled user, verified)

**Problem.** The pack result's last button is "Verwerfen" with a trash icon (`js/app.js:625`). Under "Abgelaufen" it reads like
"throw this medicine away", a handling instruction (INV-16).

**Fix.** Title "Fertig", icon `check` (or "Schließen" with `x`).

**Test.** A string test: no "Verwerfen" in `js/app.js`.

### T-38 "Aussehen antippen" tile still on the PWA home screen (skilled user + physician, verified)

**Problem.** iOS dropped the tile in `e457c8f`; the PWA still shows it (`js/app.js:106`). The apps diverge.

**Fix.** Remove the tile. The picker stays reachable from the "Antippen" button on the retake screen (`js/app.js:407`).

**Test.** Playwright: home has no "Aussehen antippen".

### T-39 Focus: imprint field not autofocused, focus lost after adding (accessibility, verified)

**Problem.** The imprint input in `Analyzing` (`js/app.js:197`) has no `data-autofocus`. After adding a typed entry, `draw()` rebuilds
the screen and focus is lost.

**Fix.** `input.focus()` after `set(below, …)`; in `ManualPlan` focus the search input after `draw()`.

**Test.** Playwright: `document.activeElement` is the input in both cases.

### T-40 Fictional demo PZNs may collide with real products (pharmacist, suspected)

**Problem.** The demo products (Rhenus, Nordapharm, Alpinmed, Vitacur, Medivia) use PZNs that pass the check digit. If they match real
products, pharmacy software would show a different medicine.

**Fix.** Check every demo PZN against `pzn-names.json` (and ideally the IFA list). Replace any hit with an unused valid PZN, and
regenerate the plan and pack codes.

**Test.** A test asserting that no catalog `source: demo` PZN appears in `pzn-names.json`. Absence from the Festbetrag list (or the
93-row excerpt) doesn't prove a PZN unassigned: keep demo identifiers visibly synthetic in the UI and the data, never as dispensing
authority.

### T-41 Print text extraction splits ligatures (accessibility, verified on the old PDF)

**Problem.** pdf.js extracts "Wirksto ff" from the PDF header (an "ff" ligature). Screen readers and copy-paste get a broken word.

**Fix.** Add `font-variant-ligatures: none` to the print stylesheet (`.ps-sheet` and the Python sheet CSS).

**Test.** A pdf.js text check of the printed PDF contains "Wirkstoff".

---

**Verified working, no action:**
- DataMatrix pack photos decode to the correct PZN in ~1.2 s, including rotated, skewed, glare, EXIF-rotated, JPEG quality 35 and small codes.
- Plan-code close-ups decode.
- Offline after one visit: plan, pack, PZN list and pill flows all work in flight mode.
- No request leaves the origin.
- Text is ≥ 15 px and every touch target is ≥ 44 px on all screens.

### T-42 iOS checks and PWA tests are not paired one to one (skilled user + deploy, verified)

**Problem.** `AGENTS.md` → “Two clients, one product” asks for the same check on both sides, but the suites have drifted.
- `ios/checks/main.swift` has 86 `check(...)` calls. `pwa/tests/checks.test.js` ports 64 of them, so the iOS checks for the
  leaflet parser and online lookup, the meal tags and the print sheet have no counterpart with the same name.
- The 17 BMP 2.8 checks added to the PWA (insulin IE, weekly dose, 424 block, X/R lines, multi-page merge …) have no iOS twin yet
  (T-29).

**Fix.**
- List both suites by check name, for example with a `grep -o 'check("[^"]*"'` on each file and a diff.
- Port the missing checks in each direction under the same name. Where a rule exists on one side only (live leaflet lookup:
  iOS only), mark the check `// iOS only` or `// PWA only` with the reason.
- Add a PWA test that reads `ios/checks/main.swift` and fails when a check name is missing from `checks.test.js` and isn't marked as
  one-sided.

**Test.** The new name-parity test passes; `npm test` and `ios/checks/run.sh` both report the same set of shared names.

### T-43 Xcode project, target and folder still named `PillSnap` (deploy, verified)

**Problem.** The app shows as BlisterKompass (`INFOPLIST_KEY_CFBundleDisplayName`, bundle ID `de.blisterkompass.app`), but
`ios/PillSnap.xcodeproj`, the target and scheme `PillSnap`, the folder `ios/PillSnap/` and `struct PillSnapApp` (`ios/PillSnap/RootView.swift:5`)
keep the old name. Renaming them by editing `project.pbxproj` without Xcode risks a broken project.

**Fix.** On a Mac: rename the project and target in Xcode (Project navigator → rename, accept the scheme rename), move the folder, then
update every `ios/PillSnap/` path (`pwa/scripts/sync.sh`, `pwa/tests/*.js`, `tools/*.py`, `ios/checks/run.sh`, docs) in the same PR.

**Test.** `xcodebuild … build` succeeds; `cd pwa && npm run sync && npm test` passes; `ios/checks/run.sh` passes.

### T-45 Verify Vercel deploys teammates' commits on the public repo (deploy, suspected)

**Problem.** In the private hackathon repo, Vercel's Hobby plan blocked every deployment whose commit author wasn't on the Vercel team,
also for token-based CLI deploys that sent git metadata. The expectation is that the public repo with Vercel's Git integration builds
teammates' commits; this hasn't been seen yet.

**Fix.** After the first merged PR by a teammate, check the Vercel deployment list: state `READY`, not `BLOCKED`. If it is blocked, deploy
from CI with a token instead, from a folder without `.git` (so no author metadata is sent) that contains `.vercel/` and the project's
root directory, and promote with `POST /v10/projects/{projectId}/promote/{deploymentId}`.

**Test.** A teammate's PR shows a ready Vercel preview; after merge, <https://blisterkompass.vercel.app/pwa/sw.js> serves the new `VERSION`.

### T-46 Screenshots predate the rename and the mascot (skilled user, verified)

**Problem.** `docs/screens/*.png` (README, landing page) show the iPhone app before the rename to BlisterKompass, the mascot welcome
screen and the BMP 2.8 day view.

**Fix.** Retake the seven screens on a simulator or from the web app at 390 × 844 (Playwright works), same file names, and check the
landing page's screen section.

**Test.** Visual check of README and `docs/landing.html`.

### T-48 PWA: tap a pill picture → popup with the pill large (patient, iOS done)

**Problem.** On iPhone, tapping a `PillTile` opens `PillPopup` (`ios/PillSnap/PillView.swift`): the pill at 260 pt with colour, shape,
size, score line, imprint, source and leaflet quote; unknown fields say "nicht angegeben". The PWA's `pillTile` (`pwa/js/ui.js`) has
no tap. Tiles inside buttons (day plan rows, `MedTile`, shape picker, suggestions) stay plain on iOS (`zoomable: false`).

**Fix.** `pillTile(look, box, cls, { zoomable })` opens a `sheet` with the same fields and wording; pass `zoomable: false` at the same
places as iOS.

**Test.** A PWA test that the popup lists "nicht angegeben" for a look without size and imprint; iOS check of the same name.

### T-49 PWA precaches pdf.js (~1.8 MB) for an optional feature (skilled user, verified)

**Problem.** `vendor/pdfjs/pdf.min.mjs` and `pdf.worker.min.mjs` are in `PRECACHE` (`pwa/sw.js`): every first visit downloads about
1.8 MB extra, although only people who pick a leaflet PDF need it.

**Fix.** Leave both out of `PRECACHE`, cache them in the fetch handler on first use, and let the "every file precached" test in
`pwa.test.js` allow this one runtime-cached folder.

**Test.** The first load transfers no `vendor/pdfjs/*`; picking a PDF once online, then in flight mode, still works.

### T-50 Leaflet link points to a commercial pharmacy CDN: check its terms (pharmacist, open)

**Problem.** "Beipackzettel öffnen" opens `cdn.shop-apotheke.com/PDF/…` (`pwa/js/leaflet-parser.js`); the iPhone app downloads from the
same host. Fine for the demo, but it's a commercial shop's CDN.

**Fix.** Check the terms before any use beyond the hackathon; otherwise make Apotheken Umschau (or the BfArM/PharmNet portal) the main
link on both clients.

**Test.** Both clients open the chosen host; the PWA host test lists exactly that host.

### T-47 Impressum and Datenschutz have placeholders (site, verified)

**Problem.** `docs/impressum.html` and `docs/datenschutz.html` mark the provider's name, address and e-mail as `.todo` placeholders
("Vorname Nachname", "kontakt@example.de"). A public German site needs them filled (§ 5 DDG, Art. 13 DSGVO).

**Fix.** Fill in the responsible person or organisation in both pages (the `.todo` spans), then remove the `.todo` style.

**Test.** `grep -n 'class="todo"' docs/*.html` finds nothing; both pages load from the landing page footer.

## Added by the submission review (14 Nov 2026)

### T-51 BMP code that breaks the 2.8 contract is read anyway (physician + pharmacist, verified)

**Problem.** `read('<MP v="999"><S><M p="1234567890123" m="wrong"/></S></MP>')` succeeded: the walker checked XML syntax, not the BMP
contract, and a dose that is no number became 0 (line shown as "Dosierung steht nicht auf dem Plan").

**Fix (done, web + iOS).** Refuse `MP/@v` ≠ `028`, `M/@p` outside 1–99999999, a dose outside the notation (`PlanReader.dose()` →
null), `wo` outside 1–7, and pages outside `a` 1–5 / `z` 2–5. The web app says why (`PlanReader.INVALID`) and keeps the old list.

**Test.** Checks "plan code of another version …", "… 13-digit PZN …", "… m=wrong …", "… weekday 9 or page 3 of 2 …", "the
review's sample …", "all example plans still read" (both clients). Open: iOS shows the generic "kein Medikationsplan" text.

### T-52 Incomplete multi-page plan could be adopted and then looked complete (physician, verified)

**Problem.** "Nur diese Seiten übernehmen" showed an "Unvollständig" banner at import, but `Store.adopt` saved only the medicines, so
the day view, read-aloud and print looked complete after a restart.

**Fix (done).** The button is gone; `Store.adopt` returns false for a plan with missing pages; the old list stays. iOS can't merge
pages and refuses multi-page codes (T-29). If partial adoption is wanted later, the saved state needs an "incomplete" marker that the
day view, read-aloud and print all show.

**Test.** `pwa/tests/pwa.test.js` "a plan with missing pages is never adopted; the old list stays".

### T-53 Picked leaflet PDF accepted for another product with the same substance (pharmacist, verified)

**Problem.** A leaflet for "Anderes-Produkt 10 mg" (Lisinopril, pink round) was accepted as `found` for LISINOPRIL PUREN 10MG: the check
only looked for the substance.

**Fix (done, web).** `LeafletPdf.namesProduct`: the leaflet must contain every product word of the official PZN name (strength and
form words left out, umlauts folded) and the strength; otherwise `unbound` and the look stays unknown. Without an official name there
is nothing to bind to: no picker. The learned look is labelled "Aussehen laut der Packungsbeilage, die Sie gewählt haben". iOS has no
picked-file path (it downloads by the pack's PZN).

**Test.** `pwa/tests/leaflet.test.js`: "leaflet of another product with the same substance … → unbound", "… in another strength (20 mg)
→ unbound", "PZN without an official name → unbound". The PDF fixture now names the pack's product ("HCT - 1 A Pharma 25 mg").
Open: the public build's PZN list has 93 rows, so most real packs get no picker here.

### T-54 Leaflet finish inferred from the coating (pharmacist, verified)

**Problem.** The parser set `finish: matte` for uncoated and `glossy` for coated tablets: a coating doesn't say how a surface looks
(INV-05). The matcher weighs `finish` (0.5) when a recogniser reports it.

**Fix (done for leaflet looks).** `finishIn` / `finish(in:)` only from "glänzend" / "matt"; the 31 leaflet looks in the catalog have
`finish: null`; `tools/add-leaflet-looks.py` writes null. Open: the EMA, DailyMed and demo looks also carry a coating-derived finish;
check their sources before relying on it.

**Test.** "leaflet: finish only when the text states it; a film coating alone gives none" (both clients).

### T-55 Android: camera capture stays in the app cache (privacy, verified in source)

**Problem.** `cameraIntent()` deleted old captures only when the next camera photo started; the latest stayed in `cache/photos`,
while the site said "Fotos werden nicht gespeichert".

**Fix (done in source).** `clearPhotos()` on a fresh start, before every file chooser (camera or gallery), on a cancelled capture or a
gallery pick, and in `onDestroy`. The capture can't be deleted in `onActivityResult` itself: the WebView reads the URI afterwards.
The privacy page now describes this.

**Test.** Not run: no Android SDK here. Rebuild the APK, take a photo, go back home, close the app; `adb shell run-as
de.hackathon.blisterkompass ls cache/photos` is empty.

### T-56 Site: unqualified medical-device and certainty claims, privacy notice gaps (site, verified)

**Problem.** README, landing footer and Impressum said "Kein Medizinprodukt" (qualification hasn't been assessed); the landing page
said "dann ist es sicher", "Ihre Tablette", "Nicht einnehmen", "nicht doppelt nehmen", offered a web component and API as if built,
and said the fields of another PZN carry over automatically; the privacy page left out `learnedLeaflets`, the Android cache and the
external leaflet link.

**Fix (done).** "Not for clinical use; medical-device qualification not yet assessed"; PZN "names the exact pack"; photo answers as
candidates with "Mit Apotheke oder Praxis klären"; partner offers labelled as proposals; privacy page lists the three storage keys,
the Android cache and the connections. Open: T-47 (placeholders, needs a real responsible person), T-46 (screenshots still show
"Ihre Tablette").

### T-57 Printed row numbers are not a stable medicine reference (physician + pharmacist, suspected)

**Problem.** `print-sheet.js` numbers rows after moving as-needed entries to the end, and a saved med has no immutable card id, so
"Nr. 3" can mean another medicine after an edit or a reprint.

**Fix.** Until a stable reference exists, don't claim that a number always means the same medicine (pitch, PRD print sheet). Later: a
card id set at adoption and printed with the sheet date.

**Test.** Print, add an entry, print again: the PRD and pitch don't promise stable numbers.

