import SwiftUI
import ZXingCpp

// MARK: - "Plan drucken": the plan on the phone as a Medikationsplan (BMP layout) with a picture of each pill

/// A4 landscape in PDF points. 72 pt per inch → a pill drawn with `ptPerMm` comes out at true size on paper.
enum PlanSheetPage {
    static let size = CGSize(width: 842, height: 595)
    static let ptPerMm: CGFloat = 72 / 25.4
}

/// One printed row, built from the plan on the phone.
struct PlanSheetRow: Identifiable {
    let id: String
    let substance: String
    let brand: String
    let strength: String
    let form: String
    let look: Look?
    let doseForm: DoseForm?
    let doses: [String]?      // morgens, mittags, abends, zur Nacht
    let free: String?         // weekly / as needed / unknown dosing
    let unit: String
    let note: String
    let reason: String
    /// Read from the Hinweise text; nil when it says nothing clear about meals.
    var meal: MealTiming? = nil
}

@MainActor
enum PlanPrinter {
    static func rows(_ store: Store) -> (main: [PlanSheetRow], prn: [PlanSheetRow]) {
        func row(_ m: Med) -> PlanSheetRow {
            let s = m.schedule
            var doses: [String]?, free: String?
            switch s?.kind {
            case "weekly": free = s?.text ?? "1× wöchentlich" + (s?.days.first.map { ", \(Med.dayName($0))" } ?? "")
            case "prn": free = s?.text ?? "bei Bedarf"
            case "daily": doses = Day.order.map { BmpWriter.printed(s?.amounts[$0] ?? 0) }
            default: free = "siehe ärztlichen Plan"
            }
            return PlanSheetRow(id: m.pzn, substance: m.substance, brand: m.name, strength: m.strength ?? "",
                                form: BmpForm.of(name: m.name, ifaCode: store.pznNames[m.pzn]?.form), look: m.look, doseForm: nil,
                                doses: doses, free: free, unit: "Stück", note: s?.note ?? "", reason: m.indication?.de ?? "", meal: s?.meal)
        }
        let unknown = store.unknownPZNs.map { pzn in
            let official = store.pznNames[pzn]
            return PlanSheetRow(id: pzn, substance: official?.substance ?? "", brand: store.nameOf(pzn: pzn), strength: official?.strength ?? "",
                                form: BmpForm.of(name: nil, ifaCode: official?.form), look: nil, doseForm: official.flatMap { DoseForm(code: $0.form) },
                                doses: nil, free: "siehe ärztlichen Plan", unit: "", note: "", reason: "")
        }
        let meds = store.myMeds
        return (meds.filter { $0.schedule?.kind != "prn" }.map(row) + unknown, meds.filter { $0.schedule?.kind == "prn" }.map(row))
    }

    /// The plan's 2D code: Data Matrix, the XML's ISO-8859-1 bytes, one pixel per module.
    static func dataMatrix(_ xml: String) -> CGImage? {
        let options = ZXIWriterOptions(format: .DATA_MATRIX)
        options.margin = 0
        // The wrapper returns the image from CGImageCreate (+1) without a "create" name, so take ownership here.
        return (try? ZXIBarcodeWriter(options: options).write(BmpWriter.payload(xml)))?.takeRetainedValue()
    }

    /// Vector PDF of the sheet (pills stay sharp and true to size).
    static func pdf(_ sheet: PlanSheet) -> Data {
        let renderer = ImageRenderer(content: sheet.environment(\.colorScheme, .light))
        renderer.proposedSize = ProposedViewSize(PlanSheetPage.size)
        let data = NSMutableData()
        renderer.render { _, draw in
            var box = CGRect(origin: .zero, size: PlanSheetPage.size)
            guard let consumer = CGDataConsumer(data: data as CFMutableData), let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { return }
            ctx.beginPDFPage(nil)
            draw(ctx)
            ctx.endPDFPage()
            ctx.closePDF()
        }
        return data as Data
    }
}

/// The printed sheet, laid out in PDF points (A4 landscape). Always light: it is paper.
/// The Medikationsplan (header, 2D code, table) with one extra column after "Form": the pill at true size.
struct PlanSheet: View {
    let main: [PlanSheetRow]
    let prn: [PlanSheetRow]
    let code: CGImage?
    var printedOn = Date()

