// On-device pill recognition on raw pixels. Port of ios/PillSnap/PillRecognizer.swift (analyzePixels).
// No network, no ML model:
//  1. find the pill: background colour from the photo border, pill = largest region that differs
//     from it (shadows are ignored),
//  2. colour: trimmed mean in CIELAB → nearest catalogue colour; two clearly different halves → capsule,
//  3. shape: principal axes of the region → round / oval / oblong.
// Imprint OCR is not part of v1 on the web: the user can type what is printed on the pill.

/** Same codes and hex values as the iPhone app. */
export const PALETTE = [
  { code: "white", name: "weiß", hex: "#FBFBF8" },
  { code: "offwhite", name: "cremeweiß", hex: "#F1EBDD" },
  { code: "lightyellow", name: "hellgelb", hex: "#F6EAA8" },
  { code: "yellow", name: "gelb", hex: "#F2CC3D" },
  { code: "orange", name: "orange", hex: "#F0954A" },
  { code: "pink", name: "rosa", hex: "#F2B8C3" },
  { code: "red", name: "rot", hex: "#C9483F" },
  { code: "blue", name: "blau", hex: "#7EA6D8" },
  { code: "green", name: "grün", hex: "#86C49A" },
  { code: "brown", name: "braun", hex: "#9E7152" },
  { code: "beige", name: "beige", hex: "#E6D5B4" },
];
export const colorName = (code) => PALETTE.find((p) => p.code === code)?.name ?? code;

// CIELAB (D65), CIE76 distance.
function lin(c) { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
export function lab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return { L: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}
export function labHex(hex) { const v = parseInt(hex.slice(1), 16) || 0; return lab((v >> 16) & 255, (v >> 8) & 255, v & 255); }
const dist = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);

/** Back to sRGB hex, for showing "what the phone saw". */
export function hexOf({ L, a, b }) {
  const finv = (t) => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = finv(fx) * 0.95047, y = finv(fy), z = finv(fz) * 1.08883;
  const rl = 3.2406 * x - 1.5372 * y - 0.4986 * z;
  const gl = -0.9689 * x + 1.8758 * y + 0.0415 * z;
  const bl = 0.0557 * x - 0.204 * y + 1.057 * z;
  const g = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255); };
  return "#" + [rl, gl, bl].map((c) => g(c).toString(16).toUpperCase().padStart(2, "0")).join("");
}

const paletteLab = PALETTE.map((p) => labHex(p.hex));
export function nearest(c) {
  let best = 0;
  for (let i = 1; i < paletteLab.length; i++) if (dist(paletteLab[i], c) < dist(paletteLab[best], c)) best = i;
  return PALETTE[best];
}

const median = (v) => { const s = Float64Array.from(v).sort(); return s.length ? s[s.length >> 1] : 0; };

/** Mean colour without highlights (gloss) and the darkest edge/shadow pixels. */
function trimmedMean(v) {
  if (!v.length) return { L: 0, a: 0, b: 0 };
  const s = [...v].sort((p, q) => p.L - q.L);
  const lo = Math.floor((s.length * 15) / 100), hi = Math.max(lo + 1, Math.floor((s.length * 85) / 100));
  let L = 0, a = 0, b = 0;
  for (let i = lo; i < hi; i++) { L += s[i].L; a += s[i].a; b += s[i].b; }
  const k = hi - lo;
  return { L: L / k, a: a / k, b: b / k };
}

/**
 * pixels: { data: RGBA bytes, width, height } (an ImageData, about 320 px on the long side).
 * → { cues: PillCues, box: {x, y, width, height} }
 */
export function analyzePixels({ data, width: w, height: h }) {
  const n = w * h;
  const L = new Float64Array(n), A = new Float64Array(n), B = new Float64Array(n);
  for (let i = 0; i < n; i++) { const p = lab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]); L[i] = p.L; A[i] = p.a; B[i] = p.b; }
  const at = (i) => ({ L: L[i], a: A[i], b: B[i] });
  const empty = { cues: { found: false, colors: [], shape: null, imprint: null, seenHex: [] }, box: null };

  // Background = median of a thin frame around the photo.
  const band = Math.max(2, Math.floor(Math.min(w, h) / 25));
  const bl = [], ba = [], bb = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < band || y < band || x >= w - band || y >= h - band) { const i = y * w + x; bl.push(L[i]); ba.push(A[i]); bb.push(B[i]); }
  }
  const bg = { L: median(bl), a: median(ba), b: median(bb) };

  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const chroma = Math.hypot(A[i] - bg.a, B[i] - bg.b);
    const shadow = L[i] < bg.L && chroma < 8;
    mask[i] = !shadow && dist(at(i), bg) > 16 ? 1 : 0;
  }

  // Largest connected region, slightly favouring the centre.
  const seen = new Uint8Array(n);
  let best = null, bestScore = 0;
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!mask[s] || seen[s]) continue;
    const region = [];
    let top = 0;
    stack[top++] = s; seen[s] = 1;
    let sx = 0, sy = 0;
    while (top > 0) {
      const i = stack[--top];
      region.push(i);
      const x = i % w, y = (i / w) | 0;
      sx += x; sy += y;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && mask[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && mask[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    const cx = sx / region.length / w - 0.5, cy = sy / region.length / h - 0.5;
    const score = region.length * (1.2 - Math.min(1, Math.hypot(cx, cy) * 1.4));
    if (score > bestScore) { bestScore = score; best = region; }
  }
  if (!best || best.length <= n * 0.004) return empty;

  // Principal axes → length, width, fill ratio.
  const m = best.length;
  let mx = 0, my = 0;
  for (const i of best) { mx += i % w; my += (i / w) | 0; }
  mx /= m; my /= m;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const i of best) { const dx = (i % w) - mx, dy = ((i / w) | 0) - my; cxx += dx * dx; cyy += dy * dy; cxy += dx * dy; }
  const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const us = new Float64Array(m);
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  best.forEach((i, k) => {
    const x = i % w, y = (i / w) | 0, dx = x - mx, dy = y - my;
    const u = dx * ct + dy * st, v = -dx * st + dy * ct;
    us[k] = u;
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  });
  const length = umax - umin + 1, width = vmax - vmin + 1;
  const ratio = length / Math.max(1, width);
  const fill = m / (length * width);

  const all = trimmedMean(best.map(at));
  const halfA = trimmedMean(best.filter((_, k) => us[k] < 0).map(at));
  const halfB = trimmedMean(best.filter((_, k) => us[k] >= 0).map(at));
  const cues = { found: true, colors: [], shape: null, imprint: null, seenHex: [] };
  if (ratio > 1.6 && dist(halfA, halfB) > 22) {
    cues.shape = "capsule";
    cues.colors = [...new Set([nearest(halfA).code, nearest(halfB).code])];
    cues.seenHex = [hexOf(halfA), hexOf(halfB)];
  } else {
    cues.shape = ratio < 1.15 ? "round" : fill < 0.83 ? "oval" : "oblong";
    cues.colors = [nearest(all).code];
    cues.seenHex = [hexOf(all)];
  }
  return { cues, box: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } };
}
