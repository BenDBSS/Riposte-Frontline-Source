"""Famille « interface » : sons des menus et de l'équipement (paquet ui).

Sobres, militaires, mécaniques : de vrais interrupteurs (Kenney UI Audio), de vraies pièces d'armes (pistes de
maniement de The Free Firearm Sound Library : crosse, sélecteur, culasse), du foley de Jan Schupke et d'OwlishMedia
(cliquet de menottes, velcro, pulvérisateur, tissu), des souffles d'air de BigSoundBank, un vrai squelch radio
(JovianSounds) et des percussions d'orchestre de VSCO 2 CE (grosse caisse, tambour de frein) pour « déployer ».
Aucun son n'est synthétisé : les sons sans prise dédiée (onglet, verrouillé, déblocage, camouflage, déployer) sont
composés de couches réelles. Ni bip d'application, ni arpège, ni son 8 bits.

Traitement commun : mono 48 kHz, passe-haut adapté à chaque son, début à l'attaque (1 ms gardée au plus),
fondu de sortie, crête à -1 dBFS (le dosage se fait dans le jeu). Les instants de découpe viennent de l'analyse des
sources (enveloppe et spectrogramme)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PAQ = 'ui'

SOURCES = {
    'kenney_ui_audio': {
        'nom': 'Kenney « UI Audio » (miroir Godot de Calinou)',
        'auteur': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/Calinou/kenney-ui-audio',
        'preuve': "addons/kenney_ui_audio/LICENSE.txt : « UI SFX Set by Kenney Vleugels (Kenney.nl) ... License (Creative "
                  "Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/ »",
    },
    'kenney': {
        'nom': 'Kenney « RPG Audio », « Foley Sounds », « Impact Sounds »',
        'auteur': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'preuve': "License.txt de chaque pack : « License: (Creative Commons Zero, CC0) http://creativecommons.org/"
                  "publicdomain/zero/1.0/ »",
    },
    'ffsl': {
        'nom': 'The Free Firearm Sound Library (pistes « Master Tracks » de maniement)',
        'auteur': 'Ben Jaszczak et al. (Still North Media)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary',
        'preuve': "LICENSE du dépôt : texte intégral « CC0 1.0 Universal » ; page OpenGameArt : « The team holds CC0 "
                  "NO RIGHTS RESERVED for this library. It may be used without royalty or credit »",
    },
    'schupke': {
        'nom': '« Fantasy Accessory / Weapons and Apparel SFX Library » (FLAC)',
        'auteur': 'Jan Schupke « Vehicle » (vehiclemusic.eu)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/JanTheLynx/free-game-sfx/tree/master/sound/Jan_Schupke-public_domain_sfx',
        'preuve': "readme.txt du dossier : « Author: Jan Schupke 'Vehicle' ... License: Public Domain "
                  "(https://creativecommons.org/publicdomain/zero/1.0/) ; Origin: opengameart.org/content/fantasy-"
                  "accessory-sfx-library »",
    },
    'owlishmedia': {
        'nom': '« 202 More Sound Effects » (velcro, tissu, pulvérisateur, serrure)',
        'auteur': 'OwlishMedia (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/1993velezpadilla-source/config-old-3/tree/main/assets/audio/cc0_horror_library/'
               'household_foley_owlishmedia',
        'preuve': "SOURCE.txt du dossier : « Title: 202 More Sound Effects ; Creator: OwlishMedia ; License: CC0 / Public "
                  "Domain dedication ; Source: https://opengameart.org/content/202-more-sound-effects » ; même pack "
                  "déclaré CC0-1.0 par novincode/atomcut-library",
    },
    'bigsoundbank': {
        'nom': 'BigSoundBank « Whoosh #4, #5, #9 » (s1796, s1797, s1802)',
        'auteur': 'Joseph Sardin (bigsoundbank.com)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/hugohe3/ppt-master/tree/main/skills/ppt-master/templates/sounds/bigsoundbank',
        'preuve': "templates/sounds/THIRD_PARTY_NOTICES.md : « BigSoundBank identifies the selected files as \"CC0 (public "
                  "domain): Free and royalty-free\" ... The individual source pages identify Joseph Sardin as the author » ; "
                  "templates/sounds/sounds_index.json : https://bigsoundbank.com/whoosh-4-s1796.html, license CC0-1.0 "
                  "(même empreinte SHA-256 que les fichiers téléchargés)",
    },
    'jovian': {
        'nom': '« Radio Sign Off / Squelch » (freesound 524205)',
        'auteur': 'JovianSounds',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/JovianSounds/sounds/524205/',
        'preuve': "CREDITS.md de papegaaij/conceptgame : « assets/sfx/ui-radio-close-r08-a.ogg | Radio Sign Off / Squelch "
                  "| JovianSounds | freesound 524205 | CC0 1.0 »",
    },
    'vsco2': {
        'nom': 'VS Chamber Orchestra: Community Edition (percussions)',
        'auteur': 'Versilian Studios (Sam Gossner, Simon Dalzell)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/sgossner/VSCO-2-CE',
        'preuve': "LICENSE du dépôt : texte intégral « CC0 1.0 Universal » ; Readme.txt : « You are permitted to use these "
                  "samples for ANY purpose » (crédit demandé à Versilian Studios)",
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


def _kui(nom):              # 'switch10'
    return _f(f'kenney-ui-audio/{nom}.wav', _url('Calinou/kenney-ui-audio', 'master', f'addons/kenney_ui_audio/{nom}.wav'))


def _ken(chemin):           # 'kenney-rpg-audio/audio/Audio/metalLatch.ogg'
    return _f('kenney/' + chemin, _url('series-ai/jam-ready-assets', 'main', chemin, lfs=True))


def _ffsl(code):            # 'AR-15/D_17'
    return _f(f'ffsl/{code}.wav', _url('buddingmonkey/FreeFirearmsSFXLibrary', 'main', f'Master Tracks/{code}.wav'))


def _jan(nom):
    return _f(f'schupke/{nom}', _url('JanTheLynx/free-game-sfx', 'master', f'sound/Jan_Schupke-public_domain_sfx/assets/{nom}'))


def _owl(dossier, nom):
    return _f(f'owlishmedia/{nom}', _url('1993velezpadilla-source/config-old-3', 'main',
                                         f'assets/audio/cc0_horror_library/household_foley_owlishmedia/{dossier}/{nom}'))


def _bsb(n):
    return _f(f'bigsoundbank/{n}.wav', _url('hugohe3/ppt-master', 'main', f'skills/ppt-master/templates/sounds/bigsoundbank/{n}.wav'))


def _vsco(chemin):
    return _f(f'vsco/{chemin}', _url('sgossner/VSCO-2-CE', 'master', chemin))    # même dossier local que series.py


KR = 'kenney-rpg-audio/audio/Audio/'
KF = 'kenney-foley-sounds/audio/Audio/'
KI = 'kenney-impact-sounds/audio/Audio/'

SWITCH = {n: _kui(f'switch{n}') for n in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11)}
LATCH = _ken(KR + 'metalLatch.ogg')
BOOK_PLACE = _ken(KR + 'bookPlace2.ogg')
BOOK_CLOSE = _ken(KR + 'bookClose.ogg')
PUNCH_HEAVY = _ken(KI + 'impactPunch_heavy_000.ogg')
HELMET = _ken(KF + 'Swords/hitHelmet2.ogg')

STOCK_OUT, STOCK_IN = _ffsl('AR-15/D_17'), _ffsl('AR-15/D_18')     # crosse déployée / repliée
AK_SELECT = _ffsl('AK-47/C_4')                                       # sélecteur de tir
BOLT_DROP = _ffsl('AR-15/D_13')                                      # culasse relâchée, chargeur plein
AR_DRY = _ffsl('AR-15/D_16')                                         # clic à vide

CUFFS = _jan('handcuffs-metal-lock-01.flac')

VELCRO = _owl('Velcro', 'Velcro_02.wav')
CLOTH = _owl('Cloth', 'Cloth_04.wav')
SPRAY = _owl('Misc', 'Nasal_Spray.wav')
LOCK_RATTLE = _owl('Keys, Locks, Door', 'Key_Lock_Door_33.wav')

WHOOSH_GO, WHOOSH_CLOSE, WHOOSH_OPEN = _bsb('1796'), _bsb('1797'), _bsb('1802')

SQUELCH = _f('conceptgame/ui-radio-close-r08-a.ogg',
             _url('papegaaij/conceptgame', 'main', 'assets/sfx/ui-radio-close-r08-a.ogg', lfs=True))

BDRUM = _vsco('Percussion/BDrumNewhit_v7_rr1_Sum.wav')
BRAKE = _vsco('Percussion/BrakeDrum1_Hammer_v3_Sum.wav')


# ---------------------------------------------------------------------------------------------------------------------
# Outils de traitement

def src(rel, debut=None, duree=None):
    """Source décodée en mono 48 kHz (extrait debut..debut+duree s)."""
    return C.load(C.SRC / rel, start=debut, dur=duree)


def af(x, *filtres):
    """Chaîne de filtres ffmpeg (les éléments vides sont ignorés)."""
    ch = ','.join(f for f in filtres if f)
    return C.ff(x, ch) if ch else x


def hp(f):
    """Passe-haut 24 dB/octave."""
    return f'highpass=f={f}:poles=2,highpass=f={f}:poles=2'


def lp(f):
    """Passe-bas 24 dB/octave."""
    return f'lowpass=f={f}:poles=2,lowpass=f={f}:poles=2'


def eq(f, g, q=1.0):
    return f'equalizer=f={f}:t=q:w={q}:g={g}'


def dbg(d):
    return 10 ** (d / 20)


def transpose(x, demitons):
    """Transposition par changement de vitesse (la durée change avec la hauteur)."""
    if not demitons: return x
    r = 2 ** (demitons / 12)
    return C.ff(x, f'asetrate={int(round(SR * r))},aresample={SR}')


def attaque(x, seuil=-30.0, pre=0.001):
    """Coupe la tête : début pre secondes avant le premier échantillon à seuil dB sous la crête."""
    return C.trim(x, seuil, pre)


def coupe(x, duree, fout):
    """Garde duree secondes, fondu de sortie fout (courbe douce)."""
    return C.fade(x[:int(duree * SR)], 0, min(fout, len(x[:int(duree * SR)]) / SR), 2.0)


def piece(x, fin=0.001):
    """Couche prête à superposer : normalisée, avec un court fondu d'entrée (pas de clic quand elle démarre en retard)."""
    return C.fade(C.norm(x), fin, 0.0)


