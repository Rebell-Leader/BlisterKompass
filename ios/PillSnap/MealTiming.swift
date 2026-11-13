import Foundation

/// When to take a medicine relative to a meal, read from the plan's free-text "Hinweise".
///
/// The BMP (2.8) has no coded field for this: "nüchtern", "vor dem Essen", "zu den Mahlzeiten" are free text in `M/@i`
/// (or in the free-text dosing `t`). This reads only clear, common wordings. Anything else, a negation ("nicht nüchtern")
/// or "unabhängig von den Mahlzeiten" gives nil: no tag rather than a guessed one (INV-05). The full Hinweise text is
/// always shown next to the tag.
enum MealTiming: String, CaseIterable {
    case fasting, before, with, after

    /// Short word for the tag on the sheet and in the day list.
    var label: String {
        switch self {
        case .fasting: "nüchtern"
        case .before: "vor dem Essen"
        case .with: "zum Essen"
        case .after: "nach dem Essen"
        }
    }

    /// SF Symbol for the app (the printed sheet draws its own SVG).
    var symbol: String {
        switch self {
        case .fasting: "drop.fill"
        case .before, .with, .after: "fork.knife"
        }
    }

    private static let wordings: [(MealTiming, [String])] = [
        (.fasting, ["nüchtern"]),
        (.before, ["vor dem essen", "vor den mahlzeiten", "vor der mahlzeit", "vor einer mahlzeit", "vor dem frühstück",
                   "vor dem mittagessen", "vor dem abendessen"]),
        (.after, ["nach dem essen", "nach den mahlzeiten", "nach der mahlzeit", "nach einer mahlzeit", "nach dem frühstück",
                  "nach dem mittagessen", "nach dem abendessen"]),
        (.with, ["zu den mahlzeiten", "zur mahlzeit", "zum essen", "während der mahlzeit", "während des essens",
                 "mit dem essen", "mit einer mahlzeit", "mit etwas essen", "zum frühstück", "zu einer mahlzeit"]),
    ]

    /// First clear wording wins in the order fasting, before, after, with ("nüchtern, 30 min vor dem Frühstück" → fasting).
    static func from(_ texts: String?...) -> MealTiming? {
        let t = texts.compactMap { $0 }.joined(separator: " ").lowercased()
        guard !t.isEmpty, !t.contains("unabhängig"), !t.contains("nicht nüchtern"), !t.contains("egal") else { return nil }
        return wordings.first { _, words in words.contains { t.contains($0) } }?.0
    }
}

extension Schedule {
    var meal: MealTiming? { MealTiming.from(note, text) }
}
