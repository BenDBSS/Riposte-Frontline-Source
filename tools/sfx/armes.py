"""Famille « armes » : tirs du joueur et des autres tireurs, tirs lointains, tirs silencieux et réponses impulsionnelles
de la réverbération générale du jeu (paquet armes).

Sources : pistes brutes « Master Tracks » de The Free Firearm Sound Library (CC0, 192 kHz/24 bits stéréo, champ de tir
en extérieur), une piste par position de micro :
- « behind shooter » (couple coïncident derrière le tireur) : tirs du joueur (pov), somme des deux canaux ;
- « near distance, front of shooter » (couple espacé, devant le tireur) : tirs d'un ennemi proche (near), un seul canal
  pour éviter le filtrage en peigne de la somme ;
- « far distance, front of shooter » : tirs lointains (far), un seul canal (claquement de la balle puis détonation).
Les « Prepared SFX » near du même dépôt sont ces mêmes prises montées de 20 dB et écrêtées sur la détonation (plateaux
d'écrêtage, plancher remonté) : on part des pistes brutes et on fait l'équivalent ici, avec un limiteur.
Réponses impulsionnelles : Conner's Impulse Response Library (licence MIT, notice à garder : voir SOURCES).

Armes du jeu sans prise réelle (FAMAS, MP7, UMP-45, Vector, Barrett, AA-12, Glock, Desert Eagle) : prises voisines de
la FFSL, transposées (rééchantillonnage depuis la piste à 192 kHz), queue raccourcie, couche grave plus forte pour les
gros calibres ; le tir silencieux de carabine reçoit la culasse d'un AR-15 : aucun son n'est synthétisé.

Chaîne d'un tir du joueur : passe-haut 45 Hz, plateau de bas, couche grave tirée du même tir (transposé d'une octave
plus bas, passe-bas, gardé 50 à 140 ms : le « punch »), limiteur à anticipation qui rabote la pointe de l'attaque de
6 dB, compression parallèle limitée aux 150 premières ms (le corps du tir, que le jeu fait entendre en rafale),
saturation douce suréchantillonnée, queue extérieure gardée (passe-haut 80 Hz contre le souffle du vent, échos secs du
stand adoucis), fin coupée sous -75 dB ou fondu, crête à -1 dBFS. Les instants des tirs viennent de l'analyse des
pistes (enveloppe par canal et spectrogramme)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PAQ = 'armes'

SOURCES = {
    'ffsl_tirs': {
        'nom': 'The Free Firearm Sound Library (pistes « Master Tracks » de tir)',
        'auteur': 'Ben Jaszczak et al. (Still North Media)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary',
        'preuve': "LICENSE du dépôt : texte intégral « CC0 1.0 Universal » ; page OpenGameArt : « The team holds CC0 "
                  "NO RIGHTS RESERVED for this library, and it may be used without royalty or credit for any "
                  "application, personal or professional »",
    },
    'conner_ir': {
        'nom': "Conner's Impulse Response Library (réponses impulsionnelles)",
        'auteur': 'Conner (itsmusician)',
        'licence': 'MIT',
        'url': 'https://github.com/itsmusician/IR-Library',
        'preuve': "README : « A public library of impulse responses for anyone to use freely under the MIT License » ; "
                  "License.md : « Copyright (c) 2022 Conner », texte MIT complet",
        'attribution': "Réponses impulsionnelles : Conner's Impulse Response Library "
                       "(https://github.com/itsmusician/IR-Library), Copyright (c) 2022 Conner, licence MIT",
        'notice': (
            "Copyright (c) 2022 Conner\n\nPermission is hereby granted, free of charge, to any person obtaining a "
            "copy of this software and associated documentation files (the \"Software\"), to deal in the Software "
            "without restriction, including without limitation the rights to use, copy, modify, merge, publish, "
            "distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the "
            "Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice "
            "and this permission notice shall be included in all copies or substantial portions of the "
            "Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, "
            "INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE "
            "AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, "
            "DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT "
            "OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
        ),
    },
}

# ---------------------------------------------------------------------------------------------------------------------
# Fichiers sources : chemin local sous assets_src/sfx/src -> adresse de téléchargement direct.
FILES = {}
FFSL = 'buddingmonkey/FreeFirearmsSFXLibrary'


def _url(depot, branche, chemin):
    return f'https://raw.githubusercontent.com/{depot}/{branche}/' + urllib.parse.quote(chemin)


def _ffsl(code):            # 'AR-15/D_27' -> ffsl/AR-15/D_27.wav (même dossier que la famille maniement)
    rel = f'ffsl/{code}.wav'
    FILES[rel] = _url(FFSL, 'main', f'Master Tracks/{code}.wav')
    return rel


def _ir(chemin):            # chemin dans le dépôt IR-Library
    rel = f'conner-ir/{chemin}'
    FILES[rel] = _url('itsmusician/IR-Library', 'main', chemin)
    return rel


# Dossiers de la FFSL
AR, AK, M17, M45, PPSH = 'AR-15', 'AK-47', '1917', 'Carl Gustav M45_Swedish K', 'PPSh'
MOS, TIK, NOVA, DALY, M12 = 'Mosin Nagant', 'Tikka', 'Nova', 'Charles Daly', 'Model 12'
MOSS, PPQ, BERSA, COLT, SW = 'Mossberg', 'Walther PPQ', 'Bersa', '1911', 'Smith & Wesson 642'
SAV = 'Savage 10 .300 Blackout'

# ---------------------------------------------------------------------------------------------------------------------
# Prises : (piste FFSL, instant de l'attaque en s, canal). Canal None : somme G+D (couple coïncident « behind
# shooter ») ; 0 (gauche) ou 1 (droite) : un seul canal, celui au plancher le plus bas.
# Banques : réglages du tir du joueur (pov) et de l'ennemi proche (near) ; st : transposition en demi-tons, une valeur
# par variante ; duree : durée maximale (s) ; queue : (début, constante de temps) d'un raccourcissement exponentiel
# de la queue (absent : queue naturelle) ; graves : (fréquence, gain dB) du plateau de bas ; aigus : idem en haut ;
# hp : passe-haut (Hz) ; grave : niveau (dB) de la couche grave (grave_f : sa coupure en Hz et sa fenêtre en s) ;
# lim : dB rabotés sur la pointe ; corps : niveau (dB) de la compression parallèle.
BANQUES = {
    # M4A1 : AR-15 5,56
    'rifle': dict(
        pov=[(AR + '/D_29', 0.633, None), (AR + '/D_27', 0.503, None), (AR + '/D_27', 10.163, None)],
        near=[(AR + '/D_32', 0.704, 1), (AR + '/D_31', 7.173, 1)],
        st=[0, 0.2, -0.2], graves=(115, 3), grave=-22, lim=6, corps=-16, duree=1.6),
    # FAMAS : les autres prises de l'AR-15, plus sèches et plus aiguës
    'famas': dict(
        pov=[(AR + '/D_29', 5.577, None), (AR + '/D_27', 4.787, None), (AR + '/D_27', 0.503, None)],
        near=[(AR + '/D_32', 5.647, 1), (AR + '/D_31', 12.548, 0)],
        st=[1.2, 1.6, 2.0], graves=(130, 2), aigus=(4500, 2), grave=-25, lim=6, corps=-16, duree=1.2,
        queue=(0.16, 0.30)),
    # AK-47 : AK-47 7,62x39
    'ak': dict(
        pov=[(AK + '/C_42', 0.727, None), (AK + '/C_39', 0.538, None), (AK + '/C_42', 6.787, None)],
        near=[(AK + '/C_28', 1.090, 0), (AK + '/C_28', 7.149, 1)],
        st=[0, -0.2, 0.2], graves=(110, 3), grave=-21, lim=6, corps=-16, duree=1.6),
    # SCAR-H 7,62x51 : Springfield 1917 .30-06, plus lourd
    'battle': dict(
        pov=[(M17 + '/B_18', 2.421, None), (M17 + '/B_17', 1.492, None), (M17 + '/B_18', 8.919, None)],
        near=[(M17 + '/B_24', 1.308, 1), (M17 + '/B_24', 6.731, 0)],
        st=[-0.3, -0.5, -0.1], graves=(100, 4), grave=-28, lim=6, corps=-16, duree=1.6),
    # MP5 : Carl Gustav M45 9 mm
    'smg': dict(
        pov=[(M45 + '/G_26', 0.280, None), (M45 + '/G_26', 3.069, None), (M45 + '/G_26', 6.921, None)],
        near=[(M45 + '/G_31', 0.310, 0), (M45 + '/G_31', 3.501, 1)],
        st=[0, 0.2, -0.2], graves=(120, 3), grave=-18, lim=6, corps=-16, duree=1.3, queue=(0.22, 0.5)),
    # MP7 : M45 transposé vers l'aigu, très sec
    'mp7': dict(
        pov=[(M45 + '/G_32', 0.306, None), (M45 + '/G_32', 3.497, None), (M45 + '/G_32', 6.724, None)],
        near=[(M45 + '/G_25', 0.190, 1), (M45 + '/G_25', 2.980, 0)],
        st=[2.0, 2.3, 1.7], hp=70, graves=(140, 1), aigus=(5000, 2), grave=-20, lim=6, corps=-16, duree=0.9,
        queue=(0.12, 0.20)),
    # UMP-45 : PPSh, un peu plus grave et plus lourd
    'smg45': dict(
        pov=[(PPSH + '/P_31', 0.692, None), (PPSH + '/P_31', 4.110, None), (PPSH + '/P_25', 1.600, None)],
        near=[(PPSH + '/P_30', 0.969, 0), (PPSH + '/P_30', 4.387, 1)],
        st=[-1.0, -1.2, -0.8], hp=60, graves=(105, 3), grave=-17, lim=6, corps=-16, duree=1.3, queue=(0.22, 0.5)),
    # Vector .45 : variante plus serrée de smg45
    'vector': dict(
        pov=[(PPSH + '/P_25', 5.190, None), (PPSH + '/P_31', 7.965, None), (PPSH + '/P_25', 12.274, None)],
        near=[(PPSH + '/P_30', 8.243, 0), (PPSH + '/P_30', 11.421, 1)],
        st=[-0.6, -0.4, -0.8], hp=60, graves=(110, 3), grave=-24, lim=6, corps=-16, duree=1.0, queue=(0.12, 0.25)),
    # Dragunov SVD 7,62x54R : Mosin-Nagant
    'dmr': dict(
        pov=[(MOS + '/M_22', 1.181, None), (MOS + '/M_20', 1.838, None), (MOS + '/M_22', 16.175, None)],
        near=[(MOS + '/M_21', 1.034, 0), (MOS + '/M_21', 16.028, 1)],
        st=[0, -0.2, 0.2], graves=(105, 3), grave=-20, lim=6, corps=-16, duree=1.6),
    # L96A1 : Tikka T3 .30-06
    'sniper': dict(
        pov=[(TIK + '/W_28', 0.727, None), (TIK + '/W_28', 11.683, None), (TIK + '/W_26', 0.855, None)],
        near=[(TIK + '/W_29', 0.577, 1), (TIK + '/W_29', 11.533, 0)],
        st=[0, -0.2, 0.1], graves=(100, 3), grave=-28, lim=6, corps=-17, duree=1.6),
    # Barrett M82 .50 : Mosin-Nagant transposé vers le grave, couche grave, longue queue
    'sniper50': dict(
        pov=[(MOS + '/M_22', 8.256, None), (MOS + '/M_20', 10.609, None), (MOS + '/M_22', 31.658, None)],
        near=[(MOS + '/M_21', 8.108, 0), (MOS + '/M_21', 31.510, 1)],
        st=[-3.5, -3.2, -3.8], hp=35, graves=(80, 3), grave=-14, grave_f=(140, 0.12, 0.35), lim=7, corps=-15,
        duree=2.4),
    # M1014 / 870 : Benelli Nova et Charles Daly cal. 12
    'shotgun': dict(
        pov=[(NOVA + '/O_18', 1.481, None), (NOVA + '/O_18', 21.605, None), (DALY + '/H_18', 5.904, None)],
        near=[(NOVA + '/O_21', 17.542, 0), (DALY + '/H_21', 0.464, 1)],
        st=[0, -0.2, 0], graves=(95, 4), grave=-19, lim=6, corps=-16, duree=1.6),
    # AA-12 : Winchester Model 12 et Mossberg 190, queue plus courte
    'aa12': dict(
        pov=[(M12 + '/K_19', 0.564, None), (M12 + '/K_19', 7.920, None), (MOSS + '/N_27', 1.392, None)],
        near=[(M12 + '/K_22', 0.842, 0), (M12 + '/K_22', 7.445, 1)],
        st=[0.3, 0.5, 0.2], graves=(100, 3), grave=-21, lim=6, corps=-16, duree=1.0, queue=(0.16, 0.30)),
    # M9 : Walther PPQ 9 mm
    'pistol': dict(
        pov=[(PPQ + '/X_40', 1.756, None), (PPQ + '/X_38', 0.914, None), (PPQ + '/X_40', 5.656, None)],
        near=[(PPQ + '/X_39', 1.407, 1), (PPQ + '/X_39', 10.660, 0)],
        st=[0, 0.2, -0.2], graves=(130, 3), grave=-20, lim=6, corps=-16, duree=1.4),
    # Glock 18 : Bersa .380, plus sec, queue plus courte
    'glock': dict(
        pov=[(BERSA + '/F_45', 0.480, None), (BERSA + '/F_44', 5.971, None), (BERSA + '/F_45', 4.555, None)],
        near=[(BERSA + '/F_47', 0.334, 1), (BERSA + '/F_47', 4.410, 0)],
        st=[0, 0.2, -0.2], graves=(140, 2), grave=-24, lim=6, corps=-16, duree=0.9, queue=(0.12, 0.25)),
    # USP .45 : 1911 .45 ACP
    'pistol45': dict(
        pov=[(COLT + '/A_36', 1.237, None), (COLT + '/A_35', 1.545, None), (COLT + '/A_35', 5.456, None)],
        near=[(COLT + '/A_42', 0.941, 1), (COLT + '/A_41', 5.056, 1)],
        st=[0, -0.2, 0.2], graves=(115, 3), grave=-25, lim=6, corps=-16, duree=1.4),
    # Desert Eagle .50 AE : revolver S&W 642 .38 transposé vers le grave, couche grave
    'pistol50': dict(
        pov=[(SW + '/V_26', 0.743, None), (SW + '/V_24', 0.818, None), (SW + '/V_26', 6.157, None)],
        near=[(SW + '/V_27', 0.805, 0), (SW + '/V_27', 6.219, 0)],
        st=[-2.5, -2.8, -2.2], hp=40, graves=(90, 3), grave=-16, grave_f=(150, 0.08, 0.25), lim=7, corps=-15,
        duree=1.6),
}

# Tirs lointains par classe : (piste, instant, canal), 2 variantes, 2,4 s au plus
LOIN = {
    'rifle': [(AR + '/D_25', 0.745, 0), (AR + '/D_26', 0.417, 1)],
    'smg': [(M45 + '/G_13', 11.940, 0), (PPSH + '/P_12', 1.273, 0)],
    'sniper': [(TIK + '/W_25', 0.710, 0), (MOS + '/M_23', 0.976, 0)],
    'shotgun': [(NOVA + '/O_15', 1.092, 1), (NOVA + '/O_15', 7.417, 0)],
    'pistol': [(COLT + '/A_40', 0.985, 1), (PPQ + '/X_33', 0.932, 0)],
}

# Tirs silencieux : (piste, instant, canal)
SIL = {
    'g_sup_pistol_pov': [(PPQ + '/X_42', 4.958, None), (PPQ + '/X_42', 9.528, None), (PPQ + '/X_46', 0.981, None)],
    'g_sup_rifle_pov': [(SAV + '/T_28', 0.685, 1), (SAV + '/T_28', 3.507, 1), (SAV + '/T_30', 0.754, 1)],
    'g_sup_near': [(SAV + '/T_29', 0.628, 1), (PPQ + '/X_43', 10.369, 1)],
    'g_sup_far': [(SAV + '/T_21', 1.243, 0), (PPQ + '/X_35', 6.976, 0)],
}

CULASSE_AR = _ffsl(AR + '/D_13')  # culasse d'AR-15 relâchée (mécanique du tir silencieux)
IR_OUT = _ir('Outdoors/Commercial/Loading Docks/Flat Loading Dock.wav')
IR_IN = _ir('Rooms/Commercial/Parking Garages/Firenze Parking Garage.wav')

for _b in BANQUES.values():
    for _p in _b['pov'] + _b['near']: _ffsl(_p[0])
for _l in list(LOIN.values()) + list(SIL.values()):
    for _p in _l: _ffsl(_p[0])


# ---------------------------------------------------------------------------------------------------------------------
# Outils de traitement

def dbg(d):
    return 10 ** (d / 20)


def af(x, *filtres):
    """Chaîne de filtres ffmpeg (les éléments vides sont ignorés)."""
    ch = ','.join(f for f in filtres if f)
    return C.ff(x, ch) if ch else x


def hp(f):
    return f'highpass=f={f}:poles=2,highpass=f={f}:poles=2'


def lp(f):
    return f'lowpass=f={f}:poles=2,lowpass=f={f}:poles=2'


def prise(code, t, canal, duree, st=0.0, avant=0.03):
    """Extrait d'une piste FFSL commençant avant secondes avant l'attaque t, transposé de st demi-tons.
    La transposition se fait au décodage : la piste à 192 kHz est rééchantillonnée à SR / r puis lue à SR."""
    r = 2 ** (st / 12)
    sr = int(round(SR / r))
    x = C.load(C.SRC / f'ffsl/{code}.wav', sr=sr, mono=False, start=max(0.0, t - avant), dur=(duree + avant) * r + 0.05)
    return x.mean(axis=1) if canal is None else x[:, canal]


def limiteur(x, reduc, attaque=0.0006, relache=0.015):
    """Limiteur à anticipation : la crête descend de reduc dB, gain lissé (attaque attaque s, relâchement relache s)."""
    a = np.abs(x)
    seuil = a.max() * dbg(-reduc)
    g = np.minimum(1.0, seuil / np.maximum(a, 1e-12))
    L = max(1, int(attaque * SR))
    gh = np.lib.stride_tricks.sliding_window_view(np.concatenate([g, np.ones(L)]), L + 1).min(axis=1)[:len(x)]
    k = 1 - np.exp(-1 / (relache * SR))
    out = np.empty_like(gh)
    prev = 1.0
    for i, v in enumerate(gh.tolist()):
        prev = v if v < prev else prev + (1 - prev) * k
        out[i] = prev
    c = np.cumsum(np.concatenate([np.ones(L), out]))
    lisse = (c[L:] - c[:-L]) / L
    return x * np.minimum(lisse, out)


def enveloppe(x, attaque=0.0005, relache=0.002):
    """Enveloppe efficace (détecteur quadratique à attaque et relâchement exponentiels)."""
    a2 = x * x
    ka, kr = np.exp(-1 / (attaque * SR)), np.exp(-1 / (relache * SR))
    env = np.empty_like(a2)
    prev = 0.0
    for i, v in enumerate(a2.tolist()):
        prev = v + (prev - v) * (ka if v > prev else kr)
        env[i] = prev
    return np.sqrt(env)


def compresse(x, seuil, ratio=4.0, relache=0.002):
    """Compresseur rapide : seuil en dB sous la crête de l'enveloppe."""
    env = enveloppe(x, 0.0005, relache)
    s = C.peak(env) * dbg(seuil)
    return x * np.where(env > s, (np.maximum(env, 1e-12) / s) ** (1 / ratio - 1), 1.0)


