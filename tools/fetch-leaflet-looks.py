"""PZN → package leaflet → "Wie … aussieht" (PIL §6) → pill look, automatically.

For each target (substance + strength + dosage form) the script tries the Festbetrag PZNs of common makers until the
PatientenInfo-Service (Rote Liste) finds a leaflet by PZN, extracts section 6, and reads colour, shape, score line,
imprint and size with fixed rules. Anything the text does not state clearly stays null; a text that describes several
strengths in different colours without naming ours is skipped (INV-05: unknown stays unknown, nothing is guessed).

Output: tools/leaflet-looks.generated.json (one product per target, with quote + leaflet URL + all PZNs of that
product), read by add-leaflet-looks.py. PDFs are cached outside the repo (they are not ours to redistribute).

    python3 -m venv .venv && .venv/bin/pip install pypdf
    .venv/bin/python -I tools/fetch-leaflet-looks.py [--cache DIR]
"""
import argparse
import csv
import json
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request

from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[3]
FESTBETRAG = ROOT / "data/processed/festbetrag_2026-11-01.csv"
OUT = pathlib.Path(__file__).resolve().parent / "leaflet-looks.generated.json"
SITE = "https://www.patienteninfo-service.de"
UA = {"User-Agent": "Mozilla/5.0 (BlisterKompass hackathon prototype; leaflet appearance lookup)"}

# Common in elderly polypharmacy (demo). Strength as printed in the Festbetrag name; form = IFA code.
TARGETS = [
    ("Bisoprolol", "5MG", "FTBL", "C07AB07", "Herz / Blutdruck"),
    ("Bisoprolol", "2.5MG", "FTBL", "C07AB07", "Herz / Blutdruck"),
    ("Ramipril", "5MG", "TABL", "C09AA05", "Blutdruck"),
    ("Ramipril", "2.5MG", "TABL", "C09AA05", "Blutdruck"),
    ("Amlodipin", "5MG", "TABL", "C08CA01", "Blutdruck"),
    ("Amlodipin", "10MG", "TABL", "C08CA01", "Blutdruck"),
    ("Torasemid", "10MG", "TABL", "C03CA04", "Wassertablette"),
    ("Simvastatin", "20MG", "FTBL", "C10AA01", "Cholesterin"),
    ("Simvastatin", "40MG", "FTBL", "C10AA01", "Cholesterin"),
    ("Atorvastatin", "20MG", "FTBL", "C10AA05", "Cholesterin"),
    ("Candesartan", "8MG", "TABL", "C09CA06", "Blutdruck"),
    ("Candesartan", "16MG", "TABL", "C09CA06", "Blutdruck"),
    ("Valsartan", "80MG", "FTBL", "C09CA03", "Blutdruck"),
    ("Lisinopril", "10MG", "TABL", "C09AA03", "Blutdruck"),
    ("Lercanidipin", "10MG", "FTBL", "C08CA13", "Blutdruck"),
    ("Pantoprazol", "40MG", "TBLM", "A02BC02", "Magenschutz"),
    ("Omeprazol", "20MG", "KAPM", "A02BC01", "Magenschutz"),
    ("Allopurinol", "300MG", "TABL", "M04AA01", "Gicht"),
    ("Levothyroxin", "75", "TABL", "H03AA01", "Schilddrüse"),
    ("Levothyroxin", "100", "TABL", "H03AA01", "Schilddrüse"),
    ("Metformin", "1000MG", "FTBL", "A10BA02", "Zucker"),
    ("Metformin", "850MG", "FTBL", "A10BA02", "Zucker"),
    ("Tamsulosin", "0.4MG", "KAPR", "G04CA02", "Prostata"),
    ("Citalopram", "20MG", "FTBL", "N06AB04", "Stimmung"),
    ("Sertralin", "50MG", "FTBL", "N06AB06", "Stimmung"),
    ("Mirtazapin", "15MG", "FTBL", "N06AX11", "Schlaf / Stimmung"),
    ("Gabapentin", "300MG", "KAPS", "N02BF01", "Nervenschmerzen"),
    ("Pregabalin", "75MG", "KAPS", "N02BF02", "Nervenschmerzen"),
    ("Ibuprofen", "400MG", "FTBL", "M01AE01", "Schmerzmittel"),
    ("Ibuprofen", "600MG", "FTBL", "M01AE01", "Schmerzmittel"),
    ("Metamizol", "500MG", "FTBL", "N02BB02", "Schmerzmittel"),
    ("Tramadol", "50MG", "KAPS", "N02AX02", "Schmerzmittel"),
    ("Prednisolon", "5MG", "TABL", "H02AB06", "Entzündung (Kortison)"),
    ("Spironolacton", "25MG", "TABL", "C03DA01", "Wassertablette"),
    ("Furosemid", "20MG", "TABL", "C03CA01", "Wassertablette"),
    ("Clopidogrel", "75MG", "FTBL", "B01AC04", "Blutverdünner"),
    ("Doxazosin", "4MG", "TABR", "C02CA04", "Blutdruck"),
    ("Donepezil", "5MG", "FTBL", "N06DA02", "Gedächtnis"),
]
MAKERS = ["1A PHAR", "HEXAL", "RATIO", "AL ", "STADA", "ABZ", "CT ", "ARISTO", "ACCORD", "ZENTIVA", "DURA", "PUREN", "HEUMANN", "BETA", "BASICS", "TAD"]

