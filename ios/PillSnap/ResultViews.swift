import SwiftUI

enum Banner {
    case sure, likely, confirmed

    var text: String {
        switch self {
        case .sure: "Passt zu Ihrem Plan – bitte prüfen"   // a look, never proof (INV-15)
        case .likely: "Wahrscheinlich – bitte prüfen"
        case .confirmed: "Auf Ihrem Plan"
        }
    }
    var icon: String { self == .likely ? "questionmark.circle.fill" : "checkmark.seal.fill" }
    var mascot: String { self == .likely ? "check" : "found" }
    var color: Color { self == .likely ? Theme.warnFill : Theme.okFill }
}

struct ResultView: View {
    @EnvironmentObject var store: Store
    let answer: Answer
    let photo: UIImage?
    let go: (Route) -> Void

    var body: some View {
        switch answer.state {
        case "sure", "likely":
            if let med = answer.candidates?.first {
                MedCardScreen(med: med, photo: photo, banner: answer.state == "sure" ? .sure : .likely, go: go)
            }
        case "choose":
            ChooseView(title: "Welche ist es?", candidates: answer.candidates ?? [], question: answer.question, photo: photo, go: go)
        case "other_maker":
            if let mine = answer.candidates?.first, let other = answer.notOnPlan {
                OtherMakerView(mine: mine, other: other, photo: photo, go: go)
            }
        case "other_strength":
            if let mine = answer.candidates?.first, let other = answer.notOnPlan {
                OtherStrengthView(mine: mine, other: other, photo: photo, go: go)
            }
        case "not_on_plan":
            NotOnPlanView(med: answer.notOnPlan, photo: photo, go: go)
        default:
            NotRecognizedView(answer: answer, photo: photo, go: go)
        }
    }
}

// MARK: - One of my medications, big and clear, no scrolling

struct MedCardScreen: View {
    @EnvironmentObject var store: Store
    let med: Med
    let photo: UIImage?
    let banner: Banner
    let go: (Route) -> Void

    var body: some View {
        FitOrScroll {
            VStack(spacing: 12) {
                BackBar(title: "", speak: { Speaker.shared.say(med.spoken(check: banner != .confirmed)) }) { go(.home) }
                StatusBanner(icon: banner.icon, text: banner.text, color: banner.color, mascot: banner.mascot)

                HStack(spacing: 14) {
                    if let photo {
                        Image(uiImage: photo).resizable().scaledToFill()
                            .frame(width: 112, height: 112).clipShape(RoundedRectangle(cornerRadius: 18))
                            .accessibilityLabel("Ihr Foto")
                        Image(systemName: "equal").font(.title.bold()).foregroundStyle(.secondary)
                    }
                    PillTile(look: med.look, box: 112)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 18))
                }
                if let t = med.look.sourceText { Text(t).font(.footnote).foregroundStyle(.secondary) }

                VStack(spacing: 0) {
                    Text(med.substance).font(.system(size: 36, weight: .bold, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                    if let s = med.strength { Text(s).font(.title2.weight(.semibold)).foregroundStyle(.secondary) }
                }

                if let i = med.indication {
                    let p = Purpose.icon(for: med.atc)
                    InfoRow(icon: p.name, tint: p.tint, title: "Wofür", value: i.de)
                }
                ScheduleBlock(med: med)
                if let note = med.schedule?.note, med.schedule?.kind == "daily" {
                    InfoRow(icon: "fork.knife", tint: Theme.accent, title: "Hinweis", value: note)
                }
                if let change = med.change { ChangedLook(change: change, look: med.look) }

                Spacer(minLength: 0)
                if banner != .confirmed {
                    HStack(spacing: 14) {
                        BigButton(icon: "xmark", title: "Nein", height: 92, color: Color(.systemGray)) {
                            go(.result(.local("choose", candidates: store.myMeds), photo))
                        }
                        BigButton(icon: "checkmark", title: "Ja, stimmt", height: 92, color: Theme.okFill) {
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                            go(.home)
                        }
                    }
                }
            }
            .padding(16)
        }
        .onAppear { if banner != .confirmed { Speaker.shared.say("\(med.substance). \(med.indication?.de ?? "")") } }
    }
}

