import Foundation

// Product and plan data only. There is deliberately no type for a person.

struct LocalName: Codable, Hashable {
    let de: String
    let en: String?
}

struct Look: Codable, Hashable {
    let shape: String
    let color: String
    let color2: String?
    let lengthMm: Double?
    let widthMm: Double?
    let score: String?
    let imprint: String?
    let finish: String?
    let colorHex: String
    let color2Hex: String?
    let colorName: LocalName
    let color2Name: LocalName?
    /// Where the look comes from: leaflet:<url> | ema:… | dailymed:<setid> | demo
    var source: String? = nil
    /// The package leaflet's own words (PIL §6) when `source` is a leaflet.
    var leaflet: String? = nil

    /// Shown under the picture, so nobody takes reference data for their own pill.
    var sourceText: String? {
        guard let s = source else { return nil }
        if s.hasPrefix("leaflet:pdf:") { return "Aussehen laut der Packungsbeilage, die Sie gewählt haben" }
        if s.hasPrefix("leaflet:") { return "Aussehen laut Packungsbeilage" }
        if s.hasPrefix("ema") { return "Aussehen laut EMA-Produktinformation" }
        if s.hasPrefix("dailymed") { return "Aussehen: US-Referenzdaten" }
        return "Aussehen: Beispieldaten"
    }

    var colorText: String { [colorName.de, color2Name?.de].compactMap { $0 }.joined(separator: " / ") }
    var hasScore: Bool { (score ?? "none") != "none" }
}

struct Schedule: Codable, Hashable {
    let kind: String            // daily | weekly | prn
    let slots: [String]         // morning | noon | evening | night
    let amounts: [String: Double]
    let days: [String]
    let note: String?
    let text: String?
}

struct Change: Codable, Hashable {
    let daysAgo: Int
    let previousLook: Look?
}

/// A product from the bundled catalog; on the user's plan it also carries the plan's schedule.
struct Med: Codable, Hashable, Identifiable {
    var id: String { pzn }
    var pzn: String
    /// Further PZNs of the same product (other pack sizes), e.g. for looks taken from a package leaflet.
    var pzns: [String]? = nil
    let name: String
    let substance: String
    let strength: String?
    let manufacturer: String?
    let atc: String
    let indication: LocalName?
    let look: Look
    let market: String?         // DE | US (US = DailyMed reference data)
    var schedule: Schedule?
    var change: Change?

    var title: String { [substance, strength].compactMap { $0 }.joined(separator: " ") }
}

extension Array where Element == Med {
    /// The catalog product a PZN belongs to (any of its pack sizes), carrying the PZN that was scanned.
    func product(pzn p: String) -> Med? {
        guard var m = first(where: { $0.pzn == p || ($0.pzns ?? []).contains(p) }) else { return nil }
        m.pzn = p
        return m
    }

    /// The plan with one more entry; an entry with the same PZN is replaced (new schedule).
    func adding(_ med: Med) -> [Med] { filter { $0.pzn != med.pzn } + [med] }
}

/// The plan laid out over the day: what is due now, what comes later. Only the clock and the plan's
/// schedule decide; nothing is tracked or inferred (intake is not recorded).
enum Day {
    static let order = ["morning", "noon", "evening", "night"]

    /// Shown and spoken with the day list: the app never knows what was taken.
    static let notRecorded = "Die App merkt sich nicht, was Sie schon genommen haben."

    /// Time of day → plan slot: morning 4–11, noon 11–15, evening 15–21, night 21–4.
    static func slot(at date: Date, calendar: Calendar = .current) -> String {
        switch calendar.component(.hour, from: date) {
        case 4..<11: "morning"
        case 11..<15: "noon"
        case 15..<21: "evening"
        default: "night"
        }
    }

