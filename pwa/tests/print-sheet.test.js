// "Plan drucken" sheet (js/print-sheet.js), drawn into a tiny DOM stand-in (no layout, so pages split by pageRows).
// Rules: the plan's Hinweis printed as written (meal and day tags are extras, never replacements, INV-12), "0" as on
// the BMP, "echte Größe" only under a picture whose size is known, no 2D or QR code and nothing personal on the sheet,
// print fonts per docs/PRD-print-sheet.md. The iPhone print is still the old layout (TODO.md T-30).
process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Minimal DOM: elements with attributes, classes, style and children; text nodes. Enough for h(), svg() and pillSVG().
class Node {
  constructor() { this.childNodes = []; this.parentNode = null; }
  append(...cs) { for (const c of cs) { const n = typeof c === "string" ? new Text(c) : c; n.parentNode = this; this.childNodes.push(n); } }
  replaceChildren(...cs) { this.childNodes = []; this.append(...cs); }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(t) { this.replaceChildren(String(t)); }
  get firstElementChild() { return this.childNodes.find((c) => c instanceof Element) ?? null; }
}
class Text extends Node { constructor(t) { super(); this.data = t; } get textContent() { return this.data; } }
class Element extends Node {
  constructor(tag) { super(); this.tagName = tag; this.attrs = {}; this.className = ""; this.style = { setProperty() {}, cssText: "" }; }
  setAttribute(k, v) { if (k === "class") this.className = String(v); else this.attrs[k] = String(v); }
  getAttribute(k) { return k === "class" ? this.className : this.attrs[k] ?? null; }
  addEventListener() {}
  cloneNode() { return this; }
}
globalThis.Node = Node;
globalThis.document = {
  createElement: (t) => new Element(t), createElementNS: (_, t) => new Element(t), createTextNode: (t) => new Text(t),
};

const PrintSheet = await import("../js/print-sheet.js");
const PlanReader = await import("../js/plan-reader.js");

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const catalog = JSON.parse(fs.readFileSync(here("../data/catalog.json"), "utf8"));
const names = JSON.parse(fs.readFileSync(here("../data/pzn-names.json"), "utf8"));
const plan = (c) => PlanReader.resolve(PlanReader.items(fs.readFileSync(here(`../../ios/PillSnap/Examples/plans/plan-${c}.xml`), "utf8")), catalog, names);
const store = (meds, unknownPZNs = []) => ({ myMeds: meds, unknownPZNs, pznName: () => null, nameOf: (p) => `PZN ${p}` });

const all = (el, pred, out = []) => { if (el instanceof Element && pred(el)) out.push(el); for (const c of el.childNodes ?? []) all(c, pred, out); return out; };
const cls = (name) => (el) => el.className.split(" ").includes(name);
const bodyRows = (sheet) => all(sheet, (e) => e.tagName === "tr" && e.parentNode?.tagName === "tbody" && !cls("ps-sec")(e));

for (const c of ["a", "b", "c"]) {
  const meds = plan(c).meds;
  const data = PrintSheet.rows(store(meds));
  const sheets = PrintSheet.pages(data, new Date(2026, 10, 14));
  const rows = sheets.flatMap(bodyRows);

  test(`print sheet ${c}: every medicine on a page, numbered in plan order`, () => {
    assert.equal(rows.length, meds.length);
    assert.deepEqual(rows.map((r) => all(r, cls("ps-nr"))[0].textContent), meds.map((_, i) => String(i + 1)));
  });

  test(`print sheet ${c}: the plan's Hinweis is printed as written – the meal and day tags only add to it`, () => {
    for (const r of [...data.main, ...data.prn]) {
      const row = rows.find((x) => all(x, cls("ps-nr"))[0].textContent === String(r.nr));
      const note = all(row, cls("ps-note"))[0].textContent;
      if (r.note) assert.ok(note.includes(r.note), `Nr. ${r.nr}: "${r.note}" not in "${note}"`);
    }
  });

  test(`print sheet ${c}: "0" printed as on the BMP, never a dash`, () => {
    for (const r of data.main.filter((x) => x.doses)) {
      const row = rows.find((x) => all(x, cls("ps-nr"))[0].textContent === String(r.nr));
      assert.deepEqual(all(row, cls("ps-n")).map((t) => t.firstElementChild ? t.childNodes[0].textContent : t.textContent), r.doses);
    }
  });

  test(`print sheet ${c}: "echte Größe" only under a picture with a known size; no header claims it`, () => {
    for (const s of sheets) assert.ok(!all(s, (e) => e.tagName === "th").some((th) => th.textContent.includes("echte Größe")));
    for (const r of [...data.main, ...data.prn].filter((x) => x.look)) {
      const row = rows.find((x) => all(x, cls("ps-nr"))[0].textContent === String(r.nr));
      assert.equal(all(row, cls("ps-scale"))[0].textContent, r.trueSize ? "echte Größe" : "nicht maßstäblich");
      assert.equal(all(row, cls("ps-big"))[0].childNodes.length, r.trueSize ? 1 : 0, "enlarged only with a known size");
    }
  });

  test(`print sheet ${c}: no 2D or QR code, no link, nothing personal; "für" left blank`, () => {
    const text = sheets.map((s) => s.textContent).join(" ");
    for (const s of sheets) assert.equal(all(s, (e) => /code/i.test(e.attrs["aria-label"] ?? "")).length, 0);
    assert.ok(!/https?:|vercel/.test(text));
    assert.ok(text.includes("Kein 2D-Code"));
    for (const s of sheets) assert.equal(all(s, cls("ps-write"))[0].childNodes.length, 0);
  });
}

