# US pill look-alikes: how often can't a patient tell their own pills apart?

Analysis date 2026-11-13. Script: `tools/us-lookalike.py`. Data: ClinCalc DrugStats Top 300 (MEPS **2024**) and NLM DailyMed SPL (database as of 12 Nov 2026).

## 1. Headline

1. **Look-alikes are already common at 5 pills.** Take a patient on 5 of the most-prescribed US oral drugs. In **51%** of cases at least two of the pills share colour and shape. In **28%** they also fall in the same size class. At 10 pills the figures are **95% / 77%**.
2. **Context.** In 2017–Mar 2020, **43.0%** of US adults aged 65 and over took **5 or more** prescription drugs in the past 30 days (NCHS, *Health, United States*).
3. **White and round is the default.** Across 2,221 distinct top-200 pill products, **40%** are white, **42%** are round and **18%** are white *and* round. **99.5%** carry an imprint (21 CFR 206). In practice the imprint is the only reliable way to tell pills apart, and it is a few millimetres tall.
4. **The patient's own list does most of the work.** A photo described only by colour and shape fits a median of **41 of 163** top drugs (101 products). Within the patient's own 10-drug list the same pill has **1.6** candidates on average (median 1). Once colour, shape and size are known, the pill is unique in **77%** of cases.
5. **Appearance changes affect behaviour.** After a change in pill colour, the odds of stopping a drug rose by **27–34%**; after a change in shape, by **66%** (Kesselheim, JAMA IM 2013; Ann Intern Med 2014). **72%** of patients rely on pill appearance to be sure they take the right drug, and **21%** thought they had received the wrong drug after an appearance change (Sarpatwari, JGIM 2019).
6. **Administration errors are frequent, but wrong-drug errors are a small share.** The median medication administration error (MAE) rate in direct-observation studies is **19.6%** of doses, or **8.0%** excluding wrong-time errors (Keers 2013). In assisted living, "wrong drug" made up only **0.2%** of observed errors (Young 2008). The pitch should therefore focus on identifying loose pills at home and on admission, not on nurses picking the wrong pack.

## 2. Method

**Drug list.** ClinCalc DrugStats Top 300, ranks 1–200, with prescription counts for 2024 (MEPS 2024 prescribed-medicines file; page updated 9 Aug 2026).
- **37 of 200 drugs were excluded** because they are not predominantly oral solids: inhalers, injectables (insulins, GLP-1s, biologics), eye/nasal/topical products, a vaginal ring and PEG powder. Two more were excluded for other reasons: magnesium salts (a mixed group that cannot be mapped to one product) and melatonin (a dietary supplement without reliable SPLs). The full list is in the script.
- **163 drugs remain.** They account for 2.19 bn of the 2.51 bn prescriptions in the top 200 (**86.9%**).

**Appearance data.** DailyMed web services v2 (`spls.json?drug_name=…`, then `spls/{setid}.xml`), User-Agent `blisterkompass-research/0.1`, 3 concurrent requests with a 0.25 s pause.
- Per drug, up to **12 SPLs were sampled at random** (seed 20261113) from all oral tablet/capsule/kit labels whose title matched. This gives **1,925 SPLs and 2,909 products**.
- A product was kept only if all of the following held:
  - its form is TABLET\* or CAPSULE\* (excluding forms "for suspension", "for solution", effervescent or soluble);
  - its route is oral, sublingual or buccal;
  - its active ingredient set exactly matches the drug, so combination products are not counted under single drugs.
- From each product we read SPLCOLOR (multi-colour capsules become e.g. BLUE+ORANGE), SPLSHAPE, SPLSIZE (mm), SPLSCORE and SPLIMPRINT. No sampled product lacked colour, shape or size.
- The archived NLM Pillbox was not used, and I did not check whether it can still be downloaded.

**One pill per drug.**
- **Main analysis:** use the strength/release type found in the most sampled SPLs ("most commonly labelled strength"). Appearances are deduplicated by colour, shape, size and imprint, so repackaged copies of the same pill collapse into one. Each simulated patient gets one of the remaining distinct manufacturer appearances at random. This gives a mean of **5.0** appearances per drug.
- **Sensitivity analysis:** sample from all strengths instead (mean **13.6** appearances per drug).

