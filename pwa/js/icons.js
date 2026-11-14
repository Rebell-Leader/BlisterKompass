// Line icons drawn for BlisterKompass (24 × 24, currentColor). Always shown next to a word, never alone,
// except where the button carries an accessible label.

const P = {
  camera: "M3 8h3.5l2-3h7l2 3H21v12H3z M12 9.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  barcode: "M3 7V4h3 M18 4h3v3 M21 17v3h-3 M6 20H3v-3 M7 8v8 M10 8v8 M13 8v8 M17 8v8",
  qr: "M3 7V4h3 M18 4h3v3 M21 17v3h-3 M6 20H3v-3 M8 8h3v3H8z M13 8h3v3h-3z M8 13h3v3H8z M14 14h2v2h-2z",
  back: "M15 5l-7 7 7 7",
  speaker: "M4 9h4l5-4v14l-5-4H4z M16.5 8.5a5 5 0 0 1 0 7 M19 6a8.5 8.5 0 0 1 0 12",
  check: "M5 12.5l4.5 4.5L19 7",
  x: "M6 6l12 12 M18 6L6 18",
  plus: "M12 5v14 M5 12h14",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9.5 12v-1.5a2.5 2.5 0 0 1 5 0V12 M8.5 12h7v4.5h-7z",
  sunrise: "M3 19h18 M7 19a5 5 0 0 1 10 0 M12 4v5 M9.5 6.5L12 4l2.5 2.5 M4.5 12l1.5 1 M19.5 12l-1.5 1",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2.5v2.5 M12 19v2.5 M2.5 12H5 M19 12h2.5 M5.3 5.3l1.8 1.8 M16.9 16.9l1.8 1.8 M5.3 18.7l1.8-1.8 M16.9 7.1l1.8-1.8",
  sunset: "M3 19h18 M7 19a5 5 0 0 1 10 0 M12 4v5 M9.5 6.5L12 9l2.5-2.5 M4.5 12l1.5 1 M19.5 12l-1.5 1",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  hand: "M8 13.5V6a1.5 1.5 0 0 1 3 0v5 M11 10.5V4.5a1.5 1.5 0 0 1 3 0v6 M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L2.8 15a1.5 1.5 0 0 1 2.4-1.8L8 16",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4",
  calendarAlert: "M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4 M12 12.5v3.5 M12 18.2v.1",
  alert: "M12 3.5l9.5 17h-19z M12 10v5 M12 17.8v.1",
  octagon: "M8 3h8l5 5v8l-5 5H8l-5-5V8z M12 7.5v5.5 M12 16.3v.1",
  question: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7 M12 17v.1",
  keyboard: "M3 6h18v12H3z M7 10h.1 M10.3 10h.1 M13.6 10h.1 M17 10h.1 M7 14h10",
  photos: "M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15.5 9v.1",
  search: "M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M15 15l5.5 5.5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7.6v.1",
  install: "M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5z M12 7v7 M9 11l3 3 3-3 M10.5 18.5h3",
  share: "M12 3v12 M8 7l4-4 4 4 M7 10H5v11h14V10h-2",
  pills: "M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z M7 7l7 7",
  drop: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  bottle: "M9 3h6v3l2 3v12H7V9l2-3z M7 13h10",
  syringe: "M17 3l4 4 M19 5l-3 3 M16 8l-9 9-3.5 1 1-3.5 9-9 M11 7l6 6 M8.5 12.5l2 2",
  bandage: "M4.5 14.5l10-10a3.5 3.5 0 0 1 5 5l-10 10a3.5 3.5 0 0 1-5-5z M10 12h.1 M12 10h.1 M12 14h.1 M14 12h.1",
  tube: "M8 3h8v3l-1 15H9L8 6z M8 6h8",
  lungs: "M12 4v8 M12 12l-3-2.5 M12 12l3-2.5 M8 7c-3 1-5 6-5 10 0 2 1 3 3 3s3-1 3-3V9 M16 7c3 1 5 6 5 10 0 2-1 3-3 3s-3-1-3-3V9",
  spray: "M8 9h6v12H8z M9 9V6h4v3 M13 6h2 M18 4h.1 M18 7.5h.1 M20.5 5.7h.1",
  capsule: "M9 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z M6 12h12",
  powder: "M6 6h.1 M12 6h.1 M18 6h.1 M6 12h.1 M12 12h.1 M18 12h.1 M6 18h.1 M12 18h.1 M18 18h.1",
  box: "M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z M3 7.5l9 4.5 9-4.5 M12 12v9",
  heart: "M12 20s-7.5-4.5-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.5 12 20 12 20z",
  ecg: "M2.5 12H7l2-5.5 4 11 2-5.5h6.5",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9",
  bolt: "M13 2.5L5 14h6l-1 7.5L18 10h-6z",
  brain: "M10 4.5a3 3 0 0 0-5 2 3 3 0 0 0-1.5 5 3 3 0 0 0 1.5 5 3 3 0 0 0 5 2V4.5z M14 4.5a3 3 0 0 1 5 2 3 3 0 0 1 1.5 5 3 3 0 0 1-1.5 5 3 3 0 0 1-5 2V4.5z",
  star: "M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9",
  walk: "M13.5 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M9 21l2.5-6 2.5 2.5V21 M7 12l3.5-3.5h3L16 12h3 M11.5 15l1-6.5",
  doc: "M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5",
  refresh: "M4.5 12a7.5 7.5 0 0 1 13-5.1 M19.5 3.5v4h-4 M19.5 12a7.5 7.5 0 0 1-13 5.1 M4.5 20.5v-4h4",
  arrowRight: "M5 12h14 M13 6l6 6-6 6",
  arrowsLR: "M4 8.5h16 M16 4.5l4 4-4 4 M20 15.5H4 M8 11.5l-4 4 4 4",
  equal: "M5 9h14 M5 15h14",
  pharmacy: "M3 7h18v13H3z M9 7V4h6v3 M12 10.5v6 M9 13.5h6",
  fork: "M7 3v8 M5 3v5a2 2 0 0 0 4 0V3 M7 11v10 M17 3c-2 0-3 2-3 6h3v12",
  number: "M10 4L8 20 M16 4l-2 16 M4.5 9h15 M4 15h15",
  text: "M5 7V5h14v2 M12 5v14 M9 19h6",
  eyeSlash: "M3 3l18 18 M10.6 6.1A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3 3.5 M6.5 7.5C4.3 9 3 12 3 12s4 6 9 6a9 9 0 0 0 4-1 M9.9 10a3 3 0 0 0 4.2 4.2",
  bulb: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z",
  seal: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.3l3 3 5.2-6",
  noEntry: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M5.6 5.6l12.8 12.8",
  tap: "M9 11V5.5a1.5 1.5 0 0 1 3 0V11 M12 10.5a1.5 1.5 0 0 1 3 0v1 M15 11a1.5 1.5 0 0 1 3 0v3.5a6.5 6.5 0 0 1-6.5 6.5h-.8a5 5 0 0 1-4-2l-2.9-3.9a1.5 1.5 0 0 1 2.3-1.9L9 15",
  chevronDown: "M6 9l6 6 6-6",
  printer: "M7 9V3h10v6 M7 18H4V9h16v9h-3 M7 14h10v7H7z M17 12h.1",
  expand: "M14 4h6v6 M20 4l-7 7 M10 20H4v-6 M4 20l7-7",
};

