import SwiftUI

// MARK: - Scanned pack → what it means for my plan (exact, via PZN)

struct PackResultView: View {
    @EnvironmentObject var store: Store
    let scanned: PackResult
    let photo: UIImage?
    let go: (Route) -> Void
    @State private var lookedUp = false
    /// The pack evaluated again after its leaflet was found online.
    @State private var live: PackResult?
    @State private var asked = false
    private var result: PackResult { live ?? scanned }
    /// No picture yet for this PZN → it can be looked up online (asked once).
    private var canLookUp: Bool { scanned.product == nil && scanned.mine == nil && LeafletOnline.url(pzn: scanned.code.pzn) != nil }
    /// The take-over button only appears once the user says the pharmacy confirmed the switch.
    @State private var pharmacyConfirmed = false

    private var banner: (text: String, icon: String, color: Color, mascot: String) {
        switch result.kind {
        case .onPlan, .onPlanNoLook: ("Auf Ihrem Plan", "checkmark.seal.fill", Theme.okFill, "found")
        case .otherMaker: ("Gleicher Wirkstoff, andere Packung", "arrow.triangle.2.circlepath", Theme.warnFill, "other-maker")
        case .sameSubstance: ("Gleicher Wirkstoff wie auf Ihrem Plan", "exclamationmark.triangle.fill", Theme.warnFill, "check")
        case .notOnPlan: ("Nicht auf Ihrem Plan!", "exclamationmark.octagon.fill", Theme.badFill, "not-in-list")
        case .unknown: ("Packung nicht in der Datenbank", "questionmark.square.dashed", Color(.systemGray), "not-recognized")
        }
    }

    private var spoken: String {
        var s: String
        switch result.kind {
        case .onPlan, .onPlanNoLook: s = "Diese Packung steht auf Ihrem Plan: \(result.title)."
        case .otherMaker: s = "\(result.title) hat denselben Wirkstoff und dieselbe Stärke wie \(result.mine?.title ?? "ein Medikament auf Ihrem Plan"). Ob diese Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke."
        case .sameSubstance: s = "Achtung. \(result.title) enthält denselben Wirkstoff wie \(result.mine?.title ?? "ein Medikament auf Ihrem Plan"), \(result.difference ?? "aber nicht dasselbe Präparat"). Bitte in der Apotheke fragen."
        case .notOnPlan: s = "Achtung. \(result.title) steht nicht auf Ihrem Plan. Neu verordnet? Dann fügen Sie es hinzu. Sonst bitte in der Apotheke nachfragen."
        case .unknown: s = "Diese Packung kenne ich nicht. Bitte in der Apotheke nachfragen."
        }
        if result.expired, let e = result.code.expiryText { s += " Achtung, abgelaufen seit \(e)." }
        return s
    }

