"""Famille « ambiances » : lits d'ambiance et ponctuels des cartes (paquets amb_sable, amb_givre, amb_embruns, amb_floreal, amb_meltem,
amb_tephra, amb_stratus).

Chaque paquet a un lit stéréo bouclable (a_bed, 27 s, efficace -20 dBFS) et des ponctuels mono (crête -3 dBFS,
6 s au plus) que le jeu disperse dans l'espace ; quelques ponctuels sont des boucles mono (fontaine, ressac, cascade).
Tout vient d'enregistrements réels sous CC0, domaine public ou CC BY, trouvés en copie sur GitHub (Freesound,
BigSoundBank, Wikimedia Commons) : voir SOURCES. Les sons sans prise exacte (drisses contre un mât, cloche de bouée,
neige qui glisse d'un toit) sont composés de couches réelles ; rien n'est synthétisé.

Lits : couches longues choisies sans événement marquant (pas de voix, de moteur proche ni d'oiseau reconnaissable),
filtrées (passe-haut contre le grondement du vent sur le micro, passe-bas pour l'éloignement), mélangées puis bouclées
par un long fondu croisé à puissance constante (3 s). Une source mono devient stéréo en prenant deux passages
différents pour la gauche et la droite. Les instants de découpe viennent de l'analyse des sources (enveloppe et
spectrogramme)."""
import urllib.parse
import numpy as np
import common as C
from common import SR

SOURCES = {
    'amb-blume-herbe': {
        'nom': '« Dry grass rustling in the wind, in the desert of Chile » (freesound 146436)',
        'auteur': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/146436/',
        'preuve': "doc/sources/audio-weather.txt du dépôt arianne/stendhal : « wind.* Félix Blume; CC0; "
                  "https://freesound.org/people/felix.blume/sounds/146436/ » (copie FLAC sans perte du projet Stendhal)",
    },
    'amb-blume-anatolie': {
        'nom': '« Strong wind blowing in the plain in Anatolia (Turkey) » (freesound 167684)',
        'auteur': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/167684/',
        'preuve': "public/assets/ASSET_LICENSES.md du dépôt Aarymanv/hillbomb-sf : « audio/amb/amb_wind_high.mp3: Strong wind "
                  "blowing in the plain in Anatolia (Turkey) by felix.blume (freesound, CC0 1.0) »",
    },
    'amb-blume-drapeau': {
        'nom': '« A flag flapping in the wind, at the small village of Assem Souk, in the High Atlas (Morocco) » (freesound 154794)',
        'auteur': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/154794/',
        'preuve': "assets/sounds/LICENSES.md du dépôt thegriglat/deltaplan : « sail_luff_loop.ogg | felix.blume | A flag flapping "
                  "in the wind, at the small village of Assem Souk… (freesound.org/s/154794) | CC0 | 5–27 с, ФВЧ 80 Гц, луп »",
    },
    'amb-blume-ane': {
        'nom': '« A donkey is braying in his enclosure in south of France » (freesound 157763)',
        'auteur': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://commons.wikimedia.org/wiki/File:157763_felix-blume_a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav',
        'preuve': "assets-src/SOUND-CREDITS.md du dépôt shiv19/animal-sounds : « donkey: \"157763 felix-blume a-donkey-is-braying-"
                  "in-his-enclosure-in-south-of-france.wav\" by felix-blume — CC0 »",
    },
    'amb-janbezouska': {
        'nom': '« Downtown LA, Little Tokyo, late night semi distant traffic » (freesound 330427)',
        'auteur': 'janbezouska',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/330427/',
        'preuve': "public/assets/ASSET_LICENSES.md du dépôt Aarymanv/hillbomb-sf : « amb_city_night.mp3: Downtown LA, Little Tokyo, "
                  "late night semi distant traffic.wav by janbezouska (freesound, CC0 1.0) »",
    },
    'amb-poorenglishjuggler': {
        'nom': 'Chant de coq (freesound 269496)',
        'auteur': 'poorenglishjuggler',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/269496/',
        'preuve': "sources.md du dépôt AntumMT/mod-sounds : « [rooster][] | poorenglishjuggler | CC0 », [rooster]: "
                  "https://freesound.org/s/269496/",
    },
    'amb-v23': {
        'nom': '« Angry big dog barking - Far » (freesound 440865)',
        'auteur': 'v23',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/440865/',
        'preuve': "assets/ATTRIBUTION.md du dépôt Steve-Sitax/Moodygame : « Dog far off: \"Angry big dog barking - Far [d15]\", "
                  "dog-far-440865.ogg | Freesound, https://freesound.org/people/v23/sounds/440865/ (by v23) | CC0 1.0 (the sound "
                  "page names \"Creative Commons 0\") »",
    },
    'amb-nathankwright': {
        'nom': '« mourning_dove _2017-06-06 » (freesound 456930)',
        'auteur': 'nathankwright',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/nathankwright/sounds/456930/',
        'preuve': "public/audio/CREDITS.md du dépôt dgreenheck/tidewater : « bird_dove.ogg | 5 dove coo phrases | mourning_dove "
                  "_2017-06-06.wav | nathankwright | CC0 1.0 »",
    },
    'amb-bsb': {
        'nom': 'BigSoundBank : port de Deauville (s1444), mâts qui sifflent (s2443), mer à Dellec (s2565), ruisseau (s3137), '
               'cloche de 5 heures (s3445), merle noir (s3476), fauvette à tête noire (s3466)',
        'auteur': 'Joseph Sardin (BigSoundBank) ; merle et fauvette : « Le tiroir du fond »',
        'licence': 'CC0 1.0',
        'url': 'https://bigsoundbank.com',
        'preuve': "Moodygame assets/ATTRIBUTION.md (« BigSoundBank … CC0 1.0. Page reads \"CC0 (public domain): Free and royalty-"
                  "free\" »), the-quiet-page licenses/audio/AMBIENT-AUDIO-NOTICES.md (« Sea of the beach of Dellec 2 … License: CC0 "
                  "/ public domain »), detour game/assets/CREDITS.md (« Birdsong: real recordings, CC0 … BigSoundBank »)",
    },
    'amb-kyles': {
        'nom': '« mountain wind heavy strong gusts Swiss Alps » (freesound 454092)',
        'auteur': 'kyles',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/454092/',
        'preuve': "assets/sounds/LICENSES.md du dépôt thegriglat/deltaplan : « wind_launch_gusts_loop.ogg | kyles | mountain wind "
                  "heavy strong gusts Swiss Alps (freesound.org/s/454092) | CC0 »",
    },
    'amb-stewdio2003': {
        'nom': 'Vent hurlant (freesound 238374)',
        'auteur': 'stewdio2003',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/stewdio2003/sounds/238374/',
        'preuve': "doc/sources/audio-weather.txt du dépôt arianne/stendhal : « wind_heavy.* stewdio2003; CC0 »",
    },
    'amb-straget-corneille': {
        'nom': 'Corneille (freesound 404687)',
        'auteur': 'Samuel Strågefors (straget)',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/straget/sounds/404687/',
        'preuve': "doc/sources/audio-sfx.txt du dépôt arianne/stendhal : « bird-crow-02.* Samuel Strågefors (straget); CC0; "
                  "https://freesound.org/people/straget/sounds/404687/ »",
    },
    'amb-department64': {
        'nom': 'Arbre qui grince (freesound 95262)',
        'auteur': 'Department64',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/95262/',
        'preuve': "sources.md du dépôt AntumMT/mod-sounds : « [tree_creak][] | Department64 | CC0 »",
    },
    'amb-laft2k': {
        'nom': '« Wood Creaking » (freesound 397620)',
        'auteur': 'laft2k',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/laft2k/sounds/397620/',
        'preuve': "asset-credits/audio.md du dépôt 4ismael1/LUN-game : « loop_creaking_wood.mp3 | Wood Creaking.wav | laft2k | "
                  "Freesound | https://freesound.org/people/laft2k/sounds/397620/ | CC0 1.0 »",
    },
    'amb-nox': {
        'nom': 'NOX SOUND « Footsteps - Essentials » (pas dans la neige)',
        'auteur': 'Nox_Sound',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/helzpont/home4/tree/main/assets/audio/Footsteps_Essentials_NOX_SOUND',
        'preuve': "Essentials_Series_README.pdf livré avec le pack : « All these sounds are under CC0 license. »",
    },
    'amb-biofonik': {
        'nom': '« RiverWavesWall » (freesound 851906)',
        'auteur': 'Biofonik',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/851906/',
        'preuve': "assets/ATTRIBUTION.md du dépôt Steve-Sitax/Moodygame : « Water against the quay wall: \"BFNK_ISQ_RiverWavesWall_"
                  "H1n_20260426\", water-wall-851906-loop.ogg | Freesound, https://freesound.org/people/Biofonik/sounds/851906/ | "
                  "CC0 1.0 »",
    },
    'amb-richardemoore': {
        'nom': '« WavesOnTheShore » (freesound 260263)',
        'auteur': 'richardemoore',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/richardemoore/sounds/260263/',
        'preuve': "public/audio/CREDITS.md du dépôt dgreenheck/tidewater : « pier_lap.ogg | water lapping a dock — loop | "
                  "WavesOnTheShore.wav | richardemoore | CC0 1.0 »",
    },
    'amb-soojay': {
        'nom': '« Seagulls / gaviotas clean wildtrack » (freesound 462462)',
        'auteur': 'Soojay',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/462462/',
        'preuve': "sources.md du dépôt AntumMT/mod-sounds : « [seagulls][] | Soojay | CC0 »",
    },
    'amb-squashy555': {
        'nom': '« Seagull on beach » (freesound 353416)',
        'auteur': 'squashy555',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/353416/',
        'preuve': "sources.md du dépôt AntumMT/mod-sounds : « [seagull*][seagull] | squashy555 | CC0 »",
    },
    'amb-genghisattenborough': {
        'nom': '« Herring Gull passing over roof » (freesound 744592)',
        'auteur': 'genghisattenborough',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/744592/',
        'preuve': "samples_mp3/gull/CREDITS.txt du dépôt Warycarpert12/abyssonata : « 744592.ogg | Herring Gull passing over roof | "
                  "genghisattenborough | CC0 »",
    },
    'amb-kyles-goelands': {
        'nom': '« seagulls 2 good sounds close nearby or distant » (freesound 637813)',
        'auteur': 'kyles',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/637813/',
        'preuve': "samples_mp3/gull/CREDITS.txt du dépôt Warycarpert12/abyssonata : « 637813.ogg | seagulls 2 good sounds close "
                  "nearby or distant.flac | kyles | CC0 »",
    },
    'amb-kenney': {
        'nom': 'Kenney « Impact Sounds » (chocs de métal léger)',
        'auteur': 'Kenney (www.kenney.nl)',
        'licence': 'CC0 1.0',
        'url': 'https://github.com/series-ai/jam-ready-assets',
        'preuve': "License.txt du pack : « License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/ »",
    },
    'amb-craigsmith': {
        'nom': '« R28-03 Large Wood Ship Creaking » (freesound 483355) et « G27-04 Wood Pulley Creak » (freesound 438350)',
        'auteur': 'craigsmith',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/craigsmith/sounds/483355/',
        'preuve': "assets/ATTRIBUTION.md du dépôt Steve-Sitax/Moodygame : « Moored ships: \"R28-03 Large Wood Ship Creaking\" … "
                  "freesound.org/people/craigsmith/sounds/483355 … CC0 1.0 » ; « Rope and block creak: \"G27-04 Wood Pulley Creak\", "
                  "pulley-creak-438350.ogg | Freesound, https://freesound.org/people/craigsmith/sounds/438350/ | CC0 1.0 »",
    },
    'amb-dowd': {
        'nom': '« Original foghorn at East Brother Island Lighthouse » (Wikimedia Commons)',
        'auteur': 'Elwood P. Dowd',
        'licence': 'CC0 1.0',
        'url': 'https://commons.wikimedia.org/',
        'preuve': "Assets/_Project/Audio/LICENSES.md du dépôt apholmes7-bot/hiddenharbours : « SFX/foghorn.wav | Original foghorn "
                  "at East Brother Island Lighthouse (commons.wikimedia.org) | Elwood P. Dowd | CC0 1.0 »",
    },
    'amb-sojan': {
        'nom': '« Ship Bell Single Ring » (freesound 353233)',
        'auteur': 'Sojan',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/353233/',
        'preuve': "assets/ATTRIBUTION.md du dépôt Steve-Sitax/Moodygame : « Ship's watch bell: \"Ship Bell Single Ring\", "
                  "ship-bell-353233.ogg | Freesound, https://freesound.org/people/Sojan/sounds/353233/ (by Sojan) | CC0 1.0 »",
    },
    'amb-icmusic': {
        'nom': '« Birdsong and wind through trees in Stockwood Park » (freesound 268934)',
        'auteur': 'icmusic',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/268934/',
        'preuve': "public/assets/ASSET_LICENSES.md du dépôt Aarymanv/hillbomb-sf : « audio/amb/amb_park_day.mp3: Birdsong and wind "
                  "through trees in Stockwood Park by icmusic (freesound, CC0 1.0) »",
    },
    'amb-blume-savane': {
        'nom': 'Vent dans l\'herbe sèche et un arbre (freesound 666177)',
        'auteur': 'Félix Blume',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/felix.blume/sounds/666177/',
        'preuve': "resources/sounds/SOURCES.json du dépôt Barbarisch/phyxel : « ambience/savanna_bed.wav : source_url https://"
                  "freesound.org/people/felix.blume/sounds/666177/, license CC0-1.0, author felix.blume »",
    },
    'amb-hdfreema': {
        'nom': '« Night Crickets Back Porch » (freesound 333221)',
        'auteur': 'hdfreema',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/333221/',
        'preuve': "public/audio/CREDITS.md du dépôt dgreenheck/tidewater : « crickets.ogg | night crickets — loop | Night Crickets "
                  "Back Porch.aiff (freesound 333221) | hdfreema | CC0 1.0 »",
    },
    'amb-tom-woysky': {
        'nom': 'Abeilles (freesound 243011)',
        'auteur': 'tom_woysky',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/s/243011/',
        'preuve': "sources.md du dépôt AntumMT/mod-sounds : « [bees][] | tom_woysky | CC0 | loopable »",
    },
    'amb-mysid': {
        'nom': 'Pinson des arbres, pigeon ramier et mésange charbonnière (Wikimedia Commons : Fringilla_coelebs_short.ogg, '
               'Columba_palumbus_birdsong.ogg, Parus_major.ogg)',
        'auteur': 'Oona Räisänen (Mysid)',
        'licence': 'Domaine public',
        'url': 'https://commons.wikimedia.org/wiki/File:Columba_palumbus_birdsong.ogg',
        'preuve': "blechdom/morphazoid assets/bioacoustics/SOURCES.md (« Songbirds — public-domain dedications … Oona Räisänen … "
                  "chaffinch.ogg ») ; flowwweb/sailingsimulator THIRD_PARTY_NOTICES.md (« wood-pigeon.ogg … Oona Räisänen (Mysid) … "
                  "License: Public domain, released by the copyright holder ») ; SiddDevZ/hanakawa-game public/assets/audio/tit/"
                  "provenance.json (« Parus_major.ogg … Public domain (PD-self) … Oona Räisänen (Mysid) »)",
    },
    'amb-benboncan': {
        'nom': 'Pic qui tambourine (freesound 66955)',
        'auteur': 'Benboncan',
        'licence': 'CC BY 3.0',
        'url': 'https://freesound.org/people/Benboncan/sounds/66955/',
        'preuve': "doc/sources/audio-sfx.txt du dépôt arianne/stendhal : « bird-woodpecker-01.* Benboncan; CC BY 3.0; "
                  "https://freesound.org/people/Benboncan/sounds/66955/ »",
        'attribution': 'Woodpecker by Benboncan (freesound.org/s/66955), licensed CC BY 3.0 (découpé, filtré)',
    },
    'amb-straget-cascade': {
        'nom': 'Cascade (freesound 489073)',
        'auteur': 'Samuel Strågefors (straget)',
        'licence': 'CC BY (3.0 ou 4.0 : la copie ne précise pas la version)',
        'url': 'https://freesound.org/people/straget/sounds/489073/',
        'preuve': "README.md du dépôt mateusfg7/Noisekun, section Sounds : « [Waterfall](freesound straget/489073) | Straget | "
                  "CC BY »",
        'attribution': 'Waterfall by Samuel Strågefors (straget, freesound.org/s/489073), licensed CC BY (extrait bouclé)',
    },
    'amb-gluckose': {
        'nom': 'Ruisseau de montagne (freesound 333987)',
        'auteur': 'gluckose',
        'licence': 'CC0 1.0',
        'url': 'https://freesound.org/people/gluckose/sounds/333987/',
        'preuve': "SOUNDS_LICENSING.md du dépôt rafaelmardojai/blanket : « [Stream](https://freesound.org/people/gluckose/sounds/"
                  "333987/) | gluckose | - | CC0 »",
    },
}

