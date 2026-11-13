"""Printouts of a Medikationsplan (BMP 2.8) for the demo: the BMP page and, separately, the picture sheet.

    print/bmp-<plan>-standard.html|pdf|png   the BMP page as the physician end prints it (BMP 2.8, Anlage 3 §6):
                                             8 fixed columns, "morgens mittags abends zur Nacht", doses verbatim,
                                             weekly entries as "siehe nächste Zeile" + "montags 1 - 0 - 0 - 0",
                                             units from the KBV key table, bound extra lines, free-text lines,
                                             section headings 411–425, parameters (O) in the header
    print/bmp-<plan>-bilder.html|pdf|png     "Meine Medikamente mit Bildern" (docs/PRD-print-sheet.md):
                                             a companion sheet, not a plan. Nr. = BMP row order, drawing + description +
                                             source line per medicine, true size only when the source gives millimetres,
                                             the identical BMP code, large print, ≤ 8 rows per page, 5 cm control bar
    (extra PDF pages render as <name>-p2.png, -p3.png …)

The 2D code on both sheets is the plan's own BMP XML, byte for byte (ISO-8859-1, ≤ 1400 bytes) as an ISO/IEC 16022
Data Matrix. Nothing is regenerated from a phone's list (G §4.1 #2). Fields the plan leaves empty stay empty
(Anlage 3 §6.2.4); names come from the PZN (catalog, then the official PZN list), never from a guess, and a picture only
from the catalog entry of that exact PZN (INV-05, INV-15).

The script validates the XML against the KBV BMP 2.8 XSD (xmlschema, else xmllint), decodes the code it embeds and, when a
Chrome/Chromium is found (CHROME=…, the macOS app, chromium/google-chrome on PATH, or the Playwright cache), prints the PDF,
renders every page and decodes the code again from the rendered pages (print → scan round trip).

    python3 -m venv .venv && .venv/bin/pip install zxing-cpp==3.1.1 pillow pypdfium2 xmlschema
    .venv/bin/python -I tools/make-bmp-sheet.py                     # plan-a and plan-kbv-beispiel
    .venv/bin/python -I tools/make-bmp-sheet.py plan-a plan-b       # any plan in ios/BlisterKompass/Examples/plans/

Synthetic demo data only. Not a validated BMP print: KBV conformance of the layout is not claimed (AGENTS.md, export service).
"""

import base64
import csv
import glob
import html
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

import zxingcpp
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP = ROOT / "ios" / "PillSnap"
PLANS = APP / "Examples" / "plans"
OUT = ROOT / "print"
XSD = ROOT / "tools" / "bmp" / "bmp_V2.8.xsd"   # KBV BMP 2.8 schema (tools/bmp/README.md)
FORMS_CSV = ROOT / "tools" / "bmp" / "kbv_darreichungsform.csv"
# Blister mascot on the picture sheet (not on the BMP page, which stays as the KBV layout).
MASCOT_PNG = base64.b64encode((ROOT / "pwa" / "icons" / "mascot-wave.png").read_bytes()).decode()
MAX_BYTES = 1400
SHORT_NAMES = {"plan-kbv-beispiel": "kbv"}   # output file stem per plan, default: the plan's own name

# ---------- BMP 2.8 key tables ----------

# KBV S_BMP_DOSIEREINHEIT 1.01 (Anhang 4 of Anlage 3): code in M/@du → word on the printout.
UNITS = {"#": "Messlöffel", "0": "Messbecher", "1": "Stück", "2": "Pkg.", "3": "Flasche", "4": "Beutel", "5": "Hub",
         "6": "Tropfen", "7": "Teelöffel", "8": "Esslöffel", "9": "E", "a": "Tasse", "b": "Applikatorfüllung",
         "c": "Augenbadewanne", "d": "Dosierbriefchen", "e": "Dosierpipette", "f": "Dosierspritze", "g": "Einzeldosis",
         "h": "Glas", "i": "Likörglas", "j": "Messkappe", "k": "Messschale", "l": "Mio E", "m": "Mio IE",
         "n": "Pipettenteilstrich", "o": "Sprühstoß", "p": "IE", "q": "cm", "r": "l", "s": "ml", "t": "g", "u": "kg", "v": "mg"}
# S_BMP_ZWISCHENUEBERSCHRIFT (Anlage 3, Tabelle 6): S/@c → heading.
SECTIONS = {"411": "Bedarfsmedikation", "412": "Dauermedikation", "413": "Intramuskuläre Anwendung", "414": "Besondere Anwendung",
            "415": "Intravenöse Anwendung", "416": "Anwendung unter die Haut", "417": "Fertigspritze", "418": "Selbstmedikation",
            "419": "Allergiehinweise", "421": "Wichtige Hinweise", "422": "Wichtige Angaben",
            "423": "zu besonderen Zeiten anzuwendende Medikamente", "424": "zeitlich befristet anzuwendende Medikamente",
            "425": "Wöchentliche Anwendung"}
# The picture sheet words two of them for patients (G §5.4).
SECTIONS_PLAIN = {"411": "Bei Bedarf", "418": "Von Ihnen angegeben (Selbstmedikation)"}
WEEKDAYS = ["montags", "dienstags", "mittwochs", "donnerstags", "freitags", "samstags", "sonntags"]
# Anlage 3 A 2.6: fraction notation may become the fraction sign and back; decimals are never converted. Only the
# Latin-1 signs, so every printer font has them; 1/3, 2/3, 1/8 stay as written.
FRACTION_SIGNS = {"1/2": "½", "1/4": "¼", "3/4": "¾"}
SLOT_WORDS = ["morgens", "mittags", "abends", "zur Nacht"]
SHAPES = {"round": "rund", "oval": "oval", "oblong": "länglich", "capsule": "Kapsel", "heart": "herzförmig", "softgel": "Weichkapsel"}
WHITE = {"white", "offwhite", "cream"}   # G §5.5: one word, "weiß"
# Form short names when the plan gives no f/fd: from the product name, else from the IFA code of the official PZN list.
# Product-name words → KBV S_KBV_DARREICHUNGSFORM code (longest first); IFA codes of the official PZN list → KBV code.
FORMS_BY_NAME = [("magensaftresistente tabletten", "TMR"), ("retardtabletten", "RET"), ("filmtabletten", "FTA"),
                 ("hartkapseln", "HKP"), ("weichkapseln", "WKA"), ("kapseln", "KAP"), ("tabletten", "TAB")]