def _sur(x, f=4):
    n = len(x); m = n + 4096
    X = np.fft.rfft(np.concatenate([x, np.zeros(m - n)]))
    Y = np.zeros(m * f // 2 + 1, dtype=complex); Y[:len(X)] = X
    return np.fft.irfft(Y, m * f)[:n * f] * f


def _sous(y, f=4):
    n = len(y) // f; m = n + 4096
    Y = np.fft.rfft(np.concatenate([y, np.zeros(m * f - len(y))]))
    X = Y[:m // 2 + 1].copy(); X[-1] = 0
    return np.fft.irfft(X, m)[:n] / f


def sature(x, drive=1.4):
    """Saturation douce (tangente hyperbolique) suréchantillonnée 4 fois, gain de crête conservé."""
    if drive <= 0: return x
    p = C.peak(x)
    return _sous(np.tanh(_sur(x / p) * drive) / np.tanh(drive)) * p


def fenetre(n, t1, t2):
    """1 jusqu'à t1 s, descente en cosinus jusqu'à t2 s, 0 ensuite."""
    w = np.zeros(n)
    a, b = min(n, int(t1 * SR)), min(n, int(t2 * SR))
    w[:a] = 1
    if b > a: w[a:b] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, b - a))
    return w


def corps(x, niveau, t1=0.07, t2=0.16):
    """Compression parallèle limitée au début du tir : une copie très compressée (relâchement 2 ms), au niveau niveau
    dB sous la crête, s'ajoute pendant les t1 premières secondes puis s'efface jusqu'à t2 : le corps du tir s'épaissit,
    la queue reste naturelle."""
    c = compresse(x, -45, 4.0, 0.002)
    c = c / C.peak(c) * C.peak(x) * dbg(niveau)
    return x + c * fenetre(len(x), t1, t2)