**Simulation.**
- Draw N distinct drugs, weighted by 2024 prescription count. Weighted sampling without replacement uses the Efraimidis–Spirakis method.
- N = 3, 5, 8, 10, 12 and 15. **20,000 patients per N**, seed 20261113. Monte-Carlo SE is at most 0.35 percentage points.
- "Look-alike" means the same colour and shape (a), or additionally the same size class (b): ≤8 mm, >8–13 mm, >13 mm.

**Candidate count.**
- For one random pill per simulated patient, count how many products and distinct drugs in the whole top-200 universe have the same colour and shape (or colour, shape and size class).
- The universe is 2,221 distinct appearances across all strengths.
- Compare this with how many pills in the patient's own list match.

Key parameters: `TOP_N=200, SPL_PER_DRUG=12, SEED=20261113, N_LIST=[3,5,8,10,12,15], SIMS=20000, SIZE_CLASSES ≤8 / ≤13 / >13 mm`.

## 3. Results

### 3a. Share of patients with ≥2 indistinguishable pills (main analysis: most commonly labelled strength)

| Pills (N) | ≥2 same colour+shape | ≥2 same colour+shape+size class | Pills per patient in a look-alike group (colour+shape) | Mean group size | Groups with ≥3 pills |
|---|---|---|---|---|---|
| 3 | 19.5% | 9.5% | 0.40 | 2.05 | 4.9% |
| 5 | **50.5%** | **27.9%** | 1.17 | 2.14 | 12.6% |
| 8 | 84.6% | 59.3% | 2.76 | 2.29 | 24.0% |
| 10 | **94.9%** | **76.6%** | 4.04 | 2.40 | 30.8% |
| 12 | 98.5% | 88.3% | 5.35 | 2.51 | 36.1% |
| 15 | 99.8% | 96.2% | 7.42 | 2.66 | 41.8% |

With size class added, the number of pills per patient in a look-alike group is 0.19, 0.60, 1.54, 2.39, 3.31 and 4.83 (N = 3–15). The mean group size is 2.02–2.29.

Sensitivity analysis with any strength (≥2 same colour+shape / +size): N=3 22.0% / 11.2%; N=5 55.2% / 32.3%; N=8 87.9% / 64.8%; N=10 96.1% / 80.3%; N=12 99.1% / 90.4%; N=15 99.9% / 97.3%.

### 3b. Candidates for one photographed pill (no imprint read)

| | Colour+shape | Colour+shape+size class |
|---|---|---|
| Whole top-200 set: products, mean (median) | 159 (101) | 80 (≈50) |
| Whole top-200 set: distinct drugs, mean (median) of 163 | **48 (41)** | **30 (24)** |
| Own list N=5: candidates, mean / share unique | 1.29 / 76% | 1.14 / 88% |
| Own list N=10: candidates, mean / share unique | **1.63 / 60%** | **1.30 / 77%** |
| Own list N=15: candidates, mean / share unique | 1.99 / 50% | 1.46 / 68% |

For N=3, 8 and 12, the mean candidates / share unique are: colour+shape 1.15/86%, 1.48/66%, 1.79/55%; with size 1.07/93%, 1.23/81%, 1.37/72%.

Matching against the patient's own list cuts the candidates from about 40 drugs to about 1–2. The rest can be resolved by reading the imprint, scoring or size against the label data of fewer than 3 pills.

### 3c. What top-200 pills look like (2,221 distinct products; Rx-weighted modal-strength share in brackets)

