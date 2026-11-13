// Reads results aloud with the browser's own German voice – for poor eyesight and for carers with their
// hands full. Text always comes from fixed templates over plan data. Nothing is sent anywhere
// (local voices only where the browser lets us choose).

let voice = null;
function pick() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("de"));
  // Nicest local German voice: enhanced/premium ones first, then the warm female voices, then any local one.
  const local = voices.filter((v) => v.localService);
  const score = (v) => (/premium/i.test(v.name) ? 20 : /enhanced|erweitert|natural/i.test(v.name) ? 10 : 0)
    + (/^(Anna|Petra|Helena|Marlene)/.test(v.name) ? 5 : 0) + (v.lang === "de-DE" ? 1 : 0);
  voice = local.sort((a, b) => score(b) - score(a))[0] ?? voices[0] ?? null;
}
if ("speechSynthesis" in self) {
  pick();
  speechSynthesis.addEventListener?.("voiceschanged", pick);
  // iOS Safari only speaks after a user gesture. Unlock the phone's voice on the first touch, so the
  // automatic readouts on later screens (scan results, warnings) are audible too.
  const unlock = () => {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    removeEventListener("pointerdown", unlock, true);
    removeEventListener("keydown", unlock, true);
  };
  addEventListener?.("pointerdown", unlock, true);
  addEventListener?.("keydown", unlock, true);
}

/** A text of one or more sentences; split at sentence ends for natural pauses. */
export function say(text) {
  if (text) sayLines(text.split(/(?<=[.?!])\s+/));
}

/** One utterance per line, queued: long readouts come in small, calm pieces. */
export function sayLines(lines) {
  if (!("speechSynthesis" in self)) return;
  lines = lines.map((l) => l.trim()).filter((l) => l);
  if (!lines.length) return;
  speechSynthesis.cancel();
  for (const line of lines) {
    const u = new SpeechSynthesisUtterance(line);
    u.lang = "de-DE";
    if (voice) u.voice = voice;
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
}

export function stop() {
  if ("speechSynthesis" in self) speechSynthesis.cancel();
}
