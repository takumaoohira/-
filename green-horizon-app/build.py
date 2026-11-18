#!/usr/bin/env python3
"""公開版をつくる。

  python3 build.py

odawarajo-cc/fpv-sim.html（開発中のゲーム）から public/ と functions/_data/ を生成する。
- 無料コース（小田原城CC）以外のホール情報はゲームから取り除き、サーバー側（functions/_data/courses.js）へ移す。
  購入済みの人にだけ /api/course から配信する。
- PWA（ホーム画面に追加）用のマニフェスト・Service Worker・アイコン、法的表記のページを出力する。
"""
import hashlib, html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "..", "odawarajo-cc", "fpv-sim.html")
PUB = os.path.join(ROOT, "public")
CFG = json.load(open(os.path.join(ROOT, "shop.config.json"), encoding="utf-8"))

def die(msg):
    sys.exit("エラー: " + msg)

src = open(SRC, encoding="utf-8").read()

# ---- 1) ワールドヘリテージGC（JS内のデータ）を取り出す ----
a = src.find("const WORLD=[")
b = src.find("\n];", a)
if a < 0 or b < 0: die("WORLD のデータが見つかりません")
world_js = src[a + len("const WORLD="): b + 2]
themes = re.search(r"const WORLD_THEME=(\[[^\]]*\]);", src)
if not themes: die("WORLD_THEME が見つかりません")
world = json.loads(subprocess.run(["node", "-e", "process.stdout.write(JSON.stringify(eval('('+require('fs').readFileSync(0,'utf8')+')')))"],
                                  input=world_js, capture_output=True, text=True, check=True).stdout)
wt = json.loads(themes.group(1))
for h in world: h["theme"] = wt[h["n"] - 1]

meta_world = re.search(r'world:\{id:"world",name:"([^"]+)"', src)
courses_data = {"world": {"holes": world}}
courses_meta = {"world": {"name": meta_world.group(1)}}

# ---- 2) 埋め込みJSONのコース（天嶺GCなど）は、名前・説明だけ残してホール情報を外す ----
def strip_course(m):
    c = json.loads(m.group(2))
    courses_data[c["id"]] = c
    courses_meta[c["id"]] = {"name": c["name"]}
    keep = {k: c[k] for k in ("id", "name", "desc", "card", "theme") if k in c}
    return m.group(1) + json.dumps(keep, ensure_ascii=False) + m.group(3)
out = re.sub(r'(<script type="application/json" id="course-[^"]+" data-course>)(.*?)(</script>)', strip_course, src, flags=re.S)
out = out.replace(out[out.find("const WORLD=["): out.find("\n];", out.find("const WORLD=[")) + 3], "const WORLD=[];", 1)

free = set(CFG["free_courses"])
paid = {}
for cid in courses_meta:
    if cid in free: continue
    price = int(CFG["price_yen"].get(cid, 100))
    courses_meta[cid]["price"] = price
    paid[cid] = price
courses_meta = {k: v for k, v in courses_meta.items() if k in paid}
courses_data = {k: v for k, v in courses_data.items() if k in paid}

# ---- 3) 公開用の head（PWA・OGP・ショップ設定）と Service Worker の登録 ----
url = CFG["site_url"].rstrip("/")
shop = {"api": "/api", "paid": paid,
        "legal": [["特定商取引法に基づく表記", "/legal/tokushoho"], ["利用規約", "/legal/terms"], ["プライバシーポリシー", "/legal/privacy"]]}
desc = "ブラウザで遊べる本格3Dゴルフ。小田原城CCは無料、追加コースは1コース税込100円の買い切り。"
head = f'''<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="description" content="{desc}">
<meta name="theme-color" content="#0d2a5a">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="GREEN HORIZON">
<meta property="og:type" content="website">
<meta property="og:title" content="GREEN HORIZON ゴルフ">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}/">
<meta property="og:image" content="{url}/ogp.png">
<meta name="twitter:card" content="summary_large_image">
<script>window.GH_SHOP={json.dumps(shop, ensure_ascii=False)};</script>
'''
out = re.sub(r"<title>.*?</title>", "<title>GREEN HORIZON ゴルフ</title>", out, count=1)
out = "<!doctype html>\n<html lang=\"ja\">\n<head>\n" + head + out
reg = '''<script>if("serviceWorker"in navigator&&location.protocol==="https:")addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));</script>\n'''
out = out.rstrip() + "\n" + reg

# 有料コースのホール情報がゲーム本体に残っていないか確認
if 'name:"' + world[0]["name"] + '",pts' in out: die("ワールドヘリテージGCのホール情報が残っています")
for m in re.finditer(r'<script type="application/json" id="course-[^"]+" data-course>(.*?)</script>', out, flags=re.S):
    if '"holes"' in m.group(1) and json.loads(m.group(1))["id"] in paid: die("有料コースのホール情報が残っています")

os.makedirs(PUB, exist_ok=True)
open(os.path.join(PUB, "index.html"), "w", encoding="utf-8").write(out)
ver = hashlib.sha256(out.encode()).hexdigest()[:10]

data_js = "// build.py が自動生成（編集しない）。有料コースのデータ。\nexport default " + json.dumps({"meta": courses_meta, "data": courses_data}, ensure_ascii=False) + ";\n"
os.makedirs(os.path.join(ROOT, "functions", "_data"), exist_ok=True)
open(os.path.join(ROOT, "functions", "_data", "courses.js"), "w", encoding="utf-8").write(data_js)

# ---- 4) マニフェスト・Service Worker・ヘッダー ----
manifest = {
    "name": "GREEN HORIZON ゴルフ", "short_name": "GREEN HORIZON", "lang": "ja", "start_url": "/", "scope": "/",
    "display": "fullscreen", "orientation": "any", "background_color": "#0d2a5a", "theme_color": "#0d2a5a",
    "description": desc,
    "icons": [{"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
              {"src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}]}
json.dump(manifest, open(os.path.join(PUB, "manifest.webmanifest"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

three = re.search(r'<script src="(https://cdn\.jsdelivr\.net/npm/three@[^"]+)"', src).group(1)
sw = open(os.path.join(ROOT, "sw.template.js"), encoding="utf-8").read().replace("__VERSION__", ver).replace("__THREE__", three)
open(os.path.join(PUB, "sw.js"), "w", encoding="utf-8").write(sw)

# ---- 5) 法的表記のページ ----
S = {k: html.escape(v) for k, v in CFG["seller"].items()}
S["date"] = html.escape(CFG["effective_date"]); S["site"] = html.escape(CFG["site_name"]); S["url"] = html.escape(url)
for name in ("tokushoho", "terms", "privacy"):
    t = open(os.path.join(ROOT, "legal", name + ".html"), encoding="utf-8").read()
    for k, v in S.items(): t = t.replace("{{" + k + "}}", v)
    open(os.path.join(PUB, "legal", name + ".html"), "w", encoding="utf-8").write(t)

todo = sorted({m for m in re.findall(r"【要記入：[^】]*】", json.dumps(CFG, ensure_ascii=False))})
print(f"public/index.html {len(out)/1e6:.1f}MB  有料コース: {', '.join(f'{k}={v}円' for k, v in paid.items())}  版: {ver}")
if todo:
    print("※ shop.config.json の未記入項目（公開前に必ず記入）：\n  " + "\n  ".join(todo))
