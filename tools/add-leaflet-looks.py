"""Add real German products to the app's pill catalog, with the look taken from their package leaflet (PIL §6
"Wie ... aussieht"). Each product carries all PZNs of its pack sizes from the BfArM Festbetrag list.

Only what the leaflet states is filled in. Anything it does not state (size, score line, imprint) stays null
(INV-05: unknown stays unknown). The quote and the leaflet URL are kept in `look.leaflet` / `look.source`.

Re-running replaces the earlier `leaflet:` entries (idempotent).

    python3 -I tools/add-leaflet-looks.py
"""
import csv
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[3]
CATALOG = ROOT / "ios/PillSnap/Data/catalog.json"
FESTBETRAG = ROOT / "data/processed/festbetrag_2026-11-01.csv"
DEMO_PIL = ROOT / "data/processed/de_generic_appearance_demo.csv"

COLORS = {  # same palette as the app (PillRecognizer.palette)
    "white": ("#FBFBF8", "white", "weiß"), "offwhite": ("#F1EBDD", "off-white", "cremeweiß"),
    "lightyellow": ("#F6EAA8", "light yellow", "hellgelb"), "yellow": ("#F2CC3D", "yellow", "gelb"),
    "orange": ("#F0954A", "orange", "orange"), "pink": ("#F2B8C3", "pink", "rosa"), "red": ("#C9483F", "red", "rot"),
    "blue": ("#7EA6D8", "blue", "blau"), "green": ("#86C49A", "green", "grün"), "brown": ("#9E7152", "brown", "braun"),
    "beige": ("#E6D5B4", "beige", "beige"), "purple": ("#B497D6", "purple", "lila"),
}
GENERATED = pathlib.Path(__file__).resolve().parent / "leaflet-looks.generated.json"  # from fetch-leaflet-looks.py
MAKER_NAMES = {"1A PHAR": "1 A Pharma", "HEXAL": "Hexal", "RATIO": "ratiopharm", "AL ": "Aliud Pharma", "STADA": "STADA",
               "ABZ": "AbZ-Pharma", "CT ": "AbZ-Pharma", "ARISTO": "Aristo Pharma", "ACCORD": "Accord Healthcare",
               "ZENTIVA": "Zentiva", "DURA": "Viatris (dura)", "PUREN": "PUREN Pharma", "HEUMANN": "Heumann",
               "BETA": "betapharm", "BASICS": "Basics", "TAD": "TAD Pharma"}
IND = {
    "B01AC06": ("Blood thinner", "Blutverdünner"),
    "C03AA03": ("Water pill (diuretic)", "Wassertablette"),
    "C03CA01": ("Water pill (diuretic)", "Wassertablette"),
    "C03DA01": ("Water pill (diuretic)", "Wassertablette"),
    "L04AX03": ("Rheumatism (immune)", "Rheuma"),
    "H03AA01": ("Thyroid", "Schilddrüse"),
    "A10BA02": ("Diabetes", "Zucker"),
    "C07AB02": ("Heart / blood pressure", "Herz / Blutdruck"),
    "A02BC02": ("Stomach protection", "Magenschutz"),
    "M04AA01": ("Gout", "Gicht"),
    "C10AA05": ("Cholesterol", "Cholesterin"),
    "N02CC02": ("Migraine", "Migräne"),
}

