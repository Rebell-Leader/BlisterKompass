import Foundation

/// Reads the medication lines of a Bundeseinheitlicher Medikationsplan (BMP)
/// from the XML in its 2D code (KBV spec v2.x, element names as in Anlage 3).
///
/// Privacy by design: only `<S>` sections and their `<M>`/`<W>` entries are
/// read. Patient (`<P>`), issuer (`<A>`), parameters (`<O>`) and free-text
/// elements are skipped and never stored.
enum PlanReader {
    struct Item: Hashable {
        let pzn: String?
        let substance: String?
        let strength: String?
        let schedule: Schedule

        var label: String { [substance ?? pzn.map { "PZN \($0)" } ?? "?", strength].compactMap { $0 }.joined(separator: " ") }
    }

    /// The one BMP version this reader is written for (bmp_V2.8.xsd: MP/@v fixed "028").
    static let version = "028"

    /// nil if the text is not a medication plan, or if it breaks the BMP 2.8 contract (another version, a PZN outside
    /// 1–99999999, a dose that is no number, a weekday outside 1–7) – refused, never read half-way or as dose 0. Multi-page
    /// plans (MP/@a, @z) are refused too: the iPhone app can't merge pages yet (the web app can), and one page alone would
    /// look like the whole plan.
    static func items(in xml: String) -> [Item]? {
        guard xml.contains("<MP") else { return nil }
        let delegate = Collector()
        let parser = XMLParser(data: Data(xml.utf8))
        parser.delegate = delegate
        guard parser.parse(), delegate.sawPlan, !delegate.invalid else { return nil }
        return delegate.items
    }

    /// A dose the BMP notation allows, or none. "abc", "-1" or a mixed "1½" is no dose: the plan is refused, not read as 0.
    static func validDose(_ v: String?) -> Bool {
        let s = (v ?? "").trimmingCharacters(in: .whitespaces)
        if s.isEmpty || ["½", "¼", "¾"].contains(s) { return true }
        if s.contains(where: { "½¼¾⅓⅔⅛".contains($0) }) { return false }
        let frac = s.split(separator: "/")
        if frac.count == 2 { return Double(frac[0]) != nil && (Double(frac[1]) ?? 0) > 0 }
        return (Double(s.replacingOccurrences(of: ",", with: ".")) ?? -1) >= 0
    }

    /// Plan items → the user's meds (looks from the bundled catalog). A line takes a picture only from the catalog product
    /// with its own PZN – never one found by substance (INV-05, INV-15). Every other line stays unknown (no guessing).
    static func resolve(_ items: [Item], catalog: [Med], names: [String: PZNName] = [:]) -> ScannedPlan {
        var meds: [Med] = []
        var unknown: [String] = []
        var unknownPZNs: [String] = []
        for it in items {
            if var med = it.pzn.flatMap({ catalog.product(pzn: $0) }) {
                med.schedule = it.schedule
                meds.append(med)
            } else {
                // No picture data: show the official name from the PZN list if there is one.
                if let p = it.pzn { unknownPZNs.append(p) }
                unknown.append(it.pzn.flatMap { names[$0]?.name } ?? it.label)
            }
        }
        return ScannedPlan(meds: meds, unknown: unknown, unknownPZNs: unknownPZNs)
    }

