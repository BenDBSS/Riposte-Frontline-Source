"""Famille « séries » : appareils des séries d'éliminations, radio, ponctuations et voix radio (paquets series, voix_fr,
voix_en).

Sources (voir SOURCES) : passages de chasseurs réels (F-18 d'Ears68 par CMU14, jet en approche de bigpickle51 par
AntumLuanti), sifflement de bombe de Daleonfire, rotor d'hélicoptère militaire et enregistrements du gouvernement
américain réunis par qubodup (choc métallique, explosion, fin de rafale, radio), rafale réelle de M134 de rob762x51,
hélice d'avion de conleec (ESC-50) pour le drone, squelch de JovianSounds et alarme de verrouillage de SamsterBirdies
(conceptgame), instruments réels de VS Chamber Orchestra Community Edition pour les ponctuations. Tout est en CC0.
Les sons sans enregistrement dédié (crash d'hélicoptère, fin de rafale, bips de liaison, ponctuations) sont composés
de couches réelles : aucun son n'est synthétisé à partir de rien.

Voix radio : générées par synthèse vocale Chatterbox Multilingual (Resemble AI, licence MIT), le même modèle pour
l'anglais et le français, chacun avec sa voix de référence (tools/sfx/voix_ref/<langue>.flac, un extrait de lecture du
domaine public, CC BY 4.0 : voir SOURCES) dont le modèle prend le timbre ; une référence dans la langue de la réplique,
sinon l'accent de la référence passe dans la voix. La génération (tts_generer) ne tourne que si le paquet chatterbox-tts
est installé (python3 -m venv, pip install chatterbox-tts ; le modèle, environ 3 Go, se télécharge depuis Hugging Face
au premier appel et ne va jamais dans le dépôt) ; sinon build() relit les WAV déjà générés sous
assets_src/sfx/src/tts/<langue>/. Chaque réplique a un tirage fixe (seed) : refaire donne le même son. Les répliques ont
été contrôlées par transcription automatique (Whisper). python3 tools/build_sfx.py --voix refait les deux paquets
de voix seuls (après l'ajout ou la retouche d'une réplique).

Traitement commun : mono 48 kHz, passe-haut, début à l'attaque, fondu de sortie ; transitoires et appareils en crête
à -1 dBFS (le dosage se fait dans le jeu). Les boucles (rotor, mitrailleuse rotative, drone) sont coupées sur un
nombre entier de périodes (pales, coups) trouvé par corrélation, puis refermées par un fondu croisé dont la loi
compense la corrélation des deux morceaux (pas de bosse de niveau à la jointure)."""
import os, pathlib, subprocess, urllib.parse
import numpy as np
import common as C
from common import SR

PAQ = 'series'

SOURCES = {
    'ears68': {
        'nom': '« F-18 fly-over-and-circle above-DR070cut.wav » (freesound 150328), extrait jet-pass.ogg de CMU14',
        'auteur': 'Ears68 (montage AU-14 / ColonialMarinesUniverse)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AU-14/ColonialMarinesUniverse/tree/master/Content.CMU/Resources/Audio/CMU14/Fighter',
        'preuve': "attributions.yml du dossier : « files: [jet-pass.ogg] license: CC0-1.0 copyright: \"F-18 fly-over-and-"
                  "circle above-DR070cut.wav by Ears68 ...\" source: https://freesound.org/people/Ears68/sounds/150328/ »",
    },
    'bigpickle51': {
        'nom': '« Landing Jet » (freesound 262755), sounds_src/sounds_jet_land.flac de mod-sounds',
        'auteur': 'bigpickle51 (montage AntumLuanti)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AntumLuanti/mod-sounds/tree/master/sounds_src',
        'preuve': "sources.md du dépôt : « | [jet_land][] | bigpickle51 | CC0 | » (lien freesound 262755)",
    },
    'daleonfire': {
        'nom': '« Falling Bomb.wav » (freesound 506313), battle_fall.wav d\'OpenPigeon',
        'auteur': 'Daleonfire',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/OpenBubbles/OpenPigeon/blob/wordhunt/app/src/main/assets/global/audio/battle_fall.wav',
        'preuve': "THIRD-PARTY-NOTICES.md : « | Falling Bomb.wav (battle_fall.wav) | Daleonfire | https://freesound.org/s/"
                  "506313/ | CC0 1.0 | » ; LICENSE : « Third-party components retain their original licenses »",
    },
    'qubodup_rotor': {
        'nom': '« Helicopter Rotor Loop » (freesound 187681), RotorReal_Freesound_qubodup.wav de StrategicPoint',
        'auteur': 'qubodup (prise du gouvernement américain)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/Joaquin-Inofuentes/StrategicPoint/tree/main/Assets/_Project/Resources/Audio/Heli',
        'preuve': "Assets/_Project/Resources/Audio/CREDITS.txt : « Heli/RotorReal_Freesound_qubodup.wav (CC0/public "
                  "domain, uploader qubodup): \"Helicopter Rotor Loop\", a real military helicopter recording extracted "
                  "from a US Government agency video »",
    },
    'qubodup_militaire': {
        'nom': 'Pack Freesound « military sounds » (4366) : choc métallique, explosion, fin de rafale, bip et clics radio',
        'auteur': 'qubodup (enregistrements du gouvernement américain)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/frostburn/amortization2/tree/main/sounds',
        'preuve': "sounds/_readme_and_license.txt : « Media created by the US Government is in the Public Domain » ; "
                  "« Licenses in this Pack: Creative Commons 0 » ; chaque fichier : « license: Creative Commons 0 »",
    },
    'amortization2': {
        'nom': 'Ralentissement de mitrailleuse rotative (sounds/minigun/spin-down.wav), montage d\'une prise de scie '
               '(olliehahn12, freesound 262004)',
        'auteur': 'frostburn (amortization2), d\'après olliehahn12',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/frostburn/amortization2/tree/main/sounds/minigun',
        'preuve': "sounds/minigun/README.md : « These derived audio files ... are released under CC0 1.0 » ; "
                  "saw-source-license.txt : olliehahn12, 262004, CC0",
    },
    'rob762x51': {
        'nom': '« minigun_ver1.wav » (freesound 85246), rafale réelle de M134 à 60 m, minigun.wav de dayhoodz',
        'auteur': 'rob762x51',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/Dostarki/dayhoodz/blob/main/frontend/public/audio/minigun.wav',
        'preuve': "frontend/public/audio/CREDITS.txt : « M134 Minigun: minigun_ver1.wav by rob762x51, real M134 burst "
                  "recording (200 ft distance). https://freesound.org/people/rob762x51/sounds/85246/ CC0 1.0 »",
    },
    'conleec': {
        'nom': '« VHCL_S_Airplane_Prop_001.wav » (freesound 193767), extrait 3-193767-A-47 d\'ESC-50',
        'auteur': 'conleec',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'preuve': "LICENSE d'ESC-50 : « [3-193767-A.ogg]: clip derived from VHCL_S_Airplane_Prop_001.wav (http://www."
                  "freesound.org/people/conleec/sounds/193767/) by conleec [CC0] » (seuls les extraits marqués CC0 sont pris)",
    },
    'miklovan': {
        'nom': '« Flies » (freesound 198278), extrait 5-198278-A-7 d\'ESC-50',
        'auteur': 'miklovan',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'preuve': "LICENSE d'ESC-50 : « [5-198278-A.ogg]: clip derived from Flies (http://www.freesound.org/people/miklovan/sounds/"
                  "198278/) by miklovan [CC0] »",
    },
    'brumbar': {
        'nom': '« Vacuum Cleaner.wav » (freesound 146200), extrait 4-146200-A-36 d\'ESC-50',
        'auteur': 'brumbar',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'preuve': "LICENSE d'ESC-50 : « [4-146200-A.ogg]: clip derived from Vacuum Cleaner.wav (http://www.freesound.org/people/brumbar/"
                  "sounds/146200/) by brumbar [CC0] »",
    },
    'joviansounds': {
        'nom': '« Radio Sign Off / Squelch » (freesound 524205), ui-radio-close-r08-a.ogg de conceptgame',
        'auteur': 'JovianSounds',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/papegaaij/conceptgame/tree/main/assets/sfx',
        'preuve': "CREDITS.md : « assets/sfx/ui-radio-close-r08-a.ogg | Radio Sign Off / Squelch | JovianSounds | "
                  "freesound.org/people/JovianSounds/sounds/524205 | CC0 1.0 »",
    },
    'samsterbirdies': {
        'nom': '« lock on » (freesound 467881), enemy-lock-r08-a.ogg de conceptgame',
        'auteur': 'SamsterBirdies',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/papegaaij/conceptgame/tree/main/assets/sfx',
        'preuve': "CREDITS.md : « assets/sfx/enemy-lock-r08-a.ogg | lock on | SamsterBirdies | freesound 467881 | CC0 1.0 »",
    },
    'vsco': {
        'nom': 'VS Chamber Orchestra: Community Edition (percussions, cuivres staccato, cordes en trémolo)',
        'auteur': 'Versilian Studios (Sam Gossner, Simon Dalzell)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/sgossner/VSCO-2-CE',
        'preuve': "LICENSE du dépôt : texte intégral « CC0 1.0 Universal » ; Readme.txt : « You are permitted to use these "
                  "samples for ANY purpose » (crédit demandé, non exigé : Versilian Studios)",
    },
    'chatterbox': {
        'nom': 'Voix générées par synthèse vocale Chatterbox Multilingual (paquet chatterbox-tts), une voix de référence par langue',
        'auteur': 'Riposte: Frontline, avec le modèle Chatterbox de Resemble AI',
        'licence': 'MIT (modèle) ; sons générés sans restriction',
        'url': 'https://huggingface.co/ResembleAI/chatterbox',
        'preuve': "licence MIT du dépôt Hugging Face ResembleAI/chatterbox (fiche du modèle : license: mit) et du dépôt "
                  "github.com/resemble-ai/chatterbox ; le paquet marque chaque son d'un filigrane inaudible (Perth) ; génération "
                  "décrite dans tools/sfx/series.py (tts_generer)",
        'attribution': 'Voix radio générées avec Chatterbox (Resemble AI, MIT)',
    },
    'ref-fr': {
        'nom': "Extrait 9804_9061_000826 de Multilingual LibriSpeech (français), lecteur 9804, « Les Enfants du capitaine Grant » de Jules Verne",
        'auteur': 'Pratap et al., Facebook AI (Multilingual LibriSpeech), lecture LibriVox du lecteur 9804',
        'licence': 'CC BY 4.0',
        'url': 'https://huggingface.co/datasets/facebook/multilingual_librispeech',
        'preuve': "fiche du jeu de données Multilingual LibriSpeech (license: cc-by-4.0) ; enregistrements tirés de LibriVox, "
                  "lectures versées au domaine public ; extrait seulement, ni modifié ni redistribué hors de tools/sfx/voix_ref",
        'attribution': "Voix de référence française : extrait 9804_9061_000826 de Multilingual LibriSpeech (V. Pratap et al., Facebook AI, 2020), lecture LibriVox de « Les Enfants du capitaine Grant » (Jules Verne), CC BY 4.0. Le modèle n'en imite que le timbre.",
    },
    'ref-en': {
        'nom': 'Extrait 2803_154320_000003_000001 de LibriTTS-R (dev-clean), lecteur 2803',
        'auteur': 'Koizumi et al., Google (LibriTTS-R), lecture LibriVox du lecteur 2803',
        'licence': 'CC BY 4.0',
        'url': 'https://huggingface.co/datasets/mythicinfinity/libritts_r',
        'preuve': "fiche du jeu de données LibriTTS-R (license: cc-by-4.0, publié par Google sur openslr.org/141) ; "
                  "enregistrements tirés de LibriVox, lectures versées au domaine public",
        'attribution': "Voix de référence anglaise : extrait 2803_154320_000003_000001 de LibriTTS-R (Y. Koizumi et al., Google, 2023), lecture LibriVox, CC BY 4.0. Le modèle n'en imite que le timbre.",
    },
}

