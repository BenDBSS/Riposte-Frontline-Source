"""Construit assets/sfx/ : les sons du jeu, enregistrements libres de droits (CC0 pour l'essentiel, quelques CC BY) préparés
et ré-encodés en MP3 courts, un dossier par paquet (assets/sfx/<paquet>/<id>.mp3, plus meta.json), et la liste des crédits
(assets/sfx/credits.json). build.py fait de chaque paquet un fichier à côté de la page (dist/sfx/<paquet>.<condensat>.js),
que le jeu charge au démarrage du son (paquets communs) ou au lancement d'une carte (ambiance de la carte).

Étapes (depuis la racine) :
  python3 tools/build_sfx.py --fetch      télécharge les sources manquantes dans assets_src/sfx/src (GitHub surtout)
  python3 tools/build_sfx.py --build      fabrique les masters (assets_src/sfx/masters, WAV 48 kHz) famille par famille
  python3 tools/build_sfx.py              encode les masters en MP3 dans assets/sfx et écrit les crédits
Options : --famille armes,impacts (limite --fetch et --build à ces familles), --paquet ui (limite l'encodage ; les crédits
          des autres paquets restent ceux de assets/sfx/credits.json).
  python3 tools/build_sfx.py --voix       voix radio seules (paquets voix_en et voix_fr) : génère les répliques manquantes ou
                                          changées (Chatterbox, voir tools/sfx/series.py), les traite, les encode et met à
                                          jour leurs crédits dans assets/sfx/credits.json ; les autres sons ne bougent pas.
Les familles sont les modules tools/sfx/<famille>.py (SOURCES, FILES, build()) ; conventions des masters : tools/sfx/common.py.

meta.json donne la fréquence des MP3 du paquet (rate) et, pour chaque son (s), sa durée en échantillons à 48 kHz (n) et l'indice de sa crête (pk) : le jeu s'en sert
pour retrouver le début exact du son après décodage (le décodeur MP3 de certains navigateurs laisse le délai de l'encodeur
en tête) et pour boucler à l'échantillon près."""
import argparse, importlib, json, pathlib, subprocess, sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools' / 'sfx'))
import common  # noqa: E402

FAMILLES = ['armes', 'maniement', 'impacts', 'series', 'ambiances', 'interface', 'mecha']
OUT = ROOT / 'assets' / 'sfx'

# Encodage par paquet : (fréquence du MP3, qualité VBR de LAME : 0 meilleure, 9 plus légère). Les masters restent à 48 kHz ;
# le jeu décode à la fréquence de son contexte audio.
ENC = {
    'armes': (48000, 3), 'impacts': (48000, 5), 'foley': (48000, 5), 'ui': (48000, 5), 'series': (44100, 5), 'mecha': (44100, 5),
    'voix_fr': (24000, 6), 'voix_en': (24000, 6),
}
ENC_AMB = (32000, 6)  # paquets d'ambiance des cartes (amb_<carte>)


def enc_of(pack):
    return ENC.get(pack, ENC_AMB if pack.startswith('amb_') else (48000, 5))


def encode(src, dst, rate, q):
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-map_metadata', '-1', '-ar', str(rate),
                    '-c:a', 'libmp3lame', '-q:a', str(q), '-write_xing', '1', str(dst)], check=True)


def meta_of(path):
    x = common.load(path, mono=True)
    head = np.abs(x[:min(len(x), 2 * common.SR)])
    return [int(len(x)), int(np.argmax(head)) if len(head) else 0]