    private let ink = Color.black
    private let accent = Color(hex: "#0B6E8A")
    // Column widths (pt); the rest goes to "Hinweise".
    private let w = (sub: 96.0, brand: 130.0, str: 40.0, form: 46.0, pic: 76.0, dose: 30.0, unit: 32.0, reason: 70.0)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            VStack(spacing: 0) {
                headRow
                ForEach(main) { row($0) }
                if !prn.isEmpty {
                    Text("Bedarfsmedikation").font(.system(size: 8, weight: .bold)).padding(.horizontal, 6).padding(.vertical, 2.5)
                        .frame(maxWidth: .infinity, alignment: .leading).background(Color(white: 0.95)).overlay(Rectangle().stroke(ink, lineWidth: 0.7))
                    ForEach(prn) { row($0) }
                }
            }
            Text("Aussehen: Tablette in Originalgröße (Maße laut Quelle), aus der PZN der Zeile – der 2D-Code enthält nur die Medikamente. Sieht eine Tablette anders aus? Apotheke fragen. · Ausdruck aus BlisterKompass · ersetzt nicht den ärztlichen Medikationsplan")
                .font(.system(size: 6)).foregroundStyle(Color(white: 0.3))
            Spacer(minLength: 0)
        }
        .foregroundStyle(ink)
        .padding(EdgeInsets(top: 18, leading: 26, bottom: 14, trailing: 26))
        .frame(width: PlanSheetPage.size.width, height: PlanSheetPage.size.height, alignment: .topLeading)
        .background(Color.white)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Medikationsplan").font(.system(size: 17, weight: .bold))
                Text("Seite 1 von 1").font(.system(size: 7.5)).foregroundStyle(.gray)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text("für:").font(.system(size: 7.5)).foregroundStyle(.gray)
                // No name or birth date in the app: written in by hand.
                Rectangle().fill(ink.opacity(0.45)).frame(width: 170, height: 0.6).padding(.top, 9)
                Text("geb. am:").font(.system(size: 7.5)).foregroundStyle(.gray).padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text("ausgedruckt von:").font(.system(size: 7.5)).foregroundStyle(.gray)
                Text(BmpWriter.issuer).font(.system(size: 10, weight: .bold))
                Text("ausgedruckt am: ").font(.system(size: 7.5)).foregroundStyle(.gray)
                    + Text(printedOn.formatted(.dateTime.day(.twoDigits).month(.twoDigits).year().locale(Locale(identifier: "de_DE")))).font(.system(size: 7.5, weight: .bold))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Group {
                // 28 mm: reads from a 300 dpi print and a phone photo.
                if let code { Image(decorative: code, scale: 1).interpolation(.none).resizable() }
                else { Text("Zu viele Einträge für einen Code").font(.system(size: 6.5)).multilineTextAlignment(.center).foregroundStyle(.gray) }
            }
            .frame(width: 28 * PlanSheetPage.ptPerMm, height: 28 * PlanSheetPage.ptPerMm)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .overlay(Rectangle().stroke(ink, lineWidth: 1.1))
    }

    private var headRow: some View {
        HStack(spacing: 0) {
            Text("Wirkstoff").cell(w.sub, bg: .headBg)
            Text("Handelsname").cell(w.brand, bg: .headBg)
            Text("Stärke").cell(w.str, bg: .headBg)
            Text("Form").cell(w.form, bg: .headBg)
            Text("Aussehen").frame(maxWidth: .infinity).cell(w.pic, bg: .headBg, center: true)
            // Icons instead of "morgens … zur Nacht", in the app's time-of-day colours.
            ForEach(Slot.all) { slot in
                Image(systemName: slot.icon).font(.system(size: 12, weight: .semibold)).foregroundStyle(slot.fill)
                    .accessibilityLabel(slot.label).cell(w.dose, bg: .white, center: true)
            }
            Text("Einheit").cell(w.unit, bg: .headBg, lines: 1)
            Text("Hinweise").cell(nil, bg: .headBg)
            Text("Grund").cell(w.reason, bg: .headBg)
        }
        .font(.system(size: 6.5, weight: .bold))
        .fixedSize(horizontal: false, vertical: true)
    }

    private func row(_ r: PlanSheetRow) -> some View {
        HStack(spacing: 0) {
            Text(r.substance).font(.system(size: 7.5, weight: .bold)).minimumScaleFactor(0.75).cell(w.sub, lines: r.substance.contains("-") || r.substance.contains(" ") ? 2 : 1)
            Text(r.brand).font(.system(size: 6.5)).cell(w.brand, lines: 2)
            Text(r.strength).cell(w.str, lines: 1)
            Text(r.form).cell(w.form, lines: 1)
            VStack(spacing: 2) {
                if let look = r.look { PillView(look: look, pointsPerMm: PlanSheetPage.ptPerMm, flat: true) }
                else { DoseFormTile(form: r.doseForm, box: 24) }
                if let meal = r.meal { mealTag(meal) }
            }
            .padding(.vertical, 2)
            .cell(w.pic, center: true)
            if let doses = r.doses {
                ForEach(Array(doses.enumerated()), id: \.offset) { Text($0.element).font(.system(size: 9.5, weight: .bold)).cell(w.dose, center: true) }
            } else {
                Text(r.free ?? "").font(.system(size: 7.5, weight: .semibold)).cell(w.dose * 4, center: true)
            }
            Text(r.unit).cell(w.unit, lines: 1)
            Text(r.note).font(.system(size: 6.5)).cell(nil, lines: 2)
            Text(r.reason).font(.system(size: 6.5)).cell(w.reason, lines: 1)
        }
        .font(.system(size: 7.5))
        .fixedSize(horizontal: false, vertical: true)
    }
}

