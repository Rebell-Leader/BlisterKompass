# Dosette check: evidence, rules, feasibility

Research for the idea of a photo check after a nurse fills a weekly pill organiser (Wochendosett) or checks a pharmacy blister: count pills per compartment, compare count and look with the Medikationsplan, warn on a mismatch, and store the photo with time, person and plan version as documentation.
As of 2026-11-13. Figures marked *(my calc)* are my own arithmetic on the cited numbers. Figures marked *(unverified)* come from secondary or vendor sources.

## 1. Headline

1. **Manual filling goes wrong in about 1 of 14 daily rations.** In 3 German nursing homes, 7.3% of 8,798 daily doses were wrong, and 53% of residents had at least one error in 8 weeks (Kohaupt et al., Köln 2007). A 2022 German study found 7.4% of 471 fills had an error. In-house filling carried 12× the odds of an error compared with pharmacy filling (Maier & Kreuzenbeck 2024).
2. **Most errors are count or slot errors, not wrong drugs.** Error types were: wrong tablet splitting 50%, missing tablet 22%, extra tablet 10%, wrong time slot 8%, damaged tablet 6%, wrong dose 4%, wrong drug 0% (Kohaupt 2007). That suits a counting check.
3. **Pharmacy packs are not error-free.** Nurses auditing pharmacy-filled packs in 42 Australian aged-care homes found incidents in 4.3% of 6,972 packs, affecting 12% of residents. Most were missing medicines. Dispensing errors in the UK CHUMS study were 9.8% per item.
4. **The market is large and mostly manual.** In 2023, ambulante Pflegedienste cared for 1.10 million people and nursing homes housed 776,000 residents. In a survey of 690 services, 92% fill dosettes themselves. A median of 40% of their clients have a dosette prescription, so roughly 400,000 home-care patients have their dosettes filled by nurses, about 20 million fills a year *(my calc)*. About half of nursing homes still fill in-house.
5. **No rule requires a photo, but the inspection criteria match the idea.** The MD checks that "gerichtete Medikamente mit den Angaben in der Pflegedokumentation übereinstimmen" (QPR vollstationär 2.1). In 2023, 7.6% of residents had medication deficits with actual harm, and 8.0% of home-care clients received medication that did not match the prescription.
6. **Counting is feasible under controlled capture. Identifying the drug in a compartment from one photo is not reliable.** Accuracy drops sharply with occlusion, many look-alike classes and reflective lids. I found no German or EU product that checks filled dosettes by photo for nursing services.

## 2. Error-rate evidence

