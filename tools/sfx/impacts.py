"""Famille « impacts » : impacts de balles, sifflements, explosions, grenade, chutes de corps, objets et retours de touche
(paquet impacts).

Sources (voir SOURCES) : prises Freesound CC0 retrouvées sur GitHub (FilmmakersManual « Valhalla » pour le béton, le métal
et la chair, aust_paul pour les ricochets, G.Lamont pour le claquement supersonique, qubodup d'après des vidéos de l'armée
américaine pour les explosions, C_Rogers pour le verre, mlsulli pour les corps...), les packs OpenGameArt CC0 de
rubberduck (casse, bois, métal, eau), NOX SOUND « Footsteps Essentials » (terre, neige, feuilles) et Kenney (chocs).
Les sons sans prise dédiée (bois, terre, neige, feuillage, sifflement de balle, débris, casse de poterie) sont composés de
couches réelles : aucun son n'est synthétisé.

Traitement commun : mono 48 kHz, passe-haut (bruit de manipulation, vent), début à l'attaque (2 ms gardées au plus),
fondu de sortie, crête à -1 dBFS. Dans une même série de variantes, un limiteur doux ramène les crêtes isolées au même
écart crête/niveau efficace, pour que les variantes sonnent aussi fort les unes que les autres.
Les instants de découpe ci-dessous viennent de l'analyse des sources (enveloppe et spectrogramme)."""
import urllib.parse
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
import common as C
from common import SR

PAQ = 'impacts'

