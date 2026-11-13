import Foundation

/// Package leaflet text → pill look, with fixed rules (no model, no guessing).
/// Reads section 6 ("Wie … aussieht und Inhalt der Packung"), picks the sentence for our strength and takes
/// colour, shape, score line, imprint and size from it. If the text describes another strength, several colours
/// or no shape, the result is nil: unknown stays unknown (INV-05). Same rules as tools/fetch-leaflet-looks.py.
enum LeafletParser {
    struct Result {
        let name: String?
        let substance: String?
        let strength: String?       // "2,5 mg"
        let look: Look
        let quote: String
    }

    private static let colorWords: [(String, String)] = [   // longest first; codes = PillRecognizer.palette
        ("hellgelb", "lightyellow"), ("blassgelb", "lightyellow"), ("gelblich", "lightyellow"), ("cremefarben", "offwhite"),
        ("cremeweiß", "offwhite"), ("gebrochen weiß", "offwhite"), ("altweiß", "offwhite"), ("weißlich", "white"),
        ("weiß", "white"), ("gelb", "yellow"), ("orange", "orange"), ("rosa", "pink"), ("pink", "pink"), ("rot", "red"),
        ("blau", "blue"), ("grün", "green"), ("braun", "brown"), ("beige", "beige"), ("lila", "purple"), ("violett", "purple"),
    ]
    static let palette: [String: (hex: String, en: String, de: String)] = [
        "white": ("#FBFBF8", "white", "weiß"), "offwhite": ("#F1EBDD", "off-white", "cremeweiß"),
        "lightyellow": ("#F6EAA8", "light yellow", "hellgelb"), "yellow": ("#F2CC3D", "yellow", "gelb"),
        "orange": ("#F0954A", "orange", "orange"), "pink": ("#F2B8C3", "pink", "rosa"), "red": ("#C9483F", "red", "rot"),
        "blue": ("#7EA6D8", "blue", "blau"), "green": ("#86C49A", "green", "grün"), "brown": ("#9E7152", "brown", "braun"),
        "beige": ("#E6D5B4", "beige", "beige"), "purple": ("#B497D6", "purple", "lila"),
    ]

    /// Leaflet PDF published per PZN by a German online pharmacy (used by LeafletOnline).
    static func url(pzn: String) -> URL? {
        guard pzn.count == 8, pzn.allSatisfy(\.isNumber) else { return nil }
        let p = Array(pzn)
        return URL(string: "https://cdn.shop-apotheke.com/PDF/D\(String(p[0...1]))/\(String(p[2...4]))/\(String(p[5...7]))/D\(pzn)-bp.pdf")
    }

