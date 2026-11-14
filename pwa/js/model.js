// Product and plan data only. There is deliberately no type for a person.
// Port of ios/PillSnap/Models.swift (+ the plain helpers of Theme.swift).
//
// Shapes (plain objects, as in catalog.json):
//   Med      { pzn, pzns?, name, substance, strength?, manufacturer?, atc, indication?: {de,en}, look (null = unknown), market?,
//              schedule?, change?, extra?, sectionLabel?, formCode? (IFA), bmpForm? ({family, label} from M/@f), nameOnly? }
//   Look     { shape, color, color2?, lengthMm?, widthMm?, score?, imprint?, finish?, colorHex, color2Hex?, colorName, color2Name?, source?, leaflet? }
//   Schedule { kind: daily|weekly|prn|text, slots: [morning|noon|evening|night], amounts: {slot: n}, doses?: {slot: "1/2"},
//              days: [mon…sun], note?, text?, unit? }   (plan entries: see plan-reader.js schedule())

export const SLOT_ORDER = ["morning", "noon", "evening", "night"];

/** Time of day: icon + word, never icon alone. Fills are deep enough for white text in both modes. */
export const SLOTS = [
  { id: "morning", label: "Morgens", icon: "sunrise", hex: "#B86A00" },
  { id: "noon", label: "Mittags", icon: "sun", hex: "#B35400" },
  { id: "evening", label: "Abends", icon: "sunset", hex: "#6A43A3" },
  { id: "night", label: "Nachts", icon: "moon", hex: "#34508C" },
];

export const SHAPES = [
  { code: "round", name: "rund" }, { code: "oval", name: "oval" }, { code: "oblong", name: "länglich" },
  { code: "capsule", name: "Kapsel" }, { code: "heart", name: "Herz" },
];
export const shapeName = (code) => SHAPES.find((s) => s.code === code)?.name ?? (code ?? "");

export const title = (med) => [med.substance ?? med.name, med.strength].filter((x) => x != null).join(" ");

/** The catalog product a PZN belongs to (any of its pack sizes), carrying the PZN that was scanned. */
export function product(catalog, pzn) {
  const m = catalog.find((x) => x.pzn === pzn || (x.pzns ?? []).includes(pzn));
  return m ? { ...m, pzn } : null;
}

/** The plan with one more entry; an entry with the same PZN is replaced (new schedule). */
export const adding = (meds, med) => [...meds.filter((m) => m.pzn !== med.pzn), med];

// Look helpers

/** Shown under the picture, so nobody takes reference data for their own pill. */
export function sourceText(look) {
  const s = look?.source;
  if (s == null) return null;
  if (s.startsWith("leaflet:pdf:")) return "Aussehen laut der Packungsbeilage, die Sie gewählt haben";
  if (s.startsWith("leaflet:")) return "Aussehen laut Packungsbeilage";
  if (s.startsWith("ema")) return "Aussehen laut EMA-Produktinformation";
  if (s.startsWith("dailymed")) return "Aussehen: US-Referenzdaten";
  return "Aussehen: Beispieldaten";
}
export const colorText = (look) => [look.colorName?.de, look.color2Name?.de].filter((x) => x != null).join(" / ");
export const hasScore = (look) => (look.score ?? "none") !== "none";

// Day view: what is due now, what comes later. Only the clock and the plan's schedule decide;
// nothing is tracked or inferred (intake is not recorded). Uses the device's local time.

/** Time of day → plan slot: morning 4–11, noon 11–15, evening 15–21, night 21–4. */
export function slotAt(date) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return "morning";
  if (h >= 11 && h < 15) return "noon";
  if (h >= 15 && h < 21) return "evening";
  return "night";
}

export const weekdayAt = (date) => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][date.getDay()];

/**
 * Now first, then the rest of the day in order, then today's slots that are already past (`past`: never "tomorrow", so
 * nobody skips a morning dose at 11:05), then the weekly meds that are not due in a slot still ahead today (with their next
 * date), meds with free-text dosing, as-needed last. Empty sections are left out. The day runs 04:00–04:00: between
 * midnight and 04:00 the night slot is last night's bedtime dose (`lastNight`), never "now" again (T-06).
 * A weekly med sits in its own slot on its weekday – only while that slot is still ahead today.
 * Section: { kind: "slot"|"weeklyToday"|"weeklyLater"|"text"|"prn", slot?, entries: [{med, amount, dose?, weekly?, next?}],
 *            now, past, lastNight, tomorrow (always false; kept for older callers) }
 */
