// Port of ios/checks/main.swift: same fixtures (ios/PillSnap/Examples/plans/*.xml), same names, same expectations.
// Run: npm test (node --test, no dependencies).
process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as PlanReader from "../js/plan-reader.js";
import * as Pack from "../js/pack-code.js";
import * as Matcher from "../js/matcher.js";
import { product, adding, sections, spokenLines, spokenWhen, whenText, pznName, nameStrength, countText, doseSymbol, NOT_RECORDED } from "../js/model.js";
import { doseForm, unitOf, bmpForm } from "../js/dose-form.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const json = (p) => JSON.parse(fs.readFileSync(here(p), "utf8"));
const all = json("../data/catalog.json");
const rawNames = json("../data/pzn-names.json");
const plan = (name) => fs.readFileSync(here(`../../ios/PillSnap/Examples/plans/${name}.xml`), "utf8");
const myMeds = (name) => PlanReader.resolve(PlanReader.items(plan(name)), all).meds;
const look = (pzn) => all.find((m) => m.pzn === pzn).look;
const cues = (l, imprint = null) => ({ found: true, colors: [l.color, l.color2].filter((x) => x != null), shape: l.shape, imprint });
const check = (name, ok) => test(name, () => assert.ok(ok()));
const eq = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch { return false; } };

// Plan reader
const itemsA = PlanReader.items(plan("plan-a"));
const planA = PlanReader.resolve(itemsA, all);
const sub = (meds, s) => meds.find((m) => m.substance === s);
check("plan A: 12 entries, all with a known look", () => itemsA.length === 12 && planA.meds.length === 12 && planA.unknown.length === 0);
check("plan A: Metformin 1-0-1-0", () => eq(sub(planA.meds, "Metformin")?.schedule?.amounts, { morning: 1, evening: 1 }));
check("plan A: Methotrexat weekly on Monday (wo=1)", () => { const s = sub(planA.meds, "Methotrexat")?.schedule; return s?.kind === "weekly" && eq(s.days, ["mon"]); });
check("plan A: Ibuprofen as needed (section 411)", () => sub(planA.meds, "Ibuprofen")?.schedule?.kind === "prn");
check("plan A: printed with Ramipril Nordapharm", () => sub(planA.meds, "Ramipril")?.manufacturer === "Nordapharm");

const kbvItems = PlanReader.items(plan("plan-kbv-beispiel"));
const kbv = PlanReader.resolve(kbvItems, all);
check("KBV sample: 7 entries read", () => kbvItems.length === 7);
// Changed with BMP 2.8 fixes: a line without PZN no longer borrows a catalog product's picture by substance (INV-05/15).
check("KBV sample: line without PZN <W w=Ramipril s=5 mg> keeps its substance, no guessed picture", () => kbv.meds.some((m) => m.substance === "Ramipril" && m.strength === "5 mg" && m.look === null && m.pzn === null));
check("KBV sample: lines without a catalog look stay unknown (not guessed)", () => kbv.unknown.length === 5 && kbv.unknown.filter((u) => u.startsWith("PZN ")).length === 4 && kbv.unknown.includes("Ramipril 5 mg"));
check("KBV sample: PZNs zero-padded to 8", () => kbvItems.filter((i) => i.pzn != null).every((i) => i.pzn.length === 8));
check("KBV sample: no person data read", () => !JSON.stringify(kbvItems).includes("Musterhausen") && !JSON.stringify(kbvItems).includes("B987563276"));
check("not a plan → nil", () => PlanReader.items("hello") === null);
const one = (m, s = "<S>") => PlanReader.items(`<MP v="028" U="0" l="de-DE">${s}${m}</S></MP>`)?.[0]?.schedule;
check("dose 1/2 (spec notation) is half a tablet", () => eq(one('<M p="1" m="1/2"/>')?.amounts, { morning: 0.5 }));
check("doses ½, 0,5, 1/4 and 1 read as numbers", () => eq(["½", "0,5", "1/4", "1"].map(PlanReader.num), [0.5, 0.5, 0.25, 1]));
check('free text "1x wöchentl. Montag" is weekly on Monday', () => { const s = one('<M p="1" t="1x wöchentl. Montag"/>'); return s?.kind === "weekly" && eq(s.days, ["mon"]); });
check("section 425 is weekly", () => one('<M p="1" m="1"/>', '<S c="425">')?.kind === "weekly");
check('free-text heading <S t="Bedarfsmedikation"> is as needed', () => one('<M p="1" t="max. 3"/>', '<S t="Bedarfsmedikation">')?.kind === "prn");
check("free-text heading also covers entries with times", () => one('<M p="1" h="1" i="bei Bedarf"/>', '<S t="Bedarfsmedikation">')?.kind === "prn");