struct StatusBanner: View {
    let icon: String
    let text: String
    let color: Color
    /// Mascot state (Assets: mascot-<state>) shown instead of the symbol.
    var mascot: String? = nil

    var body: some View {
        Group {
            if let mascot {
                HStack(spacing: 8) {
                    Mascot(state: mascot, size: 64).padding(.vertical, -14)
                    Text(text).frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.leading, 6).padding(.trailing, 12)
            } else {
                Label(text, systemImage: icon)
            }
        }
        .font(.title2.weight(.bold)).foregroundStyle(.white)
        .lineLimit(1).minimumScaleFactor(0.7)
        .frame(maxWidth: .infinity).padding(.vertical, 14)
        .background(color, in: RoundedRectangle(cornerRadius: Theme.corner))
    }
}

/// The BlisterKompass mascot in one of its states. Decorative: the text next to it says what it means.
struct Mascot: View {
    let state: String
    var size: CGFloat = 120

    var body: some View {
        Image("mascot-\(state)").resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}

struct InfoRow: View {
    let icon: String
    let tint: Color
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.system(size: 28)).foregroundStyle(tint).frame(width: 46)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.callout.weight(.semibold)).foregroundStyle(.secondary)
                Text(value).font(.title3.weight(.semibold)).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
    }
}

/// Four big time-of-day boxes; the ones to take light up with the amount.
struct ScheduleBlock: View {
    let med: Med

    var body: some View {
        if let s = med.schedule {
            switch s.kind {
            case "weekly":
                InfoRow(icon: "calendar.badge.exclamationmark", tint: Theme.bad, title: "Achtung", value: med.whenText.capitalizedFirst)
            case "prn":
                InfoRow(icon: "hand.raised.fill", tint: Theme.accent, title: "Wann", value: "Nur bei Bedarf")
            default:
                HStack(spacing: 8) {
                    ForEach(Slot.all) { slot in
                        let amount = s.amounts[slot.id]
                        // A slot on the plan without an amount shows "?": the amount stays unknown, never a default (INV-05).
                        let on = amount != nil || s.slots.contains(slot.id)
                        let shown: String = amount.map { $0 == 0.5 ? "½" : String(format: "%g", $0) } ?? (on ? "?" : "–")
                        VStack(spacing: 4) {
                            Image(systemName: slot.icon).font(.system(size: 28))
                            Text(slot.label).font(.callout.weight(.semibold)).minimumScaleFactor(0.7).lineLimit(1)
                            Text(shown).font(.title.bold())
                        }
                        .foregroundStyle(on ? Color.white : Color.secondary.opacity(0.5))
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(on ? slot.fill : Theme.card, in: RoundedRectangle(cornerRadius: 16))
                        .accessibilityElement(children: .combine)
                    }
                }
            }
        }
    }
}

struct ChangedLook: View {
    let change: Change
    let look: Look

    var body: some View {
        HStack(spacing: 14) {
            if let old = change.previousLook { PillTile(look: old, box: 54).opacity(0.6) }
            Image(systemName: "arrow.right").font(.title3.bold())
            PillTile(look: look, box: 54)
            Text("Sieht neu aus – bitte Apotheke fragen").font(.callout.weight(.bold)).foregroundStyle(Theme.warn)
        }
        .padding(12)
        .frame(maxWidth: .infinity)
        .background(Theme.warn.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.corner))
    }
}

// MARK: - Could be another one: same drug, different maker → ask the pharmacy

struct OtherMakerView: View {
    let mine: Med
    let other: Med
    let photo: UIImage?
    let go: (Route) -> Void

