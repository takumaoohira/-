"""ゴルファー（女性・男性）の3Dモデルを手続き生成するスクリプト。

距離関数（SDF）で体・服・髪を形作り、マーチングキューブでメッシュ化、
間引き・UV・頂点カラー・スキンウェイトを付けて JSON（base64）に書き出す。
出力は fpv-sim.html に埋め込んで使う（実行時に外部ファイルは読まない）。

使い方: python3 build_golfer.py f|m [出力先.json]
"""
import base64, json, sys
import numpy as np
from skimage import measure
import trimesh
import fast_simplification
from scipy.spatial import cKDTree

YD = 1.0936  # メートル → ヤード
SEX = (sys.argv[1] if len(sys.argv) > 1 else "f") if __name__ == "__main__" else "f"
F = SEX == "f"

# 体型・顔の設定
PR = dict(
    f=dict(scale=1.0, sh=.165, hipx=.085, skin=(242, 196, 164), hair=(96, 52, 26), hairHi=(170, 110, 62), hairRoot=(60, 32, 16),
           eyeR=.0146, eyeX=.0312, eyeY=1.527, brow=(110, 66, 40), browW=.0026, lip=(214, 112, 118), limb=1.0, head=1.1),
    m=dict(scale=1.065, sh=.182, hipx=.09, skin=(228, 178, 142), hair=(38, 28, 22), hairHi=(96, 72, 54), hairRoot=(24, 18, 14),
           eyeR=.0136, eyeX=.0318, eyeY=1.528, brow=(46, 32, 24), browW=.0036, lip=(200, 138, 124), limb=1.13, head=1.08),
)[SEX]


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
        q = q @ R
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


# 頭まわりは首の付け根を中心に少し大きくする（かわいらしい頭身）
PIV = np.array([0, 1.465, 0.])
HS = PR["head"]


def head_space(fn):
    return lambda P: fn((P - PIV) / HS + PIV) * HS


def to_head(p):
    return PIV + (np.asarray(p, float) - PIV) * HS


# ---------- 骨格（バインドポーズ, メートル） ----------
J = {}
J["pelvis"] = np.array([0, .95, 0.])
J["neck"] = np.array([0, 1.39, -.01])
J["head"] = np.array([0, 1.52, 0.])
for s, n in ((1, "L"), (-1, "R")):
    sh = np.array([s * PR["sh"], 1.355, -.01])
    el = sh + .27 * np.array([s * np.sin(np.radians(22)), -np.cos(np.radians(22)), 0])
    wr = el + .235 * unit([s * np.sin(np.radians(12)), -np.cos(np.radians(12)), .1])
    J["sh" + n], J["el" + n], J["wr" + n] = sh, el, wr
    J["hand" + n] = wr + .085 * unit(wr - el)
    J["hip" + n] = np.array([s * PR["hipx"], .885, 0])
    J["knee" + n] = np.array([s * .09, .48, .005])
    J["ankle" + n] = np.array([s * .095, .075, -.01])
    J["toe" + n] = np.array([s * .1, .02, .14])

EYE0 = [np.array([s * PR["eyeX"], PR["eyeY"], .0735]) for s in (1, -1)]  # 頭空間での目の中心
EYE = [to_head(e) for e in EYE0]


# ---------- 体（肌） ----------
def hand_sdf(P, n):
    wr, el = J["wr" + n], J["el" + n]
    d_ = unit(wr - el)
    side = unit(np.cross(d_, [0, 0, 1])) if n == "L" else unit(np.cross([0, 0, 1], d_))
    k = PR["limb"]
    palm = cap(P, wr + d_ * .01, wr + d_ * .06, .026 * k, .024 * k)
    fing = cap(P, wr + d_ * .07 + np.array([0, 0, .012]), wr + d_ * .075 + np.array([0, 0, .03]), .02 * k, .016 * k)
    thumb = cap(P, wr + d_ * .02 + side * .02 + np.array([0, 0, .015]), wr + d_ * .055 + np.array([0, 0, .032]), .011 * k, .009 * k)
    return smin(smin(palm, fing, .02), thumb, .012)