IFA_TO_KBV = {"TABL": "TAB", "FTBL": "FTA", "TABR": "RET", "TBLM": "TMR", "KAPS": "KAP", "HKAP": "HKP", "WKAP": "WKA",
              "IJLG": "ILO", "TROP": "TRO", "DA": "DOS"}


def load_data():
    catalog = json.loads((APP / "Data" / "catalog.json").read_text(encoding="utf-8"))
    names = json.loads((APP / "Data" / "pzn-names.json").read_text(encoding="utf-8"))
    by_pzn = {}
    for med in catalog:
        for p in [med["pzn"], *(med.get("pzns") or [])]:
            by_pzn[p] = med
    forms = {}
    if FORMS_CSV.exists():
        with FORMS_CSV.open(encoding="utf-8") as f:
            forms = {r["code"]: (r["bmp_short_display_de"] or r["display_de"], r["display_de"]) for r in csv.DictReader(f)}
    return by_pzn, names, forms


def dose(value):
    """One value of the four-part schema as printed: verbatim, fraction notation as its sign, "0" when absent."""
    v = (value or "0").strip()
    return FRACTION_SIGNS.get(v, v)


def name_strength(official_name):
    """Strength from the official PZN name ("ASPIRIN N 100MG" → "100 mg"); the Festbetrag 'Wirkstoffmenge' is not the label strength."""
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(MG|µG|UG|MCG|G|ML|IE|I\.E\.)\b", official_name or "", re.I)
    if not m:
        return ""
    unit = {"UG": "µg", "MCG": "µg", "I.E.": "IE"}.get(m.group(2).upper(), m.group(2).lower().replace("ie", "IE"))
    return f"{m.group(1).replace('.', ',')} {unit}"


def form_of(el, med, official, forms):
    """(short, long): the BMP's short form (KBV key table) and the full word for the picture sheet. fd is printed as written."""
    if el.get("fd"):
        return el.get("fd"), el.get("fd")
    code = el.get("f")
    if not code and med:
        low = med["name"].lower()
        code = next((c for key, c in FORMS_BY_NAME if key in low), None)
    if not code and official:
        code = IFA_TO_KBV.get(official[2], official[2])
    if not code:
        return "", ""
    short, long = forms.get(code, (code, code))
    return short, long


def date_time(t):
    """'2026-11-01T09:00:00' → '01.11.2026, 09:00' (seconds are not printed, Anlage 3 §6.2.2)."""
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})", t or "")
    return f"{m[3]}.{m[2]}.{m[1]}, {m[4]}:{m[5]}" if m else ""


# ---------- plan XML → header + rows ----------

def parse(root, by_pzn, names, forms):
    p, a, o = root.find("P"), root.find("A"), root.find("O")
    p = p if p is not None else ET.Element("P")
    a = a if a is not None else ET.Element("A")
    born = p.get("b", "")
    params = []
    if o is not None:   # Anlage 3 §6.2.2 order and keywords (Tabelle 5)
        if o.get("ai"):
            params.append(f"Allerg./Unv.: {o.get('ai')}")
        if o.get("p") == "1":
            params.append("schwanger")
        if o.get("b") == "1":
            params.append("stillend")
        if o.get("w"):
            params.append(f"Gew.: {o.get('w').replace('.', ',')} kg")
        if o.get("h"):
            params.append(f"Größe: {o.get('h')} cm")
        if o.get("c"):
            params.append(f"Krea.: {o.get('c').replace('.', ',')} mg/dl")
        if p.get("s"):
            params.append("Geschl.: " + {"M": "m", "W": "w", "D": "divers", "X": "unbestimmt"}.get(p.get("s"), p.get("s")))
        if o.get("x"):
            params.append(o.get("x"))
    header = {
        "title": p.get("t", ""), "given": p.get("g", ""), "suffix": p.get("z", ""), "prefix": p.get("v", ""), "family": p.get("f", ""),
        "born": f"{born[6:8]}.{born[4:6]}.{born[0:4]}" if len(born) == 8 else born,
        "issuer": a.get("n", ""),
        "address": ", ".join(x for x in [a.get("s"), " ".join(y for y in [a.get("z"), a.get("c")] if y)] if x),
        "phone": a.get("p", ""), "mail": a.get("e", ""),
        "printed": date_time(a.get("t")),
        "params": params,
        "page": root.get("a") or "1", "pages": root.get("z") or "1",
        "version": root.get("v", ""), "lang": root.get("l", "de-DE"),
    }
    rows, nr = [], 0
    for s in root.findall("S"):
        code = s.get("c") or ""
        if s.get("t") or code:
            rows.append({"kind": "heading", "text": s.get("t") or SECTIONS.get(code, code),
                         "plain": s.get("t") or SECTIONS_PLAIN.get(code) or SECTIONS.get(code, code)})
        for el in s:
            if el.tag == "M":
                nr += 1
                rows.append(med_row(el, nr, by_pzn, names, forms))
            elif el.tag == "R":
                nr += 1
                rows.append({"kind": "recipe", "nr": nr, "text": el.get("t", ""), "x": el.get("x", "")})
            elif el.tag == "X":
                rows.append({"kind": "text", "text": el.get("t", "")})
    return header, rows