def enveloppe(x, monte=0.0, tau=None):
    """Montée linéaire (s) puis décroissance exponentielle de constante tau (s)."""
    t = np.arange(len(x)) / SR
    e = np.minimum(1, t / monte) if monte > 0 else np.ones(len(x))
    if tau: e = e * np.exp(-t / tau)
    return x * e


def t_crete(x):
    """Instant de la crête (s)."""
    return int(np.argmax(np.abs(x))) / SR


ENTREES = []


def maitre(sid, x, dmax, source, fichier, detail, fout=0.03, fin_seuil=-64.0):
    """Finit un master : coupe la fin sous fin_seuil, limite à dmax secondes, fondus, crête -1 dBFS, écriture, crédit."""
    x = np.asarray(x, dtype=np.float64)
    x = x[:C.tail_end(x, fin_seuil)]
    if len(x) > int(dmax * SR):
        x = x[:int(dmax * SR)]
        fout = max(fout, min(0.12, dmax * 0.35))
    x = C.fade(x, 0.001, min(fout, len(x) / SR * 0.5))
    x = C.norm(x, -1.0)
    C.save_master(PAQ, sid, x)
    ENTREES.append(C.credit(sid, PAQ, source, fichier, detail))
    return x


def couche(sid, source, fichier, detail):
    """Crédit d'une couche supplémentaire d'un master."""
    ENTREES.append(C.credit(sid, PAQ, source, fichier, detail))


