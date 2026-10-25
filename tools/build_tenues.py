"""Construit assets/tenue/ : les scans de tissu CC0 (Poly Haven) dont la matière des tenues tire son relief, sa rugosité et
les nuances de sa teinte (src/06e-gear.js, gearScan). build.py les livre dans le socle de la page (window.SOCLE.tissus et .teinte).

Disposition commune aux deux images (768 x 512) :
  - toile (rough_linen, 27 cm de côté) : un carreau entier de 512 x 512 en haut à gauche, raccordable dans les deux sens ;
  - tricot (knitted_fleece) : 14 cm de scan en 256 x 256, en haut à droite (gants, cagoules, cols) ;
  - cuir (brown_leather) : 20 cm de scan en 256 x 256, en bas à droite (paumes, bottes).
tissus.webp : rouge et vert = normale (convention OpenGL, comme nor_gl), bleu = rugosité.
teinte.webp (384 x 256, même disposition à demi-échelle) : la luminance du scan, ramenée à une moyenne de 128 et un écart type
de 32 (les nuances seules, pas la couleur).

Sources (jpg 2K de dl.polyhaven.org : diff, nor_gl, rough) dans assets_src/polyhaven/<nom>/ (diff.jpg, nor.jpg, rough.jpg),
dossier ignoré par git. Lancer : python3 tools/build_tenues.py (Pillow)."""
import io, json, pathlib
from PIL import Image, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent.parent
PH = ROOT / 'assets_src' / 'polyhaven'
OUT = ROOT / 'assets' / 'tenue'
# nom, scan, taille du scan (cm), part du scan retenue (1 : carreau entier), case (x, y, côté) dans l'image
TILES = [
    ('toile', 'rough_linen', 27.07, 1.0, (0, 0, 512)),
    ('tricot', 'knitted_fleece', 26.64, 14 / 26.64, (512, 0, 256)),
    ('cuir', 'brown_leather', 40.0, 20 / 40.0, (512, 256, 256)),
]

def crop(im, part):
    if part >= 1: return im
    w = round(im.width * part); return im.crop((0, 0, w, w))

def webp(im, q):
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()

def main():
    nrm = Image.new('RGB', (768, 512), (128, 128, 230))
    tin = Image.new('L', (768, 512), 128)
    for name, src, cm, part, (x, y, s) in TILES:
        d = PH / src
        n = crop(Image.open(d / 'nor.jpg').convert('RGB'), part).resize((s, s), Image.LANCZOS)
        r = crop(Image.open(d / 'rough.jpg').convert('L'), part).resize((s, s), Image.LANCZOS)
        c = crop(Image.open(d / 'diff.jpg').convert('L'), part).resize((s, s), Image.LANCZOS)
        R, G, _ = n.split()
        nrm.paste(Image.merge('RGB', (R, G, r)), (x, y))
        st = ImageStat.Stat(c); m, sd = st.mean[0], max(st.stddev[0], 1)
        tin.paste(c.point(lambda v: max(0, min(255, round(128 + (v - m) / sd * 32)))), (x, y))
        print(f'{name} : {src} ({cm:.0f} cm), {part * cm:.1f} cm en {s} px, rugosité moyenne {ImageStat.Stat(r).mean[0] / 255:.2f}')
    OUT.mkdir(parents=True, exist_ok=True)
    # teinte en demi-résolution : seules les nuances de quelques millimètres et plus se voient sur un soldat (et la pleine
    # résolution pèserait 150 Ko de plus)
    for f, data in (('tissus.webp', webp(nrm, 85)), ('teinte.webp', webp(tin.resize((384, 256), Image.LANCZOS).convert('RGB'), 70))):
        (OUT / f).write_bytes(data); print(f, len(data) // 1024, 'Ko')
    # crédits (assets/tex/credits.json) : une entrée par scan, gardée à jour
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if not c['key'].startswith('tenue-')]
    cr += [{'key': 'tenue-' + name, 'asset': src, 'source': 'Poly Haven', 'licence': 'CC0 1.0'} for name, src, *_ in TILES]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

main()