    var body: some View {
        FitOrScroll {
            VStack(spacing: 12) {
                BackBar(title: "", speak: { Speaker.shared.say(spoken) }) { go(.home) }
                StatusBanner(icon: banner.icon, text: banner.text, color: banner.color, mascot: banner.mascot)
                if result.expired, let e = result.code.expiryText {
                    StatusBanner(icon: "calendar.badge.exclamationmark", text: "Abgelaufen seit \(e)", color: Theme.badFill)
                }

                if result.kind == .otherMaker, let mine = result.mine {
                    compare(mine)
                } else if !lookedUp && canLookUp && store.onlineLeaflets == nil && !asked {
                    OnlineLeafletConsent(count: 1) { ok in
                        store.onlineLeaflets = ok
                        withAnimation { asked = true }
                    }
                } else if !lookedUp {
                    // "Wie sieht sie aus?" – from the catalog, or looked up online by PZN.
                    LeafletLookupList(items: [LeafletLookupItem(id: result.code.pzn, title: result.title,
                                                                look: (result.product ?? result.mine)?.look, form: form)],
                                      fetch: canLookUp && store.onlineLeaflets == true ? { await store.lookupRow($0) } : nil) {
                        Task {
                            let again = store.check(scanned.code)
                            if again.product != nil && scanned.product == nil { live = again }
                            try? await Task.sleep(for: .seconds(canLookUp ? 0.8 : 0))
                            withAnimation { lookedUp = true }
                        }
                    }
                } else {
                    productCard
                    if let quote = (result.product ?? result.mine)?.look.leaflet {
                        Label("„\(quote)“", systemImage: "doc.text")
                            .font(.footnote).foregroundStyle(.secondary).lineLimit(3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                if result.kind == .sameSubstance, let mine = result.mine {
                    InfoRow(icon: "exclamationmark.triangle.fill", tint: Theme.warn, title: "Gleicher Wirkstoff wie auf Ihrem Plan",
                            value: "\(mine.title) – \(result.difference ?? "anderes Präparat"). Bitte in der Apotheke fragen.")
                }

                if let mine = result.mine, result.kind == .onPlan { ScheduleBlock(med: mine) }
                if let i = (result.product ?? result.mine)?.indication {
                    let p = Purpose.icon(for: (result.product ?? result.mine)!.atc)
                    InfoRow(icon: p.name, tint: p.tint, title: "Wofür", value: i.de)
                }
                HStack(spacing: 10) {
                    if let e = result.code.expiryText {
                        chip("calendar", "Haltbar bis \(e)", result.expired ? Theme.bad : Theme.accent)
                    }
                    if let b = result.code.batch { chip("number", "Charge \(b)", .secondary) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Spacer(minLength: 0)
                if result.kind == .otherMaker, let mine = result.mine, let product = result.product {
                    if pharmacyConfirmed {
                        BigButton(icon: "arrow.triangle.2.circlepath", title: "Neues Aussehen übernehmen", height: 96, color: Theme.okFill, iconOnly: true) {
                            store.takeOver(product, replacing: mine)
                            Speaker.shared.say("Übernommen. \(product.substance) sieht ab jetzt so aus.")
                            go(.home)
                        }
                    } else {
                        Button { pharmacyConfirmed = true } label: {
                            Label("Apotheke hat bestätigt: ersetzt meine Packung", systemImage: "cross.case.fill")
                                .font(.headline).multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                        }
                    }
                }
                if result.canAdd {
                    BigButton(icon: "plus", title: "Zu meinem Plan hinzufügen", height: 96, color: Theme.accentFill, iconOnly: true) {
                        if let product = result.product {
                            go(.addToPlan(product))
                        } else {
                            store.addWithoutLook(pzn: result.code.pzn)
                            Speaker.shared.say("\(result.title) steht jetzt auf Ihrem Plan, ohne Bild.")
                            go(.home)
                        }
                    }
                }
                BigButton(icon: "trash.fill", title: "Verwerfen", height: 96, color: Color(.systemGray), iconOnly: true) { go(.home) }
            }
            .padding(16)
        }
        .onAppear { Speaker.shared.say(spoken) }
    }

    /// Dosage form from the PZN list, for packs without picture data.
    private var form: DoseForm? { result.name.flatMap { DoseForm(code: $0.form) } }

    private var productCard: some View {
        HStack(spacing: 14) {
            if let look = (result.product ?? result.mine)?.look {
                PillTile(look: look, box: 90).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
            } else {
                DoseFormTile(form: form, box: 90).background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(result.title).font(.title2.bold()).lineLimit(2).minimumScaleFactor(0.7)
                if let m = result.product?.manufacturer { Text(m).font(.callout).foregroundStyle(.secondary) }
                if let n = result.name {
                    Text([n.substance, n.packSize.isEmpty ? nil : "\(n.packSize) Stück"].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.callout).foregroundStyle(.secondary)
                }
                Text("PZN \(result.code.pzn)").font(.footnote.monospaced()).foregroundStyle(.secondary)
                if result.product == nil && result.mine == nil {
                    Text([form?.label, "Aussehen unbekannt"].compactMap { $0 }.joined(separator: " · "))
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.warn)
                } else if let t = (result.product ?? result.mine)?.look.sourceText {
                    Text(t).font(.footnote).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
    }

    private func compare(_ mine: Med) -> some View {
        VStack(spacing: 10) {
            HStack(alignment: .top, spacing: 10) {
                side("Auf Ihrem Plan", mine.look, mine.manufacturer)
                Image(systemName: "arrow.right").font(.title2.bold()).foregroundStyle(.secondary).padding(.top, 60)
                side("Diese Packung", result.product?.look, result.product?.manufacturer ?? result.name?.name)
            }
            Text("Gleicher Wirkstoff und gleiche Stärke wie **\(mine.title)**. Ob diese Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke.")
                .font(.title3).multilineTextAlignment(.center)
        }
        .padding(12)
        .background(Theme.warn.opacity(0.12), in: RoundedRectangle(cornerRadius: Theme.corner))
    }

    private func side(_ title: String, _ look: Look?, _ maker: String?) -> some View {
        VStack(spacing: 6) {
            Text(title).font(.headline).foregroundStyle(.secondary)
            if let look { PillTile(look: look, box: 96) } else {
                Image(systemName: "questionmark.circle").font(.system(size: 44)).foregroundStyle(.secondary).frame(width: 96, height: 96)
            }
            Text(maker ?? "").font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity)
    }

    private func chip(_ icon: String, _ text: String, _ color: Color) -> some View {
        Label(text, systemImage: icon).font(.callout.weight(.semibold)).foregroundStyle(color)
            .padding(.horizontal, 12).padding(.vertical, 8).background(Theme.card, in: Capsule())
    }
}

// MARK: - Popup: camera or gallery

struct PhotoSourceSheet: View {
    let title: String
    let camera: () -> Void
    let gallery: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 14) {
            Text(title).font(.system(.title, design: .rounded, weight: .bold)).padding(.top, 24)
            HStack(spacing: 14) {
                Tile(icon: "camera.fill", title: "Kamera") { dismiss(); camera() }
                Tile(icon: "photo.on.rectangle.angled", title: "Beispiele") { dismiss(); gallery() }
            }
            Button("Abbrechen") { dismiss() }.font(.title3.weight(.semibold)).padding(.top, 4)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .presentationDetents([.height(300)])
        .presentationDragIndicator(.visible)
    }
}
