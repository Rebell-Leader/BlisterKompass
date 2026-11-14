// Installability and offline/privacy rules, checked on the files themselves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p));
const text = (p) => read(p).toString("utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const precache = [...text("sw.js").matchAll(/^\s+"([^"]+)",$/gm)].map((m) => m[1]);

/** PNG width/height from the IHDR chunk. */
const pngSize = (p) => { const b = read(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test("manifest: name, German, standalone, theme colour, start_url and scope in this folder", () => {
  const m = JSON.parse(text("manifest.webmanifest"));
  assert.equal(m.name, "BlisterKompass");
  assert.equal(m.lang, "de");
  assert.equal(m.display, "standalone");
  assert.equal(m.theme_color, "#0B6E8A");
  assert.equal(m.start_url, "./");
  assert.equal(m.scope, "./");
});

test("manifest icons exist with their stated sizes: 192, 512 and a maskable 512", () => {
  const m = JSON.parse(text("manifest.webmanifest"));
  for (const i of m.icons) {
    assert.ok(exists(i.src), i.src);
    assert.deepEqual(pngSize(i.src).join("x"), i.sizes, i.src);
  }
  assert.ok(m.icons.some((i) => i.sizes === "192x192" && i.purpose.includes("any")));
  assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose.includes("any")));
  assert.ok(m.icons.some((i) => i.sizes === "512x512" && i.purpose.includes("maskable")));
  assert.deepEqual(pngSize("icons/apple-touch-icon.png"), [180, 180]);
});

test("index.html links the manifest, the apple touch icon and loads the app as a module", () => {
  const html = text("index.html");
  assert.match(html, /<html lang="de">/);
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon.png">/);
  assert.match(html, /<script type="module" src="js\/app.js">/);
  assert.match(html, /<meta name="theme-color" content="#0B6E8A">/);
});

test("strict CSP: only this origin, wasm allowed, no inline scripts or styles", () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(text("index.html"))?.[1];
  assert.ok(csp);
  for (const part of ["default-src 'self'", "connect-src 'self'", "img-src 'self' blob: data:", "script-src 'self' 'wasm-unsafe-eval'", "style-src 'self'"]) {
    assert.ok(csp.includes(part), part);
  }
  assert.ok(!csp.includes("unsafe-inline") && !csp.includes("https:") && !csp.includes("*"));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(text("index.html")), "no inline script");
  assert.ok(!/<style/.test(text("index.html")), "no inline style element");
});

test("service worker precaches every app file, and only files that exist", () => {
  const app = ["index.html", "app.css", "manifest.webmanifest",
    ...walk("js"), ...walk("vendor").filter((p) => !/LICENSE|VERSION/.test(p)), ...walk("data"), ...walk("icons"), ...walk("examples")];
  for (const p of app) assert.ok(precache.includes(p), `missing from sw.js: ${p}`);
  for (const p of precache) if (p !== "./") assert.ok(exists(p), `listed but missing: ${p}`);
  assert.ok(precache.includes("./"));
});

