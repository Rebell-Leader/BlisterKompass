// The securPharm Data Matrix on a German medicine pack (EU Falsified Medicines Directive).
// Port of ios/PillSnap/PackCode.swift. Two formats are in use (IFA PPN-Code spec V3.06):
//  - IFA / ISO 15434: [)>␞06␝9N<PPN>␝1T<batch>␝D<YYMMDD>␝S<serial>␞␄  (PPN = "11" + PZN + 2 check digits)
//  - GS1: (01)<NTIN>(10)<batch>(17)<YYMMDD>(21)<serial>        (NTIN = "04150" + PZN + check digit)
// Packs without a Data Matrix (non-prescription, e.g. Aspirin) carry only the PZN as a Code 39
// barcode: "-" + 8 digits (old PZN7: "-" + 7 digits). That gives the PZN, but no batch or expiry.
// The PZN identifies the product exactly – no image recognition involved.

import { product as catalogProduct, pznName, nameStrength, title as medTitle } from "./model.js";

const GS = "\u001d", RS = "\u001e", EOT = "\u0004";
const trimWS = (s) => s.replace(/^[ \t]+|[ \t]+$/g, "");
const code = (pzn, batch = null, expiry = null, serial = null) => ({ pzn, batch, expiry, serial });

/** PackCode { pzn, batch, expiry (YYMMDD, day 00 = end of month), serial } or null. */
export function parse(raw) {
  // zxing renders control characters as visible symbols in its text output; map them back.
  const s = raw.replaceAll("␝", GS).replaceAll("␞", RS).replaceAll("␄", EOT);
  const p = parsePZNCode(s);
  if (p) return p;
  return s.includes("[)>") || s.includes("9N") ? parseIFA(s) : parseGS1(s);
}

/** Code 39 PZN barcode: "-12345678" (PZN8) or "-1234567" (PZN7 = PZN8 with a leading 0). */
function parsePZNCode(s) {
  let t = trimWS(s);
  if (t.toUpperCase().startsWith("PZN")) t = trimWS(t.slice(3));
  if (t[0] !== "-") return null;
  const digits = t.slice(1);
  if (!/^\d{7,8}$/.test(digits)) return null;
  const pzn = digits.length === 7 ? "0" + digits : digits;
  return pznValid(pzn) ? code(pzn) : null;
}

function parseIFA(s) {
  const fields = {};
  for (const part of s.split(/[\u001d\u001e\u0004]/).filter((x) => x !== "")) {
    for (const di of ["9N", "8P", "1T", "D", "S"]) {
      if (part.startsWith(di) && !(di in fields)) { fields[di] = part.slice(di.length); break; }
    }
  }
  let pzn = null;
  const ppn = fields["9N"], gtin = fields["8P"];
  if (ppn != null && ppn.length === 12 && ppn.startsWith("11")) pzn = ppn.slice(2, 10);
  else if (gtin != null && gtin.length === 14 && gtin.startsWith("04150")) pzn = gtin.slice(5, 13);
  if (pzn == null || !pznValid(pzn)) return null;
  return code(pzn, fields["1T"] ?? null, fields.D ?? null, fields.S ?? null);
}

function parseGS1(s) {
  const ai = {};
  if (s.includes("(01)")) {
    // HRI form: (01)…(10)…(17)…(21)…
    for (const chunk of s.split("(").filter((x) => x !== "")) {
      const close = chunk.indexOf(")");
      if (close >= 0) ai[chunk.slice(0, close)] = chunk.slice(close + 1);
    }
  } else {
    // Raw form: fixed-length AIs 01 (14) and 17 (6); variable 10/21 end at GS.
    let rest = s.replaceAll("]d2", "");
    while (rest.length >= 2) {
      const c = rest.slice(0, 2);
      rest = rest.slice(2);
      if (c === "01") { ai["01"] = rest.slice(0, 14); rest = rest.slice(14); }
      else if (c === "17") { ai["17"] = rest.slice(0, 6); rest = rest.slice(6); }
      else if (c === "10" || c === "21") {
        const end = rest.indexOf(GS);
        ai[c] = end < 0 ? rest : rest.slice(0, end);
        rest = end < 0 ? "" : rest.slice(end + 1);
      } else rest = "";
      if (rest[0] === GS) rest = rest.slice(1);
    }
  }
  const ntin = ai["01"];
  if (ntin == null || ntin.length !== 14 || !ntin.startsWith("04150")) return null;
  const pzn = ntin.slice(5, 13);
  if (!pznValid(pzn)) return null;
  return code(pzn, ai["10"] ?? null, ai["17"] ?? null, ai["21"] ?? null);
}

