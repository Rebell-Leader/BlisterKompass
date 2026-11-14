// "Plan drucken": the list on the phone as the companion sheet "Meine Medikamente mit Bildern" (A4 landscape, laid out in mm),
// after docs/PRD-print-sheet.md. It goes with the physician's Medikationsplan and never replaces it:
//   - not titled "Medikationsplan", no BMP 2D code (a code built from the phone's list would read as a professional plan;
//     docs/DECISIONS.md D-09), no name or birth date (the "für" line is filled in by hand);
//   - rows in plan order with a number, time of day in words, the plan's dose notation, unit, reason and notes as written;
//   - the picture, the same picture enlarged and the description with source ("Aussehen") in separate columns; true size
//     only when the source gives millimetres (the picture says "echte Größe"), otherwise "nicht maßstäblich" and
//     "Größe unbekannt", no enlargement; no look → grey outline and "Aussehen unbekannt – bitte Apotheke fragen";
//   - fixed-rule extras next to the plan's note, never instead of it: weekly day tag, meal tag, look-alike line;
//   - large print (≥ 12 pt body, 14–18 pt names and doses, nothing below 9 pt), black on white, pages split by measuring
//     (no row cut off; ROWS per page where nothing can be measured), header on every page, 5 cm control bar.

import { h, svg, pillSVG, medForm } from "./ui.js";
import { SLOTS, SLOT_ORDER, dayName, doseSymbol, sourceText, colorText, hasScore, shapeName } from "./model.js";
import { doseForm } from "./dose-form.js";
import { icon } from "./icons.js";
import * as Bmp from "./bmp-writer.js";

export const ROWS = 6;

/** What a pill looks like in words, in cue order: size → shape → score line → imprint → colour ("7 mm · rund · Kerbe · „T10“ · weiß"). */
export function describe(look) {
  if (!look) return null;
  const L = look.lengthMm, W = look.widthMm;
  const size = L ? (W && W !== L ? `${mm(L)} × ${mm(W)} mm` : `${mm(L)} mm`) : null;
  const shape = look.shape === "heart" ? "herzförmig" : look.shape === "softgel" ? "Weichkapsel" : shapeName(look.shape);
  return [size, shape, hasScore(look) ? "Kerbe" : null, look.imprint ? `„${look.imprint}“` : null, colorText(look) || null].filter(Boolean).join(", ");
}
const mm = (v) => String(v).replace(".", ",");
/** True size needs the length, and for anything not round also the width (G §5.5: never a default size). */
export const trueSize = (look) => !!look?.lengthMm && (look.shape === "round" || !!look.widthMm);

/** Rows of the sheet from the list on the phone: plan order, as-needed in their own block. */
export function rows(store) {
  const row = (m) => {
    const s = m.schedule;
    let doses = null, free = null, when = null;
    if (s?.kind === "daily" || (s?.kind === "weekly" && s.slots?.length)) {
      // A slot on the plan without an amount prints "?" (amount not given), never "0" or a default.
      doses = SLOT_ORDER.map((id) => (s.amounts?.[id] ? doseSymbol(s.doses?.[id], s.amounts[id]) : (s.slots ?? []).includes(id) ? "?" : "0"));
      if (s.kind === "weekly") when = `nur ${s.days?.[0] ? dayName(s.days[0]).toLowerCase() + "s" : "einmal pro Woche"} · 1× pro Woche`;
    } else if (s?.kind === "weekly") free = `1× pro Woche${s.days?.[0] ? ", " + dayName(s.days[0]) : ""}${s.text ? " · " + s.text : ""}`;
    else if (s?.kind === "prn") free = s.text && s.text.toLowerCase() !== "bei bedarf" ? `bei Bedarf · ${s.text}` : "bei Bedarf";
    else if (s?.kind === "text") free = s.text ? `laut Plan: ${s.text}` : "Dosierung steht nicht auf dem Plan";
    else free = "siehe Plan Ihrer Praxis";
    const look = m.look ?? null;
    return {
      look, form: look ? null : medForm(m), describe: describe(look), trueSize: trueSize(look), source: look ? sourceText(look) : null,
      substance: m.substance ?? m.name ?? "", strength: m.strength ?? "", brand: m.nameOnly ? null : (m.name && m.name !== m.substance ? m.name : null),
      doses, free, when, unit: s?.unit && s.unit !== "Stück" ? s.unit : null, reason: m.indication?.de ?? "",
      note: [s?.note, m.extra].filter(Boolean).join(" · "), section: m.sectionLabel ?? null, meal: Bmp.scheduleMeal(s),
    };
  };
  const unknown = store.unknownPZNs.map((pzn) => {
    const n = store.pznName(pzn);
    return { look: null, form: doseForm(n?.form), describe: null, trueSize: false, source: null, substance: n?.substance || store.nameOf(pzn),
      strength: "", brand: n?.name ?? `PZN ${pzn}`, doses: null, free: "siehe Plan Ihrer Praxis", when: null, unit: null, reason: "", note: "", section: null };
  });
  const main = [...store.myMeds.filter((m) => m.schedule?.kind !== "prn").map(row), ...unknown];
  const prn = store.myMeds.filter((m) => m.schedule?.kind === "prn").map(row);
  let nr = 0;
  const all = [...main, ...prn];
  for (const r of all) r.nr = ++nr;
  // look-alikes by the fixed rule: the numbers of the other rows this tablet is easily confused with
  for (const r of all) r.alike = r.look ? all.filter((o) => o !== r && o.look && lookAlike(r.look, o.look)).map((o) => o.nr) : [];
  return { main, prn };
}