def nom(rel):
    return rel.split('/', 1)[1]


def fr(v, n=2):
    """Nombre décimal écrit à la française (virgule)."""
    return f'{v:.{n}f}'.replace('.', ',')


def ffsl(rel, debut, duree, hpf=120, seuil=-30.0):
    """Extrait d'une piste FFSL (192 kHz, plusieurs prises) : passe-haut, début à l'attaque."""
    return attaque(af(src(rel, debut, duree), hp(hpf)), seuil)


# ---------------------------------------------------------------------------------------------------------------------
# Survol, clic, retour, onglet, cran

def boutons():
    # survol : début d'un vrai interrupteur (à son attaque principale), assourdi et limité à 40 ms. Les trois prises ont
    # le même niveau perçu à 0,4 dB près (switch2, plus soutenu, serait ici 2,6 dB plus fort : il sert au clic)
    for k, n in enumerate((3, 5, 8)):
        x = attaque(af(src(SWITCH[n]), hp(250), lp(4500)), -16)
        x = coupe(x, 0.04, 0.028)
        maitre(f'ui_hover-{k + 1}', x, 0.04, 'kenney_ui_audio', nom(SWITCH[n]),
               f'switch{n} : 40 ms depuis l\'attaque, passe-bande 250 Hz-4,5 kHz (tic feutré), fondu 28 ms')

    # clic : interrupteur mécanique net, un peu de corps sous 250 Hz ; trois prises de même timbre, avec du corps entre
    # 0,5 et 2 kHz (switch3, presque sans corps et centré vers 6 kHz, sonnerait comme un autre bouton : il sert au survol)
    for k, n in enumerate((10, 11, 2)):
        x = attaque(af(src(SWITCH[n]), hp(110), eq(220, 3, 1.0)), -16)
        x = coupe(x, 0.15, 0.09)
        maitre(f'ui_click-{k + 1}', x, 0.15, 'kenney_ui_audio', nom(SWITCH[n]),
               f'switch{n} : début à l\'attaque, 0,15 s, passe-haut 110 Hz, +3 dB à 220 Hz')

    # retour : interrupteur plus doux, transposé vers le grave et assourdi
    for k, (n, tr) in enumerate(((4, -4), (6, -3))):
        x = attaque(af(src(SWITCH[n]), hp(100), lp(5000)), -16)
        x = transpose(x, tr)
        x = coupe(x, 0.2, 0.11)
        maitre(f'ui_back-{k + 1}', x, 0.2, 'kenney_ui_audio', nom(SWITCH[n]),
               f'switch{n} transposé {tr} demi-tons, passe-bas 5 kHz, 0,2 s')

    # onglet : tic d'interrupteur + court glissement de crosse d'AR-15 sur son tube (FFSL D_17, avant le clac)
    for k, (n, deb) in enumerate(((1, 11.605), (7, 9.705))):
        tic = attaque(af(src(SWITCH[n]), hp(200)), -16)
        tic = coupe(tic, 0.12, 0.08)
        gl = af(src(STOCK_OUT, deb, 0.14), hp(700), lp(9000))
        gl = C.fade(enveloppe(gl, 0.015), 0, 0.07, 2.0)
        x = C.mix((piece(tic), 0, 1.0), (piece(gl), 0.01, dbg(-10)))
        sid = f'ui_tab-{k + 1}'
        maitre(sid, x, 0.2, 'kenney_ui_audio', nom(SWITCH[n]),
               f'switch{n} (tic) + glissement de crosse AR-15 FFSL D_17 ({fr(deb, 3)}-{fr(deb + 0.14, 3)} s, passe-bande '
               '700 Hz-9 kHz, -10 dB, à 10 ms)')
        couche(sid, 'ffsl', nom(STOCK_OUT), 'couche de glissement')

    # cran de curseur : une dent du cliquet de menottes (Jan Schupke), 40 ms
    x = attaque(af(src(CUFFS, 0.358, 0.08), hp(600)), -12)
    x = coupe(x, 0.04, 0.026)
    maitre('ui_tick', x, 0.04, 'schupke', nom(CUFFS), 'une dent du cliquet (0,363 s), passe-haut 600 Hz, 40 ms')