    private var spoken: String {
        "Achtung. Diese Tablette sieht anders aus als auf Ihrem Plan. Sie sieht aus wie \(mine.substance) von einem anderen Hersteller. Bitte mit Apotheke oder Praxis klären, bevor Sie etwas ändern."
    }

    var body: some View {
        FitOrScroll {
            VStack(spacing: 14) {
                BackBar(title: "", speak: { Speaker.shared.say(spoken) }) { go(.home) }
                StatusBanner(icon: "exclamationmark.triangle.fill", text: "Anders als auf Ihrem Plan", color: Theme.warnFill, mascot: "other-maker")

                HStack(alignment: .top, spacing: 10) {
                    compare(title: "Ihr Foto", subtitle: other.manufacturer ?? "") {
                        if let photo {
                            Image(uiImage: photo).resizable().scaledToFill().frame(width: 120, height: 120).clipShape(RoundedRectangle(cornerRadius: 16))
                        } else { PillTile(look: other.look, box: 120) }
                    }
                    Image(systemName: "arrow.left.arrow.right").font(.title2.bold()).foregroundStyle(.secondary).padding(.top, 70)
                    compare(title: "Auf Ihrem Plan", subtitle: mine.manufacturer ?? "") {
                        PillTile(look: mine.look, box: 120).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                    }
                }

                InfoRow(icon: "questionmark.circle.fill", tint: Theme.warn, title: "Sieht aus wie", value: "\(mine.title) – anderer Hersteller")
                InfoRow(icon: "cross.case.fill", tint: Theme.bad, title: "Bitte", value: "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern.")

                Spacer(minLength: 0)
                HStack(spacing: 14) {
                    BigButton(icon: "camera.fill", title: "Nochmal", height: 92, color: Color(.systemGray)) { go(.home) }
                    BigButton(icon: "checkmark", title: "Verstanden", height: 92, color: Theme.warnFill) { go(.home) }
                }
            }
            .padding(16)
        }
        .onAppear { Speaker.shared.say(spoken) }
    }

