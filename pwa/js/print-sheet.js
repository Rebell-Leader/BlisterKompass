// "Plan drucken": the list on the phone as the companion sheet "Meine Medikamente mit Bildern" (A4 landscape, laid out in mm),
// after docs/PRD-print-sheet.md. It goes with the physician's Medikationsplan and never replaces it:
//   - not titled "Medikationsplan", no BMP 2D code (a code built from the phone's list would read as a professional plan;
//     docs/DECISIONS.md D-09), no name or birth date (the "für" line is filled in by hand);
//   - rows in plan order with a number, time of day in words, the plan's dose notation, unit, reason and notes as written;
//   - each picture with its description and source; true size only when the source gives millimetres, otherwise
//     "Größe unbekannt – nicht maßstäblich"; no look → grey outline and "Aussehen unbekannt – bitte Apotheke fragen";
//   - large print (≥ 12 pt body, 14–18 pt names and doses), black on white, at most ROWS rows per page, 5 cm control bar.

import { h, svg, pillSVG, medForm } from "./ui.js";
import { SLOTS, SLOT_ORDER, dayName, doseSymbol, sourceText, colorText, hasScore, shapeName } from "./model.js";
import { doseForm } from "./dose-form.js";

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
      doses = SLOT_ORDER.map((id) => (s.amounts?.[id] ? doseSymbol(s.doses?.[id], s.amounts[id]) : "0"));
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
      note: [s?.note, m.extra].filter(Boolean).join(" · "), section: m.sectionLabel ?? null,
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
  for (const r of [...main, ...prn]) r.nr = ++nr;
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

function lookCell(r) {
  if (!r.look) {
    return h("td.ps-look", null, h("div.ps-pic", null, unknownOutline(r.form)),
      h("div.ps-desc", null, h("strong", null, "Aussehen unbekannt – bitte Apotheke fragen"), r.form ? h("div", null, r.form.label) : null));
  }
  return h("td.ps-look", null, h("div.ps-pic", null, pillPicture(r.look, r.trueSize)),
    h("div.ps-desc", null, r.describe, h("div.ps-size", null, r.trueSize ? "Originalgröße" : "Größe unbekannt – nicht maßstäblich"),
      r.source ? h("div.ps-src", null, r.source) : null));
}

function tr(r) {
  return h("tr", null,
    h("td.ps-nr", null, String(r.nr)),
    lookCell(r),
    h("td.ps-med", null,
      h("div", null, h("span.ps-sub", null, r.substance), r.strength ? h("span.ps-str", null, ` ${r.strength}`) : null),
      r.brand ? h("div.ps-brand", null, r.brand) : null,
      r.when ? h("div.ps-when", null, r.when) : null,
      r.section ? h("div.ps-brand", null, r.section) : null),
    r.doses ? r.doses.map((d) => h("td.ps-n", null, d, d !== "0" && r.unit ? h("span.ps-unit", null, ` ${r.unit}`) : null))
      : h("td.ps-free", { colspan: 4 }, r.free, r.unit ? h("span.ps-unit", null, ` (${r.unit})`) : null),
    h("td.ps-reason", null, r.reason),
    h("td.ps-note", null, r.note));
}

const pageRows = ({ main, prn }) => {
  const all = [...main.map((r) => ({ r })), ...(prn.length ? [{ heading: "Bei Bedarf" }, ...prn.map((r) => ({ r }))] : [])];
  const pages = [];
  for (let i = 0; i < all.length; i += ROWS) pages.push(all.slice(i, i + ROWS));
  return pages.length ? pages : [[]];
};

/** All pages of the sheet (297 × 210 mm each). */
export function pages(data, printedOn = new Date()) {
  const date = printedOn.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const chunks = pageRows(data);
  return chunks.map((chunk, i) => h("div.ps-sheet", { lang: "de" },
    h("header.ps-head", null,
      h("div.ps-brand", null, h("img.ps-mascot", { src: "icons/mascot-wave.png", alt: "" }),
        h("div", null, h("div.ps-title", null, "Meine Medikamente mit Bildern"), h("div.ps-page", null, `Seite ${i + 1} von ${chunks.length}`))),
      h("div", null,
        h("div.ps-for", null, h("span", null, "für:"), h("span.ps-write")),
        h("div.ps-belongs", null, "Gehört zu Ihrem Medikationsplan. Maßgeblich ist der Plan Ihrer Praxis."),
        h("div", null, `Liste aus BlisterKompass, Stand ${date} · Fragen? Sagen Sie am Telefon die Nummer aus der ersten Spalte.`)),
      h("div.ps-nocode", null, "Kein 2D-Code: Den Medikationsplan mit Code bekommen Sie in Ihrer Praxis oder Apotheke.")),
    h("table.ps-table", null,
      h("colgroup", null, ["nr", "look", "med", "n", "n", "n", "n", "reason", "note"].map((c) => h(`col.ps-c-${c}`))),
      h("thead", null, h("tr", null,
        h("th.ps-center", null, "Nr."), h("th", null, "Aussehen"), h("th", null, "Medikament"),
        SLOTS.map((s) => h("th.ps-slot", null, s.id === "night" ? "zur Nacht" : s.label.toLowerCase())),
        h("th", null, "Wofür"), h("th", null, "Hinweise"))),
      h("tbody", null, chunk.map((x) => (x.heading ? h("tr.ps-sec", null, h("td", { colspan: 9 }, x.heading)) : tr(x.r))))),
    h("footer.ps-foot", null,
      h("p", null, `Seite ${i + 1} von ${chunks.length} · erstellt mit BlisterKompass · Demo, synthetische Daten · kein ärztlicher Plan nach § 31a SGB V`),
      h("p", null, "Nach einem Herstellerwechsel kann ein Medikament anders aussehen. Ob eine neue Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke."),
      h("div.ps-bar-row", null, h("span.ps-bar"), h("span", null, "Dieser Strich ist 5 cm lang. Ist er kürzer, wurde verkleinert gedruckt und die Größen stimmen nicht.")))));
}

/** First page only (preview, full screen). */
export const sheet = (data, printedOn = new Date()) => pages(data, printedOn)[0];