def adoucit(x, apres=0.2, marge=6.0):
    """Adoucit les transitoires isolés de la queue (impact de la balle sur une cible, écho sec d'un mur du stand) :
    après apres s, l'enveloppe (fenêtres de 1 ms) est ramenée à marge dB au-dessus de sa médiane sur 60 ms."""
    w = 48
    k = len(x) // w
    if k < 80: return x
    e = np.sqrt((x[:k * w].reshape(k, w) ** 2).mean(axis=1)) + 1e-12
    h = 30
    med = np.median(np.lib.stride_tricks.sliding_window_view(np.pad(e, h, mode='edge'), 2 * h + 1), axis=1)
    g = np.minimum(1.0, med * dbg(marge) / e)
    g[:int(apres * SR / w)] = 1.0
    g = np.lib.stride_tricks.sliding_window_view(np.pad(g, 3, mode='edge'), 7).min(axis=1)
    g = np.convolve(np.pad(g, 3, mode='edge'), np.ones(7) / 7, mode='valid')
    gs = np.interp(np.arange(len(x)), np.arange(k) * w + w / 2, g)
    return x * gs


def raccourcit(x, t0, tau):
    """Raccourcit la queue : décroissance exponentielle (constante tau s) ajoutée après t0 s."""
    t = np.arange(len(x)) / SR
    return x * np.where(t < t0, 1.0, np.exp(-(t - t0) / tau))


