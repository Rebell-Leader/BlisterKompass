// Image work off the main thread: code reading (zxing-wasm) and pill pixels. Nothing leaves the phone.
import { scan } from "./code-reader.js";
import { analyzePixels } from "./recognizer.js";

self.onmessage = async ({ data: { id, op, image } }) => {
  try {
    const result = op === "scan" ? await scan(image) : analyzePixels(image);
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({ id, error: String(e?.message ?? e) });
  }
};