# ---------------------------------------------------------------------------------------------------------------------
# Fichiers sources : chemin local sous assets_src/sfx/src -> adresse de téléchargement direct.
FILES = {}


def _url(depot, branche, chemin, lfs=False):
    base = 'https://media.githubusercontent.com/media' if lfs else 'https://raw.githubusercontent.com'
    return f'{base}/{depot}/{branche}/' + urllib.parse.quote(chemin)


def _f(rel, url):
    FILES[rel] = url
    return rel


def _amort(nom):
    return _f(f'qubodup/{nom}', _url('frostburn/amortization2', 'main', f'sounds/{nom}'))


def _vsco(chemin):
    return _f(f'vsco/{chemin}', _url('sgossner/VSCO-2-CE', 'master', chemin))


JET_F18 = _f('cmu14/jet-pass.ogg', _url('AU-14/ColonialMarinesUniverse', 'master',
                                         'Content.CMU/Resources/Audio/CMU14/Fighter/jet-pass.ogg'))
JET_LAND = _f('antum/sounds_jet_land.flac', _url('AntumLuanti/mod-sounds', 'master', 'sounds_src/sounds_jet_land.flac'))
BOMBE = _f('openpigeon/battle_fall.wav', _url('OpenBubbles/OpenPigeon', 'wordhunt',
                                               'app/src/main/assets/global/audio/battle_fall.wav'))
ROTOR = _f('strategicpoint/RotorReal_Freesound_qubodup.wav', _url('Joaquin-Inofuentes/StrategicPoint', 'main',
           'Assets/_Project/Resources/Audio/Heli/RotorReal_Freesound_qubodup.wav', lfs=True))
MINIGUN = _f('dayhoodz/minigun.wav', _url('Dostarki/dayhoodz', 'main', 'frontend/public/audio/minigun.wav'))
HELICE = _f('esc50/3-193767-A-47.wav', _url('karolpiczak/ESC-50', 'master', 'audio/3-193767-A-47.wav'))
MOUCHES = _f('esc50/5-198278-A-7.wav', _url('karolpiczak/ESC-50', 'master', 'audio/5-198278-A-7.wav'))
ASPIRATEUR = _f('esc50/4-146200-A-36.wav', _url('karolpiczak/ESC-50', 'master', 'audio/4-146200-A-36.wav'))
SQUELCH = _f('conceptgame/ui-radio-close-r08-a.ogg', _url('papegaaij/conceptgame', 'main',
             'assets/sfx/ui-radio-close-r08-a.ogg', lfs=True))
VERROU = _f('conceptgame/enemy-lock-r08-a.ogg', _url('papegaaij/conceptgame', 'main',
            'assets/sfx/enemy-lock-r08-a.ogg', lfs=True))
# qubodup (pack 4366, via amortization2)
CHOC = _amort('67617__qubodup__metal-crash-collision.flac')
FERRAILLE = _amort('67614__qubodup__metal_shaking_1.flac')
FROTTEMENT = _amort('67615__qubodup__metal_swosh_1.flac')
CLAC = _amort('67605__qubodup__metal_click_17.flac')
EXPLOSION = _amort('855893__qubodup__blast.flac')
FIN_RAFALE = _amort('854642__qubodup__machine-gun-burst-loop-end.wav')
BIP = _amort('67619__qubodup__radio_beep_1.flac')
CLICS = _amort('67620__qubodup__radio_click_1.flac')
RALENTI = _f('qubodup/minigun-spin-down.wav', _url('frostburn/amortization2', 'main', 'sounds/minigun/spin-down.wav'))
# VSCO 2 CE
GROSSE_CAISSE = _vsco('Percussion/BDrumNewhit_v7_rr1_Sum.wav')
CAISSE = [_vsco('Percussion/Snare2-HitSN_v9_rr1_Sum.wav'), _vsco('Percussion/Snare2-HitSN_v7_rr1_Sum.wav'),
          _vsco('Percussion/Snare2-HitSN_v5_rr1_Sum.wav')]