| Study | Country | Setting | Method | Rate |
|---|---|---|---|---|
| Kohaupt, Gerber, Längen 2007 (GAA abstract, Uni Köln) | DE | 3 nursing homes, 196 residents, 8 weeks | Prospective, covert check of filled dosettes; 8,798 daily doses, 48,512 single tablets | **7.3% of daily doses wrong**; 53% of residents had at least one error. Types: wrong splitting 50%, missing 22%, extra 10%, wrong time 8%, damaged 6%, wrong dose 4%, wrong drug 0% |
| Maier & Kreuzenbeck 2024, *Prävention und Gesundheitsförderung* | DE | 6 nursing homes, Feb–Jul 2022; in-house vs pharmacy/blister-centre filling | Counted and checked 471 fills, 29,216 tablets | **7.4% of fills wrong** overall; **OR 12.0** for in-house vs external filling (χ² 38.98, p < 0.001). Split rates by arm are in the full text only (not accessed) |
| Gesundheitsamt Hochsauerlandkreis (Stockebrand), inspections 2013, PZ 29/2015 | DE | 21 of 35 Pflegedienste; medication of 50 patients | Regulatory inspection | **9 filling errors** in the 50-patient sample (rate not stated; 9/50 = 18% *(my calc)*, rough). Types: tablets split that should not be, omitted dose, wrong dose, wrong drug, filled too far ahead. 14 of 17 services documented who filled |
| MD Pflege-Qualitätsbericht 8 (data 2023) | DE | Regular MD inspections: 72,100 residents; home-care clients | Audit against prescription and documentation | Nursing homes, QA 2.1: **11.6%** risk of harm, **7.6%** deficit with actual harm (2019: 10.7% / 5.3%). Home care, question 9.16: **8.0%** of clients with a prescription had medication not matching it (2019: 8.9%) |
| Meyer-Massetti et al. 2012, *Pflege* | CH | Spitex, 1,854 patients/year | Observation, CIRS, survey, FMEA | **74% of 84 reported errors happened during preparation**; 7.5 drugs/day; 1–9 doses per patient not suitable for a weekly dispenser |
| Meyer-Massetti et al. 2016, *Pflege* | CH | Spitex CIRS pilot | Incident reports | Most reports concerned preparation at home: omission 30%, wrong dose 17.5%, wrong time 15%. Causes: inattention 68%, time pressure 23% |
| Barber et al. 2009 (CHUMS), *QSHC* | UK | 55 care homes, 256 residents | Prospective; pharmacist review | **Dispensing errors 9.8% of items** (187/1,915): labelling 7.3%, content 2.3%. Administration errors 8.4%. 69.5% of residents had at least one error. Cassette vs blister packs OR 2.88 (driven by labelling) |
| Carruthers et al. 2008, *MJA* | AU | 42 aged-care homes, 2,480 residents | Registered nurses audited 1 pharmacy-filled pack per resident | **4.3% of packs** (297/6,972), **12% of residents**. Missing medicine 99, ceased drug still supplied 37, wrong strength 32, wrong instructions 32, wrong drug 12 |
| Alldred et al. 2011, *BMJ QS* | UK | Care homes | Observed administration | Tablets not in a monitored dosage system had **2.1×** the odds of an administration error compared with tablets in one |
| Gilmartin-Thomas et al. 2017, *IJNS* | UK | 10 London care homes, 2,452 doses | Direct observation | Administration error **9.3% from original packs vs 3.1% from compliance aids** (RR 3.9) |
| Beobide Telleria et al. 2018, *Farm Hosp* | ES | 7 nursing homes | Voluntary reports, before vs after | Manual weekly pill boxes: 408 errors per 1.96 million doses (2013). Automated pouches: 36 (2015). **−91%**. Underreported by design |
| van den Bemt et al. 2009, *JAMIA* | NL | 3 nursing homes with a dispensing robot | Disguised observation, 2,025 administrations | **21.2%** administration errors even with robot pouches (crushing, timing); handling after unpacking adds error |
| Zimmerman et al. 2011, *JAGS* | US | 11 assisted-living communities | Observation of 4,957 administrations | 42% errors (20% excluding timing); 7% moderate or high harm potential |
| Levings et al. 1999, *J Qual Clin Pract* | AU | Incident database | 52 dosette incidents | Half were filling errors, mostly by nurses, some systematic and dangerous |

**Pharmacy blistering vs manual filling.** The German data (OR 12, Maier & Kreuzenbeck), the Spanish data (−91%) and the UK data (administration OR 2.1 / RR 3.9) favour pre-packed or machine systems. In 2019 IQWiG found no prospective study of the benefit in nursing homes (Rapid Report A18-35). The often-quoted "1.4% vs 17%" and "10,000× more errors" come from industry statements and are *unverified*.

**Do nurses check?** Data is thin.
- Office-filled dosettes in German home care (281 services): checked by the same nurse in 48%, by a second nurse at the office in 31%, by a second nurse at the patient's home in 21% (Schmid et al. 2022). There is no data for the 56% of services that fill at the patient's home.
- No German regulation requiring a four-eyes check for filled dosettes was found.
- When nurses do check pharmacy packs, they catch errors in 4.3% of packs (Carruthers 2008).
- A recheck by the same person is weak; the Köln errors passed through normal routine undetected.

