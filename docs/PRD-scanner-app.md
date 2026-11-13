# PRD: the BlisterKompass app – scanner for the carer and the skilled patient

Status: v1 in both clients (iPhone app `ios/`, web app `pwa/`); open items in [TODO.md](../TODO.md). Owner: team BlisterKompass.
Last update: 13 Nov 2026. Related: [PRD print sheet](PRD-print-sheet.md), [architecture](../ARCHITECTURE.md), [decisions](DECISIONS.md).

## 1. Problem

The German medication plan (BMP) carries the whole list as a 2D code, but nobody at home can read it. Carers juggle a dozen medicines
for a parent, generic switches change how pills look, and loose pills turn up in a weekly box or on the table. Today the answer is a
phone call to the practice, the pharmacy or the care service, or a guess. Professionals lose time on "which one is this?" calls, and
patients take the wrong pill or skip the right one.

## 2. Users

- **Erika's daughter** (primary): lives 40 km away, visits weekly, manages the paper plan and the pharmacy runs, uses an iPhone.
- **A home-care nurse** (skilled user): visits many patients a day, needs an exact answer from a pack code, works with gloves and in bad light.
- **A skilled patient**: an older person who uses a smartphone and wants to check a new pack themselves.
- **Erika M., 78** (demo persona, the one who takes the pills): heart failure and type 2 diabetes, twelve medicines, cataract, mild hearing
  loss. She benefits through the printed sheet and the read-aloud, not by operating the app.

## 3. Goals and non-goals

Goals:
- Read the plan once from its 2D code; from then on see which medicines are due now and later, in plain German and read aloud.
- Identify a pack exactly by its PZN and compare it with the plan, including maker switches.
- Narrow a loose pill to candidates from the person's own plan, and say "ask the pharmacy" whenever it isn't clear.
- Print the sheet for the older person ([PRD print sheet](PRD-print-sheet.md)).

Non-goals (D-12, [AGENTS.md](../AGENTS.md) §1): a physician app, therapy changes, dosing advice, interaction checks that drive decisions,
photo recognition as proof of identity, an ePA/TI connection, a server or accounts.

## 4. User stories

- As the daughter, I scan the code on Mum's plan and see her day: what is due now, what comes later, what only on Mondays.
- As the daughter, I scan the new pack from the pharmacy and see whether it is the medicine on the plan, another maker of it, or something else.
- As the nurse, I photograph a loose pill and get the few medicines on this patient's plan it could be, plus the one question that tells them apart.
- As a skilled patient, I tap the speaker and hear what to take now, with what each pill looks like.
- As anyone, I never get told to take, skip, double or move a tablet; I get told who to ask.

## 5. Functional requirements

IDs: SA-xx. "Now" = built (both clients unless noted); T-xx = open item in [TODO.md](../TODO.md).

