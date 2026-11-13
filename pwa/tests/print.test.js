// Plan drucken: the plan on the phone → the printed code → read back gives the same plan; meal tags from the Hinweise.
// Same checks as the "printed code" and "meal" checks in ios/checks/main.swift.
process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as Bmp from "../js/bmp-writer.js";
import * as PlanReader from "../js/plan-reader.js";
import { prepare as prepareWriter, dataMatrix } from "../js/code-writer.js";
import { prepare as prepareReader, texts } from "../js/code-reader.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const catalog = JSON.parse(fs.readFileSync(here("../data/catalog.json"), "utf8"));
const names = JSON.parse(fs.readFileSync(here("../data/pzn-names.json"), "utf8"));
const planA = PlanReader.resolve(PlanReader.items(fs.readFileSync(here("../../ios/PillSnap/Examples/plans/plan-a.xml"), "utf8")), catalog, names);
const order = (meds) => [...meds.filter((m) => m.schedule?.kind !== "prn"), ...meds.filter((m) => m.schedule?.kind === "prn")];

const printed = Bmp.xml(planA.meds, ["11289015"], { id: "AB".repeat(16), issued: new Date(2026, 10, 13, 19, 0, 0) });
const reread = PlanReader.resolve(PlanReader.items(printed), catalog, names);

test("printed code: head v=028, 32-hex U, A = BlisterKompass with time – and no person (no P)", () => {
  assert.ok(printed.startsWith(`<MP v="028" U="${"AB".repeat(16)}" l="de-DE"><A n="BlisterKompass" t="2026-11-13T19:00:00"/>`));
  assert.ok(!printed.includes("<P"));
});
test("printed code: ≤1400 bytes ISO-8859-1, no zero doses", () => {
  assert.ok(Bmp.payload(printed).length <= 1400);
  assert.ok(!printed.includes('="0"'));
});
test("printed code: same 12 meds with the same schedules, notes kept", () => {
  const looked = reread.meds.filter((m) => m.look); // the line without picture data is checked below
  assert.deepEqual(looked.map((m) => m.pzn), order(planA.meds).map((m) => m.pzn));
  for (const [r, o] of looked.map((m, i) => [m, order(planA.meds)[i]])) {
    assert.equal(r.schedule.kind, o.schedule.kind);
    assert.deepEqual(r.schedule.amounts, o.schedule.amounts);
    assert.deepEqual(r.schedule.days, o.schedule.days);
  }
  assert.equal(reread.meds.find((m) => m.substance === "Levothyroxin-Natrium").schedule.note, "nüchtern, 30 min vor dem Frühstück");
});
test("printed code: entry without picture data stays unknown", () => assert.deepEqual(reread.unknownPZNs, ["11289015"]));
test("printed code: half dose written as 1/2, printed as ½", () => {
  assert.equal(Bmp.dose(0.5), "1/2");
  assert.equal(Bmp.printed(0.5), "½");
});
test("printed code: too long → notes dropped first, still ≤1400", () => {
  const many = [0, 1, 2].flatMap((k) => planA.meds.map((m, i) => ({ ...m, pzn: String(10000000 + k * 100 + i) })));
  const x = Bmp.xml(many, []);
  assert.ok(x === null || (Bmp.payload(x).length <= 1400 && !x.includes(" i=")));
});
test("form from the product name, else from the PZN list", () => {
  assert.equal(Bmp.form("Metformin Rhenus 1000 mg Filmtabletten", null), "Filmtabl");
  assert.equal(Bmp.form(null, "KAPS"), "Kapsel");
});

test("Data Matrix written by zxing-wasm reads back byte for byte with the app's reader", async () => {
  prepareWriter(fs.readFileSync(here("../vendor/zxing-wasm/zxing_writer.wasm")).buffer);
  prepareReader(fs.readFileSync(here("../vendor/zxing-wasm/zxing_reader.wasm")).buffer);
  const m = await dataMatrix(Bmp.payload(printed));
  assert.equal(m.width, m.height);
  // Module matrix → grey image with a quiet zone, 4 px per module.
  const q = 2, s = 4, n = (m.width + 2 * q) * s;
  const data = new Uint8ClampedArray(n * n * 4).fill(255);
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.dark(x, y))
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = (((y + q) * s + dy) * n + (x + q) * s + dx) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  const found = await texts({ data, width: n, height: n, colorSpace: "srgb" });
  assert.ok(found.includes(printed));
});

test("meal: plan A – Levothyroxin nüchtern, Pantoprazol before, Metformin with, ASS after, Atorvastatin none", () => {
  const of = (sub) => Bmp.scheduleMeal(planA.meds.find((m) => m.substance === sub).schedule);
  assert.equal(of("Levothyroxin-Natrium"), "fasting");
  assert.equal(of("Pantoprazol"), "before");
  assert.equal(of("Metformin"), "with");
  assert.equal(of("Acetylsalicylsäure"), "after");
  assert.equal(of("Atorvastatin"), null);
});
test("meal: 'nüchtern, 30 min vor dem Frühstück' is fasting; 'während der Mahlzeit' is with", () => {
  assert.equal(Bmp.meal("nüchtern, 30 min vor dem Frühstück"), "fasting");
  assert.equal(Bmp.meal("während der Mahlzeit"), "with");
});
test("meal: negation, 'unabhängig' or other notes give no tag", () => {
  assert.equal(Bmp.meal("nicht nüchtern einnehmen"), null);
  assert.equal(Bmp.meal("unabhängig von den Mahlzeiten"), null);
  assert.equal(Bmp.meal("bei Knieschmerzen"), null);
  assert.equal(Bmp.meal(null), null);
});
test("meal: reviewer cases – negation, distance and choices never give a tag (no inverted advice)", () => {
  for (const t of ["nicht auf nüchternen Magen", "Abstand zum Essen 2 h", "nicht zu den Mahlzeiten", "nicht mit dem Essen einnehmen", "1 Std. vor oder 2 Std. nach dem Essen"]) {
    assert.equal(Bmp.meal(t), null, t);
  }
});