def encode_pack(pack, garder=False):
    """Encode les masters d'un paquet en MP3 (assets/sfx/<paquet>/, meta.json) ; renvoie (nombre de sons, octets). garder : les sons
    déjà livrés dont le master manque restent tels quels (MP3 et meta.json), au lieu d'être supprimés"""
    rate, q = enc_of(pack); meta = {}; size = 0
    d = OUT / pack; d.mkdir(parents=True, exist_ok=True)
    wavs = sorted((common.MASTERS / pack).glob('*.wav'))
    keep = {w.stem for w in wavs}
    old_meta = json.loads((d / 'meta.json').read_text(encoding='utf-8'))['s'] if garder and (d / 'meta.json').exists() else {}
    for old in d.glob('*.mp3'):
        if old.stem in keep: continue
        if old.stem in old_meta: meta[old.stem] = old_meta[old.stem]; size += old.stat().st_size
        else: old.unlink()
    for w in wavs:
        mp3 = d / (w.stem + '.mp3')
        encode(w, mp3, rate, q); meta[w.stem] = meta_of(w); size += mp3.stat().st_size
    meta = dict(sorted(meta.items()))
    (d / 'meta.json').write_text(json.dumps({'rate': rate, 's': meta}, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{pack:12s} {len(meta):4d} sons {size // 1024:6d} Ko  ({rate} Hz, V{q})')
    return len(wavs), size


def voix_seules():
    """--voix : les deux paquets de voix, et leurs crédits remplacés dans credits.json (le reste du fichier gardé tel quel)"""
    series = importlib.import_module('series')
    series.ENTREES.clear(); series.voix()
    for pack in ('voix_en', 'voix_fr'): encode_pack(pack, series.NOUVELLES)
    f = OUT / 'credits.json'
    cur = json.loads(f.read_text(encoding='utf-8'))
    at = next((i for i, e in enumerate(cur['sons']) if e['pack'].startswith('voix_')), len(cur['sons']))  # à la place des anciennes
    autres = [e for e in cur['sons'] if not e['pack'].startswith('voix_')]
    neuves = {(e['pack'], e['id']) for e in series.ENTREES}
    gardees = [e for e in cur['sons'] if series.NOUVELLES and e['pack'].startswith('voix_') and (e['pack'], e['id']) not in neuves]  # VOIX_NOUVELLES
    sons = autres[:at] + gardees + list(series.ENTREES) + autres[at:]
    used = {e['source'] for e in sons}
    sources = {k: v for k, v in cur['sources'].items() if k in used}
    for k in {e['source'] for e in series.ENTREES} | (used - set(sources)):   # celles des voix toujours relues dans SOURCES
        if k not in series.SOURCES: raise SystemExit('crédits : source non décrite dans SOURCES : ' + k)
        sources[k] = series.SOURCES[k]
    f.write_text(json.dumps({'sources': dict(sorted(sources.items())), 'sons': sons}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('crédits :', len(sons), 'sons,', len(sources), 'sources')


def credits_paquets(packs):
    """--paquet : les crédits des seuls paquets réencodés sont remplacés dans credits.json (ceux des autres paquets gardés tels quels :
    leurs masters peuvent manquer sur cette machine)"""
    f = OUT / 'credits.json'
    cur = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {'sources': {}, 'sons': []}
    neuf, sources = [], dict(cur['sources'])
    for fam in FAMILLES:
        p = common.MASTERS / f'credits-{fam}.json'
        if p.exists(): neuf += [e for e in json.loads(p.read_text(encoding='utf-8')) if e['pack'] in packs]
        if (ROOT / 'tools' / 'sfx' / f'{fam}.py').exists(): sources.update(getattr(importlib.import_module(fam), 'SOURCES', {}))
    sons = [e for e in cur['sons'] if e['pack'] not in packs] + neuf
    used = sorted({e['source'] for e in sons})
    missing = [k for k in used if k not in sources]
    if missing: raise SystemExit('crédits : sources non décrites dans SOURCES : ' + ', '.join(missing))
    f.write_text(json.dumps({'sources': {k: sources[k] for k in used}, 'sons': sons}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('crédits :', len(sons), 'sons,', len(used), 'sources (paquets remplacés : ' + ', '.join(sorted(packs)) + ')')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--fetch', action='store_true'); ap.add_argument('--build', action='store_true'); ap.add_argument('--voix', action='store_true')
    ap.add_argument('--famille', default=''); ap.add_argument('--paquet', default='')
    a = ap.parse_args()
    if a.voix: voix_seules(); return
    fams = [f for f in (a.famille.split(',') if a.famille else FAMILLES) if f]
    mods = {f: importlib.import_module(f) for f in fams if (ROOT / 'tools' / 'sfx' / f'{f}.py').exists()}
    if a.fetch:
        for f, m in mods.items():
            print('téléchargement :', f); common.fetch_all(getattr(m, 'FILES', {}))
        return
    if a.build:
        for f, m in mods.items():
            print('masters :', f); m.build()
        return
    # encodage des masters
    packs = sorted(p.name for p in common.MASTERS.iterdir() if p.is_dir()) if common.MASTERS.exists() else []
    if a.paquet: packs = [p for p in packs if p in a.paquet.split(',')]
    total = 0
    for pack in packs:
        total += encode_pack(pack)[1]
    print('total', total // 1024, 'Ko')
    if a.paquet: credits_paquets(set(packs)); return
    # crédits : fichiers credits-<famille>.json écrits par build() + SOURCES de chaque famille
    entries, sources = [], {}
    for f in FAMILLES:
        p = common.MASTERS / f'credits-{f}.json'
        if p.exists(): entries += json.loads(p.read_text(encoding='utf-8'))
        m = mods.get(f) or (importlib.import_module(f) if (ROOT / 'tools' / 'sfx' / f'{f}.py').exists() else None)
        if m: sources.update(getattr(m, 'SOURCES', {}))
    used = sorted({e['source'] for e in entries})
    missing = [s for s in used if s not in sources]
    if missing: raise SystemExit('crédits : sources non décrites dans SOURCES : ' + ', '.join(missing))
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'credits.json').write_text(json.dumps({'sources': {k: sources[k] for k in used}, 'sons': entries}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('crédits :', len(entries), 'sons,', len(used), 'sources')
    for k in used:
        lic = sources[k].get('licence', '')
        if 'CC0' not in lic and 'domaine public' not in lic.lower(): print('  attribution requise :', k, '|', lic, '|', sources[k].get('auteur', ''))


if __name__ == '__main__':
    main()
