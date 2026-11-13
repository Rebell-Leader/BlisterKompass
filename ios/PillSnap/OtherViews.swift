import SwiftUI

// MARK: - Without a photo: tap colour and shape

struct LookPickerView: View {
    @EnvironmentObject var store: Store
    let photo: UIImage?
    let go: (Route) -> Void
    @State private var color: String?
    @State private var shape: String?
    @State private var busy = false

    var body: some View {
        FitOrScroll {
            VStack(alignment: .leading, spacing: 14) {
                BackBar(title: "Aussehen") { go(.home) }
                if let photo {
                    Image(uiImage: photo).resizable().scaledToFill().frame(maxWidth: .infinity).frame(height: 90)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.corner))
                }

                step(1, "Welche Farbe?")
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                    ForEach(PillRecognizer.palette, id: \.code) { c in
                        Button { color = c.code } label: {
                            VStack(spacing: 4) {
                                Circle().fill(Color(hex: c.hex)).frame(width: 48, height: 48)
                                    .overlay(Circle().stroke(Color.primary.opacity(0.3), lineWidth: 1))
                                    .overlay(Circle().stroke(Theme.accent, lineWidth: color == c.code ? 5 : 0).padding(-6))
                                    .overlay { if color == c.code { Image(systemName: "checkmark").font(.title2.bold()).foregroundStyle(.black.opacity(0.6)) } }
                                Text(c.name).font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                            }
                            .frame(maxWidth: .infinity, minHeight: 76)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(color == c.code ? .isSelected : [])
                    }
                }

                step(2, "Welche Form?")
                HStack(spacing: 8) {
                    ForEach(ShapeInfo.all, id: \.code) { s in
                        Button { shape = s.code } label: {
                            VStack(spacing: 6) {
                                PillTile(look: sample(s.code), box: 46)
                                Text(s.name).font(.callout.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.7)
                            }
                            .frame(maxWidth: .infinity, minHeight: 92)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.accent, lineWidth: shape == s.code ? 4 : 0))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(shape == s.code ? .isSelected : [])
                    }
                }

                Spacer(minLength: 0)
                BigButton(icon: busy ? "hourglass" : "magnifyingglass", title: "Suchen", height: 92, color: color == nil && shape == nil ? Color(.systemGray3) : Theme.accentFill) {
                    Task { await search() }
                }
                .disabled(color == nil && shape == nil || busy)
            }
            .padding(16)
        }
    }

    private func step(_ n: Int, _ text: String) -> some View {
        HStack(spacing: 12) {
            Text("\(n)").font(.title2.bold()).foregroundStyle(.white).frame(width: 40, height: 40).background(Theme.accentFill, in: Circle())
            Text(text).font(.title.weight(.bold))
        }
    }

    private func sample(_ shapeCode: String) -> Look {
        let hex = PillRecognizer.palette.first { $0.code == color }?.hex ?? "#E9EDF1"
        let (l, w): (Double, Double) = switch shapeCode { case "round": (8, 8); case "oval": (10, 7); case "heart": (8, 8); default: (12, 5.5) }
        return Look(shape: shapeCode, color: color ?? "white", color2: nil, lengthMm: l, widthMm: w, score: "none", imprint: nil, finish: "matte",
                    colorHex: hex, color2Hex: shapeCode == "capsule" ? "#FBFBF8" : nil, colorName: LocalName(de: "", en: nil), color2Name: nil)
    }

    private func search() async {
        guard store.hasPlan else { go(.result(.local("need_plan"), photo)); return }
        busy = true
        defer { busy = false }
        var cues = PillCues()
        cues.found = true
        if let color { cues.colors = [color] }
        cues.shape = shape
        go(.result(store.identify(cues), photo))
    }
}

// MARK: - My meds (from the scanned plan), one screen, no scrolling

/// My meds over the day, shown on the home screen: what is due now, big, with the name beside it;
/// what comes later, smaller. Re-evaluated every minute.
struct DayPlanList: View {
    @EnvironmentObject var store: Store
    let go: (Route) -> Void