export function sections(meds, date) {
  const current = slotAt(date);
  const start = SLOT_ORDER.indexOf(current);
  const afterMidnight = current === "night" && date.getHours() < 4;
  const flags = { now: false, past: false, lastNight: false, tomorrow: false };
  const out = [];
  const today = weekdayAt(date);
  const isWeekly = (m) => m.schedule?.kind === "weekly";
  const dueToday = (m) => isWeekly(m) && (m.schedule.days ?? []).includes(today);
  const placed = new Set();
  // Older saved plans have weekly meds without a time of day: listed for today as before, but never as "now".
  const legacy = meds.filter((m) => dueToday(m) && !(m.schedule.slots ?? []).length);
  if (legacy.length) out.push({ kind: "weeklyToday", entries: legacy.map((med) => ({ med, amount: null })), ...flags });
  legacy.forEach((m) => placed.add(m));
  for (let k = 0; k < SLOT_ORDER.length; k++) {
    const slot = SLOT_ORDER[(start + k) % SLOT_ORDER.length];
    const past = start + k >= SLOT_ORDER.length && !afterMidnight;
    const lastNight = k === 0 && afterMidnight;
    const entries = [];
    for (const m of meds) {
      const s = m.schedule;
      if (!s || !(s.slots.includes(slot) || (s.amounts?.[slot] ?? 0) > 0)) continue;
      if (s.kind === "daily") entries.push({ med: m, amount: s.amounts?.[slot] ?? null, dose: s.doses?.[slot] ?? null });
      else if (dueToday(m) && !past && !lastNight) { entries.push({ med: m, amount: s.amounts?.[slot] ?? null, dose: s.doses?.[slot] ?? null, weekly: true }); placed.add(m); }
    }
    if (!entries.length) continue;
    out.push({ kind: "slot", slot, entries, ...flags, now: k === 0 && !afterMidnight, past, lastNight });
  }
  // The current slot leads.
  const i = out.findIndex((s) => s.kind === "slot" && s.slot === current);
  if (i > 0) out.unshift(...out.splice(i, 1));
  const later = meds.filter((m) => isWeekly(m) && !placed.has(m));
  if (later.length) out.push({ kind: "weeklyLater", entries: later.map((med) => ({ med, amount: null, next: nextDay(med.schedule.days?.[0], date) })), ...flags });
  const text = meds.filter((m) => m.schedule?.kind === "text");
  if (text.length) out.push({ kind: "text", entries: text.map((med) => ({ med, amount: null })), ...flags });
  const prn = meds.filter((m) => m.schedule?.kind === "prn");
  if (prn.length) out.push({ kind: "prn", entries: prn.map((med) => ({ med, amount: null })), ...flags });
  return out;
}

/** The next date with that weekday after today (today itself counts only as next week's: today's slot is past or unknown). */
export function nextDay(day, date) {
  const want = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(day);
  if (want < 0) return null;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + (((want - d.getDay() + 7) % 7) || 7));
  return d;
}
/** "nächster Montag, 16.11." */
export const nextText = (day, next) => (next ? `nächster ${dayName(day)}, ${next.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}` : "einmal pro Woche");

// Patient-facing text from fixed templates over the plan data (INV-12): nothing generated.

export const DAY_NAMES = { mon: "Montag", tue: "Dienstag", wed: "Mittwoch", thu: "Donnerstag", fri: "Freitag", sat: "Samstag", sun: "Sonntag" };
export const dayName = (code) => DAY_NAMES[code] ?? code;

const FRACTION_WORDS = { 0.5: "eine halbe", 0.25: "eine viertel", 0.75: "drei viertel", 0.3333: "ein Drittel", 0.6667: "zwei Drittel", 0.125: "ein Achtel", 1.5: "anderthalb" };
export const amountText = (v) => FRACTION_WORDS[v] ?? (v === 1 ? "eine" : v === 2 ? "zwei" : v === 3 ? "drei" : v === 4 ? "vier" : german(v));
const FRACTION_GLYPHS = { 0.5: "½", 0.25: "¼", 0.75: "¾", 0.3333: "⅓", 0.6667: "⅔", 0.125: "⅛", 1.5: "1½" };
export const amountSymbol = (v) => FRACTION_GLYPHS[v] ?? german(v);

/** What a time-slot tile draws for the plan's amount: `whole` pills and one `part` pill (0 < part < 1, the plan's own
 *  fraction), or null for the number alone: unknown amount, a unit like "20 IE", a form that isn't a tablet or capsule,
 *  a part capsule, or more than 4 pills. A whole dose is the pills alone; a part keeps the number below (`showNumber`).
 *  Only the plan's amount is drawn: a part pill never says the tablet may be split (INV-14). */