**Market size (Germany).**
- Ambulante Pflegedienste 2023: **15,549 services, 1,100,672 SGB XI clients**. HKP-only patients without a Pflegegrad are not included.
- **51.5%** of home-care clients in MD checks had a prescription for medication administration (biased sample).
- Survey of 690 services, Feb 2021: **92.2% fill dosettes themselves**, 91.9% with reusable rigid boxes. Median **40%** of clients have a dosette prescription. Median **15 min per client per week**, 6 drugs per client.
- Extrapolation: 1.10 M × 40% ≈ **440,000 clients, about 23 million weekly fills a year** *(my calc; the median of service shares is not the population share)*.
- Nursing homes: **11,250 full-time care homes, 775,961 residents** (15 Dec 2023). **49.3%** of 268 homes have outsourced repackaging to pharmacies (Schmid et al. 2025).
- Pharmacy blistering: **> 300,000 patients**, about 278,000 of them in homes. This rests on 34% of homes using blisters in a 2017 survey (T. Schmid, 2022) *(estimate)*.
- No official count exists for HKP Nr. 26 "Richten" patients. GBE/KG 2 statistics report HKP cases but not per service number.

## 3. German documentation and legal requirements

| Topic | Rule | What it says |
|---|---|---|
| HKP service | **HKP-Richtlinie (G-BA), Anlage Nr. 26 "Medikamente"**, version of 16.10.2025, in force since 12.12.2025 | Covers "1. Richten von ärztlich verordneten Medikamenten, wie z. B. Tabletten, für von der Ärztin oder vom Arzt bestimmte Zeiträume". Remark: "Das Richten der Arzneimittel erfolgt in der Regel wöchentlich (mit Ausnahme flüssiger Medikamente …) und umfasst auch die Kontrolle, ob die Medikamente regelmäßig eingenommen wurden." Pflegedienste must take dose, timing and instructions from the prescription and, if available, the Medikationsplan. Only prescribable for impaired sight, motor function, strength or cognition |
| HKP documentation | HKP-RL § 7 (2), (4) | The Pflegedienst reports to the prescriber, also with extracts from the Pflegedokumentation. The prescriber should look at the Pflegedokumentation on home visits |
| Photos in HKP | HKP-RL Nr. 31/31a (wounds) | Wunddokumentation "und gegebenenfalls zusätzlich eine Fotodokumentation". This is a precedent for photos in Pflegedokumentation. There is **no photo requirement for medication** |
| MD inspection, home care | **QPR Teil 1a ambulant, Anlage 2, question 9.16 (T19)** "Entspricht die Medikamentengabe der ärztlichen Verordnung?" | Met if given as prescribed "und in der Pflegedokumentation dokumentiert". The prescription is part of the documentation. Generics must be traced to the prescribed product. "Nachweis … über die Medikamente und die Pflegedokumentation." Billing check: position 26 Medikamentengabe (richten, verabreichen) is compared with the actual frequency (version of 18.12.2019; revised QPR in force 1.7.2026 reportedly only changes notice periods *(unverified)*) |
| MD inspection, nursing homes | **QPR vollstationär, QA 2.1 "Medikamentöse Therapie"** | Guiding question 2: "Erfolgt die Lagerung und Vorbereitung der Medikamente fachgerecht?" This is met if "die gerichteten Medikamente mit den Angaben in der Pflegedokumentation übereinstimmen" and are labelled per resident. Blisters must be labelled per ApBetrO. Rating C (risk): filled meds do not match the documentation. Rating D (harm): "ein nicht für sie bestimmtes Medikament erhalten" or a dose different from the prescription |
| Heimrecht | **HeimG § 11 (1) Nr. 10, § 13 (1) Nr. 5, (2)**, now replaced by state laws (e.g. PfleWoqG BY, WTG NRW) with similar content | Medicines stored "bewohnerbezogen und ordnungsgemäß"; staff advised on medicine handling at least yearly. Records must cover "der Erhalt, die Aufbewahrung und die Verabreichung von Arzneimitteln" and be kept **5 years**. Wording differs by state *(check the target state)* |
| Pharmacy–home contract | **ApoG § 12a** | A written, approved Heimversorgungsvertrag covering type and extent of supply, checks of resident-specific storage by pharmacy staff, and **Dokumentation**. It does not mention filling or blistering |
| Pharmacy filling | **ApBetrO § 34** | Pharmacy Stellen or Verblistern only under QM rules, by trained pharmacy staff in a separate room. Label shows patient name, drugs with batch numbers, expiry, intake instructions and pharmacy, with leaflets enclosed. No per-pack pharmacist release is written into § 34 |
| Medication plan | § 31a SGB V, BMP | The bundeseinheitlicher Medikationsplan carries morning, midday, evening and night doses, which map one-to-one onto a 4-slot dosette. BlisterKompass already reads its Data Matrix |
| Expertenstandards | DNQP | No Expertenstandard on medication management found |
| Liability | BGB §§ 280, 278 (contract), 823, 831 (tort); StGB § 229 | The prescriber is responsible for the order; the Pflegefachkraft for carrying it out correctly (as ZQP puts it). Missing documentation hurts the provider: § 630h (3) BGB presumes an undocumented necessary measure was not done. Whether §§ 630a ff. apply to HKP Behandlungspflege is debated *(legal check needed)*. Courts have applied documentation-based evidence relief to nursing records before (e.g. BGH VI ZR 215/84, pressure ulcers, *unverified citation*). A timestamped photo plus "who and which plan version" is strong evidence the fill was correct, but it also proves errors |
| Data protection | **DSGVO Art. 9 (1), (2)(h), (3)**; § 22 (1) Nr. 1 b BDSG; § 203 StGB | Dosette photos are health data, and the box often carries the patient's name. Care provision is a legal basis without consent, provided staff are bound by confidentiality. Apply data minimisation (Art. 5): no faces, crop to the box. A DPIA (Art. 35) is likely needed for systematic health-data processing with new technology. External processors need an Art. 28 contract plus § 203 (3) StGB obligations |
| Cloud | **§ 393 SGB V** | Cloud processing of health data by SGB V service providers requires processing in Germany, the EU or an adequate country, plus a **C5 Type-2 attestation since 1.7.2025**. HKP providers contract under § 132a, which sits in Chapter 4 SGB V, so I read them as covered *(my reading)*. Doing the analysis on the device avoids this |
| Medical device / AI Act | MDR, MDCG 2019-11; AI Act Art. 6 (1) | **Open question.** Pure documentation is likely not a medical device. "Warns on mismatch to prevent wrong intake" may be read as a medical purpose. If it is class IIa or higher, the AI Act high-risk rules apply. Needs a regulatory check before any real use |

