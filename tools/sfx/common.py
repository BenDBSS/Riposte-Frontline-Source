"""Outils communs de préparation des sons (voir tools/build_sfx.py).

Chaque famille (tools/sfx/<famille>.py) décrit ses sources (SOURCES : licence, auteur, adresse), les fichiers qu'elle
utilise (FILES : chemin local sous assets_src/sfx/src → adresse de téléchargement) et une fonction build() qui fabrique
les « masters » : un WAV 48 kHz par son, sous assets_src/sfx/masters/<paquet>/<id>.wav (assets_src/ n'est pas versionné).
build_sfx.py encode ensuite les masters en MP3 dans assets/sfx/<paquet>/ (versionné) et rassemble les crédits.

Conventions des masters :
- 48 kHz, mono sauf indication (lits d'ambiance et réponses impulsionnelles en stéréo) ;
- un son par fichier, variantes numérotées : <id>-1.wav, <id>-2.wav... (le jeu tire une variante au hasard) ;
- début net (pas de silence en tête, 2 ms de fondu d'entrée au plus pour un transitoire), fondu de sortie, pas de clic ;
- transitoires (tirs, impacts, maniement, interface, pas) normalisés en crête à -1 dBFS : le dosage se fait dans le jeu ;
- boucles (lits, rotor, moteurs, eau) : bouclables à l'échantillon près (la fin enchaîne sur le début, fondu croisé fait ici) ;
- lits d'ambiance : niveau efficace vers -20 dBFS, crête sous -3 dBFS.
Les fichiers téléchargés ne sont jamais exécutés : on ne fait que les décoder (ffmpeg)."""
import json, os, pathlib, subprocess, urllib.request
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SRC = ROOT / 'assets_src' / 'sfx' / 'src'          # sources téléchargées
MASTERS = ROOT / 'assets_src' / 'sfx' / 'masters'  # masters fabriqués par les familles
SR = 48000


def fetch(rel, url):
    """Télécharge url dans assets_src/sfx/src/rel s'il manque ; renvoie le chemin local."""
    p = SRC / rel
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'riposte-frontline-sfx'})
        with urllib.request.urlopen(req, timeout=120) as r, open(p, 'wb') as f:
            f.write(r.read())
    return p


def fetch_all(files):
    """files : {chemin relatif : adresse}"""
    for rel, url in files.items():
        fetch(rel, url)