def torso_sdf(P):
    if F:
        d = ell(P, (0, 1.272, -.006), (.124, .126, .084))
        d = smin(d, ell(P, (0, 1.105, 0), (.096, .108, .072)), .06)   # くびれ
        d = smin(d, ell(P, (0, .955, -.01), (.152, .112, .1)), .07)
        d = smin(d, ell(P, (0, .925, -.05), (.125, .085, .075)), .05)
        for s in (1, -1):
            d = smin(d, sph(P, (s * .05, 1.252, .052), .048), .035)
            d = smin(d, sph(P, (s * .152, 1.345, -.01), .044), .05)
            d = smin(d, cap(P, (0, 1.39, -.02), (s * .14, 1.36, -.015), .034, .04), .04)
        d = smin(d, cap(P, (0, 1.36, -.012), (0, 1.47, -.004), .047, .041), .03)
    else:
        d = ell(P, (0, 1.262, -.008), (.152, .14, .096))
        d = smin(d, ell(P, (0, 1.1, 0), (.124, .11, .082)), .06)
        d = smin(d, ell(P, (0, .955, -.01), (.142, .1, .095)), .07)
        d = smin(d, ell(P, (0, .925, -.048), (.118, .08, .072)), .05)
        for s in (1, -1):
            d = smin(d, ell(P, (s * .062, 1.275, .045), (.06, .045, .04)), .04)        # 胸板
            d = smin(d, sph(P, (s * .172, 1.345, -.01), .056), .05)                    # 肩
            d = smin(d, cap(P, (0, 1.4, -.02), (s * .155, 1.37, -.015), .044, .048), .045)  # 僧帽筋
        d = smin(d, cap(P, (0, 1.36, -.012), (0, 1.47, -.004), .055, .048), .03)
    return d


def arms_sdf(P):
    k = PR["limb"]; d = None
    for n in ("L", "R"):
        sh, el, wr = J["sh" + n], J["el" + n], J["wr" + n]
        a = cap(P, sh, el, .042 * k, .032 * k)
        a = smin(a, ell(P, sh + (el - sh) * .4 + np.array([0, 0, .006]), (.036 * k, .06, .036 * k)), .02)
        a = smin(a, cap(P, el, wr, .033 * k, .022 * k), .018)
        a = smin(a, ell(P, el + (wr - el) * .3, (.034 * k, .055, .032 * k)), .015)
        a = smin(a, hand_sdf(P, n), .012)
        d = a if d is None else np.minimum(d, a)
    return d


def legs_sdf(P):
    k = 1 if F else 1.08; d = None
    for s, n in ((1, "L"), (-1, "R")):
        hp, kn, an = J["hip" + n], J["knee" + n], J["ankle" + n]
        l = cap(P, hp, kn, .074 * k, .047 * k)
        l = smin(l, ell(P, hp + (kn - hp) * .3 + np.array([s * .012, 0, .005]), (.06 * k, .13, .062 * k)), .04)
        l = smin(l, sph(P, kn + np.array([0, 0, .008]), .044 * k), .025)
        l = smin(l, cap(P, kn, an, .044 * k, .028 * k), .02)
        l = smin(l, ell(P, (s * .093, .335, -.022), (.04 * k, .09, .042 * k)), .03)  # ふくらはぎ
        l = smin(l, sph(P, an, .029 * k), .02)
        l = smin(l, ell(P, (s * .097, .045, .045), (.035, .03, .1)), .02)
        d = l if d is None else np.minimum(d, l)
    return d


def body_sdf(P, part="all"):
    d = torso_sdf(P)
    if part in ("all", "arms"):
        d = smin(d, arms_sdf(P), .028)
    if part in ("all", "legs"):
        d = smin(d, legs_sdf(P), .045)
    return d


