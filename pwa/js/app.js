// BlisterKompass as a web app. One screen at a time, always a big "Zurück". No tab bars, no hidden gestures.
// Port of RootView, ResultViews, PackViews, PlanInput, OtherViews and ExamplesView (ios/PillSnap).

import { Store } from "./store.js";
import { h, set, bigButton, tile, backBar, statusBanner, mascot, infoRow, tip, chip, purposeRow, scheduleBlock, photo, pillTile, doseFormTile, medPic, medForm, sheet } from "./ui.js";
import { icon } from "./icons.js";
import { SLOTS, SHAPES, sections, title, sourceText, dayName, countText, spoken, spokenLines, capitalizedFirst, adding, nextText, NOT_RECORDED } from "./model.js";
import { doseForm } from "./dose-form.js";
import { local } from "./matcher.js";
import * as Pack from "./pack-code.js";
import * as PlanReader from "./plan-reader.js";
import { PALETTE, colorName } from "./recognizer.js";
import { scanCode, analyzePill } from "./vision.js";
import { say, sayLines, stop } from "./speech.js";
import { watchInstall, installCard } from "./install.js";
import * as LeafletPdf from "./leaflet-pdf.js";
import { leafletPage, leafletPdf } from "./leaflet-parser.js";
import * as PrintSheet from "./print-sheet.js";
import * as Bmp from "./bmp-writer.js";

const store = new Store();
const root = document.getElementById("app");
let route = { name: "home" };
let cleanup = [];

function go(r) {
  stop();
  for (const f of cleanup) f();
  cleanup = [];
  if (r.name !== "home" && route.name === "home") history.pushState({ pill: 1 }, "");
  route = r;
  render();
}
addEventListener("popstate", () => { if (route.name !== "home") { route = { name: "home" }; for (const f of cleanup) f(); cleanup = []; stop(); render(); } });
const home = () => { if (history.state?.pill) history.back(); else go({ name: "home" }); };

function render() {
  const screen = SCREENS[route.name](route);
  set(root, screen);
  root.dataset.screen = route.name;
  window.scrollTo(0, 0);
  const focus = screen.querySelector("[data-autofocus]");
  if (focus) focus.focus();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Photos: the camera opens straight from the file input (capture="environment"); no permission code.

const camera = document.getElementById("camera");
const library = document.getElementById("library");
let onPhoto = null;
for (const input of [camera, library]) {
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    input.value = "";
    if (f && onPhoto) onPhoto(f);
  });
}
/** `mode` is what the button asked for: "plan", "pack" or "photo" (a pill). Only that kind of input is accepted. */
function takePhoto(source, mode, then = (blob) => go({ name: "analyzing", photo: blob, mode })) {
  onPhoto = then;
  (source === "camera" ? camera : library).click();
}

function photoSourceSheet(titleText, kind) {
  sheet(titleText, (close) => h("div.row", null,
    tile({ icon: "camera", title: "Kamera", onClick: () => { close(); takePhoto("camera", kind); } }),
    tile({ icon: "photos", title: "Beispiele", onClick: () => { close(); go({ name: "examples", kind }); } })));
}

function planSourceSheet() {
  sheet("Plan einlesen", (close) => h("div.stack", null,
    bigButton({ icon: "camera", title: "Kamera", height: 104, onClick: () => { close(); takePhoto("camera", "plan"); } }),
    h("div.row", null,
      tile({ icon: "photos", title: "Beispiele", onClick: () => { close(); go({ name: "examples", kind: "plan" }); } }),
      tile({ icon: "keyboard", title: "Selbst\neingeben", onClick: () => { close(); go({ name: "manualPlan" }); } }))));
}

// Home -----------------------------------------------------------------------

function Home() {
  return h("main.screen.home", null,
    h("p.privacy", null, icon("shield"), "Offline · keine Daten verlassen das Smartphone"),
    installCard(),
    store.hasPlan ? scanPill() : onboarding());
}

// One clock for the whole app (T-01): every minute it redraws only the day list, in place, so the scroll position stays and
// no screen ever starts a second timer.
setInterval(() => {
  const day = route.name === "home" ? root.querySelector("section.day") : null;
  if (day) day.replaceWith(dayPlanList());
}, 60_000);

function onboarding() {
  return h("section.onboarding", null,
    h("div.hero-icon", null, h("img.mascot", { src: "icons/mascot-wave.png", alt: "", width: 480, height: 480, decoding: "async" })),
    h("h1", null, "Willkommen!"),
    h("p.lead", null, "Lesen Sie zuerst Ihren ", h("strong", null, "Medikationsplan"), " ein – per Kamera, aus den Beispielen oder selbst eingeben."),
    bigButton({ icon: "qr", mascot: "scan-plan", title: "Plan einlesen", height: 230, onClick: planSourceSheet }),
    tip({ text: [h("strong", null, "Den Code oben rechts"), " auf dem Plan ganz ins Bild nehmen."] }));
}

function scanPill() {
  // The often-used actions on top (plan, pack, print), then my pills for now and later; the pill photo, the look picker
  // and the "not recorded" note at the bottom.
  return h("section.stack", null,
    h("div.row.three", null,
      bigButton({ icon: "qr", title: "Plan neu\neinlesen", height: 120, compact: true, onClick: planSourceSheet }),
      bigButton({ icon: "barcode", title: "Packung", height: 120, compact: true, onClick: () => photoSourceSheet("Packung scannen", "pack") }),
      bigButton({ icon: "printer", title: "Plan\ndrucken", height: 120, compact: true, onClick: () => go({ name: "printPlan" }) })),
    dayPlanList(),
    h("div.row.top-gap", null,
      tile({ icon: "camera", title: "Tablette", onClick: () => photoSourceSheet("Tablette prüfen", "photo") }),
      tile({ icon: "tap", title: "Aussehen\nantippen", onClick: () => go({ name: "picker" }) })),
    h("p.muted.small.with-icon", null, icon("info"), NOT_RECORDED));
}

function sectionHeader(s) {
  switch (s.kind) {
    case "slot": {
      // Past slots of today say so – never "Morgen" (T-06); after midnight the night slot is last night's.
      const slot = SLOTS.find((x) => x.id === s.slot);
      if (s.lastNight) return { text: `${slot.label} · seit gestern Abend`, icon: slot.icon, fill: "var(--gray-fill)" };
      if (s.past) return { text: `Heute vorbei · ${slot.label}`, icon: slot.icon, fill: "var(--gray-fill)" };
      return { text: `${s.now ? "Jetzt" : "Später"} · ${slot.label}`, icon: slot.icon, fill: slot.hex };
    }
    case "weeklyToday": return { text: "Heute · 1× pro Woche", icon: "calendarAlert", fill: "var(--bad-fill)" };
    case "weeklyLater": return { text: "Einmal pro Woche", icon: "calendar", fill: "var(--bad-fill)" };
    case "text": return { text: "Nach besonderem Schema (laut Plan)", icon: "doc", fill: "var(--accent-fill)" };
    default: return { text: "Nur bei Bedarf", icon: "hand", fill: "var(--accent-fill)" };
  }
}

