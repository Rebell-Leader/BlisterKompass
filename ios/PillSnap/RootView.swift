import SwiftUI
import PhotosUI

@main
struct PillSnapApp: App {
    @StateObject private var store = Store()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(Theme.accent)
        }
    }
}

/// What the user asked to scan. Each button opens its own camera and only that kind of input is accepted:
/// a plan or pack photo never falls through to pill recognition, and a pill photo with a code on it is not read as a pill.
enum ScanMode {
    case plan, pack, pill

    init(_ kind: ExampleKind) {
        switch kind {
        case .plan: self = .plan
        case .pack: self = .pack
        case .photo: self = .pill
        }
    }
}

/// One screen at a time, always a big "Zurück". No tab bars, no hidden gestures.
enum Route {
    case home
    case analyzing(UIImage, ScanMode)
    case bmpImport(ScannedPlan, UIImage)
    case result(Answer, UIImage?)
    case picker(UIImage?)
    case manualPlan
    case addToPlan(Med)
    case pack(PackResult, UIImage?)
    case detail(Med, UIImage?)
    case printPlan

    var key: String {
        switch self {
        case .home: "home"
        case .analyzing: "analyzing"
        case .bmpImport: "bmp"
        case .result(let a, _): "result-\(a.state)-\(a.candidates?.first?.pzn ?? "")"
        case .picker: "picker"
        case .manualPlan: "manualPlan"
        case .addToPlan(let m): "add-\(m.pzn)"
        case .pack(let r, _): "pack-\(r.code.pzn)"
        case .detail(let m, _): "detail-\(m.pzn)"
        case .printPlan: "print"
        }
    }
}

struct RootView: View {
    @EnvironmentObject var store: Store
    @State private var route: Route = .home

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            switch route {
            case .home: HomeView(go: go)
            case .analyzing(let img, let mode): AnalyzingView(photo: img, mode: mode, go: go)
            case .bmpImport(let plan, let img): BmpImportView(plan: plan, photo: img, go: go)
            case .result(let a, let img): ResultView(answer: a, photo: img, go: go)
            case .picker(let img): LookPickerView(photo: img, go: go)
            case .manualPlan: ManualPlanView(go: go)
            case .addToPlan(let med): ManualPlanView(go: go, adding: med)
            case .pack(let r, let img): PackResultView(scanned: r, photo: img, go: go)
            case .detail(let med, let img): MedCardScreen(med: med, photo: img, banner: .confirmed, go: go)
            case .printPlan: PrintPlanView(go: go)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: route.key)
        #if DEBUG
        .task { demoPrint() }
        #endif
    }

    #if DEBUG
    /// `-printDemo plan-a`: load a bundled example plan, open "Plan drucken" and save its PDF to Documents (for checks without taps).
    private func demoPrint() {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-printDemo"), i + 1 < args.count,
              let url = Bundle.main.url(forResource: args[i + 1], withExtension: "xml"),
              let xml = try? String(contentsOf: url, encoding: .utf8), let plan = store.readPlan(xml: xml) else { return }
        store.adopt(plan)
        let xmlOut = BmpWriter.xml(myMeds: store.myMeds, unknownPZNs: store.unknownPZNs)
        let rows = PlanPrinter.rows(store)
        let pdf = PlanPrinter.pdf(PlanSheet(main: rows.main, prn: rows.prn, code: xmlOut.flatMap(PlanPrinter.dataMatrix)))
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? pdf.write(to: docs.appendingPathComponent("Medikationsplan.pdf"))
        try? xmlOut?.write(to: docs.appendingPathComponent("Medikationsplan.xml"), atomically: true, encoding: .isoLatin1)
        route = .printPlan
    }
    #endif

    private func go(_ r: Route) {
        Speaker.shared.stop()
        route = r
    }
}

/// Fits the screen without scrolling; scrolls only if it really can't fit
/// (very large Dynamic Type, small phones).
struct FitOrScroll<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        ViewThatFits(in: .vertical) {
            content.frame(maxHeight: .infinity, alignment: .top)
            ScrollView { content }
        }
    }
}

// MARK: - Home (and first-run: scan your Medikationsplan)

