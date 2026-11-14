// Loaded into the PWA's index.html by the Android app only (see MainActivity.serveAsset).
// Android's WebView has no working speechSynthesis and no window.print, so both go to the app.
(function () {
  var bridge = window.BKNative;
  if (!bridge) return;

  function Utterance(text) {
    this.text = text || ""; this.lang = "de-DE"; this.rate = 1; this.volume = 1; this.voice = null;
  }
  var voice = { name: "Android", lang: "de-DE", localService: true, default: true, voiceURI: "android" };
  var synth = {
    speak: function (u) { if (u && u.volume !== 0 && String(u.text).trim()) bridge.speak(String(u.text), Number(u.rate) || 1); },
    cancel: function () { bridge.stop(); },
    pause: function () {}, resume: function () {},
    getVoices: function () { return [voice]; },
    addEventListener: function () {}, removeEventListener: function () {},
    speaking: false, pending: false, paused: false
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: Utterance, configurable: true, writable: true });
  window.print = function () { bridge.print(); };

  // OCR on the phone (ML Kit, bundled model, no network), used by pwa/js/vision.js. JPEG data URL → text or null.
  var ocrSeq = 0, ocrPending = {};
  window.__bkReply = function (id, text) {
    var p = ocrPending[id];
    if (!p) return;
    delete ocrPending[id];
    p(text || null);
  };
  function ask(call) {
    return new Promise(function (resolve) {
      var id = ++ocrSeq;
      ocrPending[id] = resolve;
      try { call(id); } catch (e) { delete ocrPending[id]; resolve(null); }
    });
  }
  // The pill's imprint (letters and digits, 1–8 characters).
  window.BKReadImprint = function (dataUrl) { return ask(function (id) { bridge.readImprint(id, String(dataUrl)); }); };
  // All text in the photo, turned by deg (0, 90, 180, 270): the printed PZN on a pack.
  window.BKReadText = function (dataUrl, deg) { return ask(function (id) { bridge.readText(id, String(dataUrl), deg | 0); }); };
})();