def med_row(el, nr, by_pzn, names, forms):
    pzn = el.get("p").zfill(8) if el.get("p") else None
    med = by_pzn.get(pzn) if pzn else None          # a picture only from this exact PZN
    official = names.get(pzn) if pzn else None
    ws = [(w.get("w") or "", w.get("s") or "") for w in el.findall("W")]
    if ws:                                          # the plan's own ingredient lines win (all of them: combinations)
        substances, strengths = [w for w, _ in ws], [s for _, s in ws]
    elif med:
        substances, strengths = [med["substance"]], [med.get("strength") or ""]
    elif official:
        substances, strengths = [official[1]], [name_strength(official[0])]
    else:
        substances, strengths = [""], [""]
    brand = el.get("a") or (med["name"] if med else (official[0] if official else ""))
    unknown_name = not brand and not any(substances)
    slots = [el.get(k) for k in "mdvh"]
    if el.get("t"):
        dosing = {"kind": "text", "text": el.get("t")}
    elif el.get("wo") and any(slots):
        dosing = {"kind": "weekly", "day": WEEKDAYS[int(el.get("wo")) - 1], "values": [dose(v) for v in slots]}
    elif any(slots):
        dosing = {"kind": "daily", "values": [dose(v) for v in slots]}
    else:
        dosing = {"kind": "none"}
    return {
        "kind": "med", "nr": nr, "pzn": pzn, "substances": substances, "strengths": strengths,
        "brand": brand, "unknown_name": unknown_name, "dosing": dosing,
        **dict(zip(("form", "form_long"), form_of(el, med, official, forms))),
        "unit": UNITS.get(el.get("du"), el.get("du")) if el.get("du") else (el.get("dud") or ""),
        "note": el.get("i", ""), "reason": el.get("r", ""), "x": el.get("x", ""),
        "look": med["look"] if med else None, "product": med["name"] if med else None,
    }


# ---------- pill drawing (port of PillView.swift), units = mm ----------

def true_size(look):
    """Millimetres from the source: length for round forms, length and width for all others."""
    if not look.get("lengthMm"):
        return False
    return look["shape"] in ("round",) or bool(look.get("widthMm"))


_CLIP_IDS = __import__("itertools").count(1)


def pill_svg(look):
    if true_size(look):
        L = float(look["lengthMm"])
        W = float(look.get("widthMm") or L)
    else:   # schematic, never a default "8 mm": fixed drawing size, labelled "nicht maßstäblich"
        L, W = {"round": (11, 11), "heart": (11, 11), "capsule": (17, 6.5)}.get(look["shape"], (15, 7.5))
    pad = 0.8
    vw, vh = L + 2 * pad, W + 2 * pad
    x, y = pad, pad
    shape = look["shape"]
    c1 = look["colorHex"]
    c2 = look.get("color2Hex") or c1
    stroke = 'stroke="#000" stroke-width=".25"'
    if shape in ("round", "oval", "softgel"):
        outline = f'<ellipse cx="{x + L / 2}" cy="{y + W / 2}" rx="{L / 2}" ry="{W / 2}"'
    elif shape in ("oblong", "capsule"):
        outline = f'<rect x="{x}" y="{y}" width="{L}" height="{W}" rx="{W / 2}"'
    elif shape == "heart":
        p = lambda fx, fy: f"{x + fx * L:.2f},{y + fy * W:.2f}"
        d = (f"M{p(.5, .97)} C{p(.18, .74)} {p(0, .54)} {p(0, .31)} C{p(0, .05)} {p(.4, -.05)} {p(.5, .14)} "
             f"C{p(.6, -.05)} {p(1, .05)} {p(1, .31)} C{p(1, .54)} {p(.82, .74)} {p(.5, .97)}Z")
        outline = f'<path d="{d}"'
    else:
        outline = f'<rect x="{x}" y="{y}" width="{L}" height="{W}" rx="{W * .3}"'
    uid = f"clip{next(_CLIP_IDS)}"
    parts = [f'<defs><clipPath id="{uid}"><{outline[1:]}/></clipPath></defs>']
    if shape == "capsule":
        parts.append(f'<g clip-path="url(#{uid})"><rect x="{x}" y="{y}" width="{L * .52}" height="{W}" fill="{c1}"/>'
                     f'<rect x="{x + L * .52}" y="{y}" width="{L * .48}" height="{W}" fill="{c2}"/></g>'
                     f'<line x1="{x + L * .52}" y1="{y}" x2="{x + L * .52}" y2="{y + W}" stroke="#000" stroke-width=".2"/>')
    else:
        parts.append(f'{outline} fill="{c1}"/>')
    parts.append(f'{outline} fill="none" {stroke}/>')
    if (look.get("score") or "none") != "none":
        if shape in ("round", "heart"):
            parts.append(f'<line x1="{x + L * .14}" y1="{y + W * .55}" x2="{x + L * .86}" y2="{y + W * .55}" stroke="#000" stroke-width=".3" stroke-linecap="round"/>')
        else:
            parts.append(f'<line x1="{x + L / 2}" y1="{y + W * .12}" x2="{x + L / 2}" y2="{y + W * .88}" stroke="#000" stroke-width=".3" stroke-linecap="round"/>')
    imprint = look.get("imprint")
    if imprint and imprint != "heart":
        size = min(W * .34, L * .96 / max(2, len(imprint)))
        scored = (look.get("score") or "none") != "none"
        dx = -L * .23 if shape == "capsule" else (-L * .22 if scored and shape not in ("round", "heart") else 0)
        dy = -W * .18 if scored and shape in ("round", "heart") else 0
        if scored and shape not in ("round", "heart", "capsule"):
            size = min(size, L * .4 / max(2, len(imprint)))
        parts.append(f'<text x="{x + L / 2 + dx:.2f}" y="{y + W / 2 + dy:.2f}" font-size="{size:.2f}" font-weight="700" text-anchor="middle" '
                     f'dominant-baseline="central" fill="#000" font-family="Arial, Helvetica, sans-serif">{html.escape(imprint)}</text>')
    return (f'<svg class="pill" width="{vw:.2f}mm" height="{vh:.2f}mm" viewBox="0 0 {vw:.2f} {vh:.2f}" '
            f'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{html.escape(look_text(look))}">{"".join(parts)}</svg>')


def outline_svg(form):
    """Unknown look: dashed outline of the dosage form, never a coloured pill (INV-05)."""
    caps = "kaps" in (form or "").lower()
    shape = '<rect x="1" y="3" width="14" height="6" rx="3"' if caps else '<circle cx="8" cy="6" r="5"'
    return (f'<svg class="pill" width="16mm" height="12mm" viewBox="0 0 16 12" xmlns="http://www.w3.org/2000/svg" role="img" '
            f'aria-label="Aussehen unbekannt">{shape} fill="none" stroke="#000" stroke-width=".3" stroke-dasharray="1 .8"/></svg>')