ROULEMENT = _vsco('Percussion/Snare2-rollSN_v5_rr1_Sum.wav')
TIMBALE = [_vsco('Percussion/Timpani/Timpani3_Hit_v4_rr1_Sum.wav'), _vsco('Percussion/Timpani/Timpani2_Hit_v4_rr1_Sum.wav')]
TIMBALE_ROULEMENT = _vsco('Percussion/Timpani/Rolls/Timpani2_Roll_v5_rr1_Sum.wav')
ENCLUME = _vsco('Percussion/Anvil_Hit1_v3_Sum.wav')
# cuivres staccato et cordes : fichier -> fréquence fondamentale mesurée (Hz)
NOTES = {
    _vsco('Brass/Tuba/stac/Tuba3_stac_F1_v2_rr1_Sum.wav'): 86.96,
    _vsco('Brass/Tuba/stac/Tuba3_stac_F2_v2_rr1_Sum.wav'): 173.91,
    _vsco('Brass/Tuba/stac/Tuba3_stac_A#0_v2_rr1_Sum.wav'): 115.38,
    _vsco('Brass/Tenor Trombone/stac/tenortbn_stac_F1_v4_rr1.wav'): 88.24,
    _vsco('Brass/Tenor Trombone/stac/tenortbn_stac_F2_v4_rr1.wav'): 174.55,
    _vsco('Brass/Tenor Trombone/stac/tenortbn_stac_F3_v4_rr1.wav'): 350.36,
    _vsco('Brass/F Horn/stac/MOHorn_stac_F2_v3_rr1.wav'): 174.55,
    _vsco('Brass/F Horn/stac/MOHorn_stac_C3_v3_rr1.wav'): 262.30,
    _vsco('Brass/F Horn/stac/MOHorn_stac_A2_v3_rr1.wav'): 220.18,
    _vsco('Brass/F Horn/stac/MOHorn_stac_A#1_v3_rr1.wav'): 116.79,
    _vsco('Brass/Trumpet/stac/Sum_SHTrumpet_stac_F3_v3_rr1.wav'): 350.36,
    _vsco('Brass/Trumpet/stac/Sum_SHTrumpet_stac_F4_v3_rr1.wav'): 705.88,
    _vsco('Brass/Trumpet/stac/Sum_SHTrumpet_stac_A4_v3_rr1.wav'): 888.89,
    _vsco('Brass/Trumpet/stac/Sum_SHTrumpet_stac_C5_v3_rr1.wav'): 1043.48,
    _vsco('Brass/Trumpet/stac/Sum_SHTrumpet_stac_G3_v3_rr1.wav'): 393.44,
    _vsco('Brass/Tuba/sus/Tuba3_sus_F1_v3_rr1_Mid.wav'): 87.59,
    _vsco('Brass/Tenor Trombone/sus/tenortbn_sus_F1_v3_1.wav'): 87.27,
    _vsco('Brass/Tenor Trombone/sus/tenortbn_sus_F2_v3_1.wav'): 174.55,
    _vsco('Brass/Tenor Trombone/sus/tenortbn_sus_C3_v3_1.wav'): 262.30,
    _vsco('Brass/F Horn/sus/MOHorn_sus_F2_v3_1.wav'): 173.91,
    _vsco('Brass/F Horn/sus/MOHorn_sus_C3_v3_1.wav'): 260.87,
    _vsco('Brass/F Horn/sus/MOHorn_sus_A2_v3_1.wav'): 220.18,
    _vsco('Brass/Trumpet/sus/Sum_SHTrumpet_sus_G3_v3_rr1.wav'): 393.44,
    _vsco('Brass/Trumpet/sus/Sum_SHTrumpet_sus_F4_v3_rr1.wav'): 695.65,
    _vsco('Brass/Trumpet/sus/Sum_SHTrumpet_sus_A4_v3_rr1.wav'): 888.89,
    _vsco('Brass/Trumpet/sus/Sum_SHTrumpet_sus_C5_v3_rr1.wav'): 1043.48,
    _vsco('Strings/Cello Section/trem/trem_F2_v2_1.wav'): 175.18,
    _vsco('Strings/Cello Section/trem/trem_E1_v2_1.wav'): 82.47,
    _vsco('Strings/Cello Section/trem/trem_G1_v2_1.wav'): 97.96,
    _vsco('Strings/Viola Section/trem/Violas_trem_F3_v2_rr1.wav'): 350.36,
}


def _note(debut):
    """Fichier de NOTES dont le chemin commence par debut (ex. 'Brass/Tuba/stac/Tuba3_stac_F1')."""
    return next(k for k in NOTES if k.startswith('vsco/' + debut))


# ---------------------------------------------------------------------------------------------------------------------
# Outils de traitement

def src(rel, debut=None, duree=None):
    """Source décodée en mono 48 kHz (extrait debut..debut+duree s)."""
    return C.load(C.SRC / rel, start=debut, dur=duree)


def af(x, *filtres):
    """Chaîne de filtres ffmpeg (les éléments vides sont ignorés)."""
    ch = ','.join(f for f in filtres if f)
    return C.ff(x, ch) if ch else x


def hp(f, poles=2):
    """Passe-haut 12 dB/octave par étage (poles étages)."""
    return ','.join([f'highpass=f={f}:poles=2'] * poles)


def lp(f, poles=2):
    return ','.join([f'lowpass=f={f}:poles=2'] * poles)


def eq(f, g, q=1.0):
    return f'equalizer=f={f}:t=q:w={q}:g={g}'


def grave(f, g):
    return f'lowshelf=f={f}:g={g}'


def aigu(f, g):
    return f'highshelf=f={f}:g={g}'


def vitesse(x, r):
    """Lecture accélérée (r > 1) ou ralentie : hauteur et durée changent ensemble (rééchantillonnage soxr)."""
    if abs(r - 1) < 1e-6: return x
    # asetrate déclare la fréquence SR*r puis aresample revient à SR : le signal est relu r fois plus vite
    return C.ff(x, f'asetrate={int(round(SR * r))},aresample={SR}:resampler=soxr')


def demitons(x, n):
    return vitesse(x, 2 ** (n / 12))


def vers(x, f0, cible):
    """Transpose une note de f0 vers la fréquence cible."""
    return vitesse(x, cible / f0)


def varivitesse(x, taux):
    """Lecture à vitesse variable : taux[n] = vitesse de lecture à l'échantillon de sortie n (Doppler, ralenti).
    Interpolation cubique (Catmull-Rom) ; la sortie s'arrête à la fin de la source."""
    pos = np.concatenate([[0.0], np.cumsum(taux[:-1])])
    pos = pos[pos < len(x) - 3]
    i = np.floor(pos).astype(int); t = pos - i
    xp = np.concatenate([[x[0]], x, [x[-1], x[-1]]])
    p0, p1, p2, p3 = xp[i], xp[i + 1], xp[i + 2], xp[i + 3]
    return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)))


def courbe(n, points):
    """Gain par échantillon (n échantillons) interpolé en dB entre des points (t en s, dB)."""
    t = np.arange(n) / SR
    ts, gs = zip(*points)
    return 10 ** (np.interp(t, ts, gs) / 20)


def rms_lisse(x, fen):
    """Enveloppe efficace lissée sur fen secondes."""
    k = max(1, int(fen * SR)); m = min(k, len(x) - 1)
    p = np.pad(x ** 2, (m, m), mode='reflect')       # bords en miroir : pas de faux creux d'enveloppe aux extrémités
    e = np.convolve(p, np.ones(k) / k, 'same')[m:m + len(x)]
    return np.sqrt(np.maximum(e, 1e-12))


def aplatir(x, fen=0.4):
    """Retire les variations lentes de niveau (approche, éloignement) : signal / enveloppe lissée."""
    e = rms_lisse(x, fen)
    return x * (np.median(e) / e)


def periode(x, tmin, tmax, f_env=None):
    """Période dominante (s) de l'enveloppe entre tmin et tmax (pales d'un rotor, cadence de tir)."""
    y = af(x, lp(f_env)) if f_env else x
    e = np.abs(y); k = int(0.004 * SR)
    e = np.convolve(e, np.ones(k) / k, 'same')[::24]; e = e - e.mean()
    n = 1 << int(np.ceil(np.log2(2 * len(e))))
    ac = np.fft.irfft(np.abs(np.fft.rfft(e, n)) ** 2)[:len(e)]
    a, b = int(tmin * SR / 24), int(tmax * SR / 24)
    i = a + int(np.argmax(ac[a:b]))
    y0, y1, y2 = ac[i - 1], ac[i], ac[i + 1]
    return (i + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2)) * 24 / SR


def jointure(x, n0, xf, lmin, lmax, f_env=200):
    """Longueur de boucle (échantillons, entre lmin et lmax) qui aligne le mieux x[n0+L : n0+L+xf] sur x[n0 : n0+xf]
    (corrélation de la partie grave, où sont les coups de pale ou les coups de feu)."""
    y = af(x, lp(f_env))
    lmax = min(lmax, len(y) - n0 - xf)
    a = y[n0:n0 + xf]; best, bl = -2, lmin
    for L in range(lmin, lmax + 1, 4):
        b = y[n0 + L:n0 + L + xf]
        c = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
        if c > best: best, bl = c, L
    for L in range(max(lmin, bl - 4), min(lmax, bl + 4) + 1):
        b = y[n0 + L:n0 + L + xf]
        c = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
        if c > best: best, bl = c, L
    return bl, best


def boucler(x, L, xf):
    """Boucle de L échantillons à partir de x (au moins L + xf échantillons) : la fin x[L:L+xf] passe en fondu croisé
    sur le début. Loi du fondu : gains a, b normalisés par la corrélation r des deux morceaux (a² + b² + 2rab = 1),
    pour garder un niveau constant que les morceaux soient corrélés (rotor aligné) ou non (souffle)."""
    head = x[:xf]; tail = x[L:L + xf]
    r = float(np.dot(head, tail) / (np.linalg.norm(head) * np.linalg.norm(tail) + 1e-12))
    u = (np.arange(xf) + 0.5) / xf
    a = np.cos(u * np.pi / 2) ** 2; b = np.sin(u * np.pi / 2) ** 2
    g = 1 / np.sqrt(a * a + b * b + 2 * max(r, -0.5) * a * b)
    y = x[:L].copy()
    y[:xf] = (tail * a + head * b) * g
    return y


