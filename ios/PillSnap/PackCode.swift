import Foundation

/// The securPharm Data Matrix on a German medicine pack (EU Falsified Medicines Directive).
/// Two formats are in use (IFA PPN-Code spec V3.06, the official IFA test vectors (IFA PPN-Code spec V3.06)):
///  - IFA / ISO 15434: `[)>␞06␝9N<PPN>␝1T<batch>␝D<YYMMDD>␝S<serial>␞␄`  (PPN = "11" + PZN + 2 check digits)
///  - GS1: `(01)<NTIN>(10)<batch>(17)<YYMMDD>(21)<serial>`        (NTIN = "04150" + PZN + check digit)
/// Packs without a Data Matrix (non-prescription, e.g. Aspirin) carry only the PZN as a Code 39
/// barcode: `-` + 8 digits (old PZN7: `-` + 7 digits). That gives the PZN, but no batch or expiry.
/// The PZN identifies the product exactly – no image recognition involved.
struct PackCode: Equatable {
    let pzn: String
    let batch: String?
    let expiry: String?   // YYMMDD, day 00 = end of month
    let serial: String?

    static func parse(_ raw: String) -> PackCode? {
        // zxing renders control characters as visible symbols in its text output; map them back.
        let s = raw.replacingOccurrences(of: "\u{241D}", with: "\u{1D}").replacingOccurrences(of: "\u{241E}", with: "\u{1E}")
            .replacingOccurrences(of: "\u{2404}", with: "\u{04}")
        if let p = parsePZNCode(s) { return p }
        return s.contains("[)>") || s.contains("9N") ? parseIFA(s) : parseGS1(s)
    }

    /// Code 39 PZN barcode: "-12345678" (PZN8) or "-1234567" (PZN7 = PZN8 with a leading 0).
    /// The leading "-" and the check digit keep other numbers from passing as a PZN.
    private static func parsePZNCode(_ s: String) -> PackCode? {
        var t = s.trimmingCharacters(in: .whitespaces)
        if t.uppercased().hasPrefix("PZN") { t = String(t.dropFirst(3)).trimmingCharacters(in: .whitespaces) }
        guard t.first == "-" else { return nil }
        let digits = String(t.dropFirst())
        guard digits.allSatisfy(\.isNumber), digits.count == 7 || digits.count == 8 else { return nil }
        let pzn = digits.count == 7 ? "0" + digits : digits
        return pznValid(pzn) ? PackCode(pzn: pzn, batch: nil, expiry: nil, serial: nil) : nil
    }

    private static func parseIFA(_ s: String) -> PackCode? {
        var fields: [String: String] = [:]
        for part in s.split(whereSeparator: { $0 == "\u{1D}" || $0 == "\u{1E}" || $0 == "\u{04}" }).map(String.init) {
            for di in ["9N", "8P", "1T", "D", "S"] where part.hasPrefix(di) && fields[di] == nil {
                fields[di] = String(part.dropFirst(di.count)); break
            }
        }
        let pzn: String?
        if let ppn = fields["9N"], ppn.count == 12, ppn.hasPrefix("11") {
            pzn = String(ppn.dropFirst(2).prefix(8))
        } else if let gtin = fields["8P"], gtin.count == 14, gtin.hasPrefix("04150") {
            pzn = String(gtin.dropFirst(5).prefix(8))
        } else { pzn = nil }
        guard let p = pzn, pznValid(p) else { return nil }
        return PackCode(pzn: p, batch: fields["1T"], expiry: fields["D"], serial: fields["S"])
    }

    private static func parseGS1(_ s: String) -> PackCode? {
        var ai: [String: String] = [:]
        if s.contains("(01)") {
            // HRI form: (01)…(10)…(17)…(21)…
            let scanner = s.split(separator: "(").map(String.init)
            for chunk in scanner { if let close = chunk.firstIndex(of: ")") { ai[String(chunk[..<close])] = String(chunk[chunk.index(after: close)...]) } }
        } else {
            // Raw form: fixed-length AIs 01 (14) and 17 (6); variable 10/21 end at GS.
            var rest = Substring(s.replacingOccurrences(of: "]d2", with: ""))
            while rest.count >= 2 {
                let code = String(rest.prefix(2)); rest = rest.dropFirst(2)
                switch code {
                case "01": ai["01"] = String(rest.prefix(14)); rest = rest.dropFirst(14)
                case "17": ai["17"] = String(rest.prefix(6)); rest = rest.dropFirst(6)
                case "10", "21":
                    let end = rest.firstIndex(of: "\u{1D}") ?? rest.endIndex
                    ai[code] = String(rest[..<end]); rest = end < rest.endIndex ? rest[rest.index(after: end)...] : ""
                default: rest = ""
                }
                if rest.first == "\u{1D}" { rest = rest.dropFirst() }
            }
        }
        guard let ntin = ai["01"], ntin.count == 14, ntin.hasPrefix("04150") else { return nil }
        let pzn = String(ntin.dropFirst(5).prefix(8))
        guard pznValid(pzn) else { return nil }
        return PackCode(pzn: pzn, batch: ai["10"], expiry: ai["17"], serial: ai["21"])
    }

