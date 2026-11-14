// Offline checks for the on-phone logic (plan reader + matcher). Run: ios/checks/run.sh
import Foundation

var failed = 0, passed = 0
func check(_ name: String, _ ok: @autoclosure () -> Bool) {
    if ok() { passed += 1; print("✓ \(name)") } else { failed += 1; print("✗ \(name)") }
}
func cues(_ look: Look, imprint: String? = nil) -> PillCues {
    PillCues(found: true, colors: [look.color] + [look.color2].compactMap { $0 }, shape: look.shape, imprint: imprint)
}
let all = AppData.catalog

// Plan reader
let itemsA = PlanReader.items(in: AppData.plan("plan-a"))!
let planA = PlanReader.resolve(itemsA, catalog: all)
check("plan A: 12 entries, all with a known look", itemsA.count == 12 && planA.meds.count == 12 && planA.unknown.isEmpty)
check("plan A: Metformin 1-0-1-0", planA.meds.first { $0.substance == "Metformin" }?.schedule?.amounts == ["morning": 1, "evening": 1])
check("plan A: Methotrexat weekly on Monday (wo=1)", planA.meds.first { $0.substance == "Methotrexat" }?.schedule.map { $0.kind == "weekly" && $0.days == ["mon"] } == true)
check("plan A: Ibuprofen as needed (section 411)", planA.meds.first { $0.substance == "Ibuprofen" }?.schedule?.kind == "prn")
check("plan A: printed with Ramipril Nordapharm", planA.meds.first { $0.substance == "Ramipril" }?.manufacturer == "Nordapharm")