# ---------------------------------------------------------------------------------------------------------------------
# Panneaux : ouverture, fermeture, validation, erreur, notification

def panneaux():
    # ouverture : arrachage court de velcro (gilet tactique) + souffle d'air qui s'ouvre
    v = af(src(VELCRO, 0.15, 0.2), hp(300), lp(9000))
    v = C.fade(attaque(v, -20)[:int(0.12 * SR)], 0.001, 0.05, 2.0)
    w = attaque(af(src(WHOOSH_OPEN), hp(150)), -26)
    x = C.mix((piece(v), 0, 1.0), (piece(w), 0.0, dbg(-2)))
    maitre('ui_open', x, 0.5, 'owlishmedia', nom(VELCRO), 'velcro Velcro_02 (0,15-0,27 s, passe-bande 300 Hz-9 kHz) + '
           'souffle BigSoundBank s1802 (début à -26 dB sous sa crête, -2 dB)', fout=0.12)
    couche('ui_open', 'bigsoundbank', nom(WHOOSH_OPEN), 'couche de souffle')

    # fermeture : souffle plus grave + rabat de tissu étouffé
    w = attaque(af(src(WHOOSH_CLOSE), hp(120)), -22)
    pk = int(np.argmax(np.abs(w))) / SR
    r = attaque(af(src(BOOK_CLOSE), hp(80), lp(1800)), -30)
    x = C.mix((piece(w), 0, 1.0), (piece(r), max(0.0, pk - 0.02), dbg(-5)))
    maitre('ui_close', x, 0.4, 'bigsoundbank', nom(WHOOSH_CLOSE), f'souffle s1797 (début à -22 dB sous sa crête) + rabat : '
           f'Kenney bookClose passe-bas 1,8 kHz (-5 dB, à {fr(max(0.0, pk - 0.02))} s)', fout=0.12)
    couche('ui_close', 'kenney', nom(BOOK_CLOSE), 'couche de rabat')

    # validation : loquet métallique (Kenney RPG metalLatch)
    x = attaque(af(src(LATCH), hp(90)), -30)
    maitre('ui_confirm', x, 0.4, 'kenney', nom(LATCH), 'loquet métallique metalLatch, passe-haut 90 Hz')

    # erreur douce : double coup sourd (livre posé à plat : le second coup, repris un ton plus bas)
    k = attaque(af(src(BOOK_PLACE, 0.075, 0.28), hp(70), lp(1600)), -12)
    k = transpose(k, -3)
    k2 = transpose(k, -2)
    x = C.mix((piece(k), 0, 1.0), (piece(k2), 0.09, dbg(-2)))
    maitre('ui_error', x, 0.35, 'kenney', nom(BOOK_PLACE), 'coup sourd de bookPlace2 (second choc, 0,08 s), passe-bas '
           '1,6 kHz, transposé -3 demi-tons, doublé 90 ms plus tard un ton plus bas (-2 dB)', fout=0.1)

    # notification : vrai squelch de fin de transmission radio
    x = attaque(af(src(SQUELCH), hp(200)), -30)
    maitre('ui_notify', x, 0.5, 'jovian', nom(SQUELCH), 'squelch radio, passe-haut 200 Hz', fout=0.08)