/** The pill at true size (pillSVG in 0.1 mm units, sized in mm), or at a fixed schematic size when no size is known. */
function pillPicture(look, exact) {
  const el = pillSVG(look, 10);
  const w = Number(el.getAttribute("width")) / 10, hgt = Number(el.getAttribute("height")) / 10;
  const k = exact ? 1 : 12 / Math.max(w, hgt);
  el.setAttribute("width", `${w * k}mm`);
  el.setAttribute("height", `${hgt * k}mm`);
  return el;
}

function unknownOutline(form) {
  const dash = { fill: "none", stroke: "#111", "stroke-width": 0.35, "stroke-dasharray": "1 .8" };
  return svg("svg", { viewBox: "0 0 14 11", width: "12mm", height: "9.5mm", role: "img", "aria-label": form ? `${form.label}, Aussehen unbekannt` : "Aussehen unbekannt" },
    form?.family === "capsule" ? svg("rect", { x: 1, y: 3, width: 12, height: 5, rx: 2.5, ...dash }) : svg("circle", { cx: 7, cy: 5.5, r: 4.5, ...dash }));
}

/** The look in words for older readers, most visible first: colour and shape, then imprint and score line, then size. */
export function lookLines(look) {
  if (!look) return null;
  const shape = look.shape === "heart" ? "herzförmig" : look.shape === "softgel" ? "Weichkapsel" : shapeName(look.shape);
  const L = look.lengthMm, W = look.widthMm;
  return {
    main: [colorText(look), shape].filter(Boolean).join(", "),
    marks: [look.imprint ? `„${look.imprint}“` : null, hasScore(look) ? "Kerbe" : null].filter(Boolean).join(" · "),
    size: L ? (W && W !== L ? `${mm(L)} × ${mm(W)} mm` : `${mm(L)} mm`) : null,   // never split a size
  };
}

// Three cells: the tablet as drawn (true size only when the source gives mm), the same tablet enlarged (imprint
// readable, only for a known size), then the written description. Each picture says itself whether it is true size.
function lookCells(r, showSource = true) {
  if (!r.look) {
    return [h("td.ps-pic", null, unknownOutline(r.form)), h("td.ps-big"),
      h("td.ps-desc", null, h("strong", null, "Aussehen unbekannt – bitte Apotheke fragen"), r.form ? h("div", null, r.form.label) : null)];
  }
  const w = lookLines(r.look);
  const second = [w.marks, r.trueSize ? w.size : null].filter(Boolean).join(" · ");
  return [h("td.ps-pic", null, pillPicture(r.look, r.trueSize), h("div.ps-scale", null, r.trueSize ? "echte Größe" : "nicht maßstäblich")),
    h("td.ps-big", null, r.trueSize ? enlarged(r.look) : null),
    h("td.ps-desc", null, h("div.ps-look-main", null, w.main), second ? h("div", null, second) : null,
      r.trueSize ? null : h("div.ps-size", null, "Größe unbekannt"),
      r.source && showSource ? h("div.ps-src", null, r.source) : null)];
}

