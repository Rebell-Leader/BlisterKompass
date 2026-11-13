// Ranks pills by look against the user's plan – entirely on the phone. Port of ios/PillSnap/Matcher.swift.
// Deterministic scorer, reduced to what a photo can show.
//
// PillCues { found, colors: [code], shape?, imprint?, size?, score?: bool, finish?, seenHex: [hex] }
// Answer   { source, state: sure|likely|choose|other_maker|other_strength|not_on_plan|unknown|retake|need_plan|not_a_plan,
//            candidates, notOnPlan, question, problem }
// A look never proves identity (INV-15): every state is a candidate to check, and the score is a heuristic, not a probability.

import { SLOTS, colorText, hasScore, shapeName } from "./model.js";
import { norm } from "./pack-code.js";

const WEIGHT = { imprint: 5.0, color: 3.0, shape: 2.5, size: 1.5, score: 1.5, finish: 0.5 };

const COLOR_PAIRS = {
  "white|offwhite": 0.7, "white|beige": 0.3, "offwhite|beige": 0.7, "lightyellow|yellow": 0.7,
  "lightyellow|offwhite": 0.5, "lightyellow|beige": 0.4, "yellow|orange": 0.4, "pink|red": 0.6, "pink|orange": 0.3,
  "red|orange": 0.4, "red|brown": 0.3, "brown|beige": 0.3,
};
const SHAPE_PAIRS = {
  "oval|oblong": 0.6, "round|oval": 0.3, "capsule|oblong": 0.1, "softgel|oval": 0.5, "softgel|capsule": 0.5, "heart|round": 0.2,
};

/** 1 = same, table value = similar, -1 = clearly different. */
const sim = (table, a, b) => (a === b ? 1 : table[`${a}|${b}`] ?? table[`${b}|${a}`] ?? -1);

export function sizeClass(look) {
  const d = Math.max(look.lengthMm ?? 0, look.widthMm ?? 0);
  return d <= 8.5 ? "small" : d < 13 ? "medium" : "large";
}

const alnum = (s) => [...s].filter((ch) => /[\p{L}\p{N}]/u.test(ch));

/** OCR (or a typed imprint) mixes up look-alike glyphs on embossed pills (I400 → 1400, O → 0). */
export function ocrVariants(text, max = 64) {
  const lookalike = { 1: ["1", "i", "l"], i: ["i", "1", "l"], l: ["l", "1", "i"], 0: ["0", "o"], o: ["o", "0"], 5: ["5", "s"], s: ["s", "5"], 8: ["8", "b"], b: ["b", "8"] };
  let out = [""];
  for (const ch of alnum(text.toLowerCase())) {
    out = out.flatMap((p) => (lookalike[ch] ?? [ch]).map((c) => p + c)).slice(0, max);
  }
  return new Set(out);
}

export function score(med, cues) {
  const look = med.look;
  let got = 0, possible = 0;
  const add = (w, v) => { possible += w; got += w * v; };

  if (cues.imprint) {
    const own = alnum((look.imprint ?? "").toLowerCase()).join("");
    const hit = own !== "" && ocrVariants(cues.imprint).has(own);
    add(WEIGHT.imprint, hit ? 1 : -0.5);
  }
  if (cues.colors?.length) add(WEIGHT.color, colorFit(look, cues));
  if (cues.shape != null) add(WEIGHT.shape, sim(SHAPE_PAIRS, cues.shape, look.shape));
  if (cues.size != null) {
    const order = ["small", "medium", "large"];
    const idx = (s) => (order.indexOf(s) < 0 ? 1 : order.indexOf(s));
    const d = Math.abs(idx(cues.size) - idx(sizeClass(look)));
    add(WEIGHT.size, d === 0 ? 1 : d === 1 ? 0 : -1);
  }
  if (cues.score != null) add(WEIGHT.score, hasScore(look) === cues.score ? 1 : -1);
  if (cues.finish != null) add(WEIGHT.finish, look.finish === cues.finish ? 1 : -0.5);
  return { med, score: got, match: possible > 0 ? Math.max(0, got) / possible : 0 };
}

/** How well the photo's colours fit a look: 1 = same, table value = similar, -1 = clearly different. */
function colorFit(look, cues) {
  if (!cues.colors?.length) return 1;
  const halves = [look.color, look.color2].filter((x) => x != null);
  return cues.colors.map((c) => Math.max(...halves.map((h) => sim(COLOR_PAIRS, c, h)), -1)).reduce((a, b) => a + b, 0) / cues.colors.length;
}

/** Same strength, as far as both state one ("7,5 mg" = "7.5mg"). Unknown is never the same. */
export const sameStrength = (a, b) => a?.strength != null && b?.strength != null && norm(a.strength) === norm(b.strength);

/** Candidates count: the choose screen shows at most this many. */
export const MAX_CANDIDATES = 6;

export function rank(meds, cues) {
  const results = meds.map((m) => score(m, cues)).sort((a, b) => (a.score !== b.score ? b.score - a.score : b.match - a.match));
  const top = results[0];
  if (!top || top.score <= 0) return { results, close: [] };
  return { results, close: results.filter((s) => s.score > 0 && s.match >= top.match - 0.15) };
}

export const local = (state, candidates = [], problem = null) =>
  ({ source: "phone", state, candidates, notOnPlan: null, question: null, problem });

/** The answer the app shows. Only the user's plan counts as "yours"; the catalog is used to warn
 *  when a pill fits something NOT on the plan. */
