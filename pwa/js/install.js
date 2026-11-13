// "App installieren": Chrome/Android get the browser's own install dialog (beforeinstallprompt);
// iPhone Safari has none, so we show how: Teilen → Zum Home-Bildschirm. Hidden once installed.

import { h } from "./ui.js";
import { icon } from "./icons.js";

let deferred = null;
let onChange = () => {};
const closedKey = "installHintClosed"; // sessionStorage only: gone when the tab closes

export const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// iPadOS reports itself as a Mac with touch.
const ios = () => !/android/i.test(navigator.userAgent) && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
const closed = () => { try { return sessionStorage.getItem(closedKey) === "1"; } catch { return false; } };

export function watchInstall(changed) {
  onChange = changed;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; onChange(); });
  addEventListener("appinstalled", () => { deferred = null; onChange(); });
}

/** The install card for the home screen, or null when there is nothing to offer. */
export function installCard() {
  if (standalone() || closed()) return null;
  const later = h("button.link.small", { type: "button", onclick: () => { try { sessionStorage.setItem(closedKey, "1"); } catch {} onChange(); } }, "Später");
  if (deferred) {
    return h("div.install", null,
      h("div.install-text", null, h("strong", null, "Als App installieren"), h("span", null, "Startet vom Home-Bildschirm und funktioniert ohne Internet.")),
      h("button.install-btn", { type: "button", onclick: async () => { const d = deferred; deferred = null; await d.prompt(); await d.userChoice.catch(() => {}); onChange(); } }, icon("install"), "Installieren"),
      later);
  }
  if (ios()) {
    return h("div.install", null,
      h("div.install-text", null,
        h("strong", null, "Auf den Home-Bildschirm legen"),
        h("span.steps", null, "Unten auf ", h("span.inline-icon", { "aria-label": "Teilen" }, icon("share")), " Teilen tippen, dann „Zum Home-Bildschirm“.")),
      later);
  }
  return null;
}