struct HomeView: View {
    @EnvironmentObject var store: Store
    let go: (Route) -> Void
    @State private var showCamera = false
    /// The phone's own photo library (plan codes, pack codes, pill photos).
    @State private var showLibrary = false
    /// Example plan codes, pack codes or pill photos bundled with the app.
    @State private var examples: ExampleKind?
    @State private var libraryItem: PhotosPickerItem?
    @State private var showPlanSource = false
    @State private var showVoice = false
    @Environment(\.openURL) private var openURL
    @State private var showPillSource = false
    @State private var showPackSource = false
    /// Set by the button that opened the camera, photo library or examples.
    @State private var mode: ScanMode = .pill
    private let hasCamera = UIImagePickerController.isSourceTypeAvailable(.camera)

    var body: some View {
        FitOrScroll {
            VStack(spacing: 16) {
                header
                if store.hasPlan { scanPill } else { onboarding }
            }
            .padding(16)
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { img in
                showCamera = false
                if let img { go(.analyzing(img, mode)) }
            }
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showLibrary, selection: $libraryItem, matching: .images)
        .fullScreenCover(item: $examples) { kind in
            ExamplesView(kind: kind, onPick: { img in examples = nil; go(.analyzing(img, ScanMode(kind))) }, onCancel: { examples = nil })
        }
        .onChange(of: libraryItem) { _, item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) { go(.analyzing(img, mode)) }
                libraryItem = nil
            }
        }
        .sheet(isPresented: $showPillSource) {
            PhotoSourceSheet(title: "Tablette prüfen", camera: { mode = .pill; openAfterSheet { showCamera = true } },
                             gallery: { openAfterSheet { examples = .photo } })
        }
        .sheet(isPresented: $showPackSource) {
            PhotoSourceSheet(title: "Packung scannen", camera: { mode = .pack; openAfterSheet { showCamera = true } },
                             gallery: { openAfterSheet { examples = .pack } })
        }
        .sheet(isPresented: $showPlanSource) {
            PlanSourceSheet(camera: { mode = .plan; openAfterSheet { showCamera = true } },
                            gallery: { openAfterSheet { examples = .plan } },
                            typing: { go(.manualPlan) })
        }
    }

    /// Camera on a phone; the gallery on the simulator.
    private func capture() { if hasCamera { showCamera = true } else { showLibrary = true } }

    /// Present a full-screen cover once the popup has finished closing.
    private func openAfterSheet(_ open: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: open)
    }

    /// Home: the often-used actions on top (plan, pack, print), then my pills for now and later;
    /// the pill photo and the "not recorded" note at the bottom.
    private var scanPill: some View {
        VStack(spacing: 14) {
            HStack(spacing: 10) {
                BigButton(icon: "qrcode.viewfinder", title: "Plan neu\neinlesen", height: 120, compact: true) { showPlanSource = true }
                BigButton(icon: "barcode.viewfinder", title: "Packung", height: 120, compact: true) { showPackSource = true }
                BigButton(icon: "printer.fill", title: "Plan\ndrucken", height: 120, compact: true) { go(.printPlan) }
            }
            DayPlanList(go: go)
            Tile(icon: "tablette", title: "Tablette", wide: true) { showPillSource = true }
                .padding(.top, 6)
            Label(Day.notRecorded, systemImage: "info.circle").font(.footnote).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var onboarding: some View {
        VStack(spacing: 18) {
            Text("Willkommen!").font(.system(.largeTitle, design: .rounded, weight: .bold))
            Text("Lesen Sie zuerst Ihren **Medikationsplan** ein – per Kamera, aus den Beispielen oder selbst eingeben.")
                .font(.title3).multilineTextAlignment(.center)
            BigButton(icon: "qrcode.viewfinder", title: "Plan einlesen", height: 230, mascot: "scan-plan") { showPlanSource = true }
            PlanCodeHint()
        }
    }

    /// Bonus: the voice advisor is a separate web app (prototypes/voice_module in the hackathon repo); it opens in the browser.
    /// Same URL as VOICE_URL in pwa/js/app.js.
    static let voiceURL = URL(string: "https://blister-kompass-voice.vercel.app/voice")!

    /// No account, no name, no settings – a privacy note, and top right the voice advisor (bonus).
    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            Label(store.onlineLeaflets == true ? "Nur die PZN geht online · keine persönlichen Daten" : "Offline · keine Daten verlassen das Smartphone",
                  systemImage: "lock.shield.fill")
                .font(.footnote.weight(.semibold)).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button { showVoice = true } label: {
                VStack(spacing: 2) {
                    Image(systemName: "mic.fill").font(.system(size: 20, weight: .semibold))
                    Text("Sprachberater").font(.system(.caption, design: .rounded, weight: .bold))
                }
                .padding(.horizontal, 10).padding(.vertical, 5)
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.accent, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .foregroundStyle(Theme.accent)
            .accessibilityLabel("Sprachberater (Bonus)")
            .confirmationDialog("Sprachberater (Bonus)", isPresented: $showVoice, titleVisibility: .visible) {
                Button("Öffnen") { openURL(Self.voiceURL) }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                Text("Eine eigene Web-App: Sie beschreiben ein Medikament mit Worten, sie zeigt mögliche Treffer zum Prüfen – kein Nachweis, keine Beratung. Braucht Internet. Mit Mikrofon geht Ihre Stimme an einen Sprachdienst im Internet. BlisterKompass selbst bleibt offline.")
            }
        }
    }
}