def compresser(x, seuil=-18, ratio=2.5, attaque=20, relache=250):
    """Compression douce (le signal est d'abord ramené à -1 dBFS pour que le seuil ait un sens)."""
    x = C.norm(x, -1)
    return af(x, f'acompressor=threshold={10 ** (seuil / 20):.5f}:ratio={ratio}:attack={attaque}:release={relache}:knee=6')


def debut(x, seuil=-40, pre=0.0005):
    """Début à l'attaque (au plus 0,5 ms gardée avant)."""
    return C.trim(x, seuil, pre)


def fin(x, dur, fout):
    """Garde dur secondes au plus, fondu de sortie de fout secondes."""
    return C.fade(x[:int(dur * SR)], 0.0005, fout)


ENTREES = []


def sortir(pack, sid, x, source, fichier, detail, crete=-1.0):
    """Normalise, vérifie et écrit un master, puis note son crédit."""
    x = C.norm(x, crete)
    C.save_master(pack, sid, x)
    ENTREES.append(C.credit(sid, pack, source, fichier, detail))


def couche(sid, source, fichier, detail, pack=PAQ):
    """Crédit d'une couche supplémentaire d'un master composé."""
    ENTREES.append(C.credit(sid, pack, source, fichier, detail))


def nom(rel):
    return rel.split('/', 1)[1]


# ---------------------------------------------------------------------------------------------------------------------
# Appareils

def jets():
    """k_jet-1..2 : passage complet de chasseur (approche, rugissement, Doppler, éloignement), 6 s."""
    # 1 : jet en approche tout près (bigpickle51) : sifflement de turbine qui monte, passage, Doppler naturel, grondement
    x = src(JET_LAND, 2.0, 6.6)
    x = af(x, hp(35), grave(110, 3), eq(2500, -2, 0.8))
    x = compresser(x, -20, 2.5, 30, 300)
    g = courbe(len(x), [(0, -14), (0.9, -5), (2.6, 0), (3.2, 0), (6.6, -4)])
    x = fin(x * g, 6.0, 1.6)
    sortir(PAQ, 'k_jet-1', C.fade(x, 0.25, 0), 'bigpickle51', nom(JET_LAND),
           "extrait 2,0-8,0 s (approche, passage, éloignement), passe-haut 35 Hz, grave +3 dB, compression douce, "
           "fondus d'entrée et de sortie")
    # 2 : F-18 d'Ears68 (grondement dense et craquements de post-combustion) ; la prise tourne sans vrai passage :
    # un Doppler (vitesse de lecture 1,07 puis 0,90 autour du passage) et une enveloppe en font un passage
    x = src(JET_F18, 0.4, 7.5)
    t = np.arange(int(7.4 * SR)) / SR
    taux = 0.985 - 0.085 * np.tanh((t - 2.7) / 0.55)
    x = varivitesse(x, taux)
    x = af(x, hp(35), grave(100, 3))
    x = compresser(x, -18, 2, 30, 300)
    g = courbe(len(x), [(0, -16), (1.2, -6), (2.3, 0), (2.9, 0), (4.0, -6), (6.0, -14)])
    x = fin(x * g, 6.0, 1.2)
    sortir(PAQ, 'k_jet-2', C.fade(x, 0.25, 0), 'ears68', nom(JET_F18),
           "extrait 0,4-7,4 s, Doppler ajouté (vitesse de lecture 1,07 vers 0,90 autour de 2,7 s), passe-haut 35 Hz, "
           "grave +3 dB, compression douce, enveloppe d'approche et d'éloignement")


def bombes():
    """k_bomb-1..2 : sifflement de bombe qui tombe, 1,2 s, fin nette (l'explosion prend le relais)."""
    x = src(BOMBE)
    x = af(x, hp(450, 3), lp(9000))
    x = aplatir(x, 0.15)  # niveau rendu régulier : le crescendo d'approche est posé ensuite
    # 1 : dernière partie de la chute (2,4 kHz vers 1,6 kHz), crescendo d'approche
    a = x[int(1.58 * SR):int(2.78 * SR)]
    a = a * courbe(len(a), [(0, -12), (0.8, -4), (1.2, 0)])
    sortir(PAQ, 'k_bomb-1', C.fade(a, 0.12, 0.006, 1), 'daleonfire', nom(BOMBE),
           "extrait 1,58-2,78 s, passe-haut 450 Hz (grondement de fond retiré), passe-bas 9 kHz, niveau aplani puis "
           "crescendo de 12 dB, fin nette (6 ms)")
    # 2 : toute la chute (3,6 kHz vers 1,6 kHz) resserrée en 1,2 s sans changer la hauteur, puis un demi-ton plus bas
    b = x[int(0.10 * SR):int(2.78 * SR)]
    b = af(b, f'rubberband=tempo={2.68 / 1.27:.4f}:pitch={2 ** (-1 / 12):.5f}:transients=smooth:window=standard')
    b = aplatir(b[:int(1.2 * SR)], 0.15)
    b = b * courbe(len(b), [(0, -14), (0.7, -6), (1.2, 0)])
    sortir(PAQ, 'k_bomb-2', C.fade(b, 0.10, 0.006, 1), 'daleonfire', nom(BOMBE),
           "extrait 0,10-2,78 s resserré à 1,2 s (rubberband, hauteur gardée) puis transposé d'un demi-ton vers le "
           "bas, passe-haut 450 Hz, crescendo de 14 dB, fin nette")


def helico():
    """k_heli : boucle de rotor et turbine d'hélicoptère militaire (4 s au plus, coupée sur un nombre entier de pales)."""
    x = src(ROTOR, 0.3, 5.9)
    x = af(x, hp(30), grave(90, 3), eq(3000, -1.5, 1))
    T = periode(x, 0.04, 0.08, 300)                  # passage de pale (UH-60 : environ 17,9 Hz)
    n = int(3.98 / T); xf = int(round(10 * T * SR))
    L0 = int(round(n * T * SR))
    L, r = jointure(x, 0, xf, L0 - int(T * SR / 2), min(int(4.0 * SR), L0 + int(T * SR / 2)))
    y = boucler(x, L, xf)
    sortir(PAQ, 'k_heli', y, 'qubodup_rotor', nom(ROTOR),
           f"boucle de {L / SR:.3f} s ({n} passages de pale de {T * 1000:.2f} ms) prise à 0,3 s, fondu croisé de "
           f"{xf / SR:.2f} s compensé (corrélation {r:.2f}), passe-haut 30 Hz, grave +3 dB")


def crash():
    """k_heli_crash : choc métallique lourd, souffle grave, puis le rotor qui ralentit et se tord, ferraille, 2 s."""
    choc = af(src(CHOC), hp(40))
    boum = af(src(EXPLOSION), hp(30), lp(900), grave(80, 3))
    # rotor qui ralentit : vitesse de lecture de 0,95 vers 0,3 (les pales ralentissent, la hauteur tombe)
    rot = af(src(ROTOR, 1.0, 2.0), hp(40))
    t = np.arange(int(1.8 * SR)) / SR
    rot = varivitesse(rot, 0.3 + 0.65 * np.exp(-t / 0.6))
    rot = af(rot * courbe(len(rot), [(0, -2), (0.5, -4), (1.2, -11), (1.75, -32)]), lp(5000))
    lourd = af(demitons(choc, -5), lp(5000))         # le même choc une quarte plus bas : masse de la carlingue
    frot = af(src(FROTTEMENT), hp(200))
    ferr = af(src(FERRAILLE), hp(200))
    clac = af(src(CLAC, 0.0, 0.14), hp(150))
    clac2 = af(src(CLAC, 0.5, 0.17), hp(150))
    x = C.mix((choc, 0, 1.0), (lourd, 0.012, 0.6), (boum, 0.004, 0.9), (rot, 0.06, 0.9), (frot, 0.32, 1.6),
              (ferr, 0.45, 2.2), (clac, 0.62, 0.35), (clac2, 1.05, 0.12))
    x = fin(debut(x), 2.0, 0.5)
    sortir(PAQ, 'k_heli_crash', x, 'qubodup_militaire', nom(CHOC),
           "choc métallique (prise entière), passe-haut 40 Hz, doublé une quarte plus bas (passe-bas 5 kHz)")
    couche('k_heli_crash', 'qubodup_militaire', nom(EXPLOSION), "souffle grave : explosion passe-bas 900 Hz, grave +3 dB")
    couche('k_heli_crash', 'qubodup_rotor', nom(ROTOR), "rotor 1,0-3,0 s relu de plus en plus lentement (0,95 vers "
           "0,3), passe-bas 5 kHz, extinction sur 1,7 s")
    couche('k_heli_crash', 'qubodup_militaire', nom(FROTTEMENT) + ', ' + nom(FERRAILLE) + ', ' + nom(CLAC),
           "ferraille : frottement, secousse et deux chocs métalliques posés après l'impact")


