import Foundation

/// The plan on the phone → the code for a printed sheet: BMP 2.8 element names and rules (`v="028"`, 32-hex `U`,
/// zero doses left out) as `PlanReader` reads them.
///
/// Only the medicines: no `P` (the phone stores no person and the print asks for none), so the code is not a complete
/// BMP by the KBV schema, which requires `P`; BlisterKompass reads it, other BMP software may not. The issuer (`A`) is the app,
/// with the print time. The look is not in the code: any reader gets it from the PZN.
enum BmpWriter {
    static let maxBytes = 1400
    static let issuer = "BlisterKompass"

    struct Line: Hashable {
        let pzn: String?
        let schedule: Schedule?
        let reason: String?
        let isPiece: Bool       // counted in pieces (tablet, capsule): du="1"
    }

    /// Plan entries in BMP order: daily and weekly in the main block, as-needed in section 411.
    static func lines(myMeds: [Med], unknownPZNs: [String]) -> (main: [Line], prn: [Line]) {
        let all = myMeds.map { Line(pzn: $0.pzn, schedule: $0.schedule, reason: $0.indication?.de, isPiece: true) }
            + unknownPZNs.map { Line(pzn: $0, schedule: nil, reason: nil, isPiece: false) }
        return (all.filter { $0.schedule?.kind != "prn" }, all.filter { $0.schedule?.kind == "prn" })
    }

    /// ISO-8859-1 XML, no prolog. Notes (`i`), then reasons (`r`) are dropped if the code would exceed 1400 bytes; nil if it still does.
    static func xml(myMeds: [Med], unknownPZNs: [String], issued: Date = Date(),
                    id: String = UUID().uuidString.replacingOccurrences(of: "-", with: "").uppercased()) -> String? {
        let (main, prn) = lines(myMeds: myMeds, unknownPZNs: unknownPZNs)
        let time = DateFormatter()
        time.locale = Locale(identifier: "en_US_POSIX")
        time.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        let head = #"<MP v="028" U="\#(id)" l="de-DE">"#
            + #"<A n="\#(issuer)" t="\#(time.string(from: issued))"/>"#
        for (notes, reasons) in [(true, true), (false, true), (false, false)] {
            var s = head
            if !main.isEmpty { s += "<S>" + main.map { element($0, notes: notes, reasons: reasons) }.joined() + "</S>" }
            if !prn.isEmpty { s += #"<S c="411">"# + prn.map { element($0, notes: notes, reasons: reasons) }.joined() + "</S>" }
            s += "</MP>"
            if payload(s).count <= maxBytes { return s }
        }
        return nil
    }

    /// The code's bytes: the BMP is ISO-8859-1.
    static func payload(_ xml: String) -> Data { xml.data(using: .isoLatin1, allowLossyConversion: true) ?? Data() }

    private static func element(_ l: Line, notes: Bool, reasons: Bool) -> String {
        var a: [(String, String)] = []
        // M/@p is the PZN without leading zeros.
        if let p = l.pzn, p.allSatisfy(\.isNumber), let n = Int(p), n > 0 { a.append(("p", String(n))) }
        if let s = l.schedule {
            switch s.kind {
            case "weekly":
                if let d = s.days.first, let i = days.firstIndex(of: d) { a.append(("wo", String(i + 1))) }
                a.append(("m", "1"))
                if let t = s.text { a.append(("t", String(t.prefix(20)))) }
            case "prn":
                a.append(("t", String((s.text ?? "bei Bedarf").prefix(20))))
            default:
                // The schema has no zero dose: an empty time of day is left out.
                for (attr, slot) in zip(["m", "d", "v", "h"], Day.order) where (s.amounts[slot] ?? 0) > 0 { a.append((attr, dose(s.amounts[slot]!))) }
                if let t = s.text { a.append(("t", String(t.prefix(20)))) }
            }
            if l.isPiece { a.append(("du", "1")) }
            if notes, let n = s.note, !n.isEmpty { a.append(("i", String(n.prefix(80)))) }
            if reasons, let r = l.reason, !r.isEmpty { a.append(("r", String(r.prefix(50)))) }
        }
        return "<M" + a.map { " \($0.0)=\"\(escape($0.1))\"" }.joined() + "/>"
    }

    static let days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

    /// 1 → "1", 0.5 → "1/2" (the spec's notation), 1.5 → "1,5".
    static func dose(_ v: Double) -> String {
        switch v {
        case 0.5: "1/2"
        case 0.25: "1/4"
        case 0.75: "3/4"
        case _ where v == v.rounded(): String(Int(v))
        default: String(format: "%g", v).replacingOccurrences(of: ".", with: ",")
        }
    }

    /// Dose for the printed table: ½, ¼, ¾ like on a paper plan.
    static func printed(_ v: Double) -> String {
        switch v {
        case 0.5: "½"
        case 0.25: "¼"
        case 0.75: "¾"
        case 1.5: "1½"
        default: dose(v)
        }
    }

    private static func escape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
    }
}

/// BMP short form ("Tabl", "Filmtabl", "Kaps" …) as the product name or the official PZN list states it; empty if neither says.
enum BmpForm {
    private static let byName: [(String, String)] = [
        ("magensaftresistente tabletten", "msr. Tabl"), ("retardtabletten", "Retardtabl"), ("filmtabletten", "Filmtabl"),
        ("hartkapseln", "Hartkaps"), ("weichkapseln", "Weichkaps"), ("kapseln", "Kaps"), ("tabletten", "Tabl"),
    ]

    static func of(name: String?, ifaCode: String?) -> String {
        let low = (name ?? "").lowercased()
        if let hit = byName.first(where: { low.contains($0.0) }) { return hit.1 }
        if let code = ifaCode, let form = DoseForm(code: code) { return form.label }
        return ""
    }
}