function dayPlanList() {
  const date = new Date();
  const secs = sections(store.myMeds, date);
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return h("section.day", null,
    h("div.day-head", null,
      h("h2", null, "Meine Tabletten"), h("span.muted", null, `${time} Uhr`),
      h("button.round", { type: "button", "aria-label": "Vorlesen", title: "Vorlesen", onclick: () => sayLines(spokenLines(secs)) }, icon("speaker"))),
    secs.map((s) => {
      const hd = sectionHeader(s);
      return h(`div.day-section${s.now ? ".now" : ""}`, null,
        h("div.pill-label", { style: { background: hd.fill } }, icon(hd.icon), hd.text),
        s.entries.map((e) => {
          const sch = e.med.schedule;
          const day = sch?.kind === "weekly" ? sch.days?.[0] : null;
          return h(`button.day-row${s.now ? ".due" : ""}`, { type: "button", onclick: () => go({ name: "detail", med: e.med }) },
            medPic(e.med, s.now ? 104 : 56, "bgtile"),
            h("div.day-text", null,
              h("div.day-name", null, e.med.substance),
              e.med.strength ? h("div.muted", null, e.med.strength) : null,
              e.amount != null ? h("div.day-count", null, countText(e.amount, e.med.look, sch?.unit, e.dose))
                : s.kind === "slot" && sch?.kind === "daily" ? h("div.day-count.tone-warn", null, "Menge nicht angegeben") : null,
              mealLine(e.med),
              s.kind === "weeklyLater" ? h("div.day-count.tone-bad", null, nextText(day, e.next))
                : day ? h("div.day-count.tone-bad", null, `nur am ${dayName(day)}`) : null,
              s.kind === "text" ? h("div.day-count", null, sch?.text ? `laut Plan: ${sch.text}` : "Dosierung steht nicht auf dem Plan") : null,
              s.kind === "prn" && sch?.text && sch.text.toLowerCase() !== "bei bedarf" ? h("div.day-count", null, sch.text) : null,
              e.med.look ? null : h("div.muted.small", null, [medForm(e.med)?.label, "Aussehen unbekannt"].filter(Boolean).join(" · "))));
        }));
    }),
    store.unknownPZNs.length ? [
      h("h3.muted", null, "Ohne Bild"),
      store.unknownPZNs.map((pzn) => {
        const form = doseForm(store.pznName(pzn)?.form);
        return h("div.day-row.nolook", null, doseFormTile(form, 56),
          h("div.day-text", null, h("div.day-name.small", null, store.nameOf(pzn)), h("div.muted.small", null, [form?.label, "Aussehen unbekannt"].filter(Boolean).join(" · "))));
      }),
    ] : null);
}

// Analyzing: only what the chosen mode asked for --------------------------------
// A plan or pack photo never falls through to pill recognition, and a pill photo with a code on it is not read as a pill.

function Analyzing({ photo: blob, mode }) {
  const status = h("div.analyzing-status", null, mascot("scanning", "scanning"), h("span", null, "Ich schaue mir das Foto an …"));
  const below = h("div.stack");
  const el = h("main.screen", null,
    backBar({ title: "Erkennen", onBack: home }),
    h("div.scanbox", null, photo(blob, "photo-fill"), h("div.scanline")),
    status, below);
  let alive = true;
  cleanup.push(() => { alive = false; });
  (async () => {
    const started = Date.now();
    const settle = () => wait(Math.max(0, 1200 - (Date.now() - started)));
    let found = null;
    try { found = await scanCode(blob); } catch (e) { console.warn("code reader", e); }
    if (!alive) return;
    const noCode = async (problem) => { await settle(); if (alive) go({ name: "result", answer: local("no_code", [], problem), photo: blob }); };
    if (mode === "plan") {
      if (found?.kind !== "plan") return noCode(found ? "pack_not_plan" : "no_plan_code");
      // Plan code → read the medication lines (nothing else) on the phone.
      await settle(); if (!alive) return;
      const plan = store.readPlan(found.xml);
      if (plan?.invalid) return go({ name: "result", answer: local("not_a_plan", [], `invalid_${plan.invalid}`), photo: blob });
      return plan ? go({ name: "bmpImport", plan, photo: blob }) : go({ name: "result", answer: local("not_a_plan"), photo: blob });
    }
    if (mode === "pack") {
      if (found?.kind !== "pack") return noCode(found ? "plan_not_pack" : "no_pack_code");
      // A medicine pack: exact identity from its PZN, compared with the plan.
      await settle(); if (!alive) return;
      return go({ name: "pack", result: store.check(found.code), photo: blob });
    }
    // Pill mode: a photo with a code on it is not a pill.
    if (found) return noCode("code_not_pill");
    // A pill – matched against the scanned plan, on the phone.
    if (!store.hasPlan) { await settle(); if (alive) go({ name: "result", answer: local("need_plan"), photo: blob }); return; }
    let cues = null;
    try { cues = await analyzePill(blob); } catch (e) { console.warn("pill", e); }
    await settle(); if (!alive) return;
    if (!cues?.found || !cues.colors.length) return go({ name: "result", answer: local("retake", [], "no_pill"), photo: blob });
    // No imprint OCR in the browser (v1): ask what is printed on it; the matcher takes the typed text.
    set(status, icon("text"), h("span", null, "Was steht auf der Tablette?"));
    status.classList.add("asking");
    const input = h("input.field", { type: "text", inputmode: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "z. B. A20", "aria-label": "Aufdruck auf der Tablette", maxlength: "12" });
    const done = (imprint) => go({ name: "result", answer: store.identify({ ...cues, imprint: imprint || null }), photo: blob });
    set(below, 
      seenChips(cues),
      h("form.stack", { onsubmit: (e) => { e.preventDefault(); done(input.value.trim()); } },
        input,
        h("div.row", null,
          bigButton({ icon: "x", title: "Kein Aufdruck", height: 92, color: "gray", onClick: () => done("") }),
          bigButton({ icon: "check", title: "Weiter", height: 92, color: "ok", onClick: () => done(input.value.trim()) }))));
  })();
  return el;
}

/** "Ich sehe: ● rosa · rund" – what the on-device recognition found. */
function seenChips(cues) {
  return h("div.seen", null, h("div.muted.strong", null, "Ich sehe:"),
    h("div.chips", null,
      cues.colors.map((c, i) => h("span.chip.lg", null, h("span.swatch", { style: { background: cues.seenHex[i] ?? PALETTE.find((p) => p.code === c)?.hex } }), colorName(c))),
      cues.shape ? h("span.chip.lg", null, icon("pills"), SHAPES.find((s) => s.code === cues.shape)?.name ?? cues.shape) : null,
      cues.imprint ? h("span.chip.lg", null, icon("text"), `„${cues.imprint}“`) : null));
}

// Plan scanned → take over my meds ----------------------------------------------

// Pages of a multi-page plan read in this session, by MP/@U. Memory only: nothing of a page is stored until "Übernehmen".
const planPages = new Map();

/** A plan page was read. One page of several: keep it and ask for the others. A plan with missing pages is never adopted:
 *  the saved list couldn't say it is incomplete, so medicines would silently be missing from the day view and the print. */