def couche_grave(code, t, canal, duree, st, coupure=170, t1=0.05, t2=0.14):
    """Couche grave tirée du même tir : transposé d'une octave plus bas que st (deux fois plus lent : le souffle grave
    de la détonation dure deux fois plus), passe-bas, gardé pendant t1 s puis effacé jusqu'à t2 s."""
    x = prise(code, t, canal, duree, st - 12)
    x = af(x, hp(45), lp(coupure))
    x = C.trim(x, -40, 0.0015)
    return x / C.peak(x) * fenetre(len(x), t1, t2)


def ajoute(x, y, g):
    """x + y * g (en dB), y tronqué ou complété à la longueur de x."""
    z = np.zeros(len(x))
    m = min(len(x), len(y))
    z[:m] = y[:m]
    return x + z * dbg(g)


def debut(x, seuil=-40.0):
    """Coupe la tête : début 1,5 ms avant le premier échantillon à seuil dB sous la crête."""
    return C.trim(x, seuil, 0.0015)


ENTREES = []


def maitre(sid, x, dmax, fout, fichier, detail, source='ffsl_tirs', crete=-1.0):
    """Finit un master : coupe la fin passée sous -75 dB (sinon à dmax secondes, avec un fondu de sortie de fout s),
    fondu d'entrée 1 ms, crête, écriture, crédit."""
    x = np.asarray(x, dtype=np.float64)
    fin = C.tail_end(x, -75.0)
    if fin < int(dmax * SR):
        x, fout = x[:fin], min(fout, 0.12)
    else:
        x = x[:int(dmax * SR)]
    x = C.fade(x, 0.001, min(fout, len(x) / SR * 0.6), 2.0)
    x = C.norm(x, crete)
    C.save_master(PAQ, sid, x)
    ENTREES.append(C.credit(sid, PAQ, source, fichier, detail))
    return x


