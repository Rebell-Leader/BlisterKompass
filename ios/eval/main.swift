// Runs the app's on-device recogniser and matcher (the same Swift files as the
// app) on the NLM test photos – offline – against example plan A, and compares
// with NLM's ground truth from manifest.json.
//
//   ios/eval/run.sh        (photos first: node tools/fetch-test-photos.js)

import Foundation
import ImageIO
import CoreGraphics

let photos = CommandLine.arguments[1]
let dataDir = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let catalog = try JSONDecoder().decode([Med].self, from: Data(contentsOf: dataDir.appendingPathComponent("catalog.json")))
let planXML = try String(contentsOf: URL(fileURLWithPath: CommandLine.arguments[3]).appendingPathComponent("plan-a.xml"), encoding: .utf8)
let myMeds = PlanReader.resolve(PlanReader.items(in: planXML)!, catalog: catalog).meds

// MARK: ground truth

struct Entry: Decodable {
    struct Expect: Decodable { let substance: String; let product: String }
    struct Look: Decodable { let color: String?; let shape: String?; let imprint: String? }
    struct Photo: Decodable { let background: String? }
    let file: String; let expect: Expect; let look: Look; let photo: Photo
}
let manifest = try JSONDecoder().decode([Entry].self, from: Data(contentsOf: URL(fileURLWithPath: photos + "/manifest.json")))

/// NLM colour words → acceptable app colour codes.
func colorOK(_ nlm: String?, _ got: [String]) -> Bool {
    let map: [String: Set<String>] = [
        "WHITE": ["white", "offwhite", "beige"], "YELLOW": ["yellow", "lightyellow"], "ORANGE": ["orange", "pink"],
        "RED": ["red", "brown"], "PINK": ["pink"], "BLUE": ["blue"], "GREEN": ["green"], "BROWN": ["brown", "beige"],
    ]
    let want = (nlm ?? "").split(separator: ";").map { String($0) }
    return want.contains { map[$0]?.isDisjoint(with: got) == false }
}
func shapeOK(_ nlm: String?, _ got: String?) -> Bool {
    let map: [String: Set<String>] = ["ROUND": ["round"], "OVAL": ["oval", "oblong"], "CAPSULE": ["capsule", "oblong"]]
    return map[nlm ?? ""]?.contains(got ?? "") ?? false
}
func imprintOK(_ nlm: String?, _ got: String?) -> Bool {
    guard let got, !got.isEmpty else { return false }
    let parts = (nlm ?? "").uppercased().split(separator: ";").map { $0.filter { $0.isLetter || $0.isNumber } }
    let norm = { (s: String) in s.replacingOccurrences(of: "O", with: "0").replacingOccurrences(of: "I", with: "1").replacingOccurrences(of: "L", with: "1") }
    return parts.contains { !$0.isEmpty && (norm(got).contains(norm(String($0))) || norm(String($0)).contains(norm(got))) }
}

// MARK: images (EXIF-oriented, downscaled – like UIImage.normalizedCGImage)

func load(_ path: String, maxSide: Int) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil) else { return nil }
    let opts: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                 kCGImageSourceThumbnailMaxPixelSize: maxSide]
    return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
}

// MARK: run

var rows: [String] = []
var n = 0, nColor = 0, nShape = 0, nImprint = 0, nRight = 0
for e in manifest {
    let path = photos + "/" + e.file
    guard let small = load(path, maxSide: 320), let large = load(path, maxSide: 1600) else { continue }
    var (cues, box) = PillRecognizer.analyzePixels(small)
    if cues.found {
        let f = CGFloat(large.width) / CGFloat(small.width)
        let crop = CGRect(x: box.minX * f, y: box.minY * f, width: box.width * f, height: box.height * f)
            .insetBy(dx: -box.width * f * 0.15, dy: -box.height * f * 0.15)
            .intersection(CGRect(x: 0, y: 0, width: large.width, height: large.height))
        if let c = large.cropping(to: crop.integral) { cues.imprint = PillRecognizer.readImprint(c) }
        if cues.imprint == nil { cues.imprint = PillRecognizer.readImprint(large) }
    }
    let answer = cues.found && !cues.colors.isEmpty ? Matcher.answer(myMeds: myMeds, catalog: catalog, cues: cues) : nil
    let state = answer?.state ?? "–"
    let cands = (answer?.candidates ?? []).map(\.substance)

    let c = colorOK(e.look.color, cues.colors), s = shapeOK(e.look.shape, cues.shape), i = imprintOK(e.look.imprint, cues.imprint)
    let right = (["sure", "likely", "other_maker"].contains(state) && cands.first == e.expect.substance) || (state == "choose" && cands.contains(e.expect.substance))
    n += 1; nColor += c ? 1 : 0; nShape += s ? 1 : 0; nImprint += i ? 1 : 0; nRight += right ? 1 : 0
    let mark = { (b: Bool) in b ? "✅" : "❌" }
    let got = cands.isEmpty ? (answer?.notOnPlan.map { "not on plan: \($0.substance)" } ?? "–") : cands.prefix(3).joined(separator: ", ")
    rows.append("| \(e.file) | \(e.expect.substance) | \(mark(c)) \(cues.colors.joined(separator: "/")) (\(e.look.color ?? "")) | \(mark(s)) \(cues.shape ?? "–") (\(e.look.shape ?? "")) | \(mark(i)) \(cues.imprint ?? "–") (\(e.look.imprint ?? "")) | \(state) | \(mark(right)) \(got) | \(e.photo.background ?? "") |")
}

print("""
| Photo | Expected | Colour (NLM) | Shape (NLM) | Imprint OCR (NLM) | App state | Answer | Background |
|---|---|---|---|---|---|---|---|
\(rows.joined(separator: "\n"))

**\(n) photos:** colour \(nColor)/\(n) · shape \(nShape)/\(n) · imprint \(nImprint)/\(n) · right medication shown \(nRight)/\(n)
""")