// Matcher – plan A
const medivia = look("18342014"); // pink round "5" – pharmacy switch
let a = Matcher.answer(planA.meds, all, cues(medivia, "5"));
check("Ramipril Medivia photo → other_maker Ramipril", () => a.state === "other_maker" && a.candidates[0]?.substance === "Ramipril" && a.notOnPlan?.manufacturer === "Medivia");
const a2 = Matcher.answer(planA.meds, all, cues(medivia));
check("… also without the imprint (German product preferred)", () => a2.state === "other_maker" && a2.candidates[0]?.substance === "Ramipril");
const amlo = look("91200130");
const a3 = Matcher.answer(planA.meds, all, cues(amlo, "AM5"));
check("Amlodipin on plan A → not_on_plan", () => a3.state === "not_on_plan" && a3.notOnPlan?.substance === "Amlodipin");
const a4 = Matcher.answer(myMeds("plan-b"), all, cues(amlo, "AM5"));
check("same Amlodipin photo on plan B → yours", () => ["sure", "likely"].includes(a4.state) && a4.candidates[0]?.substance === "Amlodipin");
const a5 = Matcher.answer(planA.meds, all, cues(look("30477231"), "A20"));
check("Atorvastatin A20 on plan A → sure", () => a5.state === "sure" && a5.candidates[0]?.substance === "Atorvastatin");
const a6 = Matcher.answer(planA.meds, all, cues(look("30477231")));
check("same look, imprint not read → never sure", () => a6.state !== "sure");
const a7 = Matcher.answer(planA.meds, all, { found: true, colors: ["white"] });
check("white only → choose + a question", () => a7.state === "choose" && a7.candidates.length >= 2 && a7.question != null);
const a8 = Matcher.answer(planA.meds, all, { found: true, colors: ["white"], shape: "oblong", imprint: "1400" });
check("OCR look-alike I400 read as 1400 → Ibuprofen", () => a8.candidates[0]?.substance === "Ibuprofen");

// Pack codes (securPharm Data Matrix) – official vectors from the official IFA test vectors (IFA PPN-Code spec V3.06)
const ifa = Pack.parse("[)>\u001e06\u001d9N111234567842\u001d1T1A234B5\u001dD151231\u001dS1234567890123456\u001e\u0004");
const code = (pzn, batch = null, expiry = null, serial = null) => ({ pzn, batch, expiry, serial });
check("pack IFA: PZN, batch, expiry, serial", () => eq(ifa, code("12345678", "1A234B5", "151231", "1234567890123456")));
check("pack IFA as zxing text (visible ␝ ␞ symbols)", () => Pack.parse("[)>␞06␝9N111234567842␝1T1A234B5␝D151231␝S1234567890123456␞␄")?.pzn === "12345678");
check("pack GS1 human-readable", () => eq(Pack.parse("(01)04150123456782(10)1A234B5(17)151231(21)1234567890123456"), ifa));
check("pack GS1 raw with GS separators", () => eq(Pack.parse("0104150123456782101A234B5\u001d17151231211234567890123456"), ifa));
check("PZN check digit: valid / wrong / 7 digits", () => Pack.pznValid("27580899") && !Pack.pznValid("27580898") && !Pack.pznValid("1234567"));
check("expiry: 12/2015 expired, 03/2028 not, day 00 = end of month", () => Pack.isExpired(ifa) && !Pack.isExpired(code("x", null, "280331")) && Pack.expiryText(code("x", null, "280300")) === "03/2028");
check("not a pack code → nil", () => Pack.parse("hello") === null && Pack.parse("9N119999999999") === null);
check("Code 39 PZN barcode: PZN8, PZN7, PZN- prefix; no batch/expiry", () => eq(Pack.parse("-05387239"), code("05387239")) && Pack.parse("-5387239")?.pzn === "05387239" && Pack.parse("PZN-05387239")?.pzn === "05387239");
check("Code 39: wrong check digit or no dash → nil", () => Pack.parse("-05387238") === null && Pack.parse("05387239") === null);