function tr(r, showSource = true) {
  return h("tr", null,
    h("td.ps-nr", null, String(r.nr)),
    ...lookCells(r, showSource),
    h("td.ps-med", null,
      h("div", null, h("span.ps-sub", null, r.substance), r.strength ? h("span.ps-str", null, ` ${r.strength}`) : null),
      r.brand ? h("div.ps-brand", null, r.brand) : null,
      r.section ? h("div.ps-brand", null, r.section) : null),
    // the plan's dose notation as written, "0" included as on the BMP (set lighter, so the times to take something stand out)
    r.doses ? r.doses.map((d) => (d === "0" ? h("td.ps-n.ps-zero", null, "0")
      : h("td.ps-n", null, d, r.unit ? h("span.ps-unit", null, ` ${r.unit}`) : null)))
      : h("td.ps-free", { colspan: 4 }, r.free, r.unit ? h("span.ps-unit", null, ` (${r.unit})`) : null),
    h("td.ps-reason", null, r.reason),
    // weekly label ("nur montags", black) and meal label first – both extras by fixed rules –, then the plan's note as written (INV-12)
    h("td.ps-note", null, r.when ? h("div", null, h("span.ps-day-tag", null, r.when.split(" · ")[0])) : null,
      r.meal ? h("div", null, mealTag(r.meal)) : null, r.note,
      r.alike?.length ? h("div.ps-alike", null, `Sieht aus wie Nr. ${r.alike.join(", ")} – auf den Aufdruck achten`) : null));
}

const slotWord = (slot) => (slot.id === "night" ? "zur Nacht" : slot.label.toLowerCase());   // as in the sheet header

// One colour and one drawn icon per meal label on paper (see .ps-meal.m-* in app.css; the app screens keep Bmp.MEAL's icons).
const MEAL_ICON = { fasting: "mealFasting", before: "mealBefore", with: "mealWith", after: "mealAfter" };
const mealTag = (key) => (key ? h(`span.ps-meal.m-${key}`, null, icon(MEAL_ICON[key]), Bmp.MEAL[key].label) : null);

const listItems = ({ main, prn }) => [...main.map((r) => ({ r })), ...(prn.length ? [{ heading: "Bei Bedarf" }, ...prn.map((r) => ({ r }))] : [])];