def minigun():
    """k_minigun : boucle de rafale de M134 (0,6 s au plus, nombre entier de coups) ; k_minigun_end : fin de rafale."""
    x = src(MINIGUN, 0.0, 0.93)                      # la fin du fichier est un fondu ajouté par dayhoodz
    x = af(x, hp(40), grave(140, 2.5))
    T = periode(x, 0.012, 0.03, 2000)                # environ 49,6 coups/s (près de 3000 coups/min)
    n = int(0.6 / T); xf = int(round(2 * T * SR))
    # début : sur l'attaque d'un coup (pic d'énergie aiguë dans la première période après 50 ms)
    h = af(x, hp(2000)); a0 = int(0.05 * SR)
    n0 = a0 + int(np.argmax(np.abs(h[a0:a0 + int(T * SR)]))) - int(0.0008 * SR)
    y = x[n0:]
    L0 = int(round(n * T * SR))
    L, r = jointure(y, 0, xf, L0 - int(T * SR / 3), min(int(0.6 * SR), L0 + int(T * SR / 3)), 4000)
    sortir(PAQ, 'k_minigun', boucler(y, L, xf), 'rob762x51', nom(MINIGUN),
           f"boucle de {L / SR:.3f} s ({n} coups de {T * 1000:.2f} ms) prise à {n0 / SR:.3f} s, commence sur un coup, "
           f"fondu croisé de 2 coups compensé (corrélation {r:.2f}), passe-haut 40 Hz, grave +2,5 dB")
    # fin de rafale : les deux coups qui suivent la boucle, puis un dernier coup réel avec sa queue en plein air
    # (fin de rafale de mitrailleuse, qubodup) et le barillet qui ralentit
    k = int(round(2 * T * SR))
    tete = C.fade(y[L:L + k + int(0.004 * SR)], 0, 0.004)
    # raies de sifflement (caméra) à 4,05, 5,1, 5,8, 8,0 et 9,3 kHz : coupe-bandes étroits, passe-bas 8,5 kHz
    der = af(src(FIN_RAFALE), hp(60), eq(5790, -26, 5), eq(5115, -16, 6), eq(4053, -12, 8), eq(8040, -20, 5),
             eq(9290, -14, 6), lp(8500))
    bar = af(src(RALENTI), hp(150), lp(6000))
    z = C.mix((tete, 0, 1.0), (der, k / SR, 0.9), (bar, k / SR, 0.25))
    z = fin(z, 0.8, 0.25)
    sortir(PAQ, 'k_minigun_end', z, 'rob762x51', nom(MINIGUN), "deux coups pris juste après la boucle (enchaînement)")
    couche('k_minigun_end', 'qubodup_militaire', nom(FIN_RAFALE),
           "dernier coup et queue en plein air (fin de rafale de mitrailleuse), coupe-bandes sur les raies de sifflement "
           "de caméra (4 à 9,3 kHz), passe-bas 8,5 kHz")
    couche('k_minigun_end', 'amortization2', nom(RALENTI), "barillet qui ralentit, à -12 dB, passe-bande 150 Hz-6 kHz")


def drone():
    """k_uav : boucle de bourdonnement d'hélice lointain (drone de surveillance en altitude), 4 s, discret et grave."""
    x = src(HELICE)
    x = aplatir(x, 0.6)                              # l'avion de la prise s'approche : niveau rendu constant
    x = demitons(x, -3)                              # moteur plus lent et plus grave (5 s deviennent 5,9 s)
    x = af(x, hp(60), lp(1400), lp(2500), eq(250, 2, 0.8))   # altitude : l'air absorbe les aigus
    x = aplatir(x, 0.3)                              # battements lents adoucis : pas de bosse qui revienne à chaque tour
    L = int(4.0 * SR); xf = int(0.9 * SR)
    y = boucler(x[int(0.4 * SR):], L, xf)
    sortir(PAQ, 'k_uav', y, 'conleec', nom(HELICE),
           "niveau aplani (l'avion approche dans la prise), transposé de 3 demi-tons vers le bas, passe-bas 1,4 kHz "
           "(altitude), niveau lissé sur 0,3 s, boucle de 4 s prise à 0,4 s, fondu croisé de 0,9 s compensé")


def drone_fpv():
    """k_fpv : boucle du drone kamikaze (quatre petites hélices qui tournent vite), 2,1 s. Aucun enregistrement libre d'un
    quadricoptère : trois couches réelles. Le bourdonnement des pales vient d'un vol de mouches (miklovan), à peine transposé ;
    le sifflement des moteurs électriques, d'un aspirateur (brumbar) dont seuls les aigus restent ; le battement des pales,
    de l'hélice d'avion du drone de surveillance (conleec) une octave plus haut. Le jeu en fait varier la hauteur avec la
    vitesse du drone (fpvSoundUpdate, 05-audio.js)."""
    L = int(2.1 * SR); xf = int(0.3 * SR)
    a = src(MOUCHES)
    a = aplatir(af(demitons(a, 2), hp(140), lp(7500), eq(400, 3, 1.0)), 0.25)
    b = src(ASPIRATEUR)
    b = aplatir(af(demitons(b, 4), hp(1100), lp(9000), eq(3200, 4, 1.2)), 0.25)
    c = src(HELICE)
    c = aplatir(af(demitons(c, 12), hp(110), lp(3500)), 0.6)
    n = min(len(a), len(b), len(c))
    if n < L + xf + int(0.05 * SR): raise ValueError(f'k_fpv : couches trop courtes ({n / SR:.2f} s)')
    y = (C.norm_rms(a[:n], -20) * 1.0 + C.norm_rms(b[:n], -20) * 0.35 + C.norm_rms(c[:n], -20) * 0.55)
    y = compresser(y, -16, 2.0, 20, 200)
    y = boucler(y[int(0.05 * SR):], L, xf)
    sortir(PAQ, 'k_fpv', y, 'miklovan', nom(MOUCHES),
           "vol de mouches transposé de 2 demi-tons vers le haut, passe-bande 140 Hz-7,5 kHz, bosse de +3 dB à 400 Hz (bourdonnement "
           "des pales), niveau lissé sur 0,25 s ; trois couches mêlées, compression douce, boucle de 2,1 s, fondu croisé de 0,3 s compensé")
    couche('k_fpv', 'brumbar', nom(ASPIRATEUR), "moteur d'aspirateur transposé de 4 demi-tons vers le haut, passe-bande 1,1-9 kHz, "
           "+4 dB à 3,2 kHz (sifflement des moteurs électriques), à -9 dB")
    couche('k_fpv', 'conleec', nom(HELICE), "hélice d'avion une octave plus haut, passe-bande 110 Hz-3,5 kHz (battement des pales), à -5 dB")


# ---------------------------------------------------------------------------------------------------------------------
# Radio

RADIO = (hp(300), lp(3600))                          # bande d'une liaison radio


