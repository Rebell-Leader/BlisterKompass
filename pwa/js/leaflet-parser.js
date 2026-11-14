// Package leaflet text → pill look, with fixed rules (no model, no guessing).
// Port of ios/PillSnap/LeafletParser.swift (same rules as tools/fetch-leaflet-looks.py): reads section 6
// ("Wie … aussieht und Inhalt der Packung"), picks the sentence for our strength and takes colour, shape, score line,
// imprint and size from it. If the text describes another strength, several colours or no shape, the result is null:
// unknown stays unknown (INV-05).
//
// JS note: `\w` is ASCII-only in JS even with the `u` flag, so the Swift patterns' `\w` is written as W below.

const W = "[\\p{L}\\p{N}_]";

const COLOR_WORDS = [   // longest first; codes = recognizer palette
  ["hellgelb", "lightyellow"], ["blassgelb", "lightyellow"], ["gelblich", "lightyellow"], ["cremefarben", "offwhite"],
  ["cremeweiß", "offwhite"], ["gebrochen weiß", "offwhite"], ["altweiß", "offwhite"], ["weißlich", "white"],
  ["weiß", "white"], ["gelb", "yellow"], ["orange", "orange"], ["rosa", "pink"], ["pink", "pink"], ["rot", "red"],
  ["blau", "blue"], ["grün", "green"], ["braun", "brown"], ["beige", "beige"], ["lila", "purple"], ["violett", "purple"],
];

export const PALETTE = {
  white: ["#FBFBF8", "white", "weiß"], offwhite: ["#F1EBDD", "off-white", "cremeweiß"],
  lightyellow: ["#F6EAA8", "light yellow", "hellgelb"], yellow: ["#F2CC3D", "yellow", "gelb"],
  orange: ["#F0954A", "orange", "orange"], pink: ["#F2B8C3", "pink", "rosa"], red: ["#C9483F", "red", "rot"],
  blue: ["#7EA6D8", "blue", "blau"], green: ["#86C49A", "green", "grün"], brown: ["#9E7152", "brown", "braun"],
  beige: ["#E6D5B4", "beige", "beige"], purple: ["#B497D6", "purple", "lila"],
};
const hex = (c) => PALETTE[c][0];
const localName = (c) => ({ de: PALETTE[c][2], en: PALETTE[c][1] });

/** Capture group 1 of every match (groups = 1), or groups 1…n of the first match ([] if none). */
export function matches(pattern, s, flags = "", groups = 1) {
  const re = new RegExp(pattern, `${flags}gu`);
  if (groups === 1) return [...s.matchAll(re)].map((m) => m[1]).filter((x) => x != null);
  const m = re.exec(s);
  return m ? m.slice(1, groups + 1).filter((x) => x != null) : [];
}

export function flatten(s) {
  return s.replaceAll("­", "")
    .replace(new RegExp(`(${W}) (ße|ä|ö|ü)`, "gu"), "$1$2")     // "wei ße" → "weiße"
    .replace(new RegExp(`(${W})- (${W})`, "gu"), "$1$2")         // "Film- tabletten"
    .replace(/\s+/gu, " ");
}

export function section6(t) {
  const re = /Wie (?:sieht |sehen )?.{0,120}? ?aus(?:sieht|sehen)? und (?:was )?(?:der )?Inhalt der Packung(?: ist)?\??(.{20,900}?)(?:Pharmazeutischer Unternehmer|Inhaber der Zulassung|Zulassungsinhaber|Hersteller|Diese Packungsbeilage)/gu;
  const all = [...t.matchAll(re)];
  return all.length ? all[all.length - 1][1].trim() : null;   // the last one: the index lists section 6 too
}

