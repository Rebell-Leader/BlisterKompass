#!/usr/bin/env python3
"""
US pill look-alike analysis for BlisterKompass.

Question: when a patient takes N different oral solid drugs, how often do two or
more of their pills look alike (same colour + shape, optionally same size class),
so they cannot be told apart without the imprint or the pack?

Data (all public):
  * ClinCalc DrugStats Top 300 (MEPS 2024 prescribed-medicines file),
    https://clincalc.com/DrugStats/Top300Drugs.aspx  -> prescription counts
  * NLM DailyMed SPL web services v2 (public domain),
    https://dailymed.nlm.nih.gov/dailymed/services/v2/
    -> per-product SPLCOLOR, SPLSHAPE, SPLSIZE, SPLSCORE, SPLIMPRINT

Usage (run with `python3 -I`):
  python3 -I us_lookalike.py fetch   --data DIR      # ClinCalc + DailyMed -> DIR/products.json
  python3 -I us_lookalike.py analyze --data DIR      # simulation -> DIR/results.json + stdout

The ClinCalc page must be saved beforehand as DIR/clincalc_top300.html.
Only the Python standard library is used. No personal data is read or written.
"""
import argparse
import collections
import csv
import html
import json
import os
import random
import re
import statistics
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

# ----------------------------------------------------------------- parameters
TOP_N = 200                 # ClinCalc ranks 1..TOP_N
SPL_PER_DRUG = 12           # random SPL documents (labels) sampled per drug
MAX_LIST_PAGES = 20         # x100 titles per drug name search
DELAY_S = 0.25              # pause after each DailyMed request (per worker)
WORKERS = 3                 # concurrent DailyMed requests
USER_AGENT = "blisterkompass-research/0.1"
SEED = 20261113
N_LIST = [3, 5, 8, 10, 12, 15]
SIMS = 20000                # simulated patients per N
SIZE_CLASSES = [(8, "<=8mm"), (13, "8-13mm"), (999, ">13mm")]
API = "https://dailymed.nlm.nih.gov/dailymed/services/v2"
NS = "{urn:hl7-org:v3}"
ORAL_ROUTES = {"ORAL", "SUBLINGUAL", "BUCCAL"}
BAD_FORM_WORDS = ("FOR SUSPENSION", "FOR SOLUTION", "EFFERVESCENT", "SOLUBLE")

# Drugs in the top 200 whose US use is not (predominantly) an oral solid, or that
# cannot be mapped to one DailyMed product family. Reason is reported.
EXCLUDE = {
    "Albuterol": "inhaler (dominant form)",
    "Semaglutide": "injection dominant (oral Rybelsus is a minority)",
    "Fluticasone": "nasal spray / inhaler",
    "Insulin Glargine": "injection",
    "Tirzepatide": "injection",
    "Insulin Lispro": "injection",
    "Latanoprost": "eye drops",
    "Dulaglutide": "injection",
    "Fluticasone; Salmeterol": "inhaler",
    "Insulin Aspart": "injection",
    "Testosterone": "injection / gel",
    "Triamcinolone": "topical / injection / nasal",
    "Budesonide; Formoterol": "inhaler",
    "Fluticasone; Umeclidinium; Vilanterol": "inhaler",
    "Insulin Degludec": "injection",
    "Cyanocobalamin": "Rx use predominantly injection",
    "Adalimumab": "injection",
    "Azelastine": "nasal spray / eye drops",
    "Ketoconazole": "topical dominant",
    "Clobetasol": "topical",
    "Fluticasone; Vilanterol": "inhaler",
    "Albuterol; Ipratropium": "inhalation solution / inhaler",
    "Ofloxacin": "ear / eye drops dominant",
    "Mupirocin": "topical",
    "Evolocumab": "injection",
    "Ethinyl Estradiol; Etonogestrel": "vaginal ring",
    "Timolol": "eye drops",
    "Cyclosporine": "eye drops dominant",
    "Tretinoin": "topical",
    "Tiotropium": "inhaler",
    "Brimonidine": "eye drops",
    "Dupilumab": "injection",
    "Budesonide": "inhaled / nasal dominant",
    "Polyethylene Glycol 3350": "oral powder",
    "Prednisolone": "eye drops / oral liquid dominant",
    "Magnesium Salts": "mixed salt group, not mappable to one product family",
    "Melatonin": "dietary supplement, no reliable DailyMed SPL",
}

