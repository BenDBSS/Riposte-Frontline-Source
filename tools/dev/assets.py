"""Liste des assets du jeu (docs/assets.md), produite à partir du code : prefabs du décor, props physiques, surfaces photo et
procédurales, atlas dessinés au chargement, ciels, HDRI, armes, accessoires. Tout le jeu est construit par le code (README,
« Direction artistique : tout en code ») ; seules les textures photo, les ciels et les HDRI viennent de fichiers (CC0).
build.py la refait à chaque construction : elle suit le code sans qu'on y pense. La description d'un asset est le commentaire
écrit juste au-dessus de sa définition (sa première phrase) ; les en-têtes de section « /* ---------- Titre ---------- */ »
regroupent les prefabs d'un fichier.
python3 tools/dev/assets.py : écrit docs/assets.md ; --check : code d'erreur si le fichier n'est pas à jour."""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'docs', 'assets.md')


def lire(f):
    return open(os.path.join(ROOT, f), encoding='utf-8').read().split('\n')


def cellule(s):
    return s.replace('|', '\\|').replace('\n', ' ').strip()


def phrase(txt, n=200):
    """Première phrase d'un commentaire, raccourcie au mot près"""
    t = re.sub(r'\s+', ' ', txt).strip()
    m = re.search(r'(?<=[a-zé\)\]0-9])\. ', t)
    if m and m.start() < n: t = t[:m.start() + 1]
    if len(t) > n: t = t[:n].rsplit(' ', 1)[0] + '...'
    return t


def commentaire(L, i):
    """Commentaire juste au-dessus de la ligne i (bloc /* */ ou lignes //), sans les en-têtes de section"""
    j = i - 1
    if j < 0: return ''
    if L[j].strip().startswith('//'):
        out = []
        while j >= 0 and L[j].strip().startswith('//'): out.insert(0, L[j].strip()[2:].strip()); j -= 1
        return ' '.join(out)
    if L[j].rstrip().endswith('*/'):
        out = []
        while j >= 0:
            out.insert(0, L[j]);
            if '/*' in L[j]: break
            j -= 1
        txt = ' '.join(re.sub(r'^\s*(/\*+|\*)?', '', l).replace('*/', '').strip() for l in out)
        if re.match(r'^-{3,}.*-{3,}$', txt.strip()) or txt.strip().startswith('='): return ''
        return txt.strip()
    return ''


def section(ligne):
    m = re.match(r'^/\* -{3,} (.+?) -{3,} \*/', ligne.strip())
    return m.group(1) if m else None


SRC = sorted(glob.glob(os.path.join(ROOT, 'src', '*.js')))
TXT = {os.path.basename(f): lire(os.path.relpath(f, ROOT)) for f in SRC}

# cartes : fichier de définition, nom, surfaces photo, ciel
NOMS = dict(re.findall(r"\{ id: '([a-z]+)', name: '([^']+)'", '\n'.join(TXT['02-map.js'])))
CARTES = {}
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r'^MAP_DEFS\.([a-z]+) = ', l)
        if not m: continue
        cid = m.group(1); bloc = '\n'.join(L[i:i + 120])
        tex = re.search(r"^\s+textures: \[([^\]]*)\]", bloc, re.M)
        sky = re.search(r"skyPhoto: \{ key: '([^']+)'", bloc)
        CARTES[cid] = {'nom': NOMS.get(cid, cid), 'fichier': f, 'tex': re.findall(r"'([^']+)'", tex.group(1)) if tex else [], 'ciel': sky.group(1) if sky else ''}
FICHIER_CARTE = {c['fichier']: c['nom'] for c in CARTES.values()}

# prefabs
PREFABS = []
for f, L in TXT.items():
    sec = None
    for i, l in enumerate(L):
        s = section(l)
        if s: sec = s
        m = re.match(r'^PF\.(\w+)\s*=\s*(?:\(((?:[^()]|\([^()]*\))*)\)|(\w+))\s*=>', l)  # un niveau de parenthèses dans les paramètres : (lit = litOn())
        if m: PREFABS.append({'nom': m.group(1), 'args': (m.group(2) if m.group(2) is not None else m.group(3) or '').strip(), 'fichier': f, 'section': sec, 'desc': phrase(commentaire(L, i)), 'ligne': i + 1})
appels = {}
for f, L in TXT.items():
    for i, l in enumerate(L):
        for n in re.findall(r'\bPF\.(\w+)\(', l):
            if re.match(r'^PF\.' + n + r'\s*=', l): continue
            appels.setdefault(n, set()).add(f)


def poses(n):
    fs = sorted(appels.get(n, ()))
    lab = [f"{f[:-3]} ({FICHIER_CARTE[f]})" if f in FICHIER_CARTE else f[:-3] for f in fs]
    return ', '.join(lab[:6]) + (f', et {len(lab) - 6} autres' if len(lab) > 6 else '')