**Is photo documentation common?** I found no evidence that services routinely photograph dosettes. Documenting *who* filled is common (14 of 17 services in the HSK inspection). Photos are routine for wounds.

## 4. Technical feasibility and existing products

**Research on vision accuracy**

| Work | What | Result | Relevance |
|---|---|---|---|
| NLM Pill Image Recognition Challenge 2016 (Yaniv et al.) | Identify 1 of 1,000 pills from a consumer photo | Winner top-5 **43%** | Identity from free photos is hard |
| Microsoft Research 2019 (*npj Digit Med*) | Same dataset | Top-5 **94%** | Better, but still top-5, not top-1 |
| Ashraf et al. 2024 (*Artif Intell Med*) | 30 hospital drugs, 26,880 images | Internal precision 98.7%, recall 95.1%. Offline on Android: 86.5% and 75.0%. External clinical: 83.1% and 71.4% | Accuracy drops on phone and in real use; a local formulary helps |
| Holtkötter et al. 2022 (*Sensors*) | Count remaining pills in a blister | Grey blisters **95.2%**; **transparent cover 88.2% / 80.8%** | Reflections through clear plastic are a real pitfall |
| MEDISEG 2026 (arXiv, *preprint*) | 8,262 images, 32 pill types, **includes cluttered dosette boxes**, instance masks | mAP@0.5 **99.5%** (3 classes) vs **80.1%** (32 classes) | Closest public dataset; identity degrades with many classes |
| Liu et al. 2026 (*JMIR AI*) | Count pills in phone photos (YOLOv12 + Faster R-CNN + SAM) | Count MAE **0.167**; detection accuracy 0.933 | Counting works but is not perfect |
| Luginbühl & Sariyar 2026 (BFH, *Stud HTI*) | Pill recognition for nursing preparation (AR) | Good under constrained conditions, worse under realistic variability | Several images in sequence beat a single shot |
| Kim et al. 2026 (*JMIR Hum Factors*) | Pharmacists and AI pill verification | Wrong AI challenges caused large trust drops | False alarms kill adoption |

