// The bundled example images decode to the expected plan or pack, through the same code path as the app.
process.env.TZ = "Europe/Berlin";

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { prepare, scan } from "../js/code-reader.js";
import * as PlanReader from "../js/plan-reader.js";
import * as Pack from "../js/pack-code.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
prepare(fs.readFileSync(here("../vendor/zxing-wasm/zxing_reader.wasm")).buffer);
const catalog = JSON.parse(fs.readFileSync(here("../data/catalog.json"), "utf8"));
const names = JSON.parse(fs.readFileSync(here("../data/pzn-names.json"), "utf8"));
const image = (f) => new Uint8Array(fs.readFileSync(here(`../examples/${f}`)));
const xml = (name) => fs.readFileSync(here(`../../ios/PillSnap/Examples/plans/${name}.xml`), "utf8");

for (const [file, name, meds] of [["plan-a.png", "plan-a", 12], ["plan-b.png", "plan-b", 6], ["plan-c.png", "plan-c", 6], ["sheet-plan-a.png", "plan-a", 12], ["plan-kbv-beispiel.png", "plan-kbv-beispiel", 7]]) {
  test(`${file} → plan with ${meds} entries, same as ${name}.xml`, async () => {
    const found = await scan(image(file));
    assert.equal(found?.kind, "plan");
    const items = PlanReader.items(found.xml);
    assert.equal(items.length, meds);
    assert.deepEqual(items, PlanReader.items(xml(name)));
    const plan = PlanReader.resolve(items, catalog, names);
    assert.equal(plan.meds.length, meds); // every plan line is one med, with or without a look
  });
}

test("plan code with umlauts decodes as ISO-8859-1", async () => {
  const found = await scan(image("plan-a.png"));
  assert.ok(found.xml.includes("Frühstück"));
});

const packs = JSON.parse(fs.readFileSync(here("../../ios/PillSnap/Examples/packs/packs.json"), "utf8"));
for (const p of packs) {
  test(`pack-${p.pzn}.png → PZN ${p.pzn} (${p.label})`, async () => {
    const found = await scan(image(`pack-${p.pzn}.png`));
    assert.equal(found?.kind, "pack");
    assert.equal(found.code.pzn, p.pzn);
    assert.equal(found.code.batch, p.batch ?? null);
    assert.equal(found.code.expiry, p.expiry ?? null);
  });
}

test("pack-72311869 (Levothyroxin) is expired, on plan A", async () => {
  const { code } = await scan(image("pack-72311869.png"));
  const plan = PlanReader.resolve(PlanReader.items(xml("plan-a")), catalog, names);
  const r = Pack.evaluate(code, { myMeds: plan.meds, unknownPZNs: plan.unknownPZNs, catalog, names });
  assert.equal(r.kind, "onPlan");
  assert.ok(Pack.expired(r));
});

test("a pill photo has no code", async () => {
  assert.equal(await scan(image("nlm-metformin-2.jpg")), null);
});
