"""Round 3 — precious-metal concepts for Yield2Pay (black-first masters + silver/engraved previews)."""
import math, sys
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT = sys.argv[1]
FLAT, ROUND, MITRE = 2, 1, 2

def path_d(geom):
    polys = geom.geoms if hasattr(geom, "geoms") else [geom]
    def ring(r):
        c = list(r.coords)[:-1]
        return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in c) + " Z"
    return " ".join(ring(p.exterior) + "".join(" " + ring(i) for i in p.interiors) for p in polys)

def svg(body, w=256, h=256, title=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<title>{title}</title>{body}</svg>\n')

def fill(geom, color="#000"):
    return f'<path fill="{color}" fill-rule="evenodd" d="{path_d(geom)}"/>'

def soften(g, r):       # round convex corners (polished metal, not machined)
    return g.buffer(-r, join_style=ROUND).buffer(r, join_style=ROUND)

def arc(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def centre(g, cx=128, cy=126):   # optical centre a touch above geometric
    x0, y0, x1, y1 = g.bounds
    return affinity.translate(g, cx - (x0 + x1) / 2, cy - (y0 + y1) / 2)

# A — Punção de refinadora: Y2 cut into a hallmark cartouche, standing on an ingot-shaped bar.
def concept_a():
    w = 26
    cart = box(20, 40, 236, 214)
    for cx, cy in [(20, 40), (236, 40), (20, 214), (236, 214)]:   # concave corners of a punch
        cart = cart.difference(Point(cx, cy).buffer(22, 64))
    cart = soften(cart, 3)
    top, foot = 64, 154
    jx, jy = 80, 112                                              # Y junction; arms at exactly 60°
    dx = (jy - top + 30) * math.tan(math.radians(30))
    y_ = unary_union([LineString([(jx - dx, top - 30), (jx, jy)]).buffer(w / 2, cap_style=FLAT, join_style=MITRE),
                      LineString([(jx + dx, top - 30), (jx, jy)]).buffer(w / 2, cap_style=FLAT, join_style=MITRE),
                      LineString([(jx, jy - 12), (jx, foot)]).buffer(w / 2, cap_style=FLAT)]).intersection(box(0, top, 256, 256))
    r = 27; cx2, cy2 = 178, top + r + w / 2
    two = LineString(arc(cx2, cy2, r, 180, 360 + 45) + [(146, foot - w / 2)]).buffer(w / 2, cap_style=FLAT, join_style=ROUND)
    two = unary_union([two, box(138, foot - w, 218, foot)])
    bar = Polygon([(54, 168), (202, 168), (214, 190), (42, 190)])  # the ingot the letters stand on
    return centre(cart.difference(unary_union([y_, two, bar])))

# B — Barra que se paga: an ingot in perspective; its top layer (the yield) slides off to pay.
def concept_b():
    front = soften(Polygon([(56, 132), (200, 132), (224, 200), (32, 200)]), 8)
    top = soften(Polygon([(84, 92), (180, 92), (196, 122), (60, 122)]), 6)
    return centre(unary_union([front, affinity.translate(top, 18, 0)]))

# C — O 2 fundido: wordmark whose "2" begins as a drop of molten metal and settles into a bar.
FONT = TTFont("/usr/share/fonts/opentype/inter/Inter-Bold.otf")
GS, CMAP = FONT.getGlyphSet(), FONT.getBestCmap()

def molten_two():
    """In font units, y down, baseline 0, height 1490, advance 1290."""
    w, H = 290, 1490
    r = 380; cx, cy = 640, -H + r + w / 2
    pts = arc(cx, cy, r, 192, 360 + 40) + [(190 + w / 2, -w / 2)]
    body = LineString(pts).buffer(w / 2, cap_style=FLAT, join_style=ROUND)
    base = soften(box(150, -w, 1180, 0), 40)
    sx, sy = pts[0]
    drop = Point(sx, sy + 0.62 * w).buffer(0.56 * w, 64)           # molten metal dripping from the terminal
    neck = unary_union([Point(sx, sy).buffer(w / 2, 64), drop]).convex_hull
    s_ = 0.42 * w                                                  # base = a small ingot (sloped ends)
    base = Polygon([(130, 0), (1200, 0), (1200 - s_, -w), (130 + s_, -w)])
    return unary_union([body, base, neck])

def wordmark(text="Yield2Pay", size=150, tracking=-0.01):
    k = size / 2048; x = 0; parts = []
    for ch in text:
        if ch == "2":
            g = affinity.scale(molten_two(), k, k, origin=(0, 0))
            parts.append(fill(affinity.translate(g, x, 0)).replace('<path', '<path data-glyph="2"'))
            adv = 1290
        else:
            pen = SVGPathPen(GS); GS[CMAP[ord(ch)]].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
            parts.append(f'<path fill="#000" d="{pen.getCommands()}"/>'); adv = GS[CMAP[ord(ch)]].width
        x += adv * k + tracking * size
    return parts, x - tracking * size, 1490 * k

def lockup(sym_body, name):
    parts, w, cap = wordmark()
    gap, ty = 70, 128 + cap / 2
    W = int(256 + gap + w + 8)
    return svg(sym_body + f'<g transform="translate({256 + gap} {ty:.1f})">{"".join(parts)}</g>', W, 256,
               f"Yield2Pay — {name} lockup")

def wordmark_svg():
    parts, w, cap = wordmark()
    pad = 24; W, Hh = int(w + 2 * pad), 256
    return svg(f'<g transform="translate({pad} {128 + cap / 2:.1f})">{"".join(parts)}</g>', W, Hh, "Yield2Pay — O 2 fundido")

geoms = {"a": concept_a(), "b": concept_b(),
         "c": centre(affinity.scale(molten_two(), 0.13, 0.13, origin=(0, 0)))}
names = {"a": "Punção de refinadora", "b": "Barra que se paga", "c": "O 2 fundido"}
for k, g in geoms.items():
    open(f"{OUT}/{k}-symbol.svg", "w").write(svg(fill(g), title=f"Yield2Pay — {names[k]}"))
for k in "ab":
    open(f"{OUT}/{k}-lockup.svg", "w").write(lockup(fill(geoms[k]), names[k]))
open(f"{OUT}/c-lockup.svg", "w").write(wordmark_svg())

# Silver-on-black + engraved metal card previews (presentation only — masters stay flat black).
def preview():
    CW, CH, G = 520, 328, 28
    defs = ('<defs><linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6E8EA"/>'
            '<stop offset="1" stop-color="#A8AAAD"/></linearGradient>'
            '<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3c3f44"/>'
            '<stop offset=".26" stop-color="#26282c"/><stop offset=".52" stop-color="#16181b"/>'
            '<stop offset=".74" stop-color="#303338"/><stop offset="1" stop-color="#1b1d21"/></linearGradient>'
            '<pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">'
            '<rect width="1" height="6" fill="rgba(255,255,255,.035)"/></pattern></defs>')
    W = G + 3 * (CW + G); H = G + 2 * (CH + G) + 30
    out = [defs, f'<rect width="{W}" height="{H}" fill="#0c0d0f"/>']
    for i, k in enumerate("abc"):
        x = G + i * (CW + G)
        lk = open(f"{OUT}/{k}-lockup.svg").read()
        vb = [float(v) for v in lk.split('viewBox="')[1].split('"')[0].split()]
        inner = lk.split("</title>")[1].rsplit("</svg>", 1)[0]
        s = min((CW - 80) / vb[2], 110 / vb[3])
        tx, ty = x + (CW - vb[2] * s) / 2, G + (CH - vb[3] * s) / 2
        out.append(f'<rect x="{x}" y="{G}" width="{CW}" height="{CH}" rx="18" fill="#131417" stroke="#2A2D31"/>')
        out.append(f'<g transform="translate({tx:.1f} {ty:.1f}) scale({s:.4f})">{inner.replace("#000", "url(#chrome)")}</g>')
        # engraved metal card: deboss = light copy offset down-right, dark copy on top
        y2 = G + CH + G
        out.append(f'<rect x="{x}" y="{y2}" width="{CW}" height="{CH}" rx="22" fill="url(#metal)" stroke="#4a4d52"/>'
                   f'<rect x="{x}" y="{y2}" width="{CW}" height="{CH}" rx="22" fill="url(#grain)"/>')
        sym = open(f"{OUT}/{k}-symbol.svg").read().split("</title>")[1].rsplit("</svg>", 1)[0]
        sx, sy, ss = x + 36, y2 + 34, 0.36
        for dx, col in [(1.6, "rgba(255,255,255,.22)"), (0, "#121316")]:
            out.append(f'<g transform="translate({sx + dx:.1f} {sy + dx:.1f}) scale({ss})">{sym.replace("#000", col)}</g>')
        out.append(f'<text x="{x + 36}" y="{y2 + CH - 40}" font-family="Geist Mono, DejaVu Sans Mono, monospace" '
                   f'font-size="17" letter-spacing="3" fill="#8a8d91">•••• 2048   FAMÍLIA SILVA</text>')
        out.append(f'<text x="{x + 4}" y="{H - 18}" font-family="Inter" font-size="18" font-weight="700" fill="#EDEFF1">'
                   f'{"ABC"[i]} · {names[k]}</text>')
    open(f"{OUT}/preview-metal.svg", "w").write(svg("".join(out), W, H, "Yield2Pay — prata e gravação"))
preview()