def radio():
    """r_on, r_off (squelch), r_beep-1..2 (bip radio), r_chirp (liaison numérique : bips rapides propres)."""
    clic_on = src(CLICS, 0.0, 0.05)                  # alternat enfoncé
    clic_off = src(CLICS, 0.172, 0.08)               # alternat relâché
    sq = src(SQUELCH)
    souffle = sq[:int(0.06 * SR)]                    # porteuse : souffle radio avant le squelch
    kssh = sq[int(0.115 * SR):int(0.168 * SR)]       # « kssh » du squelch
    # ouverture : clic d'alternat, « kssh » bref puis souffle de porteuse qui s'éteint
    x = C.mix((C.fade(clic_on, 0, 0.02), 0, 0.8), (C.fade(kssh, 0.003, 0.012), 0.012, 0.9),
              (C.fade(np.concatenate([souffle, souffle[::-1], souffle]), 0.01, 0.12), 0.06, 0.8))
    x = fin(debut(af(x, *RADIO)), 0.3, 0.06)
    sortir(PAQ, 'r_on', x, 'qubodup_militaire', nom(CLICS), "clic d'alternat enfoncé (0-0,05 s), bande radio 300 Hz-3,6 kHz")
    couche('r_on', 'joviansounds', nom(SQUELCH), "« kssh » du squelch (0,115-0,168 s) et souffle de porteuse (0-0,06 s, "
           "prolongé en miroir), fondus")
    # fermeture : squelch de fin d'émission complet puis clic d'alternat relâché
    y = C.mix((sq[:int(0.21 * SR)], 0, 1.0), (C.fade(clic_off, 0.002, 0.03), 0.17, 0.5))
    y = fin(debut(af(y, *RADIO), -36), 0.5, 0.05)
    sortir(PAQ, 'r_off', y, 'joviansounds', nom(SQUELCH), "squelch de fin d'émission (0-0,21 s), bande radio")
    couche('r_off', 'qubodup_militaire', nom(CLICS), "clic d'alternat relâché (0,172-0,25 s) posé à la fin du squelch")
    # bips : la tonalité de 1 kHz du bip radio militaire, arrondie (passe-bas 2,4 kHz : moins d'harmoniques criardes)
    bip = af(src(BIP), hp(300), lp(2400))
    sortir(PAQ, 'r_beep-1', C.fade(debut(bip), 0.002, 0.008), 'qubodup_militaire', nom(BIP),
           "bip entier (0,12 s), passe-bande 300 Hz-2,4 kHz, fondus de 2 et 8 ms")
    tenu = bip[int(0.02 * SR):int(0.10 * SR)]        # partie tenue de la tonalité

    def pip(d, n):
        return C.fade(demitons(tenu, n)[:int(d * SR)], 0.002, 0.004)

    b2 = C.mix((pip(0.055, 0), 0, 1.0), (pip(0.055, 4), 0.085, 1.0))
    sortir(PAQ, 'r_beep-2', b2, 'qubodup_militaire', nom(BIP), "double bip : la tonalité tenue (0,02-0,10 s) "
           "en deux impulsions de 55 ms, la seconde 4 demi-tons plus haut")
    # liaison numérique : salve de bips très courts sur deux tons (façon modem de terminal), puis bip d'accusé
    seq = []
    t = 0.0
    for k in range(8):
        seq.append((pip(0.022, 9 if k % 2 else 2), t, 0.8)); t += 0.03
    seq.append((pip(0.07, 7), t + 0.04, 1.0))
    ch = C.mix(*seq)
    sortir(PAQ, 'r_chirp', fin(ch, 0.4, 0.01), 'qubodup_militaire', nom(BIP),
           "tonalité du bip découpée en 8 impulsions de 22 ms alternant deux hauteurs (+2 et +9 demi-tons), puis un "
           "bip d'accusé de 70 ms (+7 demi-tons)")


# ---------------------------------------------------------------------------------------------------------------------
# Ponctuations (stingers) : percussions et cuivres réels de VSCO 2 CE, tonalité de fa

HZ = {'F2': 87.31, 'C3': 130.81, 'F3': 174.61, 'G#3': 207.65, 'A3': 220.0, 'C4': 261.63, 'F4': 349.23, 'G4': 392.0,
      'F5': 698.46, 'A5': 880.0, 'C6': 1046.5, 'E2': 82.41, 'C2': 65.41}


def inst(rel, note=None, f0=None, seuil=-40):
    """Échantillon VSCO en mono, début à l'attaque, accordé sur note (nom de HZ) et ramené à -1 dBFS."""
    x = af(src(rel), hp(28))
    if note: x = vers(x, f0 or NOTES[rel], HZ[note])
    return C.norm(debut(x, seuil), -1)


def db(g):
    return 10 ** (g / 20)


def tenue(rel, note, dur, points):
    """Note tenue (cuivres « sus » ou cordes) accordée, coupée à dur secondes sous une enveloppe (points en dB)."""
    x = inst(rel, note)[:int(dur * SR)]
    return x * courbe(len(x), points)


def stingers():
    """st_ready, st_capture, st_lost, st_start : courtes ponctuations orchestrales militaires (sans voix).
    Chaque accord joint l'attaque des cuivres staccato à la même note tenue (corps de l'accord, qui s'éteint)."""
    caisse = [inst(r) for r in CAISSE]
    gc = inst(GROSSE_CAISSE)
    timb = inst(TIMBALE[1], 'C3', 121.0)            # timbale (note principale mesurée vers 121 Hz) accordée en do
    timb_f = inst(TIMBALE[0], 'C3', 143.0)

    def st(n):
        return _note('Brass/' + n)
    tuba, tbn, tbn_g, cor, cor_a, cor_f = (st(n) for n in ('Tuba/stac/Tuba3_stac_F1', 'Tenor Trombone/stac/tenortbn_stac_F2',
                                                           'Tenor Trombone/stac/tenortbn_stac_F1', 'F Horn/stac/MOHorn_stac_C3',
                                                           'F Horn/stac/MOHorn_stac_A2', 'F Horn/stac/MOHorn_stac_F2'))
    tp_f, tp_a, tp_c, tp_g = (st('Trumpet/stac/Sum_SHTrumpet_stac_' + n) for n in ('F4', 'A4', 'C5', 'G3'))
    s_tuba, s_tbn_g, s_tbn, s_tbn_c, s_cor_f, s_cor, s_cor_a = (st(n) for n in (
        'Tuba/sus/Tuba3_sus_F1', 'Tenor Trombone/sus/tenortbn_sus_F1', 'Tenor Trombone/sus/tenortbn_sus_F2',
        'Tenor Trombone/sus/tenortbn_sus_C3', 'F Horn/sus/MOHorn_sus_F2', 'F Horn/sus/MOHorn_sus_C3', 'F Horn/sus/MOHorn_sus_A2'))
    s_tp_g, s_tp_f, s_tp_a, s_tp_c = (st('Trumpet/sus/Sum_SHTrumpet_sus_' + n) for n in ('G3', 'F4', 'A4', 'C5'))
    vlc_f, vlc_e, vla_f = (_note('Strings/' + n) for n in ('Cello Section/trem/trem_F2', 'Cello Section/trem/trem_E1',
                                                            'Viola Section/trem/Violas_trem_F3'))

    # série disponible : quinte à vide de do (neutre, « garde-à-vous »), caisse claire en fla, timbale
    e = [(0, -3), (0.2, 0), (0.55, -6), (1.25, -32)]
    x = C.mix((inst(tuba, 'C2'), 0, db(-6)), (inst(tbn, 'C3'), 0, db(-8)), (inst(cor, 'C4'), 0, db(-8)),
              (inst(tp_g, 'G4'), 0, db(-11)), (caisse[2], 0, db(-14)), (caisse[0], 0.028, db(-8)),
              (timb, 0, db(-6)), (gc, 0, db(-14)),
              (tenue(s_tuba, 'C2', 1.3, e), 0.01, db(-10)), (tenue(s_cor_f, 'C3', 1.3, e), 0.01, db(-12)),
              (tenue(s_tbn_c, 'C4', 1.3, e), 0.01, db(-13)), (tenue(s_tp_g, 'G4', 1.3, e), 0.01, db(-17)))
    sortir(PAQ, 'st_ready', fin(x, 1.3, 0.35), 'vsco', 'Brass/*/stac, Brass/*/sus, Percussion',
           "quinte à vide de do (tuba, trombone, cor, trompette) : attaque staccato et notes tenues qui s'éteignent "
           "en 1,2 s, caisse claire en fla (2 coups à 28 ms), timbale accordée en do, grosse caisse")
    # objectif capturé : accord parfait de fa majeur, caisse claire, timbale et grosse caisse
    e = [(0, -4), (0.3, 0), (0.75, -4), (1.45, -32)]
    x = C.mix((inst(tuba, 'F2'), 0, db(-5)), (inst(tbn, 'F3'), 0, db(-8)), (inst(cor, 'C4'), 0, db(-9)),
              (inst(cor_a, 'A3'), 0, db(-10)), (inst(tp_f, 'F5'), 0, db(-11)), (inst(tp_a, 'A5'), 0, db(-13)),
              (inst(tp_c, 'C6'), 0, db(-14)), (caisse[2], 0, db(-14)), (caisse[0], 0.024, db(-7)),
              (timb_f, 0, db(-7)), (gc, 0, db(-10)),
              (tenue(s_tuba, 'F2', 1.5, e), 0.01, db(-10)), (tenue(s_tbn, 'F3', 1.5, e), 0.01, db(-13)),
              (tenue(s_cor, 'C4', 1.5, e), 0.01, db(-13)), (tenue(s_cor_a, 'A3', 1.5, e), 0.01, db(-14)),
              (tenue(s_tp_f, 'F5', 1.5, e), 0.01, db(-17)), (tenue(s_tp_a, 'A5', 1.5, e), 0.01, db(-19)),
              (tenue(s_tp_c, 'C6', 1.5, e), 0.01, db(-20)))
    sortir(PAQ, 'st_capture', fin(x, 1.5, 0.3), 'vsco', 'Brass/*/stac, Brass/*/sus, Percussion',
           "accord de fa majeur (tuba, trombone, cors, trompettes) : attaque staccato et notes tenues qui s'éteignent "
           "en 1,4 s, caisse claire en fla, timbale, grosse caisse")
    # objectif perdu : fa mineur grave (tuba, trombone, cors) qui enfle un peu puis s'éteint, timbale et grosse
    # caisse, trémolo de violoncelles en mi contre fa (seconde mineure) qui monte sous la résonance
    e = [(0, -5), (0.45, 0), (0.9, -3), (1.45, -30)]
    tre = tenue(vlc_e, 'E2', 1.5, [(0, -30), (0.3, -10), (0.9, -6), (1.45, -30)])
    x = C.mix((inst(tuba, 'F2'), 0, db(-4)), (inst(tbn_g, 'F2'), 0, db(-7)), (inst(cor_a, 'G#3'), 0, db(-10)),
              (inst(cor, 'C4'), 0, db(-12)), (timb_f, 0, db(-5)), (gc, 0, db(-6)),
              (tenue(s_tuba, 'F2', 1.5, e), 0.01, db(-8)), (tenue(s_tbn_g, 'F2', 1.5, e), 0.01, db(-11)),
              (tenue(s_cor_a, 'G#3', 1.5, e), 0.01, db(-13)), (tenue(s_cor, 'C4', 1.5, e), 0.01, db(-15)),
              (tre, 0.05, db(-9)))
    sortir(PAQ, 'st_lost', fin(x, 1.5, 0.3), 'vsco', 'Brass/*/stac, Brass/*/sus, Percussion, Strings/Cello Section/trem',
           "accord de fa mineur grave (tuba, trombone, cors) : attaque staccato et notes tenues qui enflent puis "
           "s'éteignent, timbale, grosse caisse, trémolo de violoncelles en mi (seconde mineure) en crescendo")
    # début de partie : impact (grosse caisse, timbale, fa en octaves aux cuivres, caisse claire) puis tension :
    # trémolos de violoncelles et d'altos en fa et mi (neuvième mineure) qui enflent et s'éteignent
    env = [(0, -40), (0.12, -14), (0.8, 0), (1.35, -1), (2.0, -30)]
    x = C.mix((gc, 0, db(-2)), (timb_f, 0, db(-4)), (inst(tuba, 'F2'), 0, db(-3)), (inst(tbn_g, 'F2'), 0, db(-6)),
              (inst(tbn, 'F3'), 0, db(-7)), (inst(cor_f, 'F3'), 0, db(-8)), (caisse[0], 0, db(-10)),
              (tenue(vlc_f, 'F3', 2.0, env), 0.0, db(-2)), (tenue(vla_f, 'F4', 2.0, env), 0.0, db(-6)),
              (tenue(vlc_e, 'E2', 2.0, env), 0.0, db(-3)))
    sortir(PAQ, 'st_start', fin(x, 2.0, 0.25), 'vsco', 'Percussion, Brass/*/stac, Strings/*/trem',
           "impact (grosse caisse, timbale, fa en octaves au tuba, trombones et cor, caisse claire) puis trémolos de "
           "violoncelles et d'altos (fa, mi : neuvième mineure) qui enflent jusqu'à 0,8 s et s'éteignent à 2 s")


