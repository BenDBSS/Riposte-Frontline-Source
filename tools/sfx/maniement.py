"""Famille « maniement » : bruitages de maniement des armes, pas, corps et joueur (paquet foley).

Sources (voir SOURCES) : pistes brutes de The Free Firearm Sound Library pour le maniement des armes, NOX SOUND
« Footsteps Essentials » pour les pas, sauts, réceptions et frottements, Hypersomnia pour les douilles, chargeurs et
sorties d'arme, Kenney et artisticdude pour les tissus, sangles, souffles et frottements, quelques prises Freesound CC0
(corps, chair, cœur, acouphène) et la goupille de CGEffex (CC BY 4.0, seule prise réelle trouvée).
Les sons manquants (cuillère de grenade, glissade, cliquetis d'équipement, coups reçus) sont composés de couches
réelles : aucun son n'est synthétisé. Seule retouche « fabriquée » : une couche d'harmoniques (saturation douce d'une
copie grave) sous le cœur et les coups reçus, pour qu'ils restent audibles sur un haut-parleur de téléphone, qui ne
rend rien sous 150 Hz.

Traitement commun : mono 48 kHz, passe-haut (bruit de manipulation, vent), passe-bas 16 kHz (voir maitre()), découpe à
l'attaque (2 ms gardées au plus ; sur le geste décisif quand un frottement le précède, voir net()), fondu de sortie et
fondu sur toute couche coupée net, crête à -1 dBFS (variantes trop fortes baissées : aligne_variantes()). Les pistes FFSL contiennent plusieurs prises séparées de silences : les instants
de découpe ci-dessous viennent de leur analyse (enveloppe et spectrogramme). Chargeur inséré : le clac décisif tombe
dans les 50 premières ms (le jeu déclenche le son à l'instant où le chargeur s'enclenche)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PAQ = 'foley'

SOURCES = {
    'ffsl': {
        'nom': 'The Free Firearm Sound Library (pistes « Master Tracks » de maniement)',
        'auteur': 'Ben Jaszczak et al. (Still North Media)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/buddingmonkey/FreeFirearmsSFXLibrary',
        'preuve': "LICENSE du dépôt : texte intégral « CC0 1.0 Universal » ; page OpenGameArt : « The team holds CC0 "
                  "NO RIGHTS RESERVED for this library. It may be used without royalty or credit »",
    },
    'nox': {
        'nom': 'NOX SOUND « Footsteps - Essentials »',
        'auteur': 'Nox_Sound',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/helzpont/home4/tree/main/assets/audio/Footsteps_Essentials_NOX_SOUND',
        'preuve': "Essentials_Series_README.pdf livré avec le pack : « All these sounds are under CC0 license. »",
    },
    'hypersomnia': {
        'nom': 'Hypersomnia (dossier content/sfx)',
        'auteur': 'TeamHypersomnia',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/TeamHypersomnia/Hypersomnia/tree/master/hypersomnia/content/sfx',
        'preuve': "hypersomnia/content/README.md : « All Hypersomnia game assets (i.e. *everything* under content/) are "
                  "CC0 (Public Domain) »",
    },
    'kenney': {
        'nom': 'Kenney « RPG Audio », « Foley Sounds », « Impact Sounds »',
        'auteur': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'preuve': "License.txt de chaque pack : « License: (Creative Commons Zero, CC0) http://creativecommons.org/"
                  "publicdomain/zero/1.0/ »",
    },
    'artisticdude': {
        'nom': 'RPG Sound Pack',
        'auteur': 'artisticdude (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/tynatsuhara/swamp.camp/tree/master/static/audio/rpg',
        'preuve': "Page OpenGameArt https://opengameart.org/content/rpg-sound-pack : « RPG Sound Pack » par artisticdude, "
                  "licence CC0",
    },
    'cgeffex': {
        'nom': '« Grenade pin pull » (freesound 93837)',
        'auteur': 'CGEffex',
        'licence': 'CC BY 4.0',
        'url': 'https://freesound.org/people/CGEffex/sounds/93837/',
        'preuve': "sounds/CREDITS.md de ryno4ever16/cp2020-augmented : « License: CC BY 4.0 », crédit exigé « \"Grenade "
                  "pin pull\" by CGEffex, licensed CC BY 4.0 » ; relevé plus ancien (Sound/Weapon/License.txt de "
                  "SpeedyVelcro/advanced-invasion) : « CC BY 3.0 » ; même obligation d'attribution dans les deux cas",
        'attribution': '"Grenade pin pull" by CGEffex (freesound.org/s/93837), licensed CC BY 4.0 (découpé, filtré)',
    },
    'danjocross': {
        'nom': '« Clean fast Swoosh » (freesound 507466)',
        'auteur': 'Danjocross',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/Danjocross/sounds/507466/',
        'preuve': "sounds/CREDITS.md de ryno4ever16/cp2020-augmented : « melee-whoosh-2.ogg » = « Clean fast "
                  "Swoosh.aiff » par Danjocross, CC0 1.0 Universal",
    },
    'magnuswaker': {
        'nom': '« Flesh & Blood » : pound of flesh (freesound 522091, 530117)',
        'auteur': 'magnuswaker',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/magnuswaker/packs/29802/',
        'preuve': "_readme_and_license.txt du pack (miroir Weesoid/All-That-Jazz-Project) : « Creative Commons 0 » pour "
                  "522091 et 530117",
    },
    'filmmakersmanual': {
        'nom': '« Bullet - Hit Body » 2, 3 et 6 (freesound 522316, 522315, 522501, pack « Valhalla »)',
        'auteur': 'FilmmakersManual',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/FilmmakersManual/',
        'preuve': "liste de licences du paquet Feel/NiceVibrations (HapticPackCClicense.txt) : une quarantaine de sons "
                  "FilmmakersManual, tous « License: Creative Commons 0 », dont « Bullet - Hit Body (1), (7), (8), (9) » de "
                  "la même série que les prises 2, 3 et 6 (aucune mention propre à celles-ci trouvée) ; README d'ArmorAlley : "
                  "« Bullet - Concrete Hit (2-4) by FilmmakersManual (CC0) » ; Aurora.3 sound/attributions.txt : « licensed "
                  "under CC0 1.0 Universal ... freesound.org/people/FilmmakersManual » (copie : Mooses2k/SecretHistories)",
    },
    'mlsulli': {
        'nom': '« Body Hits_Concrete » (freesound 234853)',
        'auteur': 'mlsulli',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/mlsulli/sounds/234853/',
        'preuve': "README d'ArmorAlley (scottschiller), section Sounds : « Body Hits_Concrete.wav by mlsulli (CC0) »",
    },
    'michorvath': {
        'nom': '« Heart Beating » (freesound 273150)',
        'auteur': 'michorvath',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/michorvath/sounds/273150/',
        'preuve': "docs/CREDITS-sources.md de briossant/ombres : « heartbeat.ogg | freesound 273150 (« Heart Beating ») "
                  "| michorvath | CC0 1.0 »",
    },
    'tnturner': {
        'nom': '« tinnitus » (freesound 377205)',
        'auteur': 'tnturner',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/tnturner/sounds/377205/',
        'preuve': "Sound/Ambient/License.txt de SpeedyVelcro/advanced-invasion : « ./RingingEars.wav \"tinnitus.wav\" By "
                  "tnturner ... CC0 1.0 »",
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


def _ffsl(code):            # 'AR-15/D_5'
    return _f(f'ffsl/{code}.wav', _url('buddingmonkey/FreeFirearmsSFXLibrary', 'main', f'Master Tracks/{code}.wav'))


def _nox(dossier, nom):     # ('Rock_Run', 'Rock_Run_02')
    chemin = f'Footsteps_{dossier.split("_")[0]}/Footsteps_{dossier}/Footsteps_{nom}.wav'
    return _f('nox/' + chemin, _url('helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/' + chemin))


def _hyp(nom):
    return _f(f'hypersomnia/{nom}.ogg', _url('TeamHypersomnia/Hypersomnia', 'master', f'hypersomnia/content/sfx/{nom}.ogg'))


def _ken(chemin):           # 'kenney-rpg-audio/audio/Audio/cloth1.ogg'
    return _f('kenney/' + chemin, _url('series-ai/jam-ready-assets', 'main', chemin, lfs=True))


def _rpg(chemin):           # 'inventory/cloth.wav'
    return _f('artisticdude/' + chemin, _url('tynatsuhara/swamp.camp', 'master', 'static/audio/rpg/' + chemin, lfs=True))


def _cp(nom):
    return _f(f'cp2020/{nom}', _url('ryno4ever16/cp2020-augmented', 'main', f'sounds/{nom}'))


KR = 'kenney-rpg-audio/audio/Audio/'
KF = 'kenney-foley-sounds/audio/Audio/'
KI = 'kenney-impact-sounds/audio/Audio/'

# Free Firearm Sound Library
AR_MAGOUT, AR_MAGIN, AR_CHARGE, AR_DRY = _ffsl('AR-15/D_5'), _ffsl('AR-15/D_4'), _ffsl('AR-15/D_14'), _ffsl('AR-15/D_16')
AR_SAFE = _ffsl('AR-15/D_20')
AK_MAGOUT, AK_MAGIN, AK_CHARGE, AK_DRY = _ffsl('AK-47/C_11'), _ffsl('AK-47/C_10'), _ffsl('AK-47/C_14'), _ffsl('AK-47/C_7')
AK_SELECT = _ffsl('AK-47/C_4')
PPQ_MAGOUT, PPQ_MAGIN = _ffsl('Walther PPQ/X_5'), _ffsl('Walther PPQ/X_4')
PPQ_SLIDE, PPQ_DROP = _ffsl('Walther PPQ/X_10'), _ffsl('Walther PPQ/X_17')
M45_MAGOUT, M45_MAGIN = _ffsl('Carl Gustav M45_Swedish K/G_9'), _ffsl('Carl Gustav M45_Swedish K/G_8')
TIKKA_CYCLE, MOSIN_CYCLE = _ffsl('Tikka/W_16'), _ffsl('Mosin Nagant/M_14')
NOVA_PUMP, DALY_PUMP, NOVA_LOAD = _ffsl('Nova/O_6'), _ffsl('Charles Daly/H_6'), _ffsl('Nova/O_3')
M12_LOAD = _ffsl('Model 12/K_3')

# NOX : pas, sauts, réceptions
CONCRETE = [_nox('Tile_Run', 'Tile_Run_01'), _nox('Tile_Run', 'Tile_Run_02'), _nox('Tile_Run', 'Tile_Run_05'),
            _nox('Tile_Run', 'Tile_Run_06'), _nox('Rock_Walk', 'Rock_Walk_07'), _nox('Rock_Walk', 'Rock_Walk_09')]
GRAVEL = [_nox('Gravel_Run', f'Gravel_Run_{n}') for n in ('02', '03', '06', '09', '10')]
GRASS = [_nox('Grass_Run', f'Grass_Run_{n}') for n in ('09', '12', '13', '14', '15')]
DIRT = [_nox('DirtyGround_Run', f'DirtyGround_Run_{n}') for n in ('01', '02', '04', '06', '08')]
SNOW = [_nox('Snow_Run', f'Snow_Hard_Run_{n}') for n in ('02', '03', '07', '09', '10')]
METAL = [_nox('Metal_Run', 'MetalV1_Run_03'), _nox('Metal_Run', 'MetalV1_Run_08'), _nox('Metal_Run', 'MetalV1_Run_13'),
         _nox('Metal_Run', 'MetalV2_Run_09'), _nox('Metal_Run', 'MetalV1_Run_15')]
WOOD = [_nox('Wood_Run', f'Wood_Run_{n}') for n in ('01', '03', '04', '06', '07')]
WATER = [_nox('Water_Walk', f'WaterV1_Walk_{n}') for n in ('03', '05', '07', '08')]
JUMP = [_nox('Tile_Jump', 'Tile_Jump_Start_03'), _nox('Rock_Jump', 'Rock_Jump_Start_04')]
LAND = [_nox('Tile_Jump', 'Tile_Jump_Land_01'), _nox('Rock_Jump', 'Rock_Jump_Land_03')]
LAND_SOFT = _nox('DirtyGround_Land', 'DirtyGround_Jump_Land_01')
SLIDE_LAND_SOFT = _nox('DirtyGround_Land', 'DirtyGround_Jump_Land_02')
SAND = [_nox('Sand_Run', f'Sand_Run_{n:02d}') for n in (3, 7, 11, 15, 18)]
GRASS_TALL = _f('nox/Footsteps_Grass/Foley_Grass/Footsteps_Grass_Tall_Movement_03.wav',
                _url('helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/Footsteps_Grass/Foley_Grass/'
                     'Footsteps_Grass_Tall_Movement_03.wav'))
DIRT_GRAIN = [DIRT[2], _nox('DirtyGround_Run', 'DirtyGround_Run_07')]

# Hypersomnia
SHELL_1 = [_hyp(f'shell_floor_hit_first_{n}') for n in range(1, 6)]
SHELL_2 = [_hyp(f'shell_floor_hit_second_{n}') for n in range(1, 6)]
SHOTSHELL_1 = [_hyp('shotgun_shell_floor_hit_first_1'), _hyp('shotgun_shell_floor_hit_first_2')]
SHOTSHELL_2 = _hyp('shotgun_shell_floor_hit_second')
MAG_FLOOR = [_hyp('magazine_floor_hit_first'), _hyp('magazine_floor_hit_second'), _hyp('magazine_floor_hit_third')]
MAG_DRAW = _hyp('magazine_draw')
GUN_DRAW, SMG_DRAW, HOLSTER = _hyp('standard_gun_draw'), _hyp('standard_smg_draw'), _hyp('standard_holster')
BACKPACK = _hyp('backpack_wear')
FENCE = [_hyp(f'footstep_fence_{n}') for n in (1, 2, 3)]

# Kenney
CLOTH = [_ken(KR + f'cloth{n}.ogg') for n in range(1, 5)]
CLOTH_BELT = [_ken(KR + 'clothBelt.ogg'), _ken(KR + 'clothBelt2.ogg')]
BELT_HANDLE = [_ken(KR + 'beltHandle1.ogg'), _ken(KR + 'beltHandle2.ogg')]
KNIFE_SLICE = _ken(KR + 'knifeSlice.ogg')
SWORD = [_ken(KF + f'Swords/sword{n}.ogg') for n in (1, 3, 4, 7, 9)]
WOOSH = [_ken(KF + f'Woosh/woosh{n}.ogg') for n in (1, 4, 5, 6)]
DROP_LEATHER = _ken(KR + 'dropLeather.ogg')
PUNCH = [_ken(KI + f'impactPunch_medium_00{n}.ogg') for n in range(3)]
PUNCH_HEAVY = [_ken(KI + f'impactPunch_heavy_00{n}.ogg') for n in range(3)]
SOFT_HEAVY = _ken(KI + 'impactSoft_heavy_000.ogg')

# artisticdude
ARMOR = _rpg('inventory/armor-light.wav')
RPG_CLOTH = [_rpg('inventory/cloth.wav'), _rpg('inventory/cloth-heavy.wav')]
METAL_SMALL = [_rpg('inventory/metal-small1.wav'), _rpg('inventory/metal-small2.wav'), _rpg('inventory/metal-small3.wav')]

# prises Freesound (miroirs GitHub)
PIN = _cp('grenade-pin.ogg')
WHOOSH_DJC = _cp('melee-whoosh-2.ogg')
FLESH = [_f('magnuswaker/522091__magnuswaker__pound-of-flesh-1.ogg', _url('Weesoid/All-That-Jazz-Project', 'master',
         'audio/sounds/522091__magnuswaker__pound-of-flesh-1.ogg')),
         _f('magnuswaker/530117__magnuswaker__pound-of-flesh-3.ogg', _url('Weesoid/All-That-Jazz-Project', 'master',
         'audio/sounds/530117__magnuswaker__pound-of-flesh-3.ogg'))]
BODY = [_f(f'mlsulli/234853__mlsulli__body-hits-concrete_{n}.wav', _url('scottschiller/ArmorAlley', 'master',
        f'assets/audio/wav/234853__mlsulli__body-hits-concrete_{n}.wav')) for n in range(1, 6)]
HIT_BODY = [_f(f'filmmakersmanual/{nm}', _url('Mooses2k/SecretHistories', 'main', f'resources/sounds/impacts/bullets_to_flesh/{nm}',
            lfs=True)) for nm in ('522316__filmmakersmanual__bullet-hit-body-2.wav', '522315__filmmakersmanual__bullet-hit-body-3.wav',
                                  '522501__filmmakersmanual__bullet-hit-body-6.wav')]
HEART = _f('michorvath/heartbeat.ogg', _url('briossant/ombres', 'master', 'public/audio/sfx/heartbeat.ogg'))
TINNITUS = _f('tnturner/RingingEars.wav', _url('SpeedyVelcro/advanced-invasion', 'main', 'Sound/Ambient/RingingEars.wav'))


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


def attaque(x, seuil=-36.0, pre=0.002):
    """Coupe la tête : début pre secondes avant le premier échantillon à seuil dB sous la crête."""
    return C.trim(x, seuil, pre)


def net(x, seuil=-12.0, pre=0.002):
    """Coupe la tête jusqu'au geste décisif : début pre secondes avant que l'enveloppe (efficace sur 2 ms) passe à seuil
    dB sous son maximum. Contrairement à attaque(), un petit bruit isolé (frottement, pré-contact) ne suffit pas à
    déclencher : le son commence sur le clac, le choc ou l'appui."""
    w = int(0.002 * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))
    k = np.nonzero(e > e.max() * dbg(seuil))[0]
    i = max(0, (int(k[0]) - w // 2 if len(k) else 0) - int(pre * SR))
    return x[i:]


def queue(x, duree=0.03):
    """Fondu de sortie d'une couche coupée net (extrait de durée fixe) : sinon la coupure s'entend dans le mélange."""
    return C.fade(x, 0, min(duree, len(x) / SR * 0.5))


def enchaine(parts, xf=0.004):
    """Concatène des morceaux avec un court fondu enchaîné (égal en gain)."""
    out = parts[0]
    n0 = int(xf * SR)
    for p in parts[1:]:
        n = min(n0, len(out), len(p))
        if n <= 1:
            out = np.concatenate([out, p]); continue
        t = np.linspace(0, 1, n)
        out = np.concatenate([out[:-n], out[-n:] * (1 - t) + p[:n] * t, p[n:]])
    return out


def resserre(x, seuil=-34.0, garde=0.05, xf=0.004):
    """Raccourcit les passages calmes entre deux événements : chaque passage sous seuil (dB sous la crête, enveloppe
    de 5 ms) plus long que garde est ramené à garde (on garde son début et sa fin)."""
    w = int(0.005 * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))
    calme = e < C.peak(e) * dbg(seuil)
    g = int(garde * SR)
    parts, i, n = [], 0, len(x)
    k = 0
    while k < n:
        if calme[k]:
            j = k
            while j < n and calme[j]: j += 1
            if j < n and k > 0 and j - k > g:       # passage interne (pas la fin) trop long
                a, b = k + g // 2, j - g // 2
                parts.append(x[i:a]); i = b
            k = j
        else:
            k += 1
    parts.append(x[i:])
    return enchaine(parts, xf)


def enveloppe(x, att=0.015, tau=0.3):
    """Applique une enveloppe : montée linéaire en att secondes puis décroissance exponentielle (constante tau)."""
    t = np.arange(len(x)) / SR
    return x * (np.minimum(1, t / att) if att > 0 else 1) * np.exp(-t / tau)


def monte(x, duree, courbe=1.5):
    """Fondu d'entrée de duree secondes (montée d'un souffle qu'on prend en route)."""
    y = x.copy(); n = min(len(y), int(duree * SR))
    y[:n] *= np.linspace(0, 1, n) ** courbe
    return y


def coupe_bandes(*freqs, q=12):
    """Coupe-bandes étroits (raies d'une prise : sifflement de la pièce ou de l'enregistreur)."""
    return ','.join(f'bandreject=f={f}:width_type=q:w={q}' for f in freqs)


def harmoniques(x, fc=160, drive=5.0, bande=(130, 650)):
    """Couche d'harmoniques d'un son grave : une copie passe-bas est saturée (tanh) et on n'en garde que la bande
    au-dessus de la fondamentale. Un haut-parleur de téléphone ne rend rien sous 150 Hz : l'oreille reconstruit la
    fondamentale à partir de ces harmoniques."""
    b = af(x, lp(fc))
    b = b / max(C.peak(b), 1e-12)
    s = np.tanh(drive * b) / np.tanh(drive)
    return af(s, hp(bande[0]), lp(bande[1]))


ENTREES = []
SIGNAUX = {}   # masters écrits pendant ce build (id -> signal), pour l'alignement des variantes


def maitre(sid, x, dmax, source, fichier, detail, fout=0.04, crete=-1.0, fin_seuil=-62.0):
    """Finit un master : passe-bas 16 kHz, tête sous -50 dB ramenée à 2 ms, fin coupée sous fin_seuil, limite à dmax
    secondes, fondus, crête, écriture, crédit.
    Le passe-bas vient avant la normalisation : le MP3 du jeu (LAME V5) ne garde rien au-dessus de 17 kHz, un
    haut-parleur de téléphone non plus ; certaines prises (douilles, goupille) y mettent plus de la moitié de leur
    énergie, et la crête comme l'alignement des variantes doivent porter sur ce qu'on entendra."""
    x = af(np.asarray(x, dtype=np.float64), lp(16000))
    x = C.trim(x, -50, 0.002)
    x = x[:C.tail_end(x, fin_seuil)]
    if len(x) > int(dmax * SR):
        x = x[:int(dmax * SR)]
        fout = max(fout, min(0.12, dmax * 0.3))
    x = C.fade(x, 0.0015, min(fout, len(x) / SR * 0.5))
    x = C.norm(x, crete)
    C.save_master(PAQ, sid, x)
    SIGNAUX[sid] = x
    ENTREES.append(C.credit(sid, PAQ, source, fichier, detail))
    return x


def sonie(x):
    """Niveau perçu approché d'un bruitage : efficace maximal sur 100 ms glissantes après une pondération proche de la
    courbe K (BS.1770 : passe-haut, plateau +4 dB au-dessus de 2 kHz), limitée à 120 Hz-15 kHz (dBFS). La borne haute
    écarte l'ultrason de certaines prises (douilles), que ni le MP3 ni l'oreille ne gardent."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    hp2 = f ** 4 / (f ** 4 + 120.0 ** 4)                      # passe-haut du 2e ordre à 120 Hz (en puissance)
    shelf = 1 + (dbg(4) - 1) * f ** 2 / (f ** 2 + 1700.0 ** 2)
    X = X * np.sqrt(hp2) * shelf * (f <= 15000)
    y = np.fft.irfft(X, len(x))
    w = min(len(y), int(0.1 * SR))
    return C.db(np.sqrt(np.max(np.convolve(y ** 2, np.ones(w) / w, mode='valid'))))


def aligne_variantes(ecart=3.0):
    """Le jeu tire une variante au hasard : aucune ne doit sonner nettement plus fort que les autres. Dans chaque groupe
    <id>-1, <id>-2..., une variante qui dépasse la plus faible de plus de ecart dB est baissée d'autant (sa crête passe
    alors sous -1 dBFS ; la plus faible garde la sienne à -1 dBFS)."""
    groupes = {}
    for sid in SIGNAUX:
        base, _, n = sid.rpartition('-')
        if base and n.isdigit(): groupes.setdefault(base, []).append(sid)
    for base, ids in groupes.items():
        niv = {sid: sonie(SIGNAUX[sid]) for sid in ids}
        cible = min(niv.values()) + ecart
        for sid in ids:
            if niv[sid] <= cible: continue
            g = cible - niv[sid]
            SIGNAUX[sid] = SIGNAUX[sid] * dbg(g)
            C.save_master(PAQ, sid, SIGNAUX[sid])
            e = next(e for e in ENTREES if e['id'] == sid)
            e['detail'] += f' ; niveau aligné sur les autres variantes ({g:.1f} dB)'.replace('.', ',')


def nom(rel):
    return rel.split('/', 1)[1]


# ---------------------------------------------------------------------------------------------------------------------
# Maniement des armes (FFSL)

def prise(rel, debut, duree, hpf=80, filtres='', seuil=-36.0, decisif=None):
    """Extrait d'une piste FFSL : passe-haut, début à l'attaque (ou, avec decisif, sur le geste décisif : voir net()),
    fondu sur la coupure de fin de l'extrait."""
    x = queue(af(src(rel, debut, duree), hp(hpf), filtres), 0.02)
    return net(x, decisif) if decisif is not None else attaque(x, seuil)