struct Tip: View {
    let icon: String
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon).font(.title2).foregroundStyle(Theme.warn)
            Text(text).font(.body)
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
    }
}

/// Welcome screen: where the plan code is, as a small picture of an example plan (tools/make-plan-hint.py).
/// A tap opens it large with a close-up of the code (`PlanCodeHintPopup`). Same texts as `planCodeHint()` in pwa/js/app.js.
struct PlanCodeHint: View {
    @State private var open = false

    var body: some View {
        Button { open = true } label: {
            HStack(spacing: 14) {
                Image("plan-hint").resizable().interpolation(.high).scaledToFit()
                    .frame(width: 132)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.35)))
                VStack(alignment: .leading, spacing: 8) {
                    Text("Den **Code oben rechts** fotografieren").font(.body).foregroundStyle(.primary)
                    Label("Antippen zum Vergrößern", systemImage: "plus.magnifyingglass")
                        .font(.footnote.weight(.semibold)).foregroundStyle(Theme.accent)
                }
                .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
            }
            .padding(14)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
            .contentShape(RoundedRectangle(cornerRadius: Theme.corner))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Den Code oben rechts fotografieren. Beispiel ansehen")
        .accessibilityAddTraits(.isButton)
        .sheet(isPresented: $open) { PlanCodeHintPopup() }
    }
}

