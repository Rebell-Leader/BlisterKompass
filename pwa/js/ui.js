// Small DOM helpers and the building blocks of every screen (port of the SwiftUI views' pieces).
// No innerHTML with data: every text goes in through textContent.

import { icon, hasPicture, purpose } from "./icons.js";
import { SLOTS, hasScore, colorText, shapeName, whenText, capitalizedFirst, fmt, doseSymbol, dayName } from "./model.js";
import { ICON as FORM_ICON, doseForm } from "./dose-form.js";

const NS = "http://www.w3.org/2000/svg";

/** h("div.card", { onclick, "aria-label": … }, child, "text", [more]) */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style") for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k === "class") el.className += " " + v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}
/** Replace an element's children (null/false entries are skipped, arrays flattened). */
export function set(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

// Buttons ------------------------------------------------------------------

/** Big coloured button: icon over word (or icon only, with the word as its label). */
/** `mascot` (a state name) replaces the icon with the mascot in that state. */
export function bigButton({ icon: ic, title, onClick, color = "accent", height = 120, iconOnly = false, disabled = false, mascot: m, compact = false }) {
  // compact: three in a row, smaller title on up to two lines ("\n" breaks it).
  return h(`button.big.fill-${color}${compact ? ".compact" : ""}`, { type: "button", onclick: onClick, disabled, "aria-label": title.replace(/\n/g, " "), style: { "--h": `${height}px` } },
    m ? mascot(m) : icon(ic, { cls: iconOnly ? "icon big-only" : "icon" }),
    iconOnly || (!m && hasPicture(ic)) ? null : h("span", null, ...title.split("\n").flatMap((t, i) => (i ? [h("br"), t] : [t]))));
}

/** Light tile: icon over (multi-line) word. */
export function tile({ icon: ic, title, onClick, wide = false }) {
  const pic = hasPicture(ic);
  return h(`button.tile${wide ? ".wide" : ""}`, { type: "button", onclick: onClick, "aria-label": pic ? title.replace(/\n/g, " ") : null },
    icon(ic), pic ? null : h("span", null, ...title.split("\n").flatMap((t, i) => (i ? [h("br"), t] : [t]))));
}

export function backBar({ title = "", onBack, onSpeak }) {
  return h("div.backbar", null,
    h("button.back", { type: "button", onclick: onBack }, icon("back"), "Zurück"),
    onSpeak ? h("button.round", { type: "button", onclick: onSpeak, "aria-label": "Vorlesen", title: "Vorlesen" }, icon("speaker"))
      : h("span.bar-title", null, title));
}

/** The BlisterKompass mascot in one of its states (img/mascot/*.png). Decorative: the text next to it says it. */
export function mascot(state, cls = "") {
  return h(`img.mascot${cls ? "." + cls : ""}`, { src: `img/mascot/${state}.png`, alt: "", "aria-hidden": "true", draggable: "false" });
}

export function statusBanner({ icon: ic, text, color, mascot: m }) {
  return h(`div.banner.fill-${color}${m ? ".with-mascot" : ""}`, { role: "status" }, m ? mascot(m) : icon(ic), h("span", null, text));
}

export function infoRow({ icon: ic, tint, title, value, tone }) {
  const i = icon(ic);
  return h(`div.info${tone ? ".tone-" + tone : ""}`, null,
    h("span.info-icon", tint ? { style: { color: tint } } : null, i),
    h("div", null, h("div.info-title", null, title), h("div.info-value", null, value)));
}

export function tip({ icon: ic = "bulb", text }) {
  return h("div.tip", null, icon(ic), h("p", null, text));
}

export function chip(ic, text, tone) {
  return h(`span.chip${tone ? ".tone-" + tone : ""}`, null, ic ? icon(ic) : null, text);
}

/** Purpose row: "Wofür" with an icon keyed by ATC. */
export function purposeRow(med) {
  if (!med?.indication) return null;
  const p = purpose(med.atc);
  return infoRow({ icon: p.icon, tint: p.tint, title: "Wofür", value: med.indication.de });
}

/** Four big time-of-day boxes; the ones to take light up with the plan's dose (its own notation, ½ as a glyph) and unit.
 *  Weekly: the boxes plus the weekday warning. Free-text dosing: the plan's words. As needed: the plan's words, if any. */
export function scheduleBlock(med) {
  const s = med.schedule;
  if (!s) return null;
  const unit = s.unit && s.unit !== "Stück" ? s.unit : null;
  // A slot that is on the plan but has no amount shows "?": the amount stays unknown, never a default (INV-05).
  const boxes = () => h("div.slots", null, SLOTS.map((slot) => {
    const amount = s.amounts?.[slot.id];
    const on = amount != null || (s.slots ?? []).includes(slot.id);
    return h(`div.slot${on ? "" : ".off"}`, on ? { style: { background: slot.hex }, "aria-label": amount == null ? `${slot.label}: Menge nicht angegeben` : null } : null,
      icon(slot.icon), h("span.slot-label", null, slot.label),
      h("span.slot-amount", null, !on ? "–" : amount == null ? "?" : doseSymbol(s.doses?.[slot.id], amount)),
      amount != null && unit ? h("span.slot-unit", null, unit) : null);
  }));
  if (s.kind === "weekly") {
    const warn = infoRow({ icon: "calendarAlert", title: "Achtung", value: "Nur einmal pro Woche" + (s.days?.[0] ? `, am ${dayName(s.days[0])}` : "") + (s.text ? ` · ${s.text}` : ""), tone: "bad" });
    return s.slots?.length ? [warn, boxes()] : warn;
  }
  if (s.kind === "prn") return infoRow({ icon: "hand", title: "Wann", value: "Nur bei Bedarf" + (s.text && s.text.toLowerCase() !== "bei bedarf" ? ` · ${s.text}` : "") + (unit ? ` (${unit})` : ""), tone: "accent" });
  if (s.kind === "text") return infoRow({ icon: "doc", title: "Dosierung laut Plan", value: s.text ?? "Steht nicht auf dem Plan – bitte in der Praxis fragen", tone: "accent" });
  return boxes();
}

/** Photo from a Blob, filling a fixed box. */
export function photo(blob, cls = "photo") {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const img = h(`img.${cls}`, { src: url, alt: "Ihr Foto" });
  img.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 0), { once: true });
  return img;
}

