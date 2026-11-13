// Reads the medication lines of a Bundeseinheitlicher Medikationsplan (BMP) from the XML in its 2D code
// (KBV spec v2.8, Anlage 3; element and attribute names as in bmp_V2.8.xsd). Port of ios/PillSnap/PlanReader.swift.
//
// Privacy by design: only the plan's own metadata (version, page, instance id) and the <S> blocks are read: <M> entries
// with their <W> ingredients, <R> compounded medicines and <X> free-text lines. Patient (<P>), issuer (<A>) and
// parameters (<O>) are skipped and never reach memory. X lines are shown when the plan is read and never stored.
//
// The XML is walked by a small tokenizer instead of DOMParser: the same code runs in the browser,
// in the worker and in the Node tests, and it never resolves entities beyond the five XML ones.

import { SLOT_ORDER, product, pznName, nameStrength } from "./model.js";
import { bmpForm, unitOf } from "./dose-form.js";

/** label: "Ramipril 5 mg", or "PZN 01234567" when the line names no substance. */
export const itemLabel = (it) => [it.substance ?? it.name ?? (it.pzn != null ? `PZN ${it.pzn}` : "?"), it.strength].filter((x) => x != null).join(" ");

/** BMP 2.8 block headings (S/@c, KBV S_BMP_ZWISCHENUEBERSCHRIFT 1.02). */
export const SECTIONS = {
  411: "Bedarfsmedikation", 412: "Dauermedikation", 413: "Intramuskuläre Anwendung", 414: "Besondere Anwendung",
  415: "Intravenöse Anwendung", 416: "Anwendung unter die Haut", 417: "Fertigspritze", 418: "Selbstmedikation",
  419: "Allergiehinweise", 421: "Wichtige Hinweise", 422: "Wichtige Angaben", 423: "zu besonderen Zeiten anzuwendende Medikamente",
  424: "zeitlich befristet anzuwendende Medikamente", 425: "Wöchentliche Anwendung",
};

const int = (v) => (/^\d+$/.test(v ?? "") ? Number(v) : null);
const clean = (v) => { const t = (v ?? "").trim(); return t === "" ? null : t; };

/**
 * The whole plan code: { version, id (MP/@U), page (MP/@a), pages (MP/@z), items, notes } – or null if it is not a plan.
 * items: { kind: "med"|"recipe", pzn, name, substances: [{w, s}], substance, strength, formCode, formText, reason, extra,
 *          section, sectionLabel, schedule }; notes: [{ section, text }] from <X> lines.
 */
export function read(xml) {
  if (typeof xml !== "string" || !xml.includes("<MP")) return null;
  const items = [], notes = [];
  let meta = null, sec = null, med = null, subs = [];
  const ok = walk(xml, {
    start(name, a) {
      switch (name) {
        case "MP": meta = { version: a.v ?? null, id: a.U ?? null, page: int(a.a) ?? 1, pages: int(a.z) ?? 1 }; break;
        case "S": sec = section(a); break;
        case "M": med = a; subs = []; break;
        case "W": if (med) subs.push(a); break;
        case "X": if (clean(a.t)) notes.push({ section: sec?.label ?? null, text: clean(a.t) }); break;
        case "R": items.push(recipe(a, sec)); break;
        default: break; // P, A, O, … : personal, practice or clinical parameters – ignored
      }
    },
    end(name) {
      if (name === "S") sec = null;
      if (name !== "M" || !med) return;
      items.push(entry(med, subs, sec));
      med = null;
    },
  });
  return ok && meta ? { ...meta, items, notes } : null;
}

/** Plan items only (see read), or null if the text is not a medication plan. */
export const items = (xml) => read(xml)?.items ?? null;

function entry(m, subs, sec) {
  const pzn = /^\d+$/.test(m.p ?? "") ? m.p.padStart(8, "0") : null;
  const ws = subs.filter((w) => clean(w.w)).map((w) => ({ w: clean(w.w), s: clean(w.s) }));
  return {
    kind: "med", pzn, name: clean(m.a), substances: ws,
    // Combination products carry several <W>: all of them, in plan order ("Valsartan / Hydrochlorothiazid", "160 mg / 25 mg").
    substance: ws.length ? ws.map((w) => w.w).join(" / ") : null,
    strength: ws.some((w) => w.s) ? ws.map((w) => w.s ?? "?").join(" / ") : null,
    formCode: clean(m.f), formText: clean(m.fd), reason: clean(m.r), extra: clean(m.x),
    section: sec?.code ?? null, sectionLabel: sec?.label ?? null, schedule: schedule(m, sec?.code ?? null),
  };
}

/** <R>: a compounded medicine, described in free text only. No look, no product; dosing as the plan writes it. */
function recipe(r, sec) {
  return {
    kind: "recipe", pzn: null, name: "Rezeptur", substances: [], substance: clean(r.t) ? `Rezeptur: ${clean(r.t)}` : "Rezeptur",
    strength: null, formCode: null, formText: null, reason: null, extra: clean(r.x), section: sec?.code ?? null, sectionLabel: sec?.label ?? null,
    schedule: { kind: "text", slots: [], amounts: {}, doses: {}, days: [], note: null, text: null, unit: null },
  };
}