SOURCES = {
    'filmmakersmanual': {
        'nom': '« Bullet - Concrete Hit », « Bullet - Metal Hit », « Bullet - Hit Body » (bibliothèque « Valhalla », '
               'freesound 522307 à 522509)',
        'auteur': 'FilmmakersManual',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/FilmmakersManual/',
        'preuve': "README d'ArmorAlley (scottschiller) : « Bullet - Concrete Hit (2-4) ... by FilmmakersManual (CC0) », "
                  "« Bullet - Metal Hit (2-4) ... (CC0) » ; fichiers *_license.txt de Mooses2k/SecretHistories ; "
                  "sound/attributions.txt d'Aurora.3 : « part of \"Valhalla\", licensed under CC0 1.0 Universal »",
    },
    'mlsulli': {
        'nom': '« Body Hits_Concrete » (freesound 234853)',
        'auteur': 'mlsulli',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/mlsulli/sounds/234853/',
        'preuve': "README d'ArmorAlley (scottschiller), section Sounds : « Body Hits_Concrete.wav by mlsulli (CC0) »",
    },
    'aust_paul': {
        'nom': '« ricochet » (freesound 30932)',
        'auteur': 'aust_paul',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/aust_paul/sounds/30932/',
        'preuve': "assets/audio/CREDITS.md de jaher/shadow-six : « ricochet | aust_paul 30932 | CC0-1.0 »",
    },
    'g_lamont': {
        'nom': '« Whip Cracks » (freesound 118068)',
        'auteur': 'G.Lamont',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/G.Lamont/sounds/118068/',
        'preuve': "assets/sound/MANIFEST.md d'AnthonE/Gates : « Every file here is CC0 ... checked on each source's own "
                  "page » ; « flyby_0-3 | G.Lamont, 118068, Whip Cracks.WAV »",
    },
    'qubodup_militaire': {
        'nom': '« military sounds » : blast, real bullet flyby (freesound 855893, 855248)',
        'auteur': 'Iwan Gabovitch (qubodup), d\'après des vidéos de l\'armée américaine (domaine public)',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/qubodup/',
        'preuve': "sounds/_readme_and_license.txt de frostburn/amortization2 (généré par Freesound) : « Licenses in this "
                  "Pack: Creative Commons 0 », « 855893__qubodup__blast.flac ... license: Creative Commons 0 »",
    },
    'qubodup_naval': {
        'nom': '« Tiny Naval Battle Sounds Set » : WaterSurfaceExplosion02',
        'auteur': 'Iwan Gabovitch (qubodup)',
        'licence': 'CC0 1.0',
        'url': 'https://opengameart.org/content/tiny-naval-battle-sounds-set',
        'preuve': "Page OpenGameArt : qubodup, CC0, « based on US military videos » ; README de gknutson1/global-supply-"
                  "chain : « Tiny Naval Battle Sounds Set : Copyright/Attribution Notice: optional: Iwan Gabovitch »",
    },
    'survive_exp': {
        'nom': 'Explosions réelles : « Pipe Bomb », « Real explosion recording » (freesound 737321, 784163), '
               '« explosion_big_01/02 » (587193, 587194), « Explosion Pine Forest 200m » (734094), '
               '« Explosion, Medium Blast » (516914)',
        'auteur': 'modusmogulus, derplayer, Kinoton',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/webdevcody/survive-the-night-fps/tree/main/client/audio/samples',
        'preuve': "client/audio/samples/CREDITS.md : « Every recording in this folder is CC0 1.0 ... The licence of each "
                  "source was verified on its Freesound page » ; lignes exp_near et exp_far",
    },
    'survive_head': {
        'nom': '« Headshot.wav » (freesound 511194), « Headshot sound » (660769), « Gore Impact » (641046)',
        'auteur': 'Pablobd, MadPanCake, magnuswaker',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/webdevcody/survive-the-night-fps/tree/main/client/audio/samples',
        'preuve': "client/audio/samples/CREDITS.md : « Every recording in this folder is CC0 1.0 » ; ligne hit_head",
    },
    'samsterbirdies': {
        'nom': '« Explosion Large » (freesound 587886)',
        'auteur': 'SamsterBirdies',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/SamsterBirdies/sounds/587886/',
        'preuve': "_readme_and_license.txt généré par Freesound (miroir rodrigolisita/CM3030-GamesDevelopment) : "
                  "« Licenses in this Pack: Creative Commons 0 »",
    },
    'felix_blume': {
        'nom': '« Dynamite explosion in the mountain » (freesound 251401)',
        'auteur': 'felix.blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/251401/',
        'preuve': "assets/sound/MANIFEST.md d'AnthonE/Gates : « Every file here is CC0 » ; « blast_0 | felix.blume, "
                  "251401, Dynamite explosion in the mountain »",
    },
    'xkeril': {
        'nom': '« Fall debris (crash) » (freesound 703248)',
        'auteur': 'xkeril',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/xkeril/sounds/703248/',
        'preuve': "assets/sound/MANIFEST.md d'AnthonE/Gates : « Every file here is CC0 » ; « collapse_1 | xkeril, 703248, "
                  "Fall debris (crash) »",
    },
    'c_rogers': {
        'nom': '« Breaking Glass Sounds » (freesound, pack 12990)',
        'auteur': 'C_Rogers',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/C_Rogers/packs/12990/',
        'preuve': "_readme_and_license.txt généré par Freesound (miroir yGabrielT/MonoCromo) : « Licenses in this pack: "
                  "Creative Commons 0 »",
    },
    'vinni_r': {
        'nom': '« Bone Break » (freesound 630590 à 630594)',
        'auteur': 'Vinni_R',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/Vinni_R/',
        'preuve': "licenses/vinni_r_readme_and_license.txt de Weesoid/All-That-Jazz-Project (généré par Freesound) : "
                  "« Bone Break ... Creative Commons 0 »",
    },
    'erbsland': {
        'nom': '« Large ceramic plate hit » (freesound 634154)',
        'auteur': 'Erbsland-Music',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/erbsland-music/sounds/634154/',
        'preuve': "resources/sounds/impacts/ceramic_and_glass/634154__erbsland-music__large-ceramic-plate-hit_license.txt "
                  "de Mooses2k/SecretHistories : « CC0 »",
    },
    'bush': {
        'nom': '« looking_in_bushes » (freesound 59315) et « few small branches snapping » (354103)',
        'auteur': 'vibe_crc, Bini_trns',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AnthonE/Gates/tree/main/assets/sound/freesound',
        'preuve': "assets/sound/MANIFEST.md d'AnthonE/Gates : « Every file here is CC0 ... checked on each source's own "
                  "page » ; « bush_pick_0-2 | vibe_crc, 59315 ... ; Bini_trns, 354103 »",
    },
    'rubberduck_casse': {
        'nom': '« 75 CC0 breaking / falling / hit sfx »',
        'auteur': 'rubberduck (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx',
        'preuve': "Page OpenGameArt : « 75 CC0 breaking / falling / hit sfx », licence CC0 ; license.txt du miroir "
                  "fighter-435/Break-the-Battle-Formation renvoie vers cette page",
    },
    'rubberduck_bois_metal': {
        'nom': '« 100 CC0 metal and wood SFX »',
        'auteur': 'rubberduck (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx',
        'preuve': "SOURCE.txt du miroir 1993velezpadilla-source/config-old-3 (cc0_horror_library) : « License: CC0 / "
                  "Public Domain dedication » ; SUMMARY.json : « CC0/public-domain raw source pool »",
    },
    'rubberduck_eau': {
        'nom': '« 40 CC0 water / splash / slime SFX »',
        'auteur': 'rubberduck (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://opengameart.org/content/40-cc0-water-splash-slime-sfx',
        'preuve': "SOURCE.txt du miroir 1993velezpadilla-source/config-old-3 (cc0_horror_library) : « License: CC0 / "
                  "Public Domain dedication »",
    },
    'rubberduck_100': {
        'nom': '« 100 CC0 SFX »',
        'auteur': 'rubberduck (opengameart.org)',
        'licence': 'CC0 1.0',
        'url': 'https://opengameart.org/content/100-cc0-sfx',
        'preuve': "SOURCE.txt du miroir 1993velezpadilla-source/config-old-3 (cc0_horror_library) : « License: CC0 / "
                  "Public Domain dedication »",
    },
    'nox': {
        'nom': 'NOX SOUND « Footsteps - Essentials »',
        'auteur': 'Nox_Sound',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/helzpont/home4/tree/main/assets/audio/Footsteps_Essentials_NOX_SOUND',
        'preuve': "Essentials_Series_README.pdf livré avec le pack : « All these sounds are under CC0 license. »",
    },
    'kenney': {
        'nom': 'Kenney « RPG Audio », « Foley Sounds », « Impact Sounds »',
        'auteur': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'preuve': "License.txt de chaque pack : « License: (Creative Commons Zero, CC0) http://creativecommons.org/"
                  "publicdomain/zero/1.0/ »",
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


def _aa(nom):               # ArmorAlley : sons Freesound CC0 (FilmmakersManual, mlsulli)
    return _f('armoralley/' + nom, _url('scottschiller/ArmorAlley', 'master', 'assets/audio/wav/' + nom))


def _sh(chemin):            # SecretHistories (Git LFS)
    return _f('secrethistories/' + chemin.split('/')[-1],
              _url('Mooses2k/SecretHistories', 'main', 'resources/sounds/impacts/' + chemin, lfs=True))


def _s6(chemin):            # SHADOW SIX : prises Freesound CC0 découpées
    return _f('shadow-six/' + chemin.split('/')[-1], _url('jaher/shadow-six', 'master', 'assets/audio/sfx/' + chemin))


def _stn(nom):              # survive-the-night-fps : planches de prises Freesound CC0
    return _f('survive-the-night/' + nom, _url('webdevcody/survive-the-night-fps', 'main', 'client/audio/samples/' + nom))


def _gates(nom):
    return _f('gates/' + nom, _url('AnthonE/Gates', 'main', 'assets/sound/freesound/' + nom))


def _rdc(nom):              # rubberduck « 75 CC0 breaking / falling / hit sfx »
    return _f('rubberduck/casse/' + nom, _url('fighter-435/Break-the-Battle-Formation', 'main',
                                              'sci-fi-fps/assets/audios/sfx_breaking_and_falling/' + nom))


def _hl(chemin):            # miroir cc0_horror_library (rubberduck, OwlishMedia)
    return _f('cc0-horror-library/' + chemin, _url('1993velezpadilla-source/config-old-3', 'main',
                                                   'assets/audio/cc0_horror_library/' + chemin))


def _nox(chemin):           # 'Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Hard_Jump_Land_02.wav'
    return _f('nox/' + chemin, _url('helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/' + chemin))


def _ken(chemin):           # 'kenney-impact-sounds/audio/Audio/impactSoft_heavy_000.ogg'
    return _f('kenney/' + chemin, _url('series-ai/jam-ready-assets', 'main', chemin, lfs=True))


KI = 'kenney-impact-sounds/audio/Audio/'
KF = 'kenney-foley-sounds/audio/Audio/'

# FilmmakersManual
CONCRETE = [_sh('522400__filmmakersmanual__bullet-concrete-hit-1.wav'),
            _aa('522403__filmmakersmanual__bullet-concrete-hit-2_edit.wav'),
            _aa('522402__filmmakersmanual__bullet-concrete-hit-3_edit.wav'),
            _aa('522401__filmmakersmanual__bullet-concrete-hit-4_edit.wav')]
METAL = [_aa('522506__filmmakersmanual__bullet-metal-hit-2_edit.wav'),
         _aa('522507__filmmakersmanual__bullet-metal-hit-3_edit.wav'),
         _aa('522508__filmmakersmanual__bullet-metal-hit-4_edit.wav'),
         _aa('522509__filmmakersmanual__bullet-metal-hit-4_edit.wav')]
BODY = {n: _sh(f'bullets_to_flesh/{i}__filmmakersmanual__bullet-hit-body-{n}.wav') for n, i in
        [(3, 522315), (6, 522501), (7, 522502), (8, 522503), (9, 522504)]}
BODYFALL = {n: _aa(f'234853__mlsulli__body-hits-concrete_{n}.wav') for n in (1, 2, 5)}
CERAMIC = _sh('ceramic_and_glass/634154__erbsland-music__large-ceramic-plate-hit.ogg')

# autres prises Freesound
RICOCHET = {n: _s6(f'ricochet/ricochet_30932_{n}.ogg') for n in (0, 2, 3)}
EXP_NEAR, EXP_FAR, HIT_HEAD = _stn('exp_near.ogg'), _stn('exp_far.ogg'), _stn('hit_head.ogg')
WHIP = [_gates(f'flyby_{n}.ogg') for n in range(4)]
BLAST_MOUNTAIN = _gates('blast_0.ogg')
DEBRIS = _gates('collapse_1.ogg')
BUSH = [_gates(f'bush_pick_{n}.ogg') for n in range(2)]
BLAST = _f('qubodup/855893__qubodup__blast.flac', _url('frostburn/amortization2', 'main', 'sounds/855893__qubodup__blast.flac'))
FLYBY = _f('qubodup/855248__qubodup__real-bullet-flyby-sound.flac',
           _url('frostburn/amortization2', 'main', 'sounds/855248__qubodup__real-bullet-flyby-sound.flac'))
WATER_BLAST = _f('qubodup/WaterSurfaceExplosion02.wav',
                 _url('gknutson1/global-supply-chain', 'main', 'Assets/Sound/SoundFx/WaterSurfaceExplosion02.wav'))
BIG_BLAST = _f('samsterbirdies/587886__samsterbirdies__explosion-large.flac',
               _url('rodrigolisita/CM3030-GamesDevelopment', 'master',
                    'Assets/Sounds/ExplosionsSamsterbirdies/587886__samsterbirdies__explosion-large.flac'))
GLASS = {n: _f(f'c_rogers/{n}.ogg', _url('yGabrielT/MonoCromo', 'main', 'Assets/Audio/Efeitos sonoros/'
                                                                          f'12990__c_rogers__breaking-glass-sounds/{n}.ogg', lfs=True))
         for n in ('203368__c_rogers__glass-shattering-hit_01', '203374__c_rogers__glass-shattering_02',
                   '203377__c_rogers__glass-shattering_05', '203375__c_rogers__glass-shattering_01',
                   '203371__c_rogers__glass-explosion_01')}
BONE = {n: _f(f'allthatjazz/{i}__vinni_r__bone-break_{n}.ogg', _url('Weesoid/All-That-Jazz-Project', 'master',
                                                                     f'audio/sounds/{i}__vinni_r__bone-break_{n}.ogg'))
        for n, i in [(1, 630593), (3, 630591)]}

# rubberduck
RD = {n: _rdc(f'bfh1_{n}.ogg') for n in ('rock_falling_01', 'rock_falling_03', 'rock_falling_05', 'rock_falling_07',
                                         'rock_falling_08', 'metal_hit_04', 'metal_hit_05', 'metal_hit_06',
                                         'metal_hit_02', 'breaking_01', 'breaking_03', 'hit_10')}
WM = {n: _hl(f'wood_metal_rubberduck/{n}.ogg') for n in ('metal_sheet_01', 'metal_sheet_02', 'metal_sheet_04',
                                                         'metal_sheet_05', 'metal_sheet_06', 'wood_hit_01', 'wood_hit_02',
                                                         'wood_hit_04', 'wood_hit_08', 'wood_cracking_02',
                                                         'wood_cracking_03', 'wood_cracking_04')}
WS = {n: _hl(f'water_splash_slime/{n}.ogg') for n in ('splash_02', 'splash_04', 'splash_09', 'splash_10', 'splash_13',
                                                      'slime_15')}
DISHES = [_hl('general_sfx_rubberduck_01/dishes_01.ogg'), _hl('general_sfx_rubberduck_01/dishes_03.ogg')]
HIT100 = _hl('general_sfx_rubberduck_01/hit_01.ogg')

# NOX
NX = {n: _nox(n) for n in (
    'Footsteps_DirtyGround/Footsteps_DirtyGround_Land/Footsteps_DirtyGround_Jump_Land_02.wav',
    'Footsteps_Mud/Footsteps_Mud_Jump/Footsteps_Mud_Jump_Land_03.wav',
    'Footsteps_Sand/Footsteps_Sand_Jump/Footsteps_Sand_Jump_Land_03.wav',
    'Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Hard_Jump_Land_04.wav',
    'Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Hard_Jump_Land_05.wav',
    'Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Jump_Land_01.wav',
    'Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Jump_Land_03.wav',
    'Footsteps_Snow/Footsteps_Snow_Run/Footsteps_Snow_Hard_Run_03.wav',
    'Footsteps_Leaves/Footsteps_Leaves_Jump/Footsteps_Leaves_Jump_Land_01.wav',
    'Footsteps_Leaves/Footsteps_Leaves_Jump/Footsteps_Leaves_Jump_Land_02.wav',
)}


def nx(nom):
    """Fichier NOX par son nom court ('Snow_Hard_Jump_Land_02')."""
    return next(v for k, v in NX.items() if k.endswith(f'Footsteps_{nom}.wav'))


# Kenney
K = {n: _ken(KI + n + '.ogg') for n in ('impactSoft_heavy_000', 'impactSoft_heavy_002', 'impactSoft_medium_001',
                                        'impactSoft_medium_003', 'impactPunch_heavy_000', 'impactPunch_heavy_001',
                                        'impactPunch_heavy_002', 'impactPlate_heavy_000', 'impactPlate_heavy_002',
                                        'impactMetal_light_000', 'impactMetal_light_002', 'impactWood_medium_002',
                                        'impactPlate_light_002')}
K['dropLeather'] = _ken('kenney-rpg-audio/audio/Audio/dropLeather.ogg')
K.update({n: _ken(KF + n + '.ogg') for n in ('Swords/hitHelmet2', 'Swords/hitHelmet3',
                                             'Helmet/setDown1', 'Helmet/setDown2', 'Woosh/woosh1', 'Woosh/woosh4',
                                             'Woosh/woosh5', 'Woosh/woosh6')})


# ---------------------------------------------------------------------------------------------------------------------
# Outils de traitement

def src(rel, debut=None, duree=None):
    """Source décodée en mono 48 kHz (extrait debut..debut+duree s)."""
    return C.load(C.SRC / rel, start=debut, dur=duree)


def ken(n, debut=None, duree=None):
    """Prise Kenney : les fichiers s'arrêtent net sur un léger décalage continu, on retire les 20 dernières ms."""
    x = src(K[n], debut, duree)
    return x[:max(1, len(x) - int(0.02 * SR))]


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


def lowshelf(f, g):
    return f'lowshelf=f={f}:g={g}'


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


def coupe(x, debut, duree):
    return x[int(debut * SR):int((debut + duree) * SR)]


def n1(x):
    return C.norm(x, 0.0)


def decroit(x, tenue, tau):
    """Enveloppe : pleine pendant tenue s, puis décroissance exponentielle de constante tau s (raccourcit une queue)."""
    t = np.arange(len(x)) / SR
    env = np.where(t < tenue, 1.0, np.exp(-(t - tenue) / tau))
    return x * env


def niveau(x, w=0.05):
    """Niveau efficace de la fenêtre de w s la plus forte."""
    n = int(w * SR)
    if len(x) <= n: return float(np.sqrt(np.mean(x ** 2)))
    e = np.convolve(x ** 2, np.ones(n) / n, mode='valid')
    return float(np.sqrt(e.max()))


def limiteur(x, seuil, att=0.0005, rel=0.004):
    """Limiteur à anticipation : gain jamais au-dessus de seuil/|x| (fenêtre de 2*att), retour en rel s, lissé."""
    a = np.abs(x)
    r = np.minimum(1.0, seuil / np.maximum(a, 1e-12))
    w = max(1, int(att * SR))
    pad = np.concatenate([np.ones(w), r, np.ones(w)])
    gm = sliding_window_view(pad, 2 * w + 1).min(axis=1)
    k = 1 - np.exp(-1 / (rel * SR))
    g = np.empty_like(gm); cur = 1.0
    for i in range(len(gm)):
        v = gm[i]
        cur = v if v < cur else cur + (v - cur) * k
        g[i] = cur
    h = max(1, w // 2) * 2 + 1
    g = np.convolve(np.concatenate([np.full(h // 2, g[0]), g, np.full(h // 2, g[-1])]), np.ones(h) / h, mode='valid')
    return x * g


def ecart(x):
    """Écart crête / niveau efficace (dB)."""
    return C.db(C.peak(x)) - C.db(niveau(x))


def harmonise(sons, marge=1.0, max_red=4.0, dens=0.0):
    """Ramène l'écart crête/niveau de chaque variante d'une série vers le plus petit écart de la série (+ marge dB,
    - dens dB pour densifier toute la série), sans réduire une crête de plus de max_red dB, puis normalise en crête
    à -1 dBFS."""
    cible = min(ecart(x) for x in sons) + marge - dens
    out = []
    for x in sons:
        d = ecart(x) - cible
        if d > 0.1:
            d = min(d, max_red)
            x = limiteur(x, C.peak(x) * dbg(-d))
        out.append(C.norm(x, -1.0))
    return out


ENTREES = []


def finit(x, dmax, fout=0.04, fin_seuil=-60.0):
    """Coupe la fin sous fin_seuil (dB sous la crête), limite à dmax s, fondus d'entrée et de sortie."""
    x = np.asarray(x, dtype=np.float64)
    x = x[:C.tail_end(x, fin_seuil)]
    if len(x) > int(dmax * SR):
        x = x[:int(dmax * SR)]
        fout = max(fout, min(0.15, dmax * 0.3))
    return C.fade(x, 0.001, min(fout, len(x) / SR * 0.5))


def ecrit(sid, x, credits, crete=-1.0):
    """Écrit un master (crête -1 dBFS) et ses crédits : credits = [(source, fichier, détail), ...]."""
    x = C.norm(x, crete)
    C.save_master(PAQ, sid, x)
    for source, f, d in credits:
        ENTREES.append(C.credit(sid, PAQ, source, nom(f), d))
    return x


def serie(base, sons, dmax, fout=0.04, fin_seuil=-60.0, marge=1.0, max_red=4.0, crete=-1.0, dens=0.0):
    """Finit et écrit une série de variantes base-1, base-2... : sons = [(signal, credits), ...]. dens : réduction
    supplémentaire des crêtes (dB) pour un son plus dense."""
    xs = [finit(x, dmax, fout, fin_seuil) for x, _ in sons]
    xs = harmonise(xs, marge, max_red + dens, dens) if len(xs) > 1 or dens else xs
    for k, (x, (_, cr)) in enumerate(zip(xs, sons)):
        sid = f'{base}-{k + 1}' if len(sons) > 1 else base
        ecrit(sid, x, cr, crete)


def nom(rel):
    return rel.split('/', 1)[1] if '/' in rel else rel


def prise(rel, debut=None, duree=None, hpf=50, filtres='', seuil=-36.0, pre=0.001):
    """Extrait d'une source : passe-haut, début à l'attaque."""
    x = af(src(rel, debut, duree), hp(hpf) if hpf else '', filtres)
    return attaque(x, seuil, pre)


def claquement(rel=None, hpf=1800, duree=0.025):
    """Claquement bref (couche d'attaque) tiré du début d'un impact de balle sur béton."""
    x = prise(rel or CONCRETE[1], hpf=hpf, seuil=-30, pre=0.0005)
    x = x[:int(duree * SR)]
    return C.fade(x, 0.0005, duree * 0.6, 2.0)


# ---------------------------------------------------------------------------------------------------------------------
# Impacts de balles

def balles():
    # béton : quatre prises FilmmakersManual (claquement sec + éclats qui s'effritent)
    sons = []
    for k, rel in enumerate(CONCRETE):
        x = prise(rel, hpf=60)
        cr = [('filmmakersmanual', rel, f'prise {k + 1} entière (0,5 s au plus), passe-haut 60 Hz')]
        if k == 1:      # la prise 2 monte en 20 ms : claquement de la prise 4 en tête
            x = C.mix((n1(x), 0.0, 1.0), (n1(claquement(CONCRETE[3], hpf=900, duree=0.03)), 0.0, dbg(-5)))
            cr.append(('filmmakersmanual', CONCRETE[3], 'claquement de tête : 30 premières ms de la prise 4, passe-haut 900 Hz (-5 dB)'))
        sons.append((x, cr))
    serie('i_concrete', sons, 0.5, fout=0.12)

    # métal : prise FilmmakersManual (claquement + tintement) raccourcie (tenue 30 ms, déclin 70 ms : pas de cloche)
    # + tôle frappée rubberduck (« tonk ») en dessous
    toles = ['metal_sheet_05', 'metal_sheet_01', 'metal_sheet_04', 'metal_sheet_02']
    sons = []
    for k, rel in enumerate(METAL):
        a = decroit(prise(rel, hpf=120), 0.03, 0.075)
        t = decroit(prise(WM[toles[k]], hpf=90, filtres=lp(6000)), 0.04, 0.06)
        x = C.mix((n1(a), 0, 1.0), (n1(t), 0.002, dbg(-5)))
        sons.append((x, [('filmmakersmanual', rel, 'prise raccourcie : tenue 30 ms puis déclin de 70 ms, passe-haut 120 Hz'),
                         ('rubberduck_bois_metal', WM[toles[k]], 'couche « tonk » de tôle (-5 dB, passe-bas 6 kHz, déclin 60 ms)')]))
    serie('i_metal', sons, 0.45, fout=0.1)

    # bois : choc de bois rubberduck + éclatement (wood_cracking) + claquement de balle (béton filtré au-dessus de 1,8 kHz)
    combos = [('wood_hit_02', 'wood_cracking_02', 0.012), ('wood_hit_08', 'wood_cracking_04', 0.008),
              ('wood_hit_04', 'wood_cracking_03', 0.015)]
    sons = []
    for k, (h, c, off) in enumerate(combos):
        a = prise(WM[h], hpf=80)
        b = prise(WM[c], hpf=500)
        cl = claquement(CONCRETE[k + 1])
        x = C.mix((n1(a), 0.003, 1.0), (n1(b), off, dbg(-6)), (n1(cl), 0, dbg(-8)))
        sons.append((x, [('rubberduck_bois_metal', WM[h], f'choc de bois {h} + éclatement {c} (-6 dB, à {off * 1000:.0f} ms)'),
                         ('filmmakersmanual', CONCRETE[k + 1], 'claquement : 25 premières ms, passe-haut 1,8 kHz (-8 dB)')]))
    serie('i_wood', sons, 0.5, fout=0.1, dens=2.0)

    # terre / sable : souffle sourd (réception NOX sur terre ou sable) + coup grave (Kenney impactSoft) + gravillons
    combos = [('Mud_Jump_Land_03', 'impactSoft_heavy_000', 'rock_falling_05', 0.03),
              ('DirtyGround_Jump_Land_02', 'impactSoft_heavy_002', 'rock_falling_03', 0.05),
              ('Sand_Jump_Land_03', 'impactSoft_medium_001', 'rock_falling_08', 0.04)]
    sons = []
    for k, (terre, coup, grav, off) in enumerate(combos):
        a = prise(nx(terre), hpf=70, seuil=-30)
        b = decroit(af(ken(coup), hp(45), lp(400)), 0.03, 0.05)
        g = prise(RD[grav], hpf=900, seuil=-30)
        g = decroit(g, 0.08, 0.12)
        cl = claquement(CONCRETE[0], hpf=1200, duree=0.02)
        x = C.mix((n1(a), 0, 1.0), (n1(b), 0, dbg(-6)), (n1(g), off, dbg(-14)), (n1(cl), 0, dbg(-12)))
        sons.append((x, [('nox', nx(terre), f'souffle de terre : réception {terre}, passe-haut 70 Hz'),
                         ('kenney', K[coup], 'coup grave (passe-bas 400 Hz, -6 dB)'),
                         ('rubberduck_casse', RD[grav], f'gravillons (passe-haut 900 Hz, -14 dB, à {off * 1000:.0f} ms)'),
                         ('filmmakersmanual', CONCRETE[0], 'claquement d\'entrée (20 ms, passe-haut 1,2 kHz, -12 dB)')]))
    serie('i_dirt', sons, 0.5, fout=0.12)

    # verre : prises C_Rogers (coup qui fait voler le verre en éclats), queue d'éclats écourtée
    noms = ['203368__c_rogers__glass-shattering-hit_01', '203374__c_rogers__glass-shattering_02',
            '203377__c_rogers__glass-shattering_05']
    sons = [(prise(GLASS[n], hpf=150), [('c_rogers', GLASS[n], 'attaque et premiers éclats (0,5 s), passe-haut 150 Hz')])
            for n in noms]
    serie('i_glass', sons, 0.5, fout=0.15)

    # chair : prises FilmmakersManual « Bullet - Hit Body » (mat et humide), 0,3 s
    sons = []
    for n in (3, 8, 9, 6):
        sons.append((prise(BODY[n], hpf=50, seuil=-22), [('filmmakersmanual', BODY[n], f'prise {n} : 0,3 s, passe-haut 50 Hz')]))
    serie('i_flesh', sons, 0.3, fout=0.1)

    # tête : craquement sec (os) sur un impact de chair
    a = prise(HIT_HEAD, 0.66, 0.3, hpf=80, filtres=eq(8500, -14, 6) + ',' + eq(17000, -10, 4), seuil=-30)
    a = decroit(a, 0.02, 0.04)      # la prise sonne vers 8,5 kHz : on garde le craquement, pas le tintement
    b = prise(BONE[3], hpf=300, seuil=-30)
    c = prise(BODY[7], hpf=60, seuil=-22)
    x1 = C.mix((n1(a), 0, 1.0), (n1(b), 0.004, dbg(-7)), (n1(c), 0, dbg(-8)))
    d = prise(BODY[6], hpf=60, seuil=-22)
    e = prise(BONE[1], hpf=300, seuil=-30)
    f = prise(HIT_HEAD, 0.0, 0.3, hpf=80, seuil=-30)
    x2 = C.mix((n1(d), 0, 1.0), (n1(e), 0.002, dbg(-5)), (n1(f), 0.0, dbg(-9)))
    serie('i_head', [
        (x1, [('survive_head', HIT_HEAD, 'tir à la tête, prise 2 (0,66-0,96 s), tintement de 8,5 kHz atténué, déclin 40 ms'),
              ('vinni_r', BONE[3], 'craquement d\'os (passe-haut 300 Hz, -7 dB)'),
              ('filmmakersmanual', BODY[7], 'impact de chair (prise 7, -8 dB)')]),
        (x2, [('filmmakersmanual', BODY[6], 'impact de chair (prise 6)'),
              ('vinni_r', BONE[1], 'craquement d\'os (passe-haut 300 Hz, -5 dB)'),
              ('survive_head', HIT_HEAD, 'tir à la tête, prise 1 (0-0,3 s, -9 dB)')]),
    ], 0.3, fout=0.1, dens=3.0)

    # eau : petite éclaboussure rubberduck + gerbe (bruine d'une autre éclaboussure) + claquement d'entrée
    gerbe = decroit(af(attaque(src(WS['splash_13']), -30), hp(1500)), 0.04, 0.12)
    sons = []
    for k, n in enumerate(('splash_10', 'splash_09', 'splash_02')):
        a = prise(WS[n], hpf=100, seuil=-30)
        cl = claquement(CONCRETE[k + 1], hpf=2500, duree=0.015)
        x = C.mix((n1(a), 0.0, 1.0), (n1(cl), 0, dbg(-14)), (n1(gerbe), 0.012, dbg(-13 if k < 2 else -18)))
        sons.append((x, [('rubberduck_eau', WS[n], f'éclaboussure {n}, passe-haut 100 Hz ; gerbe : splash_13 (passe-haut '
                          f'1,5 kHz, déclin 120 ms, à 12 ms)'),
                         ('filmmakersmanual', CONCRETE[k + 1], 'claquement d\'entrée (15 ms, passe-haut 2,5 kHz, -14 dB)')]))
    serie('i_water', sons, 0.5, fout=0.12, dens=2.0)

    # neige : crissement (réception NOX sur neige tassée) + coup sourd étouffé
    combos = [('Snow_Hard_Jump_Land_04', 'impactSoft_medium_001'), ('Snow_Hard_Jump_Land_05', 'impactSoft_medium_003')]
    sons = []
    for neige, coup in combos:
        a = prise(nx(neige), hpf=90, seuil=-30)
        b = decroit(af(ken(coup), hp(50), lp(300)), 0.02, 0.04)
        x = C.mix((n1(a), 0, 1.0), (n1(b), 0, dbg(-8)))
        sons.append((x, [('nox', nx(neige), f'crissement : réception {neige}'),
                         ('kenney', K[coup], 'coup sourd (passe-bas 300 Hz, -8 dB)')]))
    serie('i_snow', sons, 0.45, fout=0.12)

    # feuillage : feuilles froissées (réception NOX dans les feuilles) + bruissement de buisson + brindille qui casse
    combos = [('Leaves_Jump_Land_01', 0, 'wood_cracking_02'), ('Leaves_Jump_Land_02', 1, 'wood_cracking_04')]
    sons = []
    for feuilles, b, br in combos:
        a = prise(nx(feuilles), hpf=200, seuil=-30)
        r = af(src(BUSH[b]), hp(400))
        r = decroit(attaque(r, -30), 0.05, 0.12)
        t = decroit(prise(WM[br], hpf=1500, seuil=-30), 0.01, 0.03)
        x = C.mix((n1(a), 0.004, 1.0), (n1(r), 0.012, dbg(-6)), (n1(t), 0.0, dbg(-9)))
        sons.append((x, [('nox', nx(feuilles), f'feuilles froissées : {feuilles}, passe-haut 200 Hz'),
                         ('bush', BUSH[b], 'bruissement de buisson (passe-haut 400 Hz, déclin 120 ms, -6 dB)'),
                         ('rubberduck_bois_metal', WM[br], 'brindille : attaque de l\'éclatement de bois (passe-haut 1,5 kHz, -9 dB)')]))
    serie('i_leaf', sons, 0.45, fout=0.12)


# ---------------------------------------------------------------------------------------------------------------------
# Ricochets et sifflements

def sifflements():
    sons = []
    for k in (3, 2, 0):
        x = prise(RICOCHET[k], hpf=150, seuil=-30)
        sons.append((x, [('aust_paul', RICOCHET[k], f'prise {k + 1} : choc + stridence descendante, passe-haut 150 Hz')]))
    serie('i_ric', sons, 0.6, fout=0.15)

    # balle qui frôle : claquement supersonique (fouet) + vraie balle qui passe (qubodup) + souffle qui passe
    # (souffle Kenney accéléré, qui s'éteint en 0,3 s)
    souffles = ['Woosh/woosh1', 'Woosh/woosh4', 'Woosh/woosh5', 'Woosh/woosh6']
    hauteurs = [0, -1, 1, -2]
    sons = []
    for k in range(4):
        cr = prise(WHIP[k], hpf=700, seuil=-30)
        cr = decroit(cr, 0.01, 0.05)
        fb = transpose(prise(FLYBY, hpf=600, seuil=-30), hauteurs[k])
        w = af(ken(souffles[k]), hp(300))
        i = max(0, int(np.argmax(np.abs(w))) - int(0.02 * SR))     # seconde moitié du souffle : il s'éloigne
        w = transpose(C.fade(w[i:], 0.008, 0.0), 3)
        w = decroit(w, 0.03, 0.06)
        x = C.mix((n1(cr), 0, 1.0), (n1(fb), 0.0, dbg(-5)), (n1(w), 0.004, dbg(-5)))
        sons.append((x, [('g_lamont', WHIP[k], 'claquement de fouet : tenue 10 ms, déclin 50 ms, passe-haut 700 Hz'),
                         ('qubodup_militaire', FLYBY, f'vraie balle qui passe (80 ms, {hauteurs[k]:+d} demi-ton, passe-haut '
                          '600 Hz, -5 dB)'),
                         ('kenney', K[souffles[k]], 'souffle qui s\'éloigne : seconde moitié du souffle (dès 20 ms avant son '
                          'maximum), +3 demi-tons, déclin 60 ms (-5 dB)')]))
    serie('i_whiz', sons, 0.4, fout=0.1)


# ---------------------------------------------------------------------------------------------------------------------
# Explosions

def explosions():
    sub = af(prise(BIG_BLAST, hpf=25), lp(140))
    sub = decroit(sub, 0.15, 0.6)

    a = prise(BLAST, hpf=30, seuil=-30)
    cl = claquement(CONCRETE[2], hpf=400, duree=0.04)
    x1 = C.mix((n1(a), 0, 1.0), (n1(sub), 0.0, dbg(-6)), (n1(cl), 0.0, dbg(-7)))
    b = prise(EXP_NEAR, 0.0, 3.3, hpf=30, seuil=-30)
    x2 = C.mix((n1(b), 0, 1.0), (n1(sub), 0.0, dbg(-8)))
    serie('x_near', [
        (x1, [('qubodup_militaire', BLAST, 'explosion réelle (enregistrement militaire), passe-haut 30 Hz'),
              ('samsterbirdies', BIG_BLAST, 'grondement : passe-bas 140 Hz, tenue 150 ms puis déclin 0,6 s (-6 dB)'),
              ('filmmakersmanual', CONCRETE[2], 'claquement d\'attaque : 40 premières ms d\'un impact sur béton, '
               'passe-haut 400 Hz (-7 dB)')]),
        (x2, [('survive_exp', EXP_NEAR, 'explosion réelle, prise 1 (0-3,3 s), passe-haut 30 Hz'),
              ('samsterbirdies', BIG_BLAST, 'grondement : passe-bas 140 Hz (-8 dB)')]),
    ], 2.5, fout=0.6, fin_seuil=-55, marge=1.5)

    f1 = af(prise(EXP_FAR, 0.0, 5.4, hpf=30, seuil=-30), lp(2500))
    f2 = af(prise(BLAST_MOUNTAIN, hpf=30, seuil=-30), lp(2200))
    serie('x_far', [
        (f1, [('survive_exp', EXP_FAR, 'explosion lointaine (forêt à 200 m), prise 1, passe-bas 2,5 kHz')]),
        (f2, [('felix_blume', BLAST_MOUNTAIN, 'dynamite en montagne avec roulement, passe-bas 2,2 kHz')]),
    ], 3.0, fout=0.9, fin_seuil=-55, marge=1.5)

    # débris : gravats qui retombent (rubberduck rock_falling, en cascade) + queue d'éboulis (xkeril) étouffée
    deb = af(prise(DEBRIS, hpf=60, seuil=-30), lp(5000))
    sons = []
    for k, seq in enumerate([[('rock_falling_01', 0.0, 0), ('rock_falling_07', 0.18, -3), ('rock_falling_05', 0.5, -7)],
                             [('rock_falling_03', 0.0, 0), ('rock_falling_08', 0.22, -3), ('rock_falling_01', 0.55, -8)]]):
        layers = [(n1(prise(RD[n], hpf=120, seuil=-40)), off, dbg(g)) for n, off, g in seq]
        d = coupe(deb, 0.3 + 0.5 * k, 1.5)
        d = C.fade(d, 0.05, 0.6)
        layers.append((n1(d), 0.0, dbg(-10)))
        x = C.mix(*layers)
        cred = [('rubberduck_casse', RD[seq[0][0]], 'cascade de gravats : ' + ', '.join(f'{n} à {o:.2f} s ({g} dB)' for n, o, g in seq))]
        cred.append(('xkeril', DEBRIS, f'queue d\'éboulis ({0.3 + 0.5 * k:.1f}-{1.8 + 0.5 * k:.1f} s, passe-bas 5 kHz, -10 dB)'))
        sons.append((x, cred))
    serie('x_debris', sons, 1.5, fout=0.4, fin_seuil=-55)

    # explosion dans l'eau : gerbe réelle (qubodup) + coup sourd (grondement grave) + retombée (éclaboussure)
    w = prise(WATER_BLAST, hpf=30, seuil=-30)
    s = prise(WS['splash_04'], hpf=150, seuil=-30)
    x = C.mix((n1(w), 0, 1.0), (n1(sub), 0, dbg(-7)), (n1(s), 0.75, dbg(-12)))
    serie('x_water', [(x, [('qubodup_naval', WATER_BLAST, 'explosion à la surface de l\'eau, coupée avant la fin franche'),
                           ('samsterbirdies', BIG_BLAST, 'coup sourd : passe-bas 140 Hz (-7 dB)'),
                           ('rubberduck_eau', WS['splash_04'], 'retombée : éclaboussure à 0,75 s (-12 dB)')])],
          2.5, fout=0.5, fin_seuil=-55)

    x = prise(WS['splash_04'], hpf=60, seuil=-30)
    serie('x_splash', [(x, [('rubberduck_eau', WS['splash_04'], '« plouf » avec bulle grave, passe-haut 60 Hz')])],
          0.8, fout=0.2)


# ---------------------------------------------------------------------------------------------------------------------
# Grenade, corps

def grenade():
    sons = []
    for n in ('metal_hit_04', 'metal_hit_05', 'metal_hit_06'):
        x = decroit(prise(RD[n], hpf=80, filtres=lp(9000), seuil=-30), 0.03, 0.06)
        sons.append((x, [('rubberduck_casse', RD[n], f'{n} : objet en fonte sur sol dur, déclin 60 ms, passe-bas 9 kHz')]))
    serie('n_bounce', sons, 0.3, fout=0.08)

    sons = []
    for terre, n in (('DirtyGround_Jump_Land_02', 'metal_hit_05'), ('Snow_Jump_Land_01', 'metal_hit_04')):
        a = decroit(prise(nx(terre), hpf=80, seuil=-18), 0.03, 0.05)
        b = decroit(prise(RD[n], hpf=100, filtres=lp(2500), seuil=-30), 0.015, 0.03)
        x = C.mix((n1(a), 0, 1.0), (n1(b), 0, dbg(-10)))
        sons.append((x, [('nox', nx(terre), f'choc sur sol meuble : {terre}, déclin 50 ms'),
                         ('rubberduck_casse', RD[n], 'petit choc métallique étouffé (passe-bas 2,5 kHz, -10 dB)')]))
    serie('n_bounce_soft', sons, 0.25, fout=0.07)


def corps():
    combos = [(1, 'Helmet/setDown1', 'impactPunch_heavy_000'), (2, 'Helmet/setDown2', 'impactPunch_heavy_001'),
              (5, 'Helmet/setDown1', 'impactPunch_heavy_002')]
    sons = []
    for k, (b, eqp, coup) in enumerate(combos):
        a = prise(BODYFALL[b], hpf=50)
        g = af(attaque(ken(eqp), -12), hp(300))
        g = decroit(g, 0.04, 0.08)
        p = decroit(af(ken(coup), hp(40), lp(900)), 0.04, 0.08)
        x = af(C.mix((n1(a), 0, 1.0), (n1(p), 0, dbg(-6)), (n1(g), 0.025 + 0.01 * k, dbg(-9))), eq(900, 4, 0.8))
        sons.append((x, [('mlsulli', BODYFALL[b], f'corps qui heurte le béton, prise {b}, passe-haut 50 Hz ; ensemble +4 dB '
                          'vers 900 Hz'),
                         ('kenney', K[coup], 'coup mat (passe-bas 900 Hz, -6 dB)'),
                         ('kenney', K[eqp], 'équipement qui claque : casque posé (passe-haut 300 Hz, -9 dB)')]))
    serie('b_fall', sons, 0.6, fout=0.15)


# ---------------------------------------------------------------------------------------------------------------------
# Objets

def objets():
    def court(rel, hpf=60, filtres='', tenue=0.05, tau=0.08, seuil=-30, kenney=False):
        x = af(attaque(ken(rel) if kenney else src(rel), seuil), hp(hpf), filtres)
        return decroit(x, tenue, tau)

    serie('o_metal', [
        (court(WM['metal_sheet_06'], 70), [('rubberduck_bois_metal', WM['metal_sheet_06'], 'tôle frappée, déclin 80 ms')]),
        (court(RD['metal_hit_02'], 70), [('rubberduck_casse', RD['metal_hit_02'], 'objet métallique heurté, déclin 80 ms')]),
    ], 0.35, fout=0.1)
    serie('o_wood', [
        (court(WM['wood_hit_01'], 60), [('rubberduck_bois_metal', WM['wood_hit_01'], 'choc de bois, déclin 80 ms')]),
        (court('impactWood_medium_002', 60, kenney=True), [('kenney', K['impactWood_medium_002'], 'choc de bois, déclin 80 ms')]),
    ], 0.35, fout=0.1)
    serie('o_plastic', [
        (court(HIT100, 100, lp(8000), tau=0.05), [('rubberduck_100', HIT100, 'choc creux et sec (hit_01), passe-bas 8 kHz, '
                                                  'déclin 50 ms')]),
        (court(RD['hit_10'], 100, lp(8000), tau=0.05), [('rubberduck_casse', RD['hit_10'], 'choc creux et sec (hit_10), '
                                                        'passe-bas 8 kHz, déclin 50 ms')]),
    ], 0.35, fout=0.1)
    serie('o_clay', [
        (court(CERAMIC, 80, lp(9000), tenue=0.03, tau=0.06), [('erbsland', CERAMIC, 'grande assiette en céramique frappée, déclin 60 ms')]),
        (court('impactPlate_light_002', 80, kenney=True, tau=0.06), [('kenney', K['impactPlate_light_002'], 'choc de vaisselle, déclin 60 ms')]),
    ], 0.35, fout=0.1)
    a = court('dropLeather', 60, tenue=0.03, tau=0.06, seuil=-15, kenney=True)
    b = court('impactSoft_medium_003', 40, lp(1500), kenney=True, tenue=0.02, tau=0.04)
    serie('o_soft', [(C.mix((n1(a), 0, 1.0), (n1(b), 0, dbg(-6))),
                      [('kenney', K['dropLeather'], 'sac de cuir lâché (RPG Audio dropLeather), déclin 60 ms'),
                       ('kenney', K['impactSoft_medium_003'], 'coup mou grave (passe-bas 1,5 kHz, -6 dB)')])], 0.35, fout=0.1)
    a = court(WS['slime_15'], 80, tau=0.08)
    b = court('impactPunch_heavy_002', 50, lp(1200), kenney=True, tenue=0.02, tau=0.05)
    serie('o_fruit', [(C.mix((n1(a), 0, 1.0), (n1(b), 0, dbg(-8))),
                       [('rubberduck_eau', WS['slime_15'], 'écrasement humide (slime_15)'),
                        ('kenney', K['impactPunch_heavy_002'], 'coup mat (passe-bas 1,2 kHz, -8 dB)')])], 0.35, fout=0.1)
    serie('o_snow', [(court(nx('Snow_Jump_Land_03'), 80, tau=0.08),
                      [('nox', nx('Snow_Jump_Land_03'), 'paquet de neige : réception sur neige fraîche')])], 0.35, fout=0.1)

    # casse (1 s)
    sons = []
    for n in ('203371__c_rogers__glass-explosion_01', '203375__c_rogers__glass-shattering_01'):
        sons.append((prise(GLASS[n], hpf=120), [('c_rogers', GLASS[n], 'verre qui vole en éclats (1 s), passe-haut 120 Hz')]))
    serie('o_break_glass', sons, 1.0, fout=0.3)

    sons = []
    for k, d in enumerate(DISHES):
        a = court(CERAMIC, 80, tenue=0.02, tau=0.05)
        b = prise(d, hpf=100, seuil=-30)
        r = prise(RD['breaking_01' if k == 0 else 'breaking_03'], hpf=200, seuil=-30)
        x = C.mix((n1(a), 0, dbg(-3)), (n1(b), 0.005, 1.0), (n1(r), 0.05, dbg(-10)))
        sons.append((x, [('rubberduck_100', d, 'vaisselle qui se brise'),
                         ('erbsland', CERAMIC, 'attaque : assiette en céramique frappée (-3 dB)'),
                         ('rubberduck_casse', RD['breaking_01' if k == 0 else 'breaking_03'], 'éclats (-10 dB, à 50 ms)')]))
    serie('o_break_clay', sons, 1.0, fout=0.3)

    a = prise(nx('Snow_Hard_Jump_Land_04'), hpf=80, seuil=-30)
    b = prise(nx('Snow_Hard_Run_03'), hpf=150, seuil=-30)
    c = decroit(af(ken('impactSoft_heavy_000'), hp(45), lp(300)), 0.03, 0.06)
    x = C.mix((n1(a), 0, 1.0), (n1(b), 0.09, dbg(-6)), (n1(c), 0, dbg(-8)))
    serie('o_break_snow', [(x, [('nox', nx('Snow_Hard_Jump_Land_04'), 'bloc de neige qui s\'écrase : réception sur neige '
                                'tassée + crissement Snow_Hard_Run_03 (-6 dB, à 90 ms)'),
                                ('kenney', K['impactSoft_heavy_000'], 'coup sourd (passe-bas 300 Hz, -8 dB)')])], 1.0, fout=0.25)


# ---------------------------------------------------------------------------------------------------------------------
# Retours de touche (couches ajoutées au « hitmarker » du jeu)

def retours():
    # tête : tintement de casque très bref (sabre sur casque Kenney, raccourci) + petit choc métallique
    sons = []
    for k, (h, m) in enumerate((('Swords/hitHelmet2', 'impactMetal_light_000'), ('Swords/hitHelmet3', 'impactMetal_light_002'))):
        a = decroit(af(attaque(ken(h), -30, 0.0005), hp(900)), 0.012, 0.03)
        b = decroit(af(attaque(ken(m), -30, 0.0005), hp(500)), 0.01, 0.025)
        x = C.mix((n1(a), 0, 1.0), (n1(b), 0, dbg(-6)))
        sons.append((x, [('kenney', K[h], 'tintement de casque : tenue 12 ms, déclin 30 ms, passe-haut 900 Hz'),
                         ('kenney', K[m], 'petit choc métallique (passe-haut 500 Hz, -6 dB)')]))
    serie('h_head', sons, 0.15, fout=0.05)

    # élimination : « thunk » grave (coup de poing lourd) + corps (chute de corps, médium) + petit métal (plaque)
    sons = []
    for k, (p, pl, c) in enumerate((('impactPunch_heavy_000', 'impactPlate_heavy_000', 1),
                                    ('impactPunch_heavy_001', 'impactPlate_heavy_002', 2))):
        a = decroit(af(attaque(ken(p), -30, 0.0005), hp(40), lowshelf(90, -6), lp(2500)), 0.05, 0.07)
        b = decroit(af(attaque(ken(pl), -30, 0.0005), hp(400)), 0.03, 0.05)
        m = decroit(prise(BODYFALL[c], hpf=150, filtres=lp(5000), seuil=-20, pre=0.0005), 0.03, 0.05)
        x = af(C.mix((n1(a), 0, 1.0), (n1(m), 0.0, dbg(-2)), (n1(b), 0.0, dbg(-3))), eq(1000, 4, 0.8))
        sons.append((x, [('kenney', K[p], 'thunk grave : coup de poing lourd, -6 dB sous 90 Hz, passe-bas 2,5 kHz, déclin 70 ms'),
                         ('mlsulli', BODYFALL[c], f'corps : chute de corps prise {c} (passe-bande 150 Hz-5 kHz, -2 dB)'),
                         ('kenney', K[pl], 'petit métal : plaque frappée (passe-haut 400 Hz, -3 dB) ; ensemble +4 dB vers 1 kHz '
                          '(audible sur un haut-parleur de téléphone)')]))
    serie('h_kill', sons, 0.3, fout=0.08)


GROUPES = (balles, sifflements, explosions, grenade, corps, objets, retours)


def build(seulement=None):
    """Fabrique les masters de la famille (seulement : noms de groupes pour les essais)."""
    ENTREES.clear()
    for g in GROUPES:
        if seulement is None or g.__name__ in seulement:
            g()
    if seulement is None:
        C.write_credits('impacts', ENTREES)
