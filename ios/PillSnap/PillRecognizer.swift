#if canImport(UIKit)
import UIKit
#endif
import CoreImage
import Vision

/// On-device image recognition. No network, no ML model download:
///  1. find the pill: background colour from the photo border, pill = largest
///     region that differs from it (shadows are ignored),
///  2. colour: trimmed mean in CIELAB → nearest catalogue colour,
///     two clearly different halves → two-coloured capsule,
///  3. shape: principal axes of the region → round / oval / oblong,
///  4. imprint: Apple Vision text recognition on the cropped pill.
enum PillRecognizer {
    struct PaletteColor { let code: String; let name: String; let hex: String }

    /// Same codes and hex values as data/catalog.js → COLORS.
    static let palette: [PaletteColor] = [
        .init(code: "white", name: "weiß", hex: "#FBFBF8"),
        .init(code: "offwhite", name: "cremeweiß", hex: "#F1EBDD"),
        .init(code: "lightyellow", name: "hellgelb", hex: "#F6EAA8"),
        .init(code: "yellow", name: "gelb", hex: "#F2CC3D"),
        .init(code: "orange", name: "orange", hex: "#F0954A"),
        .init(code: "pink", name: "rosa", hex: "#F2B8C3"),
        .init(code: "red", name: "rot", hex: "#C9483F"),
        .init(code: "blue", name: "blau", hex: "#7EA6D8"),
        .init(code: "green", name: "grün", hex: "#86C49A"),
        .init(code: "brown", name: "braun", hex: "#9E7152"),
        .init(code: "beige", name: "beige", hex: "#E6D5B4"),
    ]
    private static let paletteLab = palette.map { Lab(hex: $0.hex) }

    #if canImport(UIKit)
    static func analyze(_ image: UIImage) async -> PillCues {
        await Task.detached(priority: .userInitiated) { () -> PillCues in
            guard let small = image.normalizedCGImage(maxSide: 320) else { return PillCues() }
            var (cues, box) = analyzePixels(small)
            if cues.found, let large = image.normalizedCGImage(maxSide: 1600) {
                let f = CGFloat(large.width) / CGFloat(small.width)
                let crop = CGRect(x: box.minX * f, y: box.minY * f, width: box.width * f, height: box.height * f)
                    .insetBy(dx: -box.width * f * 0.15, dy: -box.height * f * 0.15)
                    .intersection(CGRect(x: 0, y: 0, width: large.width, height: large.height))
                if let cropped = large.cropping(to: crop.integral) { cues.imprint = readImprint(cropped) }
                // Crop missed (odd lighting, shadow merged into the region) → whole photo.
                if cues.imprint == nil { cues.imprint = readImprint(large) }
            }
            return cues
        }.value
    }
    #endif

    // MARK: - Pixels

    static func analyzePixels(_ cg: CGImage) -> (PillCues, CGRect) {
        let w = cg.width, h = cg.height, n = w * h
        var px = [UInt8](repeating: 0, count: n * 4)
        guard let space = CGColorSpace(name: CGColorSpace.sRGB),
              let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: space,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return (PillCues(), .zero) }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        let lab = (0..<n).map { i in Lab(r: px[i * 4], g: px[i * 4 + 1], b: px[i * 4 + 2]) }

        // Background = median of a thin frame around the photo.
        let band = max(2, min(w, h) / 25)
        var border: [Lab] = []
        for y in 0..<h { for x in 0..<w where x < band || y < band || x >= w - band || y >= h - band { border.append(lab[y * w + x]) } }
        let bg = Lab(L: median(border.map(\.L)), a: median(border.map(\.a)), b: median(border.map(\.b)))

        var mask = [Bool](repeating: false, count: n)
        for i in 0..<n {
            let p = lab[i]
            let chroma = hypot(p.a - bg.a, p.b - bg.b)
            let shadow = p.L < bg.L && chroma < 8
            mask[i] = !shadow && p.distance(to: bg) > 16
        }

