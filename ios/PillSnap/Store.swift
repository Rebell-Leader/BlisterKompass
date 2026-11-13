import SwiftUI

/// App state. Everything stays on the phone: the bundled pill catalog and the
/// meds of the scanned plan (UserDefaults). No server, no account. The only network use is the leaflet lookup
/// for unknown PZNs (LeafletOnline), and only after the user allowed it once.
@MainActor
final class Store: ObservableObject {
    let catalog: [Med] = {
        guard let url = Bundle.main.url(forResource: "catalog", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([Med].self, from: data)) ?? []
    }()

    /// PZN → official name/substance/form/pack size (BfArM Festbetrag list), loaded on first use.
    lazy var pznNames: [String: PZNName] = {
        guard let url = Bundle.main.url(forResource: "pzn-names", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return [:] }
        return (try? JSONDecoder().decode([String: PZNName].self, from: data)) ?? [:]
    }()

    @Published private(set) var myMeds: [Med] = []
    @Published private(set) var unknownPZNs: [String] = []
    /// Products whose look was read from their package leaflet on this phone (online lookup).
    @Published private(set) var learned: [Med] = []
    /// Leaflet lookup by PZN allowed? nil = not asked yet.
    @Published var onlineLeaflets: Bool? {
        didSet { UserDefaults.standard.set(onlineLeaflets.map { $0 ? 1 : 0 } ?? -1, forKey: "onlineLeaflets") }
    }

    /// Bundled catalog plus what was learned from leaflets.
    var products: [Med] { learned + catalog }

    var hasPlan: Bool { !myMeds.isEmpty || !unknownPZNs.isEmpty }

    init() {
        if let data = UserDefaults.standard.data(forKey: "myMeds"), let meds = try? JSONDecoder().decode([Med].self, from: data) { myMeds = meds }
        unknownPZNs = UserDefaults.standard.stringArray(forKey: "unknownPZNs") ?? []
        if let data = UserDefaults.standard.data(forKey: "learnedLeaflets"), let meds = try? JSONDecoder().decode([Med].self, from: data) { learned = meds }
        let allowed = UserDefaults.standard.object(forKey: "onlineLeaflets") as? Int
        onlineLeaflets = allowed == 1 ? true : allowed == 0 ? false : nil
    }

    /// Look up a PZN's package leaflet online and keep the product if its look is stated clearly.
    func learn(pzn: String) async -> LeafletOnline.Outcome {
        if let known = products.product(pzn: pzn) { return .found(known) }
        guard onlineLeaflets == true else { return .offline }
        let outcome = await LeafletOnline.lookup(pzn: pzn, names: pznNames)
        if case .found(let med) = outcome {
            learned.removeAll { $0.pzn == med.pzn }
            learned.append(med)
            UserDefaults.standard.set(try? JSONEncoder().encode(learned), forKey: "learnedLeaflets")
        }
        return outcome
    }

    /// Medication lines of a plan code → meds with known looks (nil if it isn't a plan).
    func readPlan(xml: String) -> ScannedPlan? {
        PlanReader.items(in: xml).map { var p = PlanReader.resolve($0, catalog: products, names: pznNames); p.xml = xml; return p }
    }

    func adopt(_ plan: ScannedPlan) {
        myMeds = plan.meds
        unknownPZNs = plan.unknownPZNs
        save()
    }

    /// A scanned pack (or typed entry) with its schedule, added to the plan on the phone.
    func add(_ med: Med) {
        myMeds = myMeds.adding(med)
        unknownPZNs.removeAll { $0 == med.pzn }
        save()
    }

    /// A pack without picture data: on the plan from now on, listed by its official name.
    func addWithoutLook(pzn: String) {
        guard !unknownPZNs.contains(pzn) else { return }
        unknownPZNs.append(pzn)
        save()
    }

    /// Display name of a plan entry without picture data.
    func nameOf(pzn: String) -> String { pznNames[pzn]?.name ?? "PZN \(pzn)" }

    private func save() {
        UserDefaults.standard.set(try? JSONEncoder().encode(myMeds), forKey: "myMeds")
        UserDefaults.standard.set(unknownPZNs, forKey: "unknownPZNs")
    }

    /// A scanned pack compared with the plan (exact, by PZN).
    func check(_ code: PackCode) -> PackResult {
        PackResult.evaluate(code, myMeds: myMeds, unknownPZNs: unknownPZNs, catalog: products, names: pznNames)
    }

    /// The pharmacy switched maker: keep the plan entry (schedule) but take the new product and look.
    func takeOver(_ product: Med, replacing old: Med) {
        guard let i = myMeds.firstIndex(where: { $0.pzn == old.pzn }) else { return }
        var new = product
        new.schedule = old.schedule
        myMeds[i] = new
        save()
    }

    func identify(_ cues: PillCues) -> Answer {
        Matcher.answer(myMeds: myMeds, catalog: products, cues: cues)
    }
}

extension UIImage {
    /// Upright, downscaled bitmap (fixes camera EXIF orientation).
    func normalizedCGImage(maxSide: CGFloat) -> CGImage? {
        let scale = min(1, maxSide / max(size.width * self.scale, size.height * self.scale)) * self.scale
        let target = CGSize(width: max(1, (size.width * scale).rounded()), height: max(1, (size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            draw(in: CGRect(origin: .zero, size: target))
        }.cgImage
    }
}