# un même nom défini deux fois : les fichiers sont concaténés, la dernière définition remplace l'autre partout
DOUBLONS = {}
for p in PREFABS: DOUBLONS.setdefault(p['nom'], []).append(f"src/{p['fichier']}:{p['ligne']}")
DOUBLONS = {k: v for k, v in DOUBLONS.items() if len(v) > 1}

# props physiques
PROPS = []
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r"^propType\('(\w+)', \{(.*)", l)
        if not m: continue
        pf = re.search(r'pf: \(\) => PF\.(\w+)\(', l); masse = re.search(r'mass: ([\d.]+)', l); mat = re.search(r"snd: '(\w+)'", l)
        PROPS.append({'type': m.group(1), 'pf': pf.group(1) if pf else '', 'masse': masse.group(1) if masse else '', 'son': mat.group(1) if mat else '', 'desc': phrase(commentaire(L, i), 140), 'fichier': f})

# surfaces procédurales (générées sur le GPU au chargement) et atlas dessinés
PROC = []
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r'^  (\w+): \[(\d+), (\d+), ([\d.]+), `', l)
        if m: PROC.append({'cle': m.group(1), 'taille': m.group(2), 'desc': phrase(commentaire(L, i), 160), 'fichier': f})
ATLAS = []
for f, L in TXT.items():
    for i, l in enumerate(L):
        m = re.match(r'^function (\w+Atlas)\(', l)
        if m: ATLAS.append({'nom': m.group(1), 'desc': phrase(commentaire(L, i), 160), 'fichier': f})

# surfaces photo, ciels, HDRI
cred = {c['key']: c for c in json.load(open(os.path.join(ROOT, 'assets', 'tex', 'credits.json'), encoding='utf-8'))}
PHOTO = []
for d in sorted(glob.glob(os.path.join(ROOT, 'assets', 'tex', '*', ''))):
    k = os.path.basename(os.path.normpath(d)); c = cred.get(k, {})
    PHOTO.append({'cle': k, 'photo': c.get('asset', ''), 'source': c.get('source', ''), 'licence': c.get('licence', ''), 'cartes': ', '.join(v['nom'] for v in CARTES.values() if k in v['tex'])})
CIELS = sorted({os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'assets', 'sky', '*.webp')) if not f.endswith('_lo.webp')})
HDRI = sorted(os.path.splitext(os.path.basename(f))[0] for f in glob.glob(os.path.join(ROOT, 'assets', 'vendor', 'hdri', '*.exr')))

# armes et accessoires
un = lambda s: s.replace('\\u0027', "'").replace("\\'", "'")
ARMES = [{'id': m[0], 'nom': m[1], 'type': un(m[2])} for m in re.findall(r"^  \w+: \{ id: '(\w+)', name: '([^']+)', type: _t\('((?:[^'\\]|\\.)*)'\)", '\n'.join(TXT['06i-armes.js']), re.M)]
ACC = [{'id': m[0], 'slot': m[1], 'nom': un(m[2])} for m in re.findall(r"^  (\w+): \{ slot: '(\w+)', name: _t\('((?:[^'\\]|\\.)*)'\)", '\n'.join(TXT['06p-accessoires.js']), re.M)]

# document
o = ['# Liste des assets', '',
     'Produite à partir du code par `python3 tools/dev/assets.py`, que `build.py` lance à chaque construction : ne pas la modifier à la main. '
     'Tout le jeu est construit par le code (README, « Direction artistique : tout en code ») ; seules les textures photo, les ciels et les HDRI '
     'viennent de fichiers, tous en CC0. La description d\'un asset est le commentaire écrit au-dessus de sa définition : pour la changer, '
     'changer le commentaire.', '',
     f'{len(PREFABS)} prefabs, {len(PROPS)} props physiques, {len(PHOTO)} surfaces photo, {len(PROC)} surfaces procédurales, {len(ATLAS)} atlas dessinés '
     f'au chargement, {len(CIELS)} ciels photographiés, {len(HDRI)} HDRI, {len(ARMES)} armes, {len(ACC)} accessoires.', '']
if DOUBLONS:
    o += ['## À corriger', '', 'Prefabs définis deux fois : la dernière définition (ordre des fichiers) remplace l\'autre partout.', '']
    o += [f"- `PF.{k}` : " + ', '.join(f'`{x}`' for x in v) for k, v in DOUBLONS.items()] + ['']