        // Largest connected region, slightly favouring the centre.
        var seen = [Bool](repeating: false, count: n)
        var best: [Int] = []
        var bestScore = 0.0
        for start in 0..<n where mask[start] && !seen[start] {
            var region: [Int] = []
            var stack = [start]
            seen[start] = true
            while let i = stack.popLast() {
                region.append(i)
                let x = i % w, y = i / w
                for (nx, ny) in [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)] where nx >= 0 && ny >= 0 && nx < w && ny < h {
                    let j = ny * w + nx
                    if mask[j] && !seen[j] { seen[j] = true; stack.append(j) }
                }
            }
            let cx = Double(region.reduce(0) { $0 + $1 % w }) / Double(region.count) / Double(w) - 0.5
            let cy = Double(region.reduce(0) { $0 + $1 / w }) / Double(region.count) / Double(h) - 0.5
            let score = Double(region.count) * (1.2 - min(1, hypot(cx, cy) * 1.4))
            if score > bestScore { bestScore = score; best = region }
        }
        guard Double(best.count) > Double(n) * 0.004 else { return (PillCues(), .zero) }

        // Principal axes → length, width, fill ratio.
        let xs = best.map { Double($0 % w) }, ys = best.map { Double($0 / w) }
        let mx = xs.reduce(0, +) / Double(best.count), my = ys.reduce(0, +) / Double(best.count)
        var cxx = 0.0, cyy = 0.0, cxy = 0.0
        for k in best.indices { let dx = xs[k] - mx, dy = ys[k] - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy }
        let theta = 0.5 * atan2(2 * cxy, cxx - cyy)
        let (ct, st) = (cos(theta), sin(theta))
        let us = best.indices.map { (xs[$0] - mx) * ct + (ys[$0] - my) * st }
        let vs = best.indices.map { -(xs[$0] - mx) * st + (ys[$0] - my) * ct }
        let length = (us.max()! - us.min()! + 1), width = (vs.max()! - vs.min()! + 1)
        let ratio = length / max(1, width)
        let fill = Double(best.count) / (length * width)

        var cues = PillCues()
        cues.found = true
        let all = trimmedMean(best.map { lab[$0] })
        let halfA = trimmedMean(best.indices.filter { us[$0] < 0 }.map { lab[best[$0]] })
        let halfB = trimmedMean(best.indices.filter { us[$0] >= 0 }.map { lab[best[$0]] })

        if ratio > 1.6, halfA.distance(to: halfB) > 22 {
            cues.shape = "capsule"
            cues.colors = Array(Set([nearest(halfA).code, nearest(halfB).code]))
            cues.seenHex = [halfA.hex, halfB.hex]
        } else {
            cues.shape = ratio < 1.15 ? "round" : fill < 0.83 ? "oval" : "oblong"
            cues.colors = [nearest(all).code]
            cues.seenHex = [all.hex]
        }

        let bx = best.map { $0 % w }, by = best.map { $0 / w }
        let box = CGRect(x: bx.min()!, y: by.min()!, width: bx.max()! - bx.min()! + 1, height: by.max()! - by.min()! + 1)
        return (cues, box)
    }

    // MARK: - Imprint (Apple Vision OCR)

    static func readImprint(_ cg: CGImage) -> String? {
        // Embossed imprints are low contrast: grey + contrast boost first.
        let boosted = CIImage(cgImage: cg).applyingFilter("CIColorControls", parameters: ["inputSaturation": 0, "inputContrast": 2.2])
        let input = CIContext().createCGImage(boosted, from: boosted.extent) ?? cg
        // .accurate can fail where no Neural Engine is available (e.g. simulator) → .fast.
        for level in [VNRequestTextRecognitionLevel.accurate, .fast] {
            let req = VNRecognizeTextRequest()
            req.recognitionLevel = level
            req.usesLanguageCorrection = false
            do { try VNImageRequestHandler(cgImage: input, options: [:]).perform([req]) } catch {
                print("PillSnap OCR (\(level == .accurate ? "accurate" : "fast")) failed: \(error)")
                continue
            }
            let text = (req.results ?? [])
                .compactMap { $0.topCandidates(1).first }
                .filter { $0.confidence > 0.3 }
                .map(\.string).joined()
                .uppercased().filter { $0.isLetter || $0.isNumber }
            if (1...8).contains(text.count) { return text }
        }
        return nil
    }

    // MARK: - Helpers

    static func nearest(_ c: Lab) -> PaletteColor {
        palette[paletteLab.indices.min { paletteLab[$0].distance(to: c) < paletteLab[$1].distance(to: c) }!]
    }

    static func name(of code: String) -> String { palette.first { $0.code == code }?.name ?? code }

    private static func median(_ v: [Double]) -> Double { let s = v.sorted(); return s.isEmpty ? 0 : s[s.count / 2] }

    /// Mean colour without highlights (gloss) and the darkest edge/shadow pixels.
    private static func trimmedMean(_ v: [Lab]) -> Lab {
        guard !v.isEmpty else { return Lab(L: 0, a: 0, b: 0) }
        let s = v.sorted { $0.L < $1.L }
        let lo = s.count * 15 / 100, hi = max(lo + 1, s.count * 85 / 100)
        let part = s[lo..<hi]
        let k = Double(part.count)
        return Lab(L: part.reduce(0) { $0 + $1.L } / k, a: part.reduce(0) { $0 + $1.a } / k, b: part.reduce(0) { $0 + $1.b } / k)
    }
}

/// CIELAB (D65), CIE76 distance.
struct Lab {
    var L: Double, a: Double, b: Double

    init(L: Double, a: Double, b: Double) { self.L = L; self.a = a; self.b = b }

    init(r: UInt8, g: UInt8, b: UInt8) {
        func lin(_ c: UInt8) -> Double { let v = Double(c) / 255; return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        let (R, G, B) = (lin(r), lin(g), lin(b))
        let x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
        let y = (0.2126 * R + 0.7152 * G + 0.0722 * B)
        let z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
        func f(_ t: Double) -> Double { t > 0.008856 ? cbrt(t) : 7.787 * t + 16.0 / 116 }
        self.L = 116 * f(y) - 16
        self.a = 500 * (f(x) - f(y))
        self.b = 200 * (f(y) - f(z))
    }

    init(hex: String) {
        let v = UInt32(hex.dropFirst(), radix: 16) ?? 0
        self.init(r: UInt8((v >> 16) & 255), g: UInt8((v >> 8) & 255), b: UInt8(v & 255))
    }

    func distance(to o: Lab) -> Double { sqrt(pow(L - o.L, 2) + pow(a - o.a, 2) + pow(b - o.b, 2)) }

    /// Back to sRGB hex, for showing "what the phone saw".
    var hex: String {
        func finv(_ t: Double) -> Double { let t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16.0 / 116) / 7.787 }
        let fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200
        let (x, y, z) = (finv(fx) * 0.95047, finv(fy), finv(fz) * 1.08883)
        let rl = 3.2406 * x - 1.5372 * y - 0.4986 * z
        let gl = -0.9689 * x + 1.8758 * y + 0.0415 * z
        let bl = 0.0557 * x - 0.2040 * y + 1.0570 * z
        func g(_ c: Double) -> Int { let v = c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1 / 2.4) - 0.055; return Int((min(1, max(0, v)) * 255).rounded()) }
        return String(format: "#%02X%02X%02X", g(rl), g(gl), g(bl))
    }
}
