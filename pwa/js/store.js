// App state. Everything stays on the phone: the bundled pill catalog and the meds of the scanned plan.
// Port of ios/PillSnap/Store.swift. localStorage keeps exactly three keys, as UserDefaults does on iPhone:
// myMeds, unknownPZNs and learnedLeaflets (products whose look was read from a leaflet PDF the person picked).
// No account, no name, no network.

import { product, adding } from "./model.js";
import * as PlanReader from "./plan-reader.js";
import * as Pack from "./pack-code.js";
import * as Matcher from "./matcher.js";
import { pznName } from "./model.js";

const read = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
};

export class Store {
  constructor() {
    this.catalog = [];
    this.names = {};
    this.myMeds = read("myMeds", []);
    this.unknownPZNs = read("unknownPZNs", []);
    /** Products whose look was read from their package leaflet on this phone. */
    this.learned = read("learnedLeaflets", []);
  }

  /** Bundled catalog plus what was learned from leaflets. */
  get products() { return [...this.learned, ...this.catalog]; }

  /** Keep a product whose look was read from its leaflet PDF (as Store.learn on iPhone). */
  learn(med) {
    this.learned = [...this.learned.filter((m) => m.pzn !== med.pzn), med];
    try { localStorage.setItem("learnedLeaflets", JSON.stringify(this.learned)); } catch { /* private mode */ }
  }

  async load() {
    const [catalog, names] = await Promise.all([
      fetch("data/catalog.json").then((r) => r.json()),
      fetch("data/pzn-names.json").then((r) => r.json()),
    ]);
    this.catalog = catalog;
    this.names = names;
    // In a normal Safari tab, data of a site not used for 7 days can be deleted; ask to keep it.
    navigator.storage?.persist?.().catch(() => {});
  }

  get hasPlan() { return this.myMeds.length > 0 || this.unknownPZNs.length > 0; }

  /** Medication lines of a plan code → meds with known looks; null if it isn't a plan; { invalid } if it breaks BMP 2.8. */
  readPlan(xml) {
    const code = PlanReader.read(xml);
    if (!code) return null;
    return code.invalid ? { invalid: code.invalid } : this.resolvePlan(code);
  }

  /** A read (or merged multi-page) plan code → { meds, unknown, unknownPZNs, notes, id, page, pages, missing }. */
  resolvePlan(code) {
    return { ...PlanReader.resolve(code.items, this.products, this.names), notes: code.notes, id: code.id, page: code.page ?? 1, pages: code.pages ?? 1, missing: code.missing ?? [], code };
  }

  /** A new plan replaces the old list. Its lines without picture data are in plan.meds too (look null, with their schedule);
   *  unknownPZNs is kept for packs added by name only ("Ohne Bild"). A plan with missing pages is refused (false): the
   *  saved list has no place to say it is incomplete, so it would look complete in the day view, read-aloud and print. */
  adopt(plan) {
    if (plan.missing?.length || plan.incomplete?.length) return false;
    this.myMeds = plan.meds; this.unknownPZNs = []; this.save();
    return true;
  }

  /** A scanned pack (or typed entry) with its schedule, added to the plan on the phone. */
  add(med) { this.myMeds = adding(this.myMeds, med); this.unknownPZNs = this.unknownPZNs.filter((p) => p !== med.pzn); this.save(); }

  /** A pack without picture data: on the plan from now on, listed by its official name. */
  addWithoutLook(pzn) { if (!this.unknownPZNs.includes(pzn)) { this.unknownPZNs.push(pzn); this.save(); } }

  nameOf(pzn) { return pznName(this.names, pzn)?.name ?? `PZN ${pzn}`; }
  pznName(pzn) { return pznName(this.names, pzn); }
  product(pzn) { return product(this.products, pzn); }

  /** A scanned pack compared with the plan (exact, by PZN). */
  check(code) { return Pack.evaluate(code, { myMeds: this.myMeds, unknownPZNs: this.unknownPZNs, catalog: this.products, names: this.names }); }

  // No "take over the new pack" here: a person's tap must not replace the plan's PZN and look (INV-15, T-15).

  identify(cues) { return Matcher.answer(this.myMeds, this.products, cues); }

  save() {
    try {
      localStorage.setItem("myMeds", JSON.stringify(this.myMeds));
      localStorage.setItem("unknownPZNs", JSON.stringify(this.unknownPZNs));
    } catch { /* private mode: keep in memory */ }
  }
}