**Pitfalls for dosettes**
- **Lids:** tinted, translucent lids cause reflections and colour casts. The photo must be taken with lids open, but open lids shade the next row.
- **Depth and stacking:** compartments are deep, so 4–8 tablets overlap and the count comes out too low.
- **Contrast:** white round tablets, the most common kind, sit on white or translucent plastic.
- **Halves and fragments:** half tablets are the most frequent German error type, and crumbs make counting noisy.
- **Look-alikes:** many white round tablets look the same, and the imprint is rarely visible inside a compartment.
- **Capsules:** two-tone colours are an aid, but capsules are glossy.
- **Generic switches:** the plan and the product's look change between manufacturers. This is the "other maker" problem BlisterKompass already handles.
- **Off-dosette medicines:** weekly drugs (methotrexate, bisphosphonates), as-needed drugs, and light- or moisture-sensitive drugs stay in original packs. Plan lines need a "not in dosette" flag.

**Pixel budget** *(my calc)*: a 12 MP photo of a 7×4 box about 20 cm wide gives about 20 px/mm, so a 6 mm tablet spans about 120 px. That is enough for count, colour and shape, and marginal for imprint.

**False-alarm math** *(my calc)*: a weekly box has 28 compartments. At 98% per-compartment accuracy, 43% of correct boxes get at least one false alarm. At 99.5% it is 13%; at 99.9% it is 3%. So the per-compartment target has to be about 99.5% or better, or ambiguous cells must say "please look" instead of "error".

**Existing products**

| Product | Type | Claims | Note |
|---|---|---|---|
| Outcomes **PillCount** (US) | iPad Pro camera counter, pharmacy | > 99% accuracy, 150–300 ms, images kept 10 years | Vendor claim; one pill type on a flat tray |
| **Eyecon** 9420/9430 (US) | Camera pill counter, pharmacy | 99.99% count; Optical Pill Verification (size, shape, colour, imprint) announced July 2026 | Vendor claim; no independent study found |
| McKesson **PACVision** C/EX | Pouch inspection after a packing robot | Checks quantity, colour, size and shape; up to 320 pouches/min; image audit trail | Closest industrial analogue: one image per dose, compared with the expected content |
| Euclid **Vantage Vision MDM** | Multi-dose pouch verification | Agitator settles pills flat to cut false positives | Shows that flat, single-layer presentation is key |
| RxSafe **BlistAssist** | Light-guided hand-filling of blister cards with image workflow | Pill-by-pill images, pharmacist review | Pharmacy-side analogue of "fill, then photo-check" |
| Laetus **Polyphem wt** (DE), Baumer | Industrial blister inspection | 3D stereo for double or broken tablets | Manufacturing lines, not care |
| **MedEye** (NL) | Bedside scanner, hospital | Non-timing errors 4.77% → 2.55% (UK feasibility study; not significant after adjustment) | Identity verification against an e-chart; fixed device |
| **Nurse Dottie**, **HiDO** (UC Davis trial 2026), MedSnap ID | Caregiver apps and devices | Photo check of "right med, right number" (Dottie, landing page) | *Unverified* early-stage products |
| **MediMan** (DE, Uni Osnabrück case study) | Platform linking pharmacy, Pflegedienst and blister centre | Machine blisters about €5 per patient-week vs €2–3.50 manual | Alternative route (outsourcing), not photo checking |

**German or EU startup doing dosette photo verification for nursing services:** none found in German or English searches. This is an absence of search hits, not proof.