def queue_hp(x, f=80, t1=0.12, t2=0.2):
    """Passe-haut f Hz sur la queue seulement (fondu enchaîné de t1 à t2 s) : le souffle grave du vent et du stand
    sous la queue disparaît, le grave de la détonation reste."""
    h = af(x, hp(f))
    w = fenetre(len(x), t1, t2)
    return x * w + h * (1 - w)


def s(v, n=3):
    """Nombre au format français."""
    return f'{v:.{n}f}'.rstrip('0').rstrip('.').replace('.', ',') if isinstance(v, float) else str(v)


def nom_prise(p):
    code, t, canal = p
    voie = 'somme G+D' if canal is None else ('canal gauche' if canal == 0 else 'canal droit')
    return f'Master Tracks/{code}.wav', f'tir à {s(t)} s ({voie})'


# ---------------------------------------------------------------------------------------------------------------------
# Tirs du joueur et des ennemis proches

NEAR_LIM = 15  # dB rabotés sur la pointe d'un tir vu de face
NEAR_QUEUE = 6  # dB ajoutés à sa queue (après 0,16 s)


def tir_pov(b, p, st):
    """Tir du joueur : renfort de bas, couche grave, pointe rabotée, corps épaissi, saturation douce, queue gardée."""
    code, t, canal = p
    x = prise(code, t, canal, b['duree'] + 0.1, st)
    f, g = b['graves']
    filtres = [hp(b.get('hp', 45)), f'lowshelf=f={f}:g={g}:t=q:w=0.7']
    if 'aigus' in b:
        filtres.append(f'highshelf=f={b["aigus"][0]}:g={b["aigus"][1]}:t=q:w=0.7')
    x = debut(af(x, *filtres))
    x = ajoute(x / C.peak(x), couche_grave(code, t, canal, 0.6, st, *b.get('grave_f', (170, 0.05, 0.14))), b['grave'])
    x = limiteur(x / C.peak(x), b['lim'])
    x = corps(x, b['corps'])
    x = sature(x / C.peak(x), 1.3)
    x = adoucit(queue_hp(x))
    if b.get('queue'):
        x = raccourcit(x, *b['queue'])
    return x