def mm(v):
    return f"{v:g}".replace(".", ",")


def look_text(look):
    """Description in cue order (G §5.4): size → shape → score line → imprint → colour."""
    bits = []
    if true_size(look):
        L, W = look["lengthMm"], look.get("widthMm")
        bits.append(f"{mm(L)} mm" if look["shape"] == "round" or not W or W == L else f"{mm(L)} × {mm(W)} mm")
    bits.append(SHAPES.get(look["shape"], look["shape"]))
    if (look.get("score") or "none") != "none":
        bits.append("Kerbe")   # never "Bruchkerbe": a score line does not mean it may be split (INV-14, G §5.5)
    if look.get("imprint") and look["imprint"] != "heart":
        bits.append(f"„{look['imprint']}“")
    colours = []
    for code, name in [(look.get("color"), look.get("colorName")), (look.get("color2"), look.get("color2Name"))]:
        if code or name:
            word = "weiß" if code in WHITE else (name or {}).get("de", code)
            if word not in colours:
                colours.append(word)
    if colours:
        bits.append(" / ".join(colours))
    return ", ".join(bits)


def source_line(look, product):
    """G §5.5 source ladder; every picture says where it comes from."""
    s = look.get("source") or ""
    if s.startswith("leaflet:"):
        return "Zeichnung nach Packungsbeilage dieser PZN"
    if s.startswith("ema"):
        return "Zeichnung nach EMA-Produktinformation"
    if s.startswith("dailymed"):
        return "Zeichnung nach US-Referenzdaten (DailyMed)"
    return "Zeichnung nach Beispieldaten (erfunden)"


# ---------- BMP page (Anlage 3 §6) ----------

PT = 0.3528   # mm per point


GLYPH_EM = 0.55   # average glyph width of Arial-like fonts, a little generous so the browser never needs a third line


def capacity(width_mm, pt):
    return max(4, int((width_mm - 2.4) / (pt * PT * GLYPH_EM)))


def wrap(text, cap):
    lines, cur = [], ""
    for word in text.split():
        if cur and len(cur) + 1 + len(word) > cap:
            lines.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    return lines + ([cur] if cur else [])


def bmp_field(lines, width_mm, truncate=True):
    """Anlage 3 §6.2.4/6.2.7: 12 pt on one line, else 10 pt on at most two lines; longer → cut, last three characters "…"."""
    if len(lines) == 1 and len(lines[0]) <= capacity(width_mm, 12):
        return "f12", lines
    cap = capacity(width_mm, 10)
    out = [ln for t in lines for ln in (wrap(t, cap) or [""])]
    if truncate and len(out) > 2:
        out = out[:2]
        out[1] = out[1][: cap - 1].rstrip() + "…"
    return "f10", out


def cell(text, width_mm, cls="", align="", colspan=1, truncate=True):
    lines = [t for t in (text if isinstance(text, list) else [text]) if t is not None]
    size, lines = bmp_field(lines, width_mm, truncate)
    inner = '<div class="clip">' + "<br>".join(html.escape(t) for t in lines) + "</div>"
    classes = " ".join(c for c in [size, cls, align] if c)
    span = f' colspan="{colspan}"' if colspan > 1 else ""
    return f'<td class="{classes}"{span}>{inner}</td>'


BMP_CSS = """
@page { size: A4 landscape; margin: 8.5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, "Liberation Sans", Helvetica, "Ubuntu Sans", sans-serif; color: #000; background: #fff; }
.page { width: 280mm; height: 192mm; position: relative; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.head { display: flex; height: 40mm; }
.ident { width: 70mm; border: .3mm solid #000; padding: 2mm 3mm; }
.ident h1 { font-size: 20pt; font-weight: 700; margin: 0 0 1.5mm; white-space: nowrap; }
.ident .pg { font-size: 14pt; }
.admin { width: 167mm; border: .3mm solid #000; border-left: none; padding: 1.5mm 3mm; display: grid;
         grid-template-columns: 1fr auto; grid-auto-rows: 5.2mm; column-gap: 10mm; font-size: 12pt; line-height: 5.2mm; }
.admin .l1 { font-size: 14pt; white-space: nowrap; overflow: hidden; }
.admin .l2 { padding-left: 9mm; }
.admin .r { text-align: right; white-space: nowrap; }
.admin .n { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.carrier { width: 43mm; padding-left: 3mm; display: flex; justify-content: flex-end; align-items: flex-start; }
.carrier img { width: 40mm; height: 40mm; image-rendering: pixelated; display: block; }
table { width: 280mm; border-collapse: collapse; table-layout: fixed; margin-top: 3mm; }
col.c1 { width: 40mm; } col.c2 { width: 44mm; } col.c3 { width: 18mm; } col.c4 { width: 18mm; } col.d { width: 8mm; }
col.c6 { width: 20mm; } col.c7 { width: 64mm; } col.c8 { width: 44mm; }
th { height: 8.75mm; background: #eee; border: .25mm solid #000; font-size: 14pt; font-weight: 400; text-align: left; padding: 0 1mm; }
th.dh { font: 700 8pt/1.05 "Arial Narrow", "Liberation Sans Narrow", "Helvetica Neue", "Ubuntu Sans", sans-serif; font-stretch: condensed;
        text-align: center; padding: 0; }
td { height: 8.75mm; border: .25mm solid #000; padding: 0 1.1mm; vertical-align: middle; line-height: 1.12; }
td .clip { max-height: 8.2mm; overflow: hidden; }
.f12 { font-size: 12pt; } .f10 { font-size: 10pt; }
td.num { text-align: center; padding: 0; white-space: nowrap; }
td.right { text-align: right; }
td.center { text-align: center; }
tr.heading td, tr.text td { border: none; font-size: 12pt; }
tr.heading td { font-weight: 700; padding-top: 1.5mm; }
tr.extra td { padding-left: 7mm; font-size: 12pt; }
.foot { position: absolute; left: 0; right: 0; bottom: 0; height: 10mm; border-top: .3mm solid #000; display: flex; }
.foot .disc { width: 120mm; font-size: 8pt; padding-top: 1mm; line-height: 1.25; }
.foot .maker { width: 110mm; font-size: 8pt; padding-top: 1mm; line-height: 1.25; }
.foot .free { width: 50mm; }
@media screen { body { background: #ddd; padding: 8mm 0; } .page { margin: 0 auto 8mm; background: #fff; box-shadow: 0 2px 12px #0003;
  width: 297mm; height: 210mm; padding: 8.5mm; } }
"""


