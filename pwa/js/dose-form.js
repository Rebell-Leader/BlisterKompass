// Dosage form from the official PZN list (BfArM Festbetrag list, IFA form code) for packs without
// picture data. Port of ios/PillSnap/DoseForm.swift. It only says *what kind* of medicine it is.
// Colour, size and imprint stay unknown, so the drawing is a grey dashed outline, never a coloured
// pill (INV-05: missing appearance ≠ "white round").

const T = "tablet", K = "capsule", D = "drops", L = "liquid", I = "injection", P = "patch", C = "cream", H = "inhaler", S = "spray", Z = "suppository", W = "powder";

const TABLE = {
  TABL: [T, "Tablette"], FTBL: [T, "Filmtablette"], TABR: [T, "Retardtablette"],
  TBLM: [T, "magensaftresistente Tablette"], FTBM: [T, "magensaftresistente Filmtablette"],
  TABRM: [T, "magensaftresistente Retardtablette"], TABMD: [T, "Tablette, veränderte Freisetzung"],
  UTBL: [T, "überzogene Tablette"], DRAG: [T, "Dragee"], KTAB: [T, "Kautablette"],
  TBLL: [T, "Lutschtablette"], STABL: [T, "Schmelztablette"], SUTA: [T, "Sublingualtablette"],
  TABB: [T, "Brausetablette"], TTAB: [T, "Trinktablette"], VAGT: [T, "Vaginaltablette"],
  KAPS: [K, "Kapsel"], KAPR: [K, "Retardkapsel"], KAPM: [K, "magensaftresistente Kapsel"],
  INHK: [K, "Kapsel zum Inhalieren"],
  AUGT: [D, "Augentropfen"], EDAT: [D, "Augentropfen"], NTRP: [D, "Nasentropfen"], TROP: [D, "Tropfen"],
  LSG: [L, "Lösung"], SIRP: [L, "Sirup"], SUSP: [L, "Suspension"], EMUL: [L, "Emulsion"],
  EMULE: [L, "Emulsion"], AMPT: [L, "Trinkampullen"],
  IJLG: [I, "Injektionslösung"], IJSU: [I, "Injektionssuspension"], DIJSU: [I, "Depot-Injektion"],
  IFIJ: [I, "Infusions-/Injektionslösung"], IFLG: [I, "Infusionslösung"], AMP: [I, "Ampullen"],
  AMPD: [I, "Depot-Ampullen"], PLVIS: [I, "Pulver zur Injektion"],
  PFLA: [P, "Pflaster"],
  CREM: [C, "Creme"], SALB: [C, "Salbe"], GEL: [C, "Gel"], PAST: [C, "Paste"], LOTI: [C, "Lotion"],
  AUGS: [C, "Augensalbe"], AUGG: [C, "Augengel"], EDGL: [C, "Augengel"], ANSLB: [C, "Augen- und Nasensalbe"],
  NCREM: [C, "Nasencreme"], NGEL: [C, "Nasengel"], VACR: [C, "Vaginalcreme"],
  DA: [H, "Dosieraerosol"], INHP: [H, "Pulver zum Inhalieren"], INHL: [H, "Lösung zum Inhalieren"],
  PLVD: [H, "Pulver zum Inhalieren"],
  NSPR: [S, "Nasenspray"], SPRY: [S, "Spray"], SPRYX: [S, "Spray"], SCHAU: [S, "Schaum"],
  SUPP: [Z, "Zäpfchen"], VASP: [Z, "Vaginalzäpfchen"],
  PULV: [W, "Pulver"], PULVE: [W, "Pulver"], GRAN: [W, "Granulat"], GRAM: [W, "Granulat"],
  BTL: [W, "Granulat"],
};

/** { family, label } or null for an unknown code. */
export function doseForm(code) {
  const r = code != null ? TABLE[code] : null;
  return r ? { family: r[0], label: r[1] } : null;
}

/** Icon name (js/icons.js) for families that are not drawn as an outline. */
export const ICON = {
  tablet: "pills", capsule: "pills", drops: "drop", liquid: "bottle", injection: "syringe", patch: "bandage",
  cream: "tube", inhaler: "lungs", spray: "spray", suppository: "capsule", powder: "powder",
};