function BmpImport({ plan: page, photo: blob }) {
  let plan = page;
  if ((page.pages ?? 1) > 1 && page.code) {
    const key = page.id ?? "?";
    const got = (planPages.get(key) ?? []).filter((p) => p.page !== page.code.page);
    got.push(page.code);
    planPages.set(key, got);
    plan = store.resolvePlan(PlanReader.mergePages(got));
    if (plan.missing.length) return pagesMissing(plan, key);
    planPages.delete(key);
  }
  return planLookup(plan);
}

function pagesMissing(plan, key) {
  const missing = plan.missing.join(" und ");
  say(`Seite erkannt. Dieser Plan hat ${plan.pages} Seiten. Bitte auch Seite ${missing} einlesen.`);
  return h("main.screen", null,
    backBar({ title: "Medikationsplan", onBack: home }),
    statusBanner({ icon: "seal", text: `Seite erkannt – Seite ${missing} fehlt noch`, color: "warn" }),
    h("p.lead", null, `Dieser Plan hat ${plan.pages} Seiten. Bitte lesen Sie auch Seite ${missing} ein, dann ist die Liste vollständig.`),
    h("p.muted.with-icon", null, icon("info"), "Ohne alle Seiten kann der Plan nicht übernommen werden – sonst fehlen Medikamente in Ihrer Liste. Ihre bisherige Liste bleibt, wie sie ist."),
    bigButton({ icon: "camera", title: `Seite ${plan.missing[0]} einlesen`, height: 104, onClick: () => takePhoto("camera", "plan") }),
    bigButton({ icon: "x", title: "Abbrechen", height: 86, color: "gray", onClick: () => { planPages.delete(key); home(); } }));
}

function planLookup(plan) {
  const items = [
    ...plan.meds.map((m) => ({ id: m.pzn, title: title(m), look: m.look, form: m.look ? null : medForm(m) })),
    ...plan.unknownPZNs.filter((p) => !plan.meds.some((m) => m.pzn === p)).map((p) => ({ id: p, title: store.nameOf(p), look: null, form: doseForm(store.pznName(p)?.form) })),
  ];
  if (!items.length) return emptyPlan(plan);
  const el = h("main.screen");
  const showResult = (p = plan) => { set(el, ...bmpResult(p, showResult)); };
  const skip = h("button.link", { type: "button", onclick: () => { alive = false; showResult(); } }, "Überspringen");
  const list = h("div.stack.tight");
  el.append(backBar({ title: "Medikationsplan", onBack: home }),
    statusBanner({ icon: "seal", text: "Plan erkannt", color: "ok", mascot: "found" }),
    h("h2.with-icon", null, icon("doc"), "Aussehen wird nachgeschlagen"), list, skip);
  let alive = true;
  cleanup.push(() => { alive = false; });
  say(`Medikationsplan erkannt: ${items.length} Medikamente. Ich schaue nach, wie sie aussehen.`);
  lookupRows(list, items, () => alive).then(async (ok) => { if (!ok) return; await wait(600); if (alive) showResult(); });
  return el;
}

function emptyPlan(plan) {
  return h("main.screen", null,
    backBar({ title: "Medikationsplan", onBack: home }),
    statusBanner({ icon: "question", text: "Plan ohne Medikamente", color: "warn" }),
    h("p.lead", null, "Auf diesem Plan steht kein Medikament. Ihre bisherige Liste bleibt, wie sie ist."),
    plan.notes?.length ? notesBlock(plan.notes) : null,
    bigButton({ icon: "back", title: "Zurück", height: 96, color: "gray", onClick: home }));
}

/** <X> free-text lines of the plan ("Allergiehinweise", "Wichtige Hinweise" …): shown here, never stored. */
function notesBlock(notes) {
  return h("div.card.stack.tight", null,
    h("strong.with-icon", null, icon("info"), "Hinweise auf dem Plan"),
    notes.map((n) => h("p", null, n.section ? h("span.muted", null, `${n.section}: `) : null, n.text)),
    h("p.muted.small", null, "Werden nicht gespeichert – sie stehen weiter auf Ihrem Papierplan."));
}

function bmpResult(plan, rerender) {
  // Entries without picture data: their look can still come from the leaflet PDF the person picks.
  // Only for PZNs the official list names: without an official name a picked leaflet can't be tied to the pack.
  const pickable = plan.unknownPZNs.filter((p) => store.pznName(p) && leafletWanted(doseForm(store.pznName(p)?.form)));
  const reread = () => { if (plan.code) rerender(store.resolvePlan(plan.code)); };
  return [
    backBar({ title: "Medikationsplan", onBack: home }),
    statusBanner({ icon: "seal", text: "Plan erkannt", color: "ok", mascot: "found" }),
    h("h2", null, plan.meds.length === 1 ? "1 Medikament" : `${plan.meds.length} Medikamente`),
    plan.unknown.length ? h("p.tone-warn.with-icon", null, icon("question"), `${plan.unknown.length} ohne Bilddaten: ${plan.unknown.join(", ")}`) : null,
    h("div.grid3", null, plan.meds.map((m) => h("div.card.mini", null, medPic(m, 50), h("strong", null, m.substance)))),
    plan.notes?.length ? notesBlock(plan.notes) : null,
    pickable.length && plan.code ? [leafletHint(), pickable.map((p) => leafletPicker(p, store.nameOf(p), reread))] : null,
    store.hasPlan ? h("p.muted.with-icon.center", null, icon("refresh"), "Ersetzt Ihren bisherigen Plan.") : null,
    bigButton({ icon: "check", title: "Übernehmen", height: 96, color: "ok", onClick: () => {
      if (!store.adopt(plan)) return;
      say(`${plan.meds.length} Medikamente übernommen. Sie können jetzt eine Tablette scannen.`);
      home();
    } }),
  ];
}

/** "Wie sieht das aus?" – row by row from the package leaflets stored on the phone. The pause per row is
 *  for presentation; what each row shows is the real stored source and quote. */
async function lookupRows(list, items, alive) {
  for (const it of items) {
    const row = lookupRow(it, true);
    list.append(row);
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const source = it.look?.source ? (it.look.source.startsWith("leaflet:") ? "leaflet" : "reference") : "formOnly";
    await wait(source === "leaflet" ? 750 : 250);
    if (!alive()) return false;
    row.replaceWith(lookupRow(it, false));
  }
  return true;
}

function lookupRow(it, busy) {
  const source = it.look?.source ? (it.look.source.startsWith("leaflet:") ? "leaflet" : "reference") : it.form ? "formOnly" : "unknown";
  const pic = busy ? h("span.spinner") : it.look ? pillTile(it.look, 52) : doseFormTile(it.form, 52);
  let status;
  if (busy) status = h("div.muted.small.with-icon", null, icon("doc"), source === "leaflet" ? "Packungsbeilage wird gelesen …" : "Wird nachgeschlagen …");
  else if (source === "leaflet") status = h("div.muted.small.clamp2", null, it.look.leaflet ? `„${it.look.leaflet}“` : "Aussehen laut Packungsbeilage");
  else if (source === "reference") status = h("div.muted.small", null, sourceText(it.look) ?? "");
  else status = h("div.small.tone-warn", null, it.form ? `Keine Packungsbeilage · ${it.form.label}, Aussehen unbekannt` : "Keine Packungsbeilage · Aussehen unbekannt");
  const mark = busy ? null : h(`span.mark.tone-${source === "leaflet" ? "ok" : source === "reference" ? "muted" : "warn"}`, null, icon(source === "leaflet" || source === "reference" ? "seal" : "question"));
  return h("div.card.lookup", null, h("div.lookup-pic", null, pic), h("div.lookup-text", null, h("strong", null, it.title), status), mark);
}