# 顔（頭空間で定義）
def head_sdf0(P):
    E = EYE0
    if F:
        d = ell(P, (0, 1.55, -.01), (.074, .092, .09))
        d = smin(d, ell(P, (0, 1.506, .02), (.055, .066, .07)), .03)
        d = smin(d, ell(P, (0, 1.478, .026), (.042, .036, .056)), .022)
        d = smin(d, sph(P, (0, 1.449, .048), .017), .02)
        cheek = ((.025, .02, .021), (.034, 1.507, .058))
    else:
        d = ell(P, (0, 1.55, -.012), (.077, .094, .092))
        d = smin(d, ell(P, (0, 1.505, .018), (.059, .068, .072)), .025)
        d = smin(d, ell(P, (0, 1.472, .022), (.048, .04, .06)), .014)
        d = smin(d, ell(P, (0, 1.446, .048), (.023, .016, .02)), .012)
        for s_ in (1, -1):
            d = smin(d, ell(P, (s_ * .038, 1.463, .022), (.013, .018, .028)), .012)  # エラ
        cheek = ((.022, .017, .019), (.04, 1.512, .056))
    for s in (1, -1):
        e = E[0 if s == 1 else 1]
        d = smin(d, ell(P, (s * cheek[1][0], cheek[1][1], cheek[1][2]), cheek[0]), .018)
        d = smin(d, ell(P, (s * .076, 1.522, -.008), (.009, .027, .017)), .008)        # 耳
        d = smax(d, -sph(P, e + np.array([0, 0, .002]), PR["eyeR"] + .0012), .005)      # 眼窩
        d = smin(d, ell(P, e + [0, .0106, .0052], (PR["eyeR"] * 1.22, .0036, .0074)), .003)   # 上まぶた
        d = smin(d, ell(P, e + [0, -.0086, .004], (PR["eyeR"] * 1.1, .0026, .0066)), .004)  # 下まぶた
        d = smin(d, sph(P, (s * .0072, 1.4985, .0895), .0052 if F else .0062), .005)      # 小鼻
    nr = .82 if F else 1.0
    d = smin(d, cap(P, (0, 1.534, .083), (0, 1.506, .097), .0045 * nr, .0075 * nr), .007)
    d = smin(d, sph(P, (0, 1.5025, .0955), .0082 * nr), .005)
    d = smin(d, ell(P, (0, 1.4755, .0805), (.0145 if F else .016, .0046 if F else .004, .0078)), .005)
    d = smin(d, ell(P, (0, 1.466, .0782), (.0132 if F else .0145, .0056 if F else .0048, .0086)), .005)
    for sx in (-1, 1):
        d = smax(d, -cap(P, (0, 1.4705, .086), (sx * .0165, 1.4735 if F else 1.4715, .0805), .0012, .0016), .0018)
    d = smin(d, cap(P, (0, 1.36, -.012), (0, 1.47, -.004), .047 if F else .052, .041 if F else .046), .03)
    return d


head_sdf = head_space(head_sdf0)


# ---------- まつ毛 ----------
def lash_sdf0(P):
    d = None
    for s, e in zip((1, -1), EYE0):
        L = .0046 if F else .0026
        n = 13
        for i in range(n):
            u = -1 + 2 * i / (n - 1)
            x = e[0] + s * u * PR["eyeR"] * 1.15
            y = e[1] + .0112 - .0038 * u * u
            z = e[2] + .0098 - .0016 * u * u
            flick = max(0, u) * .6  # 外側ほど跳ね上げ
            a = np.array([x, y, z])
            b = a + np.array([s * u * .0012 + s * flick * .0018, L * (.55 + .5 * flick), L * .55])
            c = cap(P, a, b, .001, .00035)
            d = c if d is None else smin(d, c, .0006)
        # 上まぶたのアイライン
        arc = cap(P, e + [-PR["eyeR"] * 1.15, .0085, .0094], e + [PR["eyeR"] * 1.15, .0085, .0094], .0009, .0009)
        d = smin(d, arc, .001)
    return d


lash_sdf = head_space(lash_sdf0)