/// The example plan large, the code framed, then the code alone as it should fill the camera picture.
struct PlanCodeHintPopup: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Label("Schließen", systemImage: "xmark").font(.title3.weight(.semibold))
                    }
                }
                Text("So finden Sie den Code").font(.system(.title2, design: .rounded, weight: .bold))
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image("plan-hint").resizable().interpolation(.high).scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.35)))
                    .accessibilityLabel("Beispiel eines Medikationsplans, der Code oben rechts ist gelb umrandet")
                Text("Der Code steht **oben rechts** auf dem Medikationsplan.").font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image("plan-hint-code").resizable().interpolation(.none).scaledToFit()
                    .frame(width: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .accessibilityLabel("Der Code füllt das Bild")
                Text("So nah heran: Der Code **füllt das Bild**.").font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("Beispiel mit erfundenen Daten.").font(.footnote).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(20)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - Analyzing: only what the chosen mode asked for

struct AnalyzingView: View {
    @EnvironmentObject var store: Store
    let photo: UIImage
    let mode: ScanMode
    let go: (Route) -> Void
    @State private var seen: PillCues?
    @State private var scan = false

    var body: some View {
        VStack(spacing: 22) {
            BackBar(title: "Erkennen") { go(.home) }
            // Fill a fixed box: a wide photo must not make the whole screen wider.
            Color.clear.frame(maxWidth: .infinity).frame(height: 340)
                .overlay { Image(uiImage: photo).resizable().scaledToFill() }
                .clipShape(RoundedRectangle(cornerRadius: Theme.corner))
                .overlay(alignment: .top) {
                    Rectangle().fill(LinearGradient(colors: [Theme.accent.opacity(0), Theme.accent.opacity(0.6)], startPoint: .top, endPoint: .bottom))
                        .frame(height: 60)
                        .offset(y: scan ? 280 : 0)
                }
                .clipShape(RoundedRectangle(cornerRadius: Theme.corner))
            HStack(spacing: 14) {
                Mascot(state: "scanning", size: 76).padding(.vertical, -16)
                    .scaleEffect(scan ? 1.06 : 1)
                Text("Ich schaue mir das Foto an …").font(.title3.weight(.semibold))
            }
            if let seen, seen.found { SeenChips(cues: seen) }
            Spacer()
        }
        .padding(16)
        .onAppear { withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { scan = true } }
        .task { await run() }
    }

    private func run() async {
        let started = Date()
        func settle() async {
            let wait = 1.2 - Date().timeIntervalSince(started)
            if wait > 0 { try? await Task.sleep(nanoseconds: UInt64(wait * 1e9)) }
        }

        func noCode(_ problem: String) async { await settle(); go(.result(.local("no_code", problem: problem), photo)) }
        let code = await CodeReader.scan(photo)

        switch (mode, code) {
        case (.plan, .plan(let xml)?):
            // Plan code → read the medication lines (nothing else) on the phone.
            await settle()
            if let plan = store.readPlan(xml: xml) {
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                go(.bmpImport(plan, photo))
            } else {
                go(.result(.local("not_a_plan"), photo))
            }
            return
        case (.pack, .pack(let code)?):
            // A medicine pack: exact identity from its PZN, compared with the plan.
            await settle()
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            go(.pack(store.check(code), photo))
            return
        case (.plan, .pack?): await noCode("pack_not_plan"); return
        case (.plan, nil): await noCode("no_plan_code"); return
        case (.pack, .plan?): await noCode("plan_not_pack"); return
        case (.pack, nil): await noCode("no_pack_code"); return
        case (.pill, _?): await noCode("code_not_pill"); return
        case (.pill, nil): break
        }
        // Pill mode, no code in the photo: a pill, matched against the scanned plan, on the phone.
        guard store.hasPlan else { await settle(); go(.result(.local("need_plan"), photo)); return }
        let cues = await PillRecognizer.analyze(photo)
        seen = cues
        let answer: Answer = cues.found && !cues.colors.isEmpty ? store.identify(cues) : .local("retake", problem: "no_pill")
        await settle()
        UINotificationFeedbackGenerator().notificationOccurred(["sure", "likely"].contains(answer.state) ? .success : .warning)
        go(.result(answer, photo))
    }
}

/// "Ich sehe: ● rosa · rund · „5“" – shows what the on-device recognition found.
struct SeenChips: View {
    let cues: PillCues

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ich sehe:").font(.headline).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                ForEach(Array(zip(cues.colors, cues.seenHex)), id: \.0) { code, hex in
                    chip { Circle().fill(Color(hex: hex)).frame(width: 22, height: 22).overlay(Circle().stroke(Color.primary.opacity(0.2))); Text(PillRecognizer.name(of: code)) }
                }
                if let s = cues.shape { chip { Image(systemName: "circle.dashed"); Text(ShapeInfo.name(s)) } }
                if let i = cues.imprint { chip { Image(systemName: "textformat"); Text("„\(i)“") } }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chip<C: View>(@ViewBuilder _ c: () -> C) -> some View {
        HStack(spacing: 6, content: c)
            .font(.title3.weight(.semibold))
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background(Theme.card, in: Capsule())
    }
}

// MARK: - Plan scanned → take over my meds

struct BmpImportView: View {
    @EnvironmentObject var store: Store
    let plan: ScannedPlan
    let photo: UIImage
    let go: (Route) -> Void
    @State private var lookedUp = false
    /// The plan read again after leaflets were found online (their meds now have a picture).
    @State private var updated: ScannedPlan?
    @State private var asked = false
    private var shown: ScannedPlan { updated ?? plan }
    private var needsConsent: Bool { !plan.unknownPZNs.isEmpty && store.onlineLeaflets == nil && !asked }

    /// Each plan line: its look and where it comes from (leaflet, reference data, or only the dosage form).
    private var lookupItems: [LeafletLookupItem] {
        plan.meds.map { LeafletLookupItem(id: $0.pzn, title: $0.title, look: $0.look, form: nil) }
            + plan.unknownPZNs.map { p in
                LeafletLookupItem(id: p, title: store.nameOf(pzn: p), look: nil, form: store.pznNames[p].flatMap { DoseForm(code: $0.form) })
            }
    }