def armes():
    # (id, fichier, début, durée de l'extrait, durée max, filtres, détail) ; les débuts tombent dans un creux juste
    # avant le premier geste utile (bouton, entrée du chargeur) pour que le clac décisif arrive tôt
    t = [
        ('f_magout_rifle-1', AR_MAGOUT, 1.226, 0.65, 0.6, '', 'AR-15 : bouton puis chargeur plein retiré (D_5, 1,226-1,83 s)'),
        ('f_magout_rifle-2', AK_MAGOUT, 0.29, 0.62, 0.6, '', 'AK-47 : levier puis chargeur retiré (C_11, 0,29-0,91 s)'),
        ('f_magin_rifle-1', AR_MAGIN, 1.24, 0.55, 0.6, '', 'AR-15 : chargeur plein enclenché (D_4, extrait 1,24-1,79 s, début sur le premier clac, second clac 22 ms plus tard)'),
        ('f_magin_rifle-2', AK_MAGIN, 0.27, 0.55, 0.6, '', 'AK-47 : chargeur enclenché (C_10, extrait 0,27-0,82 s coupé à l\'attaque : le clac ouvre le son)'),
        ('f_charge_rifle-1', AR_CHARGE, 0.36, 0.7, 0.6, '', 'AR-15 : levier tiré puis relâché (D_14, 0,36-0,96 s)'),
        ('f_charge_rifle-2', AK_CHARGE, 1.10, 0.7, 0.6, '', 'AK-47 : culasse tirée puis relâchée (C_14, prise 2, 1,10-1,70 s)'),
        ('f_magout_pistol', PPQ_MAGOUT, 1.33, 0.55, 0.5, '', 'Walther PPQ : chargeur plein retiré (X_5, 1,33-1,83 s)'),
        ('f_magin_pistol', PPQ_MAGIN, 3.01, 0.5, 0.5, '', 'Walther PPQ : chargeur plein inséré (X_4, prise 2, 3,01-3,51 s)'),
        ('f_slide_pistol-1', PPQ_SLIDE, 0.77, 0.5, 0.5, '', 'Walther PPQ : culasse relâchée (X_10, extrait 0,77-1,27 s, début sur le claquement)'),
        ('f_slide_pistol-2', PPQ_DROP, 1.13, 0.5, 0.5, '', 'Walther PPQ : culasse relâchée, chargeur plein (X_17, extrait 1,13-1,63 s, début sur le claquement)'),
        ('f_magout_smg', M45_MAGOUT, 0.455, 0.5, 0.5, '', 'Carl Gustav M45 : chargeur retiré (G_9, 0,455-0,955 s)'),
        ('f_magin_smg', M45_MAGIN, 1.85, 0.5, 0.5, '', 'Carl Gustav M45 : chargeur enclenché (G_8, prise 2, extrait 1,85-2,35 s coupé à l\'attaque : le clac ouvre le son)'),
        ('f_pump-1', NOVA_PUMP, 1.01, 0.7, 0.6, '', 'Benelli Nova : pompe aller-retour (O_6, 1,01-1,61 s)'),
        ('f_pump-2', DALY_PUMP, 1.21, 0.7, 0.6, coupe_bandes(9690, q=15), 'Charles Daly cal. 12 : pompe aller-retour (H_6, '
         '1,21-1,81 s), coupe-bande à 9,69 kHz (le tube sonne entre les deux temps)'),
        ('f_dry-1', AR_DRY, 0.35, 0.25, 0.2, '', 'AR-15 : clic à vide (D_16, 0,35-0,55 s)'),
        ('f_dry-2', AK_DRY, 0.31, 0.25, 0.2, '', 'AK-47 : clic à vide (C_7, 0,31-0,51 s)'),
    ]
    # sons dont le geste décisif (clac, claquement) doit ouvrir le son : le petit frottement qui le précède est coupé
    decisif = {'f_magin_rifle-1': -12, 'f_slide_pistol-1': -12, 'f_slide_pistol-2': -12}
    for sid, rel, d, du, dmax, filtres, detail in t:
        x = prise(rel, d, du, filtres=filtres, decisif=decisif.get(sid))
        maitre(sid, x, dmax, 'ffsl', nom(rel), detail + ' ; passe-haut 80 Hz, mono, début à l\'attaque, fondu')

    # verrou : cycle complet (lever, tirer, pousser, rabattre), passages calmes raccourcis pour tenir en 0,9 s
    for sid, rel, d, du, detail in [
        ('f_bolt-1', TIKKA_CYCLE, 0.27, 1.4, 'Tikka T3 : cycle complet du verrou (W_16, 0,27-1,67 s)'),
        ('f_bolt-2', MOSIN_CYCLE, 0.53, 1.35, 'Mosin-Nagant : cycle complet du verrou (M_14, 0,53-1,88 s)'),
    ]:
        x = prise(rel, d, du)
        x = resserre(x, -30, 0.05)
        maitre(sid, x, 0.9, 'ffsl', nom(rel), detail + ' ; silences entre les 4 temps raccourcis à 50 ms, passe-haut 80 Hz')

    # cartouche poussée dans le tube : choc du culot puis glissement et verrou de tube
    for sid, rel, d, du, detail in [
        ('f_shell-1', NOVA_LOAD, 1.53, 0.42, 'Benelli Nova : cartouche poussée dans le tube (O_3, prise 1, 1,53-1,95 s)'),
        ('f_shell-2', NOVA_LOAD, 11.76, 0.5, 'Benelli Nova : cartouche poussée dans le tube (O_3, prise 3, 11,76-12,26 s)'),
        ('f_shell-3', M12_LOAD, 1.58, 0.42, 'Winchester Model 12 : cartouche poussée dans le tube (K_3, 1,58-2,00 s)'),
    ]:
        x = prise(rel, d, du)
        x = resserre(x, -30, 0.04)
        maitre(sid, x, 0.35, 'ffsl', nom(rel), detail + ' ; silences raccourcis, passe-haut 80 Hz')

    # paume qui tape le chargeur : clac d'enclenchement de l'AR-15 + coup mat de la main
    # (les deux couches sont calées sur leur choc : la prise du coup de poing frotte 30 ms avant de frapper)
    clac = prise(AR_MAGIN, 1.20, 0.25, decisif=-12)
    main = enveloppe(af(net(src(PUNCH[1]), -12), hp(150), lp(2500)), 0.0005, 0.03)
    x = C.mix((C.norm(clac), 0.0, 1.0), (C.norm(main), 0.0, dbg(-7)))
    maitre('f_slap', x, 0.2, 'ffsl', nom(AR_MAGIN), 'AR-15 : clac de D_4 (extrait 1,20-1,45 s, début sur le clac) + coup '
           'de poing Kenney impactPunch_medium_001 calé sur son choc, filtré (150 Hz-2,5 kHz, résonance coupée à 30 ms, -7 dB)')
    ENTREES.append(C.credit('f_slap', PAQ, 'kenney', nom(PUNCH[1]), 'couche « main » du clac de chargeur'))