**Light feasibility verdict.** A one-photo count per compartment, against the expected count from the BMP, is buildable for a hackathon demo. Conditions: lids open or removed, top-down shot, one day row per photo or a fixed box model, single-layer pills. Reliable drug identity per compartment from one photo is not. The current BlisterKompass pipeline (border-median background, largest region, CIELAB colour, axes for shape) is built for one pill on a dark surface. It would need instance segmentation and a compartment grid. A box-model template is easiest; a detector trained on MEDISEG is more general.

## 5. Implications for the idea

**What makes it strong**
- **Aim at the errors that actually happen.** Missing, extra and wrong-slot tablets are 40% of the German errors, and splitting is 50%. Count per slot plus "half tablet expected or seen" covers most of them. Identity can be a soft hint ("colour fits / does not fit"), never a verdict.
- **Use the plan as ground truth.** Read the BMP once (BlisterKompass already does) and map m/d/v/h to the 4 slots. Flag weekday-only drugs (`wo`) and weekly drugs like methotrexate: only one compartment per week may contain it.
- **Speak the MD's language.** Sell it as evidence for QPR 9.16 (home care) and QA 2.1 ("gerichtete Medikamente stimmen mit Pflegedokumentation überein"), and as a recorded second check where a real four-eyes check is missing (21–48% of services check alone or with the same person).
- **Fit the time budget.** Filling takes a median 15 min per patient-week; the check must add less than 30 seconds. Make "unsure, please look at Wed evening" the default for ambiguous cells.
- **Run on the device, with an export.** This avoids § 393 SGB V cloud requirements and makes the DPIA easier. Export photo, hash, time, nurse and plan version into the existing Pflegedoku system instead of building a new archive.
- **Cover both directions.** The same check works when a nurse receives a pharmacy blister: 4.3% of packs had incidents in the Australian audit, and Germany is moving toward outsourcing (49% of homes).

**Fit with this repo's rules (`AGENTS.md`)**
- **AGENTS.md §1** rules out "autonomous pill recognition as a safety gate". The check therefore documents and prompts a human re-check. It never releases a box.
- **INV-15:** what the photo shows can only *propose* a match. The count and look are an `EvidenceAssertion(status=proposed)`, and the nurse confirms.
- **INV-16:** the output may name the slot, expected vs counted ("Mi abends: Plan 4, gezählt 3") and the responsible actor. It must not say "add or remove a tablet". This needs a phrasing checker.
- **INV-17:** the result attaches naturally to the existing `PreparedDoseBatch` entity (responsible actor, slots, plan version).

**Risks**
- **False alarms** (see the math above) and **automation bias**: a green tick on a wrong box is worse than no check. The UI should show the expected count beside the seen count and never just "OK".
- **Liability cuts both ways.** A stored photo of a wrong box is evidence against the provider. Services may resist storing failures, so the workflow must store the corrected photo with the correction.
- **Regulatory status** (MDR/AI Act) is unclear once the app "warns".
- **Adoption:** nurses value flexibility. 50.9% of self-filling services are sceptical of pharmacy blisters, and about two-thirds of NRW nurses rejected automation in 2009.
- **Hardware variety:** dozens of dosette models, colours and lid types.

## 6. Caveats

- The German error studies are small (3 and 6 homes) and partly conference abstracts (Kohaupt 2007). The Maier & Kreuzenbeck arm-specific rates were not accessible beyond the abstract.
- Studies measure different things (per daily dose, per fill, per pack, per item, per administration), so rates are **not directly comparable**.
- The market extrapolations *(my calc)* rest on a self-selected survey (690 of about 6,900 contacted) and a median of service shares.
- Vendor accuracy figures (PillCount, Eyecon, PACVision) are not independently validated.
- QPR ambulant text used: Anlage 2 as of 18.12.2019 (the MD report cites the 01.01.2021 version). Check the 2026 revision before quoting in a pitch.
- The legal points (applicability of § 630a ff. BGB to HKP, § 393 SGB V scope, MDR class) are my reading, not legal advice.