def tir_near(b, p, st):
    """Tir d'un ennemi proche, vu de face : prise « near » d'un seul canal. Vue de face, la détonation est un claquement
    très bref (le corps et la queue sont 20 à 40 dB plus bas) : la pointe est rabotée plus fort que pour le pov (c'est
    aussi ce que font les « Prepared SFX » de la FFSL, par écrêtage), puis la queue est remontée de quelques dB.
    Moins de grave que le pov, pas de saturation."""
    code, t, canal = p
    x = prise(code, t, canal, b['duree'] + 0.1, st)
    f, g = b['graves']
    x = debut(af(x, hp(max(45, b.get('hp', 45))), f'lowshelf=f={f}:g={g / 2:.1f}:t=q:w=0.7'))
    x = ajoute(x / C.peak(x), couche_grave(code, t, canal, 0.6, st, *b.get('grave_f', (170, 0.05, 0.14))),
               b['grave'] - 4)
    x = limiteur(x / C.peak(x), NEAR_LIM)
    x = corps(x, -14)
    x = x * (1 + (dbg(NEAR_QUEUE) - 1) * (1 - fenetre(len(x), 0.08, 0.16)))
    x = adoucit(queue_hp(x))
    if b.get('queue'):
        x = raccourcit(x, *b['queue'])
    return x


