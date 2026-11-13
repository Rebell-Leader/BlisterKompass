import Foundation

/// Loads the app's bundled data straight from the source tree.
enum AppData {
    static let dir = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    static let catalog: [Med] = try! JSONDecoder().decode([Med].self, from: Data(contentsOf: dir.appendingPathComponent("catalog.json")))
    /// Example plans live outside the app, in ios/PillSnap/Examples/plans (second argument).
    static let plans = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
    static func plan(_ name: String) -> String { try! String(contentsOf: plans.appendingPathComponent("\(name).xml"), encoding: .utf8) }
    static func myMeds(_ name: String) -> [Med] { PlanReader.resolve(PlanReader.items(in: plan(name))!, catalog: catalog).meds }
    static func look(_ pzn: String) -> Look { catalog.first { $0.pzn == pzn }!.look }
    static let names: [String: PZNName] = (try? JSONDecoder().decode([String: PZNName].self, from: Data(contentsOf: dir.appendingPathComponent("pzn-names.json")))) ?? [:]
}