## 7. Sources

Error rates and market
- Kohaupt I, Gerber A, Längen M. Estimation of type and number of medication errors in long term care. GAA 2007. https://www.egms.de/static/en/meetings/gaa2007/07gaa04.shtml
- Press report on the same study (wissenschaft.de, 2009). https://wissenschaft.de/artikel/oefter-mal-die-falsche-pille
- Maier S, Kreuzenbeck C. Patientenindividuelle Verblisterung im Pflegeheim reduziert Fehlerhäufigkeit. Präv Gesundheitsf 2024. https://doi.org/10.1007/s11553-024-01118-y
- Stockebrand C. Umgang mit Arzneimitteln in ambulanten Pflegediensten. PZ 29/2015. https://www.pharmazeutische-zeitung.de/ausgabe-292015/umgang-mit-arzneimitteln-in-ambulanten-pflegediensten/
- Medizinischer Dienst Bund. 8. Pflege-Qualitätsbericht (2025, data 2023). https://www.medizinischerdienst.de/fileadmin/MD-zentraler-Ordner/Downloads/02_Qualitaet_in_der_Pflege/250612_8.PQ-BERICHT.pdf
- Meyer-Massetti C et al. Pflege 2012;25:261 (PMID 22811293). https://pubmed.ncbi.nlm.nih.gov/22811293/
- Meyer-Massetti C et al. Pflege 2016;29:247 (PMID 27377359). https://pubmed.ncbi.nlm.nih.gov/27377359/
- Barber ND et al. Care homes' use of medicines study. QSHC 2009. https://pmc.ncbi.nlm.nih.gov/articles/PMC2762085/
- Carruthers A et al. MJA 2008;188:280 (PMID 18312191). https://pubmed.ncbi.nlm.nih.gov/18312191/
- Alldred DP et al. BMJ Qual Saf 2011;20:397 (PMID 21300991). https://pubmed.ncbi.nlm.nih.gov/21300991/
- Gilmartin-Thomas JF et al. Int J Nurs Stud 2017;72:15 (PMID 28433827). https://pubmed.ncbi.nlm.nih.gov/28433827/
- Beobide Telleria I et al. Farm Hosp 2018;42:141 (PMID 29959837). https://www.redalyc.org/journal/3659/365962269002/html/
- van den Bemt PM et al. JAMIA 2009;16:486 (PMID 19390109). https://pubmed.ncbi.nlm.nih.gov/19390109/
- Zimmerman S et al. JAGS 2011;59:1060 (PMID 21649628). https://pubmed.ncbi.nlm.nih.gov/21649628/
- Levings B et al. J Qual Clin Pract 1999;19:69 (PMID 10096730). https://pubmed.ncbi.nlm.nih.gov/10096730/
- Schmid T, Hoffmann F, Dörks M, Jobski K. Nurse-filled vs pharmacy-filled MODs, German home care survey. Healthcare 2022;10:620. https://pmc.ncbi.nlm.nih.gov/articles/PMC9028845/
- Schmid T et al. Outsourcing medication repackaging in nursing homes. Pharmacy 2025;13:182 (PMID 41441330). https://pubmed.ncbi.nlm.nih.gov/41441330/
- Schmid T. Patientenindividuelle Verblisterung überschreitet 300.000 Patienten. AH 2022. https://www.iww.de/ah/apothekenfuehrung/apothekenentwicklung-patientenindividuelle-arzneimittelverblisterung-ueberschreitet-zahl-von-300000-patienten-f148164
- IQWiG Rapid Report A18-35, Patientenindividuelle Verblisterung (2019). https://www.iqwig.de/download/a18-35_patientenindividuelle-verblisterung_rapid-report_v1-0.pdf
- Carli Lorenzini G. Home care nurses, Sweden. Healthcare 2021;9:1265. https://pmc.ncbi.nlm.nih.gov/articles/PMC8535860/
- Wessel T, Puteanus U. Nurse survey NRW, GAA 2010. https://www.egms.de/static/de/meetings/gaa2010/10gaa05.shtml
- ZQP, Sicherheit bei der Medikation (surveys 2019, 2020, 2026). https://www.zqp.de/thema/medikation/
- Destatis Pflege (Pflegestatistik 2023). https://www.destatis.de/DE/Themen/Gesellschaft-Umwelt/Gesundheit/Pflege/_inhalt.html