# ---------------------------------------------------------------------------------------------------------------------
# Équipement : accessoire monté / retiré, camouflage, verrouillé, débloqué

def glissement(deb=11.605, duree=0.14):
    """Glissement de la crosse d'AR-15 sur son tube, avant le clac (FFSL D_17)."""
    return af(src(STOCK_OUT, deb, duree), hp(500), lp(8000))


def equipement():
    # accessoire monté : glissement bref sur le rail (relevé de 12 dB) puis clac de verrouillage (crosse d'AR-15)
    x = af(src(STOCK_OUT, 11.715, 0.45), hp(150))
    i = int((11.757 - 11.715) * SR)
    g = np.ones(len(x)); g[:i] = dbg(12)
    r = int(0.004 * SR); g[i - r:i] = np.linspace(dbg(12), 1, r)
    x = x * g
    maitre('ui_equip', x, 0.4, 'ffsl', nom(STOCK_OUT), 'AR-15 : crosse déployée (D_17, prise 4, 11,715-12,115 s) : fin du '
           'glissement relevée de 12 dB puis clac de verrouillage à 42 ms, passe-haut 150 Hz', fout=0.12)

    # accessoire retiré : clac de déverrouillage (crosse repliée D_18) puis glissement qui s'éloigne
    clac = ffsl(STOCK_IN, 3.48, 0.35, 150, -30)
    gl = C.fade(enveloppe(glissement(), 0.01, 0.09), 0, 0.05, 2.0)
    x = C.mix((piece(clac), 0, 1.0), (piece(gl), 0.04, dbg(-11)))
    maitre('ui_unequip', x, 0.4, 'ffsl', nom(STOCK_IN), 'AR-15 : clac de crosse repliée (D_18, 3,48 s) + glissement de '
           'crosse (D_17, 11,605-11,745 s, passe-bande 500 Hz-8 kHz, -11 dB, à 40 ms)', fout=0.12)
    couche('ui_unequip', 'ffsl', nom(STOCK_OUT), 'couche de glissement')

    # camouflage : pulvérisation courte (pulvérisateur à pompe) + froissement de tissu
    p = attaque(af(src(SPRAY), hp(400)), -30)
    t = attaque(af(src(CLOTH), hp(150)), -30)
    x = af(C.mix((piece(p), 0, 1.0), (piece(t), 0.0, dbg(-9))), lp(13000))
    maitre('ui_camo', x, 0.6, 'owlishmedia', nom(SPRAY), 'pulvérisateur Nasal_Spray (pression et relâche), passe-haut '
           '400 Hz + froissement Cloth_04 (passe-haut 150 Hz, -9 dB), passe-bas 13 kHz sur l\'ensemble', fout=0.12)
    couche('ui_camo', 'owlishmedia', nom(CLOTH), 'couche de froissement')

    # verrouillé : poignée qui bute (cliquetis sourd de serrure) + clic à vide d'AR-15
    r = attaque(af(src(LOCK_RATTLE), hp(90), lp(2500)), -24)
    d = ffsl(AR_DRY, 0.30, 0.2, 200, -30)
    x = C.mix((piece(r), 0, 1.0), (piece(d), 0.0, dbg(-8)))
    maitre('ui_locked', x, 0.35, 'owlishmedia', nom(LOCK_RATTLE), 'poignée verrouillée Key_Lock_Door_33 (passe-bande '
           '90 Hz-2,5 kHz) + clic à vide AR-15 FFSL D_16 (-8 dB)', fout=0.1)
    couche('ui_locked', 'ffsl', nom(AR_DRY), 'couche de clic à vide')

    # débloqué : clac de sélecteur d'AK-47 + tintement (casque) + résonance métallique (tambour de frein, vers l'aigu)
    clac = ffsl(AK_SELECT, 3.70, 0.4, 150, -30)
    ting = transpose(attaque(af(src(HELMET), hp(1200)), -30), 2)
    fm = transpose(attaque(af(src(BRAKE), hp(800), lp(9000)), -30), 5)
    fm = enveloppe(fm, 0, 0.45)
    x = C.mix((piece(clac), 0, 1.0), (piece(ting), 0.06, dbg(-8)), (piece(fm), 0.06, dbg(-12)))
    maitre('ui_unlock', x, 1.2, 'ffsl', nom(AK_SELECT), 'AK-47 : clac du sélecteur (C_4, 3,70 s) + tintement Kenney '
           'hitHelmet2 transposé +2 demi-tons, passe-haut 1,2 kHz (-8 dB, à 60 ms) + tambour de frein VSCO transposé '
           '+5 demi-tons, passe-bande 0,8-9 kHz, décroissance 0,45 s (-12 dB, à 60 ms)', fout=0.3)
    couche('ui_unlock', 'kenney', nom(HELMET), 'couche de tintement')
    couche('ui_unlock', 'vsco2', nom(BRAKE), 'couche de résonance')


