import SwiftUI

/// Draws a pill from its appearance record (port of public/pill.js).
struct PillView: View {
    let look: Look
    var pointsPerMm: CGFloat = 7
    /// No sheen and no shadow: for the printed plan (PDF has no soft alpha gradients, they print as black).
    var flat = false

    private var L: CGFloat { CGFloat(look.lengthMm ?? 8) * pointsPerMm }
    private var W: CGFloat { CGFloat(look.widthMm ?? 8) * pointsPerMm }
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

/// Fixed-size box so pills of different sizes line up in grids.
struct PillTile: View {
    let look: Look
    var box: CGFloat = 90

    var body: some View {
        let longest = CGFloat(max(look.lengthMm ?? 8, look.widthMm ?? 8))
        PillView(look: look, pointsPerMm: min(9, box * 0.85 / longest))
            .frame(width: box, height: box)
    }
}