test("print sheet: weekly medicine gets the black day tag, and its note stays as written", () => {
  const meds = plan("c").meds;
  const data = PrintSheet.rows(store(meds));
  const weekly = [...data.main].find((r) => r.when);
  if (!weekly) return;
  const row = PrintSheet.pages(data).flatMap(bodyRows).find((x) => all(x, cls("ps-nr"))[0].textContent === String(weekly.nr));
  assert.equal(all(row, cls("ps-day-tag"))[0].textContent, weekly.when.split(" · ")[0]);
  assert.ok(all(row, cls("ps-note"))[0].textContent.includes(weekly.note));
});

test("look-alike rule: same colour(s) and shape family, lengths within 1.5 mm (or unknown)", () => {
  const w = (o) => ({ color: "white", shape: "round", lengthMm: 8, ...o });
  assert.ok(PrintSheet.lookAlike(w(), w({ lengthMm: 9.5 })));
  assert.ok(!PrintSheet.lookAlike(w(), w({ lengthMm: 9.6 })));
  assert.ok(PrintSheet.lookAlike(w({ shape: "oval" }), w({ shape: "oblong" })));
  assert.ok(!PrintSheet.lookAlike(w(), w({ color: "yellow" })));
  assert.ok(!PrintSheet.lookAlike(w(), w({ color2: "blue" })));
  assert.ok(PrintSheet.lookAlike(w(), w({ lengthMm: undefined })));
});

test("look in words: colour and shape first, imprint and score line, size never split", () => {
  const l = PrintSheet.lookLines({ color: "white", colorName: { de: "weiß" }, shape: "oval", imprint: "T10", score: "single", lengthMm: 10.5, widthMm: 5 });
  assert.match(l.main, /weiß/);
  assert.match(l.size, /^10,5\s×\s5\smm$/);   // no-break spaces: the size never splits over two lines
  assert.match(l.marks, /„T10“/);
  assert.equal(PrintSheet.lookLines(null), null);
});

test("page split without layout: at most ROWS rows per page, a heading never alone at the bottom", () => {
  const r = (nr) => ({ nr });
  const pages = PrintSheet.pageRows({ main: [1, 2, 3, 4, 5].map(r), prn: [6, 7].map(r) });
  assert.ok(pages.every((p) => p.length <= PrintSheet.ROWS));
  assert.ok(pages.every((p) => !p.at(-1).heading));
  assert.equal(pages.flat().filter((x) => x.r).length, 7);
});

test("print fonts (PRD print sheet): nothing under 9 pt; Wofür and Hinweise ≥ 12 pt; ingredient ≥ 14 pt", () => {
  const css = fs.readFileSync(here("../app.css"), "utf8");
  const sheetCss = css.slice(css.indexOf("/* Plan drucken"), css.indexOf(".ps-preview {"));
  const sizes = [...sheetCss.matchAll(/([^{}]+)\{[^}]*font-size:\s*([\d.]+)pt/g)].map((m) => [m[1].trim(), Number(m[2])]);
  assert.ok(sizes.length > 10);
  for (const [sel, pt] of sizes) assert.ok(pt >= 9, `${sel}: ${pt} pt`);
  const pt = (sel) => sizes.filter(([s]) => s.split(/[\s,]+/).includes(sel) || s.endsWith(sel)).map(([, v]) => v);
  assert.ok(pt(".ps-reason").every((v) => v >= 12) && pt(".ps-reason").length);
  assert.ok(pt(".ps-sub").every((v) => v >= 14) && pt(".ps-sub").length);
  assert.ok(!/\.ps-(sub|reason)\.long/.test(css), "no smaller variant for long words");
});