    /// Read from the printed "PZN 12345678" by OCR (no code decoded), not from a code.
    var fromText = false

    /// The PZN printed on the pack ("PZN 12345678", "PZN: …", "PZN-…"), read by OCR when no code could be decoded.
    /// Only right after the label "PZN", with OCR look-alikes in the digits (O→0, I/L→1, S→5, B→8), PZN7 padded, and only if
    /// the check digit holds. Two different PZNs in one photo → nil: the app can't tell which pack is meant.
    static func fromText(_ text: String) -> PackCode? {
        let s = text.uppercased()
        let re = try! NSRegularExpression(pattern: #"PZN\s*[:.\-–]?\s*([0-9OILSB]{7,8})(?![0-9])"#)
        var found = Set<String>()
        for m in re.matches(in: s, range: NSRange(s.startIndex..., in: s)) {
            guard let r = Range(m.range(at: 1), in: s) else { continue }
            let digits = String(s[r].map { c -> Character in
                switch c { case "O": "0"; case "I", "L": "1"; case "S": "5"; case "B": "8"; default: c }
            })
            let pzn = digits.count == 7 ? "0" + digits : digits
            if pznValid(pzn) { found.insert(pzn) }
        }
        guard found.count == 1, let pzn = found.first else { return nil }
        var c = PackCode(pzn: pzn, batch: nil, expiry: nil, serial: nil)
        c.fromText = true
        return c
    }

    /// PZN check digit: d1…d7 weighted 1…7, sum mod 11 = d8.
    static func pznValid(_ p: String) -> Bool {
        let d = p.compactMap(\.wholeNumberValue)
        guard d.count == 8, p.count == 8 else { return false }
        return (0..<7).reduce(0) { $0 + d[$1] * ($1 + 1) } % 11 == d[7]
    }

    /// "03/2028"
    var expiryText: String? {
        guard let e = expiry, e.count == 6 else { return nil }
        return "\(e.dropFirst(2).prefix(2))/20\(e.prefix(2))"
    }

    /// Expired if the last valid day is before `today`.
    func isExpired(today: Date = Date()) -> Bool {
        guard let e = expiry, e.count == 6, let yy = Int(e.prefix(2)), let mm = Int(e.dropFirst(2).prefix(2)), let dd = Int(e.suffix(2)) else { return false }
        var c = Calendar(identifier: .gregorian); c.timeZone = .current
        let year = 2000 + yy
        let day = dd == 0 ? (c.range(of: .day, in: .month, for: c.date(from: DateComponents(year: year, month: mm, day: 1))!)?.count ?? 28) : dd
        guard let last = c.date(from: DateComponents(year: year, month: mm, day: day)) else { return false }
        return c.startOfDay(for: today) > last
    }
}

/// What a scanned pack means for the user's plan. Identity comes from the PZN.
struct PackResult {
    /// `otherMaker`: same substance, strength and release type as a plan entry, different PZN – possibly the pharmacy's
    /// switch, but only the pharmacy can say whether it replaces that entry (INV-06/15).
    /// `sameSubstance`: same substance as a plan entry, but strength or release type differ or are unknown.
    enum Kind { case onPlan, otherMaker, sameSubstance, notOnPlan, onPlanNoLook, unknown }
    let kind: Kind
    let code: PackCode
    let product: Med?        // from the look catalog (has a picture)
    let name: PZNName?       // from the official PZN list (name, substance, form, pack size)
    let mine: Med?           // the matching plan entry
    /// For `sameSubstance`: what differs ("eine andere Stärke", "Stärke unbekannt", …).
    var difference: String? = nil

