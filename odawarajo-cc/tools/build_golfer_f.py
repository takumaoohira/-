"""女性ゴルファーの3Dモデルを手続き生成するスクリプト。

距離関数（SDF）で体・服・髪を形作り、マーチングキューブでメッシュ化、
間引き・UV・頂点カラー・スキンウェイトを付けて JSON（base64）に書き出す。
出力は fpv-sim.html に埋め込んで使う（実行時に外部ファイルは読まない）。

使い方: python3 build_golfer_f.py [出力先.json]
"""
import base64, json, sys
import numpy as np
from skimage import measure
import trimesh
import fast_simplification
from scipy.spatial import cKDTree

YD = 1.0936  # メートル → ヤード


# ---------- SDF の部品 ----------
def length(v):
    return np.sqrt((v * v).sum(-1))


def sph(P, c, r):
    return length(P - np.asarray(c, float)) - r


def rotx(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ell(P, c, r, R=None):
    q = P - np.asarray(c, float)
    if R is not None:
        q = q @ R  # 行ベクトルに R を右から掛ける = R^T q（ワールド→ローカル）
    r = np.asarray(r, float)
    k0 = length(q / r)
    k1 = length(q / (r * r))
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)


def cap(P, a, b, r1, r2):
    a = np.asarray(a, float); b = np.asarray(b, float)
    ba = b - a; pa = P - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
    return length(pa - h[:, None] * ba) - (r1 + (r2 - r1) * h)