def verrou():
    """st_lock : alarme de verrouillage radar courte (0,5 s, rejouée en boucle par le jeu) : trois bips aigus."""
    ton = af(src(VERROU, 0.08, 0.14), hp(500, 3))   # tonalité tenue du premier bip, bourdonnement grave retiré
    ton = af(demitons(ton, 12), lp(4500))            # une octave plus haut (fondamentale vers 800 Hz), arrondie
    b = C.fade(ton[:int(0.075 * SR)], 0.002, 0.006)
    x = C.mix((b, 0, 1.0), (b, 0.12, 1.0), (b, 0.24, 1.0))
    x = np.concatenate([x, np.zeros(int(0.5 * SR) - len(x))])
    sortir(PAQ, 'st_lock', x, 'samsterbirdies', nom(VERROU),
           "tonalité tenue 0,08-0,22 s, passe-haut 500 Hz, transposée d'une octave, passe-bas 4,5 kHz, trois bips de 75 ms espacés de "
           "120 ms, silence jusqu'à 0,5 s (cadence de répétition)")


# ---------------------------------------------------------------------------------------------------------------------
# Voix radio (paquets voix_en et voix_fr) : synthèse vocale Chatterbox Multilingual, puis traitement radio

TTS = C.SRC / 'tts'                                   # WAV générés (24 kHz), relus par build()
VOIX_REF = pathlib.Path(__file__).resolve().parent / 'voix_ref'   # voix de référence, versionnées (une par langue)
# voix de référence de chaque langue : fichier, source (SOURCES) et description pour les crédits
VOIX = {
    'en': {'ref': 'en.flac', 'source': 'ref-en', 'nom': 'voix de référence anglaise'},
    'fr': {'ref': 'fr.flac', 'source': 'ref-fr', 'nom': 'voix de référence française'},
}
# réglages communs de Chatterbox : expressivité (exag), guidage (cfg), température, tirage par défaut
TTS_REGLAGES = {'exag': 0.5, 'cfg': 0.5, 'temp': 0.8, 'seed': 1}
# identifiant : texte, ou (texte, réglages propres à la réplique : seed, exag, cfg, tempo, accélération appliquée après coup).
# Réglages choisis à l'oreille de Whisper (faster-whisper medium) : tirage par défaut, sauf si la réplique sortait déformée ou
# avec une fin inventée ; générés sur processeur (torch 2.6, chatterbox-tts 0.1.7), un autre matériel peut donner d'autres tirages.
PHRASES = {
    'en': {
        'v_uav_ready': 'U.A.V. ready.',             # « UAV » écrit en sigle : sinon lu comme un mot
        'v_air_ready': ('Airstrike ready.', {'exag': 0.7}),
        'v_heli_ready': 'Support helicopter ready.',
        'v_uav_on': 'U.A.V. online.',
        'v_air_on': ('Airstrike inbound.', {'exag': 0.7}),
        'v_heli_on': 'Support helicopter inbound.',
        'v_uav_enemy': 'Enemy U.A.V. spotted.',
        'v_air_enemy': 'Enemy airstrike incoming!',
        'v_heli_enemy': 'Enemy helicopter inbound!',
        # séries ajoutées (octobre 2026, demande du propriétaire) : drone kamikaze, IEM, satellite, mecha
        'v_fpv_ready': 'Kamikaze drone ready.',
        'v_fpv_on': 'Kamikaze drone launched.',
        'v_fpv_enemy': 'Enemy kamikaze drone!',
        'v_iem_ready': 'E.M.P. ready.',
        'v_iem_on': 'E.M.P. deployed.',
        'v_iem_enemy': 'Enemy E.M.P.! Systems jammed!',
        'v_sat_ready': 'Satellite ready.',
        'v_sat_on': 'Satellite online.',
        'v_sat_enemy': 'Enemy satellite overhead.',
        'v_mecha_ready': 'Mecha ready.',
        'v_mecha_on': 'Mecha inbound.',
        'v_mecha_enemy': 'Enemy mecha inbound!',
        'v_cap': 'Objective secured.',
        'v_lost': "We've lost the objective.",
    },
    'fr': {
        'v_uav_ready': 'Drone disponible.',
        'v_air_ready': 'Frappe aérienne disponible.',
        'v_heli_ready': "Hélicoptère d'appui disponible.",
        'v_uav_on': 'Drone en ligne.',
        'v_air_on': 'Frappe aérienne en approche.',
        'v_heli_on': "Hélicoptère d'appui en route.",
        'v_uav_enemy': ('Drone ennemi repéré.', {'seed': 5}),
        'v_air_enemy': 'Frappe aérienne ennemie !',
        'v_heli_enemy': 'Hélicoptère ennemi !',
        'v_fpv_ready': 'Drone kamikaze disponible.',
        'v_fpv_on': 'Drone kamikaze en vol.',
        'v_fpv_enemy': 'Drone kamikaze ennemi !',
        'v_iem_ready': 'I.E.M. disponible.',      # en sigle : sinon lu comme un mot
        'v_iem_on': 'I.E.M. déclenchée.',
        'v_iem_enemy': 'I.E.M. ennemie !',        # (« Brouillage I.E.M. ennemi » et une virgule laissaient des blancs : fin_parole coupait la réplique)
        'v_sat_ready': 'Satellite disponible.',
        'v_sat_on': 'Satellite en ligne.',
        'v_sat_enemy': 'Satellite ennemi en orbite.',
        'v_mecha_ready': 'Mécha disponible.',     # accent : prononcé « méka »
        'v_mecha_on': 'Mécha en approche.',
        'v_mecha_enemy': 'Mécha ennemi en approche !',
        'v_cap': 'Objectif sécurisé.',
        'v_lost': 'Objectif perdu.',
    },
}
VOIX_MAX = 2.0   # durée d'une réplique, en secondes, après le traitement radio (une annonce radio reste brève)
# VOIX_NOUVELLES=1 : seules les répliques sans fichier dans assets/sfx/voix_<langue>/ sont générées ; les autres gardent leur
# enregistrement, son encodage et son crédit (leur WAV de synthèse peut manquer sur cette machine, et un autre matériel donne d'autres tirages)
NOUVELLES = os.environ.get('VOIX_NOUVELLES') == '1'