# ---------------------------------------------------------------------------------------------------------------------
# Sortie, rangement, épaulé, couteau, grenade, ramassage

def tissu(rel, debut=0.0, duree=None, hpf=150, lpf=None, seuil=-40):
    """Couche de tissu, sangle ou équipement : passe-haut, début à l'attaque ; un extrait de durée fixe finit en fondu."""
    x = src(rel, debut, duree)
    if duree is not None: x = queue(x)
    return attaque(af(x, hp(hpf), lp(lpf) if lpf else ''), seuil)


def gestes():
    # sortie d'arme : remixes Hypersomnia (tissu + sangle + clics) avec une sangle Kenney
    for sid, rel, belt, detail in [
        ('f_draw-1', GUN_DRAW, CLOTH_BELT[1], 'Hypersomnia standard_gun_draw + sangle Kenney clothBelt2 (-10 dB)'),
        ('f_draw-2', SMG_DRAW, CLOTH_BELT[0], 'Hypersomnia standard_smg_draw + sangle Kenney clothBelt (-10 dB)'),
    ]:
        x = tissu(rel, hpf=90)
        b = tissu(belt, 0.0, 0.4, hpf=300)
        x = C.mix((C.norm(x), 0, 1.0), (C.norm(b), 0.0, dbg(-10)))
        maitre(sid, x, 0.5, 'hypersomnia', nom(rel), detail + ' ; passe-haut, 0,5 s')
        ENTREES.append(C.credit(sid, PAQ, 'kenney', nom(belt), 'couche de sangle'))

    # rangement : rengainage Hypersomnia, et tissu + sangle + clic de crosse
    x = tissu(HOLSTER, hpf=90)
    maitre('f_stow-1', x, 0.5, 'hypersomnia', nom(HOLSTER), 'standard_holster, passe-haut 90 Hz, 0,5 s')
    a = tissu(RPG_CLOTH[1], hpf=150)
    b = prise(AR_SAFE, 0.29, 0.25, hpf=200)
    x = C.mix((C.norm(a), 0, dbg(-3)), (C.norm(b), 0.16, dbg(-6)))
    maitre('f_stow-2', x, 0.5, 'artisticdude', nom(RPG_CLOTH[1]), 'tissu cloth-heavy + clic de sûreté AR-15 FFSL D_20 '
           '(-6 dB, à 160 ms)')
    ENTREES.append(C.credit('f_stow-2', PAQ, 'ffsl', nom(AR_SAFE), 'couche de clic'))

    # épaulé : froissement bref + petit clic
    for sid, c, clic, dc, detail in [
        ('f_ads-1', CLOTH[1], AR_SAFE, 0.29, 'tissu Kenney cloth2 + clic de sûreté AR-15 (D_20)'),
        ('f_ads-2', CLOTH[3], AK_SELECT, 2.715, 'tissu Kenney cloth4 + clic de sélecteur AK-47 (C_4)'),
    ]:
        a = tissu(c, 0.0, 0.3, hpf=250)
        b = prise(clic, dc, 0.2, hpf=300)
        x = C.mix((C.norm(a), 0, dbg(-4)), (C.norm(b), 0.06, dbg(-9)))
        maitre(sid, x, 0.3, 'kenney', nom(c), detail + ' (-9 dB, à 60 ms), passe-haut 250 Hz')
        ENTREES.append(C.credit(sid, PAQ, 'ffsl', nom(clic), 'couche de clic'))

    # couteau : souffle rapide (souffle de bâton transposé vers l'aigu, pris 35-40 ms avant son maximum) + fil de lame ;
    # le souffle Danjocross tient un sifflement de 750 Hz pendant 250 ms : il s'éteint ici en 0,1 s après son maximum
    for k, (w, st, lame, d0, tau) in enumerate([(WOOSH[0], 6, SWORD[0], 0.035, None), (WHOOSH_DJC, 3, SWORD[1], 0.04, 0.1),
                                                 (WOOSH[2], 7, SWORD[2], 0.035, None)]):
        x = transpose(af(src(w), hp(200)), st)
        i = int(np.argmax(np.abs(x)))
        x = monte(x[max(0, i - int(d0 * SR)):], d0)
        if tau:
            t = np.arange(len(x)) / SR - d0
            x = x * np.where(t > 0, np.exp(-np.maximum(t, 0) / tau), 1.0)
        b = enveloppe(attaque(af(src(lame), hp(1500)), -40), 0.004, 0.06)
        y = af(C.mix((C.norm(x), 0, 1.0), (C.norm(b), d0 - 0.01, dbg(-13))), hp(300), eq(4000, 2, 1.0))
        sid = f'f_knife-{k + 1}'
        src_w = 'danjocross' if w == WHOOSH_DJC else 'kenney'
        maitre(sid, y, 0.35, src_w, nom(w), f'souffle {nom(w)} transposé +{st} demi-tons, pris {d0 * 1000:.0f} ms avant son '
               f'maximum' + (f', éteint en {tau:.1f} s après'.replace('.', ',') if tau else '') + f' + fil de lame Kenney '
               f'{nom(lame)} (passe-haut 1,5 kHz, -13 dB), passe-haut 300 Hz', fout=0.1)
        if src_w != 'kenney': ENTREES.append(C.credit(sid, PAQ, 'kenney', nom(lame), 'couche de lame'))

    # couteau qui touche : chair (magnuswaker, sans son grondement de prise) + coup mat + entaille + tissu
    for k, fl in enumerate(FLESH):
        chair = enveloppe(attaque(af(src(fl), hp(160), lp(7000), eq(350, 3, 1.0)), -30), 0.0005, 0.09)
        coup = enveloppe(attaque(af(src(PUNCH[2 - k]), hp(120), lp(2000)), -30), 0.0005, 0.05)
        lame = enveloppe(af(attaque(src(KNIFE_SLICE, 0.18 + 0.02 * k, 0.3), -36), hp(900)), 0.002, 0.07)
        drap = enveloppe(attaque(af(src(RPG_CLOTH[1]), hp(300)), -36), 0.005, 0.12)
        x = C.mix((C.norm(chair), 0, 1.0), (C.norm(coup), 0, dbg(-6)), (C.norm(lame), 0.0, dbg(-9)), (C.norm(drap), 0.005, dbg(-12)))
        sid = f'f_knife_hit-{k + 1}'
        maitre(sid, x, 0.35, 'magnuswaker', nom(fl), 'coup dans la chair (passe-bande 160 Hz-7 kHz, +3 dB à 350 Hz, décroissance '
               '90 ms) + coup de poing Kenney (-6 dB) + entaille Kenney knifeSlice (-9 dB) + tissu artisticdude cloth-heavy '
               '(-12 dB)', fout=0.12)
        ENTREES.append(C.credit(sid, PAQ, 'kenney', nom(KNIFE_SLICE), 'couches de coup et de lame'))
        ENTREES.append(C.credit(sid, PAQ, 'artisticdude', nom(RPG_CLOTH[1]), 'couche de tissu'))

    # goupille : la seule prise réelle trouvée (CGEffex, CC BY 4.0) ; on prend la fin du glissement de la goupille
    x = monte(af(src(PIN, 1.545, 0.45), hp(400)), 0.008)
    maitre('f_pin', x, 0.4, 'cgeffex', nom(PIN), 'prise 2 (1,545-1,995 s : fin du glissement puis anneau libéré à 65 ms), '
           'passe-haut 400 Hz (bruit de manipulation)')

    # cuillère : clac sec du levier (sélecteur AK-47) + petit objet métallique qui tinte
    clic = prise(AK_SELECT, 3.745, 0.25, hpf=300, decisif=-12)
    ting = transpose(af(attaque(src(METAL_SMALL[1])), hp(1500)), 5)
    x = C.mix((C.norm(clic), 0, dbg(-2)), (C.norm(ting), 0.008, dbg(-5)))
    maitre('f_spoon', x, 0.4, 'ffsl', nom(AK_SELECT), 'clac du sélecteur AK-47 (C_4, extrait à 3,745 s, début sur le clac) '
           '+ tintement artisticdude metal-small2 transposé +5 demi-tons (-5 dB, à 8 ms)')
    ENTREES.append(C.credit('f_spoon', PAQ, 'artisticdude', nom(METAL_SMALL[1]), 'couche de tintement'))

    # lancer : souffle de bras + froissement
    for k, (w, c) in enumerate([(WOOSH[0], CLOTH[0]), (WOOSH[2], CLOTH[2])]):
        a = af(attaque(src(w), -40), hp(200))
        b = tissu(c, 0.0, 0.35, hpf=200)
        x = C.mix((C.norm(a), 0.03, 1.0), (C.norm(b), 0, dbg(-6)))
        sid = f'f_throw-{k + 1}'
        maitre(sid, x, 0.4, 'kenney', nom(w), f'souffle {nom(w)} + froissement {nom(c)} (-6 dB)')

    x = tissu(RPG_CLOTH[0], hpf=200)
    maitre('f_windup', x, 0.3, 'artisticdude', nom(RPG_CLOTH[0]), 'froissement de tissu, passe-haut 200 Hz')

    # ramassage : froissement + chargeurs qui s'entrechoquent
    for k, (c, m) in enumerate([(CLOTH[0], MAG_DRAW), (CLOTH[1], METAL_SMALL[2])]):
        a = tissu(c, 0.0, 0.5, hpf=200)
        b = af(attaque(src(m)), hp(250))
        x = C.mix((C.norm(a), 0, dbg(-5)), (C.norm(b), 0.05, dbg(-2)))
        sid = f'f_pickup-{k + 1}'
        src_b = 'hypersomnia' if m == MAG_DRAW else 'artisticdude'
        maitre(sid, x, 0.5, 'kenney', nom(c), f'froissement {nom(c)} (-5 dB) + {nom(m)} (à 50 ms)')
        ENTREES.append(C.credit(sid, PAQ, src_b, nom(m), 'couche métallique'))