/** Fallback when nothing can be measured: at most ROWS items per page; a heading never stays alone at the bottom. */
export function pageRows(data) {
  const pages = [];
  let page = [];
  for (const x of listItems(data)) {
    if (page.length === ROWS || (x.heading && page.length === ROWS - 1)) { pages.push(page); page = []; }
    page.push(x);
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

/**
 * Splits items over pages by measuring them, so no row is ever cut off at the bottom of the paper: each page takes items
 * while the laid-out sheet still fits its 210 mm (a tall row – long Hinweis, long name – simply moves to the next page).
 * keepWithNext(item) keeps an item (a block heading) off the end of a page; at most `limit` items per page (PRD PS-21:
 * fewer rows rather than smaller type). Returns null where nothing can be measured (no layout, e.g. Node tests); callers
 * then fall back to pageRows.
 */
export function fillPages(items, build, keepWithNext = () => false, limit = Infinity) {
  if (typeof document === "undefined" || !document.body) return null;
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none";
  document.body.append(host);
  const overflows = (chunk) => {
    host.replaceChildren(build(chunk));
    const s = host.firstElementChild;
    return s.scrollHeight > s.clientHeight + 1;
  };
  try {
    host.replaceChildren(build([]));
    if (!(host.firstElementChild?.clientHeight > 0)) return null;   // not laid out: can't measure
    const pages = [];
    let start = 0;
    while (start < items.length) {
      let end = start + 1;                                            // at least one item per page
      while (end < items.length && end - start < limit && !overflows(items.slice(start, end + 1))) end++;
      while (end - start > 1 && end < items.length && keepWithNext(items[end - 1])) end--;
      pages.push(items.slice(start, end));
      start = end;
    }
    return pages.length ? pages : [[]];
  } finally {
    host.remove();
  }
}

/** All pages of the sheet (297 × 210 mm each). Every row of the list is on a page, none cut off. */
export function pages(data, printedOn = new Date()) {
  const date = printedOn.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const chunks = fillPages(listItems(data), (chunk) => listSheet(chunk, 0, 9, date), (x) => !!x.heading, ROWS) ?? pageRows(data);
  return chunks.map((chunk, i) => listSheet(chunk, i, chunks.length, date));
}

/** One list page: header, table with the rows of this page, footer. */
function listSheet(chunk, i, count, date) {
  // Provenance stays visible: one source for every picture on the page → said once in the footer, else per row.
  const sources = new Set(chunk.filter((x) => x.r?.source).map((x) => x.r.source));
  const oneSource = sources.size === 1 ? [...sources][0] : null;
  return h("div.ps-sheet", { lang: "de" },
    h("header.ps-head", null,
      h("div.ps-headbrand", null, h("img.ps-mascot", { src: "icons/mascot-wave.png", alt: "" }),
        h("div", null, h("div.ps-title", null, "Meine Medikamente mit Bildern"), h("div.ps-page", null, `Stand ${date} · Seite ${i + 1} von ${count}`))),
      h("div", null,
        h("div.ps-for", null, h("span", null, "für:"), h("span.ps-write")),
        h("div.ps-belongs", null, "Gehört zu Ihrem Medikationsplan. Maßgeblich ist der Plan Ihrer Praxis."),
        h("div", null, "Fragen? Sagen Sie am Telefon die Nummer aus der ersten Spalte.")),
      h("div.ps-nocode", null, "Kein 2D-Code: Den Medikationsplan mit Code bekommen Sie in Ihrer Praxis oder Apotheke.")),
    h("table.ps-table", null,
      h("colgroup", null, ["nr", "pic", "big", "desc", "med", "n", "n", "n", "n", "reason", "note"].map((c) => h(`col.ps-c-${c}`))),
      h("thead", null, h("tr", null,
        h("th.ps-center", null, "Nr."), h("th.ps-center", null, "Bild"),
        h("th.ps-center.ps-th-pic", null, "Bild", h("small", null, "vergrößert")), h("th", null, "Aussehen"), h("th", null, "Medikament"),
        SLOTS.map((s) => h("th.ps-slot", null, h("span.ps-slot-ic", { style: { color: s.hex } }, icon(s.icon)), h("div", null, slotWord(s)))),
        h("th", null, "Wofür"), h("th", null, "Hinweise"))),
      h("tbody", null, chunk.map((x) => (x.heading ? h("tr.ps-sec", null, h("td", { colspan: 11 }, x.heading)) : tr(x.r, !oneSource))))),
    h("footer.ps-foot", null,
      h("p", null, `Seite ${i + 1} von ${count}${oneSource ? ` · ${oneSource}` : ""} · erstellt mit ${Bmp.ISSUER} · Demo, synthetische Daten · kein ärztlicher Plan nach § 31a SGB V`),
      h("p", null, "Nach einem Herstellerwechsel kann ein Medikament anders aussehen. Ob eine neue Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke."),
      h("div.ps-bar-row", null, h("span.ps-bar"), h("span", null, "Dieser Strich ist 5 cm lang. Ist er kürzer, wurde verkleinert gedruckt und die Größen stimmen nicht."))));
}

// Look-alikes and the enlarged picture -------------------------------------------------------------------------------
// Fixed rules only, no model. Identity stays the pack and the plan (INV-15): a look-alike note only says "check the imprint".

const shapeFamily = (s) => (s === "oblong" ? "oval" : s);   // oval and oblong are easily confused

/** Fixed look-alike rule: same colour(s), same shape family, lengths within 1.5 mm (or a length unknown). */
export function lookAlike(a, b) {
  if (a.color !== b.color || (a.color2 ?? null) !== (b.color2 ?? null) || shapeFamily(a.shape) !== shapeFamily(b.shape)) return false;
  return !a.lengthMm || !b.lengthMm || Math.abs(a.lengthMm - b.lengthMm) <= 1.5;
}

/**
 * The pill enlarged so its imprint can be read: up to 2.2×, at most 25 mm long and 13 mm high, so the row keeps its
 * height. Only for a pill whose size is known – an unknown size has nothing true to enlarge.
 */
function enlarged(look) {
  const k = Math.min(2.2, 25 / (look.lengthMm || 12), 13 / (look.widthMm || look.lengthMm || 12));
  const el = pillPicture(look, true);
  for (const a of ["width", "height"]) el.setAttribute(a, `${parseFloat(el.getAttribute(a)) * k}mm`);
  return el;
}

/** First page only (preview, full screen). */
export const sheet = (data, printedOn = new Date()) => pages(data, printedOn)[0];
