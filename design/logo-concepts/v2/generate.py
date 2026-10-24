import math, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
OUT = sys.argv[1]
R2 = math.sqrt(2)
def poly(pts): return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + " Z"
def diamond(cx, cy, h): return [(cx, cy-h), (cx+h, cy), (cx, cy+h), (cx-h, cy)]
def svg(body, w=256, h=256, title=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<title>{title}</title>{body}</svg>\n')

# A — "Rendimento no topo": full diamond silhouette; a small diamond (yield) born from the top corner.
def concept_a(g=16):
    H, cy, s = 104, 128, 34          # big half-diagonal, centre, small half-diagonal
    top = cy - H
    sm = diamond(128, top + s, s)
    o = g * R2                        # vertical shift of a 45° edge offset by g
    # notch follows the small diamond's lower edges, offset by the gap
    # right notch line: y = -(x-128) + (top+2s) + o ; big upper-right edge: y = (x-128) + top
    xr = 128 + ((top + 2*s + o) - top) / 2
    yr = (xr - 128) + top
    big = [(128-H, cy), (256-xr, yr), (128, top + 2*s + o), (xr, yr), (128+H, cy), (128, cy+H)]
    rot = lambda pts: [(256 - y, x) for x, y in pts]   # 90° clockwise about the centre
    return f'<path fill="#000" d="{poly(rot(sm))} {poly(rot(big))}"/>'

# B — "Medidor de liberdade": diamond frame + inner fill whose level is the Freedom %.
def concept_b(level=0.70, t=26, g=18):
    H = 104; hi = H - t*R2; hf = hi - g*R2
    ring = f'{poly(diamond(128,128,H))} {poly(diamond(128,128,hi)[::-1])}'
    top, bot = 128 - hf, 128 + hf
    y = bot - level * (bot - top)
    if y <= 128:
        dx = (128 - y) if False else hf - (128 - y)
        fill = [(128-dx, y), (128+dx, y), (128+hf, 128), (128, bot), (128-hf, 128)]
    else:
        dx = hf - (y - 128)
        fill = [(128-dx, y), (128+dx, y), (128, bot)]
    return f'<path fill="#000" fill-rule="evenodd" d="{ring} {poly(fill)}"/>'

# C — "Y que paga": a heavy chevron (the V of the Y) over a small diamond that drops out as its stem.
def concept_c(t=34, g=16, s=42):
    d = t * R2; y0 = 26
    v = [(24, y0), (24+d, y0), (128, y0 + 104 - d), (232-d, y0), (232, y0), (128, y0 + 104)]
    cy = y0 + 104 + g*R2 + s
    return f'<path fill="#000" d="{poly(v)} {poly(diamond(128, cy, s))}"/>'

# wordmark outlined from Inter Bold (stand-in for Hanken Grotesk 700, which isn't installed here)
def wordmark(text="Yield2Pay", size=150, tracking=-0.01):
    f = TTFont("/usr/share/fonts/opentype/inter/Inter-Bold.otf")
    gs, cmap, upm = f.getGlyphSet(), f.getBestCmap(), f["head"].unitsPerEm
    k = size / upm; x = 0; paths = []
    for ch in text:
        gn = cmap[ord(ch)]; pen = SVGPathPen(gs)
        gs[gn].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
        paths.append(pen.getCommands()); x += gs[gn].width * k + tracking * size
    return " ".join(paths), x - tracking * size, f["OS/2"].sCapHeight * k

def lockup(symbol_body, name):
    d, w, cap = wordmark()
    sym_h = 256; gap = 70; ty = 128 + cap / 2
    W = int(sym_h + gap + w + 8)
    body = (f'{symbol_body}<path fill="#000" transform="translate({sym_h+gap} {ty:.2f})" d="{d}"/>')
    return svg(body, W, 256, f"Yield2Pay — {name} lockup")

for key, fn, name in [("a", concept_a, "Rendimento no topo"), ("b", concept_b, "Medidor de liberdade"), ("c", concept_c, "Y que paga")]:
    body = fn()
    open(f"{OUT}/{key}-symbol.svg", "w").write(svg(body, title=f"Yield2Pay — {name}"))
    open(f"{OUT}/{key}-lockup.svg", "w").write(lockup(body, name))
# B as a system: the same mark at several Freedom levels
for lv in (0.0, 0.25, 0.5, 0.75, 1.0):
    open(f"{OUT}/b-level-{int(lv*100):03d}.svg", "w").write(svg(concept_b(lv), title=f"Freedom {int(lv*100)}%"))