COLOR_WORDS = [  # longest first; code must exist in the app's palette
    ("hellgelb", "lightyellow"), ("blassgelb", "lightyellow"), ("gelblich", "lightyellow"), ("cremefarben", "offwhite"),
    ("cremeweiß", "offwhite"), ("gebrochen weiß", "offwhite"), ("weißlich", "white"), ("altweiß", "offwhite"),
    ("weiß", "white"), ("gelb", "yellow"), ("orange", "orange"), ("rosa", "pink"), ("pink", "pink"), ("rot", "red"),
    ("blau", "blue"), ("grün", "green"), ("braun", "brown"), ("beige", "beige"), ("lila", "purple"), ("violett", "purple"),
]
COLORS = {
    "white": ("#FBFBF8", "white", "weiß"), "offwhite": ("#F1EBDD", "off-white", "cremeweiß"),
    "lightyellow": ("#F6EAA8", "light yellow", "hellgelb"), "yellow": ("#F2CC3D", "yellow", "gelb"),
    "orange": ("#F0954A", "orange", "orange"), "pink": ("#F2B8C3", "pink", "rosa"), "red": ("#C9483F", "red", "rot"),
    "blue": ("#7EA6D8", "blue", "blau"), "green": ("#86C49A", "green", "grün"), "brown": ("#9E7152", "brown", "braun"),
    "beige": ("#E6D5B4", "beige", "beige"), "purple": ("#B497D6", "purple", "lila"),
}
FORM_COATING = {"FTBL": "film", "TBLM": "enteric", "KAPS": "gelatin", "KAPR": "gelatin", "KAPM": "gelatin", "TABR": "film"}


def get(url, data=None, binary=False):
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode() if data else None, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
    time.sleep(0.8)  # be polite
    return body if binary else body.decode("utf-8", "replace")


def leaflet_url(pzn):
    """PZN search → product page → /gi/<id>/pdf (None if the site has no leaflet for this PZN)."""
    page = get(SITE + "/suche/suchergebnis/", {"tx_pis_lucenesearch[sword]": pzn})
    hit = re.search(r'href="/?(a-z-liste/[a-z0-9]/[^"#]+)"', page)
    if not hit:
        return None
    gi = re.search(r"/gi/(\d+)/(pdf\d?)", get(f"{SITE}/{hit.group(1)}"))
    return f"{SITE}/gi/{gi.group(1)}/{gi.group(2)}" if gi else None


def section6(pdf):
    text = "\n".join((p.extract_text() or "") for p in PdfReader(pdf).pages)
    text = re.sub(r"(\w) (ße|ße|ä|ö|ü)", r"\1\2", text.replace("­", ""))  # "wei ße" → "weiße"
    flat = re.sub(r"\s+", " ", text)
    m = re.search(r"Wie (?:sieht |sehen )?[^.]{1,120}? aus(?:sieht|sehen)? und (?:was )?(?:der )?Inhalt der Packung(?: ist)?\??(.{20,900}?)(?:Pharmazeutischer Unternehmer|Inhaber der Zulassung|Zulassungsinhaber|Hersteller|Diese Packungsbeilage)", flat)
    return m.group(1).strip() if m else None


def sentences_for(text, strength):
    sents = [s.strip() for s in re.split(r"(?<=[.!])\s+(?=[A-ZÄÖÜ„\"])", text) if s.strip()]
    looks = [s for s in sents if any(w in s.lower() for w, _ in COLOR_WORDS)]
    num = strength.replace("MG", "").replace(".", ",")
    own = [s for s in looks if re.search(rf"(?<![\d,]){re.escape(num)}\s*(mg|µg|Mikrogramm)", s, re.I)]
    if own:
        return own
    # No sentence names our strength: only usable if every appearance sentence agrees on the colour.
    first_colours = {tuple(colors_in(s)[:1]) for s in looks}
    return looks if len(first_colours) <= 1 else []


def colors_in(s):
    """Colour codes in the order the text names them ("weiße bis gebrochen weiße" → white first)."""
    low, found = s.lower(), []
    for word, code in COLOR_WORDS:
        for m in re.finditer(re.escape(word), low):
            found.append((m.start(), code))
        low = low.replace(word, " " * len(word))
    return [c for _, c in sorted(found)]


