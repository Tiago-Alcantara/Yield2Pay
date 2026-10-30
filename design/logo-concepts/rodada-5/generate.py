"""Round 5 — twenty name-independent symbols (black masters, 256 viewBox)."""
import math, sys, json
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely import affinity

OUT = sys.argv[1]
ROUND, FLAT = 1, 2

def path_d(geom):
    polys = geom.geoms if hasattr(geom, "geoms") else [geom]
    ring = lambda r: "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in list(r.coords)[:-1]) + " Z"
    return " ".join(ring(p.exterior) + "".join(" " + ring(i) for i in p.interiors) for p in polys)

C = lambda x, y, r: Point(x, y).buffer(r, 64)
ring = lambda x, y, r, w: C(x, y, r).difference(C(x, y, r - w))
line = lambda pts, w, cap=ROUND: LineString(pts).buffer(w / 2, cap_style=cap)
soften = lambda g, r: g.buffer(-r, join_style=ROUND).buffer(r, join_style=ROUND)
dia = lambda x, y, h: Polygon([(x, y - h), (x + h, y), (x, y + h), (x - h, y)])
def trap(x0, x1, y0, y1, inset):          # ingot: top edge inset on both sides
    return Polygon([(x0 + inset, y0), (x1 - inset, y0), (x1, y1), (x0, y1)])
def polar(r, deg, cx=128, cy=128):
    a = math.radians(deg); return (cx + r * math.cos(a), cy + r * math.sin(a))

def arc(cx, cy, r, a0, a1, n=48):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

def fit(g, size=208, cx=128, cy=126):
    x0, y0, x1, y1 = g.bounds; s = size / max(x1 - x0, y1 - y0)
    g = affinity.scale(g, s, s, origin=((x0 + x1) / 2, (y0 + y1) / 2))
    x0, y0, x1, y1 = g.bounds
    return affinity.translate(g, cx - (x0 + x1) / 2, cy - (y0 + y1) / 2)

S = []
def concept(name, idea):
    def deco(fn): S.append((name, idea, fn)); return fn
    return deco

@concept("Leme", "Você conduz; o rendimento empurra. O leme da Fortuna como independência financeira.")
def _():
    parts = [ring(128, 128, 64, 16), C(128, 128, 20)]
    for i in range(8):
        parts += [line([(128, 128), polar(98, i * 45 + 22.5)], 12), C(*polar(100, i * 45 + 22.5), 11)]
    return unary_union(parts).difference(C(128, 128, 7))

@concept("Leme mínimo", "O mesmo leme reduzido ao aro e às manoplas: mais calmo, mais joia.")
def _():
    return unary_union([ring(128, 128, 74, 22)] + [line([polar(70, a), polar(106, a)], 18) for a in range(-90, 270, 60)])

def bez(*pts, n=32):
    out = []
    for i in range(n + 1):
        t = i / n; k = len(pts) - 1
        x = sum(math.comb(k, j) * (1 - t) ** (k - j) * t ** j * pts[j][0] for j in range(k + 1))
        y = sum(math.comb(k, j) * (1 - t) ** (k - j) * t ** j * pts[j][1] for j in range(k + 1))
        out.append((x, y))
    return out

@concept("Barrete da liberdade", "O barrete frígio das moedas da República: a ponta cai para a frente, símbolo de liberdade.")
def _():
    outline = (bez((44, 166), (36, 70), (110, 40), (160, 52)) + bez((160, 52), (206, 62), (214, 104), (200, 132))
               + bez((200, 132), (184, 112), (168, 108), (160, 120)) + bez((160, 120), (172, 140), (176, 152), (178, 166)))
    cap = soften(Polygon(outline), 2)
    band = soften(box(36, 178, 192, 208), 6)
    return unary_union([cap, band])

@concept("Selo redondo", "A marca de ensaio da refinadora com um lingote no centro: pureza garantida.")
def _():
    ingot = trap(78, 178, 102, 156, 16)
    return unary_union([ring(128, 128, 106, 12), C(128, 128, 84).difference(ingot)])

@concept("Punção com losango", "O selo de cantos côncavos do ourives guardando o losango que a marca já tem.")
def _():
    g = box(26, 26, 230, 230)
    for x, y in [(26, 26), (230, 26), (26, 230), (230, 230)]:
        g = g.difference(C(x, y, 34))
    return soften(g, 3).difference(dia(128, 128, 54))

@concept("Moeda com furo", "Como as moedas antigas com furo: o dinheiro circula, mas o centro é seu e fica.")
def _():
    return C(128, 128, 104).difference(dia(128, 128, 40))

@concept("Moeda com fechadura", "Uma moeda com fechadura: o cofre e a chave são seus. Não-custodial em uma imagem.")
def _():
    hole = unary_union([C(128, 104, 24), Polygon([(116, 112), (140, 112), (150, 170), (106, 170)])])
    return C(128, 128, 104).difference(hole)

@concept("Lingote em 3D", "A barra de prata em perspectiva, com as faces separadas como peças gravadas.")
def _():
    L, W, H, k = 150, 70, 44, 12
    def P(x, y, z): return ((x - z) * math.cos(math.radians(30)), (x + z) * math.sin(math.radians(30)) - y)
    t = [(k, H, k), (L - k, H, k), (L - k, H, W - k), (k, H, W - k)]
    top = Polygon([P(*p) for p in t])
    front = Polygon([P(k, H, W - k), P(L - k, H, W - k), P(L, 0, W), P(0, 0, W)])
    side = Polygon([P(L - k, H, k), P(L - k, H, W - k), P(L, 0, W), P(L, 0, 0)])
    return unary_union([f.buffer(-3, join_style=2) for f in (top, front, side)])

