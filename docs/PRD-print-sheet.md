# PRD: "Meine Medikamente mit Bildern" – the printable sheet for the older person

Status: v1 built in the web app (`pwa/js/print-sheet.js`); iPhone app still prints an older layout (T-30). Demo sheets: [`print/`](../print/).
Owner: team BlisterKompass. Last update: 13 Nov 2026. Related: [PRD scanner app](PRD-scanner-app.md), [decisions](DECISIONS.md).

## 1. Problem

Older people on many medicines get a paper Medikationsplan (BMP) from their practice. It lists substances, strengths and doses in small
print, with no picture of the pill. After a generic switch the pill in the box looks different from last month. People with cataract or
hearing loss can't read the plan or follow a phone call about it, so they call the practice, the pharmacy or the care service, or they
guess. The BMP layout is fixed by law (§ 31a SGB V, Anlage 3), so the picture can't simply be added to it.

## 2. Users

- **Erika M., 78** (demo persona): heart failure and type 2 diabetes, twelve medicines, cataract, mild hearing loss. Lives alone, takes her
  pills from the original packs. Keeps the plan on the fridge. Doesn't use a smartphone.
- **Her daughter** (the carer, see the [scanner-app PRD](PRD-scanner-app.md)): scans the plan, prints the sheet, explains it on the phone.
- **A home-care nurse or pharmacist**: uses the sheet on the phone with Erika ("Nummer 3, die gelbe runde") and to spot a switched pack.

## 3. Goals and non-goals

Goals:
- Erika can tell, on paper, which pill is which medicine, what it is for and when she takes it.
- On the phone, everyone points at the same row number.
- After a maker switch the sheet says the look may differ and who to ask; it never guesses.

Non-goals:
- Replacing the BMP. The paper plan from the practice stays the valid plan; this sheet goes with it.
- A 2D code of our own, or a BMP code built from the phone's list (D-09).
- Instructions for filling a dosette or weekly box (INV-16, D-11).
- Dosing advice, interaction warnings, anything that changes the therapy.

## 4. User stories

- As Erika, I see a picture of each pill next to its name and the time of day in words, in print large enough to read without a magnifier.
- As Erika, I see "Aussehen unbekannt – bitte Apotheke fragen" instead of a made-up picture when the look isn't known.
- As the daughter, I print the sheet from the app in two taps, without typing Erika's name or birth date into the app.
- As the nurse on the phone, I say "Nummer 4" and we both look at the same row.
- As a pharmacist, I see each picture's source (package leaflet, EMA, US reference, example data) and whether it is true size.

## 5. Requirements

Requirement IDs: PS-xx. "Now" = built in the web app; T-xx = open item in [TODO.md](../TODO.md).

### 5.1 Model

Copy from the Swiss eMediplan paper layout: a picture inside the medicine row with a text fallback, A4 landscape with a framed table and
the column titles repeated on every page, non-daily dosing as text, a separate as-needed block, a footer with page numbers. Don't copy its
small type (8.5 pt), its own 2D code, or licensed product images.

### 5.2 Page and header

| ID | Requirement | State |
|---|---|---|
| PS-01 | Printed from the app ("Plan drucken"), A4 landscape, laid out in mm, through the system print dialog (PDF or printer). | Now (web); iOS T-30 |
| PS-02 | Title "Meine Medikamente mit Bildern" (20 pt), "Seite x von n". The word "Medikationsplan" appears only in "Gehört zu Ihrem Medikationsplan". | Now (web); iOS T-30 |
| PS-02a | The waving mascot (`pwa/icons/mascot-wave.png`, about 17 mm) left of the title; decorative, no text in it. Not on the BMP page, which keeps the KBV layout. | Now (web, demo prints); iOS T-30 |
| PS-03 | "für:" line left blank to fill in by hand; the app never stores a name or birth date. | Now |
| PS-04 | "Gehört zu Ihrem Medikationsplan. Maßgeblich ist der Plan Ihrer Praxis." plus the date the list was printed. The plan's own date needs D-10. | Now; plan date D-10 |
| PS-05 | "Fragen? Sagen Sie am Telefon die Nummer aus der ersten Spalte." Optional contact lines (practice, care service, pharmacy). | Text now; contacts future |

### 5.3 The 2D code

| ID | Requirement | State |
|---|---|---|
| PS-06 | No BMP code built from the phone's list. A box says the valid plan with code comes from the practice or pharmacy. | Now (web); iOS T-30 |
| PS-07 | Reprinting the original code bytes of the scanned plan only if the team decides D-09 (needs storing personal data). | Open, D-09 |

### 5.4 Columns

| ID | Requirement | State |
|---|---|---|
| PS-08 | Columns: Nr. · Aussehen · Medikament · morgens · mittags · abends · zur Nacht · Wofür · Hinweise. Rows in plan order; Nr. = row. | Now |
| PS-09 | Medikament: ingredient (14 pt bold) and strength, brand beneath; block heading (e.g. "zeitlich befristet") when the plan has one. | Now |
| PS-10 | Doses in the plan's notation (½, ¼, ¾, "1,5") at 18 pt, unit when it isn't "Stück" (e.g. "20 IE"). Weekly: the doses plus "nur montags · 1× pro Woche". Free-text dosing across the four time columns, as written. | Now |
| PS-11 | As-needed medicines in their own block "Bei Bedarf" with the plan's text (e.g. "max. 3 pro Tag"). | Now |
| PS-12 | Wofür = the plan's reason (`M/@r`) only; empty when the plan states none. Hinweise = the plan's hint and extra line, as written. | Now |