    var body: some View {
        TimelineView(.everyMinute) { tl in
            let sections = Day.sections(store.myMeds, at: tl.date)
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Meine Tabletten").font(.system(.title2, design: .rounded, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
                    Text(tl.date.formatted(.dateTime.hour(.twoDigits(amPM: .omitted)).minute(.twoDigits).locale(Locale(identifier: "de_DE"))) + " Uhr")
                        .font(.callout).foregroundStyle(.secondary)
                    Spacer()
                    Button { Speaker.shared.say(lines: Day.spokenLines(sections)) } label: {
                        Image(systemName: "speaker.wave.3.fill").font(.title2.weight(.semibold))
                            .frame(width: 52, height: 52).background(Theme.card, in: Circle())
                    }
                    .accessibilityLabel("Vorlesen")
                }
                ForEach(sections) { section($0) }
                if !store.unknownPZNs.isEmpty {
                    Text("Ohne Bild").font(.headline).foregroundStyle(.secondary).padding(.top, 4)
                    ForEach(store.unknownPZNs, id: \.self) { pzn in
                        let form = store.pznNames[pzn].flatMap { DoseForm(code: $0.form) }
                        HStack(spacing: 12) {
                            DoseFormTile(form: form, box: 56)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(store.nameOf(pzn: pzn)).font(.callout.weight(.semibold)).lineLimit(2)
                                Text([form?.label, "Aussehen unbekannt"].compactMap { $0 }.joined(separator: " · "))
                                    .font(.footnote).foregroundStyle(.secondary)
                            }
                            Spacer(minLength: 0)
                        }
                        .padding(8).background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    }
                }
            }
        }
    }

    private func header(_ s: Day.Section) -> (title: String, icon: String, fill: Color) {
        switch s.kind {
        case .slot(let id):
            let slot = Slot.all.first { $0.id == id }!
            let when = s.now ? "Jetzt" : s.tomorrow ? "Morgen" : "Später"
            return ("\(when) · \(slot.label)", slot.icon, slot.fill)
        case .weeklyToday: return ("Heute · 1× pro Woche", "calendar.badge.exclamationmark", Theme.badFill)
        case .weeklyLater: return ("Diese Woche · 1× pro Woche", "calendar", Theme.badFill)
        case .prn: return ("Nur bei Bedarf", "hand.raised.fill", Theme.accentFill)
        }
    }

    @ViewBuilder private func section(_ s: Day.Section) -> some View {
        let h = header(s)
        VStack(alignment: .leading, spacing: s.now ? 10 : 6) {
            Label(h.title, systemImage: h.icon)
                .font(s.now ? .title2.weight(.bold) : .headline)
                .foregroundStyle(.white)
                .padding(.horizontal, 14).padding(.vertical, s.now ? 10 : 6)
                .background(h.fill, in: Capsule())
            ForEach(s.entries) { e in
                Button { go(.detail(e.med, nil)) } label: { row(e, big: s.now) }.buttonStyle(.plain)
            }
        }
        .padding(.top, s.now ? 0 : 6)
    }

    /// The pill as it looks (big when due now), name and strength beside it, how many.
    private func row(_ e: Day.Entry, big: Bool) -> some View {
        HStack(spacing: big ? 16 : 12) {
            PillTile(look: e.med.look, box: big ? 104 : 56)
                .frame(width: big ? 112 : 60, height: big ? 112 : 60)
                .background(Theme.bg, in: RoundedRectangle(cornerRadius: 16))
            VStack(alignment: .leading, spacing: 2) {
                Text(e.med.substance).font(big ? .title.weight(.bold) : .title3.weight(.bold)).lineLimit(1).minimumScaleFactor(0.6)
                if let st = e.med.strength { Text(st).font(big ? .title3 : .callout).foregroundStyle(.secondary) }
                if let a = e.amount { Text(Self.count(a, e.med.look)).font(big ? .title3.weight(.semibold) : .callout.weight(.semibold)) }
                if let meal = e.med.schedule?.meal {
                    // Read from the plan's Hinweise ("nüchtern", "nach dem Essen" …).
                    Label(meal.label, systemImage: meal.symbol)
                        .font(big ? .title3.weight(.semibold) : .callout.weight(.semibold)).foregroundStyle(Theme.accent)
                }
                if e.med.schedule?.kind == "weekly", let d = e.med.schedule?.days.first {
                    Text("nur am \(Med.dayName(d))").font(big ? .title3.weight(.semibold) : .callout.weight(.semibold)).foregroundStyle(Theme.bad)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(big ? 12 : 8)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: big ? Theme.corner : 16))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    /// "1 Tablette", "½ Tablette", "2 Kapseln" – from the plan amount and the drawn form.
    static func count(_ a: Double, _ look: Look) -> String {
        let n = a == 0.5 ? "½" : a == 0.25 ? "¼" : a == 1.5 ? "1½" : String(format: "%g", a)
        let capsule = ["capsule", "softgel"].contains(look.shape)
        let unit = capsule ? (a > 1 ? "Kapseln" : "Kapsel") : (a > 1 ? "Tabletten" : "Tablette")
        return "\(n) \(unit)"
    }
}

// MARK: - Camera

struct CameraPicker: UIViewControllerRepresentable {
    let done: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = context.coordinator
        return p
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(done: done) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let done: (UIImage?) -> Void
        init(done: @escaping (UIImage?) -> Void) { self.done = done }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            done(info[.originalImage] as? UIImage)
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { done(nil) }
    }
}