def bmp_rows(rows):
    out = []
    for r in rows:
        if r["kind"] == "heading":
            out.append(f'<tr class="heading"><td colspan="11">{html.escape(r["text"])}</td></tr>')
        elif r["kind"] == "text":
            out.append(f'<tr class="text">{cell(r["text"], 280, colspan=11)}</tr>')
        elif r["kind"] == "recipe":
            out.append(f'<tr>{cell(r["text"], 280, colspan=11)}</tr>')
            if r["x"]:
                out.append(f'<tr class="extra"><td colspan="11">{html.escape(r["x"])}</td></tr>')
        else:
            d = r["dosing"]
            subs = [s for s in r["substances"] if s] or [""]
            strengths = [s for s in r["strengths"] if s] or [""]
            brand = r["brand"] or (f"PZN {r['pzn']} – Name unbekannt" if r["unknown_name"] and r["pzn"] else "")
            cells = [cell(subs, 40), cell(brand, 44), cell(strengths, 18, align="right"), cell(r["form"], 18)]
            if d["kind"] == "daily":
                cells += [f'<td class="num f12">{html.escape(v)}</td>' for v in d["values"]]
            elif d["kind"] == "weekly":
                cells.append('<td class="f10 center" colspan="4">siehe nächste Zeile</td>')
            elif d["kind"] == "text":
                cells.append(cell(d["text"], 32, colspan=4, truncate=False))
            else:
                cells.append('<td colspan="4"></td>')
            cells += [cell(r["unit"], 20, truncate=False), cell(r["note"], 64), cell(r["reason"], 44)]
            out.append("<tr>" + "".join(cells) + "</tr>")
            if d["kind"] == "weekly":   # Anlage 3 §6.2.11: "<Wochentag>s <m> - <d> - <v> - <h>", nothing else on this line
                out.append(f'<tr class="extra"><td colspan="11">{html.escape(d["day"] + " " + " - ".join(d["values"]))}</td></tr>')
            if r["x"]:   # bound extra line (2.8 forbids it together with a weekly line; printed anyway rather than dropped)
                out.append(f'<tr class="extra"><td colspan="11">{html.escape(r["x"])}</td></tr>')
    return out


def bmp_page(header, rows, code_png):
    body = bmp_rows(rows)
    if len(body) > 15:
        raise SystemExit(f"✗ {len(body)} table lines > 15: this plan needs a page split with its own code per page (not implemented)")
    h = header
    parts = [(k, x) for k, x in [("title", h["title"]), ("given", h["given"]), ("suffix", h["suffix"]), ("prefix", h["prefix"]),
                                 ("family", h["family"])] if x]
    if len(" ".join(x for _, x in parts)) > 74:   # too long for two lines: drop suffix, prefix, title in that order
        for drop in ("suffix", "prefix", "title"):
            parts = [(k, x) for k, x in parts if k != drop]
            if len(" ".join(x for _, x in parts)) <= 74:
                break
    fmt = lambda k, x: f"<b>{html.escape(x)}</b>" if k in ("given", "family") else html.escape(x)
    line1, line2, used = [], [], 0
    for k, x in parts:   # first line up to 37 characters, the rest on line 2, indented under the name
        if line2 or (line1 and used + 1 + len(x) > 37):
            line2.append(fmt(k, x))
        else:
            line1.append(fmt(k, x))
            used += len(x) + (1 if used else 0)
    name, name2 = " ".join(line1), " ".join(line2)
    left = ["ausgedruckt von:", h["issuer"], h["address"], f"Tel.: {h['phone']}" if h["phone"] else "", f"E-Mail: {h['mail']}" if h["mail"] else ""]
    right = (h["params"] + ["", "", "", ""])[:4]
    admin = [f'<div class="l1">für: {name}</div><div class="l1 r">geb. am: <b>{html.escape(h["born"])}</b></div>',
             f'<div class="l1 l2">{name2}</div><div></div>']
    for i in range(5):
        r = right[i] if i < 4 else (f"ausgedruckt: {h['printed']}" if h["printed"] else "")
        admin.append(f'<div class="n">{html.escape(left[i])}</div><div class="r">{html.escape(r)}</div>')
    language, _, country = h["lang"].partition("-")
    country, language = country or "DE", language or "de"
    head = "".join(f"<th>{t}</th>" for t in ["Wirkstoff", "Handelsname", "Stärke", "Form"])
    head += "".join(f'<th class="dh">{w}</th>' for w in ["mor-<br>gens", "mit-<br>tags", "abends", "zur<br>Nacht"])
    head += "".join(f"<th>{t}</th>" for t in ["Einheit", "Hinweise", "Grund"])
    return f"""<section class="page">
<div class="head">
  <div class="ident"><h1>Medikationsplan</h1><div class="pg">Seite {h['page']} von {h['pages']}</div></div>
  <div class="admin">{''.join(admin)}</div>
  <div class="carrier"><img src="data:image/png;base64,{code_png}" alt="2D-Code des Medikationsplans"></div>
</div>
<table><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="d"><col class="d"><col class="d"><col class="d"><col class="c6"><col class="c7"><col class="c8"></colgroup>
<thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>
<div class="foot">
  <div class="disc">Für Vollständigkeit und Aktualität des Medikationsplans wird keine Gewähr übernommen.<br>{html.escape(country)}-{html.escape(language)} Version {html.escape(h['version'])}</div>
  <div class="maker">BlisterKompass · Hackathon-Prototyp · Demo mit synthetischen Daten<br>Layout nach BMP 2.8 Anlage 3, nicht zertifiziert</div>
  <div class="free"></div>
</div>
</section>"""


