"""Famille « mecha » : le mecha de la série à 11 (paquet mecha, chargé avec les sons de la partie).

Sons : pas lourds (m_step), vérins et moteurs des articulations (m_servo), détentes d'air comprimé (m_hiss), claquements
mécaniques (m_clank), grincements de la structure (m_creak), ronronnement du groupe moteur (m_hum, boucle), chute en
météore (m_fall : grondement d'air déchiré et de feu qui enfle jusqu'à l'impact), impact au sol (m_land) et redressement
(m_rise). Tout vient d'enregistrements réels en CC0 (voir SOURCES), montés en couches : rien n'est synthétisé à partir de rien.

Traitement commun : mono 48 kHz, début à l'attaque, fondu de sortie ; transitoires en crête à -1 dBFS (le dosage se fait
dans le jeu, 05-audio.js) ; la boucle du moteur est refermée par un fondu croisé (common.loopify)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

PAQ = 'mecha'
FALL_PEAK = 2.8  # m_fall : instant où le grondement atteint son plus fort (le jeu le cale sur l'impact, MECHA_SND.peak)

SOURCES = {
    'philraco': {
        'nom': '« Hard Stomp Sound » (freesound 512483), largethud.ogg de Space Station 14',
        'auteur': 'philRacoIndie (montage brainfood1183)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/space-wizards/space-station-14/tree/master/Resources/Audio/Effects/Footsteps',
        'preuve': "attributions.yml du dossier : « license: \"CC0-1.0\" copyright: \"Made by philRacoIndie freesound.org, modified by brainfood1183\" »",
    },
    'kenney_impact': {
        'nom': 'Kenney « Impact Sounds » (impactMetal_heavy, impactPlate_heavy), copie de jam-ready-assets',
        'auteur': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets/tree/main/kenney-impact-sounds',
        'preuve': "kenney-impact-sounds/audio/License.txt : « License: (Creative Commons Zero, CC0) »",
    },
    'usc_gates': {
        'nom': 'Bibliothèques sonores de l\'USC (Sunset Editorial, Red Library) : fût de métal frappé, porte métallique coulissante, flamme de fourneau, via Gates',
        'auteur': 'University of Southern California (bandes versées au domaine public), rassemblées par AnthonE (Gates)',
        'licence': 'CC0 1.0 / domaine public',
        'url': 'https://github.com/AnthonE/Gates/tree/main/assets/sound/pd',
        'preuve': "assets/sound/MANIFEST.md : « Every file here is CC0 ... or public domain » ; « USC Sunset Editorial, Metal barrel being hit with wooden hammer (SSE_Library_METAL, CC0) », "
                  "« USC Red Library, R18-37 Sliding Metal Door Closes (Red_Library_Doors, CC0) », « USC Red Library, R09-60 Furnace Flame (Red_Library_Fire, CC0) »",
    },
    'nuckan': {
        'nom': '« hydraulics.wav » (freesound 212941), machine1.ogg et machine2.ogg de digtron',
        'auteur': 'nuckan',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/minetest-mods/digtron/tree/master/sounds',
        'preuve': "sounds/license.txt : « machine1.ogg and machine2.ogg - .../nuckan/sounds/212941/ public domain via CC 1.0 by nuckan »",
    },
    'ivolipa': {
        'nom': '« Compressor_Motor.WAV » (freesound 337447), sounds_compressor_motor_01.ogg de mod-sounds',
        'auteur': 'ivolipa',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AntumMT/mod-sounds/tree/master/sounds',
        'preuve': "sources.md : « | [compressor_motor_01][] | ivolipa | CC0 | loopable | »",
    },
    'chainsaw_dinner_party': {
        'nom': '« Homemade hydraulic hoist.aif » (freesound 403075), hydraulic_press.ogg de Space Station 14',
        'auteur': 'chainsaw_dinner_party',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/space-wizards/space-station-14/tree/master/Resources/Audio/Effects',
        'preuve': "attributions.yml du dossier : « Created by chainsaw_dinner_party on Freesound.org. Extended... » license: \"CC0-1.0\"",
    },
    'brunoboselli': {
        'nom': '« Air (or steam) pressure release » (freesound 457294), pressure_release.ogg d\'Imp Station 14',
        'auteur': 'brunoboselli',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/impstation/imp-station-14/tree/master/Resources/Audio/_Impstation/Anomalocarids',
        'preuve': "attributions.yml du dossier : « license: \"CC0-1.0\" copyright: \"Air (or steam) pressure release by brunoboselli\" »",
    },
    'kieran_keegan': {
        'nom': '« Tank Reload » (freesound 418882), setup.mp3 d\'Unciv',
        'auteur': 'KieranKeegan',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/yairm210/Unciv/tree/master/android/assets/sounds',
        'preuve': "docs/Credits.md : « Tank reload (freesound 418882) By KieranKeegan as 'setup' ... (CC0) »",
    },
    'mwsfx': {
        'nom': '« Chain Link Fence - Impacts.wav » (freesound 575388), fence_rattle1 à 3 de Space Station 14',
        'auteur': 'MWsfx',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/space-wizards/space-station-14/tree/master/Resources/Audio/Effects',
        'preuve': "attributions.yml du dossier : fence_rattle1-3.ogg, « Chain Link Fence - Impacts.wav by MWsfx », license: \"CC0-1.0\"",
    },
    'zerono1': {
        'nom': '« Airplane fly by .wav » (freesound 568128), sounds_jet_flyby.ogg de mod-sounds',
        'auteur': 'Zerono1',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/AntumMT/mod-sounds/tree/master/sounds',
        'preuve': "sources.md : « | [jet_flyby][] | Zerono1 | CC0 | »",
    },
    'klangfabrik': {
        'nom': '« roaring wind.aiff » (freesound 117773), extrait 5-117773-A-16 d\'ESC-50',
        'auteur': 'klangfabrik',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'preuve': "LICENSE d'ESC-50 : « [5-117773-A.ogg]: clip derived from roaring wind.aiff ... by klangfabrik [CC0] » (seuls les extraits marqués CC0 sont pris)",
    },
    'felix_blume': {
        'nom': '« On a train in Argentina, between two wagons. Metal pieces are squeaking » (freesound 165845), extraits 4-165845-A-45 et -B-45 d\'ESC-50',
        'auteur': 'felix.blume',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/karolpiczak/ESC-50',
        'preuve': "LICENSE d'ESC-50 : « [4-165845-A.ogg]: clip derived from ... Metal pieces are squeaking ... by felix.blume [CC0] »",
    },
    'carroll27': {
        'nom': '« Mechanical drone.aif » (freesound 151917), thruster-droning.ogg de Frontier Station 14',
        'auteur': 'carroll27',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/new-frontiers-14/frontier-station-14/tree/master/Resources/Audio/_NF/Effects/Scrapbots',
        'preuve': "attributions.yml du dossier : « license: \"CC0-1.0\" copyright: \"Edited from carroll27's 'Mechanical drone.aif'\" »",
    },
}

FILES = {}


def _url(depot, branche, chemin, lfs=False):
    base = 'https://media.githubusercontent.com/media' if lfs else 'https://raw.githubusercontent.com'
    return f'{base}/{depot}/{branche}/' + urllib.parse.quote(chemin)


def _f(rel, url):
    FILES[rel] = url
    return rel


SS14 = lambda chemin: _url('space-wizards/space-station-14', 'master', 'Resources/Audio/' + chemin)
STOMP = _f('ss14/largethud.ogg', SS14('Effects/Footsteps/largethud.ogg'))
KENNEY = [_f(f'kenney/impactMetal_heavy_00{i}.ogg', _url('series-ai/jam-ready-assets', 'main', f'kenney-impact-sounds/audio/Audio/impactMetal_heavy_00{i}.ogg', lfs=True)) for i in range(5)]
PLAQUE = [_f(f'kenney/impactPlate_heavy_00{i}.ogg', _url('series-ai/jam-ready-assets', 'main', f'kenney-impact-sounds/audio/Audio/impactPlate_heavy_00{i}.ogg', lfs=True)) for i in range(5)]
FUT = [_f(f'gates/impact_metal_{i}.ogg', _url('AnthonE/Gates', 'main', f'assets/sound/pd/impact_metal_{i}.ogg')) for i in range(5)]
PORTE = [_f(f'gates/garage_{k}_0.ogg', _url('AnthonE/Gates', 'main', f'assets/sound/pd/garage_{k}_0.ogg')) for k in ('open', 'close')]
FOURNEAU = _f('gates/bed_furnace_0.ogg', _url('AnthonE/Gates', 'main', 'assets/sound/pd/bed_furnace_0.ogg'))
FLAMME = _f('gates/furnace_light_0.ogg', _url('AnthonE/Gates', 'main', 'assets/sound/pd/furnace_light_0.ogg'))
VERIN = [_f(f'digtron/machine{i}.ogg', _url('minetest-mods/digtron', 'master', f'sounds/machine{i}.ogg')) for i in (1, 2)]
MOTEUR = _f('modsounds/sounds_compressor_motor_01.ogg', _url('AntumMT/mod-sounds', 'master', 'sounds/sounds_compressor_motor_01.ogg'))
AVION = _f('modsounds/sounds_jet_flyby.ogg', _url('AntumMT/mod-sounds', 'master', 'sounds/sounds_jet_flyby.ogg'))
HYDRAULIQUE = _f('ss14/hydraulic_press.ogg', SS14('Effects/hydraulic_press.ogg'))
DETENTE = _f('imp/pressure_release.ogg', _url('impstation/imp-station-14', 'master', 'Resources/Audio/_Impstation/Anomalocarids/pressure_release.ogg'))
CLAC = _f('unciv/setup.mp3', _url('yairm210/Unciv', 'master', 'android/assets/sounds/setup.mp3'))
GRILLAGE = [_f(f'ss14/fence_rattle{i}.ogg', SS14(f'Effects/fence_rattle{i}.ogg')) for i in (1, 2, 3)]
VENT = _f('esc50/5-117773-A-16.wav', _url('karolpiczak/ESC-50', 'master', 'audio/5-117773-A-16.wav'))
GRINCE = [_f(f'esc50/4-165845-{k}-45.wav', _url('karolpiczak/ESC-50', 'master', f'audio/4-165845-{k}-45.wav')) for k in ('A', 'B')]
GRONDE = _f('frontier/thruster-droning.ogg', _url('new-frontiers-14/frontier-station-14', 'master', 'Resources/Audio/_NF/Effects/Scrapbots/thruster-droning.ogg'))

ENTREES = []


def L(rel, start=None, dur=None):
    return C.load(C.SRC / rel, start=start, dur=dur)


def grave(x, k):
    """Ralentit et abaisse d'un facteur k (k < 1 : plus lourd, comme une bande ralentie)."""
    return C.ff(x, f'asetrate={int(SR * k)},aresample={SR}')