# Sources prises directement sur Freesound (licence lue par son API : Creative Commons 0) : Meltem, Tephra, Stratus
SOURCES.update({
    'fs-185225': {'nom': '« Gentle sea wash » (freesound 185225)', 'auteur': 'deleted_user_3277771', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/deleted_user_3277771/sounds/185225/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/185225) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-690510': {'nom': '« Cicada chorus in Paros » (freesound 690510)', 'auteur': 'CalebLopez', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/CalebLopez/sounds/690510/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/690510) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-690512': {'nom': '« Winds howl across a sun shade » (freesound 690512)', 'auteur': 'CalebLopez', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/CalebLopez/sounds/690512/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/690512) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-457956': {'nom': '« Waves lapping on rocks » (freesound 457956)', 'auteur': 'dan.pugsley', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/dan.pugsley/sounds/457956/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/457956) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-462462': {'nom': '« Seagulls / gaviotas clean wildtrack.WAV » (freesound 462462)', 'auteur': 'Soojay', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Soojay/sounds/462462/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/462462) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-153580': {'nom': '« Church Bell sound.wav » (freesound 153580)', 'auteur': 'Thejack288', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Thejack288/sounds/153580/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/153580) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-131925': {'nom': '« Italia, Napoli - A herd of goat is eating; the small bell are tickling » (freesound 131925)', 'auteur': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/131925/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/131925) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-131924': {'nom': '« A windmill is squeaking alone in the desert (USA, Arizona) » (freesound 131924)', 'auteur': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/131924/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/131924) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-176589': {'nom': '« YasurVolcanoe-Vanuatu-TannaIsland-SmallEruption.wav » (freesound 176589)', 'auteur': 'Hendrik', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Hendrik/sounds/176589/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/176589) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-415608': {'nom': '« Mud Volcano Field - Salton Sea » (freesound 415608)', 'auteur': 'RTB45', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/RTB45/sounds/415608/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/415608) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-829623': {'nom': '« Ambiance_Hot_Spring_Furnas_Caldeiras_Loop_Stereo_04 » (freesound 829623)', 'auteur': 'Nox_Sound', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Nox_Sound/sounds/829623/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/829623) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-144559': {'nom': '« Power Transformer Waterloo Station London-2.aiff » (freesound 144559)', 'auteur': 'kiefspoon', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/kiefspoon/sounds/144559/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/144559) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-127140': {'nom': '« thunder001.aiff » (freesound 127140)', 'auteur': 'klangfabrik', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/klangfabrik/sounds/127140/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/127140) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-112296': {'nom': '« desertwind1FINAL.wav » (freesound 112296)', 'auteur': 'slugzilla', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/slugzilla/sounds/112296/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/112296) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-165526': {'nom': '« Wind singing in the mountain, some night cricket in background » (freesound 165526)', 'auteur': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/165526/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/165526) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-135193': {'nom': '« Wind blowing in the bush on the top of Kitt Peak mountain. (USA, Arizona) » (freesound 135193)', 'auteur': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/135193/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/135193) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-156414': {'nom': '« Wind blowing into some cactus spine, on the top of the mountain, in the desert of Atacama » (freesound 156414)', 'auteur': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/156414/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/156414) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-817188': {'nom': '« Gusty Wind on Ridge » (freesound 817188)', 'auteur': 'craigsmith', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/craigsmith/sounds/817188/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/817188) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-231438': {'nom': '« hamp rope creaks » (freesound 231438)', 'auteur': '6polnic', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/6polnic/sounds/231438/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/231438) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-648430': {'nom': '« Two buzzards in a windy forest.wav » (freesound 648430)', 'auteur': 'bruno.auzet', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/bruno.auzet/sounds/648430/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/648430) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-194678': {'nom': '« a buzzard call » (freesound 194678)', 'auteur': 'Jaturo', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/Jaturo/sounds/194678/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/194678) : creativecommons.org/publicdomain/zero/1.0'},
    'fs-187364': {'nom': '« A flag flapping in the wind in the Mojave Desert (California) » (freesound 187364)', 'auteur': 'felix.blume', 'licence': 'CC0 1.0', 'url': 'https://freesound.org/people/felix.blume/sounds/187364/',
               'preuve': 'licence donnée par l\'API de Freesound (apiv2/sounds/187364) : creativecommons.org/publicdomain/zero/1.0'},
})