# name regex in the Festbetrag list, form code, product data, look as stated in the leaflet, quote, URL
PRODUCTS = [
    dict(match=r"^ASPIRIN N 100MG$", form="TABL", name="Aspirin N 100 mg Tabletten", substance="Acetylsalicylsäure",
         strength="100 mg", maker="Bayer Vital", atc="B01AC06",
         look=dict(shape="round", color="white", size=(7, 7), coating="uncoated"),
         quote="Aspirin N 100mg ist eine weiße, runde Tablette mit einem Durchmesser von 7mm.",
         url="https://www.patienteninfo-service.de/gi/21630/pdf"),
    dict(match=r"^HCT 1A PHARMA 25MG", form="TABL", name="HCT - 1 A Pharma 25 mg Tabletten", substance="Hydrochlorothiazid",
         strength="25 mg", maker="1 A Pharma", atc="C03AA03",
         look=dict(shape="round", color="offwhite", score="cross", coating="uncoated"),
         quote="HCT - 1 A Pharma ist eine weiße bis cremefarbene, runde, flache Tablette mit einseitiger Kreuzbruchkerbe.",
         url="https://medikamio.com/downloads/de-de/drugs/hct-1-a-pharma-25-mg-tabletten.pdf"),
    dict(match=r"^MTX HEXAL 10MG TABLETTEN", form="TABL", name="MTX HEXAL 10 mg Tabletten", substance="Methotrexat",
         strength="10 mg", maker="Hexal", atc="L04AX03",
         look=dict(shape="round", color="yellow", score="single", coating="uncoated"),
         quote="MTX HEXAL sind gelbe, runde Tabletten mit Kerbe auf einer Seite. Die Kerbe dient nicht zum Teilen der Tablette.",
         url="https://www.patienteninfo-service.de/gi/20870/pdf"),
    # Non-prescription, so not in the Festbetrag list: PZN given explicitly.
    dict(pzn_list=["09321616"], form="FTBL", name="Naratriptan-ratiopharm bei Migräne 2,5 mg Filmtabletten",
         substance="Naratriptan", strength="2,5 mg", maker="ratiopharm", atc="N02CC02",
         look=dict(shape="round", color="green", imprint="NT 2,5", coating="film"),
         quote="Grüne, bikonvexe, runde Filmtabletten mit Prägung „NT 2,5“ auf einer Seite und glatter anderer Seite.",
         url="https://cdn.shop-apotheke.com/PDF/D09/321/616/D09321616-bp.pdf"),
    # Leaflet texts already collected for the demo generics (data/processed/de_generic_appearance_demo.csv)
    dict(match=r"^L THYROX HEXAL 50$", form="TABL", name="L-Thyrox HEXAL 50 Mikrogramm Tabletten", substance="Levothyroxin-Natrium",
         strength="50 µg", maker="Hexal", atc="H03AA01",
         look=dict(shape="round", color="white", score="single", imprint="50", coating="uncoated"),
         quote="L-Thyrox HEXAL ist eine weiße, runde Tablette mit einer Prägung „50“ auf der einen und einer Bruchkerbe auf der anderen Seite.",
         csv="L-Thyrox HEXAL 50 Mikrogramm Tabletten"),
    dict(match=r"^L THYROXIN 50 1A PHARMA$", form="TABL", name="L-Thyroxin 50 - 1 A Pharma Tabletten", substance="Levothyroxin-Natrium",
         strength="50 µg", maker="1 A Pharma", atc="H03AA01",
         look=dict(shape="round", color="white", score="single", imprint="50", coating="uncoated"),
         quote="L-Thyroxin 50 - 1 A Pharma ist eine weiße, runde Tablette mit einer Prägung „50“ auf der einen und einer Bruchkerbe auf der anderen Seite.",
         csv="L-Thyroxin 50 - 1 A Pharma Tabletten"),
    dict(match=r"^METFORMIN HEXAL 500MG", form="FTBL", name="Metformin HEXAL 500 mg Filmtabletten", substance="Metformin",
         strength="500 mg", maker="Hexal", atc="A10BA02",
         look=dict(shape="round", color="white", imprint="M 500", coating="film"),
         quote="Metformin HEXAL 500mg sind weiße, runde Filmtabletten mit einer Prägung „M 500“ auf einer Seite.",
         csv="Metformin HEXAL 500 mg Filmtabletten"),
    dict(match=r"^FUROSEMID RATIO 40MG", form="TABL", name="Furosemid-ratiopharm 40 mg Tabletten", substance="Furosemid",
         strength="40 mg", maker="ratiopharm", atc="C03CA01",
         look=dict(shape="round", color="white", score="single", coating="uncoated"),
         quote="Weiße bis leicht gelbliche, runde, beidseits gewölbte Tablette mit einseitiger breiter Bruchkerbe.",
         csv="Furosemid-ratiopharm 40 mg Tabletten"),
    dict(match=r"^FURORESE 40MG", form="TABL", name="Furorese 40 mg Tabletten", substance="Furosemid",
         strength="40 mg", maker="Hexal", atc="C03CA01",
         look=dict(shape="round", color="white", score="single", coating="uncoated"),
         quote="Weiße, runde, leicht gewölbte Tabletten mit einseitiger Bruchkerbe.",
         csv="Furorese 40 mg Tabletten"),
    dict(match=r"^SPIRONOLACTON ACCORD 25MG", form="FTBL", name="Spironolacton Accord 25 mg Filmtabletten", substance="Spironolacton",
         strength="25 mg", maker="Accord Healthcare", atc="C03DA01",
         look=dict(shape="round", color="white", size=(8.1, 8.1), imprint="AD", coating="film"),
         quote="Spironolacton Accord 25 mg Filmtabletten sind weiße bis blass-weiße, runde, bikonvexe Tabletten mit Prägung „AD“ auf einer Seite. Der Durchmesser der 25 mg-Tablette beträgt 8,1 mm.",
         csv="Spironolacton Accord 25/50/100 mg Filmtabletten"),
    dict(match=r"^SPIRONOLACTON RATIO 50MG", form="TABL", name="Spironolacton-ratiopharm 50 mg Tabletten", substance="Spironolacton",
         strength="50 mg", maker="ratiopharm", atc="C03DA01",
         look=dict(shape="round", color="white", score="single", coating="uncoated"),
         quote="Weiße, runde, beiderseits gewölbte Tablette mit einer Bruchkerbe auf einer Seite.",
         csv="Spironolacton-ratiopharm 50 mg Tabletten"),
    dict(match=r"^METOPROLOL RATIO SU 47.5MG", form="TABR", name="Metoprolol-ratiopharm Succinat 47,5 mg Retardtabletten", substance="Metoprololsuccinat",
         strength="47,5 mg", maker="ratiopharm", atc="C07AB02",
         look=dict(shape="oblong", color="white", score="single", coating="film"),
         quote="Metoprolol-ratiopharm Succinat 47,5 mg sind weiße, längliche, beidseitig gewölbte Retardtabletten mit beidseitiger Bruchkerbe.",
         csv="Metoprolol-ratiopharm Succinat 47,5 mg Retardtabletten"),
    dict(match=r"^METOPROLOLSUCCINAT 1A 95MG", form="TABR", name="Metoprololsuccinat - 1 A Pharma 95 mg Retardtabletten", substance="Metoprololsuccinat",
         strength="95 mg", maker="1 A Pharma", atc="C07AB02",
         look=dict(shape="oblong", color="lightyellow", score="single", coating="film"),
         quote="Metoprololsuccinat - 1 A Pharma 95mg sind hellgelbe, oblonge Retardtabletten mit beidseitiger Bruchkerbe.",
         csv="Metoprololsuccinat-1A Pharma 95mg Retard-Tabletten"),
    dict(match=r"^PANTOPRAZOL RATIO 20MG", form="TBLM", name="Pantoprazol-ratiopharm 20 mg magensaftresistente Tabletten", substance="Pantoprazol",
         strength="20 mg", maker="ratiopharm", atc="A02BC02",
         look=dict(shape="oval", color="yellow", coating="enteric"),
         quote="Pantoprazol-ratiopharm 20 mg sind ovale, beidseitig gewölbte, gelbe Tabletten.",
         csv="Pantoprazol-ratiopharm 20 mg magensaftresistente Tabletten"),
    dict(match=r"^ALLOPURINOL RAT 100MG", form="TABL", name="Allopurinol-ratiopharm 100 mg Tabletten", substance="Allopurinol",
         strength="100 mg", maker="ratiopharm", atc="M04AA01",
         look=dict(shape="round", color="white", score="single", coating="uncoated"),
         quote="Weiße, runde, gewölbte Tablette mit Bruchkerbe.",
         csv="Allopurinol-ratiopharm 100 mg Tabletten"),
    dict(match=r"^ATORVASTATIN 1A PHAR 40MG", form="FTBL", name="Atorvastatin - 1 A Pharma 40 mg Filmtabletten", substance="Atorvastatin",
         strength="40 mg", maker="1 A Pharma", atc="C10AA05",
         look=dict(shape="round", color="white", score="cross", imprint="A40", coating="film"),
         quote="Weiße bis cremeweiße, runde, beidseitig gewölbte Filmtablette mit der Prägung \"A40\" auf einer Seite und einer Kreuzbruchkerbe auf der anderen Seite.",
         csv="Atorvastatin - 1 A Pharma 40 mg Filmtabletten"),
    dict(match=r"^ATORVASTATIN PUREN 40MG", form="FTBL", name="Atorvastatin PUREN 40 mg Filmtabletten", substance="Atorvastatin",
         strength="40 mg", maker="PUREN Pharma", atc="C10AA05",
         look=dict(shape="oval", color="white", size=(15.5, 8.1), imprint="AS", coating="film"),
         quote="Atorvastatin PUREN 40mg Filmtabletten: Weiße, ellipsenförmige [15,5mm x 8,1mm] Filmtabletten mit der Prägung „AS“ auf der einen und „40“ auf der anderen Seite.",
         csv="Atorvastatin PUREN 10/20/40/80 mg Filmtabletten"),
]