def parse(text, strength, form):
    sents = sentences_for(text, strength)
    if not sents:
        return None, "no appearance sentence"
    first = sents[0]
    other_strengths = re.findall(r"(\d+(?:,\d+)?)\s*(?:mg|µg)", first, re.I)
    num = strength.replace("MG", "").replace(".", ",")
    if other_strengths and num not in other_strengths:
        return None, "describes another strength"
    cols = colors_in(first)
    if not cols:
        return None, "no colour"
    low = first.lower()
    capsule = form.startswith("KAP")
    if capsule:
        shape = "softgel" if "weichkapsel" in low else "capsule"
    elif "rund" in low:
        shape = "round"
    elif re.search(r"oval|elliptisch|ellipsenförmig", low):
        shape = "oval"
    elif re.search(r"länglich|oblong|kapselförmig|stäbchen", low):
        shape = "oblong"
    else:
        return None, "no shape"
    color, color2 = cols[0], None
    if capsule and len(cols) > 1:
        color2 = cols[1]
    elif not capsule and len(set(cols)) > 1 and not re.search(r"bis|gefleckt|gesprenkelt", low):
        return None, "several colours"
    score = "cross" if "kreuz" in low else ("single" if re.search(r"bruchkerbe|bruchrille|teilungsrille|kerbe|rille", low) else None)
    imp = re.search(r"(?:prägung|aufdruck|kennung|beschriftung|bedruckt mit)[^„\"“]{0,40}[„\"“]\s*([^“\"”]{1,12}?)\s*[“\"”]", first, re.I)
    size = re.search(r"(\d+(?:,\d+)?)\s*mm\s*[x×]\s*(\d+(?:,\d+)?)\s*mm", first) or re.search(r"[Dd]urchmesser (?:von )?(?:ca\. )?(\d+(?:,\d+)?)\s*mm", first)
    if size and size.lastindex == 2:
        length, width = float(size.group(1).replace(",", ".")), float(size.group(2).replace(",", "."))
    elif size:
        length = width = float(size.group(1).replace(",", "."))
    else:
        length = width = None
    return dict(shape=shape, color=color, color2=color2, size=(length, width) if length else None, score=score,
                imprint=imp.group(1).strip() if imp else None, coating=FORM_COATING.get(form, "uncoated")), first


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(pathlib.Path.home() / ".cache/blisterkompass-leaflets"))
    args = ap.parse_args()
    cache = pathlib.Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader(FESTBETRAG.open(encoding="utf-8")))
    out = []
    for substance, strength, form, atc, purpose in TARGETS:
        num = strength.replace("MG", "")
        cands = [r for r in rows if r["wirkstoff"].lower().startswith(substance.lower()) and "+" not in r["wirkstoff"]
                 and r["darreichungsform"] == form and re.search(rf"(?<![\d.]){re.escape(num)}(?:MG|UG)?(?![\d.])", r["arzneimittelname"])]
        names = sorted({r["arzneimittelname"] for r in cands}, key=lambda n: next((i for i, m in enumerate(MAKERS) if m in n + " "), 99))
        done = False
        for name in names[:6]:
            pzns = [r["pzn"] for r in cands if r["arzneimittelname"] == name]
            try:
                url = leaflet_url(pzns[0])
            except Exception as e:  # network trouble: skip this product
                print(f"  ! {name}: {e}", file=sys.stderr)
                continue
            if not url:
                continue
            pdf = cache / (url.split("/gi/")[1].replace("/", "-") + ".pdf")
            if pdf.exists() and not pdf.read_bytes().startswith(b"%PDF"):
                pdf.unlink()
            if not pdf.exists():
                try:
                    pdf.write_bytes(get(url, binary=True))
                except Exception as e:
                    print(f"  - {name}: leaflet download failed ({e})")
                    continue
            text = section6(pdf)
            if not text:
                print(f"  - {name}: no section 6 found")
                continue
            look, why = parse(text, strength, form)
            if not look:
                print(f"  - {name}: {why}")
                continue
            out.append(dict(name=name, festbetrag_name=name, pzns=pzns, substance=substance, strength=strength, form=form,
                            atc=atc, purpose=purpose, look=look, quote=why, url=url))
            print(f"✓ {substance} {strength}: {name} → {look['color']}{'/' + look['color2'] if look['color2'] else ''} {look['shape']}"
                  f" score={look['score']} imprint={look['imprint']}  «{why[:110]}»")
            done = True
            break
        if not done:
            print(f"✗ {substance} {strength}: no usable leaflet")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(out)}/{len(TARGETS)} products → {OUT.name}")


if __name__ == "__main__":
    main()