    static func weekday(at date: Date, calendar: Calendar = .current) -> String {
        ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][calendar.component(.weekday, from: date) - 1]
    }

    struct Entry: Identifiable { let med: Med; let amount: Double?; var id: String { med.pzn } }

    struct Section: Identifiable {
        enum Kind: Equatable { case slot(String), weeklyToday, weeklyLater, prn }
        let kind: Kind
        let entries: [Entry]
        let now: Bool
        /// Always false: a slot of today is never shown as tomorrow (T-06). Kept for older callers.
        let tomorrow: Bool
        /// Today's slot, already past ("Heute vorbei").
        var past = false
        /// 00:00–04:00: the night slot is last night's bedtime dose, never "now" again.
        var lastNight = false
        var id: String { "\(kind)" }
    }

    /// Now first, then the rest of the day in order, then today's slots already past (`past`, never "tomorrow", so nobody
    /// skips a morning dose at 11:05), weekly meds due today, as-needed last. Empty sections are left out. The day runs
    /// 04:00–04:00: between midnight and 04:00 the night slot is last night's (`lastNight`), never "now" again (T-06).
    static func sections(_ meds: [Med], at date: Date, calendar: Calendar = .current) -> [Section] {
        let current = slot(at: date, calendar: calendar)
        let start = order.firstIndex(of: current)!
        let afterMidnight = current == "night" && calendar.component(.hour, from: date) < 4
        var out: [Section] = []
        let today = weekday(at: date, calendar: calendar)
        let weekly = meds.filter { $0.schedule?.kind == "weekly" && ($0.schedule?.days.contains(today) ?? false) }
        if !weekly.isEmpty { out.append(Section(kind: .weeklyToday, entries: weekly.map { Entry(med: $0, amount: nil) }, now: true, tomorrow: false)) }
        for k in 0..<order.count {
            let slot = order[(start + k) % order.count]
            let entries = meds.compactMap { m -> Entry? in
                guard let s = m.schedule, s.kind == "daily", s.slots.contains(slot) || (s.amounts[slot] ?? 0) > 0 else { return nil }
                return Entry(med: m, amount: s.amounts[slot])
            }
            guard !entries.isEmpty else { continue }
            let past = start + k >= order.count && !afterMidnight
            let lastNight = k == 0 && afterMidnight
            out.append(Section(kind: .slot(slot), entries: entries, now: k == 0 && !afterMidnight, tomorrow: false, past: past, lastNight: lastNight))
        }
        // The current slot leads, even before weekly meds.
        if let i = out.firstIndex(where: { $0.kind == .slot(current) }), i > 0 { out.insert(out.remove(at: i), at: 0) }
        let laterThisWeek = meds.filter { $0.schedule?.kind == "weekly" && !($0.schedule?.days.contains(today) ?? false) }
        if !laterThisWeek.isEmpty { out.append(Section(kind: .weeklyLater, entries: laterThisWeek.map { Entry(med: $0, amount: nil) }, now: false, tomorrow: false)) }
        let prn = meds.filter { $0.schedule?.kind == "prn" }
        if !prn.isEmpty { out.append(Section(kind: .prn, entries: prn.map { Entry(med: $0, amount: nil) }, now: false, tomorrow: false)) }
        return out
    }
}

/// A scanned Medikationsplan: meds with a known look, plus entries without picture data.
struct ScannedPlan {
    let meds: [Med]
    let unknown: [String]
    /// PZNs of entries without picture data – still "on the plan" when their pack is scanned.
    var unknownPZNs: [String] = []
    /// The plan code it was read from (to read it again after a leaflet lookup).
    var xml: String? = nil
}

struct QuestionAnswer: Codable, Hashable {
    let answer: String
    let meds: [String]   // substances
}

struct Question: Codable, Hashable {
    let key: String
    let question: String
    let answers: [QuestionAnswer]
}

struct VisionInfo: Codable, Hashable {
    let note: String?
    let photoProblem: String?
}

/// state: sure | likely | choose | other_maker | not_on_plan | unknown | retake | need_plan | not_a_plan | no_code
struct Answer: Codable {
    var source: String?
    var state: String
    var candidates: [Med]?
    var notOnPlan: Med?
    var question: Question?
    var problem: String?
    var vision: VisionInfo?

    static func local(_ state: String, candidates: [Med] = [], problem: String? = nil) -> Answer {
        Answer(source: "phone", state: state, candidates: candidates, notOnPlan: nil, question: nil, problem: problem, vision: nil)
    }
}

/// What the phone recognised in the photo.
struct PillCues: Equatable {
    var found = false
    var colors: [String] = []
    var shape: String?
    var imprint: String?
    var size: String?
    var score: Bool?
    var finish: String?
    var seenHex: [String] = []
}