# ---------------------------------------------------------------------------------------------------------------------
# Chutes : chargeurs, douilles, étuis

RAIES_ETUIS = (443, 466)   # raie qui tient entre les rebonds des étuis de pompe Hypersomnia (elle glisse de 439 à 469 Hz)


def chutes():
    # chargeur au sol : premier choc (le premier, très aigu, reçoit le corps du troisième) + rebond. Chaque prise frotte
    # ou touche à peine 10 à 60 ms avant son choc principal : les couches sont calées sur leur choc (net)
    choc = [net(src(r), -12) for r in MAG_FLOOR]
    x = C.mix((C.norm(choc[0]), 0, 1.0), (C.norm(choc[2]), 0.003, dbg(-4)), (C.norm(choc[1]), 0.14, dbg(-8)))
    maitre('f_magdrop-1', af(x, hp(80)), 0.5, 'hypersomnia', nom(MAG_FLOOR[0]), 'chargeur au sol : magazine_floor_hit_first '
           '+ corps de magazine_floor_hit_third (-4 dB, à 3 ms) + rebond magazine_floor_hit_second à 0,14 s (-8 dB), '
           'chaque prise calée sur son choc principal')
    x = C.mix((C.norm(choc[2]), 0, 1.0), (C.norm(transpose(choc[0], 2)), 0.11, dbg(-7)))
    maitre('f_magdrop-2', af(x, hp(80)), 0.5, 'hypersomnia', nom(MAG_FLOOR[2]), 'chargeur au sol : magazine_floor_hit_third '
           '+ rebond magazine_floor_hit_first transposé +2 demi-tons à 0,11 s (-7 dB), chaque prise calée sur son choc')

    # douilles : prises à 96 kHz dont l'essentiel de l'énergie est au-dessus de 17 kHz (inaudible, perdue au MP3) ;
    # passe-bas avant de caler chaque prise sur son choc
    for k in range(4):
        a = net(af(src(SHELL_1[k]), lp(16000)), -20)
        b = net(af(src(SHELL_2[(k + 2) % 5]), lp(16000)), -20)
        off = (0.09, 0.13, 0.11, 0.15)[k]
        x = af(C.mix((C.norm(a), 0, 1.0), (C.norm(b), off, dbg(-6))), hp(300))
        maitre(f'f_brass-{k + 1}', x, 0.6, 'hypersomnia', nom(SHELL_1[k]),
               f'douille de laiton : premier choc + {nom(SHELL_2[(k + 2) % 5])} à ' + f'{off:.2f}'.replace('.', ',') + ' s (-6 dB), '
               'passe-bande 300 Hz-16 kHz, chocs calés')

    # sol meuble : un grain de terre transposé d'une octave (petit objet qui se plante) + le tic du laiton, sans sa
    # résonance (passe-haut 2,5 kHz, raies de la douille coupées, amorti en 6 ms)
    for k, (sh, dg) in enumerate([(2, 0), (3, 1)]):
        tic = enveloppe(attaque(af(src(SHELL_1[sh]), hp(2500), coupe_bandes(7260, 9420, q=6)), -30), 0.0003, 0.006)
        terre = enveloppe(af(transpose(attaque(af(src(DIRT_GRAIN[dg]), hp(80)), -30), 12), hp(250)), 0.0005, 0.03)
        x = C.mix((C.norm(terre), 0, 1.0), (C.norm(tic), 0.0, dbg(-7)))
        sid = f'f_brass_soft-{k + 1}'
        maitre(sid, x, 0.4, 'nox', nom(DIRT_GRAIN[dg]), f'douille sur terre : pas NOX sur terre transposé +12 demi-tons, amorti en '
               f'30 ms + tic de {nom(SHELL_1[sh])} (passe-haut 2,5 kHz, résonances coupées, -7 dB)', fout=0.06)
        ENTREES.append(C.credit(sid, PAQ, 'hypersomnia', nom(SHELL_1[sh]), 'couche de laiton'))

    # étuis de pompe : la prise sonne d'une raie vers 450 Hz qui dure entre les rebonds (résonance du sol) : coupée
    for k in range(2):
        a = attaque(src(SHOTSHELL_1[k]))
        b = attaque(src(SHOTSHELL_2))
        x = af(C.mix((C.norm(a), 0, 1.0), (C.norm(b), 0.12 + 0.04 * k, dbg(-5))), hp(120), coupe_bandes(*RAIES_ETUIS, q=10), coupe_bandes(12750, 16210, q=15))
        maitre(f'f_shells-{k + 1}', x, 0.6, 'hypersomnia', nom(SHOTSHELL_1[k]),
               f'étui plastique de cartouche : premier choc + rebond shotgun_shell_floor_hit_second (-5 dB), raies de 440-470 Hz, 12,75 et 16,2 kHz coupées')


