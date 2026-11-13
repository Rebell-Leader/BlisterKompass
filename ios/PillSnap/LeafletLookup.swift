import SwiftUI

/// "Wie sieht das aus?" – per medicine, where its look comes from, shown step by step.
/// Known products come from the catalog (leaflets read beforehand by tools/fetch-leaflet-looks.py); the pause per
/// row is presentation. Unknown PZNs are looked up for real (`fetch`, see LeafletOnline) if the user allowed it.
struct LeafletLookupItem: Identifiable {
    let id: String          // PZN or substance
    let title: String
    let look: Look?
    let form: DoseForm?
    /// Overrides the status line (e.g. "Keine Packungsbeilage gefunden").
    var note: String? = nil

    enum Source { case leaflet, reference, formOnly, unknown }
    var source: Source {
        if let s = look?.source { return s.hasPrefix("leaflet:") ? .leaflet : .reference }
        return form == nil ? .unknown : .formOnly
    }
    /// Leaflet lookups take a moment on screen; the rest is instant.
    var delay: Double { source == .leaflet ? 0.75 : 0.25 }
}

/// Rows appear one after another: spinner while "reading", then the picture and its source.
struct LeafletLookupList: View {
    let items: [LeafletLookupItem]
    /// Live lookup for items without a look (nil = none).
    var fetch: ((LeafletLookupItem) async -> LeafletLookupItem)? = nil
    var step: (String) -> Void = { _ in }
    var done: () -> Void = {}
    @State private var shown = 0
    @State private var finished = false
    @State private var resolved: [String: LeafletLookupItem] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.element.id) { i, item in
                if i < shown {
                    LeafletLookupRow(item: resolved[item.id] ?? item, busy: i == shown - 1 && !finished,
                                     online: fetch != nil && item.look == nil).id(item.id)
                }
            }
        }
        .task {
            for i in items.indices {
                withAnimation(.easeOut(duration: 0.2)) { shown = i + 1 }
                step(items[i].id)
                if let fetch, items[i].look == nil {
                    let r = await fetch(items[i])
                    withAnimation { resolved[items[i].id] = r }
                } else {
                    try? await Task.sleep(for: .seconds(items[i].delay))
                }
            }
            finished = true
            done()
        }
    }
}

struct LeafletLookupRow: View {
    let item: LeafletLookupItem
    let busy: Bool
    var online = false

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if busy {
                    ProgressView().controlSize(.large)
                } else if let look = item.look {
                    PillTile(look: look, box: 52)
                } else {
                    DoseFormTile(form: item.form, box: 52)
                }
            }
            .frame(width: 56, height: 56)
            .background(Theme.bg, in: RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title).font(.headline).lineLimit(1).minimumScaleFactor(0.7)
                if busy {
                    Label(online ? "Packungsbeilage wird online gesucht …" : item.source == .leaflet ? "Packungsbeilage wird gelesen …" : "Wird nachgeschlagen …",
                          systemImage: online ? "network" : "doc.text.magnifyingglass")
                        .font(.footnote).foregroundStyle(.secondary)
                } else {
                    status
                }
            }
            Spacer(minLength: 0)
            if !busy { Image(systemName: icon).font(.title3).foregroundStyle(tint) }
        }
        .padding(8)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var status: some View {
        if let note = item.note {
            Text(note).font(.footnote).foregroundStyle(Theme.warn).lineLimit(2)
        } else {
            sourceText
        }
    }

    @ViewBuilder private var sourceText: some View {
        switch item.source {
        case .leaflet:
            Text(item.look?.leaflet.map { "„\($0)“" } ?? "Aussehen laut Packungsbeilage")
                .font(.footnote).foregroundStyle(.secondary).lineLimit(2)
        case .reference:
            Text(item.look?.sourceText ?? "").font(.footnote).foregroundStyle(.secondary)
        case .formOnly:
            Text("Keine Packungsbeilage · \(item.form!.label), Aussehen unbekannt").font(.footnote).foregroundStyle(Theme.warn)
        case .unknown:
            Text("Keine Packungsbeilage · Aussehen unbekannt").font(.footnote).foregroundStyle(Theme.warn)
        }
    }

    private var icon: String {
        switch item.source {
        case .leaflet: "checkmark.circle.fill"
        case .reference: "checkmark.circle"
        case .formOnly, .unknown: "questionmark.circle"
        }
    }
    private var tint: Color { item.source == .leaflet ? Theme.ok : item.source == .reference ? .secondary : Theme.warn }
}

/// One-time question before the first online lookup. Only the PZN is sent, nothing about the person.
struct OnlineLeafletConsent: View {
    let count: Int
    let decide: (Bool) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Packungsbeilage online suchen?", systemImage: "network").font(.title3.weight(.bold))
            Text(count == 1 ? "Für dieses Medikament kennt die App das Aussehen noch nicht." : "Für \(count) Medikamente kennt die App das Aussehen noch nicht.")
                .font(.body)
            Text("Dafür wird nur die PZN (Nummer der Packung) an eine Online-Apotheke gesendet, die Packungsbeilagen bereitstellt. Nichts über Sie.")
                .font(.callout).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                BigButton(icon: "xmark", title: "Nein", height: 72, color: Color(.systemGray)) { decide(false) }
                BigButton(icon: "checkmark", title: "Erlauben", height: 72, color: Theme.okFill) { decide(true) }
            }
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
    }
}

extension Store {
    /// Live lookup for one row: the found look, or a note why there is none.
    func lookupRow(_ item: LeafletLookupItem) async -> LeafletLookupItem {
        switch await learn(pzn: item.id) {
        case .found(let med): return LeafletLookupItem(id: item.id, title: med.title, look: med.look, form: nil)
        case .noLeaflet: return LeafletLookupItem(id: item.id, title: item.title, look: nil, form: item.form, note: "Keine Packungsbeilage gefunden")
        case .unclear: return LeafletLookupItem(id: item.id, title: item.title, look: nil, form: item.form, note: "Packungsbeilage gefunden, Aussehen nicht eindeutig beschrieben")
        case .offline: return LeafletLookupItem(id: item.id, title: item.title, look: nil, form: item.form, note: onlineLeaflets == true ? "Keine Verbindung" : "Nicht online gesucht")
        }
    }
}
