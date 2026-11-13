"""Checks for tools/make-bmp-sheet.py (BMP 2.8 page + picture sheet). No browser needed.

    prep/.venv/bin/python -I -m pytest -q tools/test_make_bmp_sheet.py
"""
import importlib.util
import pathlib
import re
import xml.etree.ElementTree as ET

import pytest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("make_bmp_sheet", HERE / "make-bmp-sheet.py")
sheet = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sheet)


def load(plan):
    by_pzn, names, forms = sheet.load_data()
    text = (sheet.PLANS / f"{plan}.xml").read_text(encoding="utf-8").strip()
    return sheet.parse(ET.fromstring(text), by_pzn, names, forms)


@pytest.fixture(scope="module")
def kbv():
    return load("plan-kbv-beispiel")


@pytest.fixture(scope="module")
def plan_a():
    return load("plan-a")


def meds(rows):
    return [r for r in rows if r["kind"] == "med"]


def test_doses_verbatim():
    # Anlage 3 A 2.6: fraction notation may become the sign; decimals are never converted; an empty slot prints "0"
    assert sheet.dose("1/2") == "½" and sheet.dose("0,5") == "0,5" and sheet.dose(None) == "0" and sheet.dose("1/3") == "1/3"


def test_units_from_key_table_never_default(kbv):
    _, rows = kbv
    insulin, nitro = meds(rows)[2], meds(rows)[5]
    assert insulin["unit"] == "IE" and insulin["dosing"] == {"kind": "daily", "values": ["20", "0", "10", "0"]}
    assert nitro["unit"] == "Hub" and nitro["dosing"] == {"kind": "text", "text": "max. 3"}
    assert sheet.UNITS["o"] == "Sprühstoß" and len(sheet.UNITS) == 33


def test_weekly_keeps_dose_and_day(kbv):
    _, rows = kbv
    mtx = meds(rows)[3]
    assert mtx["dosing"] == {"kind": "weekly", "day": "montags", "values": ["1", "0", "0", "0"]}
    page = sheet.bmp_page(*kbv, "")
    assert "siehe nächste Zeile" in page and "montags 1 - 0 - 0 - 0" in page and "dienstags 1 - 0 - 0 - 0" in page


def test_headings_extra_line_parameters(kbv):
    header, rows = kbv
    assert [r["text"] for r in rows if r["kind"] == "heading"] == [
        "Wöchentliche Anwendung", "Bedarfsmedikation", "zeitlich befristet anzuwendende Medikamente"]
    assert meds(rows)[6]["x"].startswith("Sofort mit Einnahme beginnen")
    assert header["params"][:2] == ["Allerg./Unv.: Penicillin", "Gew.: 85 kg"]


def test_no_guessed_picture_or_name(kbv):
    _, rows = kbv
    ramipril, insulin = meds(rows)[0], meds(rows)[2]
    assert ramipril["pzn"] is None and ramipril["look"] is None and ramipril["brand"] == ""   # no PZN → no picture, empty name
    assert insulin["unknown_name"] and insulin["look"] is None
    html, _ = sheet.picture_sheet(*kbv, "")
    assert "Aussehen unbekannt – bitte Apotheke fragen" in html
    assert "Größe unbekannt – nicht maßstäblich" in html            # HCT leaflet gives no millimetres
    assert "Bruchkerbe" not in html


def test_picture_sheet_rules(plan_a):
    html, pages = sheet.picture_sheet(*plan_a, "")
    assert pages == 3  # plan A: weekly MTX sits in its own block <S c="425"> (BMP 2.8 §6.2.11), which adds a heading row
    for page in html.split('<section class="page">')[1:]:
        assert page.count('<tr class="entry">') <= sheet.MAX_ENTRIES_PER_PAGE
    text = re.sub(r"<[^>]+>", " ", html)
    allowed = ("Gehört zum Medikationsplan vom", "2D-Code = Medikationsplan", "kein zertifizierter Medikationsplan")
    for m in re.finditer(r"Medikationsplan", text):
        assert any(text[max(0, m.start() - 40):m.end() + 5].find(a) >= 0 for a in allowed), text[m.start() - 40:m.end()]
    assert html.count("Zeichnung nach") == 12                       # every picture names its source
    for words in ["entnehmen", "herausnehmen", "austauschen", "umsortieren", "teilen Sie"]:   # INV-16
        assert words not in text