# ---------------------------------------------------------------------------------------------------------------------
# Pas (NOX)

def pas_un(rel, hpf=80, filtres='', duree=0.3, seuil=-30, decisif=None):
    x = src(rel)
    x = C.norm(x, -1)
    x = af(x, hp(hpf), filtres)
    x = net(x, decisif) if decisif is not None else attaque(x, seuil)
    x = x[:int(duree * SR)]
    return C.fade(x, 0.0015, duree * 0.45, 2.0)


def pas():
    surfaces = [
        ('s_concrete', CONCRETE, 90, eq(3500, 5, 1.2) + ',' + eq(250, -2, 1.0), 0.30, 'béton/carrelage, aigus relevés (+5 dB à 3,5 kHz)'),
        ('s_gravel', GRAVEL, 80, '', 0.33, 'gravier'),
        ('s_grass', GRASS, 80, '', 0.30, 'herbe'),
        ('s_dirt', DIRT, 70, '', 0.30, 'terre battue'),
        ('s_snow', SNOW, 70, '', 0.30, 'neige tassée qui crisse'),
        ('s_wood', WOOD, 70, eq(2000, 2, 1.0), 0.30, 'plancher creux'),
        ('s_water', WATER, 80, '', 0.35, 'pataugeage dans une flaque'),
    ]
    for base, files, hpf, filtres, duree, detail in surfaces:
        for k, rel in enumerate(files):
            x = pas_un(rel, hpf, filtres, duree)
            maitre(f'{base}-{k + 1}', x, 0.35, 'nox', nom(rel), f'un pas, {detail} ; passe-haut {hpf} Hz, {duree:.2f} s'.replace('.', ','))

    # tôle et passerelle : les pas NOX sur métal sont mats (plaque épaisse) ; on leur ôte le grondement de la plaque et
    # on ajoute le cliquetis bref d'un grillage (Hypersomnia footstep_fence, aigus seuls, amorti en 50 ms)
    for k, rel in enumerate(METAL):
        p = pas_un(rel, 110, eq(2500, 5, 1.0) + ',' + eq(180, -3, 1.0), 0.33)
        g = enveloppe(attaque(af(src(FENCE[k % 3]), hp(1800)), -30), 0.001, 0.05)
        x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.004, dbg(-12)))
        sid = f's_metal-{k + 1}'
        maitre(sid, x, 0.35, 'nox', nom(rel), 'un pas sur tôle : passe-haut 110 Hz, +5 dB à 2,5 kHz, -3 dB à 180 Hz + cliquetis de '
               f'grillage {nom(FENCE[k % 3])} (passe-haut 1,8 kHz, -12 dB)', fout=0.1)
        ENTREES.append(C.credit(sid, PAQ, 'hypersomnia', nom(FENCE[k % 3]), 'couche de grillage'))