| ID | Requirement | State |
|---|---|---|
| SA-01 | **Plan import** from the BMP 2.8 Data Matrix (camera, bundled examples, photo library) or typed entry. | Now; full BMP 2.8 reading in the web app, iOS T-29 |
| SA-02 | Reads only the medication part: `S` blocks with `M`, `W`, `R`, `X`; never `P`, `A`, `O`. Free-text `X` lines are shown on import and not stored. | Now (web); iOS T-29 |
| SA-03 | Keeps what the plan says: PZN, all ingredients, dose notation, unit (`du`/`dud`), weekday (`wo`), free-text dosing (`t`), hint (`i`), reason (`r`), extra line (`x`), block headings 411–425; pages of one plan merged. Lines without picture data keep their schedule and show a grey outline. | Now (web); iOS T-29 |
| SA-04 | A line takes a picture only from the catalog product with its own PZN; never from a substance match or another maker (INV-05, INV-15). | Now (web); iOS T-29 |
| SA-05 | **Day view**: now first, then later today, tomorrow, weekly medicines in their slot on their day (else the next date), free-text dosing as written, as-needed last. | Now; T-06 (11:05 and after-midnight cases, "intake not recorded" note) |
| SA-06 | **Read-aloud** (German voice) of what is due now, with each pill's look, from fixed templates. | Now; T-10 (cut off), T-24 (hints) |
| SA-07 | **Medicine card**: picture or outline with its source, dose per time of day, unit, reason, hint, extra line, block heading. | Now; T-08 wording |
| SA-08 | **Pack scan**: securPharm IFA and GS1 Data Matrix, PZN barcode (Code 39); PZN check digit; best-before and batch. | Now; T-19 (1D barcode from a distance), T-34, T-35 |
| SA-09 | **Pack vs. plan**: on the plan · same substance, other pack (only the pharmacy says whether it replaces the plan's) · same substance, other strength or form · not on the plan · unknown. Taking over a new look only after "Apotheke hat bestätigt". | Now; T-03, T-15, T-16, T-17, T-18, T-33 |
| SA-10 | **Pill photo** → colour, shape (and imprint: typed on the web, OCR on iOS) → candidates from the person's own plan only, a distinguishing question, and "other maker" / "not on your plan" warnings that send to the pharmacy. | Now; T-04, T-05 |
| SA-11 | **Own list**: put a scanned pack on the phone's list with its times. Shown as the person's own entry, never as a prescription (INV-19). | Now; T-08, T-11, T-12, T-13, T-14 |
| SA-12 | **Plan drucken**: the sheet "Meine Medikamente mit Bildern". | Now (web); iOS T-30 |
| SA-13 | **Offline**: everything on the phone; the web app installs and works in flight mode; no request after the first load. | Now; T-09 (update prompt) |
| SA-14 | **Leaflet look for an unknown PZN**: iPhone app downloads the leaflet after the user allows it (only the PZN leaves the phone); the web app links to the leaflet, the person saves the PDF and picks it, and it is read on the phone (pdf.js). A leaflet of another substance is refused; an unclear section 6 leaves the look unknown. | Now (both) |
| SA-15 | **Same product on both clients**: same features, texts and data, paired checks. | Rule ([AGENTS.md](../AGENTS.md) §3); T-29…T-31, T-42…T-44 |

## 6. Acceptance criteria

- The KBV sample plan imports with all 7 lines; insulin shows "20 IE" morning and "10 IE" evening without a picture; MTX shows on Mondays
  with its dose; the nitro spray shows under "Nur bei Bedarf" with "max. 3".
- A pack of another maker of a plan medicine never shows as "Nicht auf Ihrem Plan!" with an add button (T-03 open).
- No screen or spoken text contains a tablet-handling instruction (INV-16) or calls an appearance match "Ihre Tablette" (INV-15, T-08 open).
- In flight mode after one visit, plan import, pack scan and the PZN lookup work in the web app; no request leaves the phone.
- `cd pwa && npm test` and `ios/checks/run.sh` pass; the same check names exist on both sides (T-42).

## 7. Accessibility

Touch targets ≥ 44 px, text ≥ 15–16 px, icon plus word on every button, light and dark mode, read-aloud. Open: contrast below 4.5:1 for
the morning slot and the inactive slots (T-25), sideways scrolling and cut names at 200 % zoom (T-26), the gallery button off-screen in
the examples header (T-27), focus handling (T-39).

## 8. Privacy and compliance

- No person data: the plan reader skips `P`, `A`, `O`; only `myMeds`, `unknownPZNs` and `learnedLeaflets` (products) are stored; photos and picked PDFs stay in memory.
- No network in the web app after the first load (strict CSP, tested); the iPhone app's only request is the optional leaflet lookup.
- Identity only from plan entry + PZN or a professional (INV-15); unknown stays unknown (INV-05); fixed-template text (INV-12); no
  tablet-handling instructions (INV-16); prepared doses are the professional's (INV-17); the own list is not a regimen change (INV-19).
- Information tool, not a medical device claim: it reads back the plan and the pack code and shows candidates for a pill, always with
  "ask the pharmacy" when unsure. It doesn't diagnose, dose or decide.

## 9. Success metrics

- Fewer "which pill is this?" calls to the practice, pharmacy and care service (pilot count per month).
- Time from "new pack in hand" to "it's the plan's medicine / ask the pharmacy": under 10 seconds with a pack code.
- Pack-code reads: ≥ 95 % of DataMatrix photos at arm's length decode on the first try (current test set: 6 of 6 DataMatrix, 1D barcodes T-19).
- Zero wrong "same medicine" statements from a photo (appearance only proposes).

## 10. Open questions

- **D-09** May a patient print carry the physician's original BMP code bytes?
- **D-10** May the plan reader keep the plan's print date `A/@t`?
- **D-11** Wochenbox page on the print?
- Should the web app offer the online leaflet lookup with consent, like iOS (SA-14)?

## 11. Release plan

- **Fri 13 Nov:** BMP 2.8 reading, day view and print in the web app (done); public repo, Vercel deploy (done).
- **Sat 14 Nov, before the 11:00 freeze:** the P0 items in [TODO.md](../TODO.md): home-screen freeze (T-01), double tap (T-02), generic
  switch shown as not on plan (T-03), wording (T-08), demo plan A (T-07); iOS ports if a Mac is available.
- **Sat 14:15 pitch:** live demo on a phone: scan plan A, the day view, a pack scan, a pill photo, print the sheet.
- **Later:** T-29…T-31 iOS ports, accessibility fixes, the open decisions.