export function doseGlyph(amount, family, unit = null) {
  if (amount == null || !(amount > 0) || (unit && unit !== "Stück")) return null;
  if (family !== "tablet" && family !== "capsule") return null;
  const whole = Math.floor(amount + 1e-6);
  const part = Math.round((amount - whole) * 1e4) / 1e4;
  if (part > 0 && family === "capsule") return null;
  if (whole + (part > 0 ? 1 : 0) > 4) return null;
  return { whole, part, showNumber: part > 0 };
}
/** Like Swift's String(format: "%g"): 1 → "1", 0.75 → "0.75". */
export const fmt = (v) => String(Number(v.toPrecision(6)));
/** German decimal comma: 2.5 → "2,5". */
export const german = (v) => fmt(v).replace(".", ",");

/** The plan's own dose notation for display: "1/2" → "½", "3/4" → "¾", "0,5" stays "0,5", "1.5" → "1,5". */
export function doseSymbol(raw, amount = null) {
  if (raw == null || raw === "") return amount != null ? amountSymbol(amount) : "";
  const s = raw.trim();
  return { "1/2": "½", "1/4": "¼", "3/4": "¾", "1/3": "⅓", "2/3": "⅔", "1/8": "⅛" }[s] ?? s.replace(".", ",");
}

/** "1 Tablette", "½ Tablette", "2 Kapseln", "20 IE", "2 Hub" – from the plan amount, its unit and the drawn form. */
export function countText(a, look, unit = null, dose = null) {
  const n = doseSymbol(dose, a);
  if (unit && unit !== "Stück") return `${n} ${unit}`;
  if (!look) return unit ? `${n} ${unit}` : n;
  const capsule = ["capsule", "softgel"].includes(look.shape);
  const noun = capsule ? (a > 1 ? "Kapseln" : "Kapsel") : (a > 1 ? "Tabletten" : "Tablette");
  return `${n} ${noun}`;
}

export function whenText(med) {
  const s = med.schedule;
  if (!s) return "";
  // An amount the plan (or the person) didn't give stays unknown: never "eine" by default (INV-05, T-13).
  const slots = () => SLOTS.filter((x) => s.slots.includes(x.id)).map((x) => `${x.label.toLowerCase()} ${s.amounts?.[x.id] != null ? amountText(s.amounts[x.id]) : "(Menge nicht angegeben)"}`).join(", ");
  if (s.kind === "prn") return "nur bei Bedarf" + (s.text && s.text.toLowerCase() !== "bei bedarf" ? `, ${s.text}` : "");
  if (s.kind === "text") return s.text ? `laut Plan: ${s.text}` : "Dosierung steht nicht auf dem Plan";
  if (s.kind === "weekly") return "nur einmal pro Woche" + (s.days[0] ? `, am ${dayName(s.days[0])}` : "") + (s.slots.length ? `, ${slots()}` : "") + (s.text ? ` (${s.text})` : "");
  return slots();
}

export const spokenStrength = (med) => (med.strength ?? "").replaceAll("mg", "Milligramm").replaceAll("µg", "Mikrogramm");

export function spoken(med) {
  const parts = [`Das ist ${title(med).replace(med.strength ?? "\u0000", spokenStrength(med))}.`];
  if (med.indication) parts.push(`Wofür: ${med.indication.de}.`);
  const w = whenText(med);
  if (w) parts.push(`Einnehmen: ${w}.`);
  if (med.schedule?.note) parts.push(`Hinweis: ${med.schedule.note}.`);
  if (med.extra) parts.push(`${med.extra}.`);
  return parts.join(" ");
}

/** "eine Tablette", "eine halbe Tablette", "zwei Kapseln" – spelled out for the voice. */
export function spokenCount(a, look, unit = null) {
  if (unit && unit !== "Stück") return `${german(a)} ${unit}`;
  if (!look) return amountText(a).replace(/^eine\b/, "ein") + " Stück";
  const capsule = ["capsule", "softgel"].includes(look.shape);
  const noun = capsule ? (a > 1 ? "Kapseln" : "Kapsel") : (a > 1 ? "Tabletten" : "Tablette");
  return `${amountText(a)} ${noun}`;
}