- White 39.8% (42.0%); round 41.6% (42.8%); **white and round 17.7% (18.1%)**; ≤8 mm 33.3% (35.0%); SPL shape "CAPSULE" (capsules and caplets) 30.9%.
- **Imprint present: 99.5% (98.8%).**
- Most common colour+shape combinations: white round 394 (17.7%), white oval 257 (11.6%), white capsule-shape 191 (8.6%), yellow round 162 (7.3%), pink round 101 (4.5%).
- Clusters among the 30 most-prescribed oral drugs, by their most frequent appearance in our sample:
  - **white oval**: atorvastatin, metformin, losartan, furosemide, fluoxetine (10 mg tablet)
  - **white round**: amlodipine, escitalopram, bupropion, trazodone
  - **pink round**: lisinopril, metoprolol, rosuvastatin
  - **orange round**: hydrochlorothiazide, prednisone
  - **yellow round**: meloxicam, methylphenidate

## 4. Literature

**Pill appearance and behaviour**
- **Kesselheim AS et al., JAMA Intern Med 2013;173:202-8.** Antiepileptic drugs: 11,472 nonpersistent patients compared with 50,050 controls.
  - A colour change preceded nonpersistence with adjusted OR **1.27** (95% CI 1.04–1.55), and OR **1.53** (1.07–2.18) in patients with a seizure diagnosis.
  - A shape change gave OR 1.47 (0.85–2.54), which is not significant.
  - The drugs studied came in 37 colours and 4 shapes.
- **Kesselheim AS et al., Ann Intern Med 2014;161:96-103.** Patients on generic cardiovascular drugs after a heart attack:
  - **29%** (3,286 of 11,513) had a change in pill colour or shape within the year after their heart attack.
  - Nonpersistence after a colour change: OR **1.34** (1.12–1.59). After a shape change: OR **1.66** (1.43–1.94).
- **Sarpatwari A et al., J Gen Intern Med 2019;34:420-8.** Survey of 814 patients who experienced an appearance change:
  - **72%** rely on pill appearance to make sure they take the correct drug.
  - **21%** thought they had received the wrong medication, and **8%** changed how they took it.
  - Only **37%** recalled that the pharmacy notified them.
- **Barenie RE et al., Am J Manag Care 2020;26:340-7.** Surveys of 1,000 patients aged 50+ and 710 pharmacists:
  - **51%** of patients had experienced an appearance change; **12%** of those stopped the drug or used it less.
  - **47%** of pharmacists reported 6 or more appearance changes per month in their pharmacy.
- **Lenahan JL et al., J Health Commun 2013;18 Suppl 1:31-9.** 215 patients with hypertension (mean age 60):
  - **25.6%** could identify their antihypertensives only by appearance and **14.0%** could not identify them at all.
  - Compared with patients who knew the names, the "appearance only" group had RR **1.26** for uncontrolled blood pressure and RR **1.71** for hospitalisation in the past year (both p = .05).
- **Matuszewski K et al., P&T 2018;43:485-504.** 16 common generic drugs: on average **11 manufacturers, 3 colours, 2 shapes and 4 distinct colour+shape appearances** per drug.
- **Lumbreras B et al., J Patient Saf 2022;18:310-7** (systematic review): a change in pill or pack appearance affected patient behaviour in **7 of 10** studies.
- **Tranchard F et al., Therapie 2019;74:591-8** (France, 768 patients): **28%** named look-alike tablets as a likely cause of confusion. Pharmacists named appearance as a risk factor in **83%** of responses, physicians in **74%**.

**Medication administration by nurses and staff**
- **Barker KN et al., Arch Intern Med 2002;162:1897-903** (36 US hospitals and skilled nursing facilities, direct observation):
  - **19%** of doses (605/3,216) were in error. By category: wrong time 43%, omission 30%, wrong dose 17%, **unauthorised drug 4%**.
  - **7%** of errors were potential adverse drug events.
- **Keers RN et al., Ann Pharmacother 2013;47:237-56** (91 studies): median MAE rate **19.6%** (IQR 8.6–28.3%) including wrong-time errors, and **8.0%** (5.1–10.9%) without them. AHRQ PSNet's primer cites the same review as "8%–25%".
- **Berdot S et al., PLoS One 2013;8:e68856** (hospital inpatients): median rate **10.5%** excluding wrong-time errors.
- **Young HM et al., J Am Geriatr Soc 2008;56:1199-205** (assisted living, 4,866 observations):
  - Error rate **28.2%**, or 8.2% excluding wrong time.
  - **Wrong drug was 0.2%** of errors and unauthorised drug 1.5%.