# ---------------------------------------------------------------------------------------------------------------------
# Fichiers sources : chemin local sous assets_src/sfx/src -> adresse de téléchargement direct.
FILES = {}


def _url(depot, branche, chemin, lfs=False):
    base = 'https://media.githubusercontent.com/media' if lfs else 'https://raw.githubusercontent.com'
    return f'{base}/{depot}/{branche}/' + urllib.parse.quote(chemin)


def _f(rel, depot, branche, chemin, lfs=False):
    FILES[rel] = _url(depot, branche, chemin, lfs)
    return rel


def _st(nom):           # Stendhal : sources sans perte
    return _f('stendhal/' + nom, 'arianne/stendhal', 'master', 'data/sounds/lossless_sources/' + nom)


def _moody(dossier, nom):
    return _f('moodygame/' + nom, 'Steve-Sitax/Moodygame', 'main', f'client/public/audio/{dossier}/{nom}')


def _antum(nom):
    return _f('antum/' + nom, 'AntumMT/mod-sounds', 'master', 'sounds_src/' + nom)


def _nox(chemin):
    return _f('nox/' + chemin, 'helzpont/home4', 'main', 'assets/audio/Footsteps_Essentials_NOX_SOUND/' + chemin)


def _fs(ident, chemin):  # Freesound : extrait de haute qualité (MP3) servi par cdn.freesound.org, sans clé
    return _f_direct(f'freesound/{ident}.mp3', 'https://cdn.freesound.org/previews/' + chemin)


def _f_direct(rel, url):
    FILES[rel] = url
    return rel


# Khamsin
WIND_GRASS = _st('weather/wind.flac')
WIND_ANATOLIA = _f('hillbomb/amb_wind_high.mp3', 'Aarymanv/hillbomb-sf', 'main', 'public/assets/audio/amb/amb_wind_high.mp3')
CITY = _f('hillbomb/amb_city_night.mp3', 'Aarymanv/hillbomb-sf', 'main', 'public/assets/audio/amb/amb_city_night.mp3')
DONKEY = _f('animal-sounds/donkey.wav', 'shiv19/animal-sounds', 'main', 'assets-src/sounds/donkey.wav')
ROOSTER = _antum('sounds_rooster.flac')
DOG_FAR = _moody('freesound', 'dog-far-440865.ogg')
DOVE = _f('tidewater/bird_dove.ogg', 'dgreenheck/tidewater', 'main', 'public/audio/bird_dove.ogg')
FLAG = _f('deltaplan/sail_luff_loop.ogg', 'thegriglat/deltaplan', 'main', 'assets/sounds/sail/sail_luff_loop.ogg')
TRICKLE = _f('quiet-page/river.ogg', 'YARObHATEM/the-quiet-page', 'main', 'src/renderer/audio/ambient/river.ogg')

# Val-Blanc
WIND_ALPS = _f('deltaplan/wind_launch_gusts_loop.ogg', 'thegriglat/deltaplan', 'main',
               'assets/sounds/ambient/wind_launch_gusts_loop.ogg')
WIND_HOWL = _st('weather/wind_heavy.flac')
BELL_CHURCH = _moody('bigsoundbank', 'bell-5-oclock-3445.ogg')
CROW = _st('bird-crow-02.flac')
TREE_CREAK = _antum('sounds_tree_creak.flac')
WOOD_CREAK = _f('lun/loop_creaking_wood.mp3', '4ismael1/LUN-game', 'main', 'public/assets/audio/loop_creaking_wood.mp3')
SNOW_LAND = [_nox('Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Jump_Land_01.wav'),
             _nox('Footsteps_Snow/Footsteps_Snow_Jump/Footsteps_Snow_Jump_Land_03.wav')]
SNOW_GRAIN = [_nox('Footsteps_Snow/Footsteps_Snow_Walk/Footsteps_Snow_Walk_03.wav'),
              _nox('Footsteps_Snow/Footsteps_Snow_Walk/Footsteps_Snow_Walk_07.wav'),
              _nox('Footsteps_Snow/Footsteps_Snow_Run/Footsteps_Snow_Run_04.wav'),
              _nox('Footsteps_Snow/Footsteps_Snow_Run/Footsteps_Snow_Run_08.wav')]

# Kervénec
PONTOON = _moody('bigsoundbank', 'water-pontoon-1444-loop.ogg')
MASTS = _moody('bigsoundbank', 'wind-masts-2443-loop.ogg')
SEA = _f('quiet-page/ocean.ogg', 'YARObHATEM/the-quiet-page', 'main', 'src/renderer/audio/ambient/ocean.ogg')
QUAY = _moody('freesound', 'water-wall-851906-loop.ogg')
PIER = _f('tidewater/pier_lap.ogg', 'dgreenheck/tidewater', 'main', 'public/audio/pier_lap.ogg')
GULLS = _antum('sounds_seagulls.flac')
GULL_LONG = _antum('sounds_seagull_01.flac')
GULL_ROOF = _f('abyssonata/gull/744592.mp3', 'Warycarpert12/abyssonata', 'main', 'samples_mp3/gull/744592.mp3')
GULL_CLOSE = _f('abyssonata/gull/637813.mp3', 'Warycarpert12/abyssonata', 'main', 'samples_mp3/gull/637813.mp3')
METAL = [_f(f'kenney/kenney-impact-sounds/audio/Audio/impactMetal_light_00{n}.ogg', 'series-ai/jam-ready-assets', 'main',
            f'kenney-impact-sounds/audio/Audio/impactMetal_light_00{n}.ogg', lfs=True) for n in range(5)]
HULL = _moody('freesound', 'ship-creak-483355-loop.ogg')
PULLEY = _moody('freesound', 'pulley-creak-438350.ogg')
FOGHORN = _f('hiddenharbours/foghorn.wav', 'apholmes7-bot/hiddenharbours', 'main', 'Assets/_Project/Audio/SFX/foghorn.wav', lfs=True)
SHIP_BELL = _moody('freesound', 'ship-bell-353233.ogg')

# Hortus
PARK = _f('hillbomb/amb_park_day.mp3', 'Aarymanv/hillbomb-sf', 'main', 'public/assets/audio/amb/amb_park_day.mp3')
SAVANNA = _f('phyxel/savanna_bed.wav', 'Barbarisch/phyxel', 'main', 'resources/sounds/ambience/savanna_bed.wav')
BEES = _antum('sounds_bees.flac')
CRICKETS = _f('tidewater/crickets.ogg', 'dgreenheck/tidewater', 'main', 'public/audio/crickets.ogg')
BLACKBIRD = _f('detour/blackbird_1.ogg', 'j4ckxyz/detour', 'main', 'game/assets/audio/birds/blackbird_1.ogg')
BLACKCAP = _f('detour/blackcap_1.ogg', 'j4ckxyz/detour', 'main', 'game/assets/audio/birds/blackcap_1.ogg')
TIT = _f('hanakawa/tit-a.mp3', 'SiddDevZ/hanakawa-game', 'main', 'public/assets/audio/tit/tit-a.mp3')
CHAFFINCH = _f('morphazoid/chaffinch.ogg', 'blechdom/morphazoid', 'main', 'assets/bioacoustics/chaffinch.ogg')
WOODPIGEON = _f('sailingsimulator/wood-pigeon.ogg', 'flowwweb/sailingsimulator', 'main', 'public/audio/wood-pigeon.ogg')
WOODPECKER = _st('bird-woodpecker-01.flac')
WATERFALL = _f('noisekun/waterfall.ogg', 'mateusfg7/Noisekun', 'main', '.github/assets/sounds/waterfall.ogg')
STREAM = _f('blanket/stream.ogg', 'rafaelmardojai/blanket', 'master', 'data/resources/sounds/stream.ogg')