### 5.5 Pictures

| ID | Requirement | State |
|---|---|---|
| PS-13 | Picture plus a description in cue order: size → shape → score line → imprint → colour ("8 mm, rund, Kerbe, „75“, weiß"). | Now |
| PS-14 | Source line under every picture ("Aussehen laut Packungsbeilage", "… EMA-Produktinformation", "US-Referenzdaten", "Beispieldaten"). | Now |
| PS-15 | True size ("Originalgröße") only when the source gives millimetres (length, and width for non-round forms); otherwise a fixed schematic size with "Größe unbekannt – nicht maßstäblich". Never a default size. | Now |
| PS-16 | No look: grey dashed outline of the dosage form plus "Aussehen unbekannt – bitte Apotheke fragen". Never a picture from another maker, strength or substance match (INV-05). | Now |
| PS-17 | Black-and-white printing stays usable: no colour coding of rows or time slots; colour is the last word in the description. | Now |
| PS-18 | A score line is drawn as the leaflet states it and never means "may be split". | Now; T-36 for the app's question |

### 5.6 Change markers

| ID | Requirement | State |
|---|---|---|
| PS-19 | One-version markers in a bound extra line: "Neues Aussehen seit …, gleiches Medikament wie bisher Nr. 7" (after a confirmed switch), "Neue Packung, noch nicht von der Apotheke bestätigt", "Dosis geändert ab …". | Future (needs plan versions) |

### 5.7 Large print and readability

| ID | Requirement | State |
|---|---|---|
| PS-20 | Body ≥ 12 pt; ingredient 14 pt; doses and Nr. 18 pt; nothing below 9 pt; no grey text for content; black on white; ruled rows. | Now (web; imprint lettering inside a true-size drawing is smaller, and also written out at 11 pt) |
| PS-21 | At most 6 rows per page rather than smaller type; column titles repeated on each page. | Now |

### 5.8 Footer

| ID | Requirement | State |
|---|---|---|
| PS-22 | "Seite x von n · erstellt mit BlisterKompass · Demo, synthetische Daten · kein ärztlicher Plan nach § 31a SGB V". | Now |
| PS-23 | "Nach einem Herstellerwechsel kann ein Medikament anders aussehen. Ob eine neue Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke." | Now |
| PS-24 | A 5 cm control bar: "Dieser Strich ist 5 cm lang. Ist er kürzer, wurde verkleinert gedruckt und die Größen stimmen nicht." | Now |

### 5.9 Checks (acceptance criteria)

- Row *n* on the sheet = entry *n* on the scanned plan = the *n*-th medicine in the app.
- Every picture has a source line; a missing size prints "Größe unbekannt"; a missing look prints "Aussehen unbekannt".
- No 2D code on the sheet; "Medikationsplan" appears only in "Gehört zu Ihrem Medikationsplan".
- No text tells anyone to take out, add, replace or re-sort a tablet (INV-16).
- Fonts measured in the printed PDF meet PS-20 (pdf.js check, as done for the review); the 5 cm bar measures 5 cm on paper.
- A black-and-white test print is legible.
- The demo generator's BMP page and picture sheet carry the identical, XSD-valid code (`tools/test_make_bmp_sheet.py`; T-47).

## 6. Accessibility

Large print per §5.7, high contrast, words next to every icon, no reliance on colour, short German sentences. On screen the preview opens
full screen and can be zoomed. Text extraction from the PDF must keep words whole (T-41).

## 7. Privacy and compliance

- No name, birth date or insurance number is read, stored or printed by the app (§5.2).
- No BMP code from the phone's list (D-09): a pharmacy must never import a patient-edited list as a professional plan.
- Information tool, not a medical device claim: the sheet repeats the plan and shows what a medicine looks like, with its source. It gives
  no dosing advice and no tablet-handling instructions (INV-12, INV-15, INV-16, INV-17).
- Only demo-safe data in this repo ([DATA.md](DATA.md)).

## 8. Success metrics

- Fewer calls and visits to ask "which one is this?" (pilot: count per month before and after, with the care service).
- Erika names the right medicine for a pill on her sheet in under 10 seconds in 9 of 10 cases (usability test).
- No row on any printed sheet shows a guessed look (review of 20 printed sheets).

## 9. Open questions

- **D-09** May a patient print carry the physician's original BMP code bytes?
- **D-10** May the plan reader keep the print date `A/@t` to show "Gehört zum Medikationsplan vom …"?
- **D-11** May a sheet show "Ihre Wochenbox laut Medikationsplan" (pill box per compartment)?

## 10. Release plan

- **Fri 13 Nov:** web-app sheet v1 (done), demo sheets for plan A and the KBV sample (done).
- **Sat 14 Nov, before the 11:00 freeze:** iOS print to the same layout (T-30) if a Mac is available; otherwise demo the web app's sheet.
- **Sat 14:15 pitch:** print the sheet live from the web app with plan A; hold the paper BMP next to it.
- **Later:** change markers (PS-19), contact lines (PS-05), the D-09/D-10/D-11 decisions.
