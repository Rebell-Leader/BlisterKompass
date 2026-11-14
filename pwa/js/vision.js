// Photo → pixels (upright, downscaled) → worker. Photos stay Blobs in memory; they are never uploaded or stored.

let worker = null, seq = 0;
const pending = new Map();

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL("./vision-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
    };
    worker.onerror = () => { worker = false; for (const p of pending.values()) p.reject(new Error("worker")); pending.clear(); };
  } catch {
    worker = false;
  }
  return worker;
}

/** Runs op in the worker; falls back to the main thread where module workers are missing. */
async function run(op, image) {
  const w = getWorker();
  if (w) {
    try {
      return await new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        w.postMessage({ id, op, image }); // copied, not transferred: the fallback below may still need it
      });
    } catch { /* fall through */ }
  }
  if (op === "scan") return (await import("./code-reader.js")).scan(image);
  return (await import("./recognizer.js")).analyzePixels(image);
}

async function bitmap(blob) {
  if ("createImageBitmap" in self) {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch { /* older Safari */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Upright bitmap scaled to maxSide on the long edge (never up). */
function pixels(src, maxSide) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** A medication plan or a medicine pack in the photo: { kind: "plan", xml } | { kind: "pack", code } | null. */
export async function scanCode(blob) {
  const b = await bitmap(blob);
  return run("scan", pixels(b, 2400));
}

/** PillCues of the largest object in the photo. */
export async function analyzePill(blob) {
  const b = await bitmap(blob);
  const small = pixels(b, 320);
  const { cues, box } = await run("pill", small);
  if (cues?.found && box && typeof self.BKReadImprint === "function") cues.imprint = await nativeImprint(b, small.width, box);
  return cues;
}

/** Android app only: on-device text recognition (ML Kit, see android-bridge.js) on the pill, like iOS's Vision OCR:
 *  the pill's box from the 320 px analysis, 15 % margin, on a 1600 px image; the whole photo if the crop reads nothing. */
async function nativeImprint(src, smallWidth, box) {
  try {
    const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
    const k = Math.min(1, 1600 / Math.max(sw, sh));
    const W = Math.round(sw * k), H = Math.round(sh * k), f = W / smallWidth;
    const mx = box.width * f * 0.15, my = box.height * f * 0.15;
    const x = Math.max(0, Math.floor(box.x * f - mx)), y = Math.max(0, Math.floor(box.y * f - my));
    const crop = { x, y, w: Math.min(W, Math.ceil((box.x + box.width) * f + mx)) - x, h: Math.min(H, Math.ceil((box.y + box.height) * f + my)) - y };
    const jpeg = (r) => {
      const c = document.createElement("canvas");
      c.width = r.w; c.height = r.h;
      c.getContext("2d").drawImage(src, r.x / k, r.y / k, r.w / k, r.h / k, 0, 0, r.w, r.h);
      return c.toDataURL("image/jpeg", 0.92);
    };
    return (crop.w > 8 && crop.h > 8 ? await self.BKReadImprint(jpeg(crop)) : null)
      ?? await self.BKReadImprint(jpeg({ x: 0, y: 0, w: W, h: H }));
  } catch (e) {
    console.warn("imprint OCR", e);
    return null;
  }
}