def load(path, sr=SR, mono=True, start=None, dur=None):
    """Décode n'importe quel fichier audio (ffmpeg) en float64 : tableau (n,) en mono, (n, 2) en stéréo."""
    cmd = ['ffmpeg', '-v', 'error']
    if start is not None: cmd += ['-ss', str(start)]
    if dur is not None: cmd += ['-t', str(dur)]
    cmd += ['-i', str(path), '-ac', '1' if mono else '2', '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return x if mono else x.reshape(-1, 2)


def ff(x, af, sr=SR):
    """Passe un signal dans une chaîne de filtres ffmpeg (-af), même fréquence et mêmes canaux en sortie."""
    ch = 1 if x.ndim == 1 else x.shape[1]
    cmd = ['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', '-af', af, '-ar', str(sr), '-ac', str(ch), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, check=True, input=x.astype(np.float32).tobytes(), capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return y if ch == 1 else y.reshape(-1, ch)


def db(v):
    return 20 * np.log10(max(float(v), 1e-12))


def peak(x):
    return float(np.max(np.abs(x))) if len(x) else 0.0


def norm(x, dbfs=-1.0):
    """Normalise en crête à dbfs."""
    p = peak(x)
    return x * (10 ** (dbfs / 20) / p) if p > 0 else x


def norm_rms(x, dbfs=-20.0, ceil=-3.0):
    """Niveau efficace visé, crête plafonnée."""
    r = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0
    if r <= 0: return x
    y = x * (10 ** (dbfs / 20) / r)
    p = peak(y)
    return y * (10 ** (ceil / 20) / p) if p > 10 ** (ceil / 20) else y


def onset(x, thr_db=-50.0):
    """Indice du premier échantillon au-dessus de thr_db sous la crête."""
    m = np.abs(x if x.ndim == 1 else x.max(axis=1))
    k = np.nonzero(m > peak(m) * 10 ** (thr_db / 20))[0]
    return int(k[0]) if len(k) else 0


def trim(x, thr_db=-50.0, pre=0.0):
    """Coupe le silence de tête (pre : secondes gardées avant l'attaque)."""
    i = max(0, onset(x, thr_db) - int(pre * SR))
    return x[i:]


def tail_end(x, thr_db=-60.0):
    """Indice de fin : dernier échantillon au-dessus de thr_db sous la crête."""
    m = np.abs(x if x.ndim == 1 else x.max(axis=1))
    k = np.nonzero(m > peak(m) * 10 ** (thr_db / 20))[0]
    return int(k[-1]) + 1 if len(k) else len(x)


def fade(x, fin=0.002, fout=0.05, curve=2.0):
    """Fondus d'entrée et de sortie (secondes) ; la sortie suit une courbe (1 - u)^curve."""
    y = x.copy(); n = len(y)
    a = min(n, int(fin * SR)); b = min(n, int(fout * SR))
    if a > 0:
        r = np.linspace(0, 1, a, endpoint=False)
        y[:a] = (y[:a].T * r).T
    if b > 0:
        r = (1 - np.linspace(0, 1, b)) ** curve
        y[n - b:] = (y[n - b:].T * r).T
    return y


def cut(x, dur, fout=0.08):
    """Garde dur secondes avec un fondu de sortie."""
    return fade(x[:int(dur * SR)], 0, fout)


def loopify(x, xf=0.5):
    """Rend un signal bouclable : les xf dernières secondes passent en fondu croisé (puissance constante) sur le début.
    Le résultat dure len(x) - xf ; sa fin enchaîne sans rupture sur son premier échantillon."""
    n = int(xf * SR)
    if n <= 0 or n * 2 >= len(x): return x
    body = x[:len(x) - n].copy()
    t = np.linspace(0, 1, n, endpoint=False)
    a, b = np.cos(t * np.pi / 2), np.sin(t * np.pi / 2)
    head = x[:n]; tail = x[len(x) - n:]
    body[:n] = (tail.T * a).T + (head.T * b).T
    return body


def mix(*layers):
    """Somme de couches (signal, décalage en s, gain) de longueurs différentes."""
    n = max(int(off * SR) + len(s) for s, off, g in layers)
    shape = (n,) if layers[0][0].ndim == 1 else (n, layers[0][0].shape[1])
    out = np.zeros(shape)
    for s, off, g in layers:
        i = int(off * SR); out[i:i + len(s)] += s * g
    return out


def stereo(x):
    return x if x.ndim == 2 else np.stack([x, x], axis=1)


def save_master(pack, sid, x, sr=SR):
    """Écrit assets_src/sfx/masters/<pack>/<sid>.wav (PCM 24 bits). Refuse un signal vide ou écrêté."""
    if not len(x): raise ValueError(f'{pack}/{sid} : signal vide')
    if peak(x) > 1.0001: raise ValueError(f'{pack}/{sid} : crête {db(peak(x)):.2f} dBFS au-dessus de 0')
    d = MASTERS / pack; d.mkdir(parents=True, exist_ok=True)
    ch = 1 if x.ndim == 1 else x.shape[1]
    p = d / f'{sid}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', str(ch), '-i', '-', '-c:a', 'pcm_s24le', str(p)],
                   check=True, input=np.clip(x, -1, 1).astype(np.float32).tobytes())
    return p


def credit(sid, pack, source, fichier, detail=''):
    """Entrée de crédit d'un master : source = clé de SOURCES de la famille."""
    return {'id': sid, 'pack': pack, 'source': source, 'fichier': fichier, 'detail': detail}


def write_credits(famille, entries):
    """assets_src/sfx/masters/credits-<famille>.json (rassemblé par build_sfx.py)"""
    MASTERS.mkdir(parents=True, exist_ok=True)
    (MASTERS / f'credits-{famille}.json').write_text(json.dumps(entries, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