// BMP 2.8 (Anlage 3) codes: the dosage form of a plan line (M/@f) and the dosing unit (M/@du) --------------------------
// KBV Darreichungsform codes (BMP M/@f), KBV_CS_SFHIR_KBV_DARREICHUNGSFORM 1.16, from data/processed/kbv_darreichungsform.csv.
const KBV = { AEO: "Ätherisches Öl", AMP: "Ampullen", APA: "Ampullenpaare", ASN: "Augen- und Nasensalbe", ASO: "Augen- und Ohrensalbe", ATO: "Augen- und Ohrentropfen", ATR: "Augentropfen", AUB: "Augenbad", AUC: "Augencreme", AUG: "Augengel", AUS: "Augensalbe", BAD: "Bad", BAL: "Balsam", BAN: "Bandage", BEU: "Beutel", BIN: "Binden", BON: "Bonbons", BPL: "Basisplatte", BRE: "Brei", BTA: "Brausetabletten", CRE: "Creme", DFL: "Durchstechflaschen", DIG: "Digitale Gesundheitsanwendungen", DIL: "Dilution", DIS: "Depot-Injektionssuspension", DKA: "Dragees in Kalenderpackung", DOS: "Dosieraerosol", DRA: "Dragees", DRM: "Dragees magensaftresistent", DSC: "Dosierschaum", DSS: "Dosierspray", EDP: "Einzeldosis-Pipetten", EIN: "Einreibung", ELE: "Elektroden", ELI: "Elixier", EMU: "Emulsion", ESS: "Essenz", ESU: "Erwachsenen-Suppositorien", EXT: "Extrakt", FBE: "Filterbeutel", FBW: "Franzbranntwein", FDA: "Filmdragees", FER: "Fertigspritzen", FET: "Fettsalbe", FLA: "Flasche", FLE: "Flüssigkeit zum Einnehmen", FLU: "Flüssig", FMR: "Filmtabletten magensaftresistent", FOL: "Folie", FRB: "Beutel mit retardierten Filmtabletten", FSE: "Flüssigseife", FTA: "Filmtabletten", GEK: "Granulat zur Entnahme aus Kapseln", GEL: "Gel", GLI: "Gas und Lösungsmittel zur Herstellung einer Injektions-/Infusionsdispersion", GLO: "Globuli", GMR: "Magensaftresistentes Granulat", GPA: "Gelplatte", GRA: "Granulat", GSE: "Granulat zur Herstellung einer Suspension zum Einnehmen", GUL: "Gurgellösung", HAS: "Handschuhe", HKM: "Magensaftresistente Hartkapseln", HKP: "Hartkapseln", HPI: "Hartkapseln mit Pulver zur Inhalation", HVW: "Hartkapseln mit veränderter Wirkstofffreisetzung", IFA: "Infusionsampullen", IFB: "Infusionsbeutel", IFD: "Infusionsdispersion", IFE: "Injektionslösung in einer Fertigspritze", IFF: "Infusionsflaschen", IFK: "Infusionslösungskonzentrat", IFL: "Injektionsflaschen", IFS: "Infusionsset", IHA: "Inhalationsampullen", IHP: "Inhalationspulver", IID: "Injektions- und Infusionsdispersion", IIE: "Injektions- oder Infusionslösung oder Lösung zum Einnehmen", IIL: "Injektions-, Infusionslösung", IIM: "Injektionslösung zur intramuskulären Anwendung", IJD: "Injektionsdispersion", IKA: "Inhalationskapseln", ILO: "Injektionslösung", IMP: "Implantat", INF: "Infusionslösung", INH: "Inhalat", INI: "Injektions-, Infusionsflaschen", INL: "Inhalationslösung", INS: "Instant-Tee", IST: "Instillation", ISU: "Injektionssuspension", IUP: "Intrauterinpessar", KAN: "Kanülen", KAP: "Kapseln", KAT: "Katheter", KDA: "Kaudragees", KEG: "Kegel", KER: "Kerne", KGU: "Kaugummi", KID: "Konzentrat zur Herstellung einer Infusionsdispersion", KII: "Konzentrat zur Herstellung einer Injektions- oder Infusionslösung", KKS: "Kleinkinder-Suppositorien", KLI: "Klistiere", KLT: "Klistier-Tabletten", KMP: "Hartkapseln mit magensaftresistent überzogenen Pellets", KMR: "Kapseln magensaftresistent", KOD: "Kondome", KOM: "Kompressen", KON: "Konzentrat", KPG: "Kombipackung", KRI: "Kristallsuspension", KSS: "Kinder- und Säuglings-Suppositorien", KSU: "Kinder-Suppositorien", KTA: "Kautabletten", LAN: "Lanzetten", LII: "Lösung zur Injektion, Infusion und Inhalation", LIQ: "Liquidum", LIV: "Lösung zur intravesikalen Anwendung", LOE: "Lösung", LOT: "Lotion", LOV: "Lösung für einen Vernebler", LSE: "Lösung zum Einnehmen", LTA: "Lacktabletten", LUP: "Lutschpastillen", LUT: "Lutschtabletten", LYE: "Lyophilisat zum Einnehmen", LYO: "Lyophilisat zur Herstellung einer Infusionslösung", MIL: "Milch", MIS: "Mischung", MIX: "Mixtur", MRG: "Magensaftresistentes Retardgranulat", MRP: "Magensaftresistente Pellets", MTA: "Manteltabletten", MUW: "Mundwasser", NAG: "Nasengel", NAO: "Nasenöl", NAS: "Nasenspray", NAW: "Wirkstoffhaltiger Nagellack", NDS: "Nasendosierspray", NSA: "Nasensalbe", NTR: "Nasentropfen", OCU: "Ocusert", OEL: "Öl", OHT: "Ohrentropfen", OVU: "Ovula", PAM: "Packungsmasse", PAS: "Pastillen", PEL: "Pellets", PEN: "Injektionslösung in einem Fertigpen", PER: "Perlen", PFL: "Pflaster", PFT: "Pflaster transdermal", PHI: "Pulver zur Herstellung einer Injektions-, Infusions- oder Inhalationslösung", PHV: "Pulver zur Herstellung einer Injektions- bzw. Infusionslösung oder Pulver und Lösungsmittel zur Herstellung einer Lösung zur intravesikalen Anwendung", PIE: "Pulver für ein Konzentrat zur Herstellung einer Infusionslösung, Pulver zur Herstellung einer Lösung zum Einnehmen", PIF: "Pulver zur Herstellung einer Infusionslösung", PII: "Pulver zur Herstellung einer Injektions- oder Infusionslösung", PIJ: "Pulver zur Herstellung einer Injektionslösung", PIK: "Pulver zur Herstellung eines Infusionslösungskonzentrates", PIS: "Pulver zur Herstellung einer Infusionssuspension", PIV: "Pulver zur Herstellung einer Injektions- bzw. Infusionslösung oder einer Lösung zur intravesikalen Anwendung", PKI: "Pulver für ein Konzentrat zur Herstellung einer Infusionslösung", PLD: "Pulver und Lösungsmittel zur Herstellung einer Depot-Injektionssuspension", PLE: "Pulver zur Herstellung einer Lösung zum Einnehmen", PLF: "Pulver und Lösungsmittel zur Herstellung einer Infusionslösung", PLG: "Perlongetten", PLH: "Pulver und Lösungsmittel zur Herstellung einer Injektions- bzw. Infusionslösung", PLI: "Pulver und Lösungsmittel zur Herstellung einer Injektionslösung", PLK: "Pulver und Lösungsmittel für ein Konzentrat zur Herstellung einer Infusionslösung", PLS: "Pulver und Lösungsmittel zur Herstellung einer Injektionssuspension", PLV: "Pulver und Lösungsmittel zur Herstellung einer Lösung zur intravesikalen Anwendung", PPL: "Pumplösung", PRS: "Presslinge", PSE: "Pulver zur Herstellung einer Suspension zum Einnehmen", PST: "Paste", PUD: "Puder", PUE: "Pulver zum Einnehmen", PUL: "Pulver", RED: "Retard-Dragees", REK: "Retard-Kapseln", RET: "Retard-Tabletten", RGR: "Retard-Granulat", RKA: "Rektalkapseln", RKT: "Retardkautablette", RMS: "Retardmikrokapseln und Suspensionsmittel", RSC: "Rektalschaum", RSU: "Rektalsuspension", RUT: "Retard-überzogene Tabletten", SAF: "Saft", SAL: "Salbe", SAM: "Salbe zur Anwendung in der Mundhöhle", SCH: "Schaum", SEI: "Seife", SHA: "Shampoo", SIR: "Sirup", SLZ: "Salz", SMF: "Schmelzfilm", SMT: "Schmelztabletten", SMU: "Suppositorien mit Mulleinlage", SPA: "Spritzampullen", SPF: "Sprühflasche", SPL: "Spüllösung", SPR: "Spray", SPT: "Transdermales Spray", SRI: "Spritzen", SSU: "Säuglings-Suppositorien", STA: "Stechampullen", STB: "Stäbchen", STI: "Stifte", STR: "Streifen", SUB: "Substanz", SUE: "Suspension zum Einnehmen", SUF: "Sublingualfilm", SUI: "Suspension zur Implantation", SUL: "Sublingualspray, Lösung", SUP: "Suppositorien", SUS: "Suspension", SUT: "Sublingualtabletten", SUV: "Suspension für einen Vernebler", SWA: "Schwämme", TAB: "Tabletten", TAE: "Täfelchen", TAM: "Trockenampullen", TEE: "Tee", TEI: "Tropfen zum Einnehmen", TES: "Test", TIN: "Tinktur", TKA: "Tabletten in Kalenderpackung", TLE: "Tablette zur Herstellung einer Lösung zum Einnehmen", TMR: "Tabletten magensaftresistent", TON: "Tonikum", TPN: "Tampon", TPO: "Tamponaden", TRA: "Trinkampullen", TRI: "Trituration", TRO: "Tropfen", TRS: "Trockensubstanz mit Lösungsmittel", TRT: "Trinktabletten", TSA: "Trockensaft", TSD: "Tabletten zur Herstellung einer Suspension zum Einnehmen für einen Dosierspender", TSE: "Tablette zur Herstellung einer Suspension zum Einnehmen", TSS: "Trockensubstanz ohne Lösungsmittel", TST: "Teststäbchen", TSY: "Transdermales System", TTR: "Teststreifen", TUB: "Tube", TUE: "Tücher", TUP: "Tupfer", TVW: "Tablette mit veränderter Wirkstofffreisetzung", UTA: "Überzogene Tabletten", VAL: "Vaginallösung", VAR: "Vaginalring", VCR: "Vaginalcreme", VER: "Verband", VGE: "Vaginalgel", VKA: "Vaginalkapseln", VLI: "Vlies", VOV: "Vaginalovula", VST: "Vaginalstäbchen", VSU: "Vaginalsuppositorien", VTA: "Vaginaltabletten", WAT: "Watte", WGA: "Wundgaze", WKA: "Weichkapseln", WKM: "Magensaftresistente Weichkapseln", WUE: "Würfel", XDG: "Duschgel", XDS: "Deo-Spray", XFE: "Festiger", XGM: "Gesichtsmaske", XHA: "Halsband", XHS: "Haarspülung", XNC: "Nachtcreme", XPK: "Körperpflege", XTC: "Tagescreme", ZAM: "Zylinderampullen", ZBU: "Zahnbürste", ZCR: "Zahncreme", ZGE: "Zahngel", ZKA: "Zerbeisskapseln", ZPA: "Zahnpasta" };