/** Plan items → the user's meds. A line takes a picture only from the catalog product with its own PZN (any pack size).
 *  Every other line keeps the plan's identity (PZN, name, ingredients), its schedule and `look: null` – never the
 *  picture of another maker or of a product found by substance (INV-05, INV-15). The plan's reason (M/@r) replaces the
 *  catalog's lay purpose; without one, none is shown. unknown / unknownPZNs list the lines without a picture. */
export function resolve(planItems, catalog, names = {}) {
  const meds = [], unknown = [], unknownPZNs = [];
  for (const it of planItems) {
    const plan = {
      schedule: it.schedule, indication: it.reason ? { de: it.reason, en: null } : null,
      extra: it.extra ?? null, sectionLabel: shownSection(it), bmpForm: bmpForm(it.formCode, it.formText),
    };
    const found = it.pzn != null ? product(catalog, it.pzn) : null;
    if (found) { meds.push({ ...found, ...plan }); continue; }
    const n = it.pzn != null ? pznName(names, it.pzn) : null;
    const substance = it.substance ?? clean(n?.substance);
    const name = it.name ?? n?.name ?? null;
    meds.push({
      pzn: it.pzn, name, substance: substance ?? name ?? (it.pzn != null ? `PZN ${it.pzn}` : "Ohne Namen"), nameOnly: substance == null,
      strength: it.strength ?? nameStrength(n), formCode: n?.form ?? null, atc: null, look: null, market: "DE", ...plan,
    });
    unknown.push(n?.name ?? itemLabel(it));
    if (it.pzn != null) unknownPZNs.push(it.pzn);
  }
  return { meds, unknown, unknownPZNs };
}

/** The block heading worth showing on a card: not the plain ones that the schedule already says. */
const shownSection = (it) => (["411", "412", "425"].includes(it.section) || !it.sectionLabel ? null : it.sectionLabel);

/** Several pages of one plan (same MP/@U, MP/@a of MP/@z) → one plan, or a note which pages are still missing. */
export function mergePages(pages) {
  const first = pages[0];
  const total = Math.max(...pages.map((p) => p.pages ?? 1));
  const got = new Set(pages.map((p) => p.page ?? 1));
  const missing = [];
  for (let i = 1; i <= total; i++) if (!got.has(i)) missing.push(i);
  const ordered = [...new Map(pages.map((p) => [p.page ?? 1, p])).values()].sort((a, b) => (a.page ?? 1) - (b.page ?? 1));
  return {
    version: first.version, id: first.id, pages: total, missing,
    items: ordered.flatMap((p) => p.items), notes: ordered.flatMap((p) => p.notes),
  };
}

const strictNumber = (s) => (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ? Number(s) : null);
const GLYPHS = { "½": 1 / 2, "¼": 1 / 4, "¾": 3 / 4, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 1 / 8 };
const round4 = (x) => Math.round(x * 1e4) / 1e4;

/** BMP dose → number. The spec's pattern: whole numbers, decimals with a comma ("0,5", "1,5") and the fractions 1/8, 1/4,
 *  1/3, 1/2, 2/3, 3/4. Also read leniently: "½" and other glyphs, and mixed numbers "1½" / "1 1/2" (= 1.5). */
export function num(v) {
  const s = (v ?? "").replace(/^[ \t]+|[ \t]+$/g, "");
  if (s in GLYPHS) return round4(GLYPHS[s]);
  const mixedGlyph = /^(\d+)\s*([½¼¾⅓⅔⅛])$/.exec(s);
  if (mixedGlyph) return round4(Number(mixedGlyph[1]) + GLYPHS[mixedGlyph[2]]);
  const mixedFrac = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixedFrac && Number(mixedFrac[3]) > 0) return round4(Number(mixedFrac[1]) + Number(mixedFrac[2]) / Number(mixedFrac[3]));
  const frac = s.split("/").filter((x) => x !== "");
  if (frac.length === 2) {
    const a = strictNumber(frac[0]), b = strictNumber(frac[1]);
    if (a != null && b != null && b > 0) return round4(a / b);
  }
  return strictNumber(s.replaceAll(",", ".")) ?? 0;
}

/** Sub-heading of a block: key code c, or free text t (the KBV sample plan writes <S t="Bedarfsmedikation">).
 *  411 = Bedarfsmedikation, 425 = wöchentliche Anwendung. */
export function sectionCode(a) {
  if (a.c != null) return a.c;
  const t = (a.t ?? "").toLowerCase();
  if (t.includes("bedarf")) return "411";
  if (t.includes("woch") || t.includes("wöch")) return "425";
  return null;
}