extension PlanSheet {
    /// "🍴 vor dem Essen" under the pill, read from the Hinweise text.
    func mealTag(_ m: MealTiming) -> some View {
        HStack(spacing: 2) {
            Image(systemName: m.symbol).font(.system(size: 5.5, weight: .bold))
            Text(m.label).font(.system(size: 5.8, weight: .bold)).lineLimit(1).fixedSize()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 3.5).padding(.vertical, 1.5)
        .background(Color(hex: "#0B6E8A"), in: Capsule())
    }
}

private extension Color { static let headBg = Color(white: 0.91) }

private extension View {
    /// A table cell with a hairline border; nil width = takes the rest.
    /// `lines: 1` shrinks a long single word ("Retardtabl") instead of breaking it mid-word.
    @ViewBuilder func cell(_ width: Double?, bg: Color = .white, center: Bool = false, lines: Int = 3) -> some View {
        let c = self.lineLimit(lines).minimumScaleFactor(lines == 1 ? 0.6 : 1).padding(.horizontal, 4).padding(.vertical, 2.5)
            .frame(maxWidth: width == nil ? .infinity : nil, maxHeight: .infinity, alignment: center ? .center : .leading)
        Group { if let width { c.frame(width: width, alignment: center ? .center : .leading) } else { c } }
            .frame(maxHeight: .infinity)
            .background(bg)
            .overlay(Rectangle().stroke(Color.black, lineWidth: 0.7))
    }
}

// MARK: - Screen: who it is for, preview, print, share

struct PrintPlanView: View {
    @EnvironmentObject var store: Store
    let go: (Route) -> Void
    @State private var code: CGImage?
    @State private var pdfURL: URL?
    @State private var tooLong = false
    @State private var fullScreen = false


