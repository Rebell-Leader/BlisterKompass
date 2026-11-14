import SwiftUI
import AVFoundation

/// Two kinds of colour, so both light and dark mode keep strong contrast:
///  - `accent`, `ok`, … for text and icons: lifted in dark mode so they stay readable on dark cards,
///  - `…Fill` for surfaces carrying white text (big buttons, banners): deep in both modes.
enum Theme {
    static let accent = Color.adaptive("#0B6E8A", lift: 0.5)
    static let ok = Color.adaptive("#1E7A44", lift: 0.45)
    static let warn = Color.adaptive("#9A5B00", lift: 0.5)
    static let bad = Color.adaptive("#B3261E", lift: 0.45)

    static let accentFill = Color(hex: "#0B6E8A")
    static let okFill = Color(hex: "#1E7A44")
    static let warnFill = Color(hex: "#9A5B00")
    static let badFill = Color(hex: "#B3261E")

    static let bg = Color(.systemGroupedBackground)
    static let card = Color(.secondarySystemGroupedBackground)
    static let corner: CGFloat = 22
}

extension UIColor {
    convenience init(hex: String) {
        let v = UInt32(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0
        self.init(red: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
    }

    func mixed(with other: UIColor, _ amount: CGFloat) -> UIColor {
        var (r1, g1, b1, a1, r2, g2, b2, a2): (CGFloat, CGFloat, CGFloat, CGFloat, CGFloat, CGFloat, CGFloat, CGFloat) = (0, 0, 0, 0, 0, 0, 0, 0)
        getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return UIColor(red: r1 + (r2 - r1) * amount, green: g1 + (g2 - g1) * amount, blue: b1 + (b2 - b1) * amount, alpha: a1)
    }
}

extension Color {
    init(hex: String) { self.init(uiColor: UIColor(hex: hex)) }

    /// Same hue; mixed towards white in dark mode so text and icons keep contrast.
    static func adaptive(_ hex: String, lift: CGFloat = 0.4) -> Color {
        let base = UIColor(hex: hex)
        return Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? base.mixed(with: .white, lift) : base })
    }
}

/// Time of day: icon + word, never icon alone.
struct Slot: Identifiable {
    let id: String
    let label: String
    let icon: String
    let hex: String

    /// Box background behind white text.
    var fill: Color { Color(hex: hex) }
    /// Headings and icons on cards.
    var tint: Color { .adaptive(hex, lift: 0.45) }

    // Deep enough for white text (≥ 4.5:1) in both modes.
    static let all: [Slot] = [
        Slot(id: "morning", label: "Morgens", icon: "sunrise.fill", hex: "#B86A00"),
        Slot(id: "noon", label: "Mittags", icon: "sun.max.fill", hex: "#B35400"),
        Slot(id: "evening", label: "Abends", icon: "sunset.fill", hex: "#6A43A3"),
        Slot(id: "night", label: "Nachts", icon: "moon.stars.fill", hex: "#34508C"),
    ]
}

/// What a medication is for, as an icon. Keyed by ATC prefix (longest wins).
enum Purpose {
    private static let icons: [(String, String, Color)] = [
        ("N02BF", "brain.head.profile", Color.adaptive("#6A4FB5")),
        ("C09", "waveform.path.ecg", Color.adaptive("#C0392B")),
        ("C08", "waveform.path.ecg", Color.adaptive("#C0392B")),
        ("C07", "heart.fill", Color.adaptive("#C0392B")),
        ("C03", "drop.fill", Color.adaptive("#2E7BC4")),
        ("A10", "cube.fill", Color.adaptive("#8A6D3B")),
        ("C10", "drop.halffull", Color.adaptive("#B8860B")),
        ("A02", "shield.fill", Color.adaptive("#2E8B57")),
        ("B01", "drop.fill", Color.adaptive("#B3261E")),
        ("H03", "staroflife.fill", Color.adaptive("#2E7BC4")),
        ("L04", "hand.raised.fill", Color.adaptive("#7A4FB5")),
        ("M01", "bolt.fill", Color.adaptive("#D46A00")),
        ("N02", "bolt.fill", Color.adaptive("#D46A00")),
        ("N03", "brain.head.profile", Color.adaptive("#6A4FB5")),
        ("M04", "figure.walk", Color.adaptive("#2E8B57")),
    ]

