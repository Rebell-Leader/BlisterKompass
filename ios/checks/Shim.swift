// macOS stand-ins for the two UI lookups the matcher uses (Theme.swift is iOS-only).
struct Slot { let id: String; static let all = ["morning", "noon", "evening", "night"].map { Slot(id: $0) } }
enum ShapeInfo { static func name(_ code: String?) -> String { code ?? "" } }