# ---------- picture sheet "Meine Medikamente mit Bildern" (G §5) ----------

SHEET_CSS = """
@page { size: A4 landscape; margin: 8.5mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, "Liberation Sans", Helvetica, "Ubuntu Sans", sans-serif; color: #000; background: #fff; font-size: 12pt; }
.page { width: 280mm; height: 192mm; position: relative; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
.head { display: grid; grid-template-columns: 90mm 1fr 58mm; column-gap: 4mm; height: 36mm; border-bottom: .4mm solid #000; }
.mk { display: flex; gap: 3mm; align-items: flex-start; }
.mk img { width: 18mm; height: 18mm; flex: none; }
.head h1 { font-size: 20pt; margin: 0 0 2mm; line-height: 1.1; }
.head .pg { font-size: 14pt; }
.who { font-size: 16pt; font-weight: 700; margin-bottom: 1mm; }
.who span { font-size: 12pt; font-weight: 400; }
.belongs { font-size: 12pt; font-weight: 700; margin-bottom: 1.5mm; }
.ask { font-size: 12pt; line-height: 1.3; }
.code { display: flex; gap: 2mm; align-items: flex-end; justify-content: flex-end; font-size: 9pt; line-height: 1.15; text-align: right; }
.code img { width: 33mm; height: 33mm; image-rendering: pixelated; display: block; flex: none; }
table { width: 280mm; border-collapse: collapse; table-layout: fixed; margin-top: 3mm; }
col.nr { width: 11mm; } col.look { width: 78mm; } col.med { width: 58mm; } col.d { width: 15mm; } col.why { width: 29mm; } col.note { width: 44mm; }
th { border: .3mm solid #000; font-size: 12pt; text-align: left; padding: 1mm 1.5mm; height: 9mm; }
th.d { text-align: center; font-size: 10pt; padding: .3mm; font-stretch: semi-condensed; line-height: 1.05; }
td { border: .3mm solid #000; padding: .8mm 1.5mm; vertical-align: middle; overflow-wrap: anywhere; hyphens: auto; }
tr.entry td { height: 19mm; }
tr.entry td > div.fix { max-height: 17.2mm; overflow: hidden; }
td.nr { font-size: 18pt; font-weight: 700; text-align: center; }
.lk { display: flex; align-items: center; gap: 2mm; }
.box { flex: none; width: 24mm; height: 12mm; display: flex; align-items: center; justify-content: center; }
.desc { font-size: 11pt; line-height: 1.18; }
.desc .size { font-size: 9pt; font-weight: 700; margin-top: .3mm; }
.src { font-size: 9pt; line-height: 1.15; margin-top: .5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.unknown { font-size: 11pt; font-weight: 700; }
.sub { font-size: 14pt; font-weight: 700; line-height: 1.15; }
.sub span { font-size: 12pt; font-weight: 400; }
.brand { font-size: 11pt; line-height: 1.18; }
.str { font-size: 12pt; line-height: 1.15; }
.clamp1, .clamp2, .clamp3 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.clamp1 { -webkit-line-clamp: 1; } .clamp2 { -webkit-line-clamp: 2; } .clamp3 { -webkit-line-clamp: 3; }
td.d { text-align: center; font-size: 18pt; font-weight: 700; padding: 0; white-space: nowrap; }
td.d small { font-size: 11pt; font-weight: 700; }
td.free { text-align: center; line-height: 1.2; }
td.free .big { font-size: 16pt; font-weight: 700; }
td.free .mid { font-size: 14pt; font-weight: 700; }
td.free .small { font-size: 11pt; }
td.why { font-size: 12pt; font-weight: 700; }
td.note { font-size: 12pt; }
tr.heading td { border: none; font-size: 14pt; font-weight: 700; padding: 2mm 1.5mm .5mm; height: 9mm; }
tr.text td, tr.extra td { font-size: 12pt; }
tr.extra td { padding-left: 14mm; border-top: none; height: 8mm; }
.foot { position: absolute; left: 0; right: 0; bottom: 0; height: 15mm; border-top: .3mm solid #000; padding-top: .8mm; font-size: 11pt; line-height: 1.25; }
.bar { display: flex; align-items: center; gap: 3mm; font-size: 9pt; margin-top: .8mm; }
.bar i { display: block; width: 50mm; height: 1.4mm; background: #000; flex: none; }
@media screen { body { background: #ddd; padding: 8mm 0; } .page { margin: 0 auto 8mm; background: #fff; box-shadow: 0 2px 12px #0003;
  width: 297mm; height: 210mm; padding: 8.5mm; } }
"""

SHEET_BUDGET_MM = 128      # table body height per page: 192 − 36 header − 3 − 9 table head − 16 footer
MAX_ENTRIES_PER_PAGE = 8   # G §5.4: rather more pages than smaller type


