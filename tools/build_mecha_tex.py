"""Construit assets/tex/mecha/ et assets/tex/mechadark/ : les surfaces du mecha (série à 13, src/08f-mecha.js), tirées de textures CC0.
build.py les livre comme les autres surfaces photo (dist/tex/<clé>.<condensat>.js) ; le jeu les charge au lancement de la première carte et
les garde (mechaTexLoad).

mecha (1024 px, une tuile de 1,1 m sur le mecha) : le blindage.
  - peinture : un métal de char peint (Poly Haven, green_metal_rust), désaturé et ramené au kaki du modèle ;
  - usure : éclats et rayures d'une peinture usée (ambientCG, PaintedMetal004) : son masque de métal découvre l'acier nu (atténué : un
    engin de guerre entretenu, pas une épave), sa normale donne le relief des rayures, sa rugosité leur brillant ; la peinture fonce un
    peu au bord des éclats ;
  - joints de panneaux (sillons) et rivets (dômes), comme la texture dessinée d'avant (mechaArmorTex) : dans la couleur, le relief et
    le brillant.
mechadark (512 px) : la mécanique sombre et l'acier des vérins et des canons, une tôle peinte rayée (Poly Haven, blue_metal_plate),
  désaturée (la matière donne la teinte), rugosité recentrée.
rough.webp : rugosité dans le vert, métal dans le bleu (convention de three.js et de tools/build_assets.py).

Sources dans assets_src/ (ignoré par git) : polyhaven/green_metal_rust/, polyhaven/blue_metal_plate/ (jpg 2K diff, nor_gl en nor.jpg,
arm), ambientcg/PaintedMetal004_1K-JPG/ (Color, NormalGL, Roughness, Metalness).
Lancer : python3 tools/build_mecha_tex.py (Pillow, numpy)."""
import io, json, pathlib
import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
PH, AC = ROOT / 'assets_src' / 'polyhaven', ROOT / 'assets_src' / 'ambientcg'
N = 1024
KHAKI = np.array([98, 101, 78], np.float32) # teinte moyenne du blindage (sRGB), celle de la texture dessinée d'avant
BARE = np.array([132, 132, 128], np.float32) # acier nu sous la peinture
WEAR = 0.55 # part de l'usure gardée

def load(p, size, mode='RGB'):
    return np.asarray(Image.open(p).convert(mode).resize((size, size), Image.LANCZOS), np.float32)

def webp(a, q):
    b = io.BytesIO(); Image.fromarray(np.clip(np.round(a), 0, 255).astype(np.uint8)).save(b, 'WEBP', quality=q, method=6); return b.getvalue()

def blur(a, r):
    return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), np.float32) / 255

def panels():
    """Hauteur des joints et des rivets (0 à plat, négatif dans un sillon, positif sur un rivet) et masque des joints, tuile raccordable"""
    y, x = np.mgrid[0:N, 0:N].astype(np.float32)
    h = np.zeros((N, N), np.float32); seam = np.zeros((N, N), np.float32)
    def dist(v, c): d = np.abs(v - c); return np.minimum(d, N - d)
    for c in (4, 384, 680): d = dist(x, c); g = np.exp(-(d / 5.5) ** 2); h -= g; seam = np.maximum(seam, g)
    for c in (4, 280, 600, 840): d = dist(y, c); g = np.exp(-(d / 5.5) ** 2); h -= g; seam = np.maximum(seam, g)
    for cx in (34, 414, 710):
        for cy in (34, 310, 630, 870):
            r = np.hypot(dist(x, cx), dist(y, cy)) / 9.0
            h += np.where(r < 1, np.sqrt(np.clip(1 - r * r, 0, 1)), 0) * 1.4
            seam = np.maximum(seam, 0.6 * np.exp(-((r - 1) / 0.15) ** 2)) # cerne du rivet
    return h, seam

def normal_from(h, k):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * k; gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * k
    return -gx, gy # pente vers une normale de type GL (y vers le haut de l'image)