# search: DailyMed drug_name query; tokens: active-ingredient set (alternatives with |);
# title: words that must appear in the SPL title.
OVERRIDES = {
    "Dextroamphetamine; Dextroamphetamine Saccharate; Amphetamine; Amphetamine Aspartate":
        dict(search="amphetamine aspartate", tokens=["DEXTROAMPHETAMINE", "AMPHETAMINE"]),
    "Thyroid": dict(search="thyroid", tokens=["LEVOTHYROXINE", "LIOTHYRONINE"], title=["THYROID"]),
    "Valproate": dict(search="divalproex", tokens=["DIVALPROEX|VALPROIC ACID|VALPROATE"]),
    "Lithium": dict(search="lithium carbonate", tokens=["LITHIUM"]),
    "Isosorbide": dict(search="isosorbide", tokens=["ISOSORBIDE"]),
    "Potassium Chloride": dict(search="potassium chloride", tokens=["POTASSIUM CHLORIDE"]),
    "Nirmatrelvir; Ritonavir": dict(search="nirmatrelvir", tokens=["NIRMATRELVIR"], allow_and=True),  # co-packaged kit
    "Amoxicillin; Clavulanate": dict(search="clavulanate", tokens=["AMOXICILLIN", "CLAVULANATE|CLAVULANIC ACID"]),
    "Sacubitril; Valsartan": dict(search="sacubitril", tokens=["SACUBITRIL", "VALSARTAN"]),
    "Emtricitabine; Tenofovir": dict(search="emtricitabine", tokens=["EMTRICITABINE", "TENOFOVIR"]),
    "Ethinyl Estradiol; Levonorgestrel": dict(search="levonorgestrel", tokens=["LEVONORGESTREL", "ETHINYL ESTRADIOL"]),
    "Acetaminophen; Hydrocodone": dict(search="hydrocodone bitartrate and acetaminophen", tokens=["ACETAMINOPHEN", "HYDROCODONE"]),
    "Acetaminophen; Oxycodone": dict(search="oxycodone and acetaminophen", tokens=["ACETAMINOPHEN", "OXYCODONE"]),
}
COMMON_TOKENS = {"ETHINYL ESTRADIOL", "ACETAMINOPHEN", "HYDROCHLOROTHIAZIDE"}