# ---------------------------------------------------------------------------------------------------------------------
# Corps du joueur : équipement, saut, réception, glissade

def equipement(k):
    """Couche de cliquetis d'équipement (sangles, boucles, chargeurs) ; ses sources sont dans EQUIPEMENT[k]."""
    if k == 0:
        a = tissu(ARMOR, 0.0, 0.3, hpf=300)
        b = tissu(CLOTH[1], 0.0, 0.25, hpf=250)
        return C.mix((C.norm(a), 0, dbg(-3)), (C.norm(b), 0, dbg(-6)))
    if k == 1:
        a = tissu(CLOTH_BELT[1], 0.0, 0.3, hpf=300)
        return C.norm(a)
    if k == 2:
        a = tissu(BACKPACK, 0.0, 0.3, hpf=200)
        return C.norm(a)
    a = tissu(BELT_HANDLE[1], 0.05, 0.3, hpf=400)
    b = tissu(CLOTH[3], 0.0, 0.25, hpf=250)
    return C.mix((C.norm(a), 0.0, dbg(-4)), (C.norm(b), 0, dbg(-5)))


EQUIPEMENT = [[('artisticdude', ARMOR), ('kenney', CLOTH[1])], [('kenney', CLOTH_BELT[1])], [('hypersomnia', BACKPACK)],
              [('kenney', BELT_HANDLE[1]), ('kenney', CLOTH[3])]]