/** { code, label }: the code (or the code the free-text heading stands for) and the heading as printed. */
export function section(a) {
  const code = sectionCode(a);
  return { code, label: clean(a.t) ?? SECTIONS[code] ?? null };
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_WORDS = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];
// Only an explicit "once a week" counts as weekly in free text; "für 2 Wochen" or "alle 2 Wochen" stay free text.
const WEEKLY_TEXT = /^(?:1\s*[x×]|1-?mal|einmal|ein mal)\s*(?:pro\s+woche|die\s+woche|in\s+der\s+woche|w(?:ö|oe)chentl)|^w(?:ö|oe)chentlich\b/i;

/**
 * BMP dosing → schedule { kind, slots, amounts, doses, days, note, text, unit }.
 *   daily  – m/d/v/h (doses keeps the plan's own notation, e.g. "1/2", for display)
 *   weekly – wo = weekday (1 = Montag) with its m/d/v/h dose, or section 425, or an explicit "1x wöchentlich …" free text
 *   prn    – section 411 or free text with "Bedarf"
 *   text   – free-text dosing t ("nach INR", "alle 2 Tage"), shown as written; also a line without any dosing
 * unit = coded du (Anhang 4) or free-text dud; null when the plan states none.
 */
export function schedule(a, section) {
  const text = clean(a.t), note = clean(a.i), unit = unitOf(clean(a.du), a.dud);
  const amounts = {}, doses = {};
  for (const [attr, slot] of [["m", "morning"], ["d", "noon"], ["v", "evening"], ["h", "night"]]) {
    const raw = clean(a[attr]);
    const n = num(raw);
    if (n > 0) { amounts[slot] = n; doses[slot] = raw; }
  }
  const slots = SLOT_ORDER.filter((s) => amounts[s] != null);
  const base = { slots, amounts, doses, days: [], note, text, unit };
  if (section === "411" || text?.toLowerCase().includes("bedarf")) return { ...base, kind: "prn", text: text ?? "bei Bedarf" };
  const wo = int(a.wo);
  if (wo != null && wo >= 1 && wo <= 7) return { ...base, kind: "weekly", days: [DAYS[wo - 1]] };
  if (section === "425") return { ...base, kind: "weekly" };
  if (!slots.length && text && WEEKLY_TEXT.test(text)) {
    const i = DAY_WORDS.findIndex((d) => text.toLowerCase().includes(d));
    return { ...base, kind: "weekly", days: i >= 0 ? [DAYS[i]] : [] };
  }
  if (!slots.length) return { ...base, kind: "text" };
  return { ...base, kind: "daily" };
}

// Minimal XML walker: elements and attributes only (text, comments, PIs and CDATA are skipped).
// Returns false for malformed input (unbalanced tags, unknown entities, stray "<").

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(v) {
  if (/&(?!(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);)/.test(v)) return null; // bare "&"
  let bad = false;
  const out = v.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);/g, (_, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (cp > 0x10ffff) { bad = true; return ""; }
      return String.fromCodePoint(cp);
    }
    if (!(e in ENTITIES)) { bad = true; return ""; }
    return ENTITIES[e];
  });
  return bad ? null : out;
}

const NAME = "[A-Za-z_:][\\w.:-]*";
const ATTR = new RegExp(`\\s+(${NAME})\\s*=\\s*("[^"<]*"|'[^'<]*')`, "y");

function walk(xml, { start, end }) {
  const stack = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    if (xml.startsWith("<?", lt)) { const e = xml.indexOf("?>", lt); if (e < 0) return false; i = e + 2; continue; }
    if (xml.startsWith("<!--", lt)) { const e = xml.indexOf("-->", lt); if (e < 0) return false; i = e + 3; continue; }
    if (xml.startsWith("<![CDATA[", lt)) { const e = xml.indexOf("]]>", lt); if (e < 0) return false; i = e + 3; continue; }
    if (xml.startsWith("<!", lt)) return false; // no DTDs: nothing to expand
    if (xml[lt + 1] === "/") {
      const m = new RegExp(`</(${NAME})\\s*>`, "y");
      m.lastIndex = lt;
      const r = m.exec(xml);
      if (!r || stack.pop() !== r[1]) return false;
      end(r[1]);
      i = m.lastIndex;
      continue;
    }
    const nm = new RegExp(`<(${NAME})`, "y");
    nm.lastIndex = lt;
    const n = nm.exec(xml);
    if (!n) return false;
    let p = nm.lastIndex;
    const attrs = {};
    for (;;) {
      ATTR.lastIndex = p;
      const a = ATTR.exec(xml);
      if (!a) break;
      if (a[1] in attrs) return false;
      const v = decode(a[2].slice(1, -1));
      if (v == null) return false;
      attrs[a[1]] = v;
      p = ATTR.lastIndex;
    }
    const close = /\s*(\/?)>/y;
    close.lastIndex = p;
    const c = close.exec(xml);
    if (!c) return false;
    start(n[1], attrs);
    if (c[1]) end(n[1]); else stack.push(n[1]);
    i = close.lastIndex;
  }
  return stack.length === 0;
}
