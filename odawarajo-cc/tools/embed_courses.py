"""courses/*.json を fpv-sim.html に埋め込む。

コースを追加・編集したら、このスクリプトを実行するだけでゲームに反映される
（ゲーム本体のプログラムは書き換えない）。

使い方: python3 tools/embed_courses.py
"""
import glob, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "fpv-sim.html")
ANCHOR = '<script src="https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js"></script>'

s = open(HTML, encoding="utf-8").read()
s = re.sub(r'<script type="application/json" id="course-[^"]+" data-course>.*?</script>\n', "", s, flags=re.S)
blocks = []
for path in sorted(glob.glob(os.path.join(ROOT, "courses", "*.json"))):
    c = json.load(open(path, encoding="utf-8"))
    for k in ("id", "name", "holes"):
        assert k in c, f"{path}: {k} がありません"
    for h in c["holes"]:
        for k in ("n", "p", "y", "pts", "elev", "aims"):
            assert k in h, f"{path} {h.get('n')}番: {k} がありません"
    txt = json.dumps(c, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    blocks.append(f'<script type="application/json" id="course-{c["id"]}" data-course>{txt}</script>\n')
    print("embed", c["id"], c["name"], len(c["holes"]), "holes", sum(h["y"] for h in c["holes"]), "Y", "PAR", sum(h["p"] for h in c["holes"]))
assert s.count(ANCHOR) == 1
s = s.replace(ANCHOR, "".join(blocks) + ANCHOR)
open(HTML, "w", encoding="utf-8").write(s)
