// Pill pixels on synthetic photos: a pill on a grey table, with a soft shadow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePixels, nearest, labHex, hexOf } from "../js/recognizer.js";

function photo({ w = 320, h = 240, bg = [120, 124, 128], draw }) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const c = draw(x, y) ?? bg;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}
const ellipse = (cx, cy, rx, ry, color, shadow) => (x, y) => {
  if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) return color;
  if (shadow && ((x - cx - 6) / rx) ** 2 + ((y - cy - 6) / ry) ** 2 <= 1) return [95, 98, 101];
  return null;
};

test("palette round-trips through CIELAB", () => {
  assert.equal(nearest(labHex("#F2B8C3")).code, "pink");
  assert.equal(hexOf(labHex("#C9483F")), "#C9483F");
});

test("pink round pill → found, pink, round", () => {
  const { cues } = analyzePixels(photo({ draw: ellipse(160, 120, 40, 40, [242, 184, 195], true) }));
  assert.equal(cues.found, true);
  assert.deepEqual(cues.colors, ["pink"]);
  assert.equal(cues.shape, "round");
});

test("white oval pill with a shadow → white, oval (shadow ignored)", () => {
  const { cues } = analyzePixels(photo({ draw: ellipse(160, 120, 60, 34, [251, 251, 248], true) }));
  assert.deepEqual(cues.colors, ["white"]);
  assert.equal(cues.shape, "oval");
});

test("two-coloured long capsule → capsule with both colours", () => {
  const { cues } = analyzePixels(photo({
    draw: (x, y) => (Math.abs(y - 120) <= 18 && x >= 90 && x <= 230 ? (x < 160 ? [201, 72, 63] : [251, 251, 248]) : null),
  }));
  assert.equal(cues.shape, "capsule");
  assert.deepEqual([...cues.colors].sort(), ["red", "white"]);
});

test("empty table → nothing found", () => {
  const { cues } = analyzePixels(photo({ draw: () => null }));
  assert.equal(cues.found, false);
});
