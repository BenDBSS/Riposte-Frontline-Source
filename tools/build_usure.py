"""Construit assets/fx/usure.webp : la couche d'usure commune à toutes les matières du décor, tirée de textures CC0 d'ambientCG. build.py
la livre comme texture d'effet (dist/tex/fx_usure.<condensat>.js), chargée au lancement d'une carte ; le jeu la range dans les canaux de
la texture macro du décor (texLabMacro, src/02b-texlab.js), qui donnait jusqu'ici du bruit procédural.

Une image en niveaux de gris de 1536 x 512 (le WebP avec perte sous-échantillonne la couleur : des données rangées dans les canaux d'une
même image déteindraient l'une sur l'autre), trois cases de 512 x 512 raccordables :
  - grain de crasse (SurfaceImperfections017) : canal vert, variation de la couleur à moyenne échelle, poussière, bord de la neige ;
  - taches (SurfaceImperfections013) : canal bleu, auréoles et salissures sur la couleur et la rugosité, crasse des recoins ;
  - coulures (SurfaceImperfections003) : canal alpha, traînées verticales sur les murs et bandeau de crasse au pied.
Chaque case est ramenée à une moyenne de 128 et à l'écart type de la case (MOY, ECART), comme le bruit qu'elle remplace.

Sources (jpg 1K d'ambientcg.com) dans assets_src/ambientcg/<Nom>_1K-JPG/, dossier ignoré par git.
Lancer : python3 tools/build_usure.py (Pillow, numpy)."""
import io, json, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
AC = ROOT / 'assets_src' / 'ambientcg'
# (nom de la case, source, écart type visé sur 255)
CELLS = [('grain', 'SurfaceImperfections017', 34), ('taches', 'SurfaceImperfections013', 40), ('coulures', 'SurfaceImperfections003', 40)]
N = 512

def cell(name, sd):
    im = np.asarray(Image.open(AC / f'{name}_1K-JPG' / f'{name}_1K-JPG_Color.jpg').convert('L'), np.float32)
    # réduction raccordable : bordure recopiée de l'autre côté avant de réduire, puis recadrée
    p = 32; big = np.pad(im, p, mode='wrap'); k = N / im.shape[0]
    r = np.asarray(Image.fromarray(big).resize((round(big.shape[1] * k), round(big.shape[0] * k)), Image.LANCZOS), np.float32)
    q = round(p * k); r = r[q:q + N, q:q + N]
    r = 128 + (r - r.mean()) / max(r.std(), 1) * sd
    return np.clip(np.round(r), 0, 255).astype(np.uint8)

def main():
    out = np.concatenate([cell(src, sd) for _, src, sd in CELLS], axis=1)
    d = ROOT / 'assets' / 'fx'; d.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO(); Image.fromarray(out).save(buf, 'WEBP', quality=72, method=6)
    (d / 'usure.webp').write_bytes(buf.getvalue()); print('usure.webp', len(buf.getvalue()) // 1024, 'Ko')
    cp = ROOT / 'assets' / 'tex' / 'credits.json'
    cr = [c for c in json.loads(cp.read_text(encoding='utf-8')) if not c['key'].startswith('usure-')]
    cr += [{'key': 'usure-' + k, 'asset': v, 'source': 'ambientCG', 'licence': 'CC0 1.0'} for k, v, _ in CELLS]
    cp.write_text(json.dumps(cr, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')

main()