o += ['## Cartes', '', '| Carte | Plan | Surfaces photo | Ciel |', '| --- | --- | --- | --- |']
for c in CARTES.values(): o.append(f"| {c['nom']} | `src/{c['fichier']}` | {', '.join(c['tex'])} | {c['ciel']} |")
o += ['', '## Prefabs du décor', '', 'Construits une fois en coordonnées locales (posés sur y = 0, face principale vers +z), estampillés par `DECOR.place` '
      '(`src/02a-kit.js`). « Posé dans » : les fichiers qui l\'appellent directement.']
for f in TXT:
    ps = [p for p in PREFABS if p['fichier'] == f]
    if not ps: continue
    o += ['', f'### `src/{f}`' + (f' ({FICHIER_CARTE[f]})' if f in FICHIER_CARTE else ''), '']
    sec = object()
    for p in ps:
        if p['section'] != sec:
            sec = p['section']
            if sec: o += [f'**{sec}**', '']
            o += ['| Prefab | Paramètres | Description | Posé dans |', '| --- | --- | --- | --- |']
        o.append(f"| `{p['nom']}` | {cellule(p['args'])} | {cellule(p['desc'])} | {cellule(poses(p['nom']))} |")
        nxt = ps[ps.index(p) + 1] if ps.index(p) + 1 < len(ps) else None
        if nxt and nxt['section'] != sec: o.append('')
o += ['', '## Props physiques', '', 'Objets qui tombent, roulent et volent en éclats (`propType`, README « Props physiques »).', '',
      '| Type | Prefab | Masse (kg) | Son | Fichier |', '| --- | --- | --- | --- | --- |']
for p in PROPS: o.append(f"| `{p['type']}` | `{p['pf']}` | {p['masse']} | {p['son']} | `src/{p['fichier']}` |")
o += ['', '## Surfaces photo', '', 'Photos CC0 ramenées à une plage commune (`tools/build_assets.py`), un fichier par surface à côté de la page, '
      'chargé au lancement de la carte qui la demande.', '', '| Surface | Photo | Source | Licence | Cartes |', '| --- | --- | --- | --- | --- |']
for p in PHOTO: o.append(f"| `{p['cle']}` | {p['photo']} | {p['source']} | {p['licence']} | {p['cartes']} |")
o += ['', '## Surfaces procédurales', '', 'Générées sur le GPU au chargement de la carte (`TEXLAB`) ; une surface photo de même nom les remplace.', '',
      '| Surface | Taille (px) | Description | Fichier |', '| --- | --- | --- | --- |']
for p in PROC: o.append(f"| `{p['cle']}` | {p['taille']} | {cellule(p['desc'])} | `src/{p['fichier']}` |")
o += ['', '## Atlas dessinés au chargement', '', '| Atlas | Description | Fichier |', '| --- | --- | --- |']
for p in ATLAS: o.append(f"| `{p['nom']}` | {cellule(p['desc'])} | `src/{p['fichier']}` |")
o += ['', '## Ciels et éclairage', '', 'Ciels photographiés (`assets/sky/`, moitié haute d\'un panorama Poly Haven, CC0) : ' + ', '.join(f'`{c}`' for c in CIELS) + '.', '',
      'HDRI d\'éclairage (`assets/vendor/hdri/`, Poly Haven, CC0) : ' + ', '.join(f'`{h}`' for h in HDRI) + '.']
o += ['', '## Armes', '', 'Modèles construits par le code (`src/06c-models.js`), statistiques dans `src/06i-armes.js`.', '', '| Arme | Nom | Catégorie |', '| --- | --- | --- |']
for a in ARMES: o.append(f"| `{a['id']}` | {a['nom']} | {a['type']} |")
o += ['', '## Accessoires', '', 'Catalogue `ATT` (`src/06p-accessoires.js`), modèles construits par le code.', '', '| Accessoire | Nom | Emplacement |', '| --- | --- | --- |']
for a in ACC: o.append(f"| `{a['id']}` | {a['nom']} | {a['slot']} |")
doc = '\n'.join(o) + '\n'

def ecrire():
    """Écrit docs/assets.md s'il a changé ; rend le résumé et les doublons (build.py les affiche)"""
    old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    if old != doc: open(OUT, 'w', encoding='utf-8').write(doc)
    return f'{len(PREFABS)} prefabs, {len(PROPS)} props, {len(PHOTO)} surfaces photo, {len(PROC)} procédurales, {len(ARMES)} armes, {len(ACC)} accessoires', DOUBLONS


if __name__ == '__main__':
    if '--check' in sys.argv:
        old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if old != doc: print('docs/assets.md n\'est pas à jour : python3 tools/dev/assets.py'); sys.exit(1)
        print('docs/assets.md à jour'); sys.exit(0)
    res, dbl = ecrire()
    print('docs/assets.md :', res)
    for k, v in dbl.items(): print(f'prefab défini deux fois : PF.{k} ({", ".join(v)})')