    var body: some View {
        if lookedUp { result } else { lookup }
    }

    /// Step 1: "Wie sehen die Tabletten aus?" – row by row, from the package leaflets on the phone.
    private var lookup: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    BackBar(title: "Medikationsplan") { go(.home) }
                    StatusBanner(icon: "checkmark.seal.fill", text: "Plan erkannt", color: Theme.okFill, mascot: "found")
                    Label("Aussehen wird nachgeschlagen", systemImage: "doc.text.magnifyingglass")
                        .font(.title3.weight(.bold))
                    if needsConsent {
                        OnlineLeafletConsent(count: plan.unknownPZNs.count) { ok in
                            store.onlineLeaflets = ok
                            withAnimation { asked = true }
                        }
                    } else {
                        LeafletLookupList(items: lookupItems,
                                          fetch: store.onlineLeaflets == true ? { await store.lookupRow($0) } : nil,
                                          step: { id in withAnimation { proxy.scrollTo(id, anchor: .bottom) } }) {
                            Task {
                                if let xml = plan.xml, let again = store.readPlan(xml: xml), again.meds.count > plan.meds.count { updated = again }
                                try? await Task.sleep(for: .seconds(0.8))
                                withAnimation { lookedUp = true }
                            }
                        }
                    }
                    Button("Überspringen") { withAnimation { lookedUp = true } }
                        .font(.callout.weight(.semibold)).frame(maxWidth: .infinity).padding(.top, 4)
                }
                .padding(16)
            }
        }
        .onAppear { Speaker.shared.say("Medikationsplan erkannt: \(plan.meds.count + plan.unknownPZNs.count) Medikamente. Ich schaue nach, wie sie aussehen.") }
    }

    private var result: some View {
        FitOrScroll {
            VStack(spacing: 14) {
                BackBar(title: "Medikationsplan") { go(.home) }
                StatusBanner(icon: "checkmark.seal.fill", text: "Plan erkannt", color: Theme.okFill, mascot: "found")
                Text(shown.meds.count == 1 ? "1 Medikament" : "\(shown.meds.count) Medikamente").font(.title3.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
                if !shown.unknown.isEmpty {
                    // Entries the bundled catalog has no look for stay unknown – listed, never guessed.
                    Label("\(shown.unknown.count) ohne Bilddaten: \(shown.unknown.joined(separator: ", "))", systemImage: "questionmark.square.dashed")
                        .font(.callout).foregroundStyle(Theme.warn).lineLimit(3).frame(maxWidth: .infinity, alignment: .leading)
                }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                    ForEach(shown.meds) { m in
                        VStack(spacing: 4) {
                            PillTile(look: m.look, box: 50)
                            Text(m.substance).font(.callout.weight(.bold)).lineLimit(1).minimumScaleFactor(0.6)
                        }
                        .padding(.vertical, 8).padding(.horizontal, 4)
                        .frame(maxWidth: .infinity)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityElement(children: .combine)
                    }
                }
                Spacer(minLength: 0)
                if store.hasPlan {
                    Label("Ersetzt Ihren bisherigen Plan.", systemImage: "arrow.triangle.2.circlepath")
                        .font(.callout.weight(.semibold)).foregroundStyle(.secondary)
                }
                BigButton(icon: "checkmark", title: "Übernehmen", height: 96, color: Theme.okFill) {
                    store.adopt(shown)
                    Speaker.shared.say("\(shown.meds.count) Medikamente übernommen. Sie können jetzt eine Tablette scannen.")
                    go(.home)
                }
            }
            .padding(16)
        }
    }
}

// MARK: - Building blocks

/// Illustrated icons (Assets: ui-*) for the main actions, keyed by the SF Symbol they replace. Paired with `PICTURES`
/// in pwa/js/icons.js. A button with a picture shows no word: its title stays the accessibility label.
enum ActionPicture {
    static let byIcon = ["qrcode.viewfinder": "ui-plan", "barcode.viewfinder": "ui-pack",
                         "printer.fill": "ui-print", "hand.tap.fill": "ui-lookup", "tablette": "ui-pill"]

    static func view(_ icon: String, size: CGFloat) -> some View {
        Image(byIcon[icon] ?? icon).resizable().interpolation(.high).scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.22, style: .continuous))
            .accessibilityHidden(true)
    }
}