// Pills --------------------------------------------------------------------

let uid = 0;

/** Draws a pill from its appearance record (port of PillView.swift). px per mm. */
/** Drawing size in mm. Leaflets often state no size: then a shape's typical proportions are drawn (a capsule stays long),
 *  only for the picture; the look itself keeps lengthMm/widthMm unknown. */
const TYPICAL = { capsule: [18, 7], oblong: [15, 7], oval: [11, 7.5], softgel: [12, 8] };
export function drawSize(look) {
  if (look.lengthMm == null && look.widthMm == null && TYPICAL[look.shape]) return TYPICAL[look.shape];
  return [look.lengthMm ?? 8, look.widthMm ?? 8];
}

export function pillSVG(look, ppm = 7) {
  const [lMm, wMm] = drawSize(look);
  const L = lMm * ppm, W = wMm * ppm;
  const id = `p${++uid}`;
  const shapeEl = () => {
    switch (look.shape) {
      case "round": return svg("ellipse", { cx: L / 2, cy: W / 2, rx: L / 2, ry: W / 2 });
      case "oval": case "softgel": return svg("ellipse", { cx: L / 2, cy: W / 2, rx: L / 2, ry: W / 2 });
      case "heart": {
        const w = L, hh = W;
        return svg("path", { d: `M${0.5 * w} ${0.97 * hh}C${0.18 * w} ${0.74 * hh} 0 ${0.54 * hh} 0 ${0.31 * hh}C0 ${0.05 * hh} ${0.4 * w} ${-0.05 * hh} ${0.5 * w} ${0.14 * hh}C${0.6 * w} ${-0.05 * hh} ${w} ${0.05 * hh} ${w} ${0.31 * hh}C${w} ${0.54 * hh} ${0.82 * w} ${0.74 * hh} ${0.5 * w} ${0.97 * hh}Z` });
      }
      case "oblong": case "capsule": return svg("rect", { x: 0, y: 0, width: L, height: W, rx: Math.min(L, W) / 2 });
      default: return svg("rect", { x: 0, y: 0, width: L, height: W, rx: W * 0.3 });
    }
  };
  const glossy = look.finish === "glossy";
  const defs = svg("defs", {},
    svg("clipPath", { id: `${id}c` }, shapeEl()),
    svg("radialGradient", { id: `${id}g`, cx: "0.32", cy: "0.28", r: "0.8" },
      svg("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": glossy ? 0.7 : 0.4 }),
      svg("stop", { offset: "0.55", "stop-color": "#fff", "stop-opacity": 0 }),
      svg("stop", { offset: "1", "stop-color": "#000", "stop-opacity": 0.12 })));
  const parts = [defs];
  if (look.shape === "capsule") {
    parts.push(svg("g", { "clip-path": `url(#${id}c)` },
      svg("rect", { x: 0, y: 0, width: L * 0.52, height: W, fill: look.colorHex }),
      svg("rect", { x: L * 0.52, y: 0, width: L * 0.48, height: W, fill: look.color2Hex ?? look.colorHex })));
  } else {
    const base = shapeEl(); base.setAttribute("fill", look.colorHex); parts.push(base);
  }
  const shine = shapeEl(); shine.setAttribute("fill", `url(#${id}g)`); parts.push(shine);
  const edge = shapeEl();
  edge.setAttribute("fill", "none"); edge.setAttribute("stroke", "rgba(0,0,0,.22)"); edge.setAttribute("stroke-width", Math.max(1, ppm * 0.2));
  parts.push(edge);
  const horizontalScore = look.shape === "round" || look.shape === "heart";
  if (hasScore(look)) {
    parts.push(svg("line", horizontalScore
      ? { x1: L * 0.14, y1: W * 0.55, x2: L * 0.86, y2: W * 0.55 }
      : { x1: L / 2, y1: W * 0.12, x2: L / 2, y2: W * 0.88 }));
    const ln = parts.at(-1);
    ln.setAttribute("stroke", "rgba(0,0,0,.3)"); ln.setAttribute("stroke-width", Math.max(1.2, ppm * 0.3)); ln.setAttribute("stroke-linecap", "round");
  }
  if (look.imprint) {
    const chars = Math.max(2, look.imprint.length);
    let dx = 0;
    if (look.shape === "capsule") dx = -L * 0.23; else if (hasScore(look) && !horizontalScore) dx = -L * 0.22;
    // Shifted to one half (capsule, vertical score): only that half is room for the text.
    const size = Math.min(W * 0.34, ((dx ? L * 0.44 : L * 0.96) / chars) * 1.6);
    const dy = hasScore(look) && horizontalScore ? -W * 0.18 : 0;
    const t = svg("text", { x: L / 2 + dx, y: W / 2 + dy, "font-size": size, "font-weight": 700, "text-anchor": "middle", "dominant-baseline": "central", fill: "rgba(0,0,0,.35)", "font-family": "system-ui, sans-serif" });
    t.textContent = look.imprint;
    parts.push(t);
  }
  const pad = ppm * 0.6;
  return svg("svg", { viewBox: `${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}`, width: L + 2 * pad, height: W + 2 * pad, class: "pill", role: "img", "aria-label": `${colorText(look)}, ${shapeName(look.shape)}` }, parts);
}