// Leaflet PDF picked by the person ----------------------------------------------
// The leaflet hosts send no CORS headers, so the web app can't download a leaflet as the iPhone app does. Instead the
// person opens it at Apotheken Umschau, saves the "Original Beipackzettel" PDF and picks it here. The file is read on
// the phone (pdf.js) and never uploaded; only a clear section 6 gives a picture, otherwise the look stays unknown.

/** Leaflets describe the look of tablets and capsules; drops, sprays, creams … have none to read. */
const leafletWanted = (form) => form == null || form.family === "tablet" || form.family === "capsule";

const leafletHint = () => h("p.muted.small.with-icon", null, icon("info"),
  "Aussehen aus der Packungsbeilage: „Beipackzettel öffnen“ und das PDF sichern (Teilen → In Dateien sichern). Dann hier „PDF wählen“. Die Datei bleibt auf dem Handy.");

const LEAFLET_FAIL = {
  wrong: (t, other) => `Diese Packungsbeilage gehört zu einem anderen Medikament${other ? ` (${other})` : ""}. Bitte die Beilage zu ${t} wählen.`,
  unbound: (t) => `Diese Packungsbeilage lässt sich ${t} nicht sicher zuordnen: Produktname, Hersteller oder Stärke der Packung fehlen darin. Das Aussehen bleibt unbekannt.`,
  unclear: () => "Die Packungsbeilage beschreibt das Aussehen nicht eindeutig. Es bleibt unbekannt.",
  notPdf: () => "Das ist keine lesbare PDF-Datei.",
};

function leafletPicker(pzn, titleText, onFound) {
  const pdf = leafletPdf(pzn);
  if (!pdf) return null;
  const status = h("div");
  const input = h("input", { type: "file", accept: "application/pdf,.pdf", hidden: true });
  input.addEventListener("change", async () => {
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    set(status, h("div.muted.small.with-icon", null, h("span.spinner"), "Packungsbeilage wird gelesen …"));
    let r;
    try { r = await LeafletPdf.read(f, pzn, store.names); } catch (e) { console.warn("leaflet", e); r = { state: "notPdf" }; }
    if (r.state === "found") {
      store.learn(r.med);
      say(`Aussehen aus der Packungsbeilage gelesen: ${title(r.med)}.`);
      onFound(r.med);
      return;
    }
    set(status, h("p.small.tone-warn.with-icon", null, icon("question"), LEAFLET_FAIL[r.state](titleText, r.leafletSubstance)));
  });
  return h("div.card.stack.tight.leaflet-pick", null,
    h("strong", null, titleText),
    h("div.grid2", null,
      h("a.big.fill-gray", { href: pdf, target: "_blank", rel: "noopener noreferrer", style: { "--h": "76px" } }, icon("search"), h("span", null, "Beipackzettel öffnen")),
      bigButton({ icon: "doc", title: "PDF wählen", height: 76, onClick: () => input.click() })),
    h("a.link", { href: leafletPage(pzn), target: "_blank", rel: "noopener noreferrer" }, "Nicht gefunden? Bei Apotheken Umschau"),
    input, status);
}

// Results -------------------------------------------------------------------

function Result({ answer, photo: blob }) {
  switch (answer.state) {
    case "sure": case "likely":
      return medCard(answer.candidates[0], blob, answer.state);
    case "choose":
      return choose("Welche ist es?", answer.candidates ?? [], answer.question, blob);
    case "other_maker":
      return otherMaker(answer.candidates[0], answer.notOnPlan, blob);
    case "other_strength":
      return otherStrength(answer.candidates[0], answer.notOnPlan, blob);
    case "not_on_plan":
      return notOnPlan(answer.notOnPlan, blob);
    default:
      return notRecognized(answer, blob);
  }
}

const BANNER = {
  sure: { text: "Passt zu Ihrem Plan – bitte prüfen", icon: "seal", color: "ok", mascot: "found" }, // a look, never proof (INV-15)
  likely: { text: "Wahrscheinlich – bitte prüfen", icon: "question", color: "warn", mascot: "check" },
  confirmed: { text: "Auf Ihrem Plan", icon: "seal", color: "ok", mascot: "found" }, // opened from the list: a plan entry, not a photo match
};

/** One of my medications, big and clear. */
function medCard(med, blob, banner) {
  const b = BANNER[banner];
  if (banner !== "confirmed") say(`${med.substance ?? med.name}. ${med.indication?.de ?? ""}`);
  return h("main.screen", null,
    backBar({ onBack: home, onSpeak: () => say(spoken(med, { check: banner === "sure" || banner === "likely" })) }),
    statusBanner(b),
    h("div.compare-row", null,
      blob ? [photo(blob, "photo-sq"), h("span.muted.equal", null, icon("equal"))] : null,
      medPic(med, 112, "card")),
    med.look ? (sourceText(med.look) ? h("p.muted.small.center", null, sourceText(med.look)) : null)
      : h("p.small.center.tone-warn", null, [medForm(med)?.label, "Aussehen unbekannt – bitte Apotheke fragen"].filter(Boolean).join(" · ")),
    h("div.med-title", null, h("h1", null, med.substance ?? med.name), med.strength ? h("p.muted.strength", null, med.strength) : null,
      med.nameOnly || !med.name || med.look ? null : h("p.muted.small", null, med.name)),
    med.sectionLabel ? h("div.chips", null, chip("doc", med.sectionLabel, "accent")) : null,
    purposeRow(med),
    scheduleBlock(med),
    med.schedule?.note ? infoRow({ icon: "fork", title: "Hinweis", value: med.schedule.note, tone: "accent" }) : null,
    med.extra ? infoRow({ icon: "info", title: "Zusatz auf dem Plan", value: med.extra, tone: "accent" }) : null,
    banner !== "confirmed" ? h("div.row.bottom", null,
      bigButton({ icon: "x", title: "Nein", height: 92, color: "gray", onClick: () => go({ name: "result", answer: local("choose", store.myMeds.filter((m) => m.look)), photo: blob }) }),
      bigButton({ icon: "check", title: "Ja, stimmt", height: 92, color: "ok", onClick: home })) : null);
}