const NS = "http://www.w3.org/2000/svg";

/** Illustrated icons (PNG) for the main actions; every other name stays a line-drawn SVG. Paired with
 *  `ActionPicture` in ios/PillSnap/RootView.swift. A button with a picture shows no word: its title is the accessible label. */
const PICTURES = { qr: "ui-plan", barcode: "ui-pack", printer: "ui-print", tap: "ui-lookup" };
export const hasPicture = (name) => name in PICTURES;

/** <svg> icon (or the illustrated <img> for the main actions); size in px (default 1em via CSS). */
export function icon(name, { size, cls = "icon", stroke = 2.2 } = {}) {
  if (PICTURES[name]) {
    const img = document.createElement("img");
    img.src = `icons/${PICTURES[name]}.png`;
    img.alt = "";
    img.setAttribute("class", `${cls} pic`);
    img.setAttribute("aria-hidden", "true");
    img.decoding = "async";
    img.draggable = false;
    if (size) { img.width = size; img.height = size; }
    return img;
  }
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  if (size) { s.setAttribute("width", size); s.setAttribute("height", size); }
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", P[name] ?? P.pills);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", stroke);
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  s.append(p);
  return s;
}

export const hasIcon = (name) => name in P;

/** What a medication is for, as an icon. Keyed by ATC prefix (longest wins). */
const PURPOSE = [
  ["N02BF", "brain", "#6A4FB5"], ["C09", "ecg", "#C0392B"], ["C08", "ecg", "#C0392B"], ["C07", "heart", "#C0392B"],
  ["C03", "drop", "#2E7BC4"], ["A10", "cube", "#8A6D3B"], ["C10", "drop", "#B8860B"], ["A02", "shield", "#2E8B57"],
  ["B01", "drop", "#B3261E"], ["H03", "star", "#2E7BC4"], ["L04", "hand", "#7A4FB5"], ["M01", "bolt", "#D46A00"],
  ["N02", "bolt", "#D46A00"], ["N03", "brain", "#6A4FB5"], ["M04", "walk", "#2E8B57"],
];
export function purpose(atc) {
  const hit = PURPOSE.filter(([p]) => (atc ?? "").startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  return { icon: hit?.[1] ?? "pills", tint: hit?.[2] ?? null };
}