/** Colour codes in the order the text names them ("weiße bis gebrochen weiße" → white first). */
export function colors(s) {
  let low = s.toLowerCase();
  const found = [];
  for (const [word, code] of COLOR_WORDS) {
    let from = 0, i;
    while ((i = low.indexOf(word, from)) >= 0) { found.push([i, code]); from = i + word.length; }
    low = low.replaceAll(word, " ".repeat(word.length));
  }
  return found.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

/** "Kapseloberteil: hellblau. Kapselunterteil: weiß" → [body, cap] colours. */
export function capsuleHalves(s6) {
  const col = "((?:hell|dunkel)?(?:weiß|gelb|orange|rosa|rot|blau|grün|braun|beige|lila|violett))";
  const top = matches(`(?:Kapsel)?[Oo]berteil[^.]{0,40}?${col}`, s6, "i")[0];
  const bottom = matches(`(?:Kapsel)?[Uu]nterteil[^.]{0,40}?${col}`, s6, "i")[0];
  const t = top && colors(top)[0], b = bottom && colors(bottom)[0];
  return t && b ? [b, t] : null;
}

/** Start the quote at the product name or substance, so text from a neighbouring column is cut off. */
export function trimmed(sentence, subject) {
  const low = sentence.toLowerCase();
  const firstColour = Math.min(sentence.length, ...COLOR_WORDS.map(([w]) => low.indexOf(w)).filter((i) => i >= 0));
  const head = sentence.slice(0, firstColour);
  const starts = subject.filter((x) => x.length > 2).map((x) => head.lastIndexOf(x)).filter((i) => i >= 0);
  const s = starts.length ? Math.max(...starts) : 0;
  return s > 0 ? sentence.slice(s) : sentence;
}

const num = (x) => Number(x.replace(",", "."));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finish only when the leaflet says it ("glänzend", "matt"). A film or gelatin coating alone doesn't say how the surface
 *  looks, so it gives null: unknown stays unknown (INV-05). */
export function finishIn(text) {
  const low = text.toLowerCase();
  if (/glänzend/u.test(low)) return "glossy";
  if (/(?<!\p{L})matt(?:e|en|er|es)?(?!\p{L})/u.test(low)) return "matte";
  return null;
}

/** Section 6 → [look, quote], or null if it doesn't say it clearly. */
export function parseSection6(s6, strength, source, subject = []) {
  const halves = capsuleHalves(s6);
  if (halves) {
    const [body, cap] = halves;
    const two = cap !== body;
    const quote = matches("((?:Kapsel)?[Oo]berteil[^.]*\\.?\\s*(?:Kapsel)?[Uu]nterteil[^.]*)", s6)[0]
      ?? matches("((?:Kapsel)?[Uu]nterteil[^.]*\\.?\\s*(?:Kapsel)?[Oo]berteil[^.]*)", s6)[0] ?? s6;
    const look = { shape: "capsule", color: body, color2: two ? cap : null, lengthMm: null, widthMm: null, score: null, imprint: null,
      finish: finishIn(quote), colorHex: hex(body), color2Hex: two ? hex(cap) : null, colorName: localName(body),
      color2Name: two ? localName(cap) : null, source, leaflet: quote };
    return [look, quote];
  }
  const sentences = s6.split(/[.!]/u).map((x) => x.trim()).filter((x) => x);
  const looks = sentences.filter((x) => colors(x).length);
  const n = strength?.split(" ")[0] ?? null;
  const own = n ? looks.filter((x) => new RegExp(`(?<![\\d,])${escape(n)}\\s*(mg|µg|Mikrogramm)`, "iu").test(x)) : [];
  let candidates;
  if (own.length) candidates = own;
  else if (new Set(looks.map((x) => colors(x)[0])).size <= 1) candidates = looks;
  else return null;                                            // several strengths, several colours, ours not named
  const first = candidates[0];
  if (!first) return null;
  const named = matches("(\\d+(?:,\\d+)?)\\s*(?:mg|µg)", first);
  if (n && named.length && !named.includes(n)) return null;   // describes another strength
  const cols = colors(first);
  const color = cols[0];
  if (!color) return null;
  const low = first.toLowerCase();
  const capsule = low.includes("kapsel") && !low.includes("kapselförmig");
  let shape;
  if (capsule) shape = low.includes("weichkapsel") ? "softgel" : "capsule";
  else if (low.includes("rund")) shape = "round";
  else if (/oval|elliptisch|ellipsenförmig/u.test(low)) shape = "oval";
  else if (/länglich|oblong|kapselförmig|stäbchen/u.test(low)) shape = "oblong";
  else return null;
  let color2 = null;
  if (capsule && cols.length > 1 && cols[1] !== color) color2 = cols[1];
  else if (!capsule && new Set(cols).size > 1 && !/bis|gefleckt|gesprenkelt/u.test(low)) return null;
  const score = low.includes("kreuz") ? "cross" : /bruchkerbe|bruchrille|teilungsrille|kerbe|rille/u.test(low) ? "single" : null;
  const imprint = matches(`(?:prägung|aufdruck|kennung|beschriftung|bedruckt mit|eingeprägt${W}*)[^„"“]{0,40}[„"“]\\s*([^“"”]{1,12}?)\\s*[“"”]`, first, "i")[0] ?? null;
  let lengthMm = null, widthMm = null;
  const pair = matches("(\\d+(?:,\\d+)?)\\s*mm\\s*[x×]\\s*(\\d+(?:,\\d+)?)\\s*mm", first, "", 2);
  if (pair.length === 2) { lengthMm = num(pair[0]); widthMm = num(pair[1]); }
  else {
    const d = matches("[Dd]urchmesser (?:von )?(?:ca\\. )?(\\d+(?:,\\d+)?)\\s*mm", first)[0];
    if (d) { lengthMm = num(d); widthMm = lengthMm; }
  }
  const quote = `${trimmed(first, subject)}.`;
  const look = { shape, color, color2, lengthMm, widthMm, score, imprint, finish: finishIn(first),
    colorHex: hex(color), color2Hex: color2 ? hex(color2) : null, colorName: localName(color),
    color2Name: color2 ? localName(color2) : null, source, leaflet: quote };
  return [look, quote];
}

export function strengthIn(t) {
  const m = matches("enthält (?:jeweils )?(\\d+(?:,\\d+)?)\\s*(mg|µg|Mikrogramm)", t, "", 2);
  return m.length ? `${m[0]} ${m[1] === "Mikrogramm" ? "µg" : m[1]}` : null;
}

export const substanceIn = (t) => matches(`Der Wirkstoff ist ([A-ZÄÖÜ][${W.slice(1, -1)}\\-]+)`, t)[0] ?? null;

export const nameIn = (t) =>
  matches(`Information für (?:den )?(?:Anwender|Patienten)(?:innen)?\\s+(.{3,60}?)\\s+(?:Wirkstoff|Lesen|Zur Anwendung|Für Erwachsene|${W}+:)`, t, "i")[0] ?? null;

/** Whole leaflet text (from the PDF) → { name, substance, strength, look, quote }, or null if section 6 doesn't say it
 *  clearly. `known`: strength from the official PZN name, more reliable than the leaflet's "enthält …" line. */
export function parse(raw, source, known = null) {
  const text = flatten(raw);
  const s6 = section6(text);
  if (!s6) return null;
  const name = nameIn(text), substance = substanceIn(text);
  // Official name, then the product name in the leaflet ("Cefaclor STADA 500 mg"), then "enthält …".
  const fromName = name ? matches("(\\d+(?:,\\d+)?)\\s*(mg|µg|Mikrogramm)", name, "", 2) : [];
  const strength = known ?? (fromName.length ? `${fromName[0]} ${fromName[1] === "Mikrogramm" ? "µg" : fromName[1]}` : strengthIn(text));
  const r = parseSection6(s6, strength, source, [name?.split(" ")[0], substance].filter((x) => x != null));
  return r ? { name, substance, strength, look: r[0], quote: r[1] } : null;
}

/** Fallback link: the PZN's page at Apotheken Umschau (any slug redirects to the product; the PZN goes without leading
 *  zeros). It has the original PDF for only part of the packs. Only a link the person opens; the app fetches nothing. */
export function leafletPage(pzn) {
  if (!/^\d{8}$/.test(pzn ?? "")) return null;
  return `https://www.apotheken-umschau.de/medikamente/beipackzettel/pzn-${Number(pzn)}.html#pdf-dokumente`;
}

/** Main link: the leaflet PDF itself, as the iPhone app downloads it (LeafletParser.url). It had a PDF for every demo
 *  pack; Apotheken Umschau lacked one for 3 of 7 (e.g. Cefaclor STADA 500 mg, 08693497). */
export function leafletPdf(pzn) {
  if (!/^\d{8}$/.test(pzn ?? "")) return null;
  return `https://cdn.shop-apotheke.com/PDF/D${pzn.slice(0, 2)}/${pzn.slice(2, 5)}/${pzn.slice(5)}/D${pzn}-bp.pdf`;
}