function otherMaker(mine, other, blob) {
  const text = `Achtung. Diese Tablette sieht anders aus als auf Ihrem Plan. Sie sieht aus wie ${mine.substance} von einem anderen Hersteller. Bitte mit Apotheke oder Praxis klären, bevor Sie etwas ändern.`;
  say(text);
  return h("main.screen", null,
    backBar({ onBack: home, onSpeak: () => say(text) }),
    statusBanner({ icon: "alert", text: "Anders als auf Ihrem Plan", color: "warn", mascot: "other-maker" }),
    h("div.compare", null,
      h("div.side", null, h("div.muted.strong", null, "Ihr Foto"), blob ? photo(blob, "photo-sq") : pillTile(other.look, 120), h("strong.small", null, other.manufacturer ?? "")),
      h("span.muted.arrows", null, icon("arrowsLR")),
      h("div.side", null, h("div.muted.strong", null, "Auf Ihrem Plan"), pillTile(mine.look, 120, "card"), h("strong.small", null, mine.manufacturer ?? ""))),
    infoRow({ icon: "question", title: "Sieht aus wie", value: `${title(mine)} – anderer Hersteller`, tone: "warn" }),
    infoRow({ icon: "pharmacy", title: "Bitte", value: "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern.", tone: "bad" }),
    h("div.row.bottom", null,
      bigButton({ icon: "camera", title: "Nochmal", height: 92, color: "gray", onClick: home }),
      bigButton({ icon: "check", title: "Verstanden", height: 92, color: "warn", onClick: home })));
}

/** The photo looks like the same substance in another strength (or a related product): shown with its own title next to the
 *  plan's, never as the plan entry (T-04). Unresolved: only the pharmacy or practice can say what it is. */
function otherStrength(mine, other, blob) {
  const text = `Achtung. Diese Tablette sieht aus wie ${title(other)}. Auf Ihrem Plan steht ${title(mine)}. Bitte mit Apotheke oder Praxis klären, bevor Sie etwas ändern.`;
  say(text);
  return h("main.screen", null,
    backBar({ onBack: home, onSpeak: () => say(text) }),
    statusBanner({ icon: "alert", text: "Andere Stärke als auf Ihrem Plan?", color: "warn", mascot: "other-maker" }),
    h("div.compare", null,
      h("div.side", null, h("div.muted.strong", null, "Ihr Foto"), blob ? photo(blob, "photo-sq") : pillTile(other.look, 120)),
      h("span.muted.arrows", null, icon("arrowsLR")),
      h("div.side", null, h("div.muted.strong", null, "Auf Ihrem Plan"), mine.look ? pillTile(mine.look, 120, "card") : h("span.muted.unknown", null, icon("question", { size: 44 })))),
    infoRow({ icon: "question", title: "Sieht aus wie", value: title(other), tone: "warn" }),
    infoRow({ icon: "doc", title: "Auf Ihrem Plan", value: title(mine), tone: "accent" }),
    infoRow({ icon: "pharmacy", title: "Bitte", value: "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern.", tone: "bad" }),
    h("div.row.bottom", null,
      bigButton({ icon: "camera", title: "Nochmal", height: 92, color: "gray", onClick: home }),
      bigButton({ icon: "check", title: "Verstanden", height: 92, color: "warn", onClick: home })));
}

function choose(heading, candidates, question, blob) {
  const el = h("main.screen");
  const draw = (filter) => {
    const shown = filter ? candidates.filter((c) => filter.includes(c.substance)) : candidates;
    const cols = shown.length > 4 ? 3 : 2;
    set(el, 
      backBar({ onBack: home }),
      h("div.choose-head", null, blob ? photo(blob, "photo-sm") : null, h("h1", null, heading)),
      question && !filter && candidates.length > 1 ? h("div.card.question", null,
        h("p.with-icon.strong", null, icon("question"), question.question),
        h(`div.${question.answers.length <= 2 ? "row" : "stack"}.tight`, null,
          question.answers.map((a) => h("button.answer", { type: "button", onclick: () => draw(a.meds) }, capitalizedFirst(a.answer))))) : null,
      h("p.muted", null, "Tippen Sie auf Ihre Tablette:"),
      h(`div.grid${cols}`, null, shown.map((m) => medTile(m, cols === 3, () => go({ name: "detail", med: m, photo: blob })))));
  };
  draw(null);
  return el;
}

function medTile(med, compact, onClick) {
  const p = med.indication ? purposeRowSmall(med) : null;
  return h(`button.card.medtile${compact ? ".compact" : ""}`, { type: "button", onclick: onClick },
    medPic(med, compact ? 56 : 84), h("strong", null, med.substance), compact ? null : p);
}
function purposeRowSmall(med) {
  return h("span.small.muted.with-icon.clamp1", null, med.indication.de);
}

function notOnPlan(med, blob) {
  const text = "Achtung. Diese Tablette steht nicht auf Ihrem Plan. Bitte in der Apotheke oder beim Arzt nachfragen.";
  say("Achtung. Diese Tablette steht nicht auf Ihrem Plan.");
  return h("main.screen", null,
    backBar({ onBack: home, onSpeak: () => say(text) }),
    statusBanner({ icon: "octagon", text: "Nicht auf Ihrem Plan!", color: "bad", mascot: "not-on-plan" }),
    h("div.card.row-start", null, blob ? photo(blob, "photo-sq") : null,
      med ? h("div", null, h("div.muted.small", null, "Sieht aus wie"), h("h2", null, title(med)), med.indication ? h("div.muted.small", null, med.indication.de) : null) : null),
    infoRow({ icon: "noEntry", title: "Bitte", value: "Mit Apotheke oder Praxis klären, bevor Sie etwas ändern.", tone: "bad" }),
    infoRow({ icon: "pharmacy", title: "Tipp", value: "Tablette mit Packung in die Apotheke mitnehmen.", tone: "accent" }),
    h("div.row.bottom", null,
      bigButton({ icon: "camera", title: "Nochmal", height: 92, color: "gray", onClick: home }),
      bigButton({ icon: "check", title: "Verstanden", height: 92, color: "bad", onClick: home })));
}

const HINTS = {
  blurry: "Das Foto ist unscharf.", dark: "Das Foto ist zu dunkel.", too_far: "Bitte näher herangehen.",
  several_pills: "Bitte nur eine Tablette aufs Foto.", no_pill: "Ich sehe keine Tablette.",
  need_plan: "Bitte zuerst den Code auf Ihrem Medikationsplan scannen.", not_a_plan: "Dieser Code ist kein Medikationsplan.",
  no_plan_code: "Ich finde keinen Plan-Code. Bitte den Code oben rechts auf dem Plan ganz ins Bild nehmen.",
  no_pack_code: "Ich finde keinen Code auf der Packung. Bitte den quadratischen Code oder den Strichcode ganz ins Bild nehmen.",
  pack_not_plan: "Das ist ein Packungs-Code, kein Medikationsplan.",
  plan_not_pack: "Das ist ein Medikationsplan. Dafür bitte „Plan neu einlesen“ wählen.",
  code_not_pill: "Auf dem Foto ist ein Code, keine Tablette. Für Packungen bitte „Packung“ wählen.",
  // A plan code that breaks BMP 2.8 is refused with its reason (plan-reader.js INVALID); the old list stays.
  ...Object.fromEntries(Object.entries(PlanReader.INVALID).map(([k, v]) => [`invalid_${k}`, `${v} Der Plan wurde nicht übernommen – bitte in der Praxis nachfragen.`])),
};