def env(x, pts):
    """Enveloppe par points (temps en s, gain linéaire), interpolée."""
    t = np.arange(len(x)) / SR; T, G = zip(*pts)
    return x * np.interp(t, T, G)


def master(sid, x, sources, detail='', dbfs=-1.0, fout=0.06):
    x = C.fade(C.trim(x, -60), 0.002, fout)
    C.save_master(PAQ, sid, C.norm(x, dbfs))
    for src, f in sources: ENTREES.append(C.credit(sid, PAQ, src, f, detail))


def build():
    ENTREES.clear()
    stomp, detente = L(STOMP), C.ff(L(DETENTE), 'highpass=f=1500')
    # pas : coup très grave du piétinement ralenti et son sub (filtré sous 220 Hz), plaque de métal lourde, fût qui résonne plus bas, gravats
    # qui tremblent, souffle bref d'un vérin ; un écho court (la masse qui sonne dans la rue), puis la queue s'éteint (retour du propriétaire :
    # « trop sec, ça manque de gros pas »)
    for i in range(4):
        x = C.mix((C.ff(grave(stomp, 0.74), 'lowpass=f=2800'), 0, 1.0), (C.ff(grave(stomp, 0.5), 'lowpass=f=200'), 0, 0.85),
                  (grave(L(KENNEY[i]), 0.6), 0.008, 0.25), (grave(L(FUT[i]), 0.5), 0.012, 0.32),
                  (C.ff(L(GRILLAGE[i % 3]), 'highpass=f=900'), 0.04, 0.12), (C.fade(detente[int(0.05 * SR):int(0.45 * SR)], 0.03, 0.2), 0.15, 0.1))
        x = env(C.ff(x, 'aecho=0.8:0.6:40|90:0.25|0.12'), [(0, 1), (0.12, 1), (0.5, 0.4), (1.0, 0.12), (1.4, 0.03)]) # (frappe, corps, puis la queue s'éteint)
        master(f'm_step-{i + 1}', x[:int(1.4 * SR)], [('philraco', STOMP), ('kenney_impact', KENNEY[i]), ('usc_gates', FUT[i]), ('mwsfx', GRILLAGE[i % 3]), ('brunoboselli', DETENTE)], 'ralentis, superposés, écho court', fout=0.3)
    # vérins des articulations : la pompe hydraulique et le moteur de compresseur, en courtes montées-descentes
    pompe, moteur = [L(v) for v in VERIN], L(MOTEUR)
    for i, (src, a, k) in enumerate([(0, 0.0, 1.15), (1, 0.75, 1.0), (1, 1.9, 1.3)]):
        p = grave(pompe[src][int(a * SR):int((a + 0.5) * SR)], k); m = grave(moteur[int(i * SR):int((i + 0.7) * SR)], 1.5)
        n = min(len(p), len(m)); x = env(p[:n], [(0, 0), (0.05, 1), (0.3, 0.8), (0.42, 0)]) + env(m[:n], [(0, 0), (0.1, 0.5), (0.3, 0.3), (0.42, 0)])
        master(f'm_servo-{i + 1}', x, [('nuckan', VERIN[src]), ('ivolipa', MOTEUR)], 'extraits, enveloppés', fout=0.08)
    # détentes d'air comprimé
    d = L(DETENTE)
    master('m_hiss-1', C.ff(d[:int(1.3 * SR)], 'highpass=f=300'), [('brunoboselli', DETENTE)], 'extrait', fout=0.4)
    master('m_hiss-2', grave(C.ff(d[int(0.1 * SR):int(0.8 * SR)], 'highpass=f=300'), 0.85), [('brunoboselli', DETENTE)], 'extrait ralenti', fout=0.25)
    # claquements mécaniques : culasse de char, butée d'une porte métallique, fût et plaque frappés ensemble
    porte = L(PORTE[1])
    master('m_clank-1', grave(L(CLAC), 0.8), [('kieran_keegan', CLAC)], 'ralenti')
    master('m_clank-2', grave(porte[int(1.75 * SR):], 0.85), [('usc_gates', PORTE[1])], 'butée finale, ralentie', fout=0.15)
    master('m_clank-3', C.mix((grave(L(FUT[2]), 0.7), 0, 1.0), (grave(L(PLAQUE[1]), 0.7), 0.0, 0.5)), [('usc_gates', FUT[2]), ('kenney_impact', PLAQUE[1])], 'ralentis, superposés')
    # grincements de la structure : les wagons qui frottent, ralentis et assourdis
    for i, (k, a) in enumerate([(0, 0.25), (1, 1.1)]):
        g = grave(C.ff(L(GRINCE[k], start=a, dur=1.3), 'lowpass=f=5000'), 0.75)
        master(f'm_creak-{i + 1}', env(g, [(0, 0), (0.08, 1), (1.2, 0.7), (1.7, 0)]), [('felix_blume', GRINCE[k])], 'extrait ralenti', fout=0.25)
    # groupe moteur : grondement mécanique en boucle
    h = C.loopify(C.ff(L(GRONDE), 'lowpass=f=1800'), 0.6)
    C.save_master(PAQ, 'm_hum', C.norm(h, -3)); ENTREES.append(C.credit('m_hum', PAQ, 'carroll27', GRONDE, 'boucle'))
    # chute en météore : vent qui rugit, passage d'avion et flamme de fourneau, en crescendo jusqu'au pic (FALL_PEAK s), puis le grondement se
    # maintient au plus fort jusqu'à 4 s : le jeu le coupe à l'impact réel (une chute affichée en retard sur un téléphone lent reste couverte)
    D = 4.0; P = FALL_PEAK
    pts = [(0, 0.03), (P * 0.5, 0.25), (P * 0.86, 0.85), (P, 1), (D, 1)]
    vent = env(L(VENT, dur=D), pts)
    avion = env(L(AVION, start=9.0, dur=D), [(0, 0.05), (P * 0.7, 0.4), (P, 1), (D, 1)])
    feu = env(L(FOURNEAU, start=2.0, dur=D), [(0, 0.0), (P * 0.36, 0.15), (P * 0.86, 0.6), (P, 1), (D, 1)])
    x = C.mix((vent, 0, 0.9), (grave(avion, 0.85)[:int(D * SR)], 0, 0.8), (feu, 0, 0.7))
    x = C.fade(x[:int(D * SR)], 0.3, 0.05)
    C.save_master(PAQ, 'm_fall', C.norm(x, -1))
    for s_, f in [('klangfabrik', VENT), ('zerono1', AVION), ('usc_gates', FOURNEAU)]: ENTREES.append(C.credit('m_fall', PAQ, s_, f, 'crescendo monté, grondement tenu'))
    # impact : le piétinement très ralenti, la porte et la plaque, l'air chassé des vérins et le grillage qui tremble (débris)
    x = C.mix((grave(stomp, 0.55), 0, 1.0), (grave(porte[int(1.75 * SR):], 0.6), 0.0, 0.5), (grave(L(KENNEY[1]), 0.55), 0.0, 0.45),
              (C.ff(d, 'highpass=f=400')[:int(2.0 * SR)], 0.3, 0.35), (L(GRILLAGE[1]), 0.08, 0.6), (L(GRILLAGE[2]), 0.2, 0.5))
    master('m_land', x, [('philraco', STOMP), ('usc_gates', PORTE[1]), ('kenney_impact', KENNEY[1]), ('brunoboselli', DETENTE), ('mwsfx', GRILLAGE[1]), ('mwsfx', GRILLAGE[2])], 'superposés', fout=0.4)
    # redressement : le vérin qui pousse, la pompe qui siffle, un claquement de verrou et l'air relâché
    hy = env(grave(L(HYDRAULIQUE, start=1.0, dur=1.6), 0.9), [(0, 0), (0.15, 1), (1.3, 0.9), (1.75, 0)])
    sv = env(L(VERIN[1], start=0.8, dur=1.2), [(0, 0), (0.1, 0.7), (1.0, 0.5), (1.2, 0)])
    x = C.mix((hy, 0, 1.0), (sv, 0.2, 0.6), (grave(L(CLAC), 0.75), 1.55, 0.8), (C.ff(d, 'highpass=f=400')[:int(0.7 * SR)], 1.7, 0.4))
    master('m_rise', x, [('chainsaw_dinner_party', HYDRAULIQUE), ('nuckan', VERIN[1]), ('kieran_keegan', CLAC), ('brunoboselli', DETENTE)], 'superposés', fout=0.3)
    C.write_credits('mecha', ENTREES)
