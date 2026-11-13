// The plan on the phone → the code for a printed sheet, and the bits of the printed table.
// Port of ios/PillSnap/BmpWriter.swift (BmpWriter, BmpForm) and MealTiming.swift.
//
// BMP 2.8 element names and rules (v="028", 32-hex U, zero doses left out), as plan-reader.js reads them. Only the medicines:
// no P (no person is stored or asked for), so the code is not a complete BMP by the KBV schema, which requires P; BlisterKompass
// reads it, other BMP software may not. The issuer (A) is the app, with the print time. The look is not in the code.

import { SLOT_ORDER } from "./model.js";
import { doseForm } from "./dose-form.js";

export const MAX_BYTES = 1400;
export const ISSUER = "BlisterKompass";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Plan entries in BMP order: daily and weekly in the main block, as-needed in section 411. */
export function lines(myMeds, unknownPZNs) {
  const all = [
    ...myMeds.map((m) => ({ pzn: m.pzn, schedule: m.schedule ?? null, reason: m.indication?.de ?? null, piece: true })),
    ...unknownPZNs.map((p) => ({ pzn: p, schedule: null, reason: null, piece: false })),
  ];
  return { main: all.filter((l) => l.schedule?.kind !== "prn"), prn: all.filter((l) => l.schedule?.kind === "prn") };
}

const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();

/** ISO-8859-1 XML, no prolog. Notes (i), then reasons (r) are dropped if the code would exceed 1400 bytes; null if it still does. */
export function xml(myMeds, unknownPZNs, { issued = new Date(), id = randomId() } = {}) {
  const { main, prn } = lines(myMeds, unknownPZNs);
  const head = `<MP v="028" U="${id}" l="de-DE"><A n="${ISSUER}" t="${isoLocal(issued)}"/>`;
  for (const [notes, reasons] of [[true, true], [false, true], [false, false]]) {
    let s = head;
    if (main.length) s += "<S>" + main.map((l) => element(l, notes, reasons)).join("") + "</S>";
    if (prn.length) s += `<S c="411">` + prn.map((l) => element(l, notes, reasons)).join("") + "</S>";
    s += "</MP>";
    if (payload(s).length <= MAX_BYTES) return s;
  }
  return null;
}

/** The code's bytes: the BMP is ISO-8859-1 (characters outside it become "?"). */
export function payload(s) {
  return Uint8Array.from(s, (c) => { const n = c.codePointAt(0); return n <= 0xff ? n : 0x3f; });
}

function element(l, notes, reasons) {
  const a = [];
  // M/@p is the PZN without leading zeros.
  if (l.pzn && /^\d+$/.test(l.pzn) && Number(l.pzn) > 0) a.push(["p", String(Number(l.pzn))]);
  const s = l.schedule;
  if (s) {
    if (s.kind === "weekly") {
      const i = DAYS.indexOf(s.days?.[0]);
      if (i >= 0) a.push(["wo", String(i + 1)]);
      a.push(["m", "1"]);
      if (s.text) a.push(["t", s.text.slice(0, 20)]);
    } else if (s.kind === "prn") {
      a.push(["t", (s.text ?? "bei Bedarf").slice(0, 20)]);
    } else {
      // The schema has no zero dose: an empty time of day is left out.
      ["m", "d", "v", "h"].forEach((attr, i) => { const v = s.amounts?.[SLOT_ORDER[i]] ?? 0; if (v > 0) a.push([attr, dose(v)]); });
      if (s.text) a.push(["t", s.text.slice(0, 20)]);
    }
    if (l.piece) a.push(["du", "1"]);
    if (notes && s.note) a.push(["i", s.note.slice(0, 80)]);
    if (reasons && l.reason) a.push(["r", l.reason.slice(0, 50)]);
  }
  return "<M" + a.map(([k, v]) => ` ${k}="${escape(v)}"`).join("") + "/>";
}

/** 1 → "1", 0.5 → "1/2" (the spec's notation), 1.5 → "1,5". */
export function dose(v) {
  if (v === 0.5) return "1/2";
  if (v === 0.25) return "1/4";
  if (v === 0.75) return "3/4";
  if (Number.isInteger(v)) return String(v);
  return String(v).replace(".", ",");
}

/** Dose for the printed table: ½, ¼, ¾ like on a paper plan. */
export const printed = (v) => ({ 0.5: "½", 0.25: "¼", 0.75: "¾", 1.5: "1½" })[v] ?? dose(v);

const escape = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// BMP short form as the product name or the official PZN list states it; "" if neither says.
const FORM_BY_NAME = [
  ["magensaftresistente tabletten", "msr. Tabl"], ["retardtabletten", "Retardtabl"], ["filmtabletten", "Filmtabl"],
  ["hartkapseln", "Hartkaps"], ["weichkapseln", "Weichkaps"], ["kapseln", "Kaps"], ["tabletten", "Tabl"],
];
export function form(name, ifaCode) {
  const low = (name ?? "").toLowerCase();
  const hit = FORM_BY_NAME.find(([k]) => low.includes(k));
  if (hit) return hit[1];
  return doseForm(ifaCode)?.label ?? "";
}

// Meal timing from the free-text Hinweise. The BMP has no coded field for it (M/@i is free text). Only clear, common wordings;
// first match in the order fasting, before, after, with. Any negation ("nicht", "kein"), a distance ("Abstand"), a choice
// ("oder") or "unabhängig" gives nothing (INV-05): "nicht zum Essen" must never become "zum Essen".
export const MEAL = {
  fasting: { label: "nüchtern", icon: "drop" },
  before: { label: "vor dem Essen", icon: "fork" },
  with: { label: "zum Essen", icon: "fork" },
  after: { label: "nach dem Essen", icon: "fork" },
};
const MEAL_WORDINGS = [
  ["fasting", ["nüchtern"]],
  ["before", ["vor dem essen", "vor den mahlzeiten", "vor der mahlzeit", "vor einer mahlzeit", "vor dem frühstück", "vor dem mittagessen", "vor dem abendessen"]],
  ["after", ["nach dem essen", "nach den mahlzeiten", "nach der mahlzeit", "nach einer mahlzeit", "nach dem frühstück", "nach dem mittagessen", "nach dem abendessen"]],
  ["with", ["zu den mahlzeiten", "zur mahlzeit", "zum essen", "während der mahlzeit", "während des essens", "mit dem essen", "mit einer mahlzeit", "mit etwas essen", "zum frühstück", "zu einer mahlzeit"]],
];
export function meal(...texts) {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t || /\b(nicht|kein|keine|keinesfalls|abstand|oder|unabhängig|egal)\b/.test(t)) return null;
  return MEAL_WORDINGS.find(([, words]) => words.some((w) => t.includes(w)))?.[0] ?? null;
}
export const scheduleMeal = (s) => (s ? meal(s.note, s.text) : null);