Rules
- G-BA HKP-Richtlinie, version 16.10.2025, in force 12.12.2025. https://www.g-ba.de/downloads/62-492-3999/HKP-RL_2025-10-16_iK-2025-12-12.pdf
- QPR Teil 1a ambulant, Anlage 2 (AOK copy, 18.12.2019). https://www.aok.de/gp/fileadmin/user_upload/Pflege/Qualitaet_in_der_Pflege/Qualitaetspruefung/QPR_Teil_1a_AP_Anlage_2.pdf
- QPR vollstationär with Anlagen (MD WL copy). https://www.md-wl.de/fileadmin/MD-Westfalen-Lippe/user_upload/190527_QPR_vollstationaer.pdf
- HeimG §§ 11, 13. https://www.gesetze-im-internet.de/heimg/__11.html and https://www.gesetze-im-internet.de/heimg/__13.html
- ApoG § 12a. https://www.gesetze-im-internet.de/apog/__12a.html
- ApBetrO § 34. https://www.gesetze-im-internet.de/apobetro_1987/__34.html
- SGB V § 393. https://www.gesetze-im-internet.de/sgb_5/__393.html
- BGB § 630h. https://www.gesetze-im-internet.de/bgb/__630h.html

Feasibility and products
- Yaniv Z et al. NLM Pill Image Recognition Challenge (PMID 29854569). https://pubmed.ncbi.nlm.nih.gov/29854569/
- Larios Delgado N et al. npj Digit Med 2019 (PMID 31304359). https://pubmed.ncbi.nlm.nih.gov/31304359/
- Ashraf AR et al. Artif Intell Med 2024 (PMID 38553153). https://pubmed.ncbi.nlm.nih.gov/38553153/
- Holtkötter J et al. Sensors 2022 (PMID 35458941). https://pubmed.ncbi.nlm.nih.gov/35458941/
- Chu WI et al. MEDISEG (arXiv 2603.10825, preprint). https://arxiv.org/abs/2603.10825
- Liu H et al. JMIR AI 2026 (PMID 42612152). https://pubmed.ncbi.nlm.nih.gov/42612152/
- Luginbühl T, Sariyar M. Stud Health Technol Inform 2026 (PMID 42394078). https://pubmed.ncbi.nlm.nih.gov/42394078/
- Kim JY et al. JMIR Hum Factors 2026 (PMID 42727080). https://pubmed.ncbi.nlm.nih.gov/42727080/
- Tolley CL et al. MedEye feasibility study. BMC Med Inform Decis Mak 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC8962937/
- Outcomes PillCount. https://www.outcomes.com/pillcount
- Eyecon (vendor and press). https://www.scientistlive.com/intelligent-pill-counter-released-by-eyecon/
- McKesson PACVision. https://www.mckesson.com/automation/pouch-packaging-solutions/pacvision/
- Euclid Vantage Vision. https://www.healthcarepackaging.com/machinery/inspection/news/21139815/euclid-medical-products-euclid-medical-products-medication-pouch-verification
- RxSafe BlistAssist. https://rxsafe.com/?p=7821
- Laetus Polyphem wt. https://www.healthcarepackaging.com/machinery-materials/packaging-filling/product/21128756/laetus-multifaceted-blister-control-with-polyphem-wt
- Nurse Dottie (landing page). https://nursedottie-website.pages.dev/
- HiDO trial, UC Davis 2026. https://health.ucdavis.edu/medical-center/news/headlines/clinical-trial-tests-ai-assisted-medication-device-for-older-adults-with-memory-loss/2026/09
- Kajüter P et al. MediMan case study, HMD 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC9136781/