# --------------------------------------------------------------- helpers
def http_get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            time.sleep(DELAY_S)
            return data
        except Exception as e:  # noqa: BLE001
            print(f"  retry {i+1} {url}: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"failed: {url}")


def parse_clincalc(path):
    h = open(path, encoding="utf-8").read()
    out = []
    for r in re.findall(r"<tr.*?</tr>", h, re.S)[1:]:
        c = [html.unescape(re.sub(r"<[^>]+>", "", x)).strip() for x in re.findall(r"<td.*?</td>", r, re.S)]
        if len(c) >= 4 and c[0].isdigit():
            out.append(dict(rank=int(c[0]), drug=c[1], rx=int(c[2].replace(",", "")),
                            patients=int(c[3].replace(",", ""))))
    return out


def drug_config(name):
    o = OVERRIDES.get(name, {})
    parts = [p.strip().upper() for p in name.split(";")]
    tokens = o.get("tokens", parts)
    if "search" in o:
        search = o["search"]
    else:
        cand = [t for t in tokens if t not in COMMON_TOKENS] or tokens
        search = cand[-1].split("|")[0].lower()
    title = o.get("title", [t.split("|")[0].split()[0] for t in tokens])
    return dict(tokens=tokens, search=search, title=title, allow_and=o.get("allow_and", False))


def name_matches(name, token):
    for alt in token.split("|"):
        if name == alt or name.startswith(alt + " ") or name.startswith(alt + ","):
            return True
    return False


def ingredients_match(ingr, tokens):
    """ingr: list of (substance, [moieties]). Exact active-ingredient set match."""
    if not ingr:
        return False
    names = [[s] + m for s, m in ingr]
    for ns in names:  # every ingredient must belong to a token
        if not any(name_matches(n, t) for n in ns for t in tokens):
            return False
    for t in tokens:  # every token must be present
        if not any(name_matches(n, t) for ns in names for n in ns):
            return False
    return True


def title_ok(title, cfg):
    t = title.upper()
    head = t.split("[")[0]
    if not any(w in head for w in ("TABLET", "CAPSULE", "KIT")):
        return False
    if not all(w in t for w in cfg["title"]):
        return False
    if len(cfg["tokens"]) == 1 and " AND " in head and not cfg.get("allow_and"):
        return False
    return True


def txt(e):
    return (e.text or "").strip() if e is not None else ""


def parse_spl(xml_bytes):
    """Return list of oral-solid products with appearance from one SPL XML."""
    root = ET.fromstring(xml_bytes)
    prods = []
    containers = []
    for subj in root.iter(NS + "subject"):
        for mp in subj.findall(NS + "manufacturedProduct"):
            containers.append(mp)
    for mp in containers:
        inner = mp.find(NS + "manufacturedProduct")
        if inner is None:
            inner = mp.find(NS + "manufacturedMedicine")
        if inner is None:
            continue
        units = [(mp, inner)]
        for part in inner.findall(NS + "part"):
            pp = part.find(NS + "partProduct")
            if pp is not None:
                units.append((part, pp))
        for cont, p in units:
            form_el = p.find(NS + "formCode")
            form = (form_el.get("displayName") or "").upper() if form_el is not None else ""
            ingr, strength = [], []
            for ing in p.findall(NS + "ingredient") + p.findall(NS + "activeIngredient"):
                cc = ing.get("classCode", "")
                if not cc.startswith("ACTI"):
                    continue
                sub = ing.find(NS + "ingredientSubstance")
                if sub is None:
                    sub = ing.find(NS + "activeIngredientSubstance")
                if sub is None:
                    continue
                sname = txt(sub.find(NS + "name")).upper()
                moi = [txt(m).upper() for m in sub.iter(NS + "name") if txt(m).upper() != sname]
                ingr.append((sname, moi))
                num = ing.find(NS + "quantity/" + NS + "numerator")
                if num is not None:
                    strength.append(f"{sname} {num.get('value')}{num.get('unit')}")
            routes = {(rc.get("displayName") or "").upper() for rc in cont.iter(NS + "routeCode")}
            ch = {}
            for c in cont.findall(NS + "subjectOf/" + NS + "characteristic"):
                code = c.find(NS + "code").get("code")
                v = c.find(NS + "value")
                if v is None:
                    continue
                if code == "SPLCOLOR":
                    ch.setdefault("color", []).append((v.get("displayName") or "").upper())
                elif code == "SPLSHAPE":
                    ch["shape"] = (v.get("displayName") or "").upper()
                elif code == "SPLSIZE":
                    try:
                        ch["size_mm"] = float(v.get("value"))
                    except (TypeError, ValueError):
                        pass
                elif code == "SPLSCORE":
                    ch["score"] = v.get("value") or v.get("nullFlavor")
                elif code == "SPLIMPRINT":
                    ch["imprint"] = (v.text or "").strip()
            prods.append(dict(name=txt(p.find(NS + "name")), form=form, routes=sorted(routes),
                              ingr=ingr, strength=" + ".join(sorted(strength)), **ch))
    return prods


def is_oral_solid(p):
    f = p["form"]
    if not (f.startswith("TABLET") or f.startswith("CAPSULE") or f == "PILL"):
        return False
    if any(w in f for w in BAD_FORM_WORDS):
        return False
    if p["routes"] and not (set(p["routes"]) & ORAL_ROUTES):
        return False
    return True


# ------------------------------------------------------------------ fetch
def cmd_fetch(data):
    cache = os.path.join(data, "spl_cache")
    os.makedirs(cache, exist_ok=True)
    drugs = parse_clincalc(os.path.join(data, "clincalc_top300.html"))[:TOP_N]
    rng = random.Random(SEED)
    out = []
    for d in drugs:
        name = d["drug"]
        rec = dict(d, status=None, reason=None, spls_listed=0, spls_sampled=0, products=[])
        if name in EXCLUDE:
            rec.update(status="excluded_non_oral", reason=EXCLUDE[name])
            out.append(rec)
            continue
        cfg = drug_config(name)
        rec["cfg"] = cfg
        lst_path = os.path.join(cache, "list_" + re.sub(r"\W+", "_", cfg["search"]) + ".json")
        if os.path.exists(lst_path):
            titles = json.load(open(lst_path))
        else:
            titles, page = [], 1
            while page <= MAX_LIST_PAGES:
                q = urllib.parse.urlencode(dict(drug_name=cfg["search"], pagesize=100, page=page))
                j = json.loads(http_get(f"{API}/spls.json?{q}"))
                titles += [(x["setid"], x["title"]) for x in j["data"]]
                if page >= int(j["metadata"].get("total_pages") or 1):
                    break
                page += 1
            json.dump(titles, open(lst_path, "w"))
        cand = sorted({s for s, t in titles if title_ok(t, cfg)})
        rec["spls_listed"] = len(cand)
        rng.shuffle(cand)
        prods = []
        used = 0

        def load(setid):
            p_path = os.path.join(cache, setid + ".json")
            if os.path.exists(p_path):
                return json.load(open(p_path))
            try:
                ps = parse_spl(http_get(f"{API}/spls/{setid}.xml"))
            except Exception as e:  # noqa: BLE001
                print(f"  skip {setid}: {e}", file=sys.stderr)
                return None
            json.dump(ps, open(p_path, "w"))
            return ps
        i = 0
        while used < SPL_PER_DRUG and i < len(cand):
            batch = cand[i:i + SPL_PER_DRUG - used]
            i += len(batch)
            with ThreadPoolExecutor(WORKERS) as ex:
                results = list(ex.map(load, batch))
            for setid, ps in zip(batch, results):  # order preserved -> deterministic
                if not ps:
                    continue
                good = [dict(p, setid=setid) for p in ps
                        if is_oral_solid(p) and ingredients_match([tuple(x) for x in p["ingr"]], cfg["tokens"])]
                if good:
                    used += 1
                    prods += good
        rec["spls_sampled"] = used
        rec["products"] = prods
        rec["status"] = "ok" if prods else "no_oral_solid_in_dailymed"
        print(f"{d['rank']:3d} {name[:40]:40s} listed={len(cand):4d} spls={used:2d} products={len(prods)}",
              file=sys.stderr)
        out.append(rec)
    json.dump(out, open(os.path.join(data, "products.json"), "w"), indent=1)


# ---------------------------------------------------------------- analyze
def size_class(mm):
    for lim, lab in SIZE_CLASSES:
        if mm <= lim:
            return lab
    return SIZE_CLASSES[-1][1]


def appearance(p):
    return dict(color="+".join(sorted(set(p["color"]))), shape=p["shape"], size=p["size_mm"],
                sclass=size_class(p["size_mm"]), imprint=bool((p.get("imprint") or "").strip()),
                score=p.get("score"))


def release(form):
    return "MR" if ("EXTENDED" in form or "DELAYED" in form) else "IR"


def build_pools(recs):
    """Per drug: pool_mode = distinct appearances at the most common strength/release
    (counted over sampled SPLs); pool_all = distinct appearances over all strengths."""
    pools = {}
    stats = collections.Counter()
    for r in recs:
        if r["status"] != "ok":
            continue
        prods = []
        for p in r["products"]:
            stats["products"] += 1
            if not p.get("color") or not p.get("shape") or not p.get("size_mm"):
                stats["missing_char"] += 1
                continue
            prods.append(p)
        if not prods:
            r["status"] = "no_characteristics"
            continue
        key_spls = collections.defaultdict(set)
        for p in prods:
            key_spls[(p["strength"], release(p["form"]))].add(p["setid"])
        mode_key = max(key_spls, key=lambda k: (len(key_spls[k]), k))

        def dedup(ps):
            seen, res = set(), []
            for p in ps:
                a = appearance(p)
                k = (a["color"], a["shape"], a["size"], (p.get("imprint") or "").upper().replace(" ", ""))
                if k not in seen:
                    seen.add(k)
                    res.append(a)
            return res
        pools[r["drug"]] = dict(
            rx=r["rx"], rank=r["rank"], mode_key=list(mode_key),
            pool_mode=dedup([p for p in prods if (p["strength"], release(p["form"])) == mode_key]),
            pool_all=dedup(prods))
    return pools, stats


def weighted_sample(rng, items, weights, n):
    keys = [(rng.random() ** (1.0 / w), i) for i, w in zip(items, weights)]
    keys.sort(reverse=True)
    return [i for _, i in keys[:n]]


def groups(pills, keyf):
    c = collections.Counter(keyf(p) for p in pills)
    return [v for v in c.values() if v >= 2]


def simulate(pools, which, universe):
    rng = random.Random(SEED)
    names = list(pools)
    w = [pools[n]["rx"] for n in names]
    k_cs = lambda a: (a["color"], a["shape"])
    k_css = lambda a: (a["color"], a["shape"], a["sclass"])
    # candidates in the whole top-200 universe (distinct products over all strengths)
    uni_cs = collections.Counter(k_cs(a) for a in universe)
    uni_css = collections.Counter(k_css(a) for a in universe)
    drugs_cs, drugs_css = collections.defaultdict(set), collections.defaultdict(set)
    for dn, d in pools.items():
        for a in d["pool_all"]:
            drugs_cs[k_cs(a)].add(dn)
            drugs_css[k_css(a)].add(dn)
    res = {}
    for n in N_LIST:
        agg = collections.defaultdict(list)
        for _ in range(SIMS):
            ds = weighted_sample(rng, names, w, n)
            pills = [rng.choice(pools[d][which]) for d in ds]
            for lab, kf in (("cs", k_cs), ("css", k_css)):
                g = groups(pills, kf)
                agg[f"any_{lab}"].append(1 if g else 0)
                agg[f"pills_in_groups_{lab}"].append(sum(g))
                if g:
                    agg[f"group_size_{lab}"].extend(g)
                    agg[f"n_groups_{lab}"].append(len(g))
            # candidate count for one photographed pill
            j = rng.randrange(n)
            q = pills[j]
            agg["cand_list_cs"].append(sum(1 for p in pills if k_cs(p) == k_cs(q)))
            agg["cand_list_css"].append(sum(1 for p in pills if k_css(p) == k_css(q)))
            agg["cand_uni_cs"].append(uni_cs[k_cs(q)])
            agg["cand_uni_css"].append(uni_css[k_css(q)])
            agg["cand_uni_drugs_cs"].append(len(drugs_cs[k_cs(q)]))
            agg["cand_uni_drugs_css"].append(len(drugs_css[k_css(q)]))
        out = dict(N=n)
        for lab in ("cs", "css"):
            out[f"p_any_{lab}"] = statistics.mean(agg[f"any_{lab}"])
            out[f"mean_pills_in_groups_{lab}"] = statistics.mean(agg[f"pills_in_groups_{lab}"])
            gs = agg[f"group_size_{lab}"]
            out[f"mean_group_size_{lab}"] = statistics.mean(gs) if gs else 0
            out[f"p_group_ge3_{lab}"] = (sum(1 for x in gs if x >= 3) / len(gs)) if gs else 0
        for k in ("cand_list_cs", "cand_list_css", "cand_uni_cs", "cand_uni_css",
                  "cand_uni_drugs_cs", "cand_uni_drugs_css"):
            v = agg[k]
            out[k + "_mean"] = statistics.mean(v)
            out[k + "_median"] = statistics.median(v)
        out["p_unique_in_list_cs"] = statistics.mean(1 if x == 1 else 0 for x in agg["cand_list_cs"])
        out["p_unique_in_list_css"] = statistics.mean(1 if x == 1 else 0 for x in agg["cand_list_css"])
        res[n] = out
    return res


def describe(pools, universe):
    def shares(items, wts=None):
        wts = wts or [1] * len(items)
        tot = sum(wts)
        f = lambda cond: sum(w for a, w in zip(items, wts) if cond(a)) / tot
        return dict(n=len(items), white=f(lambda a: a["color"] == "WHITE"),
                    round=f(lambda a: a["shape"] == "ROUND"),
                    white_round=f(lambda a: a["color"] == "WHITE" and a["shape"] == "ROUND"),
                    imprint=f(lambda a: a["imprint"]),
                    le8=f(lambda a: a["sclass"] == "<=8mm"),
                    capsule=f(lambda a: a["shape"] == "CAPSULE"))
    # Rx-weighted: each drug's weight split evenly over its mode pool
    items, wts = [], []
    for d in pools.values():
        for a in d["pool_mode"]:
            items.append(a)
            wts.append(d["rx"] / len(d["pool_mode"]))
    top_colors = collections.Counter(a["color"] for a in universe).most_common(8)
    top_shapes = collections.Counter(a["shape"] for a in universe).most_common(6)
    top_cs = collections.Counter((a["color"], a["shape"]) for a in universe).most_common(8)
    return dict(all_products=shares(universe), mode_products_rx_weighted=shares(items, wts),
                top_colors=top_colors, top_shapes=top_shapes, top_color_shape=top_cs)


def cmd_analyze(data):
    recs = json.load(open(os.path.join(data, "products.json")))
    pools, stats = build_pools(recs)
    universe = [a for d in pools.values() for a in d["pool_all"]]
    status = collections.Counter(r["status"] for r in recs)
    res = dict(
        params=dict(TOP_N=TOP_N, SPL_PER_DRUG=SPL_PER_DRUG, SEED=SEED, N_LIST=N_LIST, SIMS=SIMS,
                    SIZE_CLASSES=SIZE_CLASSES),
        status=status, excluded={r["drug"]: r["reason"] for r in recs if r["status"] == "excluded_non_oral"},
        no_data=[r["drug"] for r in recs if r["status"] in ("no_oral_solid_in_dailymed", "no_characteristics")],
        product_stats=stats,
        n_drugs=len(pools), rx_covered=sum(d["rx"] for d in pools.values()),
        rx_top=sum(r["rx"] for r in recs),
        spls_sampled=sum(r["spls_sampled"] for r in recs),
        universe_size=len(universe),
        mean_pool_mode=statistics.mean(len(d["pool_mode"]) for d in pools.values()),
        mean_pool_all=statistics.mean(len(d["pool_all"]) for d in pools.values()),
        describe=describe(pools, universe),
        sim_mode=simulate(pools, "pool_mode", universe),
        sim_all=simulate(pools, "pool_all", universe),
    )
    json.dump(res, open(os.path.join(data, "results.json"), "w"), indent=1, default=str)
    json.dump({k: dict(rank=v["rank"], rx=v["rx"], mode_key=v["mode_key"], pool_mode=v["pool_mode"])
               for k, v in pools.items()}, open(os.path.join(data, "pools.json"), "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("sim_mode", "sim_all")}, indent=1, default=str))
    for lab in ("sim_mode", "sim_all"):
        print(f"\n## {lab}")
        for n, o in res[lab].items():
            print(n, {k: round(v, 3) if isinstance(v, float) else v for k, v in o.items()})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["fetch", "analyze"])
    ap.add_argument("--data", required=True, help="working directory for downloads and results")
    a = ap.parse_args()
    {"fetch": cmd_fetch, "analyze": cmd_analyze}[a.cmd](a.data)


if __name__ == "__main__":
    main()
