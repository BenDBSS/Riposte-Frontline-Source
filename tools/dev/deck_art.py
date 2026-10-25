"""Images du raccourci Steam (version Steam Deck, voir README « Steam Deck ») : tirées de l'illustration du menu (assets/menu-bg.webp,
1916 x 821, le soldat à 72 % de la largeur) et du logo (assets/logo.webp), écrites dans assets/deck/ (build.py les copie dans dist/deck/,
d'où l'installeur les télécharge vers le dossier grid de Steam).
  jaquette.jpg  600 x 900   capsule verticale de la bibliothèque (logo en bas, sur les rochers sombres)
  capsule.jpg   920 x 430   capsule horizontale (logo à gauche, dans le ciel sombre)
  hero.jpg      1920 x 620  bandeau de la page du jeu (sans logo : Steam pose le sien par-dessus)
  logo.png      1000 x 230  logo détouré, posé par Steam sur le bandeau
  icone.png     256 x 256   icône du raccourci
À relancer après une retouche de l'illustration ou du logo : python3 tools/dev/deck_art.py (depuis la racine, Pillow)."""
import os
from PIL import Image, ImageDraw

OUT = "assets/deck"
os.makedirs(OUT, exist_ok=True)
bg = Image.open("assets/menu-bg.webp").convert("RGB")
logo = Image.open("assets/logo.webp").convert("RGBA")
W, H = bg.size
SOLDIER = 0.72 * W  # abscisse du soldat dans l'illustration


def shade(img, box, top_a, bottom_a):
    """Dégradé sombre vertical sur une bande (lisibilité du logo)"""
    x0, y0, x1, y1 = box
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1)
        d.line([(x0, y), (x1, y)], fill=(4, 5, 4, int(top_a + (bottom_a - top_a) * t)))
    return Image.alpha_composite(img.convert("RGBA"), ov)


def put_logo(img, width, cx, cy):
    lg = logo.resize((width, round(width * logo.height / logo.width)), Image.LANCZOS)
    img.alpha_composite(lg, (round(cx - lg.width / 2), round(cy - lg.height / 2)))


def crop(aspect, cx, cy=None):
    """Plus grand cadre de proportions aspect (largeur / hauteur) centré au mieux sur (cx, cy)"""
    if W / H > aspect:
        h = H; w = round(H * aspect)
    else:
        w = W; h = round(W / aspect)
    x0 = min(max(0, round(cx - w / 2)), W - w)
    y0 = min(max(0, round((cy if cy is not None else H / 2) - h / 2)), H - h)
    return bg.crop((x0, y0, x0 + w, y0 + h))


# jaquette : le soldat en pied, logo en bas
j = crop(600 / 900, SOLDIER).resize((600, 900), Image.LANCZOS)
j = shade(j, (0, 640, 600, 900), 0, 210)
put_logo(j, 500, 300, 812)
j.convert("RGB").save(f"{OUT}/jaquette.jpg", quality=90)

# capsule horizontale : cadre calé à droite (soldat vers 70 %), logo dans le ciel sombre de gauche
c = crop(920 / 430, W).resize((920, 430), Image.LANCZOS)
c = Image.alpha_composite(c.convert("RGBA"), Image.new("RGBA", c.size, (0, 0, 0, 0)))
put_logo(c, 400, 235, 200)
c.convert("RGB").save(f"{OUT}/capsule.jpg", quality=90)

# bandeau : panorama, de la tête aux genoux du soldat
h = crop(1920 / 620, W / 2, 0.52 * H).resize((1920, 620), Image.LANCZOS)
h.save(f"{OUT}/hero.jpg", quality=90)

logo.save(f"{OUT}/logo.png", optimize=True)
Image.open("assets/icon/icon-512.png").convert("RGBA").resize((256, 256), Image.LANCZOS).save(f"{OUT}/icone.png", optimize=True)
for f in sorted(os.listdir(OUT)):
    if f.endswith((".jpg", ".png")):
        print(f, Image.open(f"{OUT}/{f}").size, os.path.getsize(f"{OUT}/{f}") // 1024, "Ko")
