// Service worker: precaches the whole app on the first visit, then serves it from the cache, so BlisterKompass
// works in flight mode. Nothing is fetched from anywhere else. Bump VERSION when any file changes.

const VERSION = "blisterkompass-v14";

const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/bmp-writer.js",
  "js/code-writer.js",
  "js/code-reader.js",
  "js/dose-form.js",
  "js/icons.js",
  "js/install.js",
  "js/leaflet-parser.js",
  "js/leaflet-pdf.js",
  "js/matcher.js",
  "js/model.js",
  "js/pack-code.js",
  "js/plan-reader.js",
  "js/print-sheet.js",
  "js/recognizer.js",
  "js/speech.js",
  "js/store.js",
  "js/ui.js",
  "js/vision.js",
  "js/vision-worker.js",
  "vendor/zxing-wasm/es/share.js",
  "vendor/zxing-wasm/es/reader/index.js",
  "vendor/zxing-wasm/zxing_reader.wasm",
  "vendor/zxing-wasm/es/writer/index.js",
  "vendor/zxing-wasm/zxing_writer.wasm",
  "vendor/pdfjs/pdf.min.mjs",
  "vendor/pdfjs/pdf.worker.min.mjs",
  "data/catalog.json",
  "data/pzn-names.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/favicon.ico",
  "img/plan-hint.png",
  "img/plan-hint-code.png",
  "img/mascot/base.png",
  "img/mascot/scanning.png",
  "img/mascot/found.png",
  "img/mascot/check.png",
  "img/mascot/other-maker.png",
  "img/mascot/not-on-plan.png",
  "img/mascot/not-recognized.png",
  "img/mascot/not-in-list.png",
  "img/mascot/scan-plan.png",
  "icons/mascot-wave.png",
  "icons/mascot-hug.png",
  "icons/mascot-run.png",
  "icons/mascot-search.png",
  "icons/ui-plan.png",
  "icons/ui-pack.png",
  "icons/ui-print.png",
  "icons/ui-lookup.png",
  "icons/mascot-install.png",
    "examples/examples.json",
  "examples/plan-a.png",
  "examples/plan-b.png",
  "examples/plan-c.png",
  "examples/sheet-plan-a.png",
  "examples/plan-kbv-beispiel.png",
  "examples/pack-30477231.png",
  "examples/pack-18342014.png",
  "examples/pack-91200130.png",
  "examples/pack-72311869.png",
  "examples/pack-06453257.png",
  "examples/pack-08693497.png",
  "examples/pack-05387239.png",
  "examples/nlm-pantoprazol-1.jpg",
  "examples/nlm-methotrexat-1.jpg",
  "examples/nlm-metformin-2.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("blisterkompass-") && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // App start (any navigation inside the scope) → the cached shell.
    if (req.mode === "navigate") return (await cache.match("index.html")) ?? fetch(req);
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit ?? fetch(req);
  })());
});
