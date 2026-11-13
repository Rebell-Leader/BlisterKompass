import Foundation
import PDFKit

/// Live leaflet lookup for a PZN the app doesn't know yet: downloads the package leaflet (PDF), reads section 6
/// with `LeafletParser` and turns it into a catalog product. Only the PZN leaves the phone (in the URL), and only
/// after the user allowed it once (`Store.onlineLeaflets`). Nothing about the person is sent.
enum LeafletOnline {
    /// Leaflet PDFs published per PZN by a German online pharmacy.
    static func url(pzn: String) -> URL? { LeafletParser.url(pzn: pzn) }

    enum Outcome { case found(Med), noLeaflet, unclear, offline }

    static func lookup(pzn: String, names: [String: PZNName]) async -> Outcome {
        guard let url = url(pzn: pzn) else { return .noLeaflet }
        var req = URLRequest(url: url, timeoutInterval: 12)
        req.setValue("BlisterKompass/0.1 (hackathon prototype)", forHTTPHeaderField: "User-Agent")
        let data: Data
        do {
            let (d, response) = try await URLSession.shared.data(for: req)
            guard (response as? HTTPURLResponse)?.statusCode == 200, d.starts(with: Data("%PDF".utf8)) else { return .noLeaflet }
            data = d
        } catch {
            return .offline
        }
        let official = names[pzn]
        // Strength from the official PZN name ("MTX HEXAL 10MG …" → "10 mg"), else from the leaflet.
        let officialStrength = official.flatMap { LeafletParser.matches(#"(\d+(?:[.,]\d+)?)\s?(MG|UG|µG)"#, in: $0.name, groups: 2).nilIfEmpty }
            .map { "\($0[0].replacingOccurrences(of: ".", with: ",")) \($0[1] == "MG" ? "mg" : "µg")" }
        guard let text = PDFDocument(data: data)?.string,
              let r = LeafletParser.parse(leaflet: text, source: "leaflet:" + url.absoluteString, strength: officialStrength) else { return .unclear }
        let med = Med(pzn: pzn, name: r.name ?? official?.name ?? "PZN \(pzn)",
                      substance: official?.substance.nonEmpty ?? r.substance ?? r.name ?? "PZN \(pzn)",
                      strength: r.strength, manufacturer: nil, atc: "", indication: nil, look: r.look, market: "DE")
        return .found(med)
    }
}

private extension String { var nonEmpty: String? { isEmpty ? nil : self } }
private extension Array { var nilIfEmpty: Self? { isEmpty ? nil : self } }
