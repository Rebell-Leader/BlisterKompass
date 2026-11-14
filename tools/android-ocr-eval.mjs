// Imprint OCR of the Android app (ML Kit, through the same path as a real photo: pwa/js/vision.js analyzePill →
// android-bridge.js → MainActivity.readImprint) on the NLM C3PI test photos, next to iOS's Vision result in
// test-photos/RESULTS.md.
//
//   node tools/fetch-test-photos.js                      # photos → test-photos/ (not committed)
//   android: ./gradlew installDebug, start the app on an emulator or phone
//   adb forward tcp:9229 localabstract:webview_devtools_remote_$(adb shell pidof de.blisterkompass.app)
//   node tools/android-ocr-eval.mjs [photoDir=test-photos] [port=9229]
//
// Needs a debug build (WebView debugging is on only there). Node 22 (global WebSocket).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = process.argv[2] ?? join(root, "test-photos");
const port = Number(process.argv[3] ?? 9229);
const manifest = JSON.parse(readFileSync(join(root, "test-photos", "manifest.json"), "utf8"));

const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = pages.find((p) => p.url.includes("appassets.androidplatform.net"));
if (!page) throw new Error("BlisterKompass WebView not found – debug build running and adb forward set?");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let seq = 0;
const waiting = new Map();
ws.onmessage = ({ data }) => { const m = JSON.parse(data); waiting.get(m.id)?.(m); waiting.delete(m.id); };
const evaluate = (expression) => new Promise((resolve) => {
  const id = ++seq;
  waiting.set(id, resolve);
  ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
});

const norm = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
let hits = 0;
console.log("| Photo | NLM imprint | Android (ML Kit) | ms |");
console.log("|---|---|---|---|");
for (const e of manifest) {
  const b64 = readFileSync(join(dir, e.file)).toString("base64");
  const t0 = Date.now();
  const r = await evaluate(`(async () => {
    const bin = atob("${b64}"), bytes = new Uint8Array(bin.length); // the app's CSP forbids fetch(data:)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/jpeg" });
    const v = await import("/pwa/js/vision.js");
    const c = await v.analyzePill(blob);
    return c ? c.imprint : null;
  })()`);
  const v = r.result?.result?.value; const read = typeof v === "string" ? v : null;
  if (v != null && typeof v !== "string") console.log("  raw:", JSON.stringify(r.result).slice(0, 300));
  const parts = e.look.imprint.split(";").map(norm).filter(Boolean);
  const ok = !!read && parts.some((p) => norm(read).includes(p) || p.includes(norm(read)) && norm(read).length >= 2);
  if (ok) hits++;
  console.log(`| ${e.file} | ${e.look.imprint} | ${ok ? "✅" : "❌"} ${read ?? "–"} | ${Date.now() - t0} |`);
  if (r.result?.exceptionDetails) console.log("  error:", r.result.exceptionDetails.exception?.description);
}
console.log(`\n**imprint ${hits}/${manifest.length}**`);
ws.close();