const ctx = (meds, unknownPZNs = []) => ({ myMeds: meds, unknownPZNs, catalog: all, names: rawNames });
function pack(pzn, planName) {
  const p = PlanReader.resolve(PlanReader.items(plan(planName)), all, rawNames);
  return Pack.evaluate(code(pzn), ctx(p.meds, p.unknownPZNs));
}
check("pack Atorvastatin Alpinmed on plan A → on plan", () => pack("30477231", "plan-a").kind === "onPlan");
const switched = pack("18342014", "plan-a");
check("pack Ramipril Medivia, plan A has Nordapharm → other maker", () => switched.kind === "otherMaker" && switched.mine?.manufacturer === "Nordapharm");
const aspirin = pack("05387239", "plan-a");
check("pack Aspirin N 100 (Code 39 only) on plan A → other maker of its ASS, name from PZN list", () => aspirin.kind === "otherMaker" && aspirin.mine?.substance === "Acetylsalicylsäure" && aspirin.name?.name === "ASPIRIN N 100MG");
check("pack Aspirin N: same substance and strength, plan form unknown → possible switch, never 'same medicine'", () => aspirin.kind === "otherMaker" && aspirin.difference === null);
check("strength from the PZN name: ASPIRIN N 100MG → 100 mg; ASS AL 100 TAH → none", () => nameStrength(pznName(rawNames, "05387239")) === "100 mg" && nameStrength(pznName(rawNames, "03024314")) === null);
const ass500 = pack("20285648", "plan-a");
check("Aspirin 500 mg on plan A (ASS 100 mg) → same substance, other strength, no switch, no add", () => ass500.kind === "sameSubstance" && ass500.difference === "aber eine andere Stärke" && !Pack.canAdd(ass500));
check("ASS AL 100 (no unit in the name) on plan A → same substance, strength unknown", () => pack("03024314", "plan-a").kind === "sameSubstance" && pack("03024314", "plan-a").difference === "die Stärke ist unbekannt");
const plainASS = { ...sub(planA.meds, "Acetylsalicylsäure"), pzn: "06312060" }; // ASS 100 1A Pharma, TABL
const protect = Pack.evaluate(code("06706149"), ctx([plainASS]));
check("Aspirin protect (gastro-resistant) vs plain ASS tablet on the plan → same substance, other form", () => protect.kind === "sameSubstance" && protect.difference === "aber eine andere Darreichungsform");
check("pack Amlodipin on plan A → not on plan; on plan B → on plan", () => pack("91200130", "plan-a").kind === "notOnPlan" && pack("91200130", "plan-b").kind === "onPlan");
check("pack Cefaclor STADA (no look) on KBV plan → on plan, name from PZN list", () => pack("08693497", "plan-kbv-beispiel").kind === "onPlanNoLook" && pznName(rawNames, "08693497")?.substance === "Cefaclor");
check("KBV plan: unknown entries named from the PZN list", () => PlanReader.resolve(kbvItems, all, rawNames).unknown.some((u) => u.includes("CEFACLOR STADA")));
// Looks from German package leaflets (tools/add-leaflet-looks.py)
check("KBV plan: HCT 1A Pharma and MTX HEXAL now with their leaflet look", () => kbv.meds.some((m) => m.pzn === "06453257" && m.look.source?.startsWith("leaflet:")) && kbv.meds.some((m) => m.pzn === "03159468" && m.look.color === "yellow"));
const aspirinN = Pack.evaluate(code("05387239"), ctx([]));
check("Aspirin N 100 mg pack → white, round, 7 mm from the leaflet; score not stated → nil", () => { const l = aspirinN.product?.look; return l?.color === "white" && l.shape === "round" && l.lengthMm === 7 && l.score == null; });
check("another pack size of the same product resolves, keeping the scanned PZN", () => { const m = product(all, "06453174"); return m?.name.startsWith("HCT - 1 A Pharma") && m.pzn === "06453174"; });
check("dosage form from the PZN list: TABL tablet, KAPS capsule, AUGT drops, unknown code nil", () => doseForm("TABL")?.family === "tablet" && doseForm("KAPS")?.family === "capsule" && doseForm("AUGT")?.family === "drops" && doseForm("XYZ") === null);

