import Foundation

/// Ranks pills by look against the user's plan – entirely on the phone.
/// Deterministic scorer (weights and similarity tables from the earlier Pill Lens
/// prototype, see git history), reduced to what a photo can show.
enum Matcher {
    struct Scored {
        let med: Med
        let score: Double
        let match: Double
    }

    private static let weight = (imprint: 5.0, color: 3.0, shape: 2.5, size: 1.5, score: 1.5, finish: 0.5)

    private static let colorPairs: [String: Double] = [
        "white|offwhite": 0.7, "white|beige": 0.3, "offwhite|beige": 0.7, "lightyellow|yellow": 0.7,
        "lightyellow|offwhite": 0.5, "lightyellow|beige": 0.4, "yellow|orange": 0.4, "pink|red": 0.6, "pink|orange": 0.3,
        "red|orange": 0.4, "red|brown": 0.3, "brown|beige": 0.3,
    ]
    private static let shapePairs: [String: Double] = [
        "oval|oblong": 0.6, "round|oval": 0.3, "capsule|oblong": 0.1, "softgel|oval": 0.5, "softgel|capsule": 0.5, "heart|round": 0.2,
    ]

    /// 1 = same, table value = similar, -1 = clearly different.
    private static func sim(_ table: [String: Double], _ a: String, _ b: String) -> Double {
        a == b ? 1 : table["\(a)|\(b)"] ?? table["\(b)|\(a)"] ?? -1
    }

    static func sizeClass(_ look: Look) -> String {
        let d = max(look.lengthMm ?? 0, look.widthMm ?? 0)
        return d <= 8.5 ? "small" : d < 13 ? "medium" : "large"
    }

    /// OCR mixes up look-alike glyphs on embossed pills (I400 → 1400, O → 0).
    static func ocrVariants(_ text: String, max: Int = 64) -> Set<String> {
        let lookalike: [Character: [Character]] = ["1": ["1", "i", "l"], "i": ["i", "1", "l"], "l": ["l", "1", "i"], "0": ["0", "o"],
                                                   "o": ["o", "0"], "5": ["5", "s"], "s": ["s", "5"], "8": ["8", "b"], "b": ["b", "8"]]
        var out = [""]
        for ch in text.lowercased() where ch.isLetter || ch.isNumber {
            out = Array(out.flatMap { p in (lookalike[ch] ?? [ch]).map { p + String($0) } }.prefix(max))
        }
        return Set(out)
    }

    static func score(_ med: Med, _ cues: PillCues) -> Scored {
        let look = med.look
        var got = 0.0, possible = 0.0
        func add(_ w: Double, _ v: Double) { possible += w; got += w * v }

        if let read = cues.imprint, !read.isEmpty {
            let own = (look.imprint ?? "").lowercased().filter { $0.isLetter || $0.isNumber }
            let hit = !own.isEmpty && ocrVariants(read).contains(own)
            add(weight.imprint, hit ? 1 : -0.5)
        }
        if !cues.colors.isEmpty {
            let halves = [look.color, look.color2].compactMap { $0 }
            let v = cues.colors.map { c in halves.map { sim(colorPairs, c, $0) }.max() ?? -1 }.reduce(0, +) / Double(cues.colors.count)
            add(weight.color, v)
        }
        if let s = cues.shape { add(weight.shape, sim(shapePairs, s, look.shape)) }
        if let size = cues.size {
            let order = ["small", "medium", "large"]
            let d = abs((order.firstIndex(of: size) ?? 1) - (order.firstIndex(of: sizeClass(look)) ?? 1))
            add(weight.size, d == 0 ? 1 : d == 1 ? 0 : -1)
        }
        if let sc = cues.score { add(weight.score, look.hasScore == sc ? 1 : -1) }
        if let f = cues.finish { add(weight.finish, look.finish == f ? 1 : -0.5) }
        return Scored(med: med, score: got, match: possible > 0 ? max(0, got) / possible : 0)
    }

    static func rank(_ meds: [Med], _ cues: PillCues) -> (results: [Scored], close: [Scored]) {
        let results = meds.map { score($0, cues) }.sorted { $0.score != $1.score ? $0.score > $1.score : $0.match > $1.match }
        guard let top = results.first, top.score > 0 else { return (results, []) }
        return (results, results.filter { $0.score > 0 && $0.match >= top.match - 0.15 })
    }

