"""Construit assets/arme/surface.webp : l'usure des armes, tirée de textures CC0 d'ambientCG, que la matière des armes lit en
triplanaire dans le repère de l'arme, à l'échelle réelle (src/06-weapons.js, gunSurfTexture et GUN_SURF_GLSL). build.py la livre dans
le socle de la page (window.SOCLE.grain), à la place de la rugosité d'enduit qui servait de grain.

Une image en niveaux de gris de 1024 x 512 : le WebP avec perte sous-échantillonne la couleur, si bien que des données rangées dans
les canaux rouge, vert et bleu d'une même image déteignent l'une sur l'autre (les rayures passaient dans le voile). Le jeu remet les
quatre cases dans les canaux d'une texture de 512 x 512 raccordable (11 cm d'arme) :
  - rayures fines (Scratches003, 512 x 512 en haut à gauche) : masque, noir pour rien, blanc pour une rayure, traits épaissis d'un
    pixel avant réduction ; canal vert ;
  - voile et traces de doigts (SurfaceImperfections008, 256 x 256 en haut à droite, agrandi deux fois) : moyenne 128, écart type 40 ;
    canal rouge ;
  - marbrure fine d'un polymère (rugosité de Plastic010, 256 x 256 en bas à droite, répétée deux fois dans chaque sens) : moyenne 128,
    écart type 36 ; canal bleu ;
  - fil du bois (luminance du placage european_walnut_veneer_04 de Poly Haven, 11 cm de scan, fil horizontal ; 256 x 512 à droite,
    étiré deux fois dans le sens du fil, rendu raccordable par fondu avec sa copie décalée d'une demi-case) : moyenne 128, écart type
    40 ; canal alpha, lu par les seules matières en bois.

Sources (jpg 1K d'ambientcg.com) dans assets_src/ambientcg/<Nom>_1K-JPG/, et le jpg 4K de la couleur du placage (Poly Haven) dans
assets_src/polyhaven/european_walnut_veneer_04/diff4k.jpg ; dossiers ignorés par git.
Lancer : python3 tools/build_armes.py (Pillow)."""
import io, json, pathlib
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent.parent
AC = ROOT / 'assets_src' / 'ambientcg'
PH = ROOT / 'assets_src' / 'polyhaven'
OUT = ROOT / 'assets' / 'arme'
SRC = {'voile': 'SurfaceImperfections008', 'rayures': 'Scratches003', 'marbrure': 'Plastic010'}
BOIS = 'european_walnut_veneer_04' # Poly Haven, 1 m de placage en 4096 px

def gray(name, kind):
    return Image.open(AC / f'{name}_1K-JPG' / f'{name}_1K-JPG_{kind}.jpg').convert('L')

def norm(im, sd):
    st = ImageStat.Stat(im); m, s = st.mean[0], max(st.stddev[0], 1)
    return im.point(lambda v: max(0, min(255, round(128 + (v - m) / s * sd))))

def seamless(im):
    # fondu avec la copie décalée d'une demi-case (ses bords sont le milieu de l'original) : opaque au centre, transparente aux bords
    n = im.width; sh = ImageChops.offset(im, n // 2, n // 2)
    m = Image.new('L', (n, n)); d = ImageDraw.Draw(m)
    for i in range(n // 2): d.rectangle((i, i, n - 1 - i, n - 1 - i), fill=round(255 * min(1, i / (n * 0.3))))
    return Image.composite(im, sh, m)

def main():
    g = gray(SRC['rayures'], 'Color').filter(ImageFilter.MaxFilter(3)).resize((512, 512), Image.LANCZOS).point(lambda v: min(255, v * 2))
    r = norm(gray(SRC['voile'], 'Color').resize((256, 256), Image.LANCZOS), 40)
    b = norm(gray(SRC['marbrure'], 'Roughness').resize((256, 256), Image.LANCZOS), 36)
    w = seamless(norm(Image.open(PH / BOIS / 'diff4k.jpg').convert('L').crop((0, 0, 450, 450)), 40)).resize((256, 512), Image.LANCZOS)
    im = Image.new('L', (1024, 512), 128)
    im.paste(g, (0, 0)); im.paste(r, (512, 0)); im.paste(b, (512, 256)); im.paste(w, (768, 0))
    OUT.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=70, method=6)
    (OUT / 'surface.webp').write_bytes(buf.getvalue()); print('surface.webp', len(buf.getvalue()) // 1024, 'Ko')
    # crédits (assets/tex/credits.json) : une entrée par source
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if not c['key'].startswith('arme-')]
    cr += [{'key': 'arme-' + k, 'asset': v, 'source': 'ambientCG', 'licence': 'CC0 1.0'} for k, v in SRC.items()]
    cr += [{'key': 'arme-bois', 'asset': BOIS, 'source': 'Poly Haven', 'licence': 'CC0 1.0'}]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

main()