struct BigButtonLabel: View {
    let icon: String
    let title: String
    var height: CGFloat = 120
    var color: Color = Theme.accentFill
    /// Big icon, no text (the title stays as the accessibility label).
    var iconOnly = false
    /// Mascot state shown instead of the icon.
    var mascot: String? = nil
    /// Three in a row: smaller title on up to two lines.
    var compact = false

    var body: some View {
        VStack(spacing: compact ? 8 : 10) {
            if mascot == nil, ActionPicture.byIcon[icon] != nil {
                ActionPicture.view(icon, size: height * 0.8)
            } else if compact {
                Image(systemName: icon).font(.system(size: 34, weight: .semibold))
                Text(title).font(.system(.title3, design: .rounded, weight: .bold))
                    .multilineTextAlignment(.center).lineLimit(2).minimumScaleFactor(0.7)
            } else if let mascot {
                Mascot(state: mascot, size: height * 0.68).padding(.top, -14).padding(.bottom, -8)
                Text(title).font(.system(.title, design: .rounded, weight: .bold)).minimumScaleFactor(0.7).lineLimit(1)
            } else if iconOnly {
                Image(systemName: icon).font(.system(size: min(72, height * 0.55), weight: .bold))
            } else {
                Image(systemName: icon).font(.system(size: min(64, height * 0.32), weight: .semibold))
                Text(title).font(.system(.title, design: .rounded, weight: .bold)).minimumScaleFactor(0.7).lineLimit(1)
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity).frame(height: height)
        .background(color, in: RoundedRectangle(cornerRadius: Theme.corner + 6))
        .contentShape(Rectangle())
    }
}

struct BigButton: View {
    let icon: String
    let title: String
    var height: CGFloat = 120
    var color: Color = Theme.accentFill
    var iconOnly = false
    var mascot: String? = nil
    var compact = false
    let action: () -> Void

    var body: some View {
        Button(action: action) { BigButtonLabel(icon: icon, title: title, height: height, color: color, iconOnly: iconOnly, mascot: mascot, compact: compact) }
            .buttonStyle(.plain)
            .accessibilityLabel(title.replacingOccurrences(of: "\n", with: " "))
    }
}

struct TileLabel: View {
    let icon: String
    let title: String
    var wide = false

    var body: some View {
        Group {
            if ActionPicture.byIcon[icon] != nil {
                ActionPicture.view(icon, size: 92).frame(height: wide ? 100 : 120)
                    .accessibilityElement().accessibilityLabel(title.replacingOccurrences(of: "\n", with: " "))
            } else if wide {
                HStack(spacing: 16) { Image(systemName: icon).font(.system(size: 32)); Text(title).font(.title2.weight(.bold)); Spacer() }
                    .padding(.horizontal, 22).frame(height: 80)
            } else {
                VStack(spacing: 10) { Image(systemName: icon).font(.system(size: 36)); Text(title).font(.title3.weight(.bold)).multilineTextAlignment(.center) }
                    .frame(height: 120)
            }
        }
        .foregroundStyle(Theme.accent)
        .frame(maxWidth: .infinity)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.corner))
        .overlay(RoundedRectangle(cornerRadius: Theme.corner).stroke(Theme.accent.opacity(0.25), lineWidth: 2))
        .contentShape(Rectangle())
    }
}

struct Tile: View {
    let icon: String
    let title: String
    var wide = false
    let action: () -> Void

    var body: some View {
        Button(action: action) { TileLabel(icon: icon, title: title, wide: wide) }.buttonStyle(.plain)
    }
}

struct BackBar: View {
    let title: String
    var speak: (() -> Void)? = nil
    let back: () -> Void

    var body: some View {
        HStack {
            Button(action: back) {
                Label("Zurück", systemImage: "chevron.left")
                    .font(.title3.weight(.semibold))
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(Theme.card, in: Capsule())
            }
            Spacer()
            if let speak {
                Button(action: speak) {
                    Image(systemName: "speaker.wave.3.fill").font(.title2.weight(.semibold))
                        .frame(width: 52, height: 52).background(Theme.card, in: Circle())
                }
                .accessibilityLabel("Vorlesen")
            } else {
                Text(title).font(.title3.weight(.bold)).foregroundStyle(.secondary)
            }
        }
    }
}