export function answer(myMeds, catalog, cues) {
  // Only plan entries with a known look can match a photo; the others stay "Aussehen unbekannt" (INV-05).
  const own = rank(myMeds.filter((m) => m.look), cues);
  // Without a read imprint and without a measured size, colour and shape can't tell look-alikes apart (four white pills on
  // plan A). Every plan pill whose colour fits and whose shape isn't clearly different stays a candidate, so the person
  // chooses instead of the app picking one (T-05).
  const unreadNoSize = (cues.imprint ?? "") === "" && cues.size == null;
  const close = unreadNoSize
    ? own.results.filter((s) => own.close.includes(s) || (s.score > 0 && colorFit(s.med.look, cues) >= 0.7 && (cues.shape == null || sim(SHAPE_PAIRS, cues.shape, s.med.look.shape) > 0)))
    : own.close;
  let state, candidates;
  if (close.length === 0) { state = "unknown"; candidates = []; }
  else if (close.length === 1) {
    // Colour and shape alone never make it "sure" when the pill carries an imprint nobody read.
    const unread = (close[0].med.look.imprint ?? "") !== "" && (cues.imprint ?? "") === "";
    state = close[0].match >= 0.75 && !unread ? "sure" : "likely";
    candidates = [close[0].med];
  } else { state = "choose"; candidates = close.map((s) => s.med); }
  let notOnPlan = null;

  // Something not on the plan fits clearly better → warn. Near-ties: a different maker of a plan drug with the plan's
  // strength (pharmacy switch) first, German-market products before US reference data.
  const onPlan = new Set(myMeds.map((m) => m.pzn));
  const other = rank(catalog.filter((m) => !onPlan.has(m.pzn) && !(m.pzns ?? []).some((p) => onPlan.has(p))), cues).results;
  const ownTop = state === "unknown" ? 0 : own.results[0].match;
  const top = other[0];
  if (top) {
    const ties = other.filter((s) => s.score > 0 && s.match >= top.match - 0.05);
    const mine = (s) => myMeds.some((m) => m.substance === s.med.substance);
    const mineSame = (s) => myMeds.some((m) => m.substance === s.med.substance && sameStrength(m, s.med));
    const german = (s) => s.med.market !== "US";
    const best = ties.find((s) => mineSame(s) && german(s)) ?? ties.find(mineSame)
      ?? ties.find((s) => mine(s) && german(s)) ?? ties.find(mine) ?? ties.find(german) ?? top;
    if (best.score > 0 && best.match >= 0.7 && best.match > ownTop + 0.1) {
      notOnPlan = best.med;
      // Only the same substance with the same strength can be a switch of maker (T-04). A different or unknown strength,
      // or a shared ATC code alone, stays unresolved: "other_strength" shows the look-alike's own title, never the plan's.
      const same = myMeds.find((x) => x.substance === best.med.substance && sameStrength(x, best.med));
      const related = myMeds.find((x) => x.substance === best.med.substance) ?? myMeds.find((x) => x.atc && x.atc === best.med.atc);
      if (same) { state = "other_maker"; candidates = [same]; }
      else if (related) { state = "other_strength"; candidates = [related]; }
      else { state = "not_on_plan"; candidates = []; }
    }
  }
  return {
    source: "phone", state, candidates: candidates.slice(0, MAX_CANDIDATES), notOnPlan,
    question: state === "choose" ? question(close.map((s) => s.med), cues) : null, problem: null,
  };
}

// The one question that best splits the remaining candidates.

const SLOT_WORDS = { morning: "morgens", noon: "mittags", evening: "abends", night: "zur Nacht" };
const QUESTIONS = [
  { key: "score", text: "Hat die Tablette eine Kerbe oder einen Strich?", value: (m) => (hasScore(m.look) ? "ja" : "nein") },
  {
    key: "time", text: "Wann nehmen Sie sie – morgens, mittags, abends oder zur Nacht?", value: (m) => {
      const s = m.schedule;
      if (!s) return "—";
      if (s.kind === "prn") return "bei Bedarf";
      if (s.kind === "weekly") return "1× pro Woche";
      return SLOTS.filter((x) => s.slots.includes(x.id)).map((x) => SLOT_WORDS[x.id]).join(" + ");
    },
  },
  { key: "colors", text: "Welche Farbe hat sie genau?", value: (m) => colorText(m.look) },
  { key: "shape", text: "Ist sie rund, oval oder eher länglich?", value: (m) => shapeName(m.look.shape) },
  { key: "size", text: "Ist sie eher klein (wie eine Linse) oder groß?", value: (m) => ({ small: "klein", medium: "mittel", large: "groß" })[sizeClass(m.look)] ?? "" },
  { key: "purpose", text: "Wissen Sie, wofür Sie sie nehmen?", value: (m) => m.indication?.de ?? "—" },
];

/** Question { key, question, answers: [{ answer, meds: [substance] }] } or null. */
export function question(close, cues) {
  if (close.length <= 1) return null;
  const asked = new Set();
  if (cues.colors?.length) asked.add("colors");
  if (cues.shape != null) asked.add("shape");
  if (cues.score != null) asked.add("score");
  const n = close.length;
  let best = null, bestGain = -Infinity;
  for (const q of QUESTIONS) {
    if (asked.has(q.key)) continue;
    const groups = [];
    for (const m of close) {
      const v = q.value(m);
      const g = groups.find((x) => x.answer === v);
      if (g) g.meds.push(m.substance); else groups.push({ answer: v, meds: [m.substance] });
    }
    if (groups.length <= 1) continue;
    const entropy = groups.reduce((e, g) => { const p = g.meds.length / n; return e - p * Math.log2(p); }, 0);
    const gain = entropy * (q.key === "purpose" ? 0.6 : 1);
    if (gain > bestGain) { bestGain = gain; best = { key: q.key, question: q.text, answers: groups }; }
  }
  return best;
}