def sheet_row(r):
    """(html, height in mm) for one row of the picture sheet."""
    if r["kind"] == "heading":
        return f'<tr class="heading"><td colspan="9">{html.escape(r["plain"])}</td></tr>', 9
    if r["kind"] == "text":
        return f'<tr class="text"><td colspan="9">{html.escape(r["text"])}</td></tr>', 9
    if r["kind"] == "recipe":
        out = f'<tr class="entry"><td class="nr">{r["nr"]}</td><td colspan="8"><div class="sub">{html.escape(r["text"])}</div></td></tr>'
        return out + (f'<tr class="extra"><td colspan="9">{html.escape(r["x"])}</td></tr>' if r["x"] else ""), 19 + (8 if r["x"] else 0)
    look = r["look"]
    if look:
        size = "Originalgröße" if true_size(look) else "Größe unbekannt – nicht maßstäblich"
        pic = (f'<div class="fix"><div class="lk"><div class="box">{pill_svg(look)}</div><div class="desc"><div class="clamp3">{html.escape(look_text(look))}</div>'
               f'<div class="size">{size}</div></div></div><div class="src">{html.escape(source_line(look, r["product"]))}</div></div>')
    else:
        pic = (f'<div class="fix"><div class="lk"><div class="box">{outline_svg(r["form"])}</div>'
               f'<div class="unknown">Aussehen unbekannt – bitte Apotheke fragen</div></div></div>')
    subs = [s for s in r["substances"] if s]
    strength = " / ".join(s for s in r["strengths"] if s)
    if subs:   # ingredient(s) bold with the strength, brand (or the dosage form) beneath (G §5.4)
        first = " / ".join(subs)
        beneath = r["brand"] or r["form_long"]
        if len(first) + 1 + len(strength) <= capacity(58, 14):
            med = f'<div class="sub">{html.escape(first)}{f" <span>{html.escape(strength)}</span>" if strength else ""}</div>'
            med += f'<div class="brand clamp2">{html.escape(beneath)}</div>'
        else:
            med = f'<div class="sub clamp1">{html.escape(first)}</div><div class="str">{html.escape(strength)}</div>'
            med += f'<div class="brand clamp1">{html.escape(beneath)}</div>'
    elif r["pzn"] and r["unknown_name"]:
        med = f'<div class="sub">PZN {r["pzn"]}</div><div class="brand">Name unbekannt{" · " + html.escape(r["form_long"]) if r["form_long"] else ""}</div>'
    else:
        med = f'<div class="sub">{html.escape(r["brand"])}</div><div class="brand">{html.escape(" · ".join(x for x in [strength, r["form_long"]] if x))}</div>'
    med = f'<div class="fix">{med}</div>'
    d = r["dosing"]
    unit = r["unit"] if r["unit"] not in ("", "Stück") else ""
    if d["kind"] == "daily":
        doses = "".join(f'<td class="d">{html.escape(v)}{f" <small>{html.escape(unit)}</small>" if unit and v != "0" else ""}</td>' for v in d["values"])
    elif d["kind"] == "weekly":
        doses = (f'<td class="free" colspan="4"><div class="big">nur {html.escape(d["day"])}</div>'
                 f'<div class="mid">{html.escape(" – ".join(d["values"]))}{(" " + html.escape(unit)) if unit else ""}</div>'
                 f'<div class="small">einmal pro Woche</div></td>')
    elif d["kind"] == "text":
        doses = (f'<td class="free" colspan="4"><div class="mid">{html.escape(d["text"])}{(" " + html.escape(unit)) if unit else ""}</div></td>')
    else:
        doses = '<td class="free" colspan="4"></td>'
    out = (f'<tr class="entry"><td class="nr">{r["nr"]}</td><td>{pic}</td><td>{med}</td>{doses}'
           f'<td class="why"><div class="clamp3">{html.escape(r["reason"])}</div></td><td class="note"><div class="clamp3">{html.escape(r["note"])}</div></td></tr>')
    height = 19
    if r["x"]:
        out += f'<tr class="extra"><td colspan="9">{html.escape(r["x"])}</td></tr>'
        height += 8
    return out, height


def paginate(rows):
    pages, cur, used, entries, last_heading = [], [], 0, 0, None
    for r in rows:
        if r["kind"] == "heading":
            last_heading = r
        row, height = sheet_row(r)
        is_entry = r["kind"] in ("med", "recipe")
        if cur and (used + height > SHEET_BUDGET_MM or (is_entry and entries >= MAX_ENTRIES_PER_PAGE)):
            pages.append(cur)
            cur, used, entries = [], 0, 0
            if last_heading is not None and r is not last_heading:   # repeat the block heading on the next page
                hrow, hh = sheet_row(last_heading)
                cur.append(hrow)
                used += hh
        cur.append(row)
        used += height
        entries += is_entry
    if cur:
        pages.append(cur)
    # a heading left alone at the bottom of a page moves to the next one
    for i in range(len(pages) - 1):
        if pages[i] and pages[i][-1].startswith('<tr class="heading"'):
            moved = pages[i].pop()
            if not pages[i + 1][0] == moved:
                pages[i + 1].insert(0, moved)
    return pages


def picture_sheet(header, rows, code_png):
    h = header
    name = " ".join(x for x in [h["title"], h["given"], h["prefix"], h["family"]] if x)
    when = h["printed"]
    belongs = f"Gehört zum Medikationsplan vom {when}" if when else "Gehört zum Medikationsplan (Datum fehlt im Code)"
    ask = "Fragen? " + " · ".join(x for x in [h["issuer"], f"Tel. {h['phone']}" if h["phone"] else ""] if x)
    caption = f"2D-Code = Medikationsplan vom {when}" if when else "2D-Code = Medikationsplan"
    head_cells = ('<th class="d">Nr.</th><th>Aussehen</th><th>Medikament</th>'
                  + "".join(f'<th class="d">{w}</th>' for w in SLOT_WORDS) + "<th>Wofür</th><th>Hinweise</th>")
    pages = paginate(rows)
    out = []
    for i, body in enumerate(pages, 1):
        out.append(f"""<section class="page">
<div class="head">
  <div class="mk"><img src="data:image/png;base64,{MASCOT_PNG}" alt=""><div><h1>Meine Medikamente<br>mit Bildern</h1><div class="pg">Seite {i} von {len(pages)}</div></div></div>
  <div><div class="who">{html.escape(name)} <span>geb. {html.escape(h['born'])}</span></div>
       <div class="belongs">{html.escape(belongs)}</div>
       <div class="ask">{html.escape(ask)}<br>Sagen Sie am Telefon die Nummer aus der ersten Spalte.</div></div>
  <div class="code"><div>{html.escape(caption).replace(" vom ", "<br>vom ", 1)}</div><img src="data:image/png;base64,{code_png}" alt="{html.escape(caption)}"></div>
</div>
<table><colgroup><col class="nr"><col class="look"><col class="med"><col class="d"><col class="d"><col class="d"><col class="d"><col class="why"><col class="note"></colgroup>
<thead><tr>{head_cells}</tr></thead><tbody>{''.join(body)}</tbody></table>
<div class="foot">{html.escape(name)}, geb. {html.escape(h['born'])} · Seite {i} von {len(pages)} · erstellt mit BlisterKompass · Demo, synthetische Daten · kein zertifizierter Medikationsplan<br>
Nach einem Herstellerwechsel kann ein Medikament anders aussehen. Die Nummer bleibt gleich.
<div class="bar"><i></i>Dieser Strich ist 5 cm lang. Ist er kürzer, wurde verkleinert gedruckt und die Größen stimmen nicht.</div></div>
</section>""")
    return "".join(out), len(pages)