    /// BMP dose → number: "1", "0,5", "½" and the spec's fractions "1/2", "1/4", "1/3", "2/3", "3/4", "1/8".
    static func num(_ v: String?) -> Double {
        let s = (v ?? "").trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: "½", with: "0.5").replacingOccurrences(of: "¼", with: "0.25").replacingOccurrences(of: "¾", with: "0.75")
        let frac = s.split(separator: "/")
        if frac.count == 2, let a = Double(frac[0]), let b = Double(frac[1]), b > 0 { return (a / b * 100).rounded() / 100 }
        return Double(s.replacingOccurrences(of: ",", with: ".")) ?? 0
    }

    /// Sub-heading of a block: key code `c`, or free text `t` (the KBV sample plan in the spec, figure 6,
    /// writes `<S t="Bedarfsmedikation">`). 411 = Bedarfsmedikation, 425 = wöchentliche Anwendung.
    static func sectionCode(_ a: [String: String]) -> String? {
        if let c = a["c"] { return c }
        let t = a["t"]?.lowercased() ?? ""
        if t.contains("bedarf") { return "411" }
        if t.contains("woch") || t.contains("wöch") { return "425" }
        return nil
    }

    // BMP dosing → schedule. Section 411 = "Bedarfsmedikation", 425 = weekly; wo = weekday (1 = Montag).
    static func schedule(_ a: [String: String], section: String?) -> Schedule {
        let text = a["t"], note = a["i"]
        if section == "411" || text?.lowercased().contains("bedarf") == true {
            return Schedule(kind: "prn", slots: [], amounts: [:], days: [], note: note, text: text ?? "bei Bedarf")
        }
        let days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        // Weekly keeps the plan's dose and slot (wo goes with m/d/v/h); only the weekday makes it weekly.
        var weeklyAmounts: [String: Double] = [:]
        for (attr, slot) in [("m", "morning"), ("d", "noon"), ("v", "evening"), ("h", "night")] where num(a[attr]) > 0 { weeklyAmounts[slot] = num(a[attr]) }
        let weeklySlots = Slot.all.map(\.id).filter { weeklyAmounts[$0] != nil }
        if let wo = a["wo"].flatMap(Int.init), (1...7).contains(wo) {
            return Schedule(kind: "weekly", slots: weeklySlots, amounts: weeklyAmounts, days: [days[wo - 1]], note: note, text: text ?? "einmal pro Woche")
        }
        // Free text like "1x wöchentl. Montag" or "einmal pro Woche" (both "woch" and "wöch").
        let lower = text?.lowercased() ?? ""
        if section == "425" || lower.contains("woch") || lower.contains("wöch") {
            let names = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"]
            let day = names.firstIndex { lower.contains($0) }.map { days[$0] }
            return Schedule(kind: "weekly", slots: weeklySlots, amounts: weeklyAmounts, days: day.map { [$0] } ?? [], note: note, text: text)
        }
        var amounts: [String: Double] = [:]
        for (attr, slot) in [("m", "morning"), ("d", "noon"), ("v", "evening"), ("h", "night")] where num(a[attr]) > 0 { amounts[slot] = num(a[attr]) }
        let slots = Slot.all.map(\.id).filter { amounts[$0] != nil }
        return Schedule(kind: "daily", slots: slots, amounts: amounts, days: [], note: note, text: text)
    }

    private final class Collector: NSObject, XMLParserDelegate {
        var items: [Item] = []
        var sawPlan = false
        /// The plan breaks the BMP 2.8 contract (see items(in:)).
        var invalid = false
        private var section: String?
        private var med: [String: String]?
        /// All <W> of the line: combination products carry several.
        private var substances: [[String: String]] = []

        func parser(_ p: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes a: [String: String] = [:]) {
            switch name {
            case "MP":
                sawPlan = true
                if a["v"] != PlanReader.version || a["a"] != nil || a["z"] != nil { invalid = true }
            case "S": section = PlanReader.sectionCode(a)
            case "M":
                med = a; substances = []
                if let pzn = a["p"], !((Int(pzn).map { (1...99_999_999).contains($0) }) ?? false) { invalid = true }
                if let wo = a["wo"], !((Int(wo).map { (1...7).contains($0) }) ?? false) { invalid = true }
                for k in ["m", "d", "v", "h"] where !PlanReader.validDose(a[k]) { invalid = true }
            case "W" where med != nil: substances.append(a)
            default: break // P, A, O, … : personal or practice data – ignored
            }
        }

        func parser(_ p: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
            if name == "S" { section = nil }
            guard name == "M", let a = med else { return }
            let pzn = a["p"].map { String(repeating: "0", count: max(0, 8 - $0.count)) + $0 }
            // Combination products: all ingredients in plan order ("Valsartan / Hydrochlorothiazid", "160 mg / 25 mg").
            let ws = substances.filter { !($0["w"] ?? "").isEmpty }
            let substance: String? = ws.isEmpty ? nil : ws.compactMap { $0["w"] }.joined(separator: " / ")
            let strength: String? = ws.contains { $0["s"] != nil } ? ws.map { $0["s"] ?? "?" }.joined(separator: " / ") : nil
            items.append(Item(pzn: pzn, substance: substance, strength: strength, schedule: PlanReader.schedule(a, section: section)))
            med = nil
        }
    }
}