/** "weiß und rund", "hellblau und weiß" (capsule: the unit already says Kapsel). Colour and shape only, to keep it short. */
export function spokenLook(look) {
  if (!look) return null;
  const words = [look.colorName?.de, look.color2Name?.de].filter((x) => x);
  const form = { round: "rund", oval: "oval", softgel: "oval", oblong: "länglich", heart: "herzförmig" }[look.shape];
  if (form) words.push(form);
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} und ${words.at(-1)}` : (words[0] ?? "");
}

/** "Heute Abend", "Heute früh, schon vorbei", "Zur Nacht, seit gestern Abend" – never "Morgen" for a slot of today (T-06). */
export function spokenWhen(slot, { past = false, lastNight = false } = {}) {
  if (lastNight) return "Zur Nacht, seit gestern Abend";
  const when = { morning: "Heute früh", noon: "Heute Mittag", evening: "Heute Abend" }[slot] ?? "Heute zur Nacht";
  return past ? `${when}, schon vorbei` : when;
}

/** Shown and spoken with the day list: the app never knows what was taken. */
export const NOT_RECORDED = "Die App merkt sich nicht, was Sie schon genommen haben.";

const COUNT_WORDS = ["", "Ein", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn", "Elf", "Zwölf"];
export const medCount = (n) => (n === 1 ? "Ein Medikament" : `${COUNT_WORDS[n] ?? n} Medikamente`);

/**
 * The day plan read aloud in plain sentences (fixed templates over plan data, INV-12), one line per pill, ending with the
 * line that the app records no intake: "Jetzt, heute Abend. Zwei Medikamente." · "Ramipril, eine Tablette, weiß und rund." ·
 * "Heute früh, schon vorbei. …"
 * Same text as Day.spokenLines on iPhone.
 */
export function spokenLines(secs) {
  if (!secs.length) return ["Auf Ihrem Plan steht noch nichts."];
  const join = (parts) => parts.filter((x) => x).join(", ") + ".";
  const name = (m) => m.substance ?? m.name;
  const lines = [];
  for (const s of secs) {
    if (s.kind === "slot") {
      const when = spokenWhen(s.slot, s);
      lines.push(`${s.now ? `Jetzt, ${when[0].toLowerCase()}${when.slice(1)}` : when}. ${medCount(s.entries.length)}.`);
      for (const e of s.entries) lines.push(join([name(e.med), e.amount != null ? spokenCount(e.amount, e.med.look, e.med.schedule?.unit) : e.med.schedule?.kind === "daily" ? "Menge nicht angegeben" : null, spokenLook(e.med.look), e.weekly ? "nur einmal pro Woche" : null]));
    } else if (s.kind === "weeklyToday") {
      lines.push("Heute außerdem, nur einmal pro Woche.");
      for (const e of s.entries) lines.push(join([name(e.med), spokenLook(e.med.look)]));
    } else if (s.kind === "weeklyLater") {
      lines.push("Einmal pro Woche.");
      for (const e of s.entries) {
        const day = e.med.schedule?.days?.[0];
        const next = e.next ? `nächster ${dayName(day)}, ${e.next.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}` : null;
        lines.push(join([name(e.med), next, spokenLook(e.med.look)]));
      }
    } else if (s.kind === "text") {
      lines.push("Nach besonderem Schema, so wie es auf dem Plan steht.");
      for (const e of s.entries) lines.push(join([name(e.med), e.med.schedule?.text ? `laut Plan: ${e.med.schedule.text}` : "Dosierung steht nicht auf dem Plan"]));
    } else {
      lines.push("Nur bei Bedarf.");
      for (const e of s.entries) {
        const t = e.med.schedule?.text;
        lines.push(join([name(e.med), spokenLook(e.med.look), t && t.toLowerCase() !== "bei bedarf" ? t : null]));
      }
    }
  }
  lines.push(NOT_RECORDED);
  return lines;
}

export const capitalizedFirst = (s) => s.slice(0, 1).toUpperCase() + s.slice(1);

/** One row of the official PZN list (BfArM Festbetrag list): [name, substance, form, pack size]. */
export function pznName(names, pzn) {
  const r = names?.[pzn];
  return r ? { name: r[0], substance: r[1], form: r[2], packSize: r[3] } : null;
}

/** Strength from the official name ("ASPIRIN N 100MG" → "100 mg"); null when the name states none. */
export function nameStrength(n) {
  if (!n) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*(MG|UG|MCG|µG|G|IE)\b/.exec(n.name);
  if (!m) return null;
  const unit = m[2].toLowerCase().replaceAll("mcg", "µg").replaceAll("ug", "µg");
  return `${m[1]} ${unit}`;
}