    /// Whole leaflet text (from the PDF) → look, or nil if section 6 doesn't say it clearly.
    /// `strength`: from the official PZN name if known (more reliable than the leaflet's "enthält …" line).
    static func parse(leaflet raw: String, source: String, strength known: String? = nil) -> Result? {
        let text = flatten(raw)
        guard let s6 = section6(text) else { return nil }
        let name = name(in: text), substance = substance(in: text)
        // Official name, then the product name in the leaflet ("Cefaclor STADA 500 mg"), then "enthält …".
        let strength = known ?? name.flatMap { n in matches(#"(\d+(?:,\d+)?)\s*(mg|µg|Mikrogramm)"#, in: n, groups: 2).nilIfEmpty }
            .map { "\($0[0]) \($0[1] == "Mikrogramm" ? "µg" : $0[1])" } ?? strength(in: text)
        guard let (look, quote) = parse(section6: s6, strength: strength, source: source,
                                        subject: [name?.components(separatedBy: " ").first, substance].compactMap { $0 }) else { return nil }
        return Result(name: name, substance: substance, strength: strength, look: look, quote: quote)
    }

    /// "Kapseloberteil: hellblau. Kapselunterteil: weiß" → (body, cap) colours.
    static func capsuleHalves(_ s6: String) -> (String, String)? {
        let top = matches(#"(?:Kapsel)?[Oo]berteil[^.]{0,40}?((?:hell|dunkel)?(?:weiß|gelb|orange|rosa|rot|blau|grün|braun|beige|lila|violett))"#, in: s6, options: .caseInsensitive).first
        let bottom = matches(#"(?:Kapsel)?[Uu]nterteil[^.]{0,40}?((?:hell|dunkel)?(?:weiß|gelb|orange|rosa|rot|blau|grün|braun|beige|lila|violett))"#, in: s6, options: .caseInsensitive).first
        guard let t = top.flatMap({ colors(in: $0).first }), let b = bottom.flatMap({ colors(in: $0).first }) else { return nil }
        return (b, t)
    }

    /// Start the quote at the product name or substance, so text from a neighbouring column is cut off.
    static func trimmed(_ sentence: String, subject: [String]) -> String {
        let firstColour = colorWords.compactMap { sentence.lowercased().range(of: $0.0)?.lowerBound }.min() ?? sentence.endIndex
        let starts = subject.filter { $0.count > 2 }.compactMap { sentence.range(of: $0, options: .backwards, range: sentence.startIndex..<firstColour)?.lowerBound }
        guard let s = starts.max(), sentence.distance(from: sentence.startIndex, to: s) > 0 else { return sentence }
        return String(sentence[s...])
    }

    static func flatten(_ s: String) -> String {
        var t = s.replacingOccurrences(of: "\u{00AD}", with: "")
        t = t.replacingOccurrences(of: #"(\w) (ße|ä|ö|ü)"#, with: "$1$2", options: .regularExpression)    // "wei ße" → "weiße"
        t = t.replacingOccurrences(of: #"(\w)- (\w)"#, with: "$1$2", options: .regularExpression)          // "Film- tabletten"
        return t.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
    }

    static func section6(_ t: String) -> String? {
        let pattern = #"Wie (?:sieht |sehen )?.{0,120}? ?aus(?:sieht|sehen)? und (?:was )?(?:der )?Inhalt der Packung(?: ist)?\??(.{20,900}?)(?:Pharmazeutischer Unternehmer|Inhaber der Zulassung|Zulassungsinhaber|Hersteller|Diese Packungsbeilage)"#
        guard let re = try? NSRegularExpression(pattern: pattern),
              let m = re.matches(in: t, range: NSRange(t.startIndex..., in: t)).last,   // the last one: the index lists section 6 too
              let r = Range(m.range(at: 1), in: t) else { return nil }
        return t[r].trimmingCharacters(in: .whitespaces)
    }

    /// Colour codes in the order the text names them ("weiße bis gebrochen weiße" → white first).
    static func colors(in s: String) -> [String] {
        var low = s.lowercased()
        var found: [(Int, String)] = []
        for (word, code) in colorWords {
            var from = low.startIndex
            while let r = low.range(of: word, range: from..<low.endIndex) {
                found.append((low.distance(from: low.startIndex, to: r.lowerBound), code))
                from = r.upperBound
            }
            low = low.replacingOccurrences(of: word, with: String(repeating: " ", count: word.count))
        }
        return found.sorted { $0.0 < $1.0 }.map(\.1)
    }

    static func parse(section6 s6: String, strength: String?, source: String, subject: [String] = []) -> (Look, String)? {
        if let (body, cap) = capsuleHalves(s6) {
            let c1 = palette[body]!, c2 = palette[cap]!
            let quote = matches(#"((?:Kapsel)?[Oo]berteil[^.]*\.?\s*(?:Kapsel)?[Uu]nterteil[^.]*)"#, in: s6).first
                ?? matches(#"((?:Kapsel)?[Uu]nterteil[^.]*\.?\s*(?:Kapsel)?[Oo]berteil[^.]*)"#, in: s6).first ?? s6
            let look = Look(shape: "capsule", color: body, color2: cap == body ? nil : cap, lengthMm: nil, widthMm: nil, score: nil, imprint: nil,
                            finish: "glossy", colorHex: c1.hex, color2Hex: cap == body ? nil : c2.hex,
                            colorName: LocalName(de: c1.de, en: c1.en), color2Name: cap == body ? nil : LocalName(de: c2.de, en: c2.en),
                            source: source, leaflet: quote)
            return (look, quote)
        }
        let sentences = s6.split(whereSeparator: { ".!".contains($0) }).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let looks = sentences.filter { !colors(in: $0).isEmpty }
        let num = strength?.components(separatedBy: " ").first
        let own = num.map { n in looks.filter { $0.range(of: #"(?<![\d,])"# + NSRegularExpression.escapedPattern(for: n) + #"\s*(mg|µg|Mikrogramm)"#, options: [.regularExpression, .caseInsensitive]) != nil } } ?? []
        let candidates: [String]
        if !own.isEmpty { candidates = own }
        else if Set(looks.compactMap { colors(in: $0).first }).count <= 1 { candidates = looks }
        else { return nil }                                       // several strengths, several colours, ours not named
        guard let first = candidates.first else { return nil }
        let named = matches(#"(\d+(?:,\d+)?)\s*(?:mg|µg)"#, in: first)
        if let n = num, !named.isEmpty, !named.contains(n) { return nil }     // describes another strength
        let cols = colors(in: first)
        guard let color = cols.first else { return nil }
        let low = first.lowercased()
        let capsule = low.contains("kapsel") && !low.contains("kapselförmig")
        let shape: String
        if capsule { shape = low.contains("weichkapsel") ? "softgel" : "capsule" }
        else if low.contains("rund") { shape = "round" }
        else if low.range(of: "oval|elliptisch|ellipsenförmig", options: .regularExpression) != nil { shape = "oval" }
        else if low.range(of: "länglich|oblong|kapselförmig|stäbchen", options: .regularExpression) != nil { shape = "oblong" }
        else { return nil }
        var color2: String? = nil
        if capsule, cols.count > 1, cols[1] != color { color2 = cols[1] }
        else if !capsule, Set(cols).count > 1, low.range(of: "bis|gefleckt|gesprenkelt", options: .regularExpression) == nil { return nil }
        let score: String? = low.contains("kreuz") ? "cross" : (low.range(of: "bruchkerbe|bruchrille|teilungsrille|kerbe|rille", options: .regularExpression) != nil ? "single" : nil)
        let imprint = matches(#"(?:prägung|aufdruck|kennung|beschriftung|bedruckt mit|eingeprägt\w*)[^„"“]{0,40}[„"“]\s*([^“"”]{1,12}?)\s*[“"”]"#, in: first, options: .caseInsensitive).first
        var length: Double?, width: Double?
        let pair = matches(#"(\d+(?:,\d+)?)\s*mm\s*[x×]\s*(\d+(?:,\d+)?)\s*mm"#, in: first, groups: 2)
        if pair.count == 2 { length = Double(pair[0].replacingOccurrences(of: ",", with: ".")); width = Double(pair[1].replacingOccurrences(of: ",", with: ".")) }
        else if let d = matches(#"[Dd]urchmesser (?:von )?(?:ca\. )?(\d+(?:,\d+)?)\s*mm"#, in: first).first {
            length = Double(d.replacingOccurrences(of: ",", with: ".")); width = length
        }
        let coating = capsule ? "gelatin" : (low.contains("magensaftresistent") ? "enteric" : (low.contains("film") ? "film" : "uncoated"))
        let c1 = palette[color]!, c2 = color2.flatMap { palette[$0] }
        let look = Look(shape: shape, color: color, color2: color2, lengthMm: length, widthMm: width, score: score, imprint: imprint,
                        finish: coating == "uncoated" ? "matte" : "glossy", colorHex: c1.hex, color2Hex: c2?.hex,
                        colorName: LocalName(de: c1.de, en: c1.en), color2Name: c2.map { LocalName(de: $0.de, en: $0.en) },
                        source: source, leaflet: trimmed(first, subject: subject) + ".")
        return (look, trimmed(first, subject: subject) + ".")
    }

    static func strength(in t: String) -> String? {
        guard let m = matches(#"enthält (?:jeweils )?(\d+(?:,\d+)?)\s*(mg|µg|Mikrogramm)"#, in: t, groups: 2).nilIfEmpty else { return nil }
        return "\(m[0]) \(m[1] == "Mikrogramm" ? "µg" : m[1])"
    }

    static func substance(in t: String) -> String? {
        matches(#"Der Wirkstoff ist ([A-ZÄÖÜ][\wäöüß\-]+)"#, in: t).first
    }

    static func name(in t: String) -> String? {
        matches(#"Information für (?:den )?(?:Anwender|Patienten)(?:innen)?\s+(.{3,60}?)\s+(?:Wirkstoff|Lesen|Zur Anwendung|Für Erwachsene|\w+:)"#, in: t, options: .caseInsensitive).first
    }

    /// Capture groups of the first match (groups = 1) or of the first match's groups 1…n.
    static func matches(_ pattern: String, in s: String, options: NSRegularExpression.Options = [], groups: Int = 1) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern, options: options) else { return [] }
        let all = re.matches(in: s, range: NSRange(s.startIndex..., in: s))
        if groups == 1 { return all.compactMap { Range($0.range(at: 1), in: s).map { String(s[$0]) } } }
        guard let m = all.first else { return [] }
        return (1...groups).compactMap { Range(m.range(at: $0), in: s).map { String(s[$0]) } }
    }
}

private extension Array { var nilIfEmpty: Self? { isEmpty ? nil : self } }