    /// The answer the app shows. Only the user's plan counts as "yours"; the
    /// catalog is used to warn when a pill fits something NOT on the plan.
    static func answer(myMeds: [Med], catalog: [Med], cues: PillCues) -> Answer {
        let own = rank(myMeds, cues)
        var state: String
        var candidates: [Med]
        switch own.close.count {
        case 0: state = "unknown"; candidates = []
        case 1:
            // Colour and shape alone never make it "sure" when the pill carries an imprint nobody read.
            let unread = !(own.close[0].med.look.imprint ?? "").isEmpty && (cues.imprint ?? "").isEmpty
            state = own.close[0].match >= 0.75 && !unread ? "sure" : "likely"; candidates = [own.close[0].med]
        default: state = "choose"; candidates = own.close.map(\.med)
        }
        var notOnPlan: Med?

        // Something not on the plan fits clearly better → warn. Near-ties: a different maker of a
        // plan drug (pharmacy switch) first, German-market products before US reference data.
        let onPlan = Set(myMeds.map(\.pzn))
        let other = rank(catalog.filter { m in !onPlan.contains(m.pzn) && !(m.pzns ?? []).contains(where: onPlan.contains) }, cues).results
        let ownTop = state == "unknown" ? 0 : own.results[0].match
        if let top = other.first {
            let ties = other.filter { $0.score > 0 && $0.match >= top.match - 0.05 }
            let mine = { (s: Scored) in myMeds.contains { $0.substance == s.med.substance } }
            let german = { (s: Scored) in s.med.market != "US" }
            let best = ties.first { mine($0) && german($0) } ?? ties.first(where: mine) ?? ties.first(where: german) ?? top
            if best.score > 0, best.match >= 0.7, best.match > ownTop + 0.1 {
                notOnPlan = best.med
                if let m = myMeds.first(where: { $0.substance == best.med.substance }) ?? myMeds.first(where: { $0.atc == best.med.atc }) {
                    state = "other_maker"; candidates = [m]
                } else {
                    state = "not_on_plan"; candidates = []
                }
            }
        }
        return Answer(source: "phone", state: state, candidates: Array(candidates.prefix(4)), notOnPlan: notOnPlan,
                      question: state == "choose" ? question(own.close.map(\.med), cues) : nil, problem: nil, vision: nil)
    }

    // MARK: - The one question that best splits the remaining candidates

    private static let questions: [(key: String, text: String, value: (Med) -> String)] = [
        ("score", "Hat die Tablette einen Strich in der Mitte (zum Teilen)?", { $0.look.hasScore ? "ja" : "nein" }),
        ("time", "Wann nehmen Sie sie – morgens, mittags, abends oder zur Nacht?", { m in
            guard let s = m.schedule else { return "—" }
            if s.kind == "prn" { return "bei Bedarf" }
            if s.kind == "weekly" { return "1× pro Woche" }
            let names = ["morning": "morgens", "noon": "mittags", "evening": "abends", "night": "zur Nacht"]
            return Slot.all.filter { s.slots.contains($0.id) }.compactMap { names[$0.id] }.joined(separator: " + ")
        }),
        ("colors", "Welche Farbe hat sie genau?", { $0.look.colorText }),
        ("shape", "Ist sie rund, oval oder eher länglich?", { ShapeInfo.name($0.look.shape) }),
        ("size", "Ist sie eher klein (wie eine Linse) oder groß?", { ["small": "klein", "medium": "mittel", "large": "groß"][sizeClass($0.look)] ?? "" }),
        ("purpose", "Wissen Sie, wofür Sie sie nehmen?", { $0.indication?.de ?? "—" }),
    ]

    static func question(_ close: [Med], _ cues: PillCues) -> Question? {
        guard close.count > 1 else { return nil }
        var asked: Set<String> = []
        if !cues.colors.isEmpty { asked.insert("colors") }
        if cues.shape != nil { asked.insert("shape") }
        if cues.score != nil { asked.insert("score") }
        let n = Double(close.count)
        return questions.filter { !asked.contains($0.key) }.compactMap { q -> (Question, Double)? in
            var groups: [(String, [String])] = []
            for m in close {
                let v = q.value(m)
                if let i = groups.firstIndex(where: { $0.0 == v }) { groups[i].1.append(m.substance) } else { groups.append((v, [m.substance])) }
            }
            guard groups.count > 1 else { return nil }
            let entropy = groups.reduce(0.0) { e, g in let p = Double(g.1.count) / n; return e - p * log2(p) }
            let gain = entropy * (q.key == "purpose" ? 0.6 : 1)
            return (Question(key: q.key, question: q.text, answers: groups.map { QuestionAnswer(answer: $0.0, meds: $0.1) }), gain)
        }
        .max { $0.1 < $1.1 }?.0
    }
}