def credite_equipement(sid, k, deja=()):
    """Crédits des couches d'équipement k d'un master (sauf le fichier déjà crédité comme source principale)."""
    for source, rel in EQUIPEMENT[k]:
        if rel not in deja: ENTREES.append(C.credit(sid, PAQ, source, nom(rel), 'couche d\'équipement'))


def corps():
    det = ['brigandine artisticdude armor-light + tissu Kenney cloth2', 'sangle et boucle Kenney clothBelt2',
           'sac Hypersomnia backpack_wear', 'poignée de ceinture Kenney beltHandle2 + tissu cloth4']
    for k in range(4):
        x = equipement(k)
        source, rel = EQUIPEMENT[k][0]
        maitre(f's_gear-{k + 1}', x, 0.3, source, nom(rel), det[k] + ', passe-haut, 0,3 s')
        credite_equipement(f's_gear-{k + 1}', k, (rel,))

    # impulsion : les prises NOX Jump_Start frottent avant l'appui ; le son commence au premier appui franc
    for k, rel in enumerate(JUMP):
        p = pas_un(rel, 80, '', 0.35, decisif=-12)
        g = equipement(k + 1)
        x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.02, dbg(-8)))
        maitre(f's_jump-{k + 1}', x, 0.35, 'nox', nom(rel), 'impulsion NOX Jump_Start (début au premier appui franc) + '
               'cliquetis d\'équipement (-8 dB)')
        credite_equipement(f's_jump-{k + 1}', k + 1)

    for k, rel in enumerate(LAND):
        p = pas_un(rel, 70, eq(3000, 3, 1.0), 0.45, -30)
        g = equipement((k + 2) % 4)
        x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.015, dbg(-9)))
        maitre(f's_land-{k + 1}', x, 0.45, 'nox', nom(rel), 'réception NOX Jump_Land + cliquetis d\'équipement (-9 dB)')
        credite_equipement(f's_land-{k + 1}', (k + 2) % 4)
    # sur terre, la prise touche deux fois du bout du pied (21 et 56 ms) avant la réception (88 ms) : début sur celle-ci
    p = pas_un(LAND_SOFT, 60, '', 0.45, decisif=-4)
    g = equipement(0)
    x = C.mix((C.norm(p), 0, 1.0), (C.norm(g), 0.015, dbg(-11)))
    maitre('s_land_soft', x, 0.45, 'nox', nom(LAND_SOFT), 'réception sur terre NOX (début sur l\'appui principal) + '
           'cliquetis d\'équipement (-11 dB)')
    credite_equipement('s_land_soft', 0)

    # glissade : une seule, celle sur terre, pour toutes les surfaces (la glissade sur sol dur, pierre traînée Kenney, a été
    # retirée en 2.32.2 à la demande du propriétaire)
    # appui sur terre + grains de pas dans le sable superposés en traînée qui s'éteint
    # + herbes hautes traversées (NOX Foley_Grass)
    entree = attaque(af(src(SLIDE_LAND_SOFT), hp(70)), -30)
    grains = [(C.norm(attaque(af(src(rel), hp(300)), -30)), 0.03 + i * 0.085 + (0.0, 0.012, 0.004, 0.017, 0.008)[i], dbg(-3 - 2.2 * i))
              for i, rel in enumerate(SAND)]
    fr = C.mix(*grains)
    herbe = attaque(af(src(GRASS_TALL), hp(250)), -30)[:int(0.8 * SR)]
    herbe = enveloppe(herbe, 0.02, 0.35)
    x = C.mix((C.norm(entree), 0, 0.8), (C.norm(fr), 0.0, dbg(-2)), (C.norm(herbe), 0.01, dbg(-5)))
    maitre('s_slide_soft', x, 0.8, 'nox', nom(SLIDE_LAND_SOFT), 'appui NOX sur terre + 5 pas NOX dans le sable superposés tous '
           'les 85 ms en s\'éteignant (frottement) + herbes hautes NOX Foley_Grass (montée 20 ms, décroissance 0,35 s)', fout=0.3)