# Meltem, Tephra, Stratus (Freesound)
SEA_WASH = _fs(185225, '185/185225_3277771-hq.mp3')
CICADAS_PAROS = _fs(690510, '690/690510_3609677-hq.mp3')
WIND_SHADE = _fs(690512, '690/690512_3609677-hq.mp3')
LAP_ROCKS = _fs(457956, '457/457956_9574372-hq.mp3')
GULLS_CLEAN = _fs(462462, '462/462462_2752236-hq.mp3')
BELL_SMALL = _fs(153580, '153/153580_2583807-hq.mp3')
GOATS = _fs(131925, '131/131925_1661766-hq.mp3')
WINDMILL = _fs(131924, '131/131924_1661766-hq.mp3')
YASUR = _fs(176589, '176/176589_173983-hq.mp3')
MUD_POTS = _fs(415608, '415/415608_2409224-hq.mp3')
FURNAS = _fs(829623, '829/829623_9250976-hq.mp3')
TRANSFORMER = _fs(144559, '144/144559_1154439-hq.mp3')
THUNDER = _fs(127140, '127/127140_181941-hq.mp3')
DESERT_WIND = _fs(112296, '112/112296_1330135-hq.mp3')
WIND_SINGING = _fs(165526, '165/165526_1661766-hq.mp3')
WIND_KITT = _fs(135193, '135/135193_1661766-hq.mp3')
WIND_ATACAMA = _fs(156414, '156/156414_1661766-hq.mp3')
GUSTS_RIDGE = _fs(817188, '817/817188_2524442-hq.mp3')
ROPE_CREAK = _fs(231438, '231/231438_2016452-hq.mp3')
BUZZARDS = _fs(648430, '648/648430_11519060-hq.mp3')
BUZZARD = _fs(194678, '194/194678_2824510-hq.mp3')
FLAG_MOJAVE = _fs(187364, '187/187364_1661766-hq.mp3')


# ---------------------------------------------------------------------------------------------------------------------
# Outils de traitement

def src(rel, debut=None, duree=None, stereo=False):
    """Source décodée en 48 kHz (mono, ou stéréo (n, 2)), extrait debut..debut+duree s."""
    return C.load(C.SRC / rel, mono=not stereo, start=debut, dur=duree)


def circ(x, debut, duree):
    """Extrait circulaire d'une source déjà bouclée : on peut déborder de la fin, on repart du début."""
    i = int(debut * SR) + np.arange(int(duree * SR))
    return np.take(x, i, axis=0, mode='wrap')


def af(x, *filtres):
    """Chaîne de filtres ffmpeg (les éléments vides sont ignorés)."""
    ch = ','.join(f for f in filtres if f)
    return C.ff(x, ch) if ch else x


def hp(f, n=2):
    """Passe-haut 12 dB/octave par étage (n étages)."""
    return ','.join([f'highpass=f={f}:poles=2'] * n)


def lp(f, n=2):
    """Passe-bas 12 dB/octave par étage (n étages)."""
    return ','.join([f'lowpass=f={f}:poles=2'] * n)


def eq(f, g, q=1.0):
    return f'equalizer=f={f}:t=q:w={q}:g={g}'


def aigus(f, g):
    return f'highshelf=f={f}:g={g}'


def graves(f, g):
    return f'lowshelf=f={f}:g={g}'


def fr(v):
    """Nombre écrit à la française pour les crédits (virgule décimale)."""
    return f'{v:g}'.replace('.', ',')


def dbg(d):
    return 10 ** (d / 20)


def rms(x):
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0


def a_niveau(x, ref, ecart_db):
    """Met x à ecart_db (dB) du niveau efficace de ref."""
    r = rms(x)
    return x * (rms(ref) * dbg(ecart_db) / r) if r > 0 else x


def transpose(x, demitons):
    """Transposition par changement de vitesse (la durée change avec la hauteur)."""
    if not demitons: return x
    r = 2 ** (demitons / 12)
    return C.ff(x, f'asetrate={int(round(SR * r))},aresample={SR}')


def mono(x):
    return x if x.ndim == 1 else x.mean(axis=1)


def convolue(x, ir):
    n = len(x) + len(ir) - 1
    m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[:n]


def queue(x, rt=1.5, mix=0.2, sombre=3500, graine=1):
    """Petite réverbération de plein air : réponse diffuse (bruit à décroissance exponentielle, 60 dB en rt secondes,
    assombrie au-dessus de sombre Hz) mêlée au son direct. Donne la distance et le lieu à un son pris de près."""
    x = C.fade(x, 0, 0.03)         # le son direct finit sans marche (la queue continue derrière)
    n = int(rt * SR)
    rng = np.random.default_rng(graine)
    ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / n)
    ir = af(ir, lp(sombre, 1))
    ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir /= np.sqrt(np.sum(ir ** 2))
    out = np.zeros(len(x) + n - 1)
    out[:len(x)] += x
    out += mix * convolue(x, ir)
    return out


def enveloppe_rafale(x, monte=1.0, descend=1.5, courbe=1.6):
    """Une rafale prise dans un vent continu : montée et descente lentes pour qu'elle naisse et meure d'elle-même."""
    y = x.copy(); n = len(y)
    a, b = int(monte * SR), int(descend * SR)
    y[:a] *= np.linspace(0, 1, a) ** courbe
    y[n - b:] *= np.linspace(1, 0, b) ** courbe
    return y


def stereo(g, d):
    n = min(len(g), len(d))
    return np.stack([g[:n], d[:n]], axis=1)