function notRecognized(answer, blob) {
  const hint = HINTS[answer.problem ?? answer.state] ?? "Keine Tablette Ihres Plans passt.";
  return h("main.screen", null,
    backBar({ onBack: home }),
    statusBanner({ icon: "eyeSlash", text: answer.state === "need_plan" ? "Noch kein Plan" : "Nicht erkannt", color: "warn", mascot: "not-recognized" }),
    blob ? photo(blob, "photo-wide") : null,
    infoRow({ icon: "info", title: "Grund", value: hint, tone: "warn" }),
    h("div.row.bottom", null,
      bigButton({ icon: "camera", title: "Nochmal", height: 110, onClick: home }),
      ["need_plan", "not_a_plan", "no_code"].includes(answer.state) ? null
        : bigButton({ icon: "tap", title: "Antippen", height: 110, color: "ok", onClick: () => go({ name: "picker", photo: blob }) })));
}

// Without a photo: tap colour and shape -----------------------------------------

function Picker({ photo: blob }) {
  let color = null, shape = null;
  const el = h("main.screen");
  const imprint = h("input.field", { type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "z. B. A20 (falls vorhanden)", "aria-label": "Aufdruck", maxlength: "12" });
  const search = () => {
    if (!store.hasPlan) return go({ name: "result", answer: local("need_plan"), photo: blob });
    const cues = { found: true, colors: color ? [color] : [], shape, imprint: imprint.value.trim() || null, seenHex: [] };
    go({ name: "result", answer: store.identify(cues), photo: blob });
  };
  const sample = (code) => {
    const hex = PALETTE.find((p) => p.code === color)?.hex ?? "#E9EDF1";
    const [l, w] = code === "round" || code === "heart" ? [8, 8] : code === "oval" ? [10, 7] : [12, 5.5];
    return { shape: code, color: color ?? "white", lengthMm: l, widthMm: w, score: "none", finish: "matte", colorHex: hex, color2Hex: code === "capsule" ? "#FBFBF8" : null, colorName: { de: "" } };
  };
  const draw = () => {
    set(el, 
      backBar({ title: "Aussehen", onBack: home }),
      blob ? photo(blob, "photo-strip") : null,
      step(1, "Welche Farbe?"),
      h("div.grid4.tight", { role: "radiogroup", "aria-label": "Farbe" }, PALETTE.map((c) =>
        h(`button.color${color === c.code ? ".on" : ""}`, { type: "button", role: "radio", "aria-checked": String(color === c.code), onclick: () => { color = c.code; draw(); } },
          h("span.dot", { style: { background: c.hex } }, color === c.code ? icon("check") : null), h("span", null, c.name)))),
      step(2, "Welche Form?"),
      h("div.shapes", { role: "radiogroup", "aria-label": "Form" }, SHAPES.map((s) =>
        h(`button.shape${shape === s.code ? ".on" : ""}`, { type: "button", role: "radio", "aria-checked": String(shape === s.code), onclick: () => { shape = s.code; draw(); } },
          pillTile(sample(s.code), 46), h("span", null, s.name)))),
      step(3, "Was steht drauf?"),
      imprint,
      bigButton({ icon: "search", title: "Suchen", height: 92, color: color == null && shape == null ? "disabled" : "accent", disabled: color == null && shape == null, onClick: search }));
  };
  draw();
  return el;
}

const step = (n, text) => h("div.step", null, h("span.step-n", null, String(n)), h("h2", null, text));

// Type the medicines ---------------------------------------------------------