    private func compare<C: View>(title: String, subtitle: String, @ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: 6) {
            Text(title).font(.headline).foregroundStyle(.secondary)
            content()
            Text(subtitle).font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Looks like the same substance in another strength → its own title next to the plan's, never the plan entry (T-04)

struct OtherStrengthView: View {
    let mine: Med
    let other: Med
    let photo: UIImage?
    let go: (Route) -> Void

    private var spoken: String {
        "Achtung. Diese Tablette sieht aus wie \(other.title). Auf Ihrem Plan steht \(mine.title). Bitte mit Apotheke oder Praxis klären, bevor Sie etwas ändern."
    }

    var body: some View {
        FitOrScroll {
            VStack(spacing: 14) {
                BackBar(title: "", speak: { Speaker.shared.say(spoken) }) { go(.home) }
                StatusBanner(icon: "exclamationmark.triangle.fill", text: "Andere Stärke als auf Ihrem Plan?", color: Theme.warnFill, mascot: "other-maker")

                HStack(alignment: .top, spacing: 10) {
                    VStack(spacing: 6) {
                        Text("Ihr Foto").font(.headline).foregroundStyle(.secondary)
                        if let photo {
                            Image(uiImage: photo).resizable().scaledToFill().frame(width: 120, height: 120).clipShape(RoundedRectangle(cornerRadius: 16))
                        } else {
                            PillTile(look: other.look, box: 120)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    Image(systemName: "arrow.left.arrow.right").font(.title2.bold()).foregroundStyle(.secondary).padding(.top, 70)
                    VStack(spacing: 6) {
                        Text("Auf Ihrem Plan").font(.headline).foregroundStyle(.secondary)
                        PillTile(look: mine.look, box: 120).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .frame(maxWidth: .infinity)
                }

                InfoRow(icon: "questionmark.circle.fill", tint: Theme.warn, title: "Sieht aus wie", value: other.title)
                InfoRow(icon: "doc.text.fill", tint: Theme.accent, title: "Auf Ihrem Plan", value: mine.title)
                InfoRow(icon: "cross.case.fill", tint: Theme.bad, title: "Bitte", value: "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern.")

                Spacer(minLength: 0)
                HStack(spacing: 14) {
                    BigButton(icon: "camera.fill", title: "Nochmal", height: 92, color: Color(.systemGray)) { go(.home) }
                    BigButton(icon: "checkmark", title: "Verstanden", height: 92, color: Theme.warnFill) { go(.home) }
                }
            }
            .padding(16)
        }
        .onAppear { Speaker.shared.say(spoken) }
    }
}

// MARK: - Several candidates

struct ChooseView: View {
    let title: String
    let candidates: [Med]
    let question: Question?
    let photo: UIImage?
    let go: (Route) -> Void
    @State private var filter: Set<String>?

    private var shown: [Med] { filter.map { f in candidates.filter { f.contains($0.substance) } } ?? candidates }
    private var columns: Int { shown.count > 4 ? 3 : 2 }

    var body: some View {
        FitOrScroll {
            VStack(spacing: 14) {
                BackBar(title: "") { go(.home) }
                HStack(spacing: 14) {
                    if let photo {
                        Image(uiImage: photo).resizable().scaledToFill().frame(width: 80, height: 80).clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    Text(title).font(.system(.largeTitle, design: .rounded, weight: .bold))
                    Spacer()
                }
                if let q = question, filter == nil, candidates.count > 1 {
                    VStack(alignment: .leading, spacing: 10) {
                        Label(q.question, systemImage: "questionmark.bubble.fill").font(.title3.weight(.semibold))
                        // Two short answers side by side, otherwise one full-width button each.
                        let layout = q.answers.count <= 2 ? AnyLayout(HStackLayout(spacing: 10)) : AnyLayout(VStackLayout(spacing: 8))
                        layout {
                            ForEach(q.answers, id: \.answer) { a in
                                Button { filter = Set(a.meds) } label: {
                                    Text(a.answer.capitalizedFirst).font(.title3.weight(.bold))
                                        .frame(maxWidth: .infinity).frame(minHeight: 56)
                                        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 16))
                                }
                            }
                        }
                    }
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
                }
                Text("Tippen Sie auf Ihre Tablette:").font(.title3).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: columns), spacing: 10) {
                    ForEach(shown) { med in
                        Button { go(.detail(med, photo)) } label: { MedTile(med: med, compact: columns == 3) }.buttonStyle(.plain)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(16)
        }
    }
}

struct MedTile: View {
    let med: Med
    var compact = false

    var body: some View {
        VStack(spacing: 6) {
            PillTile(look: med.look, box: compact ? 56 : 84, zoomable: false)
            Text(med.substance).font(compact ? .callout.weight(.bold) : .title3.weight(.bold)).lineLimit(1).minimumScaleFactor(0.6)
            if let i = med.indication, !compact {
                let p = Purpose.icon(for: med.atc)
                Label(i.de, systemImage: p.name).font(.callout).foregroundStyle(p.tint).lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .padding(compact ? 8 : 12)
        .frame(maxWidth: .infinity, minHeight: compact ? 96 : 160)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
        .contentShape(Rectangle())
    }
}

// MARK: - Warnings

struct NotOnPlanView: View {
    let med: Med?
    let photo: UIImage?
    let go: (Route) -> Void

    var body: some View {
        FitOrScroll {
            VStack(spacing: 14) {
                BackBar(title: "", speak: { Speaker.shared.say("Achtung. Diese Tablette steht nicht auf Ihrem Plan. Bitte in der Apotheke oder beim Arzt nachfragen.") }) { go(.home) }
                StatusBanner(icon: "exclamationmark.octagon.fill", text: "Nicht auf Ihrem Plan!", color: Theme.badFill, mascot: "not-on-plan")
                HStack(spacing: 14) {
                    if let photo { Image(uiImage: photo).resizable().scaledToFill().frame(width: 120, height: 120).clipShape(RoundedRectangle(cornerRadius: 16)) }
                    if let med {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Sieht aus wie").font(.callout).foregroundStyle(.secondary)
                            Text(med.title).font(.title2.bold()).lineLimit(2).minimumScaleFactor(0.7)
                            if let i = med.indication { Text(i.de).font(.callout).foregroundStyle(.secondary) }
                        }
                        Spacer(minLength: 0)
                    }
                }
                .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
                InfoRow(icon: "hand.raised.slash.fill", tint: Theme.bad, title: "Bitte", value: "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern.")
                InfoRow(icon: "cross.case.fill", tint: Theme.accent, title: "Tipp", value: "Tablette mit Packung in die Apotheke mitnehmen.")
                Spacer(minLength: 0)
                HStack(spacing: 14) {
                    BigButton(icon: "camera.fill", title: "Nochmal", height: 92, color: Color(.systemGray)) { go(.home) }
                    BigButton(icon: "checkmark", title: "Verstanden", height: 92, color: Theme.badFill) { go(.home) }
                }
            }
            .padding(16)
        }
        .onAppear { Speaker.shared.say("Achtung. Diese Tablette steht nicht auf Ihrem Plan.") }
    }
}

struct NotRecognizedView: View {
    let answer: Answer
    let photo: UIImage?
    let go: (Route) -> Void

    private var hint: String {
        switch answer.problem ?? answer.state {
        case "blurry": "Das Foto ist unscharf."
        case "dark": "Das Foto ist zu dunkel."
        case "too_far": "Bitte näher herangehen."
        case "several_pills": "Bitte nur eine Tablette aufs Foto."
        case "no_pill": "Ich sehe keine Tablette."
        case "need_plan": "Bitte zuerst den Code auf Ihrem Medikationsplan scannen."
        case "not_a_plan": "Dieser Code ist kein Medikationsplan."
        case "no_plan_code": "Ich finde keinen Plan-Code. Bitte den Code oben rechts auf dem Plan ganz ins Bild nehmen."
        case "no_pack_code": "Ich finde keinen Code auf der Packung. Bitte den quadratischen Code oder den Strichcode ganz ins Bild nehmen."
        case "pack_not_plan": "Das ist ein Packungs-Code, kein Medikationsplan."
        case "plan_not_pack": "Das ist ein Medikationsplan. Dafür bitte „Plan neu einlesen“ wählen."
        case "code_not_pill": "Auf dem Foto ist ein Code, keine Tablette. Für Packungen bitte „Packung“ wählen."
        default: "Keine Tablette Ihres Plans passt."
        }
    }

    var body: some View {
        FitOrScroll {
            VStack(spacing: 14) {
                BackBar(title: "") { go(.home) }
                StatusBanner(icon: "eye.slash.fill", text: answer.state == "need_plan" ? "Noch kein Plan" : "Nicht erkannt", color: Theme.warnFill, mascot: "not-recognized")
                if let photo { Image(uiImage: photo).resizable().scaledToFill().frame(maxWidth: .infinity).frame(height: 220).clipShape(RoundedRectangle(cornerRadius: Theme.corner)) }
                InfoRow(icon: "info.circle.fill", tint: Theme.warn, title: "Grund", value: hint)
                Spacer(minLength: 0)
                HStack(spacing: 14) {
                    BigButton(icon: "camera.fill", title: "Nochmal", height: 110) { go(.home) }
                    if !["need_plan", "not_a_plan", "no_code"].contains(answer.state) {
                        BigButton(icon: "hand.tap.fill", title: "Antippen", height: 110, color: Theme.okFill) { go(.picker(photo)) }
                    }
                }
            }
            .padding(16)
        }
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