    static func icon(for atc: String) -> (name: String, tint: Color) {
        let hit = icons.filter { atc.hasPrefix($0.0) }.max { $0.0.count < $1.0.count }
        return (hit?.1 ?? "pills.fill", hit?.2 ?? Theme.accent)
    }
}

enum ShapeInfo {
    static let all: [(code: String, name: String)] = [
        ("round", "rund"), ("oval", "oval"), ("oblong", "länglich"), ("capsule", "Kapsel"), ("heart", "Herz"),
    ]
    static func name(_ code: String?) -> String { all.first { $0.code == code }?.name ?? (code ?? "") }
}

/// Reads results aloud with the iPhone's own German voice – for poor eyesight and for carers with their
/// hands full. On-device only: nothing leaves the phone. Every sentence is its own utterance with a short
/// pause after it, so long readouts come in small, calm pieces.
final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
    static let shared = Speaker()
    private let synth = AVSpeechSynthesizer()
    private var last: AVSpeechUtterance?

    /// Nicest installed German voice: premium > enhanced > compact; among equals the warm female voices first.
    private lazy var voice: AVSpeechSynthesisVoice? = {
        let preferred = ["Anna", "Petra", "Helena", "Marlene"]
        func rank(_ v: AVSpeechSynthesisVoice) -> Int {
            v.quality.rawValue * 10 + (preferred.firstIndex { v.name.hasPrefix($0) }.map { preferred.count - $0 } ?? 0)
        }
        let de = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == "de-DE" }
        return de.max { rank($0) < rank($1) } ?? AVSpeechSynthesisVoice(language: "de-DE")
    }()

    override init() {
        super.init()
        synth.delegate = self
    }

    /// A text of one or more sentences; split at sentence ends for natural pauses.
    func say(_ text: String) {
        say(lines: text.components(separatedBy: ". ").map { $0.hasSuffix(".") || $0.hasSuffix("?") ? $0 : $0 + "." })
    }

    func say(lines: [String]) {
        let lines = lines.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty && $0 != "." }
        guard !lines.isEmpty else { return }
        synth.stopSpeaking(at: .immediate)
        activateAudio()
        for line in lines {
            let u = AVSpeechUtterance(string: line)
            u.voice = voice
            u.rate = 0.44
            u.pitchMultiplier = 1.02
            u.postUtteranceDelay = 0.35
            synth.speak(u)
            last = u
        }
    }

    func stop() { synth.stopSpeaking(at: .immediate) }

    /// Playback + spoken audio: audible even with the ring/silent switch on silent, ducks other audio.
    private func activateAudio() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)
    }

    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { if u === last { releaseAudio() } }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { if !synth.isSpeaking { releaseAudio() } }

    private func releaseAudio() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// The day plan read aloud in plain sentences (fixed templates over plan data, INV-12), ending with the line that the app
/// records no intake: "Jetzt, heute Abend. Zwei Medikamente." · "Ramipril, eine Tablette, weiß und rund." · "Heute früh, schon vorbei. …"
extension Day {
    static func spokenLines(_ sections: [Section]) -> [String] {
        guard !sections.isEmpty else { return ["Auf Ihrem Plan steht noch nichts."] }
        var lines: [String] = []
        for s in sections {
            switch s.kind {
            case .slot(let id):
                let when = spokenWhen(id, past: s.past, lastNight: s.lastNight)
                lines.append((s.now ? "Jetzt, \(when.prefix(1).lowercased() + when.dropFirst())" : when) + ". " + medCount(s.entries.count) + ".")
                lines += s.entries.map { (e: Entry) -> String in
                    // An amount nobody gave stays unknown: said as such, never "eine" (INV-05, T-13).
                    let count: String? = e.amount.map { Med.spokenCount($0, e.med.look) } ?? (e.med.schedule?.kind == "daily" ? "Menge nicht angegeben" : nil)
                    let parts: [String?] = [e.med.substance, count, e.med.look.spokenLook]
                    return parts.compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ") + "."
                }
            case .weeklyToday:
                lines.append("Heute außerdem, nur einmal pro Woche.")
                lines += s.entries.map { "\($0.med.substance), \($0.med.look.spokenLook)." }
            case .weeklyLater:
                lines.append("Diese Woche noch, nur einmal pro Woche.")
                lines += s.entries.map { e in
                    [e.med.substance, e.med.schedule?.days.first.map { "am \(Med.dayName($0))" }, e.med.look.spokenLook]
                        .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ") + "."
                }
            case .prn:
                lines.append("Nur bei Bedarf.")
                lines += s.entries.map { "\($0.med.substance), \($0.med.look.spokenLook)." }
            }
        }
        lines.append(notRecorded)
        return lines
    }