// Adding a scanned pack to the plan
const amloPack = code("91200130"); // Amlodipin Alpinmed 5 mg, not on plan A
const before = Pack.evaluate(amloPack, ctx(planA.meds));
check("pack not on plan A → can be added", () => before.kind === "notOnPlan" && Pack.canAdd(before) && before.product != null);
const added = { ...before.product, schedule: { kind: "daily", slots: ["evening"], amounts: { evening: 1 }, days: [], note: null, text: null } };
const planPlus = adding(planA.meds, added);
check("added pack: on the plan afterwards, with its schedule", () => Pack.evaluate(amloPack, ctx(planPlus)).kind === "onPlan" && planPlus.length === 13);
check("adding the same PZN again replaces, no duplicate", () => adding(planPlus, added).length === 13);
const cefPack = code("08693497"); // Cefaclor STADA, no picture data
const cef = Pack.evaluate(cefPack, ctx(planA.meds));
check("pack without picture data can be added by name", () => Pack.canAdd(cef) && cef.product === null && cef.name != null);
check("…and then counts as on the plan", () => Pack.evaluate(cefPack, ctx(planA.meds, ["08693497"])).kind === "onPlanNoLook");
check("pack already on the plan → no add button", () => !Pack.canAdd(Pack.evaluate(code(planA.meds[0].pzn), ctx(planA.meds))));

// Day view: now / later by the clock (Europe/Berlin)
const at = (h, weekday = 3) => new Date(2026, 10, 7 + weekday, h, 30); // 2026-11-10 is a Tuesday; weekday 3 = Tue … 2 = Mon
const evening = sections(planA.meds, at(18));
const slotOf = (secs, s) => secs.find((x) => x.kind === "slot" && x.slot === s);
check("18:30 → first section is evening, marked now", () => evening[0]?.kind === "slot" && evening[0].slot === "evening" && evening[0].now === true);
// Changed with T-06: at 18:30 the morning slot is today's, already past – never "tomorrow" (a patient could skip it at 11:05).
check("18:30 → night later today, morning earlier today (past, never tomorrow)", () => slotOf(evening, "night")?.past === false && slotOf(evening, "morning")?.past === true && evening.every((s) => s.tomorrow === false));
check("18:30 → Metformin due now with 1", () => evening[0]?.entries.find((e) => e.med.substance === "Metformin")?.amount === 1);
check("as-needed last, never now", () => { const l = evening.at(-1); return l?.kind === "prn" && l.now === false && l.entries.some((e) => e.med.substance === "Ibuprofen"); });
const monday = sections(planA.meds, at(8, 2));
// Changed with BMP 2.8 fixes: the weekly med sits in its own slot on its day (was a "today" block marked now all day).
check("Monday 08:30 → morning now, Methotrexat in it (weekly, with its dose)", () => monday[0]?.slot === "morning" && monday[0].entries.some((e) => e.med.substance === "Methotrexat" && e.weekly && e.amount === 1) && !monday.some((s) => s.kind === "weeklyToday"));
check("Tuesday → Methotrexat not due today, listed under this week", () => !evening.some((s) => s.kind === "weeklyToday") && evening.some((s) => s.kind === "weeklyLater" && s.entries.some((e) => e.med.substance === "Methotrexat")));
const late = sections(planA.meds, at(2));
check("02:30 → morning is today, not tomorrow", () => slotOf(late, "morning")?.tomorrow === false);