@concept("Gota sobre a barra", "Na forja, o metal derretido pinga e vira barra. O valor que se constrói.")
def _():
    drop = unary_union([C(128, 112, 36), Polygon([(128, 30), (100, 92), (156, 92)])]).convex_hull
    return unary_union([soften(drop, 4), soften(trap(36, 220, 168, 210, 14), 6)])

@concept("Bigorna", "A ferramenta do ofício: solidez, peso e trabalho bem feito.")
def _():
    return soften(Polygon([(24, 86), (224, 86), (224, 120), (182, 130), (166, 154), (198, 180), (198, 202), (70, 202),
                           (70, 180), (102, 154), (90, 130), (58, 122)]), 4)

@concept("Portal", "Um arco de banco antigo, aberto: o dinheiro entra e sai quando você quiser.")
def _():
    outer = unary_union([box(48, 104, 208, 216), C(128, 104, 80)])
    inner = unary_union([box(82, 104, 174, 230), C(128, 104, 46)])
    return unary_union([outer.difference(inner), dia(128, 176, 20)])

@concept("Ampulheta de lingotes", "Dois lingotes formam uma ampulheta: o tempo trabalha e a barra de baixo enche.")
def _():
    top = Polygon([(44, 30), (212, 30), (140, 122), (116, 122)])
    bot = Polygon([(116, 134), (140, 134), (212, 226), (44, 226)])
    return unary_union([top.difference(top.buffer(-12, join_style=2)), bot])

@concept("Chave", "\"A carteira e as chaves são suas.\" Uma chave com o losango no aro.")
def _():
    bow = C(128, 74, 48).difference(dia(128, 74, 22))
    shaft = box(118, 116, 138, 226)
    teeth = unary_union([box(138, 176, 168, 194), box(138, 206, 160, 224)])
    return unary_union([bow, shaft, teeth])

@concept("Coroa de louros", "Os louros da efígie da República: conquista, maturidade e liberdade.")
def _():
    leaves = []
    for side in (1, -1):
        for i in range(6):
            a = 110 + i * 24
            x, y = polar(86, a if side == 1 else 180 - a)
            leaf = affinity.scale(C(0, 0, 1), 11, 24)
            ang = (a + 90 + 25) if side == 1 else (180 - a - 90 - 25)
            leaves.append(affinity.translate(affinity.rotate(leaf, ang, origin=(0, 0)), x, y))
    return unary_union(leaves + [dia(128, 214, 12)])

@concept("Pena de prata", "Uma pena: leveza e liberdade, e também a pena que assina. Dividida em fatias, como lâminas de metal.")
def _():
    vesica = C(128 - 70, 128, 120).intersection(C(128 + 70, 128, 120))
    vesica = affinity.scale(vesica, 0.62, 1.0)
    cut = unary_union([box(0, 126, 256, 134).intersection(box(128, 0, 256, 256)),
                       affinity.rotate(box(128, 84, 256, 92), -18, origin=(128, 88)),
                       box(124, 40, 132, 214)])
    feather = vesica.difference(cut)
    feather = unary_union([feather, line([(128, 200), (128, 236)], 8)])
    return affinity.rotate(feather, -38, origin=(128, 128))

@concept("Horizonte", "Uma moeda nasce acima da barra: todo dia o rendimento aparece, a barra fica.")
def _():
    sun = C(128, 150, 70).intersection(box(0, 0, 256, 148))
    return unary_union([sun, soften(trap(30, 226, 162, 204, 14), 6)])

@concept("Elo aberto", "Um elo de corrente que se abre: nada te prende, o dinheiro é seu.")
def _():
    stadium = unary_union([C(96, 128, 58), C(160, 128, 58), box(96, 70, 160, 186)])
    link = stadium.difference(stadium.buffer(-22))
    link = link.difference(Polygon([(176, 40), (230, 40), (230, 110), (190, 110)]))
    return affinity.rotate(link, -30, origin=(128, 128))

@concept("Lua da prata", "Na alquimia, a prata é a lua crescente. O ponto ao lado é o rendimento.")
def _():
    return unary_union([C(118, 128, 100).difference(C(156, 112, 86)), C(196, 150, 18)])

@concept("Degraus de lingote", "Três barras em escada: a maturidade financeira, um degrau por vez.")
def _():
    return unary_union([soften(trap(24 + i * 52, 120 + i * 52, 172 - i * 52, 210 - i * 52, 12), 5) for i in range(3)])

@concept("Cofre entreaberto", "A porta do cofre entreaberta: o principal sai quando você quiser.")
def _():
    body = soften(box(28, 40, 196, 216), 18).difference(C(112, 128, 56))
    door = affinity.scale(C(0, 0, 1), 26, 62); door = affinity.translate(door, 206, 128)
    door = door.difference(C(206, 128, 8))
    body = body.difference(door.buffer(10))
    return unary_union([body, door])

meta = []
for i, (name, idea, fn) in enumerate(S, 1):
    g = fit(fn())
    d = path_d(g)
    fn_ = f"{i:02d}.svg"
    open(f"{OUT}/{fn_}", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
                                   f'<title>{name}</title><path fill="#000" fill-rule="evenodd" d="{d}"/></svg>\n')
    meta.append({"n": i, "name": name, "idea": idea, "d": d})
json.dump(meta, open(f"{OUT}/concepts.json", "w"), ensure_ascii=False, indent=1)
print(len(meta), "concepts")