def tirs(seulement=None):
    for nomb, b in BANQUES.items():
        if seulement and nomb not in seulement: continue
        reglages = f"passe-haut {b.get('hp', 45)} Hz, plateau de bas {b['graves'][0]} Hz {b['graves'][1]:+d} dB"
        if 'aigus' in b: reglages += f", plateau d'aigus {b['aigus'][0]} Hz {b['aigus'][1]:+d} dB"
        for i, p in enumerate(b['pov']):
            st = b['st'][i]
            x = tir_pov(b, p, st)
            fichier, quoi = nom_prise(p)
            det = f"{quoi}, {s(b['duree'], 2)} s ; "
            if st: det += f"transposé de {s(float(st), 1)} demi-ton(s) ; "
            det += (reglages + f", couche grave du même tir une octave plus bas ({b['grave']} dB), pointe rabotée de "
                    f"{b['lim']} dB, compression parallèle des 150 premières ms ({b['corps']} dB), saturation douce, "
                    f"queue passée au passe-haut 80 Hz (souffle grave du vent), échos secs de la queue adoucis")
            if b.get('queue'): det += f", queue raccourcie après {s(b['queue'][0], 2)} s"
            maitre(f'g_{nomb}_pov-{i + 1}', x, b['duree'], 0.5 if b['duree'] > 1.1 else 0.3, fichier,
                   det + ', fin coupée sous -75 dB, fondu')
        for i, p in enumerate(b['near']):
            st = b['st'][i]
            x = tir_near(b, p, st)
            fichier, quoi = nom_prise(p)
            det = f"prise « near distance, front of shooter », {quoi} ; "
            if st: det += f"transposé de {s(float(st), 1)} demi-ton(s) ; "
            det += (f"passe-haut, plateau de bas, couche grave du même tir ({b['grave'] - 4} dB), pointe rabotée de "
                    f"{NEAR_LIM} dB, compression parallèle des 150 premières ms, queue remontée de {NEAR_QUEUE} dB "
                    f"et passée au passe-haut 80 Hz, échos secs de la queue adoucis")
            if b.get('queue'): det += ', queue raccourcie'
            maitre(f'g_{nomb}_near-{i + 1}', x, min(1.6, b['duree'] + 0.2), 0.5, fichier,
                   det + ', fin coupée sous -75 dB, fondu')


# ---------------------------------------------------------------------------------------------------------------------
# Tirs lointains

