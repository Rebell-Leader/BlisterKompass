package de.hackathon.blisterkompass;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * BlisterKompass for Android: the PWA from ../pwa, bundled as assets and served offline from
 * https://appassets.androidplatform.net/pwa/ (a secure origin, so ES modules, workers and WASM work).
 * The app has no INTERNET permission; nothing leaves the phone.
 *
 * Native pieces the WebView lacks: the camera for the file input, a German voice (TextToSpeech), printing and
 * imprint OCR (ML Kit text recognition with the bundled model, on the phone; the port of iOS's Vision OCR).
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/pwa/index.html";
    private static final int REQ_FILE = 1;

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "text/javascript");
        MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("wasm", "application/wasm");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("webp", "image/webp");
        MIME.put("svg", "image/svg+xml");
        MIME.put("gif", "image/gif");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff2", "font/woff2");
        MIME.put("xml", "application/xml");
        MIME.put("txt", "text/plain");
        MIME.put("pdf", "application/pdf");
    }

    private WebView web;
    private FrameLayout root;
    private TextToSpeech tts;
    private boolean ttsReady;
    private ValueCallback<Uri[]> pendingFiles;
    private Uri photoUri;
    private TextRecognizer ocr;
    private final ExecutorService ocrThread = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // Debug builds only: chrome://inspect for the eval (tools/android-ocr-eval.mjs). Release builds stay closed.
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0)
            WebView.setWebContentsDebuggingEnabled(true);

        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        applySystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true); // the camera photo comes back as a content:// URI
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "BKNative");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(Locale.GERMANY);
            ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
        });

        if (state != null) web.restoreState(state);
        else clearPhotos(); // a capture left over from an earlier run
        if (web.getUrl() == null) web.loadUrl(START);
    }

    /** Edge-to-edge is forced from Android 15; keep the page clear of the bars and the keyboard instead. */
    private void applySystemBars() {
        Window w = getWindow();
        int bg = getColor(R.color.bg);
        root.setBackgroundColor(bg);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(night ? 0 : light, light);
            }
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return WindowInsets.CONSUMED;
            });
        } else {
            w.setStatusBarColor(bg);
            w.setNavigationBarColor(bg);
            if (!night) w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0));
            w.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    /** Back closes an open dialog first, then a pill/pack screen (the PWA pushes one history entry), then leaves. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        String js = "(function(){var d=document.querySelectorAll('dialog[open]');"
                + "if(d.length){d[d.length-1].close();return 1}"
                + "if(history.state&&history.state.pill){history.back();return 1}return 0})()";
        web.evaluateJavascript(js, r -> { if (!"1".equals(r)) finish(); });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (tts != null) tts.stop();
    }

    @Override
    protected void onDestroy() {
        clearPhotos(); // T-55: no capture outlives the app
        if (tts != null) tts.shutdown();
        ocrThread.shutdownNow();
        if (ocr != null) ocr.close();
        web.destroy();
        super.onDestroy();
    }

    // ---- assets ------------------------------------------------------------------------------

    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null; // nothing else exists: the app has no network permission
            return serveAsset(u.getPath());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
            return true;
        }
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.contains("..")) return notFound();
        String p = path.startsWith("/") ? path.substring(1) : path;
        if (p.isEmpty() || p.endsWith("/")) p += "index.html";
        if (p.equals("android-bridge.js") || p.equals("pwa/android-bridge.js")) p = "android-bridge.js";
        String ext = p.contains(".") ? p.substring(p.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        String mime = MIME.getOrDefault(ext, "application/octet-stream");
        try {
            InputStream in = getAssets().open(p);
            if (p.equals("pwa/index.html")) in = withBridge(in);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            String enc = mime.startsWith("text/") || mime.endsWith("json") || mime.endsWith("javascript") ? "utf-8" : null;
            return new WebResourceResponse(mime, enc, 200, "OK", headers, in);
        } catch (IOException e) {
            return notFound(); // e.g. sw.js: the app needs no service worker, registration fails quietly
        }
    }

    /** The bridge script goes first in <head>, so speech.js sees the native voice. Same origin, so the CSP allows it. */
    private InputStream withBridge(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[16384];
        for (int n; (n = in.read(b)) > 0; ) buf.write(b, 0, n);
        in.close();
        String html = buf.toString("UTF-8")
                .replaceFirst("(?i)<head>", "<head>\n<script src=\"/android-bridge.js\"></script>");
        return new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8));
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    // ---- camera / photo library ------------------------------------------------------------------

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (pendingFiles != null) pendingFiles.onReceiveValue(null);
            pendingFiles = callback;
            photoUri = null;
            clearPhotos(); // the previous capture has been read by now (camera and gallery alike)
            Intent intent;
            if (params.isCaptureEnabled()) {
                intent = cameraIntent();
                if (intent == null) intent = params.createIntent();
            } else {
                intent = params.createIntent();
            }
            try {
                startActivityForResult(intent, REQ_FILE);
            } catch (ActivityNotFoundException e) {
                pendingFiles = null;
                callback.onReceiveValue(null);
            }
            return true;
        }
    }

    /** A camera capture lives only in the app's cache, and only until it has been read: it is deleted before the next photo,
     *  when the capture is cancelled, when another file is picked and when the app closes. The WebView reads the content://
     *  URI after onActivityResult, so the latest capture can't be deleted right there. */
    private void clearPhotos() {
        File[] old = new File(getCacheDir(), "photos").listFiles();
        if (old != null) for (File f : old) //noinspection ResultOfMethodCallIgnored
            f.delete();
    }

    private Intent cameraIntent() {
        try {
            File dir = new File(getCacheDir(), "photos");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File file = new File(dir, "photo-" + System.currentTimeMillis() + ".jpg");
            photoUri = FileProvider.getUriForFile(this, getPackageName() + ".photos", file);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return i;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != REQ_FILE || pendingFiles == null) return;
        Uri[] picked = null;
        if (result == RESULT_OK) {
            if (data != null && data.getData() != null) picked = new Uri[]{data.getData()};
            else if (photoUri != null) picked = new Uri[]{photoUri};
        }
        if (picked == null || picked[0] != photoUri) clearPhotos(); // cancelled, or a gallery pick: no capture to keep
        pendingFiles.onReceiveValue(picked);
        pendingFiles = null;
    }

    // ---- JS bridge (android-bridge.js) -------------------------------------------------------

    private class Bridge {
        @JavascriptInterface
        public void speak(String text, double rate) {
            if (!ttsReady || text == null) return;
            tts.setSpeechRate((float) Math.max(0.5, Math.min(2.0, rate)));
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, "bk-" + System.nanoTime());
        }

        @JavascriptInterface
        public void stop() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                String name = "BlisterKompass";
                pm.print(name, web.createPrintDocumentAdapter(name),
                        new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }

        /** JPEG data URL of the pill → window.__bkImprint(id, text|null). Off the UI thread; the image stays in memory. */
        @JavascriptInterface
        public void readImprint(int id, String dataUrl) {
            ocrThread.execute(() -> {
                String text = null;
                try { text = readImprintText(dataUrl); } catch (Exception | OutOfMemoryError e) {
                    android.util.Log.w("BlisterKompass", "imprint OCR failed", e);
                }
                String js = "window.__bkImprint && window.__bkImprint(" + id + "," + (text == null ? "null" : "\"" + text + "\"") + ")";
                web.post(() -> web.evaluateJavascript(js, null));
            });
        }
    }

    // ---- imprint OCR (port of PillRecognizer.readImprint) -------------------------------------

    private String readImprintText(String dataUrl) throws Exception {
        int comma = dataUrl.indexOf(',');
        byte[] jpeg = Base64.decode(comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl, Base64.DEFAULT);
        Bitmap decoded = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.length);
        if (decoded == null) return null;
        // A pill crop is often ~150 px wide; ML Kit wants characters of ≥ 16 px, so small crops are scaled up.
        int side = Math.max(decoded.getWidth(), decoded.getHeight());
        Bitmap photo = side >= 640 ? decoded
                : Bitmap.createScaledBitmap(decoded, decoded.getWidth() * 640 / side, decoded.getHeight() * 640 / side, true);
        if (photo != decoded) decoded.recycle();
        if (ocr == null) ocr = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        // Embossed imprints are low contrast: grey + contrast boost first (as iOS: saturation 0, contrast 2.2);
        // the plain photo as a second try, where the boost burns out a printed imprint. A pill lies at any angle:
        // upright first, then turned a quarter either way, then upside down.
        Bitmap boosted = boost(photo, 2.2f);
        try {
            for (int deg : new int[]{0, 90, 270, 180})
                for (Bitmap b : new Bitmap[]{boosted, photo}) {
                    String t = imprintOf(Tasks.await(ocr.process(InputImage.fromBitmap(b, deg))));
                    if (t != null) return t;
                }
            return null;
        } finally {
            boosted.recycle();
            photo.recycle();
        }
    }

    /** Same filter as iOS: words with confidence > 0.3, joined, upper case, letters and digits only, 1–8 characters. */
    static String imprintOf(Text result) {
        StringBuilder sb = new StringBuilder();
        for (Text.TextBlock block : result.getTextBlocks())
            for (Text.Line line : block.getLines())
                for (Text.Element el : line.getElements())
                    if (el.getConfidence() > 0.3f) sb.append(el.getText());
        StringBuilder out = new StringBuilder();
        String up = sb.toString().toUpperCase(Locale.ROOT);
        for (int i = 0; i < up.length(); ) {
            int c = up.codePointAt(i);
            if (Character.isLetterOrDigit(c)) out.appendCodePoint(c);
            i += Character.charCount(c);
        }
        int n = out.codePointCount(0, out.length());
        return n >= 1 && n <= 8 ? out.toString() : null;
    }

    /** Greyscale with contrast around mid-grey, like CIColorControls(saturation 0, contrast c). */
    private static Bitmap boost(Bitmap src, float c) {
        ColorMatrix m = new ColorMatrix();
        m.setSaturation(0);
        float t = 128f * (1 - c);
        m.postConcat(new ColorMatrix(new float[]{c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0}));
        Bitmap out = Bitmap.createBitmap(src.getWidth(), src.getHeight(), Bitmap.Config.ARGB_8888);
        Paint p = new Paint();
        p.setColorFilter(new ColorMatrixColorFilter(m));
        new Canvas(out).drawBitmap(src, 0, 0, p);
        return out;
    }
}