def document(title, css, pages):
    return f'<!doctype html><html lang="de"><head><meta charset="utf-8"><title>{html.escape(title)}</title><style>{css}</style></head><body>{pages}</body></html>'


# ---------- checks, code, printing ----------

def validate(xml_text: str) -> str:
    if not XSD.exists():
        return "schema check skipped (no XSD)"
    try:
        import xmlschema
    except ImportError:
        xmlschema = None
    if xmlschema:
        errors = list(xmlschema.XMLSchema(str(XSD)).iter_errors(xml_text))
        return "BMP 2.8 schema ✓" if not errors else f"BMP 2.8 schema ✗ {errors[0].reason}"
    if not shutil.which("xmllint"):
        return "schema check skipped (no xmlschema, no xmllint)"
    # libxml2 can't compile one construct of the KBV XSD; it is irrelevant for M/S content.
    schema = re.sub(r'<xs:attribute name="p" use="prohibited">.*?</xs:attribute>', "", XSD.read_text(encoding="utf-8"), flags=re.S)
    with tempfile.TemporaryDirectory() as d:
        (pathlib.Path(d) / "bmp.xsd").write_text(schema, encoding="utf-8")
        (pathlib.Path(d) / "plan.xml").write_text(xml_text, encoding="utf-8")
        r = subprocess.run(["xmllint", "--noout", "--schema", f"{d}/bmp.xsd", f"{d}/plan.xml"], capture_output=True, text=True)
    return "BMP 2.8 schema ✓ (xmllint)" if r.returncode == 0 else "BMP 2.8 schema ✗ " + r.stderr.strip().splitlines()[0]


def data_matrix(data: bytes) -> str:
    barcode = zxingcpp.create_barcode(data, zxingcpp.BarcodeFormat.DataMatrix)
    img = Image.fromarray(zxingcpp.write_barcode_to_image(barcode, scale=8, add_quiet_zones=True)).convert("1")
    hits = zxingcpp.read_barcodes(img, formats=zxingcpp.BarcodeFormat.DataMatrix)
    assert hits and hits[0].bytes == data, "Data Matrix round trip failed"
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()


def find_chrome():
    candidates = [os.environ.get("CHROME"), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                  shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser"),
                  *sorted(glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")), reverse=True)]
    return next((c for c in candidates if c and pathlib.Path(c).exists()), None)


def print_and_rescan(html_path: pathlib.Path, data: bytes) -> str:
    """HTML → PDF with headless Chrome; every page → PNG (200 dpi); the code must decode from every page (rendered at 300 dpi)."""
    chrome = find_chrome()
    if not chrome:
        return "no Chrome/Chromium found – PDF skipped"
    pdf = html_path.with_suffix(".pdf")
    subprocess.run([chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer", f"--print-to-pdf={pdf}",
                    html_path.as_uri()], check=True, capture_output=True, timeout=120)
    try:
        import pypdfium2 as pdfium
    except ImportError:
        return f"{pdf.name} (pypdfium2 missing – PNG and rescan skipped)"
    doc = pdfium.PdfDocument(str(pdf))
    for old in html_path.parent.glob(html_path.stem + "-p*.png"):
        old.unlink()
    read = []
    for i in range(len(doc)):
        img = doc[i].render(scale=300 / 72).to_pil()
        read.append(any(h.bytes == data for h in zxingcpp.read_barcodes(img)))
        png = html_path.with_suffix(".png") if i == 0 else html_path.with_name(f"{html_path.stem}-p{i + 1}.png")
        small = img.resize((round(img.width * 2 / 3), round(img.height * 2 / 3)), Image.LANCZOS)
        small.quantize(colors=64, method=Image.Quantize.MEDIANCUT).save(png, optimize=True)   # preview only; the rescan used the 300 dpi page
    ok = "✓" if all(read) else "✗"
    return f"{pdf.name} · {len(doc)} page(s) · code read back from every printed page: {ok}"


def main(plan_names) -> int:
    by_pzn, names, forms = load_data()
    OUT.mkdir(exist_ok=True)
    ok = True
    for plan_name in plan_names:
        # The example files are UTF-8 text; the BMP code carries the same text as ISO-8859-1 (tools/make-plan-codes.py does
        # the same), so these are byte for byte the bytes of Examples/plans/<plan>.png.
        text = (PLANS / f"{plan_name}.xml").read_text(encoding="utf-8").replace("\r\n", "\n").strip()
        data = text.encode("iso-8859-1")
        if len(data) > MAX_BYTES:
            print(f"✗ {plan_name}: {len(data)} bytes > {MAX_BYTES}")
            ok = False
            continue
        xml_text = data.decode("iso-8859-1")
        check = validate(xml_text)
        ok &= "✗" not in check
        header, rows = parse(ET.fromstring(xml_text), by_pzn, names, forms)
        code_png = data_matrix(data)
        stem = SHORT_NAMES.get(plan_name, plan_name)
        meds = sum(r["kind"] in ("med", "recipe") for r in rows)
        print(f"{plan_name}.xml · {len(data)} bytes · {meds} entries · {check}")
        sheet_html, n_pages = picture_sheet(header, rows, code_png)
        for variant, title, css, pages in [("standard", "Medikationsplan", BMP_CSS, bmp_page(header, rows, code_png)),
                                           ("bilder", "Meine Medikamente mit Bildern", SHEET_CSS, sheet_html)]:
            path = OUT / f"bmp-{stem}-{variant}.html"
            path.write_text(document(title, css, pages), encoding="utf-8")
            result = print_and_rescan(path, data)
            ok &= "✗" not in result
            print(f"  ✓ {path.name} · {result}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ["plan-a", "plan-kbv-beispiel"]))