// Readout: plain sentences, grouped by time of day, what the pill looks like (fixed templates)
const said = spokenLines(evening);
check("readout starts with 'Jetzt, heute Abend.' and a count", () => /^Jetzt, heute Abend\. \S+ Medikamente?\.$/.test(said[0]));
check("readout names Metformin with amount and look", () => said.some((l) => /^Metformin, eine Tablette, .+\.$/.test(l)));
check("readout goes on with 'Heute zur Nacht' and 'Heute früh, schon vorbei'", () => said.some((l) => l.startsWith("Heute zur Nacht.")) && said.some((l) => l.startsWith("Heute früh, schon vorbei.")) && !said.some((l) => l.startsWith("Morgen")));
check("readout has no symbols or units the voice stumbles over", () => said.every((l) => !/[½¼·]|\bmg\b/.test(l)));

// BMP 2.8 (Anlage 3, bmp_V2.8.xsd): what the plan says is kept as it says it – PWA only for now (TODO.md: iOS counterpart)
const ins = kbv.meds.find((m) => m.pzn === "00544786");
check("KBV: insulin 20-0-10 IE without a look keeps dose and unit (du=p → IE), shown in its slots", () => eq(ins?.schedule?.amounts, { morning: 20, evening: 10 }) && ins.schedule.unit === "IE" && ins.look === null
  && sections(kbv.meds, at(8, 2))[0].entries.some((e) => e.med === ins && countText(e.amount, ins.look, ins.schedule.unit, e.dose) === "20 IE"));
check("KBV: weekly MTX (wo=1, m=1) keeps its dose and Monday", () => { const s = kbv.meds.find((m) => m.pzn === "03159468")?.schedule; return s?.kind === "weekly" && eq(s.days, ["mon"]) && eq(s.amounts, { morning: 1 }); });
check("KBV: Cefaclor keeps its bound extra line (x) and block 424", () => { const m = kbv.meds.find((x) => x.pzn === "08693497"); return m?.extra?.includes("für 10 Tage") && m.sectionLabel === "zeitlich befristet anzuwendende Medikamente"; });
check("KBV: nitro spray as needed, 'max. 3', unit Hub (du=5)", () => { const s = kbv.meds.find((m) => m.pzn === "16357856")?.schedule; return s?.kind === "prn" && s.text === "max. 3" && s.unit === "Hub"; });
check("the plan's reason (r) replaces the catalog purpose; none when the plan has none", () => sub(planA.meds, "Ramipril")?.indication?.de === "Blutdruck" && sub(planA.meds, "Pantoprazol")?.indication == null);
const line = (m, s = "<S>") => PlanReader.items(`<MP v="028" U="0" l="de-DE">${s}${m}</S></MP>`)?.[0];
check("combination product: all <W> kept", () => { const it = line('<M p="1"><W w="Valsartan" s="160 mg"/><W w="Hydrochlorothiazid" s="25 mg"/></M>'); return it.substance === "Valsartan / Hydrochlorothiazid" && it.strength === "160 mg / 25 mg"; });
check("a plan PZN outside the catalog keeps its PZN, never another product's (no substance fallback)", () => { const m = PlanReader.resolve([line('<M p="99999999" m="1"><W w="Ramipril" s="5 mg"/></M>')], all).meds[0]; return m.pzn === "99999999" && m.look === null && m.substance === "Ramipril"; });
check('free text "1-0-0 für 2 Wochen" and "nach INR" stay free text, as written', () => line('<M p="1" t="1-0-0 für 2 Wochen"/>').schedule.kind === "text" && line('<M p="1" t="nach INR"/>').schedule.text === "nach INR");
check("doses: 1/8, 3/4, mixed 1½ and 1 1/2 read right; shown as ¾, ½ and 1,5", () => eq(["1/8", "3/4", "1½", "1 1/2"].map(PlanReader.num), [0.125, 0.75, 1.5, 1.5]) && doseSymbol("3/4") === "¾" && doseSymbol("1,5") === "1,5" && countText(0.5, look("30477231"), "Stück", "1/2") === "½ Tablette");
check("units: du p → IE, dud free text, none → null (no default)", () => unitOf("p") === "IE" && unitOf(null, "Hub") === "Hub" && unitOf(null, null) === null);
check("form of a plan line: KBV code FTA → film tablet; free text kept", () => bmpForm("FTA")?.family === "tablet" && bmpForm(null, "Fertigpen")?.label === "Fertigpen");
check("block headings 411–425 and free text are kept (418 Selbstmedikation)", () => line('<M p="1" m="1"/>', '<S c="418">').sectionLabel === "Selbstmedikation" && line('<M p="1" m="1"/>', '<S t="Zur Kur">').sectionLabel === "Zur Kur");
const notes = PlanReader.read('<MP v="028" U="0" l="de-DE"><S c="419"><X t="Penicillin-Allergie"/></S><S><R t="Salbe nach Rezeptur" x="2x täglich"/></S></MP>');
check("X free-text lines are read as notes, R as a compounded medicine", () => notes.notes[0]?.text === "Penicillin-Allergie" && notes.notes[0].section === "Allergiehinweise" && notes.items[0]?.kind === "recipe" && notes.items[0].extra === "2x täglich");
const pg = (a, z, m) => PlanReader.read(`<MP v="028" U="ABC" l="de-DE" a="${a}" z="${z}"><S>${m}</S></MP>`);
check("multi-page plan: pages with one U merge in page order; a missing page is reported", () => { const one = PlanReader.mergePages([pg(2, 2, '<M p="2" m="1"/>'), pg(1, 2, '<M p="1" m="1"/>')]); const part = PlanReader.mergePages([pg(1, 3, '<M p="1" m="1"/>')]); return one.items.map((i) => i.pzn).join() === "00000001,00000002" && one.missing.length === 0 && eq(part.missing, [2, 3]); });
const mondayEvening = sections(planA.meds, at(20, 2));
const mtxNext = (secs) => secs.find((s) => s.kind === "weeklyLater")?.entries.find((e) => e.med.substance === "Methotrexat")?.next;
check("Monday 20:30 → Methotrexat no longer due today, next Monday 16.11.", () => !mondayEvening.some((s) => s.kind === "slot" && s.entries.some((e) => e.med.substance === "Methotrexat")) && mtxNext(mondayEvening)?.getDate() === 16);
check("Tuesday → next Monday 16.11., read aloud with the date (no 'Diese Woche noch')", () => mtxNext(evening)?.getDate() === 16 && spokenLines(evening).some((l) => l.startsWith("Methotrexat, nächster Montag, 16. November")) && !spokenLines(evening).some((l) => l.includes("Diese Woche noch")));
check("pill matcher ignores plan lines without a look", () => { const r = Matcher.answer(kbv.meds, all, { found: true, colors: ["yellow"], shape: "round" }); return r.candidates.every((m) => m.look); });

