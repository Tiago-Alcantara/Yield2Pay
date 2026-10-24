"""Round 4 — name-independent precious-metal symbols (no letters, no numerals)."""
import math, sys
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely import affinity

OUT = sys.argv[1]
ROUND = 1

def path_d(geom):
    polys = geom.geoms if hasattr(geom, "geoms") else [geom]
    ring = lambda r: "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in list(r.coords)[:-1]) + " Z"
    return " ".join(ring(p.exterior) + "".join(" " + ring(i) for i in p.interiors) for p in polys)

def svg(body, w=256, h=256, title=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<title>{title}</title>{body}</svg>\n')

fill = lambda g, c="#000": f'<path fill="{c}" fill-rule="evenodd" d="{path_d(g)}"/>'
soften = lambda g, r: g.buffer(-r, join_style=ROUND).buffer(r, join_style=ROUND)

def centre(g, cx=128, cy=126):
    x0, y0, x1, y1 = g.bounds
    return affinity.translate(g, cx - (x0 + x1) / 2, cy - (y0 + y1) / 2)

def ingot(x, y, w, h, slope=1 / 3, r=6):
    """Trapezoid bar: bottom edge w wide at y+h, sides leaning in by `slope`."""
    d = h * slope
    return soften(Polygon([(x + d, y), (x + w - d, y), (x + w, y + h), (x, y + h)]), r)

def ingot_layers(x, y, w, gap=10, slide=0):
    """Ingot in perspective: front face + top face; the top face (the yield) can slide."""
    front = ingot(x, y + 40 + gap, w, 68, r=8)
    top = ingot(x + 22, y, w - 44, 40 - 0, slope=0.55, r=6)
    return front, affinity.translate(top, slide, 0)

# A — Selo do lingote: a refiner's hallmark punch with a sliding ingot struck into it.
def concept_a():
    cart = box(20, 40, 236, 216)
    for cx, cy in [(20, 40), (236, 40), (20, 216), (236, 216)]:
        cart = cart.difference(Point(cx, cy).buffer(24, 64))
    cart = soften(cart, 3)
    front, top = ingot_layers(44, 72, 168, gap=10, slide=14)
    return centre(cart.difference(unary_union([front, top])))

# B — Barra que se paga (refined): the yield layer slides clearly off the whole bar.
def concept_b():
    front, top = ingot_layers(28, 74, 200, gap=12, slide=30)
    return centre(unary_union([front, top]))

# C — Fora do molde: the finished bar lifts out of its mould — value built over time, now independent.
def concept_c():
    outer = ingot(42, 132, 172, 76, slope=-1 / 3, r=8)          # mould: wider at the top
    cavity = ingot(66, 116, 124, 70, slope=-1 / 3, r=4)
    mould = outer.difference(cavity)
    bar = ingot(62, 60, 132, 54, r=7)                           # the bar, lifted out with a gap
    return centre(unary_union([mould, bar]))

names = {"a": "Selo do lingote", "b": "Barra que se paga", "c": "Fora do molde"}
for k, fn in [("a", concept_a), ("b", concept_b), ("c", concept_c)]:
    open(f"{OUT}/{k}-symbol.svg", "w").write(svg(fill(fn()), title=names[k]))

# Silver tile + engraved metal card previews (presentation only — masters stay flat black).
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
        sym = open(f"{OUT}/{k}-symbol.svg").read().split("</title>")[1].rsplit("</svg>", 1)[0]
        out.append(f'<rect x="{x}" y="{G}" width="{CW}" height="{CH}" rx="18" fill="#131417" stroke="#2A2D31"/>')
        # app-icon tile + large silver mark
        out.append(f'<g transform="translate({x + 60} {G + 74}) scale(0.7)">{sym.replace("#000", "url(#chrome)")}</g>')
        out.append(f'<rect x="{x + 330}" y="{G + 104}" width="120" height="120" rx="28" fill="url(#metal)" stroke="#4a4d52"/>'
                   f'<g transform="translate({x + 345} {G + 119}) scale(0.352)">{sym.replace("#000", "url(#chrome)")}</g>')
        y2 = G + CH + G
        out.append(f'<rect x="{x}" y="{y2}" width="{CW}" height="{CH}" rx="22" fill="url(#metal)" stroke="#4a4d52"/>'
                   f'<rect x="{x}" y="{y2}" width="{CW}" height="{CH}" rx="22" fill="url(#grain)"/>')
        for dx, col in [(1.6, "rgba(255,255,255,.22)"), (0, "#121316")]:
            out.append(f'<g transform="translate({x + 36 + dx:.1f} {y2 + 30 + dx:.1f}) scale(0.38)">{sym.replace("#000", col)}</g>')
        out.append(f'<text x="{x + 36}" y="{y2 + CH - 40}" font-family="DejaVu Sans Mono, monospace" '
                   f'font-size="17" letter-spacing="3" fill="#8a8d91">•••• 2048   FAMÍLIA SILVA</text>')
        out.append(f'<text x="{x + 4}" y="{H - 18}" font-family="Inter" font-size="18" font-weight="700" fill="#EDEFF1">'
                   f'{"ABC"[i]} · {names[k]}</text>')
    open(f"{OUT}/preview-metal.svg", "w").write(svg("".join(out), W, H, "Prata e gravação"))
preview()