const fold = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function ManualPlan({ adding: addingMed }) {
  let meds = [...store.myMeds], query = "", picked = addingMed ?? null, slots = new Set(), special = null;
  const el = h("main.screen");
  const input = h("input.field.big", { type: "search", autocomplete: "off", autocapitalize: "words", spellcheck: "false", placeholder: "Name, z. B. Ramipril", "aria-label": "Medikament suchen", "data-autofocus": "" });
  const results = h("div.stack.tight");
  input.addEventListener("input", () => { query = input.value; drawResults(); });

  const suggestions = () => {
    const q = fold(query).trim();
    if (q.length < 2) return [];
    const seen = new Set();
    return store.catalog
      .filter((m) => fold(m.substance).startsWith(q) || fold(m.name).includes(q))
      .sort((a, b) => (a.market === "US") - (b.market === "US") || (a.substance < b.substance ? -1 : a.substance > b.substance ? 1 : 0))
      .filter((m) => { const k = `${m.substance}|${m.strength ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 4);
  };

  const drawResults = () => {
    const s = suggestions();
    set(results, 
      query.length >= 2 && !s.length ? h("p.tone-warn.with-icon", null, icon("question"), "Nicht im Katalog – bitte anders schreiben.") : null,
      s.map((m) => h("button.card.suggest", { type: "button", onclick: () => { picked = m; slots = new Set(); special = null; draw(); } },
        pillTile(m.look, 48), h("div", null, h("strong", null, title(m)), m.indication ? h("div.muted.small", null, m.indication.de) : null), h("span.plus", null, icon("plus")))),
      s.length ? null : [
        h("h3.muted", null, meds.length ? `Ihre Liste (${meds.length})` : "Noch keine Medikamente."),
        h("div.grid3.tight", null, meds.map((m) => h("div.card.mini.removable", null, medPic(m, 40), h("strong", null, m.substance),
          h("button.remove", { type: "button", "aria-label": `${m.substance} entfernen`, onclick: () => { meds = meds.filter((x) => x.pzn !== m.pzn); drawResults(); draw(); } }, icon("x"))))),
      ]);
  };

  const add = (med) => {
    let schedule;
    if (special === "prn") schedule = { kind: "prn", slots: [], amounts: {}, days: [], note: null, text: "bei Bedarf" };
    else if (special === "weekly") schedule = { kind: "weekly", slots: [], amounts: {}, days: [], note: null, text: "einmal pro Woche" };
    else {
      // The time of day is what the person chose; the amount wasn't asked, so it stays unknown (INV-05, T-13).
      const ordered = SLOTS.map((s) => s.id).filter((id) => slots.has(id));
      schedule = { kind: "daily", slots: ordered, amounts: {}, days: [], note: null, text: null };
    }
    const m = { ...med, schedule };
    if (addingMed) {
      store.add(m);
      say(`${title(m)} steht jetzt auf Ihrem Plan.`);
      return home();
    }
    meds = adding(meds, m);
    picked = null; query = ""; input.value = "";
    draw();
  };

  const whenToTake = (med) => {
    const none = slots.size === 0 && special == null;
    return h("div.stack", null,
      h("div.row-start", null, pillTile(med.look, 64), h("h2", null, title(med))),
      h("h2", null, "Wann nehmen Sie sie?"),
      h("div.slot-pick", null, SLOTS.map((s) => {
        const on = slots.has(s.id);
        return h(`button.slot-btn${on ? ".on" : ""}`, { type: "button", "aria-pressed": String(on), style: on ? { background: s.hex } : { color: s.hex }, onclick: () => { on ? slots.delete(s.id) : (slots.add(s.id), special = null); draw(); } },
          icon(s.icon), h("span", null, s.label));
      })),
      h("div.row.tight", null,
        choice("prn", "Bei Bedarf", "hand"), choice("weekly", "1× pro Woche", "calendar")),
      h("div.row", null,
        bigButton({ icon: "back", title: "Zurück", height: 86, color: "gray", onClick: () => { if (addingMed) home(); else { picked = null; draw(); } } }),
        bigButton({ icon: "plus", title: "Hinzufügen", height: 86, color: none ? "disabled" : "ok", disabled: none, onClick: () => add(med) })));
  };
  const choice = (key, text, ic) => {
    const on = special === key;
    return h(`button.choice${on ? ".on" : ""}`, { type: "button", "aria-pressed": String(on), onclick: () => { special = on ? null : key; if (!on) slots = new Set(); draw(); } }, icon(ic), text);
  };

  const draw = () => {
    if (picked) {
      set(el, backBar({ title: addingMed ? "Zum Plan hinzufügen" : "Selbst eingeben", onBack: home }), whenToTake(picked));
      return;
    }
    drawResults();
    set(el, 
      backBar({ title: "Selbst eingeben", onBack: home }),
      input, results,
      bigButton({ icon: "check", title: `Fertig (${meds.length})`, height: 86, color: meds.length ? "ok" : "disabled", disabled: !meds.length, onClick: () => {
        if (!store.adopt({ meds, unknown: [], unknownPZNs: [] })) return;
        say(`${meds.length} Medikamente gespeichert.`);
        home();
      } }));
  };
  draw();
  return el;
}

// Scanned pack → what it means for my plan (exact, via PZN) -------------------------

const PACK_BANNER = {
  onPlan: ["Auf Ihrem Plan", "seal", "ok", "found"], onPlanNoLook: ["Auf Ihrem Plan", "seal", "ok", "found"],
  otherMaker: ["Gleicher Wirkstoff, andere Packung", "refresh", "warn", "other-maker"],
  sameSubstance: ["Gleicher Wirkstoff wie auf Ihrem Plan", "alert", "warn", "check"],
  notOnPlan: ["Nicht auf Ihrem Plan!", "octagon", "bad", "not-in-list"],
  unknown: ["Packung nicht in der Datenbank", "box", "gray", "not-recognized"],
};

function packSpoken(r) {
  const t = Pack.resultTitle(r), mine = r.mine ? title(r.mine) : "ein Medikament auf Ihrem Plan";
  let s = {
    onPlan: `Diese Packung steht auf Ihrem Plan: ${t}.`,
    onPlanNoLook: `Diese Packung steht auf Ihrem Plan: ${t}.`,
    otherMaker: `${t} hat denselben Wirkstoff und dieselbe Stärke wie ${mine}. Ob diese Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke.`,
    sameSubstance: `Achtung. ${t} enthält denselben Wirkstoff wie ${mine}, ${r.difference ?? "aber nicht dasselbe Präparat"}. Bitte in der Apotheke fragen.`,
    notOnPlan: `Achtung. ${t} steht nicht auf Ihrem Plan. Bitte in der Apotheke oder Praxis nachfragen.`,
    unknown: "Diese Packung kenne ich nicht. Bitte in der Apotheke nachfragen.",
  }[r.kind];
  const e = Pack.expiryText(r.code);
  if (Pack.expired(r) && e) s += ` Achtung, abgelaufen seit ${e}.`;
  return s;
}

function PackResult({ result: r, photo: blob }) {
  const [bText, bIcon, bColor, bMascot] = PACK_BANNER[r.kind];
  const text = packSpoken(r);
  say(text);
  const shownMed = r.product ?? r.mine;
  const form = doseForm(r.name?.form);
  const exp = Pack.expiryText(r.code);
  const middle = h("div.stack");
  const el = h("main.screen", null,
    backBar({ onBack: home, onSpeak: () => say(text) }),
    statusBanner({ icon: bIcon, text: bText, color: bColor, mascot: bMascot }),
    Pack.expired(r) && exp ? statusBanner({ icon: "calendarAlert", text: `Abgelaufen seit ${exp}`, color: "bad" }) : null,
    middle,
    r.kind === "sameSubstance" && r.mine ? infoRow({ icon: "alert", title: "Gleicher Wirkstoff wie auf Ihrem Plan", value: `${title(r.mine)} – ${r.difference ?? "anderes Präparat"}. Bitte in der Apotheke fragen.`, tone: "warn" }) : null,
    (r.kind === "onPlan" || r.kind === "onPlanNoLook") && r.mine ? scheduleBlock(r.mine) : null,
    purposeRow(shownMed),
    h("div.chips", null,
      exp ? chip("calendar", `Haltbar bis ${exp}`, Pack.expired(r) ? "bad" : "accent") : null,
      r.code.batch ? chip("number", `Charge ${r.code.batch}`, "muted") : null),
    h("div.stack.bottom", null, packActions(r)));

  const card = () => {
    set(middle, productCard(r, form),
      shownMed?.look?.leaflet ? h("p.muted.small.with-icon.clamp3", null, icon("doc"), `„${shownMed.look.leaflet}“`) : null,
      // No picture data for this PZN: read its look from the leaflet PDF the person picks (counterpart of the
      // iPhone app's online lookup; the browser can't download it itself).
      !shownMed && r.name && leafletWanted(form) ? [leafletHint(), leafletPicker(r.code.pzn, Pack.resultTitle(r),
        () => go({ name: "pack", result: store.check(r.code), photo: blob }))] : null);
  };
  if (r.kind === "otherMaker" && r.mine) {
    middle.append(compare(r));
  } else {
    // "Wie sieht sie aus?" – read from the package leaflet stored on the phone.
    let alive = true;
    cleanup.push(() => { alive = false; });
    const list = h("div.stack.tight");
    middle.append(list);
    lookupRows(list, [{ id: r.code.pzn, title: Pack.resultTitle(r), look: shownMed?.look ?? null, form }], () => alive).then((ok) => { if (ok && alive) card(); });
  }
  return el;
}

function packActions(r) {
  // No take-over button for the new look: a person's tap must not replace the plan's PZN and look (INV-15, T-15). Whether the pack
  // replaces the plan entry is for the pharmacy to say; the plan stays as the practice wrote it.
  const out = [];
  if (Pack.canAdd(r)) {
    out.push(bigButton({ icon: "plus", title: "Zu meinem Plan hinzufügen", height: 96, onClick: () => {
      if (r.product) go({ name: "addToPlan", adding: r.product });
      else { store.addWithoutLook(r.code.pzn); say(`${Pack.resultTitle(r)} steht jetzt auf Ihrem Plan, ohne Bild.`); home(); }
    } }));
  }
  out.push(bigButton({ icon: "trash", title: "Verwerfen", height: 96, color: "gray", onClick: home }));
  return out;
}

function productCard(r, form) {
  const shown = r.product ?? r.mine;
  const n = r.name;
  return h("div.card.row-start", null,
    shown?.look ? pillTile(shown.look, 90, "bgtile") : doseFormTile(form, 90),
    h("div.grow", null,
      h("h2", null, Pack.resultTitle(r)),
      r.product?.manufacturer ? h("div.muted.small", null, r.product.manufacturer) : null,
      n ? h("div.muted.small", null, [n.substance, n.packSize ? `${n.packSize} Stück` : null].filter(Boolean).join(" · ")) : null,
      h("div.muted.small.mono", null, `PZN ${r.code.pzn}`),
      !r.product && !r.mine ? h("div.small.strong.tone-warn", null, [form?.label, "Aussehen unbekannt"].filter(Boolean).join(" · "))
        : sourceText(shown.look) ? h("div.muted.small", null, sourceText(shown.look)) : null));
}

function compare(r) {
  const side = (heading, look, maker) => h("div.side", null, h("div.muted.strong", null, heading),
    look ? pillTile(look, 96) : h("span.muted.unknown", null, icon("question", { size: 44 })), h("strong.small", null, maker ?? ""));
  return h("div.card.compare-box", null,
    h("div.compare", null,
      side("Auf Ihrem Plan", r.mine.look, r.mine.manufacturer),
      h("span.muted.arrows", null, icon("arrowRight")),
      side("Diese Packung", r.product?.look, r.product?.manufacturer ?? r.name?.name)),
    h("p.center.lead", null, "Gleicher Wirkstoff und gleiche Stärke wie ", h("strong", null, title(r.mine)), ". Ob diese Packung Ihre bisherige ersetzt, sagt Ihnen Ihre Apotheke."));
}

// Example files bundled with the app --------------------------------------------

const EXAMPLE_TITLES = { plan: "Beispielpläne", pack: "Beispielpackungen", photo: "Beispielfotos" };
let examplesIndex = null;

function Examples({ kind }) {
  const grid = h("div.grid2");
  const el = h("main.screen", null,
    h("div.backbar", null,
      h("button.back", { type: "button", onclick: home }, icon("back"), "Abbrechen"),
      h("button.round", { type: "button", "aria-label": "Eigene Fotos", title: "Eigene Fotos", onclick: () => takePhoto("library", kind) }, icon("photos"))),
    // The title on its own line: next to "Abbrechen" and the photo button it pushed the screen wider than a phone.
    h("h1.examples-title", null, EXAMPLE_TITLES[kind]),
    grid);
  (examplesIndex ??= fetch("examples/examples.json").then((r) => r.json())).then((all) => {
    set(grid, ...all.filter((f) => f.kind === kind).map((f) =>
      h("button.card.example", { type: "button", "aria-label": f.caption, onclick: async () => {
        const blob = await fetch(`examples/${f.file}`).then((r) => r.blob());
        go({ name: "analyzing", photo: blob, mode: kind });
      } }, h(`img.${f.kind === "photo" ? "smooth" : "pixel"}`, { src: `examples/${f.file}`, alt: "", loading: "lazy" }), h("span", null, f.caption))));
  });
  return el;
}

// Plan drucken ----------------------------------------------------------------------
// The list on the phone as the companion sheet "Meine Medikamente mit Bildern" (print-sheet.js): no BMP code, no name or
// birth date (filled in by hand). Tap the preview for full screen, tap beside it to close.

/** "🍴 nach dem Essen" under a day-list entry, read from the plan's Hinweise. */
function mealLine(med) {
  const key = Bmp.scheduleMeal(med.schedule);
  return key ? h("div.day-meal", null, icon(Bmp.MEAL[key].icon), Bmp.MEAL[key].label) : null;
}

function PrintPlan() {
  const rows = PrintSheet.rows(store);
  const count = rows.main.length + rows.prn.length;
  // A div with a button role: the sheet holds a table, which a <button> may not contain.
  const preview = h("div.ps-preview", { role: "button", tabindex: "0", "aria-label": `Vorschau: Meine Medikamente mit Bildern, ${count} Medikamente – groß anzeigen` });
  const printBtn = bigButton({ icon: "printer", title: "Drucken", height: 96, onClick: () => printSheet() });
  const fit = () => preview.style.setProperty("--scale", String(preview.clientWidth / mm(297)));
  const draw = () => { set(preview, PrintSheet.sheet(rows), h("span.ps-expand", null, icon("expand"))); fit(); };
  const open = () => fullScreen(PrintSheet.sheet(rows));
  preview.addEventListener("click", open);
  preview.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  const pagesCount = PrintSheet.pages(rows).length;
  const el = h("main.screen", null,
    backBar({ title: "Plan drucken", onBack: home }),
    h("p.lead", null, h("strong", null, "Meine Medikamente mit Bildern"), " – Ihre Liste mit einem Bild jeder Tablette. Maßgeblich bleibt der Medikationsplan Ihrer Praxis."),
    preview,
    pagesCount > 1 ? h("p.muted", null, `${pagesCount} Seiten`) : null,
    h("p.privacy.left", null, icon("shield"), "Ohne Namen und Geburtsdatum – bitte von Hand eintragen. Kein 2D-Code: Den bekommen Sie mit dem Plan Ihrer Praxis."),
    printBtn);
  draw();
  addEventListener("resize", fit);
  cleanup.push(() => removeEventListener("resize", fit));
  requestAnimationFrame(fit);

  function printSheet() {
    const holder = h("div.print-root", null, PrintSheet.pages(rows));
    document.body.append(holder);
    const done = () => { holder.remove(); removeEventListener("afterprint", done); };
    addEventListener("afterprint", done);
    window.print();
  }
  return el;
}

const mm = (v) => (v * 96) / 25.4;

/** The sheet as big as the screen allows, turned sideways on a portrait phone. A tap beside it or ✕ closes. */
function fullScreen(sheetEl) {
  const stage = h("div.ps-stage", null, sheetEl);
  const dlg = h("dialog.ps-zoom", { "aria-label": "Meine Medikamente mit Bildern, groß" },
    stage, h("button.round.ps-close", { type: "button", "aria-label": "Schließen", onclick: () => dlg.close() }, icon("x")));
  const layout = () => {
    const w = innerWidth, hgt = innerHeight, turn = hgt > w;
    const s = turn ? Math.min((hgt - 24) / mm(297), (w - 24) / mm(210)) : Math.min((w - 24) / mm(297), (hgt - 24) / mm(210));
    stage.style.setProperty("--scale", String(s));
    stage.classList.toggle("turn", turn);
  };
  dlg.addEventListener("click", (e) => { if (!sheetEl.contains(e.target)) dlg.close(); });
  dlg.addEventListener("close", () => { removeEventListener("resize", layout); dlg.remove(); });
  addEventListener("resize", layout);
  document.body.append(dlg);
  layout();
  dlg.showModal();
}

const SCREENS = {
  home: Home,
  analyzing: Analyzing,
  bmpImport: BmpImport,
  result: Result,
  picker: Picker,
  manualPlan: ManualPlan,
  addToPlan: ManualPlan,
  pack: PackResult,
  detail: ({ med, photo: blob }) => medCard(med, blob, "confirmed"),
  examples: Examples,
  printPlan: PrintPlan,
};

// Start ------------------------------------------------------------------------

watchInstall(() => { if (route.name === "home") render(); });
if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("service worker", e)));
}
try {
  await store.load();
  render();
} catch (e) {
  set(root, h("main.screen", null, statusBanner({ icon: "alert", text: "Daten konnten nicht geladen werden", color: "warn" }),
    h("p", null, "Bitte die Seite neu laden, solange das Handy online ist.")));
  console.error(e);
}