    /// "Heute Abend", "Heute früh, schon vorbei", "Zur Nacht, seit gestern Abend" – never "Morgen" for a slot of today (T-06).
    static func spokenWhen(_ slot: String, past: Bool = false, lastNight: Bool = false) -> String {
        if lastNight { return "Zur Nacht, seit gestern Abend" }
        let when: String
        switch slot {
        case "morning": when = "Heute früh"
        case "noon": when = "Heute Mittag"
        case "evening": when = "Heute Abend"
        default: when = "Heute zur Nacht"
        }
        return past ? "\(when), schon vorbei" : when
    }

    static func medCount(_ n: Int) -> String {
        let words = ["", "Ein", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn", "Elf", "Zwölf"]
        let w = n < words.count ? words[n] : "\(n)"
        return n == 1 ? "Ein Medikament" : "\(w) Medikamente"
    }
}

extension Look {
    /// "weiß und rund", "hellblau und weiß" (capsule: the unit already says Kapsel). Colour and shape only, to keep it short.
    var spokenLook: String {
        var words = [colorName.de, color2Name?.de].compactMap { $0 }.filter { !$0.isEmpty }
        switch shape {
        case "round": words.append("rund")
        case "oval", "softgel": words.append("oval")
        case "oblong": words.append("länglich")
        case "heart": words.append("herzförmig")
        default: break
        }
        guard words.count > 1 else { return words.first ?? "" }
        return words.dropLast().joined(separator: ", ") + " und " + words.last!
    }
}

extension Med {
    var spokenStrength: String {
        (strength ?? "").replacingOccurrences(of: "mg", with: "Milligramm").replacingOccurrences(of: "µg", with: "Mikrogramm")
    }

    var whenText: String {
        guard let s = schedule else { return "" }
        switch s.kind {
        case "prn": return "nur bei Bedarf"
        case "weekly": return "nur einmal pro Woche" + (s.days.first.map { ", am \(Med.dayName($0))" } ?? "")
        default:
            // An amount the plan (or the person) didn't give stays unknown: never "eine" by default (INV-05, T-13).
            return Slot.all.filter { s.slots.contains($0.id) }
                .map { (slot: Slot) -> String in
                    let amount: String = s.amounts[slot.id].map { Med.amountText($0) } ?? "(Menge nicht angegeben)"
                    return "\(slot.label.lowercased()) \(amount)"
                }
                .joined(separator: ", ")
        }
    }

    var spoken: String { spoken(check: false) }

    /// Read aloud on a med card. After a photo match (`check`) it says "Sieht aus wie …", never "Das ist …" (INV-15).
    func spoken(check: Bool) -> String {
        var parts = [check ? "Sieht aus wie \(substance) \(spokenStrength). Bitte prüfen." : "Das ist \(substance) \(spokenStrength)."]
        if let i = indication { parts.append("Wofür: \(i.de).") }
        if !whenText.isEmpty { parts.append("Einnehmen: \(whenText).") }
        if let note = schedule?.note { parts.append("Hinweis: \(note).") }
        return parts.joined(separator: " ")
    }

    static func amountText(_ v: Double) -> String {
        v == 0.5 ? "eine halbe" : v == 1 ? "eine" : v == 2 ? "zwei" : String(format: "%g", v)
    }

    /// "eine Tablette", "eine halbe Tablette", "zwei Kapseln" – spelled out for the voice.
    static func spokenCount(_ a: Double, _ look: Look) -> String {
        let capsule = ["capsule", "softgel"].contains(look.shape)
        let unit = capsule ? (a > 1 ? "Kapseln" : "Kapsel") : (a > 1 ? "Tabletten" : "Tablette")
        let n = a == 0.25 ? "eine viertel" : a == 1.5 ? "anderthalb" : a == 3 ? "drei" : a == 4 ? "vier" : amountText(a)
        return "\(n) \(unit)"
    }

    static func dayName(_ code: String) -> String {
        ["mon": "Montag", "tue": "Dienstag", "wed": "Mittwoch", "thu": "Donnerstag", "fri": "Freitag", "sat": "Samstag", "sun": "Sonntag"][code] ?? code
    }
}
