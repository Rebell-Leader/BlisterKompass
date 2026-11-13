import SwiftUI

/// Dosage form from the official PZN list (BfArM Festbetrag list, IFA form code) for packs without picture data.
/// It only says *what kind* of medicine it is (tablet, capsule, drops …). Colour, size and imprint stay unknown,
/// so the drawing is a grey dashed outline, never a coloured pill (INV-05: missing appearance ≠ "white round").
struct DoseForm: Equatable {
    enum Family { case tablet, capsule, drops, liquid, injection, patch, cream, inhaler, spray, suppository, powder }
    let family: Family
    let label: String

    init?(code: String) {
        guard let (family, label) = DoseForm.table[code] else { return nil }
        self.family = family
        self.label = label
    }

    private static let table: [String: (Family, String)] = [
        "TABL": (.tablet, "Tablette"), "FTBL": (.tablet, "Filmtablette"), "TABR": (.tablet, "Retardtablette"),
        "TBLM": (.tablet, "magensaftresistente Tablette"), "FTBM": (.tablet, "magensaftresistente Filmtablette"),
        "TABRM": (.tablet, "magensaftresistente Retardtablette"), "TABMD": (.tablet, "Tablette, veränderte Freisetzung"),
        "UTBL": (.tablet, "überzogene Tablette"), "DRAG": (.tablet, "Dragee"), "KTAB": (.tablet, "Kautablette"),
        "TBLL": (.tablet, "Lutschtablette"), "STABL": (.tablet, "Schmelztablette"), "SUTA": (.tablet, "Sublingualtablette"),
        "TABB": (.tablet, "Brausetablette"), "TTAB": (.tablet, "Trinktablette"), "VAGT": (.tablet, "Vaginaltablette"),
        "KAPS": (.capsule, "Kapsel"), "KAPR": (.capsule, "Retardkapsel"), "KAPM": (.capsule, "magensaftresistente Kapsel"),
        "INHK": (.capsule, "Kapsel zum Inhalieren"),
        "AUGT": (.drops, "Augentropfen"), "EDAT": (.drops, "Augentropfen"), "NTRP": (.drops, "Nasentropfen"), "TROP": (.drops, "Tropfen"),
        "LSG": (.liquid, "Lösung"), "SIRP": (.liquid, "Sirup"), "SUSP": (.liquid, "Suspension"), "EMUL": (.liquid, "Emulsion"),
        "EMULE": (.liquid, "Emulsion"), "AMPT": (.liquid, "Trinkampullen"),
        "IJLG": (.injection, "Injektionslösung"), "IJSU": (.injection, "Injektionssuspension"), "DIJSU": (.injection, "Depot-Injektion"),
        "IFIJ": (.injection, "Infusions-/Injektionslösung"), "IFLG": (.injection, "Infusionslösung"), "AMP": (.injection, "Ampullen"),
        "AMPD": (.injection, "Depot-Ampullen"), "PLVIS": (.injection, "Pulver zur Injektion"),
        "PFLA": (.patch, "Pflaster"),
        "CREM": (.cream, "Creme"), "SALB": (.cream, "Salbe"), "GEL": (.cream, "Gel"), "PAST": (.cream, "Paste"), "LOTI": (.cream, "Lotion"),
        "AUGS": (.cream, "Augensalbe"), "AUGG": (.cream, "Augengel"), "EDGL": (.cream, "Augengel"), "ANSLB": (.cream, "Augen- und Nasensalbe"),
        "NCREM": (.cream, "Nasencreme"), "NGEL": (.cream, "Nasengel"), "VACR": (.cream, "Vaginalcreme"),
        "DA": (.inhaler, "Dosieraerosol"), "INHP": (.inhaler, "Pulver zum Inhalieren"), "INHL": (.inhaler, "Lösung zum Inhalieren"),
        "PLVD": (.inhaler, "Pulver zum Inhalieren"),
        "NSPR": (.spray, "Nasenspray"), "SPRY": (.spray, "Spray"), "SPRYX": (.spray, "Spray"), "SCHAU": (.spray, "Schaum"),
        "SUPP": (.suppository, "Zäpfchen"), "VASP": (.suppository, "Vaginalzäpfchen"),
        "PULV": (.powder, "Pulver"), "PULVE": (.powder, "Pulver"), "GRAN": (.powder, "Granulat"), "GRAM": (.powder, "Granulat"),
        "BTL": (.powder, "Granulat"),
    ]

    var symbol: String {
        switch family {
        case .tablet, .capsule: "pills"
        case .drops: "drop"
        case .liquid: "waterbottle"
        case .injection: "syringe"
        case .patch: "bandage"
        case .cream: "hand.raised"
        case .inhaler: "lungs"
        case .spray: "humidity"
        case .suppository: "capsule.portrait"
        case .powder: "circle.grid.3x3"
        }
    }
}

/// Grey dashed outline of the dosage form – the "picture" of a pack whose look is not known.
struct DoseFormTile: View {
    let form: DoseForm?
    var box: CGFloat = 90

    var body: some View {
        let dash = StrokeStyle(lineWidth: max(2, box / 30), dash: [box / 14, box / 20])
        ZStack {
            if let form, form.family == .tablet {
                Circle().stroke(Color.secondary, style: dash).frame(width: box * 0.62, height: box * 0.62)
            } else if let form, form.family == .capsule {
                Capsule().stroke(Color.secondary, style: dash).frame(width: box * 0.78, height: box * 0.34)
            } else {
                Image(systemName: form?.symbol ?? "shippingbox").font(.system(size: box * 0.42)).foregroundStyle(.secondary)
            }
        }
        .frame(width: box, height: box)
        .accessibilityLabel(form.map { "\($0.label), Aussehen unbekannt" } ?? "Aussehen unbekannt")
    }
}