// The last two Swift checks sit after exit() and never run there; they run here.
const leafletLooks = all.filter((m) => m.look.source?.startsWith("leaflet:"));
// Public repo: the leaflet's own words are not shipped (no licence to republish them); each look keeps its leaflet link.
check("31 leaflet products, each with its package-leaflet source link", () => leafletLooks.length === 31 && leafletLooks.every((m) => /^leaflet:https:\/\//.test(m.look.source) && m.look.leaflet == null));
const naratriptan = Pack.evaluate(code("09321616"), ctx([]));
check("non-prescription pack outside the Festbetrag list (Naratriptan-ratiopharm 09321616) → green, round, \"NT 2,5\" from its leaflet", () => { const l = naratriptan.product?.look; return l?.color === "green" && l.shape === "round" && l.imprint === "NT 2,5" && Pack.canAdd(naratriptan); });
check("found automatically by PZN: Bisoprolol 5 – 1 A Pharma is yellow, round, cross score", () => { const l = product(all, "03820206")?.look; return l?.color === "yellow" && l.shape === "round" && l.score === "cross"; });

// Submission review 13 Nov 2026 (docs/review in the lab): fixes, paired with ios/checks/main.swift under the same names.

// T-04: a look-alike in another strength is never "another maker" of the plan entry.
const pregabalin300 = all.find((m) => m.substance === "Pregabalin" && m.strength === "300 mg" && m.market !== "US");
const p300 = Matcher.answer(planA.meds, all, cues(pregabalin300.look, pregabalin300.look.imprint ?? null));
check("Pregabalin 300 mg look on plan A (75 mg) → other_strength, shown with its own title", () => p300.state === "other_strength" && p300.candidates[0]?.strength === "75 mg" && p300.notOnPlan?.strength === "300 mg");
check("no catalog look of another strength of a plan A drug gives other_maker", () => all
  .filter((m) => planA.meds.some((x) => x.substance === m.substance && x.strength !== m.strength))
  .every((m) => Matcher.answer(planA.meds, all, cues(m.look, m.look.imprint ?? null)).state !== "other_maker"));
// T-05: without a read imprint and a size, every colour-fitting plan pill stays a candidate.
const offwhiteOval = Matcher.answer(planA.meds, all, { found: true, colors: ["offwhite"], shape: "oval", imprint: null });
check("off-white oval, no imprint, size unknown → choose, Metformin among the candidates", () => offwhiteOval.state === "choose" && offwhiteOval.candidates.some((m) => m.substance === "Metformin") && offwhiteOval.candidates.length >= 3);
check("score-line question says nothing about splitting (INV-14)", () => !Matcher.question(planA.meds.filter((m) => m.look), { colors: ["white"], shape: "round" })?.question.includes("Teilen"));
// T-06: 11:05 and 00:30
const elevenOFive = sections(planA.meds, new Date(2026, 10, 13, 11, 5));
check("11:05 → morning drugs are today's, past – not tomorrow", () => slotOf(elevenOFive, "morning")?.past === true && slotOf(elevenOFive, "morning")?.entries.length === 7 && elevenOFive.every((s) => !s.tomorrow));
const halfPastMidnight = sections(planA.meds, new Date(2026, 10, 14, 0, 30));
check("00:30 → night slot is last night's, never 'now' again", () => slotOf(halfPastMidnight, "night")?.lastNight === true && slotOf(halfPastMidnight, "night")?.now === false && !halfPastMidnight.some((s) => s.now));
check("readout says the app records no intake; past and last-night slots are spoken as such", () => spokenLines(evening).at(-1) === NOT_RECORDED
  && spokenWhen("morning", { past: true }) === "Heute früh, schon vorbei" && spokenWhen("night", { lastNight: true }) === "Zur Nacht, seit gestern Abend");
// T-13: an amount nobody gave stays unknown.
check("no amount on the plan → no number in the dosing text", () => { const t = whenText({ schedule: { kind: "daily", slots: ["morning"], amounts: {}, days: [] } }); return t === "morgens (Menge nicht angegeben)" && !/eine|\d/.test(t); });
// BMP 2.8 contract: refused with a reason, never read half-way (also "do not turn malformed doses into zero").
const bmp = (attrs, m) => PlanReader.read(`<MP ${attrs}><S>${m}</S></MP>`);
check("plan code of another version (v=999) → refused: version", () => bmp('v="999" U="0" l="de-DE"', '<M p="1" m="1"/>')?.invalid === "version");
check("plan code with a 13-digit PZN → refused: pzn", () => bmp('v="028" U="0" l="de-DE"', '<M p="1234567890123" m="1"/>')?.invalid === "pzn" && PlanReader.items('<MP v="028" U="0" l="de-DE"><S><M p="1234567890123" m="1"/></S></MP>') === null);
check("plan code with a dose that is no number (m=wrong) → refused: dose, never 0", () => bmp('v="028" U="0" l="de-DE"', '<M p="1" m="wrong"/>')?.invalid === "dose" && PlanReader.dose("wrong") === null && PlanReader.dose("") === 0);
check("plan code with weekday 9 or page 3 of 2 → refused", () => bmp('v="028" U="0" l="de-DE"', '<M p="1" m="1" wo="9"/>')?.invalid === "weekday" && bmp('v="028" U="0" l="de-DE" a="3" z="2"', '<M p="1" m="1"/>')?.invalid === "page");
check("the review's sample <MP v=999><M p=1234567890123 m=wrong> is refused", () => PlanReader.read('<MP v="999"><S><M p="1234567890123" m="wrong"/></S></MP>')?.invalid != null);
check("all example plans still read (v=028, valid PZNs and doses)", () => ["plan-a", "plan-b", "plan-c", "plan-kbv-beispiel"].every((n) => PlanReader.read(plan(n))?.items?.length > 0));