def smin(a, b, k):
    h = np.clip(.5 + .5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def unit(v):
    v = np.asarray(v, float); return v / np.linalg.norm(v)


# ---------- 骨格（バインドポーズ, メートル） ----------
J = {}
J["pelvis"] = np.array([0, .95, 0.])
J["neck"] = np.array([0, 1.39, -.01])
J["head"] = np.array([0, 1.52, 0.])
for s, n in ((1, "L"), (-1, "R")):
    sh = np.array([s * .165, 1.355, -.01])
    el = sh + .27 * np.array([s * np.sin(np.radians(24)), -np.cos(np.radians(24)), 0])
    wr = el + .235 * unit([s * np.sin(np.radians(14)), -np.cos(np.radians(14)), .1])
    J["sh" + n], J["el" + n], J["wr" + n] = sh, el, wr
    J["hand" + n] = wr + .085 * unit(wr - el)
    J["hip" + n] = np.array([s * .085, .885, 0])
    J["knee" + n] = np.array([s * .09, .48, .005])
    J["ankle" + n] = np.array([s * .095, .075, -.01])
    J["toe" + n] = np.array([s * .1, .02, .14])

EYE = [np.array([s * .03, 1.53, .0742]) for s in (1, -1)]


# ---------- 体（肌） ----------
def hand_sdf(P, n):
    wr, el = J["wr" + n], J["el" + n]
    d_ = unit(wr - el)
    side = unit(np.cross(d_, [0, 0, 1])) if n == "L" else unit(np.cross([0, 0, 1], d_))
    c = wr + d_ * .048
    # 指を軽く握った手（手のひら＋指の塊＋親指）
    palm = cap(P, wr + d_ * .01, wr + d_ * .06, .026, .024)
    fing = cap(P, wr + d_ * .07 + np.array([0, 0, .012]), wr + d_ * .075 + np.array([0, 0, .03]), .02, .016)
    thumb = cap(P, wr + d_ * .02 + side * .02 + np.array([0, 0, .015]), wr + d_ * .055 + np.array([0, 0, .032]), .011, .009)
    h = smin(palm, fing, .02)
    h = smin(h, thumb, .012)
    # 手の厚みを薄く（手の甲側を少し削る）
    return h


def body_sdf(P, part="all"):
    d = ell(P, (0, 1.272, -.006), (.126, .128, .086))
    d = smin(d, ell(P, (0, 1.105, 0), (.1, .11, .074)), .06)
    d = smin(d, ell(P, (0, .955, -.01), (.152, .112, .1)), .07)
    d = smin(d, ell(P, (0, .925, -.05), (.125, .085, .075)), .05)
    for s in (1, -1):
        d = smin(d, sph(P, (s * .052, 1.252, .055), .05), .035)
        d = smin(d, sph(P, (s * .155, 1.345, -.01), .046), .05)
        d = smin(d, cap(P, (0, 1.39, -.02), (s * .145, 1.36, -.015), .036, .042), .04)
    d = smin(d, cap(P, (0, 1.36, -.012), (0, 1.47, -.004), .049, .043), .03)
    if part in ("all", "arms"):
        for n in ("L", "R"):
            sh, el, wr = J["sh" + n], J["el" + n], J["wr" + n]
            a = cap(P, sh, el, .042, .032)
            a = smin(a, ell(P, sh + (el - sh) * .4 + np.array([0, 0, .006]), (.036, .06, .036)), .02)
            a = smin(a, cap(P, el, wr, .033, .022), .018)
            a = smin(a, ell(P, el + (wr - el) * .3, (.034, .055, .032)), .015)
            a = smin(a, hand_sdf(P, n), .012)
            d = smin(d, a, .028)
    if part in ("all", "legs"):
        for s, n in ((1, "L"), (-1, "R")):
            hp, kn, an = J["hip" + n], J["knee" + n], J["ankle" + n]
            l = cap(P, hp, kn, .074, .047)
            l = smin(l, ell(P, hp + (kn - hp) * .3 + np.array([s * .012, 0, .005]), (.06, .13, .062)), .04)
            l = smin(l, sph(P, kn + np.array([0, 0, .008]), .044), .025)
            l = smin(l, cap(P, kn, an, .044, .028), .02)
            l = smin(l, ell(P, (s * .093, .335, -.022), (.04, .09, .042)), .03)
            l = smin(l, sph(P, an, .029), .02)
            l = smin(l, ell(P, (s * .097, .045, .045), (.035, .03, .1)), .02)
            d = smin(d, l, .045)
    return d


def head_sdf(P):
    d = ell(P, (0, 1.55, -.01), (.072, .094, .09))
    d = smin(d, ell(P, (0, 1.505, .02), (.057, .066, .07)), .03)
    d = smin(d, ell(P, (0, 1.474, .028), (.048, .04, .058)), .022)
    d = smin(d, sph(P, (0, 1.444, .05), .019), .022)
    for s in (1, -1):
        d = smin(d, ell(P, (s * .038, 1.51, .06), (.024, .018, .019)), .018)
        d = smin(d, ell(P, (s * .075, 1.522, -.008), (.009, .027, .017)), .008)
        # 眼窩とまぶた
        d = smax(d, -sph(P, EYE[0 if s == 1 else 1] + np.array([0, 0, .002]), .0138), .006)
        d = smin(d, ell(P, (s * .03, 1.5385, .0792), (.0175, .0048, .0085)), .004)
        d = smin(d, ell(P, (s * .03, 1.5205, .0772), (.0145, .003, .0068)), .004)
        d = smin(d, sph(P, (s * .009, 1.497, .09), .0068), .006)
    d = smin(d, cap(P, (0, 1.538, .083), (0, 1.505, .1), .0058, .0085), .008)
    d = smin(d, sph(P, (0, 1.501, .0985), .0092), .006)
    d = smin(d, ell(P, (0, 1.4745, .0815), (.016, .0048, .0082)), .005)
    d = smin(d, ell(P, (0, 1.4635, .0795), (.0145, .0058, .009)), .005)
    for sx in (-1, 1):
        d = smax(d, -cap(P, (0, 1.4685, .087), (sx * .018, 1.4725, .081), .0014, .0018), .002)  # 口角の上がった口の線
    d = smin(d, cap(P, (0, 1.36, -.012), (0, 1.47, -.004), .049, .043), .03)
    return d


# ---------- 髪・サンバイザー ----------
def hair_sdf(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    scalp = ell(P, (0, 1.553, -.012), (.084, .104, .1))
    t = np.clip((z + .06) / .1, 0, 1)
    hl = 1.47 + t * .118                      # 生え際（後ろは低く、前は高く）
    region = hl - y
    h = smax(scalp, region, .012)
    ear = np.minimum(sph(P, (.076, 1.52, -.006), .03), sph(P, (-.076, 1.52, -.006), .03))
    h = smax(h, -ear, .01)
    # 前髪
    fr = ell(P, (.006, 1.6, .058), (.07, .05, .036), rotx(.55))
    tip = 1.566 + .006 * np.sin(x * 160) + (x + .07) * .12   # 毛先の段差と、右へ流れる斜め
    fr = smax(fr, tip - y, .004)
    fr = smax(fr, -(ell(P, (0, 1.55, -.01), (.073, .095, .091)) - .002), .003)  # 額から少し浮かせる
    h = smin(h, fr, .01)
    # もみあげの毛束
    for s in (1, -1):
        for j in range(2):
            h = smin(h, cap(P, (s * (.068 + .004 * j), 1.575, .04 - .012 * j), (s * (.074 + .003 * j), 1.462 + .01 * j, .052 - .012 * j), .0075, .0035), .006)
    # 高い位置のポニーテール
    pts = [(0, 1.628, -.07), (0, 1.6, -.12), (.006, 1.53, -.148), (0, 1.45, -.155), (-.008, 1.37, -.148), (0, 1.3, -.136), (.006, 1.25, -.126)]
    rs = [.028, .031, .03, .027, .022, .016, .008]
    for i in range(len(pts) - 1):
        h = smin(h, cap(P, pts[i], pts[i + 1], rs[i], rs[i + 1]), .012)
    # 毛流れの溝
    ang = np.arctan2(x, z + .02)
    h = h + .0009 * np.sin(ang * 70 + y * 40)
    return h


def visor_sdf(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    q = np.stack([x / .088, z / .102 + .05], -1)
    rr = length(q)
    ring = np.abs(rr - 1) * .09 - .0022
    band = smax(ring, np.abs(y - 1.598) - .0135, .002)
    ang = np.arctan2(x, z + .005)
    band = smax(band, np.abs(ang) - np.radians(118), .01)
    Pl = (P - np.array([0, 1.594, .072])) @ rotx(.22)
    bx, by, bz = Pl[:, 0], Pl[:, 1], Pl[:, 2]
    e = length(np.stack([bx / .084, bz / .1], -1)) - 1
    brim = smax(e * .084, np.abs(by) - .0028, .001)
    brim = smax(brim, -bz, .003)  # 前側の半分だけ
    return smin(band, brim, .006)


# ---------- 服 ----------
def polo_sdf(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    t = body_sdf(P, part="torso") - .0085
    t = smin(t, ell(P, (0, 1.1, -.004), (.112, .14, .085)), .03)
    for n in ("L", "R"):
        sh, el = J["sh" + n], J["el" + n]
        a = unit(el - sh)
        sl = cap(P, sh - a * .02, sh + a * .12, .05, .046)
        t = smin(t, sl, .02)
    t = smax(t, .985 - y, .01)
    # 襟（前に向かって低くなるリング）
    Pc = (P - np.array([0, 1.425, -.006])) @ rotx(.28)
    rc = length(np.stack([Pc[:, 0] / .062, Pc[:, 2] / .058], -1))
    col = length(np.stack([(rc - 1) * .06, Pc[:, 1] * 1.4], -1)) - .0105
    t = smin(t, col, .006)
    # 首まわりの開き
    t = smax(t, -cap(P, (0, 1.39, -.01), (0, 1.5, 0), .05, .05), .004)
    t = smax(t, -cap(P, (0, 1.37, .07), (0, 1.47, .06), .012, .045), .006)  # 前の開き
    return t


def skirt_sdf(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    tt = np.clip((1.04 - y) / .25, 0, 1)
    rx = .128 + .088 * np.sqrt(tt)
    rz = .098 + .068 * np.sqrt(tt)
    ang = np.arctan2(x, z + .012)
    pleat = .009 * np.clip(tt * 1.6 - .25, 0, 1) * np.abs(np.sin(ang * 11))
    q = length(np.stack([x / (rx + pleat), (z + .012) / (rz + pleat)], -1)) - 1
    rad = q * np.minimum(rx, rz)
    shell = np.abs(rad) - .0032
    band = np.where(y > 1.0, np.abs(rad - .002) - .0045, 1)
    s = np.minimum(shell, band)
    s = smax(s, y - 1.045, .002)
    s = smax(s, .79 - y, .002)
    return s


def shoe_sdf(P):
    out = None
    for s, n in ((1, "L"), (-1, "R")):
        c = np.array([s * .097, .05, .045])
        d = ell(P, c, (.043, .046, .118))
        d = smin(d, ell(P, (s * .099, .03, .1), (.04, .028, .08)), .02)
        d = smin(d, cap(P, (s * .095, .07, -.035), (s * .095, .11, -.03), .036, .032), .02)
        d = smax(d, -P[:, 1] + .0, .002)
        out = d if out is None else np.minimum(out, d)
    return out


def glove_sdf(P):
    g = hand_sdf(P, "L") - .0032
    wr, el = J["wrL"], J["elL"]
    a = unit(wr - el)
    return smax(g, -((P - wr) @ a) - .004, .003)


# ---------- メッシュ化 ----------
def polygonize(fn, lo, hi, step, target):
    lo = np.asarray(lo, float); hi = np.asarray(hi, float)
    n = np.ceil((hi - lo) / step).astype(int) + 1
    xs = lo[0] + np.arange(n[0]) * step
    ys = lo[1] + np.arange(n[1]) * step
    zs = lo[2] + np.arange(n[2]) * step
    vol = np.empty((n[0], n[1], n[2]), np.float32)
    X, Z = np.meshgrid(xs, zs, indexing="ij")
    for j, yv in enumerate(ys):
        P = np.stack([X.ravel(), np.full(X.size, yv), Z.ravel()], -1)
        vol[:, j, :] = fn(P).reshape(n[0], n[2])
    v, f, _, _ = measure.marching_cubes(vol, 0, spacing=(step, step, step))
    v += lo
    if len(f) > target:
        v0 = v.copy()
        v, f = fast_simplification.simplify(v.astype(np.float32), f.astype(np.int32), target_reduction=1 - target / len(f))
        # 間引きで面から飛び出した頂点を元の面へ戻す
        dist, idx = cKDTree(v0).query(v)
        bad = dist > step * 1.5
        v[bad] = v0[idx[bad]]
    m = trimesh.Trimesh(v, f, process=True)
    trimesh.repair.fix_normals(m)  # 面の向きを外向きにそろえる
    # 頂点ごとの移動量に上限を付けた軽いスムージング（暴れ防止）
    nb = m.vertex_neighbors
    V = np.asarray(m.vertices).copy()
    for _ in range(3):
        mean = np.array([V[n].mean(0) if len(n) else V[i] for i, n in enumerate(nb)])
        d = (mean - V) * .35
        L = np.linalg.norm(d, axis=1, keepdims=True)
        V = V + d * np.minimum(1, step * .5 / np.maximum(L, 1e-9))
    m.vertices = V
    return m


# ---------- 色（頂点カラー, sRGB 0-255） ----------
def colors_skin(V):
    c = np.tile(np.array([236, 190, 160], float), (len(V), 1))
    def blend(mask_w, col):
        nonlocal c
        w = np.clip(mask_w, 0, 1)[:, None]
        c = c * (1 - w) + np.asarray(col, float) * w
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    # 唇
    lip = np.maximum(1 - length((V - [0, 1.469, .083]) / [.018, .0085, .02]), 0) * 3
    blend(lip * (z > .07), (204, 108, 112))
    mx = x / .019
    mline = np.exp(-((y - (1.4685 + .004 * mx * mx)) / .0011) ** 2) * (np.abs(mx) < 1.05) * (z > .075)
    blend(mline * .9, (120, 52, 56))
    # 頬
    for s in (1, -1):
        bl = np.maximum(1 - length((V - [s * .045, 1.5, .066]) / [.024, .016, .03]), 0)
        blend(bl * .45, (238, 150, 140))
        # 眉
        bx = (x - s * .033) / .02
        br = np.exp(-((y - (1.548 - .006 * bx * bx)) / .0028) ** 2) * (np.abs(bx) < 1) * (z > .07)
        blend(br * .9, (92, 56, 36))
        # まつ毛のライン（上まぶたの縁）
        ex = (x - s * .031) / .0165
        ln = np.exp(-((y - (1.5315 - .0025 * ex * ex)) / .0016) ** 2) * (np.abs(ex) < 1.05) * (z > .074)
        blend(ln, (36, 20, 14))
    return c


def colors_polo(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    white = np.array([246, 246, 244], float); blue = np.array([150, 194, 232], float)
    rag = np.abs(x) - (.05 + (1.43 - y) * .95)
    w = (rag > 0) & (y > 1.18)
    col_ring = (y > 1.405)
    plk = (np.abs(x) < .009) & (y > 1.33) & (y < 1.41) & (z > .02)
    c = np.where((w | col_ring | plk)[:, None], blue, white)
    for by in (1.395, 1.365):
        m = length((V - [0, by, 0]) * [1, 1, 0]) < .0042
        c[m & (z > .02)] = (110, 150, 200)
    return c


def colors_skirt(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    c = np.tile(np.array([34, 44, 82], float), (len(V), 1))
    ang = np.arctan2(x, z + .012)
    stripe = (np.abs(np.abs(ang) - np.radians(62)) < .045) & (y < 1.0)
    c[stripe] = (240, 240, 240)
    c[y > 1.0] = (28, 36, 70)
    for bx in (.028, .045):
        c[(length((V - [bx, 1.022, 0]) * [1, 1, 0]) < .005) & (z > .03)] = (200, 205, 214)
    return c


def colors_shoe(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    c = np.tile(np.array([246, 246, 244], float), (len(V), 1))
    side = (np.abs(np.abs(x) - .097) > .028) & (y > .028) & (y < .062) & (z > -.04) & (z < .1)
    c[side] = (128, 176, 224)
    c[y < .016] = (214, 214, 210)
    c[(np.abs(x) - .097 < .012) & (np.abs(x) - .097 > -.012) & (y > .07) & (z > .02) & (z < .1)] = (226, 230, 236)
    return c


# ---------- UV（円筒投影） ----------
def uv_cyl(V, center=(0, 0)):
    u = (np.arctan2(V[:, 0] - center[0], V[:, 2] - center[1]) / (2 * np.pi)) + .5
    v = V[:, 1]
    return np.stack([u, v], -1)


# ---------- スキンウェイト ----------
BONES = ["hips", "spine", "neck", "head", "upperL", "foreL", "handL", "upperR", "foreR", "handR",
         "thighL", "shinL", "footL", "thighR", "shinR", "footR"]
BI = {b: i for i, b in enumerate(BONES)}


def segd(V, a, b):
    a = np.asarray(a); b = np.asarray(b); ba = b - a
    h = np.clip(((V - a) @ ba) / (ba @ ba), 0, 1)
    return length(V - a - h[:, None] * ba)


def weights_body(V):
    segs = {
        "hips": (J["pelvis"] - [0, .08, 0], J["pelvis"] + [0, .07, 0], .1),
        "spine": (J["pelvis"] + [0, .1, 0], J["neck"] - [0, .04, 0], .1),
        "neck": (J["neck"], J["neck"] + [0, .07, .005], .043),
        "head": (J["head"] - [0, .05, 0], J["head"] + [0, .05, 0], .07),
    }
    for n in ("L", "R"):
        segs["upper" + n] = (J["sh" + n], J["el" + n], .038)
        segs["fore" + n] = (J["el" + n], J["wr" + n], .028)
        segs["hand" + n] = (J["wr" + n], J["hand" + n], .022)
        segs["thigh" + n] = (J["hip" + n], J["knee" + n], .058)
        segs["shin" + n] = (J["knee" + n], J["ankle" + n], .035)
        segs["foot" + n] = (J["ankle" + n], J["toe" + n], .03)
    D = np.stack([np.maximum(segd(V, a, b) - r, .002) for (a, b, r) in (segs[k] for k in BONES)], -1)
    W = 1 / D ** 4
    return W


def pack_weights(W):
    idx = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, idx, 1)
    w = w / w.sum(1, keepdims=True)
    q = np.round(w * 255).astype(np.int32)
    q[:, 0] += 255 - q.sum(1)
    return idx.astype(np.uint8), np.clip(q, 0, 255).astype(np.uint8)


def single(V, bone):
    W = np.zeros((len(V), len(BONES))); W[:, BI[bone]] = 1; return W


def weights_skirt(V):
    W = np.zeros((len(V), len(BONES)))
    tt = np.clip((1.04 - V[:, 1]) / .25, 0, 1)
    wl = .5 * tt * np.clip(.5 + V[:, 0] / .14, 0, 1)
    wr = .5 * tt * np.clip(.5 - V[:, 0] / .14, 0, 1)
    W[:, BI["thighL"]] = wl; W[:, BI["thighR"]] = wr; W[:, BI["hips"]] = 1 - wl - wr
    return W


def weights_shoe(V):
    W = np.zeros((len(V), len(BONES)))
    W[:, BI["footL"]] = (V[:, 0] > 0); W[:, BI["footR"]] = (V[:, 0] <= 0)
    return W


def weights_headblend(V):
    W = np.zeros((len(V), len(BONES)))
    t = np.clip((V[:, 1] - 1.43) / .05, 0, 1)
    W[:, BI["head"]] = t; W[:, BI["neck"]] = 1 - t
    return W


# ---------- 書き出し ----------
def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def pack(m, mat, col=None, W=None, uv=None):
    V = np.asarray(m.vertices) * YD
    N = np.asarray(m.vertex_normals)
    lo = V.min(0); sc = (V.max(0) - lo).max() / 65535
    q = np.round((V - lo) / sc).astype(np.uint16)
    out = {"mat": mat, "n": int(len(V)), "lo": lo.tolist(), "sc": float(sc), "pos": b64(q),
           "nrm": b64(np.round(np.clip(N, -1, 1) * 127).astype(np.int8)),
           "idx": b64(np.asarray(m.faces).astype(np.uint16 if len(V) < 65536 else np.uint32)), "i32": bool(len(V) >= 65536)}
    if col is not None:
        out["col"] = b64(np.clip(col, 0, 255).astype(np.uint8))
    if uv is not None:
        out["uv"] = b64(np.round(np.clip(uv, 0, 2) * 30000).astype(np.uint16))
    si, sw = pack_weights(W)
    out["si"] = b64(si); out["sw"] = b64(sw)
    return out


def main():
    dst = sys.argv[1] if len(sys.argv) > 1 else "golfer_f.json"
    parts = []
    print("head"); head = polygonize(lambda P: smax(head_sdf(P), 1.425 - P[:, 1], .002), (-.1, 1.4, -.12), (.1, 1.66, .13), .0016, 26000)
    Vh = np.asarray(head.vertices)
    Wh = weights_headblend(Vh)
    parts.append(pack(head, "skin", colors_skin(Vh), Wh, uv_cyl(Vh)))
    print("body"); body = polygonize(lambda P: smax(body_sdf(P), P[:, 1] - 1.432, .002), (-.47, -.01, -.16), (.47, 1.45, .2), .0045, 30000)
    Vb = np.asarray(body.vertices)
    parts.append(pack(body, "skin", colors_skin(Vb) * 0 + [236, 190, 160], weights_body(Vb), uv_cyl(Vb)))
    print("glove"); g = polygonize(glove_sdf, J["wrL"] - .09, J["wrL"] + .12, .0025, 3000)
    parts.append(pack(g, "glove", None, single(np.asarray(g.vertices), "handL"), uv_cyl(np.asarray(g.vertices))))
    print("polo"); po = polygonize(polo_sdf, (-.27, .97, -.13), (.27, 1.47, .13), .0035, 16000)
    Vp = np.asarray(po.vertices)
    parts.append(pack(po, "knit", colors_polo(Vp), weights_body(Vp), uv_cyl(Vp)))
    print("skirt"); sk = polygonize(skirt_sdf, (-.24, .78, -.2), (.24, 1.06, .2), .0025, 14000)
    Vs = np.asarray(sk.vertices)
    parts.append(pack(sk, "twill", colors_skirt(Vs), weights_skirt(Vs), uv_cyl(Vs)))
    print("shoes"); sh = polygonize(shoe_sdf, (-.16, -.005, -.1), (.16, .14, .19), .0028, 7000)
    Vsh = np.asarray(sh.vertices)
    parts.append(pack(sh, "leather", colors_shoe(Vsh), weights_shoe(Vsh), uv_cyl(Vsh)))
    print("hair"); ha = polygonize(hair_sdf, (-.11, 1.22, -.2), (.11, 1.68, .12), .0019, 22000)
    Vha = np.asarray(ha.vertices)
    parts.append(pack(ha, "hair", None, single(Vha, "head"), uv_cyl(Vha, (0, -.01))))
    print("visor"); vi = polygonize(visor_sdf, (-.11, 1.56, -.11), (.11, 1.64, .2), .0016, 6000)
    parts.append(pack(vi, "visor", None, single(np.asarray(vi.vertices), "head")))
    bind = {k: (v * YD).tolist() for k, v in J.items()}
    eyes = [(e * YD).tolist() for e in EYE]
    data = {"bones": BONES, "bind": bind, "eyes": eyes, "eyeR": .0125 * YD, "parts": parts}
    with open(dst, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    tri = sum(len(base64.b64decode(p["idx"])) // (12 if p["i32"] else 6) for p in parts)
    print("done", dst, "tris", tri)


if __name__ == "__main__":
    main()