- **Zimmerman S et al., J Am Geriatr Soc 2011;59:1060-8** (assisted living): error rate **42%** (20% excluding timing). **7%** of all administrations were errors with moderate or high potential for harm.
- **Pierson S et al., Qual Saf Health Care 2007;16:297-302** (25 North Carolina nursing homes, 631 reports):
  - **Wrong product 6%**, wrong strength 6%.
  - **47%** of errors occurred during administration.
- **Barber ND et al., Qual Saf Health Care 2009;18:341-6** (UK care homes, CHUMS): residents took a mean of **8.0** medicines, and **69.5%** had at least one medication error.
- **Rules:**
  - CMS requires a nursing-home medication error rate below 5% and no significant medication errors (42 CFR 483.45(f)).
  - The Joint Commission standard MM.03.01.05 requires hospitals to **identify and visually evaluate** medications that patients bring in before they are used. This wording comes from secondary sources; I could not open the current manual.

**Home care, hospital admission and self-management**
- **Meredith S et al., J Am Geriatr Soc 2001;49:719-24** (6,718 home-health patients aged 65+):
  - Median of **5 drugs**; **19%** took 9 or more.
  - A possible medication error was found in **30%** of patients, rising to **50%** of those on 9 or more drugs.
- **Gleason KM et al., J Gen Intern Med 2010;25:441-7** (MATCH study, admission):
  - **35.9%** of patients had medication order errors, and **85%** of those started in the medication history.
  - Bringing a medication list (OR 0.35) or bottles (OR 0.55, not significant) reduced risk.
- **Kiiski A et al., BMC Geriatr 2026** (Finland, qualitative, 21 families): medication safety risks and errors were found in **all** caregiving families, mostly at the administration step.
- **Jacob T et al., Endocrinol Diabetes Metab Case Rep 2018** (case report): two episodes of lactic acidosis after metformin tablets were mixed into a patient's supply of sevelamer.
- **Spiller HA & Griffith JR, Clin Toxicol 2009;47:253-5:**
  - In 2007, **25%** of all calls to US poison centers were pill-identification requests.
  - **64%** of these concerned drugs with abuse potential, and **10%** came from healthcare facilities.
- **Heo J et al., JMIR 2023;25:e41043:** an open pill-recognition system (US database) reached **74.5%** top-1 accuracy. This supports matching against a short list instead of the whole market.

**Regulation**
- **21 CFR 206.10** requires a code imprint on every solid oral dosage form. Together with size, shape and colour, the imprint must allow "unique identification of the drug product and the manufacturer or distributor". Exemptions (§206.7) cover investigational products, compounded drugs, radiopharmaceuticals, products where imprinting is technically infeasible, and drugs given only in healthcare facilities.
- **FDA guidance "Size, Shape, and Other Physical Attributes of Generic Tablets and Capsules"** (final June 2015, revised Oct 2022) addresses size and shape only. **No US rule requires a generic to match the colour of the brand or of other generics.**

## 5. Caveats

- **Coarse categories.** SPL colour (about 18 values) and shape are broad; "WHITE" includes off-white. So "same colour and shape" is an upper bound for visual confusion, while ignoring size, scoring, coating and gloss. Size in SPL is the longest dimension in whole mm. Real confusion also depends on eyesight, lighting and attention, none of which is modelled.
- **Strength choice.** The "most commonly labelled strength" is the strength found in the most SPLs, not the most-dispensed strength (fluoxetine gives 10 mg, although 20 mg capsules dominate). The any-strength sensitivity run moves the results by only 1–5 percentage points.
- **Manufacturer choice.** Manufacturers are picked uniformly among distinct appearances, not by market share (no public US data). Repackager labels were deduplicated by appearance.
- **Sample size.** 12 SPLs per drug may miss rare appearances. For cholecalciferol, empagliflozin and rimegepant only 2–9 labels were available.
- **Model assumptions.** Patients are simulated as independent draws weighted by population prescription volume. Real regimens are correlated (statin + ACE inhibitor + metformin), and that could raise or lower collisions. Each patient has one pill per drug, so split tablets and two strengths of the same drug are not modelled.
- **Scope.** Exclusions are a judgement call (for example semaglutide, budesonide, prednisolone). They cover 13.1% of top-200 prescription volume. OTC drugs are included where MEPS reports them as prescribed.
- **Not verified:**
  - Current official text of Joint Commission MM.03.01.05 (taken from secondary sources).
  - Whether the archived NLM Pillbox can still be downloaded.
  - No US study found that directly measures how often look-alike pills cause wrong-drug intake at home. The evidence is indirect: appearance-reliance surveys, adherence studies, case reports.