def deja_faite(lang, sid):
    """Réplique déjà livrée (VOIX_NOUVELLES) : son MP3 existe et son WAV de synthèse manque"""
    return NOUVELLES and (C.ROOT / 'assets' / 'sfx' / f'voix_{lang}' / f'{sid}.mp3').exists() and not (TTS / lang / f'{sid}.wav').exists()


def phrase(lang, sid):
    """(texte, réglages complets) d'une réplique"""
    v = PHRASES[lang][sid]
    texte, propre = (v, {}) if isinstance(v, str) else v
    return texte, {**TTS_REGLAGES, 'tempo': 1.0, **propre}


def chatterbox_correctif():
    """chatterbox-tts 0.1.7 lève IndexError sur une réplique très courte (« One. ») : son analyse d'alignement
    (AlignmentStreamAnalyzer.step) prend les jetons de texte sauf les cinq derniers, une liste vide quand le texte en compte
    cinq ou moins. Sur cette erreur, l'analyse de l'image est sautée (le modèle s'arrête alors de lui-même)."""
    from chatterbox.models.t3.inference import alignment_stream_analyzer as asa
    if getattr(asa.AlignmentStreamAnalyzer.step, 'corrige', False): return
    step = asa.AlignmentStreamAnalyzer.step

    def step_sur(self, logits, next_token=None):
        try: return step(self, logits, next_token=next_token)
        except IndexError:
            self.curr_frame_pos += 1
            return logits
    step_sur.corrige = True
    asa.AlignmentStreamAnalyzer.step = step_sur


def tts_generer(force=False):
    """Génère assets_src/sfx/src/tts/<langue>/<id>.wav (24 kHz) avec Chatterbox Multilingual si le paquet chatterbox-tts est installé.
    Un fichier n'est refait que si son texte, sa voix de référence ou ses réglages ont changé (notés à côté dans <id>.txt), ou avec force.
    Renvoie False si le modèle n'est pas disponible."""
    import hashlib
    try:
        import torch, torchaudio
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except ImportError:
        return False
    os.environ.setdefault('HF_HUB_DISABLE_XET', '1')  # téléchargement par les adresses ordinaires de Hugging Face
    chatterbox_correctif()
    modele = None
    for lang, table in PHRASES.items():
        ref = VOIX_REF / VOIX[lang]['ref']
        empreinte = hashlib.sha1(ref.read_bytes()).hexdigest()[:12]
        for sid in table:
            if deja_faite(lang, sid): continue
            texte, r = phrase(lang, sid)
            p = TTS / lang / f'{sid}.wav'; note = p.with_suffix('.txt')
            cle = f"chatterbox-mtl|{empreinte}|{r['seed']}|{r['exag']}|{r['cfg']}|{r['temp']}|{r['tempo']}|{texte}"
            if p.exists() and note.exists() and note.read_text(encoding='utf-8') == cle and not force: continue
            if modele is None:
                torch.set_num_threads(max(1, os.cpu_count() or 1))
                modele = ChatterboxMultilingualTTS.from_pretrained(device='cuda' if torch.cuda.is_available() else 'cpu')
            torch.manual_seed(r['seed'])
            wav = modele.generate(texte, language_id=lang, audio_prompt_path=str(ref), exaggeration=r['exag'], cfg_weight=r['cfg'], temperature=r['temp'])
            p.parent.mkdir(parents=True, exist_ok=True)
            brut = p.with_suffix('.brut.wav'); torchaudio.save(str(brut), wav, modele.sr)
            filtre = ['-af', f"atempo={r['tempo']}"] if r['tempo'] != 1.0 else []
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(brut), *filtre, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s24le', str(p)], check=True)
            brut.unlink()
            note.write_text(cle, encoding='utf-8')
    return True


def fin_parole(x, seuil=-40, blanc=0.15):
    """Coupe ce qui suit la phrase : au premier blanc de `blanc` s sous `seuil` dB de la crête (tranches de 10 ms) après le début
    de la parole. Après la dernière syllabe, Chatterbox laisse souvent un souffle, le bruit de fond imité de la voix de référence,
    ou une fin inventée (syllabes en trop) ; les répliques n'ont pas de pause intérieure aussi longue."""
    h = int(0.01 * SR); n = len(x) // h
    r = 20 * np.log10(np.sqrt(np.mean(x[:n * h].reshape(n, h) ** 2, axis=1)) + 1e-9); r -= r.max()
    debut, k, bas = int(np.argmax(r > -30)), int(round(blanc / 0.01)), r < seuil
    for i in range(debut, n - k + 1):
        if bas[i:i + k].all(): return x[:i * h + int(0.03 * SR)]
    return x


def radio_voix(x, graine):
    """Traitement radio : passe-bande 300 Hz-3,4 kHz, présence, compression, légère saturation, souffle très bas."""
    x = C.trim(x, -50, 0.003)                        # garde l'occlusion d'une consonne initiale (d, b, g)
    x = x[:C.tail_end(x, -50)]
    x = af(x, hp(300), lp(3400), eq(1800, 3, 0.9), eq(700, -2, 1))
    x = compresser(x, -20, 4, 4, 90)
    x = C.norm(x, -1)
    x = np.tanh(2.2 * x) / np.tanh(2.2)              # saturation douce de l'étage audio
    x = af(x, lp(3600))
    souffle = af(np.random.default_rng(graine).standard_normal(len(x)), hp(400), lp(3200))
    r = np.sqrt(np.mean(x ** 2))
    souffle *= r * 10 ** (-36 / 20) / np.sqrt(np.mean(souffle ** 2))
    return C.fade(x + C.fade(souffle, 0.01, 0.03), 0.001, 0.04)


def voix():
    """v_* : voix radio en anglais (voix_en) et en français (voix_fr), VOIX_MAX s au plus, crête -1 dBFS."""
    tts_generer()
    for k, (lang, table) in enumerate(PHRASES.items()):
        for j, sid in enumerate(table):
            if deja_faite(lang, sid): continue
            texte, r = phrase(lang, sid)
            p = TTS / lang / f'{sid}.wav'
            if not p.exists():
                raise SystemExit(f'{p} manque : installer chatterbox-tts pour générer les voix (voir tts_generer)')
            x = radio_voix(fin_parole(C.load(p)), 1000 * k + j)
            if len(x) > VOIX_MAX * SR: raise ValueError(f'{lang}/{sid} : {len(x) / SR:.2f} s ({VOIX_MAX} s au plus : tempo plus rapide, ou autre tirage)')
            tempo = f", accélérée x{r['tempo']}" if r['tempo'] != 1.0 else ''
            sortir(f'voix_{lang}', sid, x, 'chatterbox', f'tts/{lang}/{sid}.wav',
                   f"« {texte} » (Chatterbox Multilingual, {VOIX[lang]['nom']}, tirage {r['seed']}, expressivité {r['exag']}{tempo}) ; "
                   f"coupée au premier blanc après la phrase ; passe-bande 300 Hz-3,4 kHz, compression, saturation légère, souffle radio à -36 dB")
            couche(sid, VOIX[lang]['source'], f"tools/sfx/voix_ref/{VOIX[lang]['ref']}", 'voix de référence (timbre imité par le modèle)', pack=f'voix_{lang}')


# ---------------------------------------------------------------------------------------------------------------------

def build():
    """Fabrique les masters de la famille. SERIES=voix : seulement les voix radio (paquets voix_fr et voix_en, après l'ajout ou la
    retouche d'une réplique ; ni les sources des autres sons ni leur fabrication ne sont nécessaires) ; les crédits des autres sons
    de la famille sont gardés tels quels dans credits-series.json."""
    import json
    ENTREES.clear()
    if os.environ.get('SERIES', '') == 'voix':
        f = C.MASTERS / 'credits-series.json'
        if not f.exists(): raise SystemExit(f'{f} manque : SERIES=voix garde les crédits des autres sons de la famille')
        ENTREES.extend(e for e in json.loads(f.read_text(encoding='utf-8')) if not e['pack'].startswith('voix_'))
    else:
        jets(); bombes(); helico(); crash(); minigun(); drone(); drone_fpv()
        radio(); stingers(); verrou()
    voix()
    C.write_credits('series', ENTREES)