# ---------- 髪 ----------
def hair_f0(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    scalp = ell(P, (0, 1.554, -.012), (.086, .106, .102))
    t = np.clip((z + .06) / .1, 0, 1)
    h = smax(scalp, (1.47 + t * .118) - y, .012)
    ear = np.minimum(sph(P, (.077, 1.52, -.006), .03), sph(P, (-.077, 1.52, -.006), .03))
    h = smax(h, -ear, .01)
    # 前髪（流した房＋毛束の段差）
    fr = ell(P, (.006, 1.602, .06), (.074, .052, .038), rotx(.55))
    tip = 1.568 + .007 * np.sin(x * 170) + (x + .07) * .13
    fr = smax(fr, tip - y, .004)
    fr = smax(fr, -(ell(P, (0, 1.55, -.01), (.075, .093, .091)) - .0025), .003)
    h = smin(h, fr, .01)
    for i in range(6):  # 前髪の毛束
        x0 = -.05 + .02 * i
        h = smin(h, cap(P, (x0 * .6, 1.63, .062), (x0 + .008, 1.572 + .004 * np.sin(i * 2.1), .09), .0055, .0025), .005)
    # 顔まわりの後れ毛
    for s in (1, -1):
        for j in range(3):
            h = smin(h, cap(P, (s * (.07 + .004 * j), 1.585, .045 - .012 * j), (s * (.077 + .003 * j), 1.45 + .012 * j, .056 - .014 * j + .006 * np.sin(j)), .006, .0022), .005)
    # 高い位置のポニーテール（ゆるいウェーブ）
    pts = [(0, 1.632, -.07), (0, 1.605, -.122), (.008, 1.535, -.152), (-.004, 1.455, -.162), (-.012, 1.38, -.156), (.002, 1.305, -.142), (.012, 1.25, -.13), (.004, 1.21, -.118)]
    rs = [.029, .034, .033, .03, .025, .019, .012, .005]
    for i in range(len(pts) - 1):
        h = smin(h, cap(P, pts[i], pts[i + 1], rs[i], rs[i + 1]), .012)
    for j in range(4):  # ポニーテールの毛束
        a = j * np.pi / 2
        off = np.array([np.cos(a) * .012, 0, np.sin(a) * .01])
        h = smin(h, cap(P, np.add(pts[2], off), np.add(pts[6], off * 1.6 + [0, 0, .01]), .011, .004), .008)
    ang = np.arctan2(x, z + .02)
    return h + .0008 * np.sin(ang * 80 + y * 45)


def hair_m0(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    scalp = ell(P, (0, 1.558, -.014), (.084, .104, .1))
    top = ell(P, (0, 1.578, -.006), (.083, .1, .098))
    s = smin(scalp, top, .02)
    t = np.clip((z + .06) / .1, 0, 1)
    h = smax(s, (1.485 + t * .102) - y, .01)
    ear = np.minimum(sph(P, (.078, 1.52, -.006), .032), sph(P, (-.078, 1.52, -.006), .032))
    h = smax(h, -ear, .008)
    # 前髪：右へ流した毛束
    for i in range(7):
        a = -.6 + i * .2
        root = (np.sin(a) * .05, 1.665, np.cos(a) * .04 + .01)
        tipp = (np.sin(a) * .06 + .03 + .01 * i / 6, 1.588 + .01 * (i / 6) + .004 * (i % 2), np.cos(a) * .065 + .03)
        h = smin(h, cap(P, root, tipp, .012, .004), .009)
    # トップの毛束（立体感）
    for i in range(9):
        a = i / 9 * 2 * np.pi
        r0 = np.array([np.sin(a) * .035, 1.655, np.cos(a) * .035 - .015])
        r1 = r0 + np.array([np.sin(a) * .028, .006 + .003 * np.sin(i * 1.7), np.cos(a) * .022 - .022])
        h = smin(h, cap(P, r0, r1, .012, .005), .012)
    # もみあげ
    ang = np.arctan2(x, z + .02)
    return h + .0004 * np.sin(ang * 60 + y * 70)


hair_sdf = head_space(hair_f0 if F else hair_m0)


def visor_sdf0(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    rr = length(np.stack([x / .09, z / .104 + .05], -1))
    band = smax(np.abs(rr - 1) * .09 - .0022, np.abs(y - 1.6) - .0135, .002)
    ang = np.arctan2(x, z + .005)
    band = smax(band, np.abs(ang) - np.radians(118), .01)
    Pl = (P - np.array([0, 1.598, .078])) @ rotx(.3)
    bx, by, bz = Pl[:, 0], Pl[:, 1], Pl[:, 2]
    e = length(np.stack([bx / .074, bz / .082], -1)) - 1
    brim = smax(e * .074, np.abs(by) - .0026, .001)
    brim = smax(brim, -bz, .003)
    return smin(band, brim, .006)


visor_sdf = head_space(visor_sdf0)


# ---------- 服 ----------
def polo_sdf(P):
    y, z = P[:, 1], P[:, 2]
    t = torso_sdf(P) - (.0085 if F else .01)
    t = smin(t, ell(P, (0, 1.1, -.004), (.112, .14, .085) if F else (.132, .14, .092)), .03)
    for n in ("L", "R"):
        sh, el = J["sh" + n], J["el" + n]
        a = unit(el - sh)
        k = PR["limb"]
        t = smin(t, cap(P, sh - a * .02, sh + a * (.12 if F else .14), .05 * k, .046 * k), .02)
    t = smax(t, .985 - y, .01)
    Pc = (P - np.array([0, 1.425, -.006])) @ rotx(.28)
    rc = length(np.stack([Pc[:, 0] / (.062 if F else .068), Pc[:, 2] / (.058 if F else .064)], -1))
    col = length(np.stack([(rc - 1) * .06, Pc[:, 1] * 1.4], -1)) - .0105
    t = smin(t, col, .006)
    t = smax(t, -cap(P, (0, 1.39, -.01), (0, 1.5, 0), .05 if F else .056, .05 if F else .056), .004)
    t = smax(t, -cap(P, (0, 1.37, .07), (0, 1.47, .06), .012, .045), .006)
    return t


def skirt_sdf(P):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    tt = np.clip((1.04 - y) / .25, 0, 1)
    rx = .128 + .09 * np.sqrt(tt)
    rz = .098 + .07 * np.sqrt(tt)
    ang = np.arctan2(x, z + .012)
    pleat = .01 * np.clip(tt * 1.6 - .25, 0, 1) * np.abs(np.sin(ang * 11))
    q = length(np.stack([x / (rx + pleat), (z + .012) / (rz + pleat)], -1)) - 1
    rad = q * np.minimum(rx, rz)
    s = np.minimum(np.abs(rad) - .0032, np.where(y > 1.0, np.abs(rad - .002) - .0045, 1))
    s = smax(s, y - 1.045, .002)
    return smax(s, .79 - y, .002)


def pants_sdf(P):
    y = P[:, 1]
    p = smin(legs_sdf(P), ell(P, (0, .955, -.012), (.146, .104, .098)), .05) - .013
    p = smin(p, ell(P, (0, .99, -.01), (.142, .04, .096)) - .006, .01)
    p = smax(p, y - 1.012, .003)
    return smax(p, .085 - y, .003)


def belt_sdf(P):
    y = P[:, 1]
    b = (length(np.stack([P[:, 0] / .149, (P[:, 2] + .01) / .102], -1)) - 1) * .1
    b = smax(np.abs(b) - .004, np.abs(y - .995) - .013, .002)
    buckle = smax(np.abs(P[:, 0]) - .019, smax(np.abs(y - .995) - .016, np.abs(P[:, 2] - .095) - .004, .001), .001)
    return smin(b, buckle, .002)


def shoe_sdf(P):
    out = None
    for s, n in ((1, "L"), (-1, "R")):
        k = 1 if F else 1.08
        d = ell(P, (s * .097, .05, .045), (.043 * k, .046, .118 * k))
        d = smin(d, ell(P, (s * .099, .03, .1), (.04 * k, .028, .08 * k)), .02)
        d = smin(d, cap(P, (s * .095, .07, -.035), (s * .095, .11, -.03), .036 * k, .032 * k), .02)
        d = smax(d, -P[:, 1], .002)
        out = d if out is None else np.minimum(out, d)
    return out


def glove_sdf(P):
    g = hand_sdf(P, "L") - .0032
    wr, el = J["wrL"], J["elL"]
    return smax(g, -((P - wr) @ unit(wr - el)) - .004, .003)


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
        dist, idx = cKDTree(v0).query(v)
        bad = dist > step * 1.5
        v[bad] = v0[idx[bad]]
    m = trimesh.Trimesh(v, f, process=True)
    trimesh.repair.fix_normals(m)
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
def hn(V, f):  # 簡易ノイズ
    return np.sin(V[:, 0] * f * 1.3 + 1.7) * np.sin(V[:, 1] * f * .9 + .4) * np.sin(V[:, 2] * f * 1.1 + 2.2)


def blender(c):
    def blend(w, col):
        w = np.clip(w, 0, 1)[:, None]
        c[:] = c * (1 - w) + np.asarray(col, float) * w
    return blend


def colors_skin(V, face=True):
    c = np.tile(np.array(PR["skin"], float), (len(V), 1))
    c *= (1 + .025 * hn(V, 90))[:, None]
    blend = blender(c)
    Q = (V - PIV) / HS + PIV  # 頭空間の座標
    x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
    if face:
        lip = np.maximum(1 - length((Q - [0, 1.471, .083]) / [.0165, .0105, .02]), 0) * 3
        blend(lip * (z > .07), PR["lip"])
        mx = x / .0175
        mline = np.exp(-((y - (1.4705 + (.0032 if F else .0012) * mx * mx)) / .001) ** 2) * (np.abs(mx) < 1.05) * (z > .075)
        blend(mline * .5, (140, 66, 66))
        for s, e in zip((1, -1), EYE0):
            bl = np.maximum(1 - length((Q - [s * .046, 1.497, .064]) / [.026, .017, .03]), 0)
            blend(bl * (.5 if F else .18), (240, 150, 142))
            bx = (x - s * (e[0] + .002)) / .021
            by = e[1] + .025 - (.0055 if F else .002) * bx * bx + (.0 if F else .0015 * bx * s)
            br = np.exp(-((y - by) / PR["browW"]) ** 2) * (np.abs(bx) < 1) * (z > .07) * (1 - .4 * np.clip(bx * s, 0, 1) ** 2)
            blend(br * .9, PR["brow"])
            # 二重のライン・目元の陰影
            ex = (x - e[0]) / (PR["eyeR"] * 1.3)
            cr = np.exp(-((y - (e[1] + .0145 - .003 * ex * ex)) / .0012) ** 2) * (np.abs(ex) < 1) * (z > .072)
            blend(cr * .45, (170, 110, 96))
            lo_ = np.maximum(1 - length((Q - [e[0], e[1] - .0095, e[2] + .005]) / [PR["eyeR"] * 1.3, .0045, .02]), 0)
            blend(lo_ * .4, (206, 150, 132))
            sh_ = np.maximum(1 - length((Q - [e[0], e[1] + .011, e[2] + .004]) / [PR["eyeR"] * 1.5, .006, .02]), 0)
            blend(sh_ * (.22 if F else .14), (190, 140, 126) if F else (170, 126, 106))
        nose = np.maximum(1 - length((Q - [0, 1.502, .095]) / [.012, .01, .02]), 0)
        blend(nose * .25, (236, 160, 146))
    else:
        for n in ("L", "R"):
            blend(np.maximum(1 - length((V - J["knee" + n] - [0, 0, .035]) / [.045, .05, .03]), 0) * .45, (236, 160, 146))
            blend(np.maximum(1 - length((V - J["el" + n]) / .035), 0) * .3, (236, 160, 146))
            blend(np.maximum(1 - length((V - J["hand" + n]) / .04), 0) * .3, (236, 160, 146))
    return c


def colors_hair(V):
    Q = (V - PIV) / HS + PIV
    x, y, z = Q[:, 0], Q[:, 1], Q[:, 2]
    base = np.array(PR["hair"], float); hi = np.array(PR["hairHi"], float); root = np.array(PR["hairRoot"], float)
    ang = np.arctan2(x, z + .02)
    strand = .5 + .5 * np.sin(ang * 90 + y * 30) * np.sin(ang * 37 + 1.3)
    c = np.tile(base, (len(V), 1)) * (.85 + .3 * strand)[:, None]
    blend = blender(c)
    ring = np.exp(-((y - (1.616 + .012 * np.cos(ang))) / .011) ** 2) * (z > -.07) * (.6 + .4 * strand)  # 天使の輪
    blend(ring * .85, hi)
    blend(np.clip((1.6 - y) / .2, 0, 1) * .3 * (z < -.04), root)
    if F:
        tail = np.clip((1.5 - y) / .25, 0, 1) * (z < -.09)
        blend(tail * .35, hi * .9 + base * .1)
    return c


def colors_polo(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    if F:
        main = np.array([246, 246, 244], float); acc = np.array([150, 194, 232], float)
        rag = np.abs(x) - (.05 + (1.43 - y) * .95)
        w = ((rag > 0) & (y > 1.18)) | (y > 1.405) | ((np.abs(x) < .009) & (y > 1.33) & (y < 1.41) & (z > .02))
        c = np.where(w[:, None], acc, main)
        btn = (110, 150, 200)
    else:
        main = np.array([34, 46, 78], float); acc = np.array([236, 238, 240], float)
        c = np.tile(main, (len(V), 1))
        c[(y > 1.43)] = (30, 40, 70)
        c[(y > 1.41)] = (44, 58, 96)
        c[(np.abs(x) < .009) & (y > 1.33) & (y < 1.41) & (z > .02)] = (28, 38, 66)
        btn = (226, 228, 230)
    c = c * (1 + .03 * hn(V, 160))[:, None]
    for by in (1.395, 1.365):
        m = length((V - [0, by, 0]) * [1, 1, 0]) < .0042
        c[m & (z > .02)] = btn
    return c


def colors_skirt(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    c = np.tile(np.array([34, 44, 82], float), (len(V), 1)) * (1 + .03 * hn(V, 200))[:, None]
    ang = np.arctan2(x, z + .012)
    c[(np.abs(np.abs(ang) - np.radians(62)) < .045) & (y < 1.0)] = (240, 240, 240)
    c[y > 1.0] = (28, 36, 70)
    for bx in (.028, .045):
        c[(length((V - [bx, 1.022, 0]) * [1, 1, 0]) < .005) & (z > .03)] = (200, 205, 214)
    return c


def colors_pants(V):
    c = np.tile(np.array([168, 166, 160], float), (len(V), 1)) * (1 + .03 * hn(V, 200))[:, None]
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    crease = np.exp(-((np.abs(x) - .093) / .004) ** 2) * (z > 0) * (y < .85)
    c *= (1 - .12 * crease)[:, None]
    return c


def colors_belt(V):
    c = np.tile(np.array([30, 24, 20], float), (len(V), 1))
    c[(np.abs(V[:, 0]) < .02) & (V[:, 2] > .088)] = (196, 196, 200)
    return c


def colors_shoe(V):
    x, y, z = V[:, 0], V[:, 1], V[:, 2]
    c = np.tile(np.array([246, 246, 244], float), (len(V), 1))
    side = (np.abs(np.abs(x) - .097) > .028) & (y > .028) & (y < .062) & (z > -.04) & (z < .1)
    c[side] = (128, 176, 224) if F else (40, 44, 52)
    c[y < .016] = (214, 214, 210) if F else (60, 60, 64)
    c[(np.abs(np.abs(x) - .097) < .012) & (y > .07) & (z > .02) & (z < .1)] = (226, 230, 236)
    return c


def uv_cyl(V, center=(0, 0)):
    u = (np.arctan2(V[:, 0] - center[0], V[:, 2] - center[1]) / (2 * np.pi)) + .5
    return np.stack([u, V[:, 1]], -1)


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
    return 1 / D ** 4


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


SC = PR["scale"]


def pack(m, mat, col=None, W=None, uv=None):
    V = np.asarray(m.vertices) * YD * SC
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
    dst = sys.argv[2] if len(sys.argv) > 2 else f"golfer_{SEX}.json"
    parts = []
    hlo, hhi = to_head((-.1, 1.4, -.12)), to_head((.1, 1.68, .13))
    print("head"); head = polygonize(lambda P: smax(head_sdf(P), 1.425 - P[:, 1], .002), hlo, hhi, .0014, 32000)
    Vh = np.asarray(head.vertices)
    parts.append(pack(head, "skin", colors_skin(Vh), weights_headblend(Vh), uv_cyl(Vh)))
    print("lash")
    elo = to_head(np.minimum(EYE0[0], EYE0[1]) - [.03, .015, .0]); ehi = to_head(np.maximum(EYE0[0], EYE0[1]) + [.03, .03, .03])
    la = polygonize(lash_sdf, elo, ehi, .0005, 6000)
    parts.append(pack(la, "lash", None, single(np.asarray(la.vertices), "head")))
    print("body"); body = polygonize(lambda P: smax(body_sdf(P), P[:, 1] - 1.432, .002), (-.5, -.01, -.17), (.5, 1.45, .21), .0042, 34000)
    Vb = np.asarray(body.vertices)
    parts.append(pack(body, "skin", colors_skin(Vb, face=False), weights_body(Vb), uv_cyl(Vb)))
    print("glove"); g = polygonize(glove_sdf, J["wrL"] - .1, J["wrL"] + .13, .0024, 3500)
    parts.append(pack(g, "glove", None, single(np.asarray(g.vertices), "handL"), uv_cyl(np.asarray(g.vertices))))
    print("polo"); po = polygonize(polo_sdf, (-.3, .97, -.14), (.3, 1.48, .14), .0034, 18000)
    Vp = np.asarray(po.vertices)
    parts.append(pack(po, "knit", colors_polo(Vp), weights_body(Vp), uv_cyl(Vp)))
    if F:
        print("skirt"); sk = polygonize(skirt_sdf, (-.25, .78, -.2), (.25, 1.06, .2), .0024, 15000)
        Vs = np.asarray(sk.vertices)
        parts.append(pack(sk, "twill", colors_skirt(Vs), weights_skirt(Vs), uv_cyl(Vs)))
    else:
        print("pants"); pa = polygonize(pants_sdf, (-.22, .07, -.15), (.22, 1.03, .17), .0036, 18000)
        Vpa = np.asarray(pa.vertices)
        parts.append(pack(pa, "twill", colors_pants(Vpa), weights_body(Vpa), uv_cyl(Vpa)))
        print("belt"); be = polygonize(belt_sdf, (-.17, .97, -.13), (.17, 1.02, .11), .0018, 5000)
        Vbe = np.asarray(be.vertices)
        parts.append(pack(be, "leather", colors_belt(Vbe), single(Vbe, "hips"), uv_cyl(Vbe)))
    print("shoes"); sh = polygonize(shoe_sdf, (-.17, -.005, -.11), (.17, .14, .2), .0028, 7000)
    Vsh = np.asarray(sh.vertices)
    parts.append(pack(sh, "leather", colors_shoe(Vsh), weights_shoe(Vsh), uv_cyl(Vsh)))
    print("hair"); ha = polygonize(hair_sdf, to_head((-.11, 1.2, -.2)), to_head((.11, 1.7, .13)), .0017, 30000)
    Vha = np.asarray(ha.vertices)
    parts.append(pack(ha, "hair", colors_hair(Vha), single(Vha, "head"), uv_cyl(Vha, (0, -.01))))
    if F:
        print("visor"); vi = polygonize(visor_sdf, to_head((-.11, 1.56, -.11)), to_head((.11, 1.64, .2)), .0016, 6000)
        parts.append(pack(vi, "visor", None, single(np.asarray(vi.vertices), "head")))
    bind = {k: (v * YD * SC).tolist() for k, v in J.items()}
    eyes = [(e * YD * SC).tolist() for e in EYE]
    look = {"iris": ["#b07a42", "#4a2812"] if F else ["#7a5a3e", "#2c1a0e"], "hair": "#%02x%02x%02x" % PR["hair"]}
    data = {"bones": BONES, "bind": bind, "eyes": eyes, "eyeR": PR["eyeR"] * HS * YD * SC, "look": look, "parts": parts}
    with open(dst, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    tri = sum(len(base64.b64decode(p["idx"])) // (12 if p["i32"] else 6) for p in parts)
    print("done", dst, "tris", tri)


if __name__ == "__main__":
    main()
