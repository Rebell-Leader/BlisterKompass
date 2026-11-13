import SwiftUI

/// Popup: how to (re)enter the plan – camera, example plans in the gallery, or typing.
struct PlanSourceSheet: View {
    let camera: () -> Void
    let gallery: () -> Void
    let typing: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 14) {
            Text("Plan einlesen").font(.system(.title, design: .rounded, weight: .bold)).padding(.top, 24)
            BigButton(icon: "camera.fill", title: "Kamera", height: 104) { dismiss(); camera() }
            HStack(spacing: 14) {
                Tile(icon: "photo.on.rectangle.angled", title: "Beispiele") { dismiss(); gallery() }
                Tile(icon: "keyboard", title: "Selbst\neingeben") { dismiss(); typing() }
            }
            Button("Abbrechen") { dismiss() }.font(.title3.weight(.semibold)).padding(.top, 4)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .presentationDetents([.height(420)])
        .presentationDragIndicator(.visible)
    }
}

/// Type the medicines: search the bundled catalog, pick when to take it, add.
/// Starts with the current list so it can also be corrected. Nothing personal is asked.
struct ManualPlanView: View {
    @EnvironmentObject var store: Store
    let go: (Route) -> Void
    /// Set when coming from a scanned pack: only ask when it is taken, then add it to the plan.
    var adding: Med? = nil
    @State private var meds: [Med] = []
    @State private var query = ""
    @State private var picked: Med?
    @State private var slots: Set<String> = []
    @State private var special: String?   // "prn" | "weekly"
    @FocusState private var typing: Bool