def lointains():
    for classe, prises in LOIN.items():
        for i, p in enumerate(prises):
            code, t, canal = p
            x = prise(code, t, canal, 2.5)
            x = debut(af(x, hp(45)))
            x = limiteur(x / C.peak(x), 3, relache=0.03)
            fichier, quoi = nom_prise(p)
            maitre(f'g_far_{classe}-{i + 1}', x, 2.4, 0.8, fichier,
                   f"prise « far distance, front of shooter », {quoi}, 2,4 s au plus ; passe-haut 45 Hz, pointe "
                   f"rabotée de 3 dB, fin coupée sous -75 dB, fondu")


# ---------------------------------------------------------------------------------------------------------------------
# Tirs silencieux : souffle et mécanique, sans le second transitoire (impact de la balle sur la cible vers 0,26 s)

def silencieux():
    for sid, prises in SIL.items():
        loin = sid.endswith('far')
        for i, p in enumerate(prises):
            code, t, canal = p
            x = prise(code, t, canal, 1.0)
            x = debut(af(x, hp(110), 'afftdn=nr=10:nf=-60:tn=1'))
            fichier, quoi = nom_prise(p)
            det = f"{quoi} ; passe-haut 110 Hz (vent), réduction de souffle légère"
            if sid == 'g_sup_rifle_pov':
                # carabine à verrou : pas de bruit de culasse ; on pose celui d'un AR-15 (culasse qui revient en avant)
                m = af(C.load(C.SRC / CULASSE_AR, start=0.352, dur=0.1), hp(250))
                m = C.fade(m, 0.002, 0.03)
                x = ajoute(x / C.peak(x), np.concatenate([np.zeros(int(0.012 * SR)), m / C.peak(m)]), -9)
                det += (" ; mécanique : culasse d'AR-15 qui revient en avant (Master Tracks/AR-15/D_13.wav, "
                        "0,352-0,452 s, passe-haut 250 Hz, -9 dB, 12 ms après le tir)")
            if loin:
                x = adoucit(x, 0.12)
                det += ", échos secs et impact de la balle adoucis, fondu"
                maitre(f'{sid}-{i + 1}', x, 1.0, 0.4, fichier, det)
            else:
                x = raccourcit(x, 0.16, 0.03)
                det += ", coupé avant l'impact de la balle sur la cible (0,26 s), fondu"
                maitre(f'{sid}-{i + 1}', x, 0.24, 0.06, fichier, det)


# ---------------------------------------------------------------------------------------------------------------------
# Réponses impulsionnelles (stéréo)

REPONSES = [  # (id, fichier, lieu, passe-haut en Hz, temps de réverbération visé en s ou None)
    ('ir_out', IR_OUT, 'quai de chargement entre deux bâtiments (Flat Loading Dock)', 80, None),
    ('ir_in', IR_IN, 'parking souterrain en béton (Firenze Parking Garage)', 60, 1.4),
]


def reponses():
    for sid, rel, quoi, coupure, rt in REPONSES:
        x = C.load(C.SRC / rel, mono=False)
        m = np.abs(x).max(axis=1)
        i0 = max(0, int(np.argmax(m > m.max() * dbg(-20))) - 12)
        x = af(x[i0:i0 + int(2.0 * SR)], hp(coupure))
        det = f"{quoi} : début au son direct, passe-haut {coupure} Hz (grondement)"
        if rt:
            # temps de réverbération ramené d'environ 2,2 s à rt s : décroissance exponentielle ajoutée
            t = np.arange(len(x)) / SR
            x = x * (10 ** (-(60 / rt - 60 / 2.2) * t / 20))[:, None]
            det += f", réverbération raccourcie (environ 2,2 s ramené à {s(rt, 1)} s)"
        x = C.fade(x[:int(1.8 * SR)], 0.0, 0.5, 2.0)
        x = C.norm(x, -1.0)
        C.save_master(PAQ, sid, x)
        ENTREES.append(C.credit(sid, PAQ, 'conner_ir', rel.split('/', 1)[1],
                                det + ", 1,8 s, fondu de sortie 0,5 s, stéréo, crête -1 dBFS"))


def build(seulement=None):
    """Fabrique les masters de la famille (seulement : liste de groupes ou de banques pour les essais)."""
    ENTREES.clear()
    tirs(seulement)
    if seulement is None or 'lointains' in seulement: lointains()
    if seulement is None or 'silencieux' in seulement: silencieux()
    if seulement is None or 'reponses' in seulement: reponses()
    if seulement is None:
        C.write_credits('armes', ENTREES)