    var expired: Bool { code.isExpired() }
    /// Not on the plan, but known → can be added. With a catalog look it becomes a full entry;
    /// with only the official name it is added without picture data (like such plan lines).
    var canAdd: Bool { kind == .notOnPlan && (product != nil || name != nil) }
    var title: String { product?.title ?? name?.name ?? "PZN \(code.pzn)" }

    static func evaluate(_ code: PackCode, myMeds: [Med], unknownPZNs: [String], catalog: [Med], names: [String: PZNName]) -> PackResult {
        let product = catalog.product(pzn: code.pzn)
        let name = names[code.pzn]
        if let mine = myMeds.first(where: { $0.pzn == code.pzn }) {
            return PackResult(kind: .onPlan, code: code, product: product ?? mine, name: name, mine: mine)
        }
        if unknownPZNs.contains(code.pzn) {
            return PackResult(kind: .onPlanNoLook, code: code, product: product, name: name, mine: nil)
        }
        // Same active substance as a plan entry. Only with the same strength and release type (as far as known) is it
        // possibly the same therapy from another maker; otherwise it is flagged as "same substance" – never as a replacement.
        let substance = product?.substance ?? name?.substance
        let same = myMeds.filter { m in substance.map { !$0.isEmpty && m.substance.caseInsensitiveCompare($0) == .orderedSame } ?? false }
        if let first = same.first {
            let strength = product?.strength ?? name?.strength
            let release = PackResult.release(names[code.pzn]?.form)
            let sameStrength = same.filter { m in strength.map { s in m.strength.map { norm($0) == norm(s) } ?? false } ?? false }
            if let mine = sameStrength.first(where: { m in
                let r = PackResult.release(names[m.pzn]?.form)
                return release == nil || r == nil || release == r
            }) {
                return PackResult(kind: .otherMaker, code: code, product: product, name: name, mine: mine)
            }
            let difference = strength == nil ? "die Stärke ist unbekannt"
                : sameStrength.isEmpty ? "aber eine andere Stärke" : "aber eine andere Darreichungsform"
            return PackResult(kind: .sameSubstance, code: code, product: product, name: name, mine: sameStrength.first ?? first, difference: difference)
        }
        if product != nil || name != nil { return PackResult(kind: .notOnPlan, code: code, product: product, name: name, mine: nil) }
        return PackResult(kind: .unknown, code: code, product: nil, name: nil, mine: nil)
    }

    /// Release type from the IFA form code: gastro-resistant and prolonged-release forms are not interchangeable
    /// with plain ones. nil when the form is not known.
    static func release(_ form: String?) -> String? {
        guard let f = form else { return nil }
        switch f {
        case "TBLM", "FTBM", "KAPM", "TABRM", "GRAM": return "magensaftresistent"
        case "TABR", "KAPR", "TABMD": return "retardiert"
        default: return "normal"
        }
    }

    /// "100 mg", "100MG", "75 ug" → "100mg", "75µg" for comparison.
    static func norm(_ s: String) -> String {
        s.lowercased().replacingOccurrences(of: " ", with: "").replacingOccurrences(of: ",", with: ".")
            .replacingOccurrences(of: "mcg", with: "µg").replacingOccurrences(of: "ug", with: "µg")
    }
}

/// One row of the official PZN list (BfArM Festbetrag list): [name, substance, form, pack size].
struct PZNName: Decodable {
    let name: String
    let substance: String
    let form: String
    let packSize: String

    /// Strength from the name ("ASPIRIN N 100MG" → "100 mg"); nil when the name states none.
    var strength: String? {
        guard let r = name.range(of: #"(\d+(?:[.,]\d+)?)\s*(MG|UG|MCG|µG|G|IE)\b"#, options: .regularExpression) else { return nil }
        let m = String(name[r])
        let num = m.prefix { $0.isNumber || $0 == "." || $0 == "," }
        let unit = m.dropFirst(num.count).trimmingCharacters(in: .whitespaces).lowercased()
            .replacingOccurrences(of: "mcg", with: "µg").replacingOccurrences(of: "ug", with: "µg")
        return "\(num) \(unit)"
    }

    init(from decoder: Decoder) throws {
        var c = try decoder.unkeyedContainer()
        name = try c.decode(String.self); substance = try c.decode(String.self)
        form = try c.decode(String.self); packSize = try c.decode(String.self)
    }
}