## 6. Sources

- ClinCalc DrugStats Top 300 Drugs (MEPS 2024; updated 9 Aug 2026): https://clincalc.com/DrugStats/Top300Drugs.aspx
- DailyMed web services v2 (SPL database 12 Nov 2026, accessed 13 Nov 2026): https://dailymed.nlm.nih.gov/dailymed/services/v2/
- NCHS, Health, United States – Prescription drug use (65+, ≥5 drugs: 2001–04 → 2017–Mar 2020): https://www.cdc.gov/nchs/hus/topics/rx-drug-use.htm
- 21 CFR 206.10 / 206.7: https://www.law.cornell.edu/cfr/text/21/206.10, https://www.law.cornell.edu/cfr/text/21/206.7
- FDA guidance, Size, Shape, and Other Physical Attributes of Generic Tablets and Capsules (Oct 2022): https://www.fda.gov/regulatory-information/search-fda-guidance-documents/size-shape-and-other-physical-attributes-generic-tablets-and-capsules
- 42 CFR 483.45 (2020 CFR edition): https://www.govinfo.gov/content/pkg/CFR-2020-title42-vol5/pdf/CFR-2020-title42-vol5-sec483-45.pdf
- AHRQ PSNet, Medication Administration Errors primer (updated Mar 2021): https://psnet.ahrq.gov/primer/medication-administration-errors
- Kesselheim 2013: https://pubmed.ncbi.nlm.nih.gov/23277164/ (doi:10.1001/2013.jamainternmed.997)
- Kesselheim 2014: https://pubmed.ncbi.nlm.nih.gov/25023248/ (doi:10.7326/M13-2381)
- Sarpatwari 2019: https://pubmed.ncbi.nlm.nih.gov/30632102/
- Barenie 2020: https://pubmed.ncbi.nlm.nih.gov/32835461/
- Lenahan 2013: https://pmc.ncbi.nlm.nih.gov/articles/PMC3815114/
- Matuszewski 2018: https://pubmed.ncbi.nlm.nih.gov/30100689/
- Lumbreras 2022: https://pubmed.ncbi.nlm.nih.gov/35452203/
- Tranchard 2019: https://pubmed.ncbi.nlm.nih.gov/31014975/
- Barker 2002: https://pubmed.ncbi.nlm.nih.gov/12196090/
- Keers 2013: https://pubmed.ncbi.nlm.nih.gov/23386063/
- Berdot 2013: https://pubmed.ncbi.nlm.nih.gov/23818992/
- Young 2008: https://pubmed.ncbi.nlm.nih.gov/18482296/
- Zimmerman 2011: https://pubmed.ncbi.nlm.nih.gov/21649628/
- Pierson 2007: https://pubmed.ncbi.nlm.nih.gov/17693679/
- Barber 2009 (CHUMS): https://pubmed.ncbi.nlm.nih.gov/19812095/
- Meredith 2001: https://pubmed.ncbi.nlm.nih.gov/11454109/
- Gleason 2010 (MATCH): https://pubmed.ncbi.nlm.nih.gov/20180158/
- Kiiski 2026: https://pubmed.ncbi.nlm.nih.gov/42215890/
- Jacob 2018: https://pubmed.ncbi.nlm.nih.gov/29340159/
- Spiller 2009: https://pubmed.ncbi.nlm.nih.gov/19225960/
- Heo 2023: https://pubmed.ncbi.nlm.nih.gov/36637893/
