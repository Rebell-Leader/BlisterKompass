import SwiftUI

/// Draws a pill from its appearance record (port of public/pill.js).
struct PillView: View {
    let look: Look
    var pointsPerMm: CGFloat = 7
    /// No sheen and no shadow: for the printed plan (PDF has no soft alpha gradients, they print as black).
    var flat = false

    private var L: CGFloat { CGFloat(look.drawSize.0) * pointsPerMm }
    private var W: CGFloat { CGFloat(look.drawSize.1) * pointsPerMm }
    private var base: Color { Color(hex: look.colorHex) }

    var body: some View {
        ZStack {
            fill
            if !flat {
                outline.fill(RadialGradient(colors: [.white.opacity(look.finish == "glossy" ? 0.7 : 0.4), .white.opacity(0), .black.opacity(0.12)],
                                            center: UnitPoint(x: 0.32, y: 0.28), startRadius: 0, endRadius: max(L, W) * 0.8))
            }
            outline.stroke(Color.black.opacity(0.22), lineWidth: max(1, pointsPerMm * 0.2))
            if look.hasScore { scoreLine }
            if let imprint = look.imprint, !imprint.isEmpty { imprintText(imprint) }
        }
        .frame(width: L, height: W)
        .shadow(color: .black.opacity(flat ? 0 : 0.18), radius: flat ? 0 : pointsPerMm * 0.6, y: flat ? 0 : pointsPerMm * 0.4)
        .accessibilityLabel("\(look.colorText), \(ShapeInfo.name(look.shape))")
    }

    private var horizontalScore: Bool { look.shape == "round" || look.shape == "heart" }

    private func imprintText(_ imprint: String) -> some View {
        let chars = CGFloat(max(2, imprint.count))
        let size: CGFloat = min(W * 0.34, L * 0.96 / chars)
        var dx: CGFloat = 0
        if look.shape == "capsule" { dx = -L * 0.23 } else if look.hasScore && !horizontalScore { dx = -L * 0.22 }
        let dy: CGFloat = look.hasScore && horizontalScore ? -W * 0.18 : 0
        return Text(imprint)
            .font(.system(size: size, weight: .bold))
            .foregroundStyle(Color.black.opacity(0.35))
            .offset(x: dx, y: dy)
    }

    private var outline: AnyShape {
        switch look.shape {
        case "round": AnyShape(Circle())
        case "oval", "softgel": AnyShape(Ellipse())
        case "heart": AnyShape(HeartShape())
        case "oblong", "capsule": AnyShape(Capsule())
        default: AnyShape(RoundedRectangle(cornerRadius: W * 0.3))
        }
    }

    @ViewBuilder private var fill: some View {
        if look.shape == "capsule" {
            HStack(spacing: 0) {
                Rectangle().fill(base).frame(width: L * 0.52)
                Rectangle().fill(Color(hex: look.color2Hex ?? look.colorHex))
            }
            .clipShape(Capsule())
        } else {
            outline.fill(base)
        }
    }

    private var scoreLine: some View {
        Path { p in
            if horizontalScore {
                p.move(to: CGPoint(x: L * 0.14, y: W * 0.55)); p.addLine(to: CGPoint(x: L * 0.86, y: W * 0.55))
            } else {
                p.move(to: CGPoint(x: L / 2, y: W * 0.12)); p.addLine(to: CGPoint(x: L / 2, y: W * 0.88))
            }
        }
        .stroke(Color.black.opacity(0.3), style: StrokeStyle(lineWidth: max(1.2, pointsPerMm * 0.3), lineCap: .round))
    }
}

struct HeartShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height
        p.move(to: CGPoint(x: 0.5 * w, y: 0.97 * h))
        p.addCurve(to: CGPoint(x: 0, y: 0.31 * h), control1: CGPoint(x: 0.18 * w, y: 0.74 * h), control2: CGPoint(x: 0, y: 0.54 * h))
        p.addCurve(to: CGPoint(x: 0.5 * w, y: 0.14 * h), control1: CGPoint(x: 0, y: 0.05 * h), control2: CGPoint(x: 0.4 * w, y: -0.05 * h))
        p.addCurve(to: CGPoint(x: w, y: 0.31 * h), control1: CGPoint(x: 0.6 * w, y: -0.05 * h), control2: CGPoint(x: w, y: 0.05 * h))
        p.addCurve(to: CGPoint(x: 0.5 * w, y: 0.97 * h), control1: CGPoint(x: w, y: 0.54 * h), control2: CGPoint(x: 0.82 * w, y: 0.74 * h))
        p.closeSubpath()
        return p
    }
}