/** PZN check digit: d1…d7 weighted 1…7, sum mod 11 = d8. */
export function pznValid(p) {
  if (typeof p !== "string" || !/^\d{8}$/.test(p)) return false;
  const d = [...p].map(Number);
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += d[i] * (i + 1);
  return sum % 11 === d[7];
}

/** "03/2028" */
export function expiryText(c) {
  const e = c.expiry;
  if (e == null || e.length !== 6) return null;
  return `${e.slice(2, 4)}/20${e.slice(0, 2)}`;
}

/** Expired if the last valid day is before today (local time). */
export function isExpired(c, today = new Date()) {
  const e = c.expiry;
  if (e == null || !/^\d{6}$/.test(e)) return false;
  const yy = Number(e.slice(0, 2)), mm = Number(e.slice(2, 4)), dd = Number(e.slice(4, 6));
  const year = 2000 + yy;
  const day = dd === 0 ? new Date(year, mm, 0).getDate() : dd;
  const last = new Date(year, mm - 1, day);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return start > last;
}

// What a scanned pack means for the user's plan. Identity comes from the PZN.
//  onPlan · onPlanNoLook · otherMaker (same substance, strength and release type, different PZN – only the
//  pharmacy can say whether it replaces that entry, INV-06/15) · sameSubstance (strength or release type differ
//  or are unknown) · notOnPlan · unknown

/** PackResult { kind, code, product (catalog, has a picture), name (official PZN list), mine (plan entry), difference } */
export function evaluate(c, { myMeds, unknownPZNs, catalog, names }) {
  const prod = catalogProduct(catalog, c.pzn);
  const name = pznName(names, c.pzn);
  const r = (kind, extra = {}) => ({ kind, code: c, product: prod, name, mine: null, difference: null, ...extra });
  const mine = myMeds.find((m) => m.pzn === c.pzn);
  // A plan entry without picture data (look null) is on the plan all the same – by its PZN.
  if (mine) return prod || mine.look ? r("onPlan", { product: prod ?? mine, mine }) : r("onPlanNoLook", { mine });
  if (unknownPZNs.includes(c.pzn)) return r("onPlanNoLook");
  // Same active substance as a plan entry. Only with the same strength and release type (as far as known) is it
  // possibly the same therapy from another maker; otherwise it is flagged as "same substance" – never as a replacement.
  const substance = prod?.substance ?? name?.substance ?? null;
  // Entries known only by a product name (nameOnly) carry no substance to compare.
  const same = myMeds.filter((m) => substance != null && substance !== "" && !m.nameOnly && (m.substance ?? "").toLowerCase() === substance.toLowerCase());
  if (same.length) {
    const strength = prod?.strength ?? nameStrength(name);
    const rel = release(name?.form);
    const sameStrength = same.filter((m) => strength != null && m.strength != null && norm(m.strength) === norm(strength));
    const match = sameStrength.find((m) => {
      const r2 = release(pznName(names, m.pzn)?.form);
      return rel == null || r2 == null || rel === r2;
    });
    if (match) return r("otherMaker", { mine: match });
    const difference = strength == null ? "die Stärke ist unbekannt"
      : sameStrength.length === 0 ? "aber eine andere Stärke" : "aber eine andere Darreichungsform";
    return r("sameSubstance", { mine: sameStrength[0] ?? same[0], difference });
  }
  if (prod || name) return r("notOnPlan");
  return r("unknown", { product: null, name: null });
}

export const expired = (res) => isExpired(res.code);
/** Not on the plan, but known → can be added (with a catalog look, or by its official name only). */
export const canAdd = (res) => res.kind === "notOnPlan" && (res.product != null || res.name != null);
export const resultTitle = (res) => (res.product ? medTitle(res.product) : res.kind === "onPlanNoLook" && res.mine ? medTitle(res.mine) : null) ?? res.name?.name ?? `PZN ${res.code.pzn}`;

/** Release type from the IFA form code: gastro-resistant and prolonged-release forms are not
 *  interchangeable with plain ones. null when the form is not known. */
export function release(form) {
  if (form == null) return null;
  if (["TBLM", "FTBM", "KAPM", "TABRM", "GRAM"].includes(form)) return "magensaftresistent";
  if (["TABR", "KAPR", "TABMD"].includes(form)) return "retardiert";
  return "normal";
}

/** "100 mg", "100MG", "75 ug" → "100mg", "75µg" for comparison. */
export const norm = (s) => s.toLowerCase().replaceAll(" ", "").replaceAll(",", ".").replaceAll("mcg", "µg").replaceAll("ug", "µg");
