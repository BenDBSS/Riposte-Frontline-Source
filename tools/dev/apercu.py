#!/usr/bin/env python3
"""Image d'aperçu des liens partagés (Discord, WhatsApp, réseaux sociaux) : python3 tools/dev/apercu.py
Compose assets/apercu.jpg (1200 x 630, le format des aperçus) à partir du fond des menus (assets/menu-bg.webp) et du logo
(assets/logo.webp) : le fond couvre l'image, un dégradé sombre à gauche porte le logo. Aucun texte (l'aperçu sert dans les deux
langues). build.py la copie dans dist/icons/ avec une empreinte et l'annonce dans les balises og:image de la page.
À relancer après une retouche du fond ou du logo."""
import os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
W, H = 1200, 630
bg = Image.open(os.path.join(ROOT, 'assets/menu-bg.webp')).convert('RGB')
s = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
x0, y0 = (bg.width - W) // 2, (bg.height - H) // 2
img = bg.crop((x0, y0, x0 + W, y0 + H))
# dégradé sombre de la gauche vers le milieu, pour que le logo se lise
shade = Image.new('L', (W, H), 0); d = ImageDraw.Draw(shade)
for x in range(W):
    d.line([(x, 0), (x, H)], fill=round(215 * max(0.0, 1 - x / (W * 0.62)) ** 1.4))
img = Image.composite(Image.new('RGB', (W, H), (8, 10, 7)), img, shade)
logo = Image.open(os.path.join(ROOT, 'assets/logo.webp')).convert('RGBA')
lw = 600; logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
img.paste(logo, (64, (H - logo.height) // 2 - 10), logo)
img.save(os.path.join(ROOT, 'assets/apercu.jpg'), quality=86, optimize=True, progressive=True)
print('assets/apercu.jpg', os.path.getsize(os.path.join(ROOT, 'assets/apercu.jpg')) // 1024, 'Ko')