def armor():
    paint = load(PH / 'green_metal_rust' / 'diff.jpg', N)
    g = paint.mean(2, keepdims=True); paint = paint * 0.65 + g * 0.35
    paint = paint * (KHAKI / paint.reshape(-1, 3).mean(0))
    w = AC / 'PaintedMetal004_1K-JPG'
    m = load(w / 'PaintedMetal004_1K-JPG_Metalness.jpg', N, 'L') / 255 * WEAR
    wc = load(w / 'PaintedMetal004_1K-JPG_Color.jpg', N).mean(2) / 255 # grain de l'acier découvert
    bare = BARE[None, None, :] * (0.8 + 0.4 * wc[..., None])
    lip = np.clip(blur(m, 3) - m, 0, 1) # bord des éclats : la peinture fonce
    col = paint * (1 - 0.6 * lip[..., None])
    col = col * (1 - m[..., None]) + bare * m[..., None]
    h, seam = panels()
    col = col * (1 - 0.75 * seam[..., None]) # joints et pourtour des rivets assombris
    # relief : rayures de l'usure + joints et rivets
    wn = load(w / 'PaintedMetal004_1K-JPG_NormalGL.jpg', N) / 127.5 - 1
    nx, ny = normal_from(h, 0.9)
    vx, vy, vz = wn[..., 0] * 1.4 + nx, wn[..., 1] * 1.4 + ny, wn[..., 2]
    l = np.sqrt(vx * vx + vy * vy + vz * vz); nor = np.stack([vx / l, vy / l, vz / l], 2) * 127.5 + 127.5
    # brillant : peinture mate, rayures plus vives, acier nu satiné, fond des joints mat
    wr = load(w / 'PaintedMetal004_1K-JPG_Roughness.jpg', N // 2, 'L') / 255
    mh = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).resize((N // 2, N // 2), Image.LANCZOS), np.float32) / 255
    sh = np.asarray(Image.fromarray((seam * 255).astype(np.uint8)).resize((N // 2, N // 2), Image.LANCZOS), np.float32) / 255
    rough = np.clip(0.66 + (wr - 0.15) * 0.8, 0.3, 1) * (1 - mh) + 0.36 * mh
    rough = np.clip(rough + 0.2 * sh, 0, 1)
    rgh = np.stack([rough * 255, rough * 255, mh / WEAR * 255], 2) # bleu : métal (acier découvert)
    return col, nor, rgh

def dark():
    S = 512
    c = load(PH / 'blue_metal_plate' / 'diff.jpg', S).mean(2)
    c = c * (190 / c.mean()); col = np.stack([c, c, c], 2)
    nor = load(PH / 'blue_metal_plate' / 'nor.jpg', S)
    r = load(PH / 'blue_metal_plate' / 'arm.jpg', S)[..., 1] / 255
    r = np.clip(0.55 + (r - r.mean()) * 1.3, 0.2, 1)
    return col, nor, np.stack([r * 255, r * 255, np.zeros_like(r)], 2)

def main():
    total = 0
    for key, (col, nor, rgh) in (('mecha', armor()), ('mechadark', dark())):
        d = ROOT / 'assets' / 'tex' / key; d.mkdir(parents=True, exist_ok=True); sz = {}
        for kind, a, q in (('map', col, 82), ('normal', nor, 78), ('rough', rgh, 80)):
            b = webp(a, q); (d / (kind + '.webp')).write_bytes(b); sz[kind] = len(b) // 1024; total += len(b)
        print(key, sz, 'Ko')
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if c['key'] not in ('mecha', 'mecha-usure', 'mechadark')]
    cr += [{'key': 'mecha', 'asset': 'green_metal_rust', 'source': 'Poly Haven', 'licence': 'CC0 1.0'},
           {'key': 'mecha-usure', 'asset': 'PaintedMetal004', 'source': 'ambientCG', 'licence': 'CC0 1.0'},
           {'key': 'mechadark', 'asset': 'blue_metal_plate', 'source': 'Poly Haven', 'licence': 'CC0 1.0'}]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('total', total // 1024, 'Ko')

main()