def moyenne(v, w):
    """Moyenne glissante centrée sur w échantillons (sommes cumulées : rapide même pour de longues fenêtres)."""
    w = max(1, int(w))
    c = np.concatenate([[0.0], np.cumsum(np.pad(v, (w // 2, w - 1 - w // 2), mode='edge'))])
    return (c[w:] - c[:-w]) / w


def repare(x, *zones):
    """Efface de courts accidents (clic de micro, choc) : chaque zone (instant central, largeur en s) est remplacée par le
    passage qui la précède immédiatement, posé en fondu enchaîné de 5 ms à chaque bout (le fond continue sans trou)."""
    y = x.copy(); f = int(0.005 * SR)
    for t, w in zones:
        a = int((t - w / 2) * SR); n = int(w * SR) + 2 * f
        piece = x[a - n - f:a - f].copy()
        r = np.linspace(0, 1, f)
        rr = r if x.ndim == 1 else r[:, None]
        seg = y[a - f:a - f + n].copy()
        seg[:f] = seg[:f] * (1 - rr) + piece[:f] * rr
        seg[f:n - f] = piece[f:n - f]
        seg[n - f:] = piece[n - f:] * (1 - rr) + seg[n - f:] * rr
        y[a - f:a - f + n] = seg
    return y


def large(x, k=1.5):
    """Élargit une image stéréo trop centrée (le côté S = (G - D) / 2 multiplié par k)."""
    m = (x[:, 0] + x[:, 1]) / 2; c = (x[:, 0] - x[:, 1]) / 2 * k
    return np.stack([m + c, m - c], axis=1)


def nivelle(x, fenetre=1.0, force=0.5):
    """Adoucit les houles lentes de niveau (rafale d'un lit qui reviendrait à chaque tour de boucle) : gain
    (moyenne / efficace local)^force, efficace mesuré sur fenetre secondes et lissé."""
    m = x if x.ndim == 1 else x.mean(axis=1)
    w = int(fenetre * SR)
    e = np.sqrt(moyenne(m ** 2, w)) + 1e-9
    g = moyenne((np.sqrt(np.mean(m ** 2)) / e) ** force, w)
    return x * (g if x.ndim == 1 else g[:, None])


def limite(x, reduction=6.0):
    """Limiteur à anticipation : les crêtes les plus vives (gouttes, claquements d'eau) baissent jusqu'à reduction dB,
    le reste passe tel quel ; rapproche le niveau efficace de la crête pour une boucle d'eau."""
    y = C.norm(x, 0.0)
    return af(y, f'alimiter=limit={dbg(-reduction):.4f}:attack=1:release=40:level=0:latency=1')


def porte(x, seuil=-30.0, plancher=-14.0, lisse=0.03):
    """Porte douce : sous seuil (dB sous la crête de l'enveloppe), le gain descend jusqu'à plancher dB ; retire le fond
    entre les notes d'un chant pris dans un endroit bruyant."""
    w = int(lisse * SR)
    e = np.sqrt(moyenne(x ** 2, w))
    e = e / (np.max(e) or 1)
    g = np.clip((20 * np.log10(np.maximum(e, 1e-9)) - seuil) / 10 + 1, 0, 1)   # 10 dB de pente sous le seuil
    g = moyenne(dbg(plancher) + (1 - dbg(plancher)) * g, w)
    return x * g


def place(n, *couches):
    """Somme de couches (signal, instant en s, gain) dans un tampon de n échantillons (mono ou stéréo)."""
    out = np.zeros((n,) + couches[0][0].shape[1:])
    for s, t, g in couches:
        i = int(t * SR)
        if i >= n: continue
        k = min(len(s), n - i)
        out[i:i + k] += s[:k] * g
    return out


# ---------------------------------------------------------------------------------------------------------------------
# Finitions et crédits

CREDITS = []


def _credit(pack, sid, sources, detail):
    """sources : liste de (clé de SOURCES, fichier)."""
    for cle, fichier in sources:
        CREDITS.append(C.credit(sid, pack, cle, fichier, detail))


def ponctuel(pack, sid, x, dmax, sources, detail, seuil=-40.0, fin_seuil=-55.0, fout=0.3, fin_s=0.004):
    """Ponctuel mono : tête coupée à l'attaque (seuil dB sous la crête), queue coupée sous fin_seuil, dmax s au plus,
    fondus, crête -3 dBFS."""
    x = mono(x)
    x = x - np.mean(x)
    x = C.trim(x, seuil, 0.004)
    x = x[:C.tail_end(x, fin_seuil)]
    if len(x) > dmax * SR: x = x[:int(dmax * SR)]
    x = C.fade(x, fin_s, min(fout, len(x) / SR / 3))
    C.save_master(pack, sid, C.norm(x, -3.0))
    _credit(pack, sid, sources, detail)


def boucle_mono(pack, sid, x, xf, sources, detail):
    """Boucle mono : x dure (durée voulue + xf) ; la fin passe en fondu croisé sur le début ; crête -3 dBFS."""
    x = mono(x)
    y = C.loopify(x - np.mean(x), xf)
    C.save_master(pack, sid, C.norm(y, -3.0))
    _credit(pack, sid, sources, detail)


def lit(pack, x, xf, sources, detail):
    """Lit stéréo : x dure (durée voulue + xf) ; fondu croisé de xf s de la fin sur le début ; efficace -20 dBFS."""
    y = C.loopify(x - np.mean(x, axis=0), xf)
    C.save_master(pack, 'a_bed', C.norm_rms(y, -20.0, -3.0))
    _credit(pack, 'a_bed', sources, detail)


# ---------------------------------------------------------------------------------------------------------------------
# Khamsin : village du désert en fin d'après-midi

def sable():
    P = 'amb_sable'
    # Lit : vent chaud dans l'herbe sèche (Félix Blume) ; un peu d'air au-dessus de 5 kHz pour le sable qui court ;
    # rumeur de ville très lointaine (circulation de nuit, passe-bas à 450 Hz, 17 dB sous le vent).
    vent = af(src(WIND_GRASS, 8.0, 30.0, stereo=True), hp(45), aigus(5000, 2.5))
    ville = af(src(CITY, 0.0, 30.0, stereo=True), hp(40), lp(450))
    ville = a_niveau(ville, vent, -17)
    lit(P, large(vent + ville, 1.6), 3.0, [('amb-blume-herbe', WIND_GRASS), ('amb-janbezouska', CITY)],
        'vent 8-38 s (passe-haut 45 Hz, aigus +2,5 dB) ; ville 0-30 s (passe-bas 450 Hz, -17 dB) ; image élargie (côté x1,6) ; '
        'boucle à fondu de 3 s')

    # Rafales sèches (Félix Blume, plaine d'Anatolie) : la rafale et le vent qui l'entoure, montée et descente lentes.
    for sid, t in (('a_gust-1', 6.2), ('a_gust-2', 14.2)):
        x = af(mono(src(WIND_ANATOLIA, t, 4.0, stereo=True)), hp(110), lp(9000, 1))
        ponctuel(P, sid, enveloppe_rafale(x, 0.9, 1.4), 4.0, [('amb-blume-anatolie', WIND_ANATOLIA)],
                 f'{fr(t)}-{fr(t + 4)} s, passe-haut 110 Hz, montée 0,9 s, descente 1,4 s', seuil=-60)

    # Âne (Félix Blume) : braiement complet, un peu éloigné.
    x = af(mono(src(DONKEY, 3.4, 6.2, stereo=True)), hp(90), lp(6500, 1))
    ponctuel(P, 'a_donkey', queue(x, 1.2, 0.18), 6.0, [('amb-blume-ane', DONKEY)],
             '3,4-9,4 s, passe-haut 90 Hz, passe-bas 6,5 kHz, petite réverbération de plein air', fout=0.6)

    # Coq
    x = af(src(ROOSTER), hp(120))
    ponctuel(P, 'a_rooster', queue(x, 1.0, 0.15, graine=2), 3.0, [('amb-poorenglishjuggler', ROOSTER)],
             'chant entier, passe-haut 120 Hz, petite réverbération de plein air', fout=0.4)

    # Chiens au loin (déjà lointains à la prise)
    for sid, t, d in (('a_dog-1', 8.55, 1.9), ('a_dog-2', 11.35, 2.2)):
        x = af(src(DOG_FAR, t, d), hp(110))
        ponctuel(P, sid, x, 3.0, [('amb-v23', DOG_FAR)], f'{fr(t)}-{fr(t + d)} s (une salve), passe-haut 110 Hz', fout=0.25)

    # Tourterelles : deux phrases de roucoulement (le fichier en contient cinq, recollées)
    for sid, t in (('a_dove-1', 3.22), ('a_dove-2', 9.78)):
        x = af(src(DOVE, t, 3.15), hp(160), lp(5000, 1))
        ponctuel(P, sid, x, 3.2, [('amb-nathankwright', DOVE)], f'{fr(t)}-{fr(t + 3.15)} s, passe-haut 160 Hz', fout=0.25)

    # Bâche / tissu qui claque : drapeau du Haut Atlas (Félix Blume)
    for sid, t, d in (('a_cloth-1', 6.4, 3.6), ('a_cloth-2', 13.4, 4.0)):
        x = af(mono(src(FLAG, t, d, stereo=True)), hp(90))
        ponctuel(P, sid, enveloppe_rafale(x, 0.35, 0.9), d, [('amb-blume-drapeau', FLAG)],
                 f'{fr(t)}-{fr(t + d)} s, passe-haut 90 Hz, montée 0,35 s, descente 0,9 s', seuil=-60)

    # Fontaine de cour (boucle de 4 s) : filet d'eau peu profond (BigSoundBank) sur l'eau plus serrée d'un ruisseau
    # (gluckose, 5 dB plus bas) : le jet qui retombe dans la vasque ; compression douce des gouttes les plus vives.
    filet = af(src(TRICKLE, 31.0, 5.5), hp(150), eq(3500, -2, 0.8))
    nappe = a_niveau(af(src(STREAM, 61.0, 5.5), hp(200), lp(9000, 1)), filet, -5)
    x = limite(af(filet + nappe, 'acompressor=threshold=0.08:ratio=3:attack=1:release=60:knee=4'), 9)
    boucle_mono(P, 'a_fountain', x, 1.5, [('amb-bsb', TRICKLE), ('amb-gluckose', STREAM)],
                'ruisseau s3137 31-36,5 s + ruisseau de montagne 61-66,5 s (-5 dB), passe-haut 150 Hz, compression douce, '
                'gouttes les plus vives limitées (9 dB), boucle à fondu de 1,5 s')


# ---------------------------------------------------------------------------------------------------------------------
# Val-Blanc : gare de montagne sous la neige

def givre():
    P = 'amb_givre'
    # Lit : vent de montagne des Alpes suisses (kyles), assourdi comme par la neige.
    alpes = repare(src(WIND_ALPS, stereo=True), (14.33, 0.03), (14.575, 0.03), (27.04, 0.36))
    vent = af(circ(alpes, 1.0, 30.0), hp(40), lp(5200, 1), aigus(2500, -3))
    lit(P, vent, 3.0, [('amb-kyles', WIND_ALPS)], '1-31 s (trois clics de micro effacés), passe-haut 40 Hz, passe-bas 5,2 kHz, '
        'aigus -3 dB ; boucle à fondu de 3 s')

    # Rafales sifflantes : vent hurlant (stewdio2003) ; la troisième, rafale des Alpes avec un peu de sifflement.
    for sid, t in (('a_gust-1', 13.2), ('a_gust-2', 7.6)):
        x = af(mono(src(WIND_HOWL, t, 5.0, stereo=True)), hp(80))
        ponctuel(P, sid, enveloppe_rafale(x, 1.2, 1.8), 5.0, [('amb-stewdio2003', WIND_HOWL)],
                 f'{fr(t)}-{fr(t + 5)} s, passe-haut 80 Hz, montée 1,2 s, descente 1,8 s', seuil=-60)
    alpes = af(mono(circ(alpes, 49.5, 5.0)), hp(60))
    sifflet = a_niveau(af(mono(src(WIND_HOWL, 16.1, 5.0, stereo=True)), hp(300), lp(2500)), alpes, -9)
    n = min(len(alpes), len(sifflet)); alpes, sifflet = alpes[:n], sifflet[:n]
    ponctuel(P, 'a_gust-3', enveloppe_rafale(alpes + sifflet, 1.2, 1.8), 5.0,
             [('amb-kyles', WIND_ALPS), ('amb-stewdio2003', WIND_HOWL)],
             'rafale des Alpes 49,5-54,5 s + sifflement 16,1-21,1 s (-9 dB) ; montée 1,2 s, descente 1,8 s', seuil=-60)

    # Cloche d'église lointaine : deux coups et la résonance du dernier (BigSoundBank, « Bell 5 O'clock »)
    x = af(src(BELL_CHURCH, 6.42, 6.3), hp(120), lp(3200, 1), aigus(1500, -4))
    ponctuel(P, 'a_bell', queue(x, 2.2, 0.25, 2500, 3), 6.0, [('amb-bsb', BELL_CHURCH)],
             's3445, coups 4 et 5 (6,42-12,7 s), passe-bas 3,2 kHz, réverbération de vallée', fout=1.2)

    # Corneilles : deux croassements chacun
    for sid, t, d in (('a_crow-1', 0.0, 1.35), ('a_crow-2', 1.42, 1.76)):
        x = af(src(CROW, t, d), hp(250))
        ponctuel(P, sid, queue(x, 0.9, 0.12, graine=4), 2.5, [('amb-straget-corneille', CROW)],
                 f'{fr(t)}-{fr(t + d)} s, passe-haut 250 Hz, petite réverbération', fout=0.3)

    # Bois et charpente qui craquent au froid
    x = af(src(TREE_CREAK, 0.0, 3.45), hp(90))
    ponctuel(P, 'a_creak-1', x, 3.5, [('amb-department64', TREE_CREAK)], '0-3,45 s (grincement et deux craquements), passe-haut 90 Hz')
    x = transpose(af(src(WOOD_CREAK, 26.2, 2.5), hp(70), lp(7000, 1)), -2)
    ponctuel(P, 'a_creak-2', queue(x, 0.7, 0.12, graine=5), 3.5, [('amb-laft2k', WOOD_CREAK)],
             '26,2-28,7 s (deux grincements), transposé -2 demi-tons (poutre plus grosse), passe-bas 7 kHz', fout=0.3)

    # Paquet de neige qui glisse d'un toit : glissement fait de grains de neige (pas dans la neige ralentis et serrés),
    # chute sourde (réceptions de saut dans la neige, transposées vers le grave), quelques mottes après.
    rng = np.random.default_rng(7)
    grains = [af(src(g), hp(120), 'rubberband=tempo=0.55') for g in SNOW_GRAIN]
    n = int(2.2 * SR)
    couches = []
    for k in range(18):
        t = 0.055 * k + rng.uniform(0, 0.025)
        g = transpose(grains[k % 4], rng.uniform(-2.0, 1.0))
        couches.append((g, t, 0.35 + 0.65 * (k / 17) ** 1.2))
    land = [transpose(af(src(f), hp(50)), -4) for f in SNOW_LAND]
    couches += [(land[0], 0.98, 1.5), (land[1], 1.02, 1.1)]
    for t, gain in ((1.38, 0.35), (1.62, 0.2)):
        couches.append((transpose(grains[int(t * 10) % 4], -3), t, gain))
    x = af(place(n, *couches), lp(7500, 1), eq(180, 3, 0.8))
    ponctuel(P, 'a_snowfall', x, 2.0, [('amb-nox', SNOW_GRAIN[0]), ('amb-nox', SNOW_LAND[0])],
             'composé : 18 grains de neige (pas NOX ralentis à 0,55, transposés) en crescendo sur 0,95 s, chute (réceptions '
             'NOX transposées de -4 demi-tons), deux mottes ; passe-bas 7,5 kHz', fout=0.35)


# ---------------------------------------------------------------------------------------------------------------------
# Kervénec : port de pêche breton au couchant

def embruns():
    P = 'amb_embruns'
    # Lit : clapot contre les pontons (BigSoundBank, Deauville) à gauche, eau qui lèche un quai (richardemoore) à droite,
    # claquements adoucis ; mer au large (plage de Dellec, Bretagne, passe-bas 900 Hz) et vent marin (Félix Blume,
    # passe-bas 1,4 kHz).
    calme = 'acompressor=threshold=0.04:ratio=4:attack=0.5:release=80:knee=6'
    pont = af(circ(src(PONTOON), 2.0, 30.0), hp(60), lp(7500, 1), calme)
    quai = a_niveau(af(circ(src(PIER), 6.0, 30.0), hp(60), lp(7500, 1), calme), pont, 0)
    clapot = stereo(pont, quai)
    mer = af(src(SEA, 61.0, 30.0, stereo=True), hp(40), lp(900))
    mer = a_niveau(mer, clapot, -5)
    vent = af(src(WIND_GRASS, 2.0, 30.0, stereo=True), hp(60), lp(1400))
    vent = a_niveau(vent, clapot, -11)
    lit(P, limite(clapot + mer + vent, 3), 3.0,
        [('amb-bsb', PONTOON), ('amb-richardemoore', PIER), ('amb-bsb', SEA), ('amb-blume-herbe', WIND_GRASS)],
        'pontons s1444 2-32 s (gauche) et quai 6-36 s (droite), passe-bas 7,5 kHz, claquements compressés ; mer s2565 '
        '61-91 s, passe-bas 900 Hz, -5 dB ; vent 2-32 s, passe-bas 1,4 kHz, -11 dB ; crêtes limitées (3 dB) ; boucle à fondu de 3 s')

    # Ressac contre un quai (boucle de 6 s)
    x = limite(af(circ(src(QUAY), 0.8, 8.0), hp(70)), 6)
    boucle_mono(P, 'a_waves', x, 2.0, [('amb-biofonik', QUAY)], '0,8-8,8 s, passe-haut 70 Hz, claquements limités (6 dB), '
                'boucle à fondu de 2 s')

    # Goélands
    gull = [
        ('a_gull-1', af(mono(src(GULLS, 2.1, 4.85, stereo=True)), hp(300)), 'amb-soojay', GULLS, 'colonie, 2,1-6,95 s'),
        ('a_gull-2', C.fade(af(src(GULL_LONG, 0.0, 4.9), hp(300)), 0, 0.35), 'amb-squashy555', GULL_LONG,
         'cri long (le « rire »), 0-4,9 s, fondu de 0,35 s'),
        ('a_gull-3', af(src(GULL_ROOF, 2.3, 6.0), hp(300)), 'amb-genghisattenborough', GULL_ROOF, 'goéland argenté qui passe, 2,3-8,3 s'),
        ('a_gull-4', af(src(GULL_CLOSE, 6.25, 5.4), hp(300)), 'amb-kyles-goelands', GULL_CLOSE, 'cris rapprochés, 6,25-11,65 s'),
    ]
    for sid, x, cle, f, d in gull:
        ponctuel(P, sid, queue(x, 0.8, 0.1, graine=11), 6.0, [(cle, f)], d + ', passe-haut 300 Hz, petite réverbération', fout=0.4)

    # Drisses qui tintent contre un mât : chocs de métal léger (Kenney) transposés, posés à intervalles irréguliers, sur le
    # sifflement du vent dans les haubans (BigSoundBank s2443, 12 dB plus bas).
    tinks = [af(src(m), hp(400)) for m in METAL]
    sifflet = af(src(MASTS), hp(500), lp(4000))
    for sid, motif, t0, graine in (
            ('a_rigging-1', ((0.00, 0, 0.0, 1.0), (0.55, 2, -1.0, 0.55), (0.72, 1, 0.5, 0.8), (1.90, 3, -0.5, 0.9), (2.65, 0, 1.0, 0.45)), 4.0, 21),
            ('a_rigging-2', ((0.00, 4, -2.0, 0.9), (0.95, 2, -1.5, 0.7), (1.30, 4, -2.5, 0.5), (1.42, 1, -1.0, 0.75), (2.80, 3, -2.0, 0.6)), 21.0, 22)):
        n = int(3.6 * SR)
        couches = [(transpose(tinks[i], dt), t, g) for t, i, dt, g in motif]
        x = place(n, *couches)
        fond = C.fade(circ(sifflet, t0, 3.6), 0.4, 0.8)
        x = queue(x, 0.6, 0.15, 6000, graine)[:n] + a_niveau(fond, x, -12)
        ponctuel(P, sid, x, 3.6, [('amb-kenney', METAL[0]), ('amb-bsb', MASTS)],
                 'composé : 5 chocs de métal léger Kenney (impactMetal_light, transposés de -2,5 à +1 demi-ton) à intervalles '
                 f'irréguliers, sur le sifflement des mâts s2443 ({fr(t0)} s, -12 dB)', seuil=-50, fin_s=0.002)

    # Coques et amarres qui grincent
    x = af(src(HULL, 20.2, 3.4), hp(70))
    ponctuel(P, 'a_creak-1', C.fade(x, 0.3, 0.6), 3.4, [('amb-craigsmith', HULL)],
             'coque en bois qui gémit, 20,2-23,6 s, passe-haut 70 Hz, fondus de 0,3 et 0,6 s', seuil=-60)
    x = af(src(PULLEY, 9.3, 4.0), hp(150))
    ponctuel(P, 'a_creak-2', x, 4.0, [('amb-craigsmith', PULLEY)], 'poulie et cordage, 9,3-13,3 s, passe-haut 150 Hz')

    # Corne de brume lointaine : diaphone du phare d'East Brother Island, passe-bas et écho de la baie
    x = af(src(FOGHORN), hp(60), lp(2200, 1), aigus(1200, -4))
    x = C.fade(x, 0.03, 0.15)
    ponctuel(P, 'a_foghorn', queue(x, 3.2, 0.45, 1800, 31), 6.0, [('amb-dowd', FOGHORN)],
             'fichier entier, passe-bas 2,2 kHz, réverbération de baie (3,2 s)', fout=1.2)

    # Cloche de bouée : coup de cloche de navire (Sojan), transposé vers le grave, frappé à intervalles irréguliers
    # comme par la houle, avec de petites différences de hauteur et de force.
    coup = af(src(SHIP_BELL), hp(150))
    for sid, base, motif, graine in (
            ('a_buoybell-1', -5, ((0.0, 0.0, 1.0), (1.75, 0.15, 0.55), (2.35, -0.1, 0.85), (4.2, 0.05, 0.5)), 41),
            ('a_buoybell-2', -3, ((0.0, 0.1, 0.9), (0.42, -0.05, 0.45), (2.6, 0.0, 1.0), (3.95, 0.12, 0.6)), 42)):
        n = int(6.5 * SR)
        x = place(n, *[(transpose(coup, base + dt), t, g) for t, dt, g in motif])
        x = queue(af(x, lp(6000, 1)), 1.6, 0.2, 3000, graine)
        ponctuel(P, sid, x, 6.0, [('amb-sojan', SHIP_BELL)],
                 f'composé : 4 frappes d\'un coup de cloche de navire transposé de {base} demi-tons (±0,15), réverbération marine',
                 fout=1.0)


# ---------------------------------------------------------------------------------------------------------------------
# Hortus : jardin botanique en fleurs, grande serre, Paris autour

def floreal():
    P = 'amb_floreal'
    # Lit : vent dans les arbres d'un parc (icmusic ; passe-bas 2,2 kHz qui retire aussi ses oiseaux lointains), herbes
    # et arbre dans la brise (Félix Blume ; deux passages pour gauche et droite), bourdonnement d'abeilles et grillons très
    # discrets, rumeur de ville très lointaine.
    arbres = nivelle(af(src(PARK, 0.0, 30.0, stereo=True), hp(70), lp(2200)), 1.0, 0.6)
    h = af(src(SAVANNA), hp(90), aigus(2500, 3))
    herbes = a_niveau(stereo(h[int(12 * SR):int(42 * SR)], h[int(15 * SR):int(45 * SR)]), arbres, 0)
    b = af(src(BEES), hp(120), lp(2500))

    def essaim(graine):
        # morceaux de 1,6 s pris au hasard, transposés de ±1 demi-ton, recollés en fondu : pas de période audible
        rng = np.random.default_rng(graine)
        out = np.zeros(int(31 * SR)); t = -0.5
        while t < 30.5:
            d = rng.uniform(0.0, len(b) / SR - 1.7)
            m = C.fade(transpose(b[int(d * SR):int((d + 1.6) * SR)], rng.uniform(-1, 1)), 0.4, 0.4, 1.0)
            i = int(max(t, 0) * SR); m = m[int(max(-t, 0) * SR):]
            k = min(len(m), len(out) - i)
            out[i:i + k] += m[:k]
            t += 1.1
        return out[int(0.5 * SR):int(30.5 * SR)]
    abeilles = a_niveau(stereo(essaim(51), essaim(52)), arbres, -14)
    g = af(src(CRICKETS), hp(3000, 3), lp(9000, 1))
    grillons = a_niveau(stereo(circ(g, 0.0, 30.0), circ(g, 11.0, 30.0)), arbres, -24)
    ville = af(src(CITY, 0.0, 30.0, stereo=True), hp(40), lp(380))
    ville = a_niveau(ville, arbres, -15)
    lit(P, arbres + herbes + abeilles + grillons + ville, 3.0,
        [('amb-icmusic', PARK), ('amb-blume-savane', SAVANNA), ('amb-tom-woysky', BEES), ('amb-hdfreema', CRICKETS),
         ('amb-janbezouska', CITY)],
        'arbres du parc 0-30 s, passe-bas 2,2 kHz, houle de niveau adoucie ; herbes et arbre 12-42 s (gauche) et 15-45 s '
        '(droite), aigus +3 dB, même niveau ; abeilles recollées par morceaux de 1,6 s (-14 dB) ; grillons au-dessus de 3 kHz '
        '(-24 dB) ; ville 0-30 s, passe-bas 380 Hz (-15 dB) ; boucle à fondu de 3 s')

    # Oiseaux : merle, mésange charbonnière, pic (le rouge-gorge manque en licence libre), pinson, pigeon ramier, fauvette
    oiseaux = [
        ('a_bird-1', af(src(BLACKBIRD), hp(1000)), 'amb-bsb', BLACKBIRD, 'merle noir s3476, phrase entière, passe-haut 1 kHz'),
        ('a_bird-2', af(src(TIT), hp(1500)), 'amb-mysid', TIT, 'mésange charbonnière (Parus_major.ogg, extrait de 1,9 s), passe-haut 1,5 kHz'),
        ('a_bird-3', af(src(WOODPECKER), hp(300)), 'amb-benboncan', WOODPECKER, 'pic qui tambourine, fichier entier, passe-haut 300 Hz'),
        ('a_bird-4', af(src(CHAFFINCH, 1.05, 3.4), hp(1500)), 'amb-mysid', CHAFFINCH, 'pinson des arbres, 1,05-4,45 s, passe-haut 1,5 kHz'),
        ('a_bird-5', porte(af(src(WOODPIGEON, 0.8, 4.0), hp(200), lp(800), 'afftdn=nr=15:nf=-38')[int(0.5 * SR):int(3.25 * SR)],
                           -26, -16), 'amb-mysid',
         WOODPIGEON, 'pigeon ramier, une phrase 1,3-4,05 s, passe-bande 200-800 Hz (pie et souffle du fond retirés), débruitage, '
         'porte douce entre les notes'),
        ('a_bird-6', af(src(BLACKCAP), hp(1200)), 'amb-bsb', BLACKCAP, 'fauvette à tête noire s3466, chant entier, passe-haut 1,2 kHz'),
    ]
    for sid, x, cle, f, d in oiseaux:
        ponctuel(P, sid, queue(x, 0.7, 0.08, 6000, 61), 6.0, [(cle, f)], d + ', petite réverbération', fout=0.3)

    # Cascade (boucle de 5 s) et fontaine / ruisseau (boucle de 4 s)
    x = af(src(WATERFALL, 12.0, 7.0), hp(60))
    boucle_mono(P, 'a_waterfall', x, 2.0, [('amb-straget-cascade', WATERFALL)], '12-19 s, passe-haut 60 Hz, boucle à fondu de 2 s')
    x = limite(af(src(STREAM, 20.0, 5.5), hp(120)), 6)
    boucle_mono(P, 'a_fountain', x, 1.5, [('amb-gluckose', STREAM)], '20-25,5 s, passe-haut 120 Hz, gouttes les plus vives '
                'limitées (6 dB), boucle à fondu de 1,5 s')


# ---------------------------------------------------------------------------------------------------------------------
# Meltem : port des Cyclades en plein été

def meltem():
    P = 'amb_meltem'
    # Lit : mer calme qui lave une grève (au loin : passe-bas 4 kHz), chœur de cigales enregistré à Paros (au loin, 15 dB sous la mer) et
    # vent de mer qui chante dans un auvent (deux passages pour la gauche et la droite, sifflement adouci, 9 dB sous la mer)
    mer = limite(af(src(SEA_WASH, 100.0, 30.0, stereo=True), hp(60), lp(4000)), 14)  # galets roulés par une vague vers 117,5 s : crêtes tassées
    cig = a_niveau(af(src(CICADAS_PAROS, 60.0, 30.0, stereo=True), hp(2500), lp(9000, 1)), mer, -15)
    vent = stereo(af(src(WIND_SHADE, 30.0, 30.0), hp(120), eq(1800, -6, 1.5)), af(src(WIND_SHADE, 80.0, 30.0), hp(120), eq(1800, -6, 1.5)))
    vent = a_niveau(vent, mer, -9)
    lit(P, large(mer + cig + vent, 1.4), 3.0, [('fs-185225', SEA_WASH), ('fs-690510', CICADAS_PAROS), ('fs-690512', WIND_SHADE)],
        'mer 100-130 s (passe-haut 60 Hz, passe-bas 4 kHz, crêtes limitées de 14 dB au plus) ; cigales 60-90 s (2,5-9 kHz, -15 dB) ; vent dans un auvent 30-60 s et 80-110 s '
        '(gauche, droite ; -6 dB à 1,8 kHz, -9 dB) ; image élargie (côté x1,4) ; boucle à fondu de 3 s')

    # Clapot contre le quai : vagues qui lèchent des rochers (boucle de 12 s)
    x = af(mono(src(LAP_ROCKS, 26.0, 14.0, stereo=True)), hp(80), lp(7000, 1))
    boucle_mono(P, 'a_waves', x, 2.0, [('fs-457956', LAP_ROCKS)], '26-40 s, passe-haut 80 Hz, boucle à fondu de 2 s')

    # Cigales des collines (boucle de 10 s, posée sur quatre arbres)
    x = af(mono(src(CICADAS_PAROS, 70.0, 12.0, stereo=True)), hp(1800))
    boucle_mono(P, 'a_cicadas', x, 2.0, [('fs-690510', CICADAS_PAROS)], '70-82 s, passe-haut 1,8 kHz, boucle à fondu de 2 s')

    # Moulin : un cycle complet de grincements (Félix Blume, moulin seul dans le désert)
    x = af(mono(src(WINDMILL, 62.0, 17.5, stereo=True)), hp(250))
    boucle_mono(P, 'a_mill', x, 1.5, [('fs-131924', WINDMILL)], '62-79,5 s, passe-haut 250 Hz, boucle à fondu de 1,5 s')

    # Mouettes : quatre cris, pris sur une prise propre (sans fond)
    for k, t in enumerate((27.8, 40.85, 45.5, 51.55)):
        x = af(mono(src(GULLS_CLEAN, t, 2.6, stereo=True)), hp(400))
        ponctuel(P, f'a_gull-{k + 1}', queue(x, 1.2, 0.15, graine=10 + k), 3.0, [('fs-462462', GULLS_CLEAN)],
                 f'{fr(t)}-{fr(t + 2.6)} s, passe-haut 400 Hz, petite réverbération de plein air', fout=0.3)

    # Cloche de la chapelle : deux coups
    x = af(mono(src(BELL_SMALL, 5.7, 6.0, stereo=True)), hp(200))
    ponctuel(P, 'a_bell', x, 6.0, [('fs-153580', BELL_SMALL)], '5,7-11,7 s, passe-haut 200 Hz', fout=1.2)

    # Clochettes d'un troupeau de chèvres (Félix Blume, Naples)
    for k, t in enumerate((56.4, 66.8)):
        x = af(mono(src(GOATS, t, 5.0, stereo=True)), hp(600))
        ponctuel(P, f'a_goats-{k + 1}', enveloppe_rafale(x, 0.6, 1.4), 5.0, [('fs-131925', GOATS)],
                 f'{fr(t)}-{fr(t + 5)} s, passe-haut 600 Hz, montée 0,6 s, descente 1,4 s', seuil=-60)

    # Rafales de meltem : le vent qui monte dans l'auvent
    for k, t in enumerate((87.4, 111.4)):
        x = af(src(WIND_SHADE, t, 4.0), hp(120), eq(1800, -4, 1.5))
        ponctuel(P, f'a_gust-{k + 1}', enveloppe_rafale(x, 0.9, 1.4), 4.0, [('fs-690512', WIND_SHADE)],
                 f'{fr(t)}-{fr(t + 4)} s, passe-haut 120 Hz, -4 dB à 1,8 kHz, montée 0,9 s, descente 1,4 s', seuil=-60)


# ---------------------------------------------------------------------------------------------------------------------
# Tephra : station de recherche au pied d'un volcan en éruption

def tephra():
    P = 'amb_tephra'
    # Lit : grondement du Yasur (Vanuatu) entre deux éruptions, très grave (passe-bas 500 Hz), sous un vent de sommet chargé (Kitt Peak, 6 dB
    # sous le grondement)
    gr = af(src(YASUR, 0.0, 30.0, stereo=True), hp(25), lp(500))
    vent = a_niveau(af(src(WIND_KITT, 20.0, 30.0, stereo=True), hp(120), lp(5000, 1)), gr, -6)
    lit(P, nivelle(gr, 2.0, 0.5) + vent, 3.0, [('fs-176589', YASUR), ('fs-135193', WIND_KITT)],
        'volcan 0-30 s (25-500 Hz, houles adoucies) ; vent 20-50 s (passe-haut 120 Hz, -6 dB) ; boucle à fondu de 3 s')

    # Explosions du cratère : l'éruption du Yasur, de loin (passe-bas, longue réverbération de plein air)
    for k, (t, d) in enumerate(((30.6, 10.0), (48.0, 8.0))):
        x = af(mono(src(YASUR, t, d, stereo=True)), hp(25), lp(1200))
        ponctuel(P, f'a_boom-{k + 1}', queue(x, 3.0, 0.3, 900, graine=20 + k), 12.0, [('fs-176589', YASUR)],
                 f'{fr(t)}-{fr(t + d)} s, 25-1200 Hz, réverbération de 3 s', seuil=-50, fin_seuil=-60, fout=2.0)

    # Tonnerre des éclairs de la colonne éruptive (au loin)
    for k, t in enumerate((8.3, 74.1)):
        x = af(mono(src(THUNDER, t, 6.0, stereo=True)), hp(30), lp(2500))
        ponctuel(P, f'a_thunder-{k + 1}', x, 6.0, [('fs-127140', THUNDER)], f'{fr(t)}-{fr(t + 6)} s, 30-2500 Hz', seuil=-50, fout=1.5)

    # Silencieux de vapeur : le souffle d'une fumerolle (Furnas, Açores), boucle de 12 s
    x = af(mono(src(FURNAS, 6.0, 14.0, stereo=True)), hp(120))
    boucle_mono(P, 'a_steam', x, 2.0, [('fs-829623', FURNAS)], '6-20 s, passe-haut 120 Hz, boucle à fondu de 2 s')

    # Fumerolles basses : bouillonnement de boue (Salton Sea), boucle de 8 s
    x = af(mono(src(MUD_POTS, 52.5, 10.0, stereo=True)), hp(100))
    boucle_mono(P, 'a_bubble', x, 2.0, [('fs-415608', MUD_POTS)], '52,5-62,5 s, passe-haut 100 Hz, boucle à fondu de 2 s')

    # Salle des turbines : bourdonnement d'un transformateur (Waterloo, Londres), boucle de 10 s
    x = af(mono(src(TRANSFORMER, 60.0, 12.0, stereo=True)), hp(40), lp(2500))
    boucle_mono(P, 'a_hum', x, 2.0, [('fs-144559', TRANSFORMER)], '60-72 s, 40-2500 Hz, boucle à fondu de 2 s')

    # Rafales chargées de cendre (vent du désert)
    for k, t in enumerate((6.8, 15.6)):
        x = af(src(DESERT_WIND, t, 4.0), hp(110), lp(8000, 1))
        ponctuel(P, f'a_gust-{k + 1}', enveloppe_rafale(x, 0.9, 1.4), 4.0, [('fs-112296', DESERT_WIND)],
                 f'{fr(t)}-{fr(t + 4)} s, passe-haut 110 Hz, montée 0,9 s, descente 1,4 s', seuil=-60)


# ---------------------------------------------------------------------------------------------------------------------
# Stratus : îles flottantes au-dessus d'une mer de nuages

def stratus():
    P = 'amb_stratus'
    # Lit : le vent qui chante sur une montagne (Félix Blume ; grillons du fond retirés par le passe-bas) et celui qui siffle dans les épines
    # d'un cactus au sommet d'un mont de l'Atacama (Félix Blume, 6 dB dessous)
    vent = af(src(WIND_SINGING, 100.0, 30.0, stereo=True), hp(70), lp(3800))
    sif = a_niveau(af(src(WIND_ATACAMA, 30.0, 30.0, stereo=True), hp(150), lp(6000, 1)), vent, -6)
    lit(P, large(nivelle(vent + sif, 2.0, 0.4), 1.3), 3.0, [('fs-165526', WIND_SINGING), ('fs-156414', WIND_ATACAMA)],
        'vent 100-130 s (70-3800 Hz) ; vent dans les épines 30-60 s (150-6000 Hz, -6 dB) ; houles adoucies ; image élargie (côté x1,3) ; '
        'boucle à fondu de 3 s')

    # Rafales sur une crête
    for k, t in enumerate((8.8, 44.1)):
        x = af(mono(src(GUSTS_RIDGE, t, 4.0, stereo=True)), hp(110), lp(8000, 1))
        ponctuel(P, f'a_gust-{k + 1}', enveloppe_rafale(x, 0.9, 1.4), 4.0, [('fs-817188', GUSTS_RIDGE)],
                 f'{fr(t)}-{fr(t + 4)} s, passe-haut 110 Hz, montée 0,9 s, descente 1,4 s', seuil=-60)

    # Cordes de chanvre qui grincent sous la charge : les ponts suspendus
    for k, t in enumerate((112.1, 117.3, 127.8)):
        x = af(mono(src(ROPE_CREAK, t, 3.0, stereo=True)), hp(150))
        ponctuel(P, f'a_creak-{k + 1}', x, 3.0, [('fs-231438', ROPE_CREAK)], f'{fr(t)}-{fr(t + 3)} s, passe-haut 150 Hz', fout=0.4)

    # Buses qui crient au loin, dans le vide
    for k, (cle, f, t) in enumerate((('fs-648430', BUZZARDS, 102.3), ('fs-648430', BUZZARDS, 2.3), ('fs-194678', BUZZARD, 1.2))):
        x = af(mono(src(f, t, 3.0, stereo=True)), hp(700), lp(6000, 1))
        ponctuel(P, f'a_bird-{k + 1}', queue(x, 2.0, 0.25, graine=30 + k), 4.0, [(cle, f)],
                 f'{fr(t)}-{fr(t + 3)} s, 700-6000 Hz, réverbération de plein air de 2 s', fout=0.5)

    # Toile qui claque au vent (Félix Blume, drapeau du désert Mojave)
    for k, t in enumerate((6.0, 69.1)):
        x = af(mono(src(FLAG_MOJAVE, t, 3.5, stereo=True)), hp(100))
        ponctuel(P, f'a_flap-{k + 1}', enveloppe_rafale(x, 0.35, 0.9), 3.5, [('fs-187364', FLAG_MOJAVE)],
                 f'{fr(t)}-{fr(t + 3.5)} s, passe-haut 100 Hz, montée 0,35 s, descente 0,9 s', seuil=-60)


PAQUETS = {'sable': sable, 'givre': givre, 'embruns': embruns, 'floreal': floreal, 'meltem': meltem, 'tephra': tephra, 'stratus': stratus}


def build(seulement=None):
    """Fabrique les paquets d'ambiance (seulement : liste de cartes, par exemple AMB=meltem,tephra ; les crédits des autres paquets sont
    gardés tels quels dans credits-ambiances.json)."""
    import json, os
    seulement = seulement or [c for c in os.environ.get('AMB', '').split(',') if c]
    CREDITS.clear()
    if seulement:
        f = C.MASTERS / 'credits-ambiances.json'
        gardes = [e for e in json.loads(f.read_text(encoding='utf-8')) if e['pack'] not in {'amb_' + c for c in seulement}] if f.exists() else []
        CREDITS.extend(gardes)
    for c, fn in PAQUETS.items():
        if not seulement or c in seulement: fn()
    C.write_credits('ambiances', CREDITS)
