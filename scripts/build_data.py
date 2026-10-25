"""Rebuild data/ for Hanzi Cards.

Usage (from the repo root):
    npm install hanzi hanzi-writer-data
    python3 scripts/build_data.py
"""
import os, re, json, glob, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NM = os.path.join(ROOT, "node_modules")
OUT = ROOT
for f in glob.glob(OUT + "/data/strokes/s*.json"):
    os.remove(f)
os.makedirs(OUT + "/data/strokes", exist_ok=True)

def load_js_string(path):
    s = open(path, encoding="utf-8").read()
    a = s.index("`") + 1
    b = s.rindex("`")
    return s[a:b]

# ---- frequency (Leiden word freq) ----
freq = {}
for line in load_js_string(NM + "/hanzi/lib/data/leidenfreqdata.txt.js").splitlines():
    if "," in line:
        w, c = line.rsplit(",", 1)
        try: freq[w] = int(c)
        except: pass
# char freq from Jun Da (counts) to back-fill single chars
for line in load_js_string(NM + "/hanzi/lib/data/frequencyjunda.txt.js").splitlines():
    p = line.split("\t")
    if len(p) > 2:
        try: freq[p[1]] = max(freq.get(p[1], 0), int(p[2]) // 50)
        except: pass

# ---- CC-CEDICT ----
pat = re.compile(r"^(\S+) (\S+) \[([^\]]*)\] /(.*)/\s*$")
entries = {}  # simp -> list
for line in load_js_string(NM + "/hanzi/lib/data/cedict_ts.u8.js").splitlines():
    if line.startswith("#"): continue
    m = pat.match(line)
    if not m: continue
    trad, simp, pin, defs = m.groups()
    defs = [d for d in defs.split("/") if d]
    if not defs: continue
    entries.setdefault(simp, []).append((trad, pin, defs))

from collections import defaultdict
rscore = defaultdict(int)
for simp, lst in entries.items():
    if len(simp) < 2: continue
    f = freq.get(simp, 0)
    if not f: continue
    for trad, pin, defs in lst:
        syl = pin.lower().replace("u:", "v").split()
        if len(syl) == len(simp):
            for ch, sy in zip(simp, syl):
                rscore[(ch, sy)] += f

PREFER = {"都": "dou1", "长": "chang2"}
VAR = re.compile(r"^(old |archaic |Japanese |)variant of|^see [^ ]+$|^used in ")
lines = []
for simp, lst in entries.items():
    # drop entries that are only cross-references when a real entry exists
    real = [e for e in lst if not all(VAR.search(d) for d in e[2])]
    keep = real if real else lst
    # common readings first: lowercase pinyin before proper nouns
    if len(simp) == 1:
        keep.sort(key=lambda e: (e[1][:1].isupper(), e[1].lower() != PREFER.get(simp), -rscore[(simp, e[1].lower().replace("u:", "v"))]))
    else:
        keep.sort(key=lambda e: (e[1][:1].isupper(),))
    f = freq.get(simp, 0)
    for trad, pin, defs in keep:
        if all(VAR.search(x) or x.startswith("unofficial variant") for x in defs) and len(keep) > 1: continue
        out=[]; n=0
        for x in defs:
            if out and n + len(x) > 140: break
            out.append(x); n += len(x) + 2
        d = "; ".join(out).replace("\t", " ")
        t = "" if trad == simp else trad
        lines.append(f"{simp}\t{t}\t{pin}\t{d}\t{f or ''}")

with open(OUT + "/data/dict.tsv", "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))
print("dict entries", len(lines), os.path.getsize(OUT + "/data/dict.tsv") / 1e6, "MB")

# ---- stroke data, chunked by codepoint into ~300KB files, loaded on demand ----
items = []
for f in glob.glob(NM + "/hanzi-writer-data/*.json"):
    ch = os.path.basename(f)[:-5]
    if len(ch) != 1: continue
    d = json.load(open(f, encoding="utf-8"))
    d.pop("radStrokes", None)
    items.append((ord(ch), ch, d))
items.sort()
chunks, cur, size = [], {}, 0
starts = []
for cp, ch, d in items:
    s = json.dumps(d, separators=(",", ":"), ensure_ascii=False)
    if size + len(s) > 300_000 and cur:
        chunks.append(cur); cur, size = {}, 0
    if not cur: starts.append(cp)
    cur[ch] = d; size += len(s)
if cur: chunks.append(cur)
for i, c in enumerate(chunks):
    with open(f"{OUT}/data/strokes/s{i:02d}.json", "w", encoding="utf-8") as fh:
        json.dump(c, fh, separators=(",", ":"), ensure_ascii=False)
# point the page at the new chunk boundaries
page = os.path.join(OUT, "index.html")
html = open(page, encoding="utf-8").read()
html, n = re.subn(r"const STARTS = \[[0-9,]*\];", "const STARTS = " + json.dumps(starts, separators=(",", ":")) + ";", html)
assert n == 1, "couldn't find STARTS in index.html"
open(page, "w", encoding="utf-8").write(html)
lic = os.path.join(NM, "hanzi-writer-data", "ARPHICPL.TXT")
if os.path.exists(lic):
    shutil.copy(lic, OUT + "/data/strokes/ARPHICPL.TXT")
print("stroke chunks", len(chunks), "chars", len(items))