def look(p):
    l = p["look"]
    hexv, en, de = COLORS[l["color"]]
    c2 = COLORS.get(l.get("color2") or "")
    size = l.get("size")
    return {
        "shape": l["shape"], "color": l["color"], "color2": l.get("color2"),
        "lengthMm": size[0] if size else None, "widthMm": size[1] if size else None,
        "score": l.get("score"),            # null = the leaflet does not say
        "imprint": l.get("imprint"),
        "coating": l["coating"], "finish": "matte" if l["coating"] == "uncoated" else "glossy",
        "source": "leaflet:" + p["url"], "leaflet": p["quote"],
        "colorHex": hexv, "color2Hex": c2[0] if c2 else None, "colorName": {"en": en, "de": de},
        "color2Name": {"en": c2[1], "de": c2[2]} if c2 else None,
    }


def main():
    rows = list(csv.DictReader(FESTBETRAG.open(encoding="utf-8")))
    texts = {r["product_name"]: r for r in csv.DictReader(DEMO_PIL.open(encoding="utf-8"))}
    for p in PRODUCTS:
        if "csv" in p:  # URL from the collected leaflet row; every word of the quote must be in its text
            row = texts[p["csv"]]
            p["url"] = row["source_url"]
            flat = re.sub(r"\s+", "", row["appearance_text_de"])
            missing = [w for w in re.findall(r"\w{4,}", p["quote"]) if w not in flat]
            assert not missing, f"{p['name']}: quote words not in leaflet text: {missing}"
    catalog = [m for m in json.loads(CATALOG.read_text(encoding="utf-8")) if not m["look"].get("source", "").startswith("leaflet:")]
    taken = {m["pzn"] for m in catalog}
    added = 0
    for p in PRODUCTS:
        pzns = p.get("pzn_list") or [r["pzn"] for r in rows if re.search(p["match"], r["arzneimittelname"]) and r["darreichungsform"] == p["form"]]
        pzns = [z for z in pzns if z not in taken]
        assert pzns, f"no PZN for {p['name']}"
        en, de = IND[p["atc"]]
        catalog.append({
            "pzn": pzns[0], "pzns": pzns[1:], "name": p["name"], "substance": p["substance"], "strength": p["strength"],
            "manufacturer": p["maker"], "atc": p["atc"], "indication": {"en": en, "de": de}, "look": look(p), "market": "DE",
        })
        taken.update(pzns)
        added += 1
        print(f"{p['name']}: {len(pzns)} PZN ({', '.join(pzns)})")
    # Found automatically: PZN → leaflet → section 6 (fetch-leaflet-looks.py)
    by_pzn = {r["pzn"]: r for r in rows}
    for g in json.loads(GENERATED.read_text(encoding="utf-8")) if GENERATED.exists() else []:
        pzns = [z for z in g["pzns"] if z not in taken]
        if not pzns:
            continue  # already in the catalog (hand-curated above)
        row = by_pzn[pzns[0]]
        num = g["strength"].replace("MG", "").replace(".", ",")
        unit = "µg" if g["substance"].startswith("Levothyroxin") else "mg"
        maker = next((v for k, v in MAKER_NAMES.items() if k in g["name"] + " "), None)
        catalog.append({
            "pzn": pzns[0], "pzns": pzns[1:], "name": g["name"], "substance": row["wirkstoff"], "strength": f"{num} {unit}",
            "manufacturer": maker, "atc": g["atc"], "indication": {"en": g["purpose"], "de": g["purpose"]},
            "look": look(g), "market": "DE",
        })
        taken.update(pzns)
        added += 1
        print(f"{g['name']} (auto): {len(pzns)} PZN")
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{added} leaflet products, catalog now {len(catalog)} products")


if __name__ == "__main__":
    main()
