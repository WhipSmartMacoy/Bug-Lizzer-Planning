#!/usr/bin/env python3
"""Bug-Lizzer · morning recipe search from home (Allrecipes and Serious Eats).

Those two sites block requests from Supabase's servers, but not from a home internet connection,
so this runs on the Home Assistant laptop at 6:30 each morning (automation bug_lizzer_home_recipes):

1. asks the find-recipes function what to search for (the same protein-first plan as the 6:30 am search),
2. searches both sites and reads each recipe's ingredient list,
3. sends the recipes back; the 6:30 am search judges them against At Home like the NYT ones.

Uses only Python's standard library. Signs in with the Home Assistant token in secrets.yaml
(bug_lizzer_token) — nothing secret is stored in this file.
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html import unescape

FN = "https://ndbanzpiwhaqvtsepszf.supabase.co/functions/v1/find-recipes"
IMPORT = "https://ndbanzpiwhaqvtsepszf.supabase.co/functions/v1/import-recipe"
APIKEY = "sb_publishable_ShdakQ72QP9DFFyTPcg0_g_IBZBdNcc"   # publishable key: safe to share
SECRETS = "/config/secrets.yaml"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")
MAX_RECIPES = 450          # recipe pages to read each morning (about 10–15 minutes)
SITES = [
    ("Allrecipes", "https://www.allrecipes.com/search?q={q}{page}",
     re.compile(r'href="(https://www\.allrecipes\.com/recipe/\d+/[a-z0-9-]+)/?"')),
    ("Serious Eats", "https://www.seriouseats.com/search?q={q}{page}",
     re.compile(r'href="(https://www\.seriouseats\.com/[a-z0-9-]*recipe[a-z0-9-]*)"')),
]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def token():
    for line in open(SECRETS, encoding="utf-8"):
        m = re.match(r"\s*bug_lizzer_token\s*:\s*['\"]?([^'\"#\s]+)", line)
        if m:
            return m.group(1)
    raise SystemExit("bug_lizzer_token not found in secrets.yaml")


def call(tok, body, fn=FN):
    req = urllib.request.Request(fn, data=json.dumps(body).encode(), method="POST", headers={
        "Content-Type": "application/json", "apikey": APIKEY, "x-ha-token": tok})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def get(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html",
                                                   "Accept-Language": "en-US,en;q=0.9"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:  # blocked, missing, slow: skip it
        log("skip", url, type(e).__name__, getattr(e, "code", ""))
        return ""


def find_recipe(x):
    if isinstance(x, list):
        for y in x:
            r = find_recipe(y)
            if r:
                return r
    elif isinstance(x, dict):
        t = x.get("@type")
        if t == "Recipe" or (isinstance(t, list) and "Recipe" in t):
            return x
        for k in ("@graph", "mainEntity"):
            if k in x:
                r = find_recipe(x[k])
                if r:
                    return r
    return None


def read_recipe(site_url):
    site, url = site_url
    html = get(url)
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>', html, re.I):
        try:
            r = find_recipe(json.loads(m.group(1).strip()))
        except Exception:
            continue
        if r and isinstance(r.get("recipeIngredient"), list) and r["recipeIngredient"]:
            img = r.get("image")
            if isinstance(img, list):
                img = img[0] if img else None
            if isinstance(img, dict):
                img = img.get("url")
            y = r.get("recipeYield")
            y = [str(v) for v in (y if isinstance(y, list) else [y] if y is not None else []) if str(v).strip()]
            servings = next((v for v in y if re.search(r"serv|people|portion", v, re.I)), None) or (y[0] + " servings" if y and y[0].isdigit() else (y[0] if y else None))
            return {"url": url, "site": site, "title": unescape(str(r.get("name", ""))), "servings": servings,
                    "image": img, "lines": [unescape(str(l)) for l in r["recipeIngredient"]][:60]}
    return None


def read_saved(tok):
    """Recipes saved to the recipe box from Allrecipes or Serious Eats: read them and fill in their amounts."""
    urls = call(tok, {"home": "queue"}, IMPORT).get("urls", [])
    if not urls:
        return
    log("saved recipes to read:", len(urls))
    site = lambda u: "Serious Eats" if "seriouseats" in u else "Allrecipes"
    with ThreadPoolExecutor(max_workers=4) as pool:
        got = list(pool.map(read_recipe, [(site(u), u) for u in urls]))
    items = [r for r in got if r]
    failed = [u for u, r in zip(urls, got) if not r]
    log("filled:", call(tok, {"home": "fill", "items": items, "failed": failed}, IMPORT))


def main():
    tok = token()
    read_saved(tok)
    if "--read" in sys.argv:      # asked by the app right after a save: just those recipes
        return
    plan = call(tok, {"home": "plan"}).get("queries", [])
    log("searches planned:", len(plan))
    if not plan:
        return
    # Search both sites; "ground beef|2" means page 2 (24 results a page, by offset).
    urls, seen = [], set()
    for q in plan:
        term, _, pg = q.partition("|")
        for site, pattern, link in SITES:
            page = f"&offset={(int(pg) - 1) * 24}" if pg else ""
            html = get(pattern.format(q=urllib.parse.quote_plus(term), page=page))
            found = list(dict.fromkeys(link.findall(html)))
            for u in found[: 24 if "|" in q or " " not in term else 8]:
                if u not in seen:
                    seen.add(u)
                    urls.append((site, u))
            time.sleep(0.5)            # be polite to the sites
        if len(urls) >= MAX_RECIPES:
            break
    urls = urls[:MAX_RECIPES]
    log("recipes to read:", len(urls))
    with ThreadPoolExecutor(max_workers=4) as pool:
        recipes = [r for r in pool.map(read_recipe, urls) if r]
    log("recipes read:", len(recipes))
    for i in range(0, max(len(recipes), 1), 100):
        r = call(tok, {"home": "recipes", "start": i == 0, "items": recipes[i:i + 100]})
        log("sent", min(i + 100, len(recipes)), r)
    # Add them to the recipe ideas now (the 6:30 am search also adds them when it rebuilds the list).
    log("added to ideas:", call(tok, {"home": "judge"}))


if __name__ == "__main__":

    try:
        main()
    except Exception as e:
        log("failed:", e)
        sys.exit(1)