let kbvItems = PlanReader.items(in: AppData.plan("plan-kbv-beispiel"))!
let kbv = PlanReader.resolve(kbvItems, catalog: all)
check("KBV sample: 7 entries read", kbvItems.count == 7)
// Changed with the review fix (as in the web app): a line without PZN no longer borrows a catalog product's picture by substance (INV-05/15).
check("KBV sample: lines without a catalog look stay unknown (not guessed)", kbv.unknown.count == 5 && kbv.unknown.filter { $0.hasPrefix("PZN ") }.count == 4 && kbv.unknown.contains("Ramipril 5 mg") && !kbv.meds.contains { $0.substance == "Ramipril" })
check("KBV sample: PZNs zero-padded to 8", kbvItems.compactMap(\.pzn).allSatisfy { $0.count == 8 })
check("KBV sample: no person data read", !"\(kbvItems)".contains("Musterhausen") && !"\(kbvItems)".contains("B987563276"))
check("not a plan → nil", PlanReader.items(in: "hello") == nil)
// Real-world notations (KBV spec v2.8; the spec's own sample code, figure 6)
func one(_ m: String, section s: String = "<S>") -> Schedule? { PlanReader.items(in: "<MP v=\"028\" U=\"0\" l=\"de-DE\">\(s)\(m)</S></MP>")?.first?.schedule }
check("dose 1/2 (spec notation) is half a tablet", one(#"<M p="1" m="1/2"/>"#)?.amounts == ["morning": 0.5])
check("doses ½, 0,5, 1/4 and 1 read as numbers", [PlanReader.num("½"), PlanReader.num("0,5"), PlanReader.num("1/4"), PlanReader.num("1")] == [0.5, 0.5, 0.25, 1])
check("free text \"1x wöchentl. Montag\" is weekly on Monday", one(#"<M p="1" t="1x wöchentl. Montag"/>"#).map { $0.kind == "weekly" && $0.days == ["mon"] } == true)
check("section 425 is weekly", one(#"<M p="1" m="1"/>"#, section: #"<S c="425">"#)?.kind == "weekly")
check("free-text heading <S t=\"Bedarfsmedikation\"> is as needed", one(#"<M p="1" t="max. 3"/>"#, section: #"<S t="Bedarfsmedikation">"#)?.kind == "prn")
check("free-text heading also covers entries with times", one(#"<M p="1" h="1" i="bei Bedarf"/>"#, section: #"<S t="Bedarfsmedikation">"#)?.kind == "prn")


// Matcher – plan A
let medivia = AppData.look("18342014")   // pink round "5" – pharmacy switch
var a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues(medivia, imprint: "5"))
check("Ramipril Medivia photo → other_maker Ramipril", a.state == "other_maker" && a.candidates?.first?.substance == "Ramipril" && a.notOnPlan?.manufacturer == "Medivia")
a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues(medivia))
check("… also without the imprint (German product preferred)", a.state == "other_maker" && a.candidates?.first?.substance == "Ramipril")
let amlo = AppData.look("91200130")
a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues(amlo, imprint: "AM5"))
check("Amlodipin on plan A → not_on_plan", a.state == "not_on_plan" && a.notOnPlan?.substance == "Amlodipin")
a = Matcher.answer(myMeds: AppData.myMeds("plan-b"), catalog: all, cues: cues(amlo, imprint: "AM5"))
check("same Amlodipin photo on plan B → yours", ["sure", "likely"].contains(a.state) && a.candidates?.first?.substance == "Amlodipin")
a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues(AppData.look("30477231"), imprint: "A20"))
check("Atorvastatin A20 on plan A → sure", a.state == "sure" && a.candidates?.first?.substance == "Atorvastatin")
a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues(AppData.look("30477231")))
check("same look, imprint not read → never sure", a.state != "sure")
a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: PillCues(found: true, colors: ["white"]))
check("white only → choose + a question", a.state == "choose" && (a.candidates?.count ?? 0) >= 2 && a.question != nil)
a = Matcher.answer(myMeds: planA.meds, catalog: all, cues: PillCues(found: true, colors: ["white"], shape: "oblong", imprint: "1400"))
check("OCR look-alike I400 read as 1400 → Ibuprofen", a.candidates?.first?.substance == "Ibuprofen")

// Pack codes (securPharm Data Matrix) – official vectors from the official IFA test vectors (IFA PPN-Code spec V3.06)
let ifa = PackCode.parse("[)>\u{1E}06\u{1D}9N111234567842\u{1D}1T1A234B5\u{1D}D151231\u{1D}S1234567890123456\u{1E}\u{04}")
check("pack IFA: PZN, batch, expiry, serial", ifa == PackCode(pzn: "12345678", batch: "1A234B5", expiry: "151231", serial: "1234567890123456"))
check("pack IFA as zxing text (visible ␝ ␞ symbols)", PackCode.parse("[)>␞06␝9N111234567842␝1T1A234B5␝D151231␝S1234567890123456␞␄")?.pzn == "12345678")
check("pack GS1 human-readable", PackCode.parse("(01)04150123456782(10)1A234B5(17)151231(21)1234567890123456") == ifa)
check("pack GS1 raw with GS separators", PackCode.parse("0104150123456782101A234B5\u{1D}17151231211234567890123456") == ifa)
check("PZN check digit: valid / wrong / 7 digits", PackCode.pznValid("27580899") && !PackCode.pznValid("27580898") && !PackCode.pznValid("1234567"))
check("expiry: 12/2015 expired, 03/2028 not, day 00 = end of month", ifa!.isExpired() && !PackCode(pzn: "x", batch: nil, expiry: "280331", serial: nil).isExpired() && PackCode(pzn: "x", batch: nil, expiry: "280300", serial: nil).expiryText == "03/2028")
check("not a pack code → nil", PackCode.parse("hello") == nil && PackCode.parse("9N119999999999") == nil)
check("Code 39 PZN barcode: PZN8, PZN7, PZN- prefix; no batch/expiry", PackCode.parse("-05387239") == PackCode(pzn: "05387239", batch: nil, expiry: nil, serial: nil) && PackCode.parse("-5387239")?.pzn == "05387239" && PackCode.parse("PZN-05387239")?.pzn == "05387239")
check("Code 39: wrong check digit or no dash → nil", PackCode.parse("-05387238") == nil && PackCode.parse("05387239") == nil)

func pack(_ pzn: String, _ plan: String) -> PackResult {
    let items = PlanReader.items(in: AppData.plan(plan))!
    let p = PlanReader.resolve(items, catalog: all, names: AppData.names)
    return PackResult.evaluate(PackCode(pzn: pzn, batch: nil, expiry: nil, serial: nil), myMeds: p.meds, unknownPZNs: p.unknownPZNs, catalog: all, names: AppData.names)
}
check("pack Atorvastatin Alpinmed on plan A → on plan", pack("30477231", "plan-a").kind == .onPlan)
let switched = pack("18342014", "plan-a")
check("pack Ramipril Medivia, plan A has Nordapharm → other maker", switched.kind == .otherMaker && switched.mine?.manufacturer == "Nordapharm")
let aspirin = pack("05387239", "plan-a")
check("pack Aspirin N 100 (Code 39 only) on plan A → other maker of its ASS, name from PZN list", aspirin.kind == .otherMaker && aspirin.mine?.substance == "Acetylsalicylsäure" && aspirin.name?.name == "ASPIRIN N 100MG")
check("pack Aspirin N: same substance and strength, plan form unknown → possible switch, never 'same medicine'", aspirin.kind == .otherMaker && aspirin.difference == nil)
check("strength from the PZN name: ASPIRIN N 100MG → 100 mg; ASS AL 100 TAH → none", AppData.names["05387239"]?.strength == "100 mg" && AppData.names["03024314"]?.strength == nil)
let ass500 = pack("20285648", "plan-a")
check("Aspirin 500 mg on plan A (ASS 100 mg) → same substance, other strength, no switch, no add", ass500.kind == .sameSubstance && ass500.difference == "aber eine andere Stärke" && !ass500.canAdd)
check("ASS AL 100 (no unit in the name) on plan A → same substance, strength unknown", pack("03024314", "plan-a").kind == .sameSubstance && pack("03024314", "plan-a").difference == "die Stärke ist unbekannt")
var plainASS = planA.meds.first { $0.substance == "Acetylsalicylsäure" }!
plainASS.pzn = "06312060"   // ASS 100 1A Pharma, TABL
let protect = PackResult.evaluate(PackCode(pzn: "06706149", batch: nil, expiry: nil, serial: nil), myMeds: [plainASS], unknownPZNs: [], catalog: all, names: AppData.names)
check("Aspirin protect (gastro-resistant) vs plain ASS tablet on the plan → same substance, other form", protect.kind == .sameSubstance && protect.difference == "aber eine andere Darreichungsform")
check("pack Amlodipin on plan A → not on plan; on plan B → on plan", pack("91200130", "plan-a").kind == .notOnPlan && pack("91200130", "plan-b").kind == .onPlan)
check("pack Cefaclor STADA (no look) on KBV plan → on plan, name from PZN list", pack("08693497", "plan-kbv-beispiel").kind == .onPlanNoLook && AppData.names["08693497"]?.substance == "Cefaclor")
check("KBV plan: unknown entries named from the PZN list", PlanReader.resolve(kbvItems, catalog: all, names: AppData.names).unknown.contains { $0.contains("CEFACLOR STADA") })
// Looks from German package leaflets (tools/add-leaflet-looks.py)
check("KBV plan: HCT 1A Pharma and MTX HEXAL now with their leaflet look", kbv.meds.contains { $0.pzn == "06453257" && $0.look.source?.hasPrefix("leaflet:") == true } && kbv.meds.contains { $0.pzn == "03159468" && $0.look.color == "yellow" })
let aspirinN = PackResult.evaluate(PackCode(pzn: "05387239", batch: nil, expiry: nil, serial: nil), myMeds: [], unknownPZNs: [], catalog: all, names: AppData.names)
check("Aspirin N 100 mg pack → white, round, 7 mm from the leaflet; score not stated → nil", aspirinN.product.map { $0.look.color == "white" && $0.look.shape == "round" && $0.look.lengthMm == 7 && $0.look.score == nil } == true)
check("another pack size of the same product resolves, keeping the scanned PZN", all.product(pzn: "06453174").map { $0.name.hasPrefix("HCT - 1 A Pharma") && $0.pzn == "06453174" } == true)
let leafletLooks = all.filter { $0.look.source?.hasPrefix("leaflet:") == true }
// Public repo: the leaflet's own words are not shipped (no licence to republish them); each look keeps its leaflet link.
check("31 leaflet products, each with its package-leaflet source link", leafletLooks.count == 31 && leafletLooks.allSatisfy { ($0.look.source ?? "").hasPrefix("leaflet:https://") && $0.look.leaflet == nil })
let naratriptan = PackResult.evaluate(PackCode(pzn: "09321616", batch: nil, expiry: nil, serial: nil), myMeds: [], unknownPZNs: [], catalog: all, names: AppData.names)
check("non-prescription pack outside the Festbetrag list (Naratriptan-ratiopharm 09321616) → green, round, \"NT 2,5\" from its leaflet", naratriptan.product.map { $0.look.color == "green" && $0.look.shape == "round" && $0.look.imprint == "NT 2,5" } == true && naratriptan.canAdd)
check("found automatically by PZN: Bisoprolol 5 – 1 A Pharma is yellow, round, cross score", all.product(pzn: "03820206").map { $0.look.color == "yellow" && $0.look.shape == "round" && $0.look.score == "cross" } == true)
check("dosage form from the PZN list: TABL tablet, KAPS capsule, AUGT drops, unknown code nil", DoseForm(code: "TABL")?.family == .tablet && DoseForm(code: "KAPS")?.family == .capsule && DoseForm(code: "AUGT")?.family == .drops && DoseForm(code: "XYZ") == nil)

if failed > 0 { print("KBV unknown:", kbv.unknown) }
// Adding a scanned pack to the plan
let names = AppData.names
let amloPack = PackCode(pzn: "91200130", batch: nil, expiry: nil, serial: nil)   // Amlodipin Alpinmed 5 mg, not on plan A
let before = PackResult.evaluate(amloPack, myMeds: planA.meds, unknownPZNs: [], catalog: all, names: names)
check("pack not on plan A → can be added", before.kind == .notOnPlan && before.canAdd && before.product != nil)
var added = before.product!
added.schedule = Schedule(kind: "daily", slots: ["evening"], amounts: ["evening": 1], days: [], note: nil, text: nil)
let planPlus = planA.meds.adding(added)
check("added pack: on the plan afterwards, with its schedule", PackResult.evaluate(amloPack, myMeds: planPlus, unknownPZNs: [], catalog: all, names: names).kind == .onPlan && planPlus.count == 13)
check("adding the same PZN again replaces, no duplicate", planPlus.adding(added).count == 13)
let aspPack = PackCode(pzn: "08693497", batch: nil, expiry: nil, serial: nil)   // Cefaclor STADA, no picture data
let asp = PackResult.evaluate(aspPack, myMeds: planA.meds, unknownPZNs: [], catalog: all, names: names)
check("pack without picture data can be added by name", asp.canAdd && asp.product == nil && asp.name != nil)
check("…and then counts as on the plan", PackResult.evaluate(aspPack, myMeds: planA.meds, unknownPZNs: ["08693497"], catalog: all, names: names).kind == .onPlanNoLook)
let onPlan = planA.meds[0]
check("pack already on the plan → no add button", !PackResult.evaluate(PackCode(pzn: onPlan.pzn, batch: nil, expiry: nil, serial: nil), myMeds: planA.meds, unknownPZNs: [], catalog: all, names: names).canAdd)

// Day view: now / later by the clock
var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Europe/Berlin")!
func at(_ h: Int, weekday: Int = 3) -> Date {   // 2026-11-10 is a Tuesday; weekday 3 = Tue … 2 = Mon
    cal.date(from: DateComponents(year: 2026, month: 11, day: 7 + weekday, hour: h, minute: 30))!
}
let evening = Day.sections(planA.meds, at: at(18), calendar: cal)
check("18:30 → first section is evening, marked now", evening.first?.kind == .slot("evening") && evening.first?.now == true)
// Changed with T-06: at 18:30 the morning slot is today's, already past – never "tomorrow" (a patient could skip it at 11:05).
check("18:30 → night later today, morning earlier today (past, never tomorrow)", evening.first { $0.kind == .slot("night") }?.past == false && evening.first { $0.kind == .slot("morning") }?.past == true && evening.allSatisfy { !$0.tomorrow })
check("18:30 → Metformin due now with 1", evening.first?.entries.first { $0.med.substance == "Metformin" }?.amount == 1)
check("as-needed last, never now", evening.last?.kind == .prn && evening.last?.now == false && evening.last?.entries.contains { $0.med.substance == "Ibuprofen" } == true)
let monday = Day.sections(planA.meds, at: at(8, weekday: 2), calendar: cal)
check("Monday 08:30 → morning now, Methotrexat in 'today weekly'", monday.first?.kind == .slot("morning") && monday.contains { $0.kind == .weeklyToday && $0.entries.contains { $0.med.substance == "Methotrexat" } })
check("Tuesday → Methotrexat not due today, listed under this week", !evening.contains { $0.kind == .weeklyToday } && evening.contains { $0.kind == .weeklyLater && $0.entries.contains { $0.med.substance == "Methotrexat" } })
let late = Day.sections(planA.meds, at: at(2), calendar: cal)
check("02:30 → morning is today, not tomorrow", late.first { $0.kind == .slot("morning") }?.tomorrow == false)

// Plan drucken: the plan on the phone → the printed sheet's code → read back gives the same plan
let printed = BmpWriter.xml(myMeds: planA.meds, unknownPZNs: ["11289015"], id: String(repeating: "AB", count: 16))!
let reread = PlanReader.resolve(PlanReader.items(in: printed)!, catalog: all)
check("printed code: ≤1400 bytes ISO-8859-1", BmpWriter.payload(printed).count <= 1400 && BmpWriter.payload(printed).count > 0)
check("printed code: same 12 meds with the same schedules", reread.meds.map(\.pzn) == planA.meds.filter { $0.schedule?.kind != "prn" }.map(\.pzn) + planA.meds.filter { $0.schedule?.kind == "prn" }.map(\.pzn)
      && zip(reread.meds, planA.meds).allSatisfy { r, o in r.schedule?.kind == o.schedule?.kind && r.schedule?.amounts == o.schedule?.amounts && r.schedule?.days == o.schedule?.days })
check("printed code: notes kept", reread.meds.first { $0.substance == "Levothyroxin-Natrium" }?.schedule?.note == "nüchtern, 30 min vor dem Frühstück")
check("printed code: entry without picture data stays unknown", reread.unknownPZNs == ["11289015"])
check("printed code: head v=028, 32-hex U, A = BlisterKompass with time – and no person (no P)", printed.hasPrefix(#"<MP v="028" U="ABABABABABABABABABABABABABABABAB" l="de-DE"><A n="BlisterKompass" t=""#) && !printed.contains("<P"))
check("printed code: no zero doses (not allowed in BMP 2.8)", !printed.contains(#"="0""#))
check("printed code: half dose written as 1/2, read as 0.5", PlanReader.num(BmpWriter.dose(0.5)) == 0.5 && BmpWriter.printed(0.5) == "½")
let many = Array(repeating: planA.meds, count: 3).flatMap { $0 }.enumerated().map { i, m in var m = m; m.pzn = String(format: "%08d", 10000000 + i); return m }
check("printed code: too long → notes dropped first, still ≤1400", BmpWriter.xml(myMeds: many, unknownPZNs: []).map { BmpWriter.payload($0).count <= 1400 && !$0.contains(" i=") } ?? true)
check("form from the product name", BmpForm.of(name: "Metformin Rhenus 1000 mg Filmtabletten", ifaCode: nil) == "Filmtabl" && BmpForm.of(name: nil, ifaCode: "KAPS") == "Kapsel")


// Live leaflet lookup: section 6 → look (LeafletParser, same rules as tools/fetch-leaflet-looks.py)
func leaf(_ s6: String, _ strength: String?) -> Look? { LeafletParser.parse(section6: s6, strength: strength, source: "leaflet:test")?.0 }
check("leaflet: Naratriptan – green, round, imprint NT 2,5, no score stated", leaf("Grüne, bikonvexe, runde Filmtabletten mit Prägung „NT 2,5“ auf einer Seite und glatter anderer Seite. Packung mit 2 Filmtabletten.", "2,5 mg").map { $0.color == "green" && $0.shape == "round" && $0.imprint == "NT 2,5" && $0.score == nil } == true)
check("leaflet: capsule halves (Cefaclor) → white body, blue cap", leaf("Kapseloberteil: hellblau. Kapselunterteil: weiß opak mit weißem bis leicht gelblichem Pulver. Packungen mit 10 Hartkapseln.", "500 mg").map { $0.shape == "capsule" && $0.color == "white" && $0.color2 == "blue" } == true)
let twoStrengths = "Die 5 mg Tabletten sind weiße, runde Tabletten. Die 10 mg Tabletten sind gelbe, runde Tabletten mit Bruchkerbe."
check("leaflet: other strengths in other colours, ours not named → nothing guessed", leaf(twoStrengths, "2,5 mg") == nil)
check("leaflet: our strength named → its sentence (10 mg yellow, score)", leaf(twoStrengths, "10 mg").map { $0.color == "yellow" && $0.score == "single" } == true)
check("leaflet: spray, no tablet shape → nil", leaf("Nitrolingual akut Spray ist eine klare, farblose Lösung in einer roten, durchsichtigen Kunststoffflasche.", nil) == nil)
check("leaflet: 'weiß bis gebrochen weiß, oblong, 15,5 mm x 8,1 mm' → white oblong with size", leaf("Weiße bis gebrochen weiße, oblonge Tabletten 15,5 mm x 8,1 mm.", nil).map { $0.color == "white" && $0.shape == "oblong" && $0.lengthMm == 15.5 && $0.widthMm == 8.1 } == true)
check("leaflet: PZN → leaflet URL", LeafletParser.url(pzn: "09321616")?.absoluteString == "https://cdn.shop-apotheke.com/PDF/D09/321/616/D09321616-bp.pdf")
// Meal timing from the free-text Hinweise (the BMP has no code for it)
check("meal: plan A – Levothyroxin nüchtern, Pantoprazol before, Metformin with, ASS after, Atorvastatin none",
      [("Levothyroxin-Natrium", MealTiming.fasting), ("Pantoprazol", .before), ("Metformin", .with), ("Acetylsalicylsäure", .after)]
        .allSatisfy { sub, m in planA.meds.first { $0.substance == sub }?.schedule?.meal == m }
      && planA.meds.first { $0.substance == "Atorvastatin" }?.schedule?.meal == nil)
check("meal: 'nüchtern, 30 min vor dem Frühstück' is fasting, not before", MealTiming.from("nüchtern, 30 min vor dem Frühstück") == .fasting)
check("meal: 'während der Mahlzeit' (KBV sample) is with", MealTiming.from("während der Mahlzeit") == .with)
check("meal: negation or 'unabhängig' gives no tag", MealTiming.from("nicht nüchtern einnehmen") == nil && MealTiming.from("unabhängig von den Mahlzeiten") == nil)
// T-31: negations and alternatives never turn into the opposite tag (same rule as the web app's meal()).
check("meal: 'nicht zu den Mahlzeiten', 'Abstand zum Essen', '1 Std. vor oder 2 Std. nach dem Essen' give no tag",
      [MealTiming.from("nicht zu den Mahlzeiten"), MealTiming.from("nicht mit dem Essen"), MealTiming.from("Abstand zum Essen 2 h"),
       MealTiming.from("nicht auf nüchternen Magen"), MealTiming.from("1 Std. vor oder 2 Std. nach dem Essen"), MealTiming.from("kein Essen dazu")].allSatisfy { $0 == nil })
check("meal: other notes give no tag", MealTiming.from("bei Knieschmerzen") == nil && MealTiming.from(nil) == nil)

// Submission review 13 Nov 2026: same names as pwa/tests/checks.test.js. (whenText and the read-aloud live in Theme.swift,
// which these macOS checks don't compile: their checks are web-app only for now.)
check("combination product: all <W> kept", PlanReader.items(in: #"<MP v="028" U="0" l="de-DE"><S><M p="1"><W w="Valsartan" s="160 mg"/><W w="Hydrochlorothiazid" s="25 mg"/></M></S></MP>"#)?.first.map { $0.substance == "Valsartan / Hydrochlorothiazid" && $0.strength == "160 mg / 25 mg" } == true)
let outside = PlanReader.resolve(PlanReader.items(in: #"<MP v="028" U="0" l="de-DE"><S><M p="99999999" m="1"><W w="Ramipril" s="5 mg"/></M></S></MP>"#)!, catalog: all)
check("a plan PZN outside the catalog keeps its PZN, never another product's (no substance fallback)", outside.meds.isEmpty && outside.unknownPZNs == ["99999999"])
check("KBV: weekly MTX (wo=1, m=1) keeps its dose and Monday", kbv.meds.first { $0.pzn == "03159468" }?.schedule.map { $0.kind == "weekly" && $0.days == ["mon"] && $0.amounts == ["morning": 1] } == true)

// T-04: a look-alike in another strength is never "another maker" of the plan entry.
let pregabalin300 = all.first { $0.substance == "Pregabalin" && $0.strength == "300 mg" && $0.market != "US" }!
let p300 = Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues(pregabalin300.look, imprint: pregabalin300.look.imprint))
check("Pregabalin 300 mg look on plan A (75 mg) → other_strength, shown with its own title", p300.state == "other_strength" && p300.candidates?.first?.strength == "75 mg" && p300.notOnPlan?.strength == "300 mg")
check("no catalog look of another strength of a plan A drug gives other_maker", all
    .filter { m in planA.meds.contains { $0.substance == m.substance && $0.strength != m.strength } }
    .allSatisfy { Matcher.answer(myMeds: planA.meds, catalog: all, cues: cues($0.look, imprint: $0.look.imprint)).state != "other_maker" })
// T-05: without a read imprint and a size, every colour-fitting plan pill stays a candidate.
let offwhiteOval = Matcher.answer(myMeds: planA.meds, catalog: all, cues: PillCues(found: true, colors: ["offwhite"], shape: "oval"))
check("off-white oval, no imprint, size unknown → choose, Metformin among the candidates", offwhiteOval.state == "choose" && (offwhiteOval.candidates ?? []).contains { $0.substance == "Metformin" } && (offwhiteOval.candidates?.count ?? 0) >= 3)
check("score-line question says nothing about splitting (INV-14)", Matcher.question(planA.meds, PillCues(found: true, colors: ["white"], shape: "round"))?.question.contains("Teilen") != true)
// T-06: 11:05 and 00:30
let elevenOFive = Day.sections(planA.meds, at: cal.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 11, minute: 5))!, calendar: cal)
check("11:05 → morning drugs are today's, past – not tomorrow", elevenOFive.first { $0.kind == .slot("morning") }.map { $0.past && $0.entries.count == 7 } == true && elevenOFive.allSatisfy { !$0.tomorrow })
let halfPastMidnight = Day.sections(planA.meds, at: cal.date(from: DateComponents(year: 2026, month: 11, day: 14, hour: 0, minute: 30))!, calendar: cal)
check("00:30 → night slot is last night's, never 'now' again", halfPastMidnight.first { $0.kind == .slot("night") }.map { $0.lastNight && !$0.now } == true && !halfPastMidnight.contains { $0.now })
// BMP 2.8 contract: refused, never read half-way (the iPhone app returns nil; the web app also names the reason).
func bmp(_ attrs: String, _ m: String) -> [PlanReader.Item]? { PlanReader.items(in: "<MP \(attrs)><S>\(m)</S></MP>") }
check("plan code of another version (v=999) → refused: version", bmp(#"v="999" U="0" l="de-DE""#, #"<M p="1" m="1"/>"#) == nil)
check("plan code with a 13-digit PZN → refused: pzn", bmp(#"v="028" U="0" l="de-DE""#, #"<M p="1234567890123" m="1"/>"#) == nil)
check("plan code with a dose that is no number (m=wrong) → refused: dose, never 0", bmp(#"v="028" U="0" l="de-DE""#, #"<M p="1" m="wrong"/>"#) == nil && !PlanReader.validDose("wrong") && PlanReader.validDose(""))
check("plan code with weekday 9 or page 3 of 2 → refused", bmp(#"v="028" U="0" l="de-DE""#, #"<M p="1" m="1" wo="9"/>"#) == nil && bmp(#"v="028" U="0" l="de-DE" a="3" z="2""#, #"<M p="1" m="1"/>"#) == nil)
check("the review's sample <MP v=999><M p=1234567890123 m=wrong> is refused", PlanReader.items(in: #"<MP v="999"><S><M p="1234567890123" m="wrong"/></S></MP>"#) == nil)
check("all example plans still read (v=028, valid PZNs and doses)", ["plan-a", "plan-b", "plan-c", "plan-kbv-beispiel"].allSatisfy { (PlanReader.items(in: AppData.plan($0))?.count ?? 0) > 0 })
// iOS only: multi-page plans are refused until the iPhone app can merge pages (the web app merges them, pwa/tests/checks.test.js).
check("multi-page plan page (a=1, z=2) → refused on iPhone, never taken for the whole plan", bmp(#"v="028" U="ABC" l="de-DE" a="1" z="2""#, #"<M p="1" m="1"/>"#) == nil)
check("leaflet: finish only when the text states it; a film coating alone gives none", leaf("Weiße, runde Filmtabletten.", nil).map { $0.finish == nil } == true && leaf("Weiße, runde, glänzende Filmtabletten.", nil)?.finish == "glossy" && LeafletParser.finish(in: "matte, weiße Tabletten") == "matte")

// Time-slot tiles: the plan's amount as pills
check("slot tile: a whole dose draws the pills without a number", DoseGlyph(1, family: "tablet").map { $0.whole == 1 && $0.part == 0 && !$0.showNumber } == true && DoseGlyph(2, family: "capsule", unit: "Stück").map { $0.whole == 2 && !$0.showNumber } == true)
check("slot tile: a part tablet draws a part pill and keeps the number", DoseGlyph(0.5, family: "tablet").map { $0.whole == 0 && $0.part == 0.5 && $0.showNumber } == true && DoseGlyph(1.5, family: "tablet").map { $0.whole == 1 && $0.part == 0.5 } == true && DoseGlyph(0.25, family: "tablet")?.part == 0.25)
check("slot tile: number alone for units, unknown forms, part capsules and more than 4 pills", DoseGlyph(20, family: "tablet", unit: "IE") == nil && DoseGlyph(1, family: nil) == nil && DoseGlyph(1, family: "drops") == nil && DoseGlyph(0.5, family: "capsule") == nil && DoseGlyph(5, family: "tablet") == nil && DoseGlyph(3.5, family: "tablet")?.whole == 3 && DoseGlyph(nil, family: "tablet") == nil)

print("\n\(passed) passed, \(failed) failed")
exit(failed == 0 ? 0 : 1)