    var body: some View {
        let rows = PlanPrinter.rows(store)
        ScrollView {
            VStack(spacing: 14) {
                BackBar(title: "Plan drucken") { go(.home) }
                Text("Ihr **Medikationsplan** – mit einem Bild jeder Tablette.")
                    .font(.title3).frame(maxWidth: .infinity, alignment: .leading)
                GeometryReader { geo in
                    let scale = geo.size.width / PlanSheetPage.size.width
                    PlanSheet(main: rows.main, prn: rows.prn, code: code)
                        .environment(\.colorScheme, .light)
                        .scaleEffect(scale, anchor: .topLeading)
                        .frame(width: geo.size.width, height: PlanSheetPage.size.height * scale, alignment: .topLeading)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .shadow(color: .black.opacity(0.2), radius: 6, y: 2)
                }
                .aspectRatio(PlanSheetPage.size.width / PlanSheetPage.size.height, contentMode: .fit)
                .overlay(alignment: .bottomTrailing) {
                    Image(systemName: "arrow.up.left.and.arrow.down.right").font(.headline.weight(.bold)).foregroundStyle(.white)
                        .frame(width: 40, height: 40).background(Theme.accentFill, in: Circle()).padding(8)
                }
                .contentShape(Rectangle())
                .onTapGesture { fullScreen = true }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Vorschau des Medikationsplans, \(rows.main.count + rows.prn.count) Medikamente")
                .accessibilityHint("Groß anzeigen")
                .accessibilityAddTraits(.isButton)

                Label("Ohne Namen und Geburtsdatum – bitte von Hand eintragen. Der Code enthält nur die Medikamente.", systemImage: "lock.shield.fill")
                    .font(.footnote.weight(.semibold)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)

                if tooLong {
                    Label("Zu viele Einträge für einen Code.", systemImage: "exclamationmark.triangle.fill")
                        .font(.callout).foregroundStyle(Theme.warn)
                }
                HStack(spacing: 14) {
                    BigButton(icon: "printer.fill", title: "Drucken", height: 96, color: pdfURL == nil ? .gray : Theme.accentFill) { printSheet() }
                        .disabled(pdfURL == nil)
                    if let pdfURL {
                        ShareLink(item: pdfURL) { BigButtonLabel(icon: "square.and.arrow.up", title: "Teilen", height: 96, color: Theme.okFill) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .task { build() }
        #if DEBUG
        .onAppear { if ProcessInfo.processInfo.arguments.contains("-printFullScreen") { fullScreen = true } }
        #endif
        .fullScreenCover(isPresented: $fullScreen) {
            SheetFullScreen(sheet: PlanSheet(main: rows.main, prn: rows.prn, code: code)) { fullScreen = false }
                .presentationBackground(.black.opacity(0.88))
        }
    }

    /// The code and PDF for the plan as it is on the phone.
    private func build() {
        let xml = BmpWriter.xml(myMeds: store.myMeds, unknownPZNs: store.unknownPZNs)
        tooLong = xml == nil
        code = xml.flatMap(PlanPrinter.dataMatrix)
        let rows = PlanPrinter.rows(store)
        let data = PlanPrinter.pdf(PlanSheet(main: rows.main, prn: rows.prn, code: code))
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Medikationsplan.pdf")
        try? data.write(to: url, options: [.atomic, .completeFileProtection])
        pdfURL = url
    }

    private func printSheet() {
        guard let pdfURL else { return }
        let info = UIPrintInfo.printInfo()
        info.jobName = "Medikationsplan"
        info.outputType = .general
        info.orientation = .landscape
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printingItem = pdfURL
        controller.present(animated: true)
    }
}

/// The sheet as big as the phone allows: turned sideways (A4 landscape fills the portrait screen), pinch to zoom in further,
/// drag when zoomed. A tap beside the sheet, or the close button, goes back.
struct SheetFullScreen: View {
    let sheet: PlanSheet
    let close: () -> Void
    @State private var zoom: CGFloat = 1
    @State private var pinch: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var drag: CGSize = .zero

    var body: some View {
        GeometryReader { geo in
            let page = PlanSheetPage.size
            // Rotated 90°: the page's width runs along the screen's height.
            let fit = min((geo.size.height - 24) / page.width, (geo.size.width - 24) / page.height)
            ZStack {
                // Beside the sheet: closes.
                Color.clear.contentShape(Rectangle()).onTapGesture(perform: close)
                sheet
                    .environment(\.colorScheme, .light)
                    .clipShape(RoundedRectangle(cornerRadius: 4))
                    .frame(width: page.width, height: page.height)
                    .scaleEffect(fit * zoom * pinch)
                    .rotationEffect(.degrees(90))
                    .frame(width: page.height * fit * zoom * pinch, height: page.width * fit * zoom * pinch)
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) { withAnimation(.snappy) { zoom = zoom > 1 ? 1 : 2; offset = .zero } }
                    .onTapGesture { }   // a tap on the sheet itself keeps it open
                    .offset(x: offset.width + drag.width, y: offset.height + drag.height)
                    .gesture(
                        MagnifyGesture()
                            .onChanged { pinch = $0.magnification }
                            .onEnded { _ in zoom = min(4, max(1, zoom * pinch)); pinch = 1; if zoom == 1 { withAnimation(.snappy) { offset = .zero } } }
                            .simultaneously(with: DragGesture(minimumDistance: 8)
                                .onChanged { if zoom > 1 { drag = $0.translation } }
                                .onEnded { _ in offset.width += drag.width; offset.height += drag.height; drag = .zero })
                    )
                    .accessibilityLabel("Medikationsplan, groß")
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .overlay(alignment: .topTrailing) {
            Button(action: close) {
                Image(systemName: "xmark").font(.title2.weight(.bold)).foregroundStyle(.white)
                    .frame(width: 52, height: 52).background(.white.opacity(0.2), in: Circle())
            }
            .padding(16)
            .accessibilityLabel("Schließen")
        }
        .ignoresSafeArea(edges: .bottom)
    }
}