// The only other hosts in the code are links the person opens themselves (the leaflet page at Apotheken Umschau and
// the leaflet PDF the iPhone app downloads, js/leaflet-parser.js); the app never fetches them: connect-src stays 'self' (CSP test above).
const LINK_ONLY = ["https://www.apotheken-umschau.de/", "https://cdn.shop-apotheke.com/"];
test("no network at runtime: app code names no other host, apart from the leaflet link the person opens", () => {
  for (const p of ["index.html", "app.css", "sw.js", "manifest.webmanifest", ...walk("js")]) {
    const src = text(p).replace(/http:\/\/www\.w3\.org\/2000\/svg/g, "");
    const hosts = [...src.matchAll(/https?:\/\/[^/"'`\s]+\//g)].map((m) => m[0]);
    assert.ok(hosts.every((u) => LINK_ONLY.includes(u) && p === "js/leaflet-parser.js"), `${p}: ${hosts.join(", ")}`);
  }
  assert.ok(!/fetch\(\s*leaflet(Page|Pdf)|fetch\([^)]*(apotheken-umschau|shop-apotheke)/.test(walk("js").map(text).join("\n")), "the leaflet page is never fetched");
});

test("pdf.js loads from this folder, with eval off (strict CSP)", () => {
  const src = text("js/leaflet-pdf.js");
  assert.match(src, /\.\.\/vendor\/pdfjs\/pdf\.min\.mjs/);
  assert.match(src, /\.\.\/vendor\/pdfjs\/pdf\.worker\.min\.mjs/);
  assert.match(src, /isEvalSupported: false/);
});

test("zxing loads its .wasm from this folder, never from its default CDN", () => {
  assert.match(text("js/code-reader.js"), /locateFile/);
  assert.match(text("js/code-reader.js"), /vendor\/zxing-wasm\/zxing_reader\.wasm/);
});

test("nothing personal is stored: localStorage holds only myMeds, unknownPZNs and learnedLeaflets (products)", () => {
  const keys = new Set();
  for (const p of walk("js")) for (const m of text(p).matchAll(/localStorage\.(?:get|set)Item\("([^"]+)"/g)) keys.add(m[1]);
  for (const m of text("js/store.js").matchAll(/read\("([^"]+)"/g)) keys.add(m[1]);
  assert.deepEqual([...keys].sort(), ["learnedLeaflets", "myMeds", "unknownPZNs"]);
});

test("the plan reader never reads P, A or O", () => {
  const src = text("js/plan-reader.js");
  assert.ok(!/case "(P|A|O)"/.test(src));
});

test("data and examples are byte-identical to the iPhone app's (ios/PillSnap is the source of truth)", () => {
  const ios = path.join(root, "../ios/PillSnap");
  const same = (a, b) => assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)), `${a} differs; run npm run sync`);
  same(path.join(ios, "Data/catalog.json"), path.join(root, "data/catalog.json"));
  same(path.join(ios, "Data/pzn-names.json"), path.join(root, "data/pzn-names.json"));
  same(path.join(ios, "Examples/examples.json"), path.join(root, "examples/examples.json"));
  for (const f of JSON.parse(text("examples/examples.json"))) {
    const sub = f.kind === "plan" ? "plans" : f.kind === "pack" ? "packs" : "photos";
    same(path.join(ios, "Examples", sub, f.file), path.join(root, "examples", f.file));
  }
});

// Submission review 13 Nov 2026: rules checked on the source (PWA only; the iPhone strings are in ios/checks/main.swift).

test("one timer for the day list (T-01): Home() starts none, app.js starts exactly one", () => {
  const src = text("js/app.js");
  const home = src.slice(src.indexOf("function Home()"), src.indexOf("function onboarding()"));
  assert.ok(!home.includes("setInterval(") || home.indexOf("setInterval(") > home.indexOf("\n}\n"), "Home() must not start a timer");
  assert.equal([...src.matchAll(/setInterval\(/g)].length, 1);
});

test("no tablet handling, sameness or splitting wording in app texts (INV-14/15/16, T-08, T-15, T-36)", () => {
  const banned = [/nicht einnehmen/i, /doppelt einnehmen/i, /Neu verordnet/, /dasselbe Medikament/, /zum Teilen/, /text: "Ihre Tablette"/, /Neues Aussehen übernehmen/];
  for (const p of walk("js")) for (const re of banned) assert.ok(!re.test(text(p)), `${p}: ${re}`);
});

test("a person's tap never replaces the plan's product (T-15): no take-over in the store or the app", () => {
  assert.ok(!/takeOver/.test(text("js/store.js") + text("js/app.js")));
});

test("a plan with missing pages is never adopted; the old list stays", async () => {
  const { Store } = await import("../js/store.js");
  const store = new Store();
  const old = [{ pzn: "00000001", substance: "Alt", look: null, schedule: null }];
  store.myMeds = old;
  assert.equal(store.adopt({ meds: [{ pzn: "00000002" }], unknownPZNs: [], missing: [2] }), false);
  assert.equal(store.adopt({ meds: [{ pzn: "00000002" }], unknownPZNs: [], incomplete: [2] }), false);
  assert.deepEqual(store.myMeds, old);
  assert.equal(store.adopt({ meds: [{ pzn: "00000002" }], unknownPZNs: [], missing: [] }), true);
  assert.equal(store.myMeds[0].pzn, "00000002");
});

