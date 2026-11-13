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

    /// nil if the text is not a medication plan.
    static func items(in xml: String) -> [Item]? {
        guard xml.contains("<MP") else { return nil }
        let delegate = Collector()
        let parser = XMLParser(data: Data(xml.utf8))
        parser.delegate = delegate
        guard parser.parse(), delegate.sawPlan else { return nil }
        return delegate.items
    }

    /// Plan items → the user's meds (looks from the bundled catalog). Unknown PZNs stay unknown (no guessing).
    static func resolve(_ items: [Item], catalog: [Med], names: [String: PZNName] = [:]) -> ScannedPlan {
        var meds: [Med] = []
        var unknown: [String] = []
        var unknownPZNs: [String] = []
        for it in items {
            let byPzn = it.pzn.flatMap { catalog.product(pzn: $0) }
            let bySubstance = it.substance.flatMap { s in
                catalog.filter { $0.substance.caseInsensitiveCompare(s) == .orderedSame && (it.strength == nil || $0.strength == it.strength) }
                    .sorted { ($0.market == "US" ? 1 : 0) < ($1.market == "US" ? 1 : 0) }.first
            }
            if var med = byPzn ?? bySubstance {
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
        if let wo = a["wo"].flatMap(Int.init), (1...7).contains(wo) {
            return Schedule(kind: "weekly", slots: [], amounts: [:], days: [days[wo - 1]], note: note, text: text ?? "einmal pro Woche")
        }
        // Free text like "1x wöchentl. Montag" or "einmal pro Woche" (both "woch" and "wöch").
        let lower = text?.lowercased() ?? ""
        if section == "425" || lower.contains("woch") || lower.contains("wöch") {
            let names = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"]
            let day = names.firstIndex { lower.contains($0) }.map { days[$0] }
            return Schedule(kind: "weekly", slots: [], amounts: [:], days: day.map { [$0] } ?? [], note: note, text: text)
        }
        var amounts: [String: Double] = [:]
        for (attr, slot) in [("m", "morning"), ("d", "noon"), ("v", "evening"), ("h", "night")] where num(a[attr]) > 0 { amounts[slot] = num(a[attr]) }
        let slots = Slot.all.map(\.id).filter { amounts[$0] != nil }
        return Schedule(kind: "daily", slots: slots, amounts: amounts, days: [], note: note, text: text)
    }

    private final class Collector: NSObject, XMLParserDelegate {
        var items: [Item] = []
        var sawPlan = false
        private var section: String?
        private var med: [String: String]?
        private var substance: [String: String] = [:]

        func parser(_ p: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes a: [String: String] = [:]) {
            switch name {
            case "MP": sawPlan = true
            case "S": section = PlanReader.sectionCode(a)
            case "M": med = a; substance = [:]
            case "W" where med != nil: substance = a
            default: break // P, A, O, … : personal or practice data – ignored
            }
        }

        func parser(_ p: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
            if name == "S" { section = nil }
            guard name == "M", let a = med else { return }
            let pzn = a["p"].map { String(repeating: "0", count: max(0, 8 - $0.count)) + $0 }
            items.append(Item(pzn: pzn, substance: substance["w"], strength: substance["s"], schedule: PlanReader.schedule(a, section: section)))
            med = nil
        }
    }
}