const FAMILY_WORDS = [
  ["kapsel", K], ["tablette", T], ["dragee", T], ["tropfen", D], ["spritze", I], ["injektion", I], ["ampulle", I], ["infusion", I],
  ["pflaster", P], ["creme", C], ["salbe", C], ["gel", C], ["paste", C], ["lotion", C], ["aerosol", H], ["inhal", H], ["spray", S],
  ["suppositor", Z], ["zäpfchen", Z], ["pulver", W], ["granulat", W], ["lösung", L], ["sirup", L], ["suspension", L], ["saft", L], ["emulsion", L],
];
const familyOf = (label) => FAMILY_WORDS.find(([w]) => label.toLowerCase().includes(w))?.[1] ?? null;

/** Dosage form of a BMP line: KBV code M/@f (older plans also write short forms like "Tabl") or free text M/@fd. */
export function bmpForm(f, fd) {
  const label = (f != null ? KBV[f.toUpperCase()] : null) ?? fd ?? f ?? null;
  if (!label) return null;
  const family = familyOf(label) ?? (/^tab/i.test(label) ? T : /^kap/i.test(label) ? K : null);
  return family ? { family, label } : { family: null, label };
}

/** BMP dosing units, Anhang 4 (KBV S_BMP_DOSIEREINHEIT 1.01): code in M/@du → word on the printout. */
export const UNITS = {
  "#": "Messlöffel", 0: "Messbecher", 1: "Stück", 2: "Pkg.", 3: "Flasche", 4: "Beutel", 5: "Hub", 6: "Tropfen", 7: "Teelöffel",
  8: "Esslöffel", 9: "E", a: "Tasse", b: "Applikatorfüllung", c: "Augenbadewanne", d: "Dosierbriefchen", e: "Dosierpipette",
  f: "Dosierspritze", g: "Einzeldosis", h: "Glas", i: "Likörglas", j: "Messkappe", k: "Messschale", l: "Mio E", m: "Mio IE",
  n: "Pipettenteilstrich", o: "Sprühstoß", p: "IE", q: "cm", r: "l", s: "ml", t: "g", u: "kg", v: "mg",
};
/** Unit of a plan line: the coded unit (du), else the free-text unit (dud); null when the plan states none (never a default). */
export const unitOf = (du, dud) => (du != null ? UNITS[du] ?? null : null) ?? (dud?.trim() || null);