/** Fixed-size box so pills of different sizes line up in grids. */
export function pillTile(look, box = 90, cls = "") {
  if (!look) return doseFormTile(null, box);
  const longest = Math.max(...drawSize(look));
  return h(`div.pilltile${cls ? "." + cls : ""}`, { style: { "--box": `${box}px` } }, pillSVG(look, Math.min(9, (box * 0.85) / longest)));
}

/** Dosage form of a med without a look: from the official PZN list (IFA code), else from the plan line (M/@f, M/@fd). */
export const medForm = (med) => doseForm(med?.formCode) ?? med?.bmpForm ?? null;
/** The pill picture, or the grey outline of its dosage form when the look is unknown. */
export const medPic = (med, box = 90, cls = "") => (med?.look ? pillTile(med.look, box, cls) : doseFormTile(medForm(med), box));

/** Grey dashed outline of the dosage form – the "picture" of a pack whose look is not known. */
export function doseFormTile(form, box = 90) {
  const label = form ? `${form.label}, Aussehen unbekannt` : "Aussehen unbekannt";
  let inner;
  const dash = { fill: "none", stroke: "currentColor", "stroke-width": Math.max(2, box / 30), "stroke-dasharray": `${box / 14} ${box / 20}` };
  if (form?.family === "tablet") inner = svg("svg", { viewBox: `0 0 ${box} ${box}`, width: box, height: box }, svg("circle", { cx: box / 2, cy: box / 2, r: box * 0.31, ...dash }));
  else if (form?.family === "capsule") inner = svg("svg", { viewBox: `0 0 ${box} ${box}`, width: box, height: box }, svg("rect", { x: box * 0.11, y: box * 0.33, width: box * 0.78, height: box * 0.34, rx: box * 0.17, ...dash }));
  else inner = icon(form?.family ? FORM_ICON[form.family] : "box", { size: Math.round(box * 0.46) });
  return h("div.pilltile.formtile", { style: { "--box": `${box}px` }, role: "img", "aria-label": label }, inner);
}

// Dialogs ------------------------------------------------------------------

/** Bottom sheet with a title, content and "Abbrechen". Resolves when closed. */
export function sheet(title, build) {
  const dlg = h("dialog.sheet", { "aria-label": title });
  const close = () => { dlg.close(); };
  dlg.append(h("h2", null, title), build(close), h("button.link", { type: "button", onclick: close }, "Abbrechen"));
  dlg.addEventListener("close", () => dlg.remove());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return close;
}