# ---------------------------------------------------------------------------------------------------------------------
# Déployer : souffle qui monte, impact grave, queue métallique

def deployer():
    # souffle qui monte : montée du souffle s1796, transposé de -4 demi-tons et ralenti (plus ample), jusqu'à sa crête
    w = af(transpose(af(src(WHOOSH_GO), hp(100)), -4), 'atempo=0.8')
    i = int(np.argmax(np.abs(w)))
    w = attaque(w[:i + int(0.01 * SR)], -38, 0.0)
    w = C.fade(w, 0.002, 0.012, 1.0)
    t_imp = len(w) / SR - 0.01
    gc = attaque(af(src(BDRUM), hp(30)), -30)[:int(1.6 * SR)]
    gc = enveloppe(gc, 0, 0.6)
    po = attaque(af(src(PUNCH_HEAVY), hp(40), lp(3000)), -30)
    me = ffsl(BOLT_DROP, 0.33, 0.6, 150, -30)
    fm = attaque(af(src(BRAKE), hp(300), lp(7000)), -30)
    fm = transpose(fm, -5)
    fm = enveloppe(fm, 0, 0.5)
    # les crêtes des couches tombent ensemble sur celle de la grosse caisse : la culasse (glissement puis clac 48 ms
    # plus tard) part donc avant l'impact, pendant la fin du souffle, au lieu de claquer en retard (double coup)
    t_pk = t_imp + t_crete(gc)
    x = C.mix((piece(w, 0.002), 0, dbg(-5)), (piece(gc), t_imp, 1.0), (piece(po), max(0.0, t_pk - t_crete(po)), dbg(-5)),
              (piece(me), max(0.0, t_pk - t_crete(me)), dbg(-4)), (piece(fm), t_imp + 0.01, dbg(-8)))
    x = af(x, 'acompressor=threshold=0.25:ratio=3:attack=5:release=120:makeup=1')
    maitre('ui_go', x, 1.8, 'vsco2', nom(BDRUM), 'montée du souffle BigSoundBank s1796 transposé -4 demi-tons et ralenti '
           f'à 80 % ({fr(t_imp)} s, -5 dB), puis impact (crêtes alignées à {fr(t_pk, 3)} s) : grosse caisse VSCO '
           'BDrumNewhit_v7 + coup Kenney impactPunch_heavy_000 (passe-bas 3 kHz, -5 dB) + culasse AR-15 relâchée FFSL D_13 '
           '(-4 dB) ; queue : tambour de frein VSCO transposé -5 demi-tons (-8 dB) ; compression douce', fout=0.5)
    couche('ui_go', 'bigsoundbank', nom(WHOOSH_GO), 'couche de souffle')
    couche('ui_go', 'kenney', nom(PUNCH_HEAVY), 'couche de coup')
    couche('ui_go', 'ffsl', nom(BOLT_DROP), 'couche métallique')
    couche('ui_go', 'vsco2', nom(BRAKE), 'queue métallique')


def build(seulement=None):
    """Fabrique les masters de la famille (seulement : liste de groupes pour les essais)."""
    ENTREES.clear()
    for g in (boutons, panneaux, equipement, deployer):
        if seulement is None or g.__name__ in seulement:
            g()
    if seulement is None:
        C.write_credits('interface', ENTREES)