extension Look {
    /// Drawing size in mm. Leaflets often state no size: then a shape's typical proportions are drawn (a capsule stays
    /// long), only for the picture; lengthMm/widthMm stay unknown (INV-05).
    var drawSize: (Double, Double) {
        let typical: [String: (Double, Double)] = ["capsule": (18, 7), "oblong": (15, 7), "oval": (11, 7.5), "softgel": (12, 8)]
        if lengthMm == nil, widthMm == nil, let t = typical[shape] { return t }
        return (lengthMm ?? 8, widthMm ?? 8)
    }
}

/// Fixed-size box so pills of different sizes line up in grids. Tapping it opens the pill large (`PillPopup`);
/// pass `zoomable: false` where the tile sits inside a button, so the button keeps the tap.
struct PillTile: View {
    let look: Look
    var box: CGFloat = 90
    var zoomable = true
    @State private var zoomed = false

    var body: some View {
        let longest = CGFloat(max(look.drawSize.0, look.drawSize.1))
        let tile = PillView(look: look, pointsPerMm: min(9, box * 0.85 / longest))
            .frame(width: box, height: box)
        if zoomable {
            tile.contentShape(Rectangle())
                .onTapGesture { zoomed = true }
                .accessibilityAddTraits(.isButton)
                .accessibilityHint("Groß anzeigen")
                .sheet(isPresented: $zoomed) { PillPopup(look: look) }
        } else {
            tile
        }
    }
}

/// The pill large, with what is known about its look and where that comes from. Unknown fields say so.
struct PillPopup: View {
    let look: Look
    @Environment(\.dismiss) private var dismiss

    private var size: String {
        guard let l = look.lengthMm else { return "nicht angegeben" }
        let f = { (v: Double) in v.formatted(.number.precision(.fractionLength(0...1)).locale(Locale(identifier: "de_DE"))) }
        if let w = look.widthMm, w != l { return "\(f(l)) × \(f(w)) mm" }
        return look.shape == "round" ? "\(f(l)) mm Durchmesser" : "\(f(l)) mm"
    }
    private var score: String {
        switch look.score { case "cross": "Kreuzbruchkerbe"; case "single": "Bruchkerbe"; default: "keine angegeben" }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack {
                    Spacer()
                    Button { dismiss() } label: {
                        Label("Schließen", systemImage: "xmark").font(.title3.weight(.semibold))
                    }
                }
                PillTile(look: look, box: 260, zoomable: false)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 28))
                VStack(spacing: 10) {
                    InfoRow(icon: "paintpalette.fill", tint: Theme.accent, title: "Farbe", value: look.colorText)
                    InfoRow(icon: "pills.fill", tint: Theme.accent, title: "Form", value: ShapeInfo.name(look.shape))
                    InfoRow(icon: "ruler", tint: Theme.accent, title: "Größe", value: size)
                    InfoRow(icon: "minus.circle", tint: Theme.accent, title: "Bruchkerbe", value: score)
                    InfoRow(icon: "character.textbox", tint: Theme.accent, title: "Prägung", value: look.imprint.flatMap { $0.isEmpty ? nil : "„\($0)“" } ?? "keine angegeben")
                }
                if let t = look.sourceText {
                    Label(t, systemImage: "checkmark.seal").font(.callout.weight(.semibold)).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if let quote = look.leaflet {
                    Label("„\(quote)“", systemImage: "doc.text").font(.callout).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                if look.lengthMm == nil {
                    Text("Größe in der Zeichnung geschätzt – die Packungsbeilage nennt keine.").font(.footnote).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .padding(20)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .onAppear { Speaker.shared.say("\(look.colorText), \(ShapeInfo.name(look.shape)).") }
    }
}