    private var suggestions: [Med] {
        let q = query.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .init(identifier: "de_DE")).trimmingCharacters(in: .whitespaces)
        guard q.count >= 2 else { return [] }
        let fold = { (s: String) in s.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .init(identifier: "de_DE")) }
        var seen = Set<String>()
        return store.catalog
            .filter { fold($0.substance).hasPrefix(q) || fold($0.name).contains(q) }
            .sorted { ($0.market == "US" ? 1 : 0, $0.substance) < ($1.market == "US" ? 1 : 0, $1.substance) }
            .filter { seen.insert("\($0.substance)|\($0.strength ?? "")").inserted }
            .prefix(4).map { $0 }
    }

    var body: some View {
        FitOrScroll {
            VStack(alignment: .leading, spacing: 14) {
                BackBar(title: adding == nil ? "Selbst eingeben" : "Zum Plan hinzufügen") { go(.home) }
                if let med = picked { whenToTake(med) } else { search }
                Spacer(minLength: 0)
                if picked == nil {
                    BigButton(icon: "checkmark", title: "Fertig (\(meds.count))", height: 86,
                              color: meds.isEmpty ? Color(.systemGray3) : Theme.okFill) {
                        store.adopt(ScannedPlan(meds: meds, unknown: []))
                        Speaker.shared.say("\(meds.count) Medikamente gespeichert.")
                        go(.home)
                    }
                    .disabled(meds.isEmpty)
                }
            }
            .padding(16)
        }
        .onAppear { meds = store.myMeds; picked = adding }
    }

    // Step 1: search + current list
    private var search: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Name, z. B. Ramipril", text: $query)
                .font(.title2).textInputAutocapitalization(.words).autocorrectionDisabled()
                .focused($typing)
                .padding(16)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
                .overlay(RoundedRectangle(cornerRadius: Theme.corner).stroke(Theme.accent, lineWidth: 2))
            if !query.isEmpty && suggestions.isEmpty && query.count >= 2 {
                Label("Nicht im Katalog – bitte anders schreiben.", systemImage: "questionmark.circle").font(.callout).foregroundStyle(Theme.warn)
            }
            ForEach(suggestions) { m in
                Button { picked = m; slots = []; special = nil; typing = false } label: {
                    HStack(spacing: 12) {
                        PillTile(look: m.look, box: 48, zoomable: false)
                        VStack(alignment: .leading) {
                            Text(m.title).font(.title3.weight(.bold))
                            if let i = m.indication { Text(i.de).font(.callout).foregroundStyle(.secondary) }
                        }
                        Spacer()
                        Image(systemName: "plus.circle.fill").font(.title).foregroundStyle(Theme.accent)
                    }
                    .padding(10).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                }
                .buttonStyle(.plain)
            }
            if suggestions.isEmpty {
                Text(meds.isEmpty ? "Noch keine Medikamente." : "Ihre Liste (\(meds.count))").font(.headline).foregroundStyle(.secondary)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(meds) { m in
                        VStack(spacing: 4) {
                            PillTile(look: m.look, box: 40)
                            Text(m.substance).font(.callout.weight(.bold)).lineLimit(1).minimumScaleFactor(0.6)
                        }
                        .padding(8).frame(maxWidth: .infinity)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(alignment: .topTrailing) {
                            Button { meds.removeAll { $0.pzn == m.pzn } } label: {
                                Image(systemName: "xmark.circle.fill").font(.title2).foregroundStyle(.white, Theme.badFill)
                            }
                            .offset(x: 6, y: -6)
                            .accessibilityLabel("\(m.substance) entfernen")
                        }
                    }
                }
            }
        }
    }

    // Step 2: when is it taken?
    private func whenToTake(_ med: Med) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                PillTile(look: med.look, box: 64)
                Text(med.title).font(.title2.bold())
            }
            Text("Wann nehmen Sie sie?").font(.title2.weight(.bold))
            HStack(spacing: 8) {
                ForEach(Slot.all) { s in
                    let on = slots.contains(s.id)
                    Button { if on { slots.remove(s.id) } else { slots.insert(s.id); special = nil } } label: {
                        VStack(spacing: 6) {
                            Image(systemName: s.icon).font(.system(size: 28))
                            Text(s.label).font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                        }
                        .foregroundStyle(on ? .white : s.tint)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(on ? s.fill : Theme.card, in: RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            HStack(spacing: 8) {
                choice("prn", "Bei Bedarf", "hand.raised.fill")
                choice("weekly", "1× pro Woche", "calendar")
            }
            HStack(spacing: 14) {
                BigButton(icon: "xmark", title: "Zurück", height: 86, color: Color(.systemGray)) { if adding == nil { picked = nil } else { go(.home) } }
                BigButton(icon: "plus", title: "Hinzufügen", height: 86,
                          color: slots.isEmpty && special == nil ? Color(.systemGray3) : Theme.okFill) { add(med) }
                    .disabled(slots.isEmpty && special == nil)
            }
            .padding(.top, 8)
        }
    }

    private func choice(_ key: String, _ title: String, _ icon: String) -> some View {
        let on = special == key
        return Button { special = on ? nil : key; if !on { slots = [] } } label: {
            Label(title, systemImage: icon).font(.title3.weight(.semibold))
                .foregroundStyle(on ? .white : Theme.accent)
                .frame(maxWidth: .infinity).padding(.vertical, 14)
                .background(on ? Theme.accentFill : Theme.card, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    private func add(_ med: Med) {
        var m = med
        switch special {
        case "prn": m.schedule = Schedule(kind: "prn", slots: [], amounts: [:], days: [], note: nil, text: "bei Bedarf")
        case "weekly": m.schedule = Schedule(kind: "weekly", slots: [], amounts: [:], days: [], note: nil, text: "einmal pro Woche")
        default:
            // The time of day is what the person chose; the amount wasn't asked, so it stays unknown (INV-05, T-13).
            let ordered = Slot.all.map(\.id).filter { slots.contains($0) }
            m.schedule = Schedule(kind: "daily", slots: ordered, amounts: [:], days: [], note: nil, text: nil)
        }
        if adding != nil {
            store.add(m)
            Speaker.shared.say("\(m.title) steht jetzt auf Ihrem Plan.")
            go(.home)
            return
        }
        meds = meds.adding(m)
        picked = nil
        query = ""
    }
}