# ---------------------------------------------------------------------------------------------------------------------
# Joueur : balle reçue, cœur, mort, acouphène

def joueur():
    # balle reçue : chair (FilmmakersManual) assourdie et raccourcie + coup de poing Kenney + gilet (cuir lâché Kenney),
    # puis une couche d'harmoniques pour les petits haut-parleurs
    for k, (fm, pu) in enumerate(zip(HIT_BODY, PUNCH_HEAVY)):
        b = enveloppe(attaque(af(src(fm), hp(90), lp(2200)), -30), 0.0005, 0.07)
        p = enveloppe(attaque(af(src(pu), hp(60), lp(1500)), -30), 0.0005, 0.06)
        v = enveloppe(attaque(af(src(DROP_LEATHER), hp(150), lp(3500)), -30), 0.001, 0.05)
        x = C.mix((C.norm(b), 0, 1.0), (C.norm(p), 0, dbg(-3)), (C.norm(v), 0.002, dbg(-9)))
        x = C.mix((x, 0, 1.0), (C.norm(harmoniques(x, 200, 4.0, (180, 900))) * C.peak(x), 0, dbg(-10)))
        sid = f'p_hurt-{k + 1}'
        maitre(sid, x, 0.3, 'filmmakersmanual', nom(fm), 'balle dans la chair (passe-bande 90 Hz-2,2 kHz, décroissance 70 ms) + '
               f'coup de poing Kenney {nom(pu)} (passe-bas 1,5 kHz, -3 dB) + cuir lâché Kenney dropLeather (gilet, -9 dB) + '
               'harmoniques 180-900 Hz (-10 dB)', fout=0.12)
        ENTREES.append(C.credit(sid, PAQ, 'kenney', nom(pu), 'couches de coup et de gilet (dropLeather)'))

    hb = attaque(af(src(HEART), hp(25), lp(2000)), -40)
    x = C.mix((C.norm(hb), 0, 1.0), (C.norm(harmoniques(hb, 150, 5.0, (120, 600))), 0, dbg(-8)))
    maitre('p_heart', x, 0.7, 'michorvath', nom(HEART), 'un battement « lub-dub », passe-bas 2 kHz + harmoniques 120-600 Hz '
           '(-8 dB) pour les haut-parleurs de téléphone', fout=0.1)

    b = transpose(af(attaque(src(BODY[3])), hp(40)), -3)
    p = transpose(af(attaque(src(PUNCH_HEAVY[0])), hp(35)), -4)
    s = af(attaque(src(SOFT_HEAVY)), hp(30))
    x = af(C.mix((C.norm(b), 0, 1.0), (C.norm(p), 0, dbg(-3)), (C.norm(s), 0, dbg(-6))), lp(2500))
    x = C.mix((x, 0, 1.0), (C.norm(harmoniques(x, 150, 4.0, (110, 500))) * C.peak(x), 0, dbg(-9)))
    maitre('p_down', x, 1.0, 'mlsulli', nom(BODY[3]), 'coup final : corps sur béton -3 demi-tons + coup de poing Kenney -4 '
           'demi-tons + choc mou Kenney, passe-bas 2,5 kHz + harmoniques 110-500 Hz (-9 dB)', fout=0.3)
    ENTREES.append(C.credit('p_down', PAQ, 'kenney', nom(PUNCH_HEAVY[0]), 'couches graves'))

    x = af(src(TINNITUS, 1.0, 2.6), hp(1500), lp(6000))
    x = enveloppe(x, 0.06, 0.75)
    maitre('p_ring', x, 2.5, 'tnturner', nom(TINNITUS), 'son pur de 3,1 kHz isolé (passe-bande 1,5-6 kHz : '
           'composantes de 15,6 et 21,8 kHz retirées), enveloppe : montée 60 ms, extinction exponentielle', fout=0.4)


def build(seulement=None):
    """Fabrique les masters de la famille (seulement : liste de groupes pour les essais)."""
    ENTREES.clear(); SIGNAUX.clear()
    for g in (armes, gestes, chutes, pas, corps, joueur):
        if seulement is None or g.__name__ in seulement:
            g()
    aligne_variantes()
    if seulement is None:
        C.write_credits('maniement', ENTREES)
