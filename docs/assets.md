# Liste des assets

Produite à partir du code par `python3 tools/dev/assets.py`, que `build.py` lance à chaque construction : ne pas la modifier à la main. Tout le jeu est construit par le code (README, « Direction artistique : tout en code ») ; seules les textures photo, les ciels et les HDRI viennent de fichiers, tous en CC0. La description d'un asset est le commentaire écrit au-dessus de sa définition : pour la changer, changer le commentaire.

221 prefabs, 39 props physiques, 47 surfaces photo, 62 surfaces procédurales, 14 atlas dessinés au chargement, 8 ciels photographiés, 3 HDRI, 18 armes, 18 accessoires.

## Cartes

| Carte | Plan | Surfaces photo | Ciel |
| --- | --- | --- | --- |
| Khamsin | `src/02s-sable.js` | plaster, plaster2, stone, brick, cobble, pavers, asphalt, rooftiles, wood, shutter, ashlar, concrete, crate, canvas, linge, cardboard, rollshutter, steel, paintwood, burlap, timber, palmbark | qwantani_dusk_2 |
| Val-Blanc | `src/02t-givre.js` | plaster, stone, cobble, pavers, asphalt, wood, shutter, snow, snowpack, rock, boards, slate, barkw, ashlar, concrete, canvas, rust, steel, paintwood, burlap, timber | kloppenheim_02 |
| Kervénec | `src/02u-embruns.js` | plaster, plaster2, stone, brick, cobble, pavers, asphalt, rooftiles, wood, shutter, concrete, rock, boards, slate, crate, canvas, linge, rust, rollshutter, steel, paintwood, timber | kloofendal_misty_morning |
| Hortus | `src/02v-floreal.js` | plaster, stone, wood, lawn, humus, flagstone, pathgravel, bark, ashlar, slate, concrete, steel, timber, shutter | sunflowers |
| Meltem | `src/02yf-meltem.js` | plaster, stone, cobble, pavers, wood, shutter, drystone, sand, canvas, linge, steel, paintwood, burlap, timber | kloofendal_48d |
| Tephra | `src/02yh-tephra.js` | asphalt, pavers, ash, steel, wood, timber | wasteland_feu |
| Stratus | `src/02yj-stratus.js` | wood, stone, strata, lawn, dirt, flagstone, humus, canvas, burlap, timber, bark | qwantani_dawn |
| Simoun | `src/02yl-simoun.js` | stone, wood, sand, dirt, pise, adobe, galets, vase, strata, reg, canvas, laine, steel, burlap, timber, palmbark | quarry_01 |
| French Dream | `src/02yn-french-dream.js` | plaster, slate, rooftiles, asphalt, concrete, pavers, lawn, pathgravel, wood, paintwood, rollshutter, steel, timber, bark, dirt, sand, canvas, cardboard | kloofendal_48d |

## Prefabs du décor

Construits une fois en coordonnées locales (posés sur y = 0, face principale vers +z), estampillés par `DECOR.place` (`src/02a-kit.js`). « Posé dans » : les fichiers qui l'appellent directement.

### `src/02f-props.js`

**Caisses, palettes, fûts**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `crate` | s = 1.1 | Caisse en planches : panneaux, tasseaux sur les arêtes, écharpes en diagonale | 02k-dynprops, 02yi-stratus-kit, 02yj-stratus (Stratus) |
| `pallet` |  | Palette en bois (1,2 x 0,8) | 02l-port, 02s-sable (Khamsin), 02t-givre (Val-Blanc), 02u-embruns (Kervénec) |
| `barrel` |  | Fût métallique de 200 L : cerclages de roulement, bondes | 02k-dynprops |
| `jerrycan` |  | Jerrican (20 L, modèle militaire d'après photos) : caisse à bords arrondis, X emboutis sur les flancs, cordon de soudure tout autour, trois poignées en travers du dessus, bec et bouchon à levier sur... | 02k-dynprops |
| `gasBottle` |  | Bouteille de gaz butane (bleue ou orange) | 02k-dynprops |
| `cardboard` | w = 0.5, h = 0.4, d = 0.4 | Carton de déménagement | 02k-dynprops |
| `trashBag` |  | Sac-poubelle | 02k-dynprops |
| `blocks` |  | Parpaings empilés | 02s-sable (Khamsin), 02yn-french-dream (French Dream) |
| `reel` |  | Touret de câble : deux flasques de planches serrées par des tiges filetées, moyeu percé, câble enroulé en spires, bout libre | 02s-sable (Khamsin), 02yh-tephra (Tephra) |

**Défenses : sacs de sable, murets jersey**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `sandbag` |  | Sac de sable bas du décor (58 x 15 x 33 cm) | 02k-dynprops |
| `sandbagFat` |  | Sac de sable des murs (physique) : plus épais que celui du décor (22 x 60 x 40 cm), pour que les rangs se touchent ; sa collision est la boîte qu'il occupe et suit le sac quand il tombe | 02k-dynprops |
| `sandbagHalf` |  | Demi-sac (30 x 22 x 40 cm) : sac à moitié rempli, replié, qui ferme le bout d'un rang décalé | 02k-dynprops |
| `jersey` | len | Muret jersey en béton (profil en F), longueur len le long de z | 02s-sable (Khamsin) |

**Conteneurs maritimes**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `container` | open = false | Conteneur 20 pieds (6,06 x 2,44 x 2,6), longueur le long de z, portes en +z. | 02s-sable (Khamsin), 02yl-simoun (Simoun) |

**Mobilier urbain**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `lampPost` | lit = litOn() | Lampadaire : socle, fût conique, crosse, lanterne ; allumé (lit, par défaut selon l'ambiance) : verre lumineux et lumière cuite sous la lanterne, rabattue vers le sol | 02s-sable (Khamsin), 02t-givre (Val-Blanc) |
| `manhole` |  | Bouche d'égout (plaque en fonte) et grille d'avaloir, affleurantes | 02s-sable (Khamsin), 02yn-french-dream (French Dream) |
| `drain` |  |  | 02s-sable (Khamsin), 02yn-french-dream (French Dream) |
| `pebbles` | seed = 1 | Gravillons et petits débris épars (menus détails) | 02s-sable (Khamsin) |
| `bollard` |  | Borne anti-stationnement | 02u-embruns (Kervénec) |
| `dumpster` |  | Benne à ordures à chargement frontal (d'après photos) : cuve à face avant inclinée et dos droit, rebord, nervures verticales, fourreaux de levage sur les bouts, deux couvercles de plastique noir... | 02s-sable (Khamsin), 02u-embruns (Kervénec) |
| `tire` |  | Pile de pneus | 02k-dynprops |
| `pole` |  | Poteau électrique en bois avec traverse et isolateurs | 02t-givre (Val-Blanc) |

**Façades et toits**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `acUnit` |  | Climatiseur (unité extérieure) avec ventilateur, grille et équerres ; dos contre le mur (z = 0) | 02d-archi |
| `waterTank` |  | Réservoir d'eau en polyéthylène sur son support (typique des toits du Maghreb) | 02d-archi, 02yc-cyclades-bati, 02yl-simoun (Simoun) |
| `dish` |  | Antenne parabolique sur pied | 02d-archi |
| `solarHeater` |  | Chauffe-eau solaire : capteur incliné, ballon horizontal, piétement | 02d-archi, 02yc-cyclades-bati |
| `antenna` |  | Antenne râteau | 02d-archi, 02yc-cyclades-bati, 02yl-simoun (Simoun) |
| `roofHut` |  | Édicule d'accès au toit : cage d'escalier avec porte | 02d-archi |
| `pot` |  | Pot de fleurs en terre cuite (garni d'une touffe) | 02k-dynprops |

**Entrepôt**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `rack` | L | Rayonnage à palettes : échelles bleues, lisses orange, charges | 02s-sable (Khamsin) |
| `generator` |  | Groupe électrogène insonorisé (d'après photos de groupes de chantier) : châssis en U sur patins, capot à toit arrondi, grille de radiateur à persiennes en +x, sortie d'air chaud en -x, portes de... | 02s-sable (Khamsin), 02t-givre (Val-Blanc), 02yh-tephra (Tephra), 02yl-simoun (Simoun) |

**Café, marché**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `chair` |  | Chaise de terrasse en plastique moulé d'une pièce (d'après photos) : assise à bord roulé, dossier galbé et incliné, accoudoirs qui se prolongent en pieds avant, pieds arrière écartés ; teinte de... | 02k-dynprops |
| `cafeTable` |  |  | 02k-dynprops |
| `jar` | s = 1 | Jarre en terre cuite (d'après photos de jarres à eau) : pied tourné, panse ronde, épaule, col étroit et lèvre roulée ; l'intérieur du col descend dans l'ombre | 02k-dynprops |
| `spiceSack` |  | Sac d'épices ouvert, rebord roulé et monticule coloré | 02k-dynprops |

**Pièces uniques des cartes (réutilisables)**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `table` |  | Table en bois (2 x 1 m, d'après photos de tables de ferme) : plateau de quatre planches à joints, ceinture sous le plateau, pieds fuselés, entretoise ; ses chaises sont des props physiques posées... | 02k-dynprops |
| `rugFloor` |  | Tapis posé au sol (2,4 x 1,6 m) | 02s-sable (Khamsin), 02t-givre (Val-Blanc) |
| `fountain` |  | Fontaine octogonale : bassin, margelle moulurée, eau, colonne et vasque | 02s-sable (Khamsin) |
| `forklift` |  | Chariot élévateur jaune (frontal à contrepoids, classe 1,5 t, d'après des photos de chariots thermiques) : caisse au profil découpé sur les roues, contrepoids arrondi, capot et siège, colonne de... | 02s-sable (Khamsin), 02u-embruns (Kervénec) |
| `tent` |  | Tente militaire (7 x 4,4 m) : parois de toile, toit à deux pans, mâts, haubans, porte roulée. | 02s-sable (Khamsin), 02t-givre (Val-Blanc), 02yl-simoun (Simoun) |
| `gateLeaf` |  | Vantail de portail : planches cloutées, pentures en fer (ouvert, plaqué contre le mur ; épaisseur en x) | 02s-sable (Khamsin) |
| `iBeam` | h | Poutre en I (poteau), hauteur h | 02s-sable (Khamsin) |
| `truss` | L | Ferme de toiture en treillis (le long de z, longueur L), en acier | 02s-sable (Khamsin) |
| `column` | h | Colonne du souk : base moulurée, fût, chapiteau, sur hauteur h (teintable) | 02s-sable (Khamsin) |
| `counter` |  | Comptoir de marchand (1,6 x 2,4 m) : caisson en planches verticales dans un cadre (montants d'angle, traverse haute), socle en retrait, plateau débordant, marchandises | 02s-sable (Khamsin) |
| `lantern` |  | Lanterne marocaine en laiton suspendue par une chaîne (d'après photos) : maillons, dôme en bulbe et sa flèche, corps à six pans vitrés entre des montants, coupelle et goutte en bas ; flamme cuite... | 02s-sable (Khamsin), 02t-givre (Val-Blanc) |
| `hangLamp` | cool, len = 0.8 | Suspension sous un plafond (posée au plafond, pend de len m) : câble, abat-jour émaillé, ampoule ; sa lumière est cuite dans le volume d'éclairage. | 02s-sable (Khamsin) |
| `stall` | color | Étal de marché (2,4 x 1,2 m) : table, montants, toile tendue (simulée : Maker.toile, tenue aux bords avant et arrière et sur les montants, son lambrequin bat au vent), marchandises. | 02s-sable (Khamsin) |

### `src/02g-vehicles.js`

**Voitures**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `car` | model = 'sedan', o = {} | Voiture : model 'sedan' (berline), 'hatch' (citadine), 'suv', 'mpv', 'cross' (familiales hautes), 'offroad' (4x4) ; o : { dust, wreck, rack } (voir carBuild, offroadBuild). | 02g-vehicles, 02s-sable (Khamsin), 02yl-simoun (Simoun) |
| `bicycle` |  |  | 02k-dynprops |
| `moped` |  | Mobylette (cyclomoteur) sur sa béquille | 02s-sable (Khamsin), 02u-embruns (Kervénec) |

**Camions**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `truck` | model = 'army', o = {} | Camion : model 'army' (militaire à cabine avancée, façon GBC), 'cargo' (porteur à cabine avancée), 'box' (fourgon de livraison) ; o : { load, reefer, dust, wreck }. Ancienne écriture : PF.truck()... | 02g-vehicles, 02s-sable (Khamsin), 02u-embruns (Kervénec), 02yl-simoun (Simoun), 02yn-french-dream (French Dream) |
| `busWreck` |  | Bus incendié (11 m) : carcasse percée de baies vides, intérieur calciné, sur les jantes |  |

### `src/02h-nature.js`

**Palmiers dattiers**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `palm` | h = 7, seed = 1, o = {} | Palmier dattier : tronc losangé à pied évasé, couronne dense de palmes arquées en V, palmes sèches pendantes, régimes de dattes ; variantes par o.v (PALM_KINDS) ; o.lite : version allégée pour une... | 02s-sable (Khamsin), 02yl-simoun (Simoun) |
| `bush` | s = 1 | Buisson (cartes croisées) | 02s-sable (Khamsin) |
| `grass` | s = 1 | Touffe d'herbes sèches | 02s-sable (Khamsin) |
| `bougainvillea` | w = 2.2, h = 2.6 | Bougainvillier grimpant sur une façade (repère de façade : plan du mur en z = 0) | 02s-sable (Khamsin) |
| `rubble` | seed = 1, r = 1.2 | Gravats : blocs de béton et de brique chanfreinés, poussière | 02s-sable (Khamsin) |
| `gravel` | seed = 1 | Gravillons : quelques galets serrés | 02h-nature |
| `stone` | seed = 1 | Pierre isolée, lisse ou éclatée | 02h-nature |
| `chunk` | seed = 1 | Morceau de béton ou de parpaing : très anguleux, parfois un bout de fer à béton qui dépasse | 02h-nature |
| `brick` | seed = 1, half = false | Brique pleine (22 x 10,5 x 6,5 cm) ou demi-brique, arêtes chanfreinées | 02h-nature |
| `brickPile` | seed = 1 | Petit tas de briques tombées d'un mur : quelques-unes à plat, une ou deux de chant ou en appui | 02h-nature |
| `shard` | seed = 1 | Tesson de tuile canal : portion d'anneau extrudée, posée bombée ou en gouttière | 02h-nature |
| `litter` | seed = 1 | Déchets : canette écrasée, bouteille en plastique, papier froissé | 02h-nature |
| `weed` | seed = 1 | Petite touffe d'herbe sèche poussée entre deux pierres | 02h-nature |

### `src/02i-hiver.js`

**Végétation**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `spruce` | h = 9, seed = 1, base = 0 | base : hauteur de la première couronne de branches (un sapin de place, taillé, laisse passer dessous) ; sinon 0,9 à 1,5 m | 02i-hiver, 02t-givre (Val-Blanc) |
| `snowBush` | s = 1 | Buisson enneigé (cartes croisées) |  |

**Neige modelée**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `snowMound` | w = 2, d = 1.4, h = 0.7, seed = 1, mat = 'snowmat' | Tas de neige arrondi et bosselé (ellipse w x d, hauteur h), posé sur y = 0. | 02i-hiver, 02j-rail, 02t-givre (Val-Blanc) |

**Accessoires**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `woodpile` | L = 2.4, H = 1.2, D = 0.5 | Bûcher : rondins fendus empilés (bois de bout en façade), petit toit de planches ; longueur L, hauteur H, profondeur D | 02i-hiver, 02t-givre (Val-Blanc) |
| `fence` | L = 4 | Barrière de bois (poteaux et deux lisses), longueur L le long de x ; sans collision (posée hors des passages) |  |
| `sled` |  | Luge de bois | 02k-dynprops |
| `snowman` |  | Bonhomme de neige : trois boules, yeux de charbon, nez en carotte, bras en branches, écharpe et bonnet | 02k-dynprops |
| `skiOne` |  | Un ski (175 x 8 cm) debout, spatule en +y : teinte de l'estampille. | 02k-dynprops |
| `skiPole` |  | Un bâton de ski (1,25 m), debout | 02k-dynprops |
| `skiRack` |  | Râtelier à skis (repère : le dos du râtelier vers -z, les skis posés devant, appuyés contre la planche du fond) : socle, deux montants, planche du fond. | 02k-dynprops |

**Roche, falaise, montagnes**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `boulder` | seed = 1, rx = 3, ry = 2.5, rz = 2.5 | Bloc de roche facetté (demi-axes rx, ry, rz) : sphère bosselée tranchée par des plans tirés au hasard ; posé sur y = 0 | 02i-hiver, 02t-givre (Val-Blanc), 02u-embruns (Kervénec) |

**Neige posée, lumières, bois**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `xmasTree` | h = 6, base = 0 | Sapin de Noël décoré : épicéa, guirlande en spirale, boules et étoile | 02t-givre (Val-Blanc) |
| `plankStack` | L = 4, W = 1.2, H = 1.2 | Pile de planches sciées, lits séparés par des liteaux, longueur L le long de z |  |
| `hayBale` |  | Botte de foin rectangulaire (petite botte, d'après photos) : tranches pressées qui se décalent un peu, deux ficelles qui en font le tour, brins qui dépassent des bouts. | 02k-dynprops, 02yf-meltem (Meltem) |

### `src/02j-rail.js`

**Matériel roulant**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `boxcar` |  | Wagon couvert (12,2 m entre têtes) : caisse en planches teintées et ossature en acier, toit cintré, portes coulissantes (côté +x fermée, côté -x entrouverte sur un intérieur sombre), échelle, volant... | 02t-givre (Val-Blanc) |
| `tankcar` |  | Wagon-citerne (10,2 m entre têtes) : citerne à fonds bombés sur berceaux, ceintures, dôme, passerelle et échelles, plaque orange de matière dangereuse ; teinte de la citerne | 02t-givre (Val-Blanc) |
| `flatcar` |  | Wagon plat à ranchers chargé de grumes (12 m entre têtes) | 02t-givre (Val-Blanc) |
| `snowplow` |  | Chasse-neige rotatif (13 m) : caisse rouge à toit arrondi, cabines aux deux bouts, turbine frontale (tambour, pales, moyeu), goulotte d'éjection orientable, bandes jaunes et noires, neige tassée dans... | 02t-givre (Val-Blanc) |

**Équipements de gare**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `platformBench` |  | Banc de quai : pieds en fonte, lattes de bois, dossier | 02t-givre (Val-Blanc), 02u-embruns (Kervénec) |
| `stationClock` |  | Horloge de quai à deux cadrans, sur potence (accrochée à un mur ou une colonne, repère de façade : mur en z = 0) | 02t-givre (Val-Blanc) |
| `luggageCart` |  | Chariot à bagages : plateau sur quatre roues, timon, malles, valises et sacs postaux | 02t-givre (Val-Blanc) |
| `railSignal` |  | Signal ferroviaire : mât, cible ronde, feux (le rouge allumé), échelle | 02t-givre (Val-Blanc) |
| `relayCabinet` |  | Armoire de signalisation (relais) sur pieds, avec petit toit |  |
| `sleeperStack` | nw = 6, nh = 10 | Pile de traverses neuves : nw traverses par lit, nh lits, cales entre les lits | 02t-givre (Val-Blanc) |
| `castColumn` | h = 3.6 | Colonne de marquise en fonte : base, fût cannelé, chapiteau, consoles ajourées vers +z et -z | 02t-givre (Val-Blanc) |

### `src/02k-dynprops.js`

**Prefabs des props**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `fruitBall` |  | Fruit : sphère de 6 cm de rayon (la teinte donne l'orange, la pomme, le citron) | 02k-dynprops |
| `fruitBox` |  | Lattes et plancher d'un cageot de fruits (60 x 40 x 19 cm) : un corps physique, qui emporte ses fruits quand il part | 02k-dynprops |
| `fruitCrate` |  | Cageot de fruits : le cageot lui-même (corps `fruitBox`), les parois qui retiennent les fruits (collision réservée aux props, étiquette 'crate') et 15 fruits dynamiques à la teinte de l'estampille. | 02f-props |
| `potShard` |  | Tesson de terre cuite : éclat d'un pot ou d'une jarre qui se brise (propKid, 04b-physprops.js). | 02k-dynprops |
| `bottle` | h = 0.26 | Bouteille de verre (corps et goulot), teinte de l'estampille | 02k-dynprops |

**Mise en place : chaises face à leur table, râtelier à skis**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `snowball` |  | Boule de neige : sphère de rayon 1 mise à l'échelle (le bas du bonhomme : 0,4 ; son milieu : 0,3 ; sa tête : 0,2) | 02k-dynprops |
| `snowHat` |  |  | 02k-dynprops |
| `carrot` |  |  | 02k-dynprops |
| `scarf` |  |  | 02k-dynprops |
| `twig` |  |  | 02k-dynprops |

**Barque de pêcheur**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `barque` |  | Coque de 3,4 m sur 1,3 m, fond plat, étrave relevée, tableau arrière ; plat-bord blanc, deux bancs, deux avirons. | 02k-dynprops, 02u-embruns (Kervénec) |

### `src/02l-port.js`

**Bateaux**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `trawler` | o | Chalutier (pêche arrière) : coque, timonerie à deux niveaux (fenêtres inclinées, portes, hublots), mât et radar, portique arrière avec enrouleur de filet, panneaux de chalut, treuil, panneau de cale,... | 02u-embruns (Kervénec) |
| `lifeRing` |  | Bouée couronne (orange, bandes blanches), dans le plan xy, centre en y = 0 | 02l-port |
| `ropeCoil` |  | Glène de cordage lovée sur le pont | 02k-dynprops, 02l-port, 02ye-cyclades-deco |
| `fishBin` |  |  | 02l-port |
| `fishBinSolid` |  | Bac à poisson physique, vide (avec sa collision), et bac du haut d'une pile : lit de glace compris, collision jusqu'à la glace | 02k-dynprops |
| `fishBinIce` |  |  | 02k-dynprops |
| `fishBinStackDyn` | n = 2, k = 0 | Pile de bacs physiques (au sol, hors des bateaux qui bougent) : mêmes bacs et mêmes teintes que fishBinStack, poissons dynamiques | 02l-port, 02u-embruns (Kervénec), 02yf-meltem (Meltem) |
| `fishOne` |  | Un poisson de 30 cm, couché (repère : son centre), teinte de l'estampille | 02k-dynprops |
| `fishBinStack` | n = 2, k = 0 |  | 02l-port |
| `canot` | hull = [0.85, 0.85, 0.82], seed = 1 | Canot à moteur (5,6 m) : coque ouverte, banc, console, moteur hors-bord ; pour flotter (floatAdd) ou reposer sur un ber | 02u-embruns (Kervénec) |
| `sailboat` | seed = 1 | Voilier au mouillage (lointain) : coque blanche, rouf, mât et bôme, voile ferlée | 02u-embruns (Kervénec), 02yf-meltem (Meltem) |
| `bitt` |  | Bitte d'amarrage en fonte (bollard à tête renflée) sur sa platine | 02u-embruns (Kervénec), 02yf-meltem (Meltem), 02yj-stratus (Stratus) |

**Matériel de quai**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `netPile` | seed = 1, w = 2.2, d = 1.6, h = 0.9 | Tas de filet de pêche : amas bosselé (deux teintes de nappe), flotteurs orange, ralingue ; collision basse | 02u-embruns (Kervénec), 02ye-cyclades-deco |
| `lobsterPot` |  | Casier à crustacés : armature cylindrique couchée, filet, goulotte ; empilés par rangées | 02k-dynprops |
| `lobsterPots` | nx = 3, ny = 2, nz = 2, seed = 1 |  | 02u-embruns (Kervénec), 02yf-meltem (Meltem) |
| `buoy` | c = [0.95, 0.42, 0.1], r = 0.3 | Bouée de corps-mort ou de casier (sphère orange ou blanche et son anneau) | 02k-dynprops |
| `quayLadder` | depth = 2.2 | Échelle de quai : montants et barreaux de fer scellés dans le parement (repère : face du quai en z = 0, l'eau vers +z) | 02u-embruns (Kervénec), 02yf-meltem (Meltem) |
| `lifeRingStand` |  | Poteau de bouée couronne : potelet, boîte à bouée, la bouée accrochée | 02u-embruns (Kervénec), 02yf-meltem (Meltem) |
| `quayCrane` | reach = 9 | Grue de déchargement (grue de quai sur fût, d'après des photos de grues portuaires à flèche treillis) : semelle boulonnée, fût conique, couronne d'orientation, plateforme tournante avec la salle des... | 02u-embruns (Kervénec) |
| `portique` | w = 11, L = 25, H = 10 | Portique de manutention (élévateur à bateaux) enjambant la darse : quatre jambes sur roues, deux poutres le long de z, palans et sangles. | 02u-embruns (Kervénec) |
| `iceMachine` |  | Machine à glace en écailles (d'après photos de machines de criée) : pieds, bac à glace en inox à panneaux et trappe, tambour évaporateur et son motoréducteur, groupe de condensation à deux... | 02u-embruns (Kervénec) |
| `etal` | seed = 1 | Étal de criée (2,4 x 1,1 m) : table inox sur tréteaux, lit de glace et poissons, ardoise de prix ou balance | 02u-embruns (Kervénec) |
| `cadran` |  | Cadran des ventes : caisson lumineux suspendu, deux faces (repère : centre du caisson) | 02u-embruns (Kervénec) |
| `conveyor` | L = 10 | Tapis de vente (convoyeur à bande de criée, d'après photos) de longueur L le long de x, hauteur 0,9 m : longerons en U, tambours aux deux bouts, bande dessus et brin de retour dessous, pieds... | 02u-embruns (Kervénec) |
| `coldRoom` | w = 4, d = 3, h = 3 | Chambre froide en panneaux isolants (d'après photos) : panneaux blancs à joints verticaux sur les quatre faces, cornières d'aluminium aux arêtes, porte coulissante à joint et poignée, rail, plinthe... | 02u-embruns (Kervénec) |
| `icePallet` |  | Palette de sacs de glace (filmée) | 02u-embruns (Kervénec) |

### `src/02p-plantes.js`

**Arbres feuillus**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `tree` | kind, h = 9, r = 3.4, seed = 1, o = {} | Arbre : kind, h (hauteur totale), r (rayon de couronne), seed ; o : shape ('round', 'spread', 'tall'), th (hauteur du tronc nu), lean, n (cartes), trunk ('bark'), sz (taille des cartes) | 02r-serre, 02v-floreal (Hortus), 02w-jardins, 02y-paris, 02yj-stratus (Stratus), 02yn-french-dream (French Dream) |
| `willow` | h = 8, r = 3.4, seed = 1 | Saule pleureur : couronne claire et rideau de brins qui retombent jusqu'à l'eau | 02w-jardins |

**Palmiers, fougères arborescentes, bananiers, bambous**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `palmG` | h = 6, seed = 1, kind = 'palm' | Palmier vert : stipe annelé et courbe, couronne de palmes en V qui retombent. | 02r-serre |
| `treeFern` | h = 2.4, seed = 1 | Fougère arborescente : stipe fibreux brun, couronne dense de grandes frondes | 02r-serre, 02w-jardins |
| `banana` | h = 3.2, seed = 1 | Bananier : faux tronc vert, grandes feuilles déchirées qui retombent | 02r-serre |
| `bamboo` | n = 7, h = 7.5, seed = 1 | Touffe de bambous : chaumes lisses annelés, branches et feuilles retombantes. | 02w-jardins |

**Plantes de sous-bois et massifs**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `fern` | kind = 'fernA', s = 1, seed = 1, n = 9 | Fougère au sol : une dizaine de frondes qui retombent. | 02r-serre, 02w-jardins |
| `rosette` | kind = 'monstera', atlas = 'leafA', size = 1, n = 6, seed = 1, o = {} | Rosette de grandes feuilles dressées (monstera, alocasia, philodendron, bananier nain, calathea, hosta...) : n cartes inclinées vers l'extérieur | 02r-serre, 02w-jardins |
| `clump` | kind = 'grass', atlas = 'leafB', w = 0.7, h = 0.6, n = 3, seed = 1, o = {} | Touffe de cartes croisées (fleurs, herbes, lavande, tulipes...) : n cartes verticales de largeur w et hauteur h autour de l'axe | 02q-jardin, 02r-serre, 02v-floreal (Hortus), 02w-jardins |
| `liana` | w = 1.4, h = 2.6, seed = 1 | Liane qui pend (sprite A, accrochée en haut) : carte verticale de largeur w, hauteur h, du sol y = 0 au point d'accroche y = h | 02r-serre |
| `hanging` | kind = 'wisteria', w = 1.0, h = 2.4, seed = 1 | Lierre ou glycine plaqués : même principe, pendant d'un support horizontal (sprite B) | 02w-jardins |
| `reeds` | h = 2.0, seed = 1 | Roseaux, papyrus, quenouilles : cartes croisées hautes | 02w-jardins |
| `papyrus` | h = 2.4, seed = 1 |  | 02r-serre |
| `lilies` | r = 2, n = 9, seed = 1, flowers = 0.35 | Nénuphars : feuilles à plat posées sur l'eau (sprite A, case 2 x 2 : grandes feuilles et fleurs), n cartes dans un rayon r | 02r-serre, 02w-jardins |

### `src/02q-jardin.js`

**Haies, topiaires, mobilier**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `topiary` | kind = 'cone', s = 1 | Topiaire en pot de pierre : cône, boule, spirale ou cube de buis, h hauteur du feuillage | 02v-floreal (Hortus) |
| `gbench` |  | Banc de parc : lattes de bois sur flancs de fonte, dossier. | 02q-jardin |
| `urn` | kind = 'roseP', atlas = 'leafB', s = 1 | Urne de pierre sur piédestal, avec sa plante (kind : sprite de PF.clump) | 02w-jardins |

**Semis de plantes**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `toro` | s = 1 | Lanterne de pierre japonaise (tōrō) : socle, fût, chambre à feu, chapeau, boule | 02w-jardins |

### `src/02r-serre.js`

**Rocaille : blocs, parois**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `rockG` | seed = 1, rx = 1.2, ry = 1, rz = 1.2 | Bloc de roche facetté (comme PF.boulder) dans la matière rocaille : grès ocre rosé, teinte au choix | 02r-serre, 02w-jardins |

### `src/02v-floreal.js` (Hortus)

**Bases : l'Orangerie et les remises des jardiniers**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `wheelbarrow` |  | Brouette de jardinier : bac, roue, brancards (décor fixe) | 02v-floreal (Hortus) |

### `src/02w-jardins.js`

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `pine` | h = 4.5, seed = 1 | Pin taillé en nuages (niwaki) : tronc tordu, étages de coussins d'aiguilles posés à plat | 02w-jardins |

**Pelouses, promenade, allée, enceinte**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `gardenLamp` | lit = litOn() | Lampadaire de parc en fonte vert sombre : base ouvragée, fût cannelé, lanterne à pans, flèche | 02w-jardins |

### `src/02y-paris.js`

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `farLamp` | lit = litOn() | Réverbère de boulevard : fût de fonte vert sombre, console courbe, lanterne ; sans collision | 02y-paris |
| `morris` |  | Colonne Morris : fût vert, bandeau d'affiches, toit en dôme | 02y-paris |

### `src/02ye-cyclades-deco.js`

**Arbres**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `cyOlive` | h = 4.4, seed = 1 | Olivier : tronc noueux qui se divise en trois charpentières, couronne argentée en trois masses | 02yf-meltem (Meltem) |
| `cyCypress` | h = 8, seed = 1 | Cyprès : flamme sombre et serrée | 02yf-meltem (Meltem) |
| `cyTamarisk` | h = 3.8, seed = 1 | Tamaris : tronc clair et tordu, longs plumeaux bleu-vert retombants | 02yf-meltem (Meltem) |
| `cyFig` | h = 4.4, seed = 1 | Figuier : tronc court, large dôme de grandes feuilles lobées | 02yf-meltem (Meltem) |
| `cyPlane` | h = 10.5, seed = 1 | Platane de la place : tronc clair et massif, vaste couronne ; son ombre est cuite dans l'éclairage | 02yf-meltem (Meltem) |

**Plantes**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `cyAgave` | s = 1 |  | 02yf-meltem (Meltem) |
| `cyOpuntia` | s = 1 |  | 02yf-meltem (Meltem) |
| `cyBush` | s = 1, seed = 1 | Touffe : variété choisie par la graine (géranium, romarin, laurier-rose, lavande) | 02yc-cyclades-bati, 02yf-meltem (Meltem), 02yl-simoun (Simoun) |
| `cyGrass` | s = 1 |  | 02yl-simoun (Simoun) |
| `cyClimber` | kind, w = 2.2, h = 2.6 | Plante grimpante sur un mur (repère de façade) : bougainvillée, jasmin, vigne ou lierre | 02yc-cyclades-bati, 02ye-cyclades-deco |
| `cyJasmine` | w = 1.8, h = 2.4 |  |  |

**Pots, mobilier de taverne**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `cyPot` | kind = 0 | Pot en terre cuite fleuri : kind 0 géranium, 1 romarin, 2 agave nain, 3 jasmin | 02ye-cyclades-deco |
| `cyUmbrella` | c = [0.95, 0.95, 0.92] | Parasol de taverne : mât, toile blanche et bleue ; sans collision (la toile est au-dessus des têtes). | 02yf-meltem (Meltem) |

**Barques et bord de mer**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `cyKaiki` | o = {} | Caïque : coque de bois peinte à l'étrave haute, bande de flottaison, pont de planches, petite timonerie, mât de feu, filets. | 02ye-cyclades-deco, 02yf-meltem (Meltem) |
| `cyCat` | seed = 1 | Chat assis (de dos, tourné vers ry) : pelage de la graine | 02yf-meltem (Meltem) |

### `src/02yg-tephra-kit.js`

**Objets**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `tpHeli` |  | Hélicoptère de la station (monoturbine léger), posé, nez vers -z : fuselage blanc, poutre de queue et dérive à la couleur du camp (paint), verrière, patins, rotor arrêté. | 02yh-tephra (Tephra) |

**Mobilier et instruments du centre de recherche (repère local : y vers le haut, la face avant vers +z)**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `tpBench` |  | Paillasse centrale de laboratoire (îlot de 2,9 x 1,4 m, double face) : meubles bas des deux côtés, plan de résine noire, étagère à réactifs au milieu et ses flacons, un microscope d'un côté, une... | 02yh-tephra (Tephra) |
| `tpHood` |  | Hotte d'aspiration (1,6 m de large) : meuble bas, joues, vitre relevée, éclairage intérieur, gaine d'extraction |  |
| `tpConsole` | len | Pupitre de conduite (len le long de x, 1 m de profondeur) : caisson, plan, rangée d'écrans allumés tournés vers +z | 02yh-tephra (Tephra) |
| `tpRack` |  | Baie de serveurs (0,6 x 0,7 m, 2,1 m de haut) : porte perforée sombre, voyants (bandeaux d'écran) | 02yh-tephra (Tephra) |
| `tpDrums` |  | Enregistreurs à tambour (sismographes) sur leur table : socle, tambour de papier, couvercle de verre ; 1,8 m le long de x | 02yh-tephra (Tephra) |
| `tpBunk` |  | Lits superposés (2 x 0,9 m) : cadre d'acier, matelas, échelle | 02yh-tephra (Tephra) |
| `tpGps` |  | Antenne GPS de surveillance des déformations : pilier de béton, antenne en disque sous son radôme, coffret et panneau solaire | 02yh-tephra (Tephra) |
| `tpWeather` |  | Mât météorologique (6 m) : anémomètre à coupelles, girouette, abri à persiennes, panneau solaire, haubans | 02yh-tephra (Tephra) |
| `tpGas` |  | Station de mesure des gaz (près des fumerolles) : poteau, coffret d'analyseur, prise d'air, panneau solaire | 02yh-tephra (Tephra) |

### `src/02yi-stratus-kit.js`

**Objets**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `stColumn` | h = 4, broken = false, seed = 1 | Colonne de ruine en pierre : socle, fût cannelé, chapiteau ; h : hauteur ; broken : fût cassé en biseau (sans chapiteau). | 02yj-stratus (Stratus) |
| `stBlock` | w = 1.4, h = 0.9, d = 0.8, seed = 1 | Bloc de pierre taillée (tombé d'une ruine) : couvert bas | 02yj-stratus (Stratus) |
| `stRock` | s = 1.6, seed = 1, squash = 0.75 | Rocher : bloc de roche stratifiée irrégulier (rockMesh), collision de sa boîte resserrée ; s : taille (m), squash : aplatissement | 02yj-stratus (Stratus) |
| `stCrystals` | h = 1.6, seed = 1 | Grappe de cristaux plantée au sol (bleu pâle, lumineux par eux-mêmes) ; h : hauteur du plus grand | 02yj-stratus (Stratus) |
| `stSpire` | h = 5, r = 1.4, seed = 1 | Aiguille rocheuse (h : hauteur, r : rayon à la base) : grand bloc de roche stratifiée qui coupe les vues d'une île à l'autre ; collision de son fût, resserrée | 02yj-stratus (Stratus) |
| `stMenhir` | h = 3.6, w = 1.2, seed = 1 | Pierre levée (menhir) : bloc dressé, légèrement penché, de la pierre des ruines | 02yj-stratus (Stratus) |
| `stStele` | w = 4.6, h = 3.6, d = 0.9, seed = 1 | Stèle : grande dalle de pierre dressée à une tête de pont (elle arrête la vue d'un bout à l'autre de l'archipel, on la contourne), un cristal serti sur chaque face ; w : largeur, h : hauteur, d :... | 02yj-stratus (Stratus) |
| `stTrilithon` | seed = 1 | Trilithe : deux pierres levées et leur linteau (on passe dessous) | 02yj-stratus (Stratus) |
| `stTent` | col, w = 3.2, L = 4.2, h = 2.4 | Tente d'expédition : toile tendue sur un faîtage (deux pans jusqu'au sol, pignons fermés), à la couleur du camp ; arrête les balles et les soldats (w : largeur, L : longueur, h : faîtage). | 02yj-stratus (Stratus) |
| `stCrateStack` | seed = 1 | Pile de caisses : deux en bas, une dessus (couvert haut) | 02yj-stratus (Stratus) |

### `src/02yk-simoun-kit.js`

**Massifs de grès**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `smScree` | seed = 1 | Éboulis : deux à quatre petits blocs anguleux de grès tombés de la paroi (au plus 30 cm), sans collision | 02yk-simoun-kit |
| `smRock` | s = 1.6, seed = 1, squash = 0.75 | Rocher de grès isolé (couvert) : bloc taillé de facettes, collision de sa boîte resserrée ; s : taille (m), squash : aplatissement | 02yk-simoun-kit, 02yl-simoun (Simoun) |

**Objets du désert**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `smFire` |  | Foyer : cercle de pierres noircies, braises éteintes, marmite sur trois pierres | 02yl-simoun (Simoun) |
| `smBedouin` | w = 7, d = 4.4, seed = 1 | Tente bédouine : toit bas et large en lés de laine sombre (une bande claire de temps en temps), affaissé entre les poteaux, relevé devant (le côté ouvert, +z), fermé derrière et sur les côtés... | 02yl-simoun (Simoun) |
| `smReeds` | s = 1 | Touffe de roseaux (atlas de Meltem) | 02yl-simoun (Simoun) |
| `smAcacia` | h = 4.6, seed = 1, dead = false | Acacia (arbre en parasol des oueds) : tronc tordu, couronne plate en nappe, sans feuilles en bas (on voit dessous) | 02yl-simoun (Simoun) |
| `smPalmFar` | h = 8, seed = 1 | Prefab de palmier lointain (peu de sommets, sans collision ni ombre propre) : mêmes palmes que PF.palm, en trois segments ; tronc plus ou moins gros et couronne plus ou moins grande selon la graine | 02yl-simoun (Simoun) |
| `smCart` |  | Charrette à bras (bois, deux roues pleines sur un essieu), posée sur ses brancards ; collisions de la caisse et des roues, et une boîte basse sous les brancards (on l'enjambe d'un pas, on n'y bute... | 02yl-simoun (Simoun) |

**L'épave de l'avion de ligne**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `smSeats3` |  | Bloc de trois sièges de cabine (repère : le plancher, le milieu du bloc ; on regarde vers +x) : assise et dossier bleu marine, têtière à housse rayée gris et blanc au dos, accoudoirs gris-vert,... | 02yk-simoun-kit |
| `smPilotSeat` |  | Siège de pilote (vers +x) : socle, assise et dossier anthracite, housse en peau de mouton claire, appui-tête, accoudoirs | 02yk-simoun-kit |
| `smJetEngine` |  | Réacteur à double flux arraché de son mât (repère : le sable sous lui, l'entrée d'air vers +x) : nacelle grise, soufflante et cône, tuyère et cône d'éjection, le mât déchiré au-dessus ; enfoncé de 12... | 02yk-simoun-kit |

### `src/02ym-pavillons-kit.js`

**Rue et jardins**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `fdBin` | lid = [0.98, 0.78, 0.12] | Poubelle à roulettes (cuve gris anthracite, couvercle de la couleur de la collecte) | 02ym-pavillons-kit |
| `fdMailbox` |  | Boîte aux lettres sur pied (plastique beige, comme sur les photos) | 02yn-french-dream (French Dream) |
| `fdLamp` |  | Lampadaire de lotissement : mât gris effilé, lanterne plate | 02yn-french-dream (French Dream) |
| `fdPool` | r = 2.2 | Piscine hors-sol à structure tubulaire (diamètre 2 r, haute de 1,22 m) : liner bleu clair, margelle de PVC, poteaux, échelle ; l'eau est posée à part (pondAdd, bassin où l'on entre), ses collisions... | 02yn-french-dream (French Dream) |
| `fdTrampoline` | r = 1.8 | Trampoline à filet de protection : cadre et tapis à 0,8 m, poteaux mousse, filet tendu ; collisions à part (fdNetCols : le filet arrête les soldats, ni les tirs ni la vue) | 02yn-french-dream (French Dream) |
| `fdShed` | w = 2.2, d = 2.0, tint = [0.62, 0.52, 0.4] | Abri de jardin en PVC imitation bois (w x d, porte double sur la face +z), toit à deux pans de bac acier | 02yn-french-dream (French Dream) |
| `fdSwing` |  | Balançoire de jardin : portique en tubes d'acier vert (3 m), deux sièges ; seuls les pieds arrêtent | 02yn-french-dream (French Dream) |
| `fdDryer` |  | Séchoir parapluie : mât, quatre bras, fils (le linge, tissu simulé, se pend à la pose : fdDryerLinge) | 02yn-french-dream (French Dream) |
| `fdTableJardin` |  | Table de jardin ronde en résine blanche et son parasol replié (prop physique, fdTableJardin) | 02ym-pavillons-kit |
| `fdChaise` |  | Fauteuil monobloc en résine blanche (prop physique, fdChaise) : assise, dossier incliné, quatre pieds, accoudoirs ; devant vers +z | 02ym-pavillons-kit |
| `fdBbq` |  | Barbecue boule sur trépied | 02ym-pavillons-kit |
| `fdTri` | tint, sign | Conteneur d'apport volontaire (verre, papiers) : cuve métallique 1,5 x 1,5 x 1,7, toit bombé, ouvertures, pictogramme | 02yn-french-dream (French Dream) |
| `fdTransfo` |  | Poste de transformation : cabine de béton beige, portes métalliques, ventilations, panneau « danger de mort » | 02yn-french-dream (French Dream) |
| `fdSlide` |  | Toboggan de jardin en bois : petite tour (plancher à 1 m) fermée de planches, échelle sur le côté -x, bac à sable bâché au pied, glissière vert anis ondulée de 2 m vers +z ; sous la glissière, des... | 02yn-french-dream (French Dream) |
| `fdSofa` | tint = [0.52, 0.5, 0.48] | Canapé (déménagement) : tissu gris, accoudoirs | 02yn-french-dream (French Dream) |
| `fdMupi` |  | Sucette publicitaire (mobilier urbain) : panneau rétroéclairé de 1,3 x 2 m sur pied, l'affiche des derniers lots des deux côtés | 02yn-french-dream (French Dream) |
| `fdCaravan` |  | Caravane remisée (5,6 m, caisse blanche à bande, baies, porte, timon, roues) ; front : timon vers -z | 02yn-french-dream (French Dream) |
| `fdBallon` | c = [0.9, 0.2, 0.15] | Ballon d'enfant en plastique (prop physique, fdBallon, a : sa couleur ; il roule, les balles le poussent). | 02ym-pavillons-kit |
| `fdNain` |  | Nain de jardin en céramique (prop physique, fdNain : il tombe, et se brise en éclats sous les balles) : bonnet rouge pointu, barbe blanche, veste bleue, socle vert | 02ym-pavillons-kit |

**Chantier**

| Prefab | Paramètres | Description | Posé dans |
| --- | --- | --- | --- |
| `fdMixer` |  | Bétonnière de chantier (prop physique, fdMixer) : châssis de tubes rouges en A sur deux roues et deux pieds, cuve orange inclinée sur sa fourche, moteur, volant de basculement ; roues vers +z | 02ym-pavillons-kit |
| `fdBrouette` |  | Brouette de chantier (prop physique, fdBrouette) : bac de tôle galvanisée évasé et ouvert, un peu de sable dedans, brancards de tube posés sur la roue (devant, +z) et sur deux pieds à l'arrière,... | 02ym-pavillons-kit |
| `fdBlockPallet` |  | Palette de parpaings filmée (1,2 x 1,0, 1 m) | 02yn-french-dream (French Dream) |
| `fdSkip` |  | Benne de chantier (3,6 x 1,8) : tôle jaune, côtés évasés, gravats | 02yn-french-dream (French Dream) |

## Props physiques

Objets qui tombent, roulent et volent en éclats (`propType`, README « Props physiques »).

| Type | Prefab | Masse (kg) | Son | Fichier |
| --- | --- | --- | --- | --- |
| `fruitBox` | `fruitBox` | 1.4 | wood | `src/02k-dynprops.js` |
| `fruit` | `fruitBall` | 0.2 | fruit | `src/02k-dynprops.js` |
| `shard` | `potShard` | 0.05 | clay | `src/02k-dynprops.js` |
| `pot` | `pot` | 6 | clay | `src/02k-dynprops.js` |
| `jar` | `jar` | 7 | clay | `src/02k-dynprops.js` |
| `spiceSack` | `spiceSack` | 9 | soft | `src/02k-dynprops.js` |
| `sandbagLow` | `sandbag` | 12 | soft | `src/02k-dynprops.js` |
| `ropeCoil` | `ropeCoil` | 6 | soft | `src/02k-dynprops.js` |
| `chair` | `chair` | 2.5 | plastic | `src/02k-dynprops.js` |
| `cafeTable` | `cafeTable` | 6 | metal | `src/02k-dynprops.js` |
| `jerrycan` | `jerrycan` | 1.6 | metal | `src/02k-dynprops.js` |
| `gasBottle` | `gasBottle` | 14 | metal | `src/02k-dynprops.js` |
| `trashBag` | `trashBag` | 3 | soft | `src/02k-dynprops.js` |
| `sled` | `sled` | 6 | wood | `src/02k-dynprops.js` |
| `ski` | `skiOne` | 2.2 | wood | `src/02k-dynprops.js` |
| `skiPole` | `skiPole` | 0.4 | wood | `src/02k-dynprops.js` |
| `table` | `table` | 26 | wood | `src/02k-dynprops.js` |
| `barrel` | `barrel` | 24 | metal | `src/02k-dynprops.js` |
| `sandbag` | `sandbagFat` | 16 | soft | `src/02k-dynprops.js` |
| `sandbagHalf` | `sandbagHalf` | 8 | soft | `src/02k-dynprops.js` |
| `tire` | `tire` | 9 | soft | `src/02k-dynprops.js` |
| `hayBale` | `hayBale` | 22 | soft | `src/02k-dynprops.js` |
| `lobsterPot` | `lobsterPot` | 8 | metal | `src/02k-dynprops.js` |
| `fishBin` | `fishBinSolid` | 1.3 | plastic | `src/02k-dynprops.js` |
| `fishBinIce` | `fishBinIce` | 4 | plastic | `src/02k-dynprops.js` |
| `fish` | `fishOne` | 0.45 | fruit | `src/02k-dynprops.js` |
| `snowman` | `` |  |  | `src/02k-dynprops.js` |
| `snowball` | `snowball` | 900 | snow | `src/02k-dynprops.js` |
| `snowHat` | `snowHat` | 0.3 | soft | `src/02k-dynprops.js` |
| `carrot` | `carrot` | 0.1 | soft | `src/02k-dynprops.js` |
| `scarf` | `scarf` | 0.3 | soft | `src/02k-dynprops.js` |
| `twig` | `twig` | 0.1 | wood | `src/02k-dynprops.js` |
| `barque` | `` |  |  | `src/02k-dynprops.js` |
| `fdTableJardin` | `fdTableJardin` |  |  | `src/02ym-pavillons-kit.js` |
| `fdChaise` | `fdChaise` |  |  | `src/02ym-pavillons-kit.js` |
| `fdBbq` | `fdBbq` |  |  | `src/02ym-pavillons-kit.js` |
| `fdNain` | `fdNain` | 4 | clay | `src/02ym-pavillons-kit.js` |
| `fdMixer` | `fdMixer` |  |  | `src/02ym-pavillons-kit.js` |
| `fdBrouette` | `fdBrouette` |  |  | `src/02ym-pavillons-kit.js` |

## Surfaces photo

Photos CC0 ramenées à une plage commune (`tools/build_assets.py`), un fichier par surface à côté de la page, chargé au lancement de la carte qui la demande.

| Surface | Photo | Source | Licence | Cartes |
| --- | --- | --- | --- | --- |
| `adobe` | clay_block_wall | Poly Haven | CC0 1.0 | Simoun |
| `ash` | gravel_stones | Poly Haven | CC0 1.0 | Tephra |
| `ashlar` | seaworn_sandstone_brick | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Hortus |
| `asphalt` | Asphalt021 | ambientCG | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Tephra, French Dream |
| `bark` | bark_willow_02 | Poly Haven | CC0 1.0 | Hortus, Stratus, French Dream |
| `barkw` | pine_bark | Poly Haven | CC0 1.0 | Val-Blanc |
| `boards` | wooden_planks | Poly Haven | CC0 1.0 | Val-Blanc, Kervénec |
| `brick` | Bricks066 | ambientCG | CC0 1.0 | Khamsin, Kervénec |
| `burlap` | hessian_230 | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Meltem, Stratus, Simoun |
| `canvas` | Fabric066 | ambientCG | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Meltem, Stratus, Simoun, French Dream |
| `cardboard` | Cardboard004 | ambientCG | CC0 1.0 | Khamsin, French Dream |
| `cobble` | cobblestone_floor_001 | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Meltem |
| `concrete` | concrete_wall_009 | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, French Dream |
| `crate` | brown_planks_09 | Poly Haven | CC0 1.0 | Khamsin, Kervénec |
| `dirt` | forest_ground_04 | Poly Haven | CC0 1.0 | Stratus, Simoun, French Dream |
| `drystone` | stone_wall | Poly Haven | CC0 1.0 | Meltem |
| `flagstone` | stone_pathway | Poly Haven | CC0 1.0 | Hortus, Stratus |
| `galets` | dry_river_pebbles | Poly Haven | CC0 1.0 | Simoun |
| `humus` | forest_leaves_02 | Poly Haven | CC0 1.0 | Hortus, Stratus |
| `laine` | Fabric031 | ambientCG | CC0 1.0 | Simoun |
| `lawn` | aerial_grass_rock | Poly Haven | CC0 1.0 | Hortus, Stratus, French Dream |
| `linge` | rough_linen | Poly Haven | CC0 1.0 | Khamsin, Kervénec, Meltem |
| `mecha` | green_metal_rust | Poly Haven | CC0 1.0 |  |
| `mechadark` | blue_metal_plate | Poly Haven | CC0 1.0 |  |
| `paintwood` | distressed_painted_planks | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Meltem, French Dream |
| `palmbark` | palm_tree_bark | Poly Haven | CC0 1.0 | Khamsin, Simoun |
| `pathgravel` | gravel_floor_02 | Poly Haven | CC0 1.0 | Hortus, French Dream |
| `pavers` | Concrete012 | ambientCG | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Meltem, Tephra, French Dream |
| `pise` | excavated_soil_wall | Poly Haven | CC0 1.0 | Simoun |
| `plaster` | white_plaster_rough_01 | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, Meltem, French Dream |
| `plaster2` | clay_plaster | Poly Haven | CC0 1.0 | Khamsin, Kervénec |
| `reg` | sandy_gravel_02 | Poly Haven | CC0 1.0 | Simoun |
| `rock` | rock_face | Poly Haven | CC0 1.0 | Val-Blanc, Kervénec |
| `rollshutter` | rusty_metal_shutter | Poly Haven | CC0 1.0 | Khamsin, Kervénec, French Dream |
| `rooftiles` | clay_roof_tiles_03 | Poly Haven | CC0 1.0 | Khamsin, Kervénec, French Dream |
| `rust` | rust_coarse_01 | Poly Haven | CC0 1.0 | Val-Blanc, Kervénec |
| `sand` | dense_sand | Poly Haven | CC0 1.0 | Meltem, Simoun, French Dream |
| `shutter` | wood_shutter | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, Meltem |
| `slate` | roof_slates_03 | Poly Haven | CC0 1.0 | Val-Blanc, Kervénec, Hortus, French Dream |
| `snow` | snow_02 | Poly Haven | CC0 1.0 | Val-Blanc |
| `snowpack` | snow_01 | Poly Haven | CC0 1.0 | Val-Blanc |
| `steel` | Metal062C | ambientCG | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, Meltem, Tephra, Simoun, French Dream |
| `stone` | rustic_stone_wall_02 | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, Meltem, Stratus, Simoun |
| `strata` | cliff_side | Poly Haven | CC0 1.0 | Stratus, Simoun |
| `timber` | rough_wood | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, Meltem, Tephra, Stratus, Simoun, French Dream |
| `vase` | mud_cracked_dry_riverbed_002 | Poly Haven | CC0 1.0 | Simoun |
| `wood` | weathered_brown_planks | Poly Haven | CC0 1.0 | Khamsin, Val-Blanc, Kervénec, Hortus, Meltem, Tephra, Stratus, Simoun, French Dream |

## Surfaces procédurales

Générées sur le GPU au chargement de la carte (`TEXLAB`) ; une surface photo de même nom les remplace.

| Surface | Taille (px) | Description | Fichier |
| --- | --- | --- | --- |
| `sand` | 1024 | sable rouge du désert : rides de vent, grains, gravillons | `src/02b-texlab.js` |
| `dirt` | 512 | terre battue : taches, fissures fines, cailloux | `src/02b-texlab.js` |
| `concrete` | 512 | béton coulé : pores, nuages, reprises de coffrage | `src/02b-texlab.js` |
| `corrugated` | 512 | tôle ondulée galvanisée : ondes, paillettes de zinc, coulures de rouille | `src/02b-texlab.js` |
| `paint` | 512 | tôle peinte (teintée par les sommets) : fines écaillures, rayures, coulures de rouille, crasse | `src/02b-texlab.js` |
| `carpaint` | 512 | peinture de carrosserie (teintée) : vernis lisse et brillant (5.1, le ciel s'y reflète), rares voiles de poussière, micro-rayures | `src/02b-texlab.js` |
| `lattice` | 256 | treillis de moucharabieh (bois tourné) : alpha = opacité | `src/02b-texlab.js` |
| `cardboard` | 256 | carton ondulé : fibres, ruban adhésif, taches | `src/02b-texlab.js` |
| `steel` | 512 | acier brossé ou galvanisé | `src/02b-texlab.js` |
| `charred` | 512 | métal brûlé et rouillé (épaves) | `src/02b-texlab.js` |
| `cement_tiles` | 1024 | carreaux de ciment du souk : motif à quatre lobes, émail usé, joints | `src/02b-texlab.js` |
| `canvas` | 512 | toile d'auvent (teintée) : tissage, plis, salissures | `src/02b-texlab.js` |
| `burlap` | 512 | toile de jute des sacs de sable | `src/02b-texlab.js` |
| `rubber` | 256 | caoutchouc de pneu : sculptures en blocs | `src/02b-texlab.js` |
| `crate` | 512 | planches de caisse (pin) : fil du bois, clous, jointures | `src/02b-texlab.js` |
| `plastic` | 256 | plastique moulé (teinté) | `src/02b-texlab.js` |
| `glass` | 256 | verre de fenêtre sale | `src/02b-texlab.js` |
| `gravel` | 512 | gravier de toit terrasse | `src/02b-texlab.js` |
| `farfacade` | 512 | façade lointaine : une travée d'un étage (fenêtre, volets, bandeau) pour les silhouettes d'arrière-plan | `src/02b-texlab.js` |
| `rug` | 512 | tapis tissé (kilim) des étals | `src/02b-texlab.js` |
| `paintwood` | 512 | bois peint des portes et volets (teinté) : planches verticales, peinture écaillée | `src/02b-texlab.js` |
| `rollshutter` | 512 | rideau métallique de boutique (teinté) : lames horizontales, rouille, crasse | `src/02b-texlab.js` |
| `ashlar` | 1024 | moellons de pierre sèche (murets, soubassements, pierre de taille) | `src/02b-texlab.js` |
| `palmbark` | 512 |  | `src/02h-nature.js` |
| `snow` | 1024 | neige fraîche : rides de vent (sastrugi), creux bleutés, grain et scintillements (rugosité plus faible) | `src/02i-hiver.js` |
| `snowpack` | 1024 | neige tassée : empreintes de pas, ornières, plaques de glace lisses, gadoue grise par endroits | `src/02i-hiver.js` |
| `rock` | 1024 | roche de falaise (granite) : strates, fissures, lichen | `src/02i-hiver.js` |
| `boards` | 512 | bardage de mélèze (planches horizontales à rainures) : brun doré, grisé par les intempéries, nœuds | `src/02i-hiver.js` |
| `barkw` | 512 | écorce d'épicéa : plaques allongées, fissures sombres (barkw et non bark : la carte florale, 02n-flore.js, a sa propre écorce sous ce nom, facultative ; le... | `src/02i-hiver.js` |
| `slate` | 512 | ardoises (toit de la gare) : rangs décalés, bords irréguliers, nuances bleu-gris | `src/02i-hiver.js` |
| `rust` | 512 | fer rouillé (rails, bogies, ferrures) : écailles, piqûres ; alpha = masque de métal sain | `src/02i-hiver.js` |
| `logend` | 512 | bois de bout des grumes : cernes concentriques autour du coin de la tuile (centre des faces de coupe), fentes | `src/02i-hiver.js` |
| `hull` | 512 | coque d'acier peinte (teintée par les sommets) : tôles soudées, traînées de rouille sous les dalots, rayures des défenses, crasse vers la flottaison ; alpha =... | `src/02l-port.js` |
| `net` | 256 | filet de pêche : mailles en losange (alpha = opacité), fil de nylon vert ou bleu teinté par les sommets | `src/02l-port.js` |
| `crushedice` | 512 | glace pilée des étals : éclats translucides, brillances | `src/02l-port.js` |
| `grating` | 256 | caillebotis d'acier (passerelles) : grille de plats soudés, alpha = opacité | `src/02l-port.js` |
| `ripple` | 512 |  | `src/02m-water.js` |
| `lawn` | 1024 | pelouse : brins, touffes, ton qui varie de l'herbe grasse à l'herbe sèche, pâquerettes et boutons d'or | `src/02n-flore.js` |
| `pathgravel` | 1024 | gravier fin des allées : gravillons clairs, grains sombres | `src/02n-flore.js` |
| `humus` | 1024 | humus : terre sombre, feuilles mortes, plaques de mousse | `src/02n-flore.js` |
| `bark` | 512 | écorce : crêtes verticales, creux sombres, plaques de lichen | `src/02n-flore.js` |
| `hedge` | 512 | haie taillée : feuilles serrées en pastilles, ombres entre les amas (opaque) | `src/02n-flore.js` |
| `rocaille` | 1024 | rocaille : grès ocre aux strates horizontales ondulées, grain fin, fissures fines suivant des blocs, plaques de mousse basses | `src/02n-flore.js` |
| `haussmann` | 512 | façade d'immeuble parisien, une travée d'un étage (3,4 m x 3,3 m) : pierre de taille, haute porte-fenêtre à petits bois, garde-corps de fer forgé | `src/02n-flore.js` |
| `haussrdc` | 512 | rez-de-chaussée d'une travée (3,4 m x 4,2 m) : bossage de pierre, grande baie cintrée vitrée ou porte sombre | `src/02n-flore.js` |
| `pave` | 512 | chaussée pavée sombre : pavés carrés en quinconce, joints sombres | `src/02n-flore.js` |
| `flagstone` | 1024 | dalles de pierre claire des allées et des margelles | `src/02n-flore.js` |
| `slabs` | 1024 | dalles de schiste gris-beige, irrégulières, aux joints peints à la chaux (par endroits : la chaux s'écaille) | `src/02yb-cyclades.js` |
| `chaux` | 512 | chaux brossée : coups de brosse plus épais, microfissures, voile de poussière ; teinte par les sommets | `src/02yb-cyclades.js` |
| `drystone` | 512 | pierre sèche : moellons plats de teintes variées, joints creux et sombres, lichens (teintée par les sommets) | `src/02yb-cyclades.js` |
| `ash` | 1024 | cendre et scories : grains noirs, lapilli rougeâtres, quelques pierres ponces claires, rides laissées par le vent | `src/02yg-tephra-kit.js` |
| `basalt` | 1024 | basalte : lave refroidie, vacuoles, fissures, voile d'oxydation rouille, éclats vitreux | `src/02yg-tephra-kit.js` |
| `moss` | 512 | mousse laineuse des champs de lave : coussins gris-vert, cœurs plus sombres, interstices noirs | `src/02yg-tephra-kit.js` |
| `panel` | 512 | panneaux composites de façade (teintés par les sommets) : calepinage de 1,2 x 0,6 m, joints creux, voile de poussière en pied | `src/02yg-tephra-kit.js` |
| `jacket` | 512 | gaine d'aluminium des conduites : tôle lisse, joints de recouvrement tous les 0,9 m, bosses, coulures | `src/02yg-tephra-kit.js` |
| `vinyl` | 512 | sol des laboratoires et des salles : dalles de vinyle de 60 cm, mouchetures, joints fins, traces de passage | `src/02yg-tephra-kit.js` |
| `lava` | 512 | lave en mouvement : plaques de croûte sombre, fentes et chenaux incandescents (la matière l'éclaire d'elle-même, voir lavaTp) | `src/02yg-tephra-kit.js` |
| `ceiltile` | 512 | faux plafond : dalles minérales de 60 cm (piqûres, fissures fines), ossature en T laquée blanche | `src/02yg-tephra-kit.js` |
| `strata` | 1024 | roche stratifiée (grès et marnes) : bandes horizontales de teintes et d'épaisseurs inégales, ondulées, joints creusés, fissures, grain | `src/02yi-stratus-kit.js` |
| `gres` | 1024 | grès rouge des falaises : bancs d'épaisseur inégale, ondulés, stratification oblique dans chaque banc, diaclases verticales propres à chaque banc, lits creusés... | `src/02yk-simoun-kit.js` |
| `dune` | 1024 | sable des dunes : rides de vent courbes (dos long, front raide), effacées par plages, grain fin, nuances de l'ocre au doré | `src/02yk-simoun-kit.js` |
| `parpaing` | 512 |  | `src/02ym-pavillons-kit.js` |

## Atlas dessinés au chargement

| Atlas | Description | Fichier |
| --- | --- | --- |
| `foliageAtlas` |  | `src/02c-materials.js` |
| `signAtlas` |  | `src/02c-materials.js` |
| `decalAtlas` | Décalques (1024², grille 4 x 4, alpha) : 0 à 3 affiches, 4 et 5 pochoirs, 6 et 7 graffitis, 8 coulure, 9 salissure, 10 fissure, 11 impacts, 12 tache d'huile,... | `src/02c-materials.js` |
| `coniferAtlas` |  | `src/02i-hiver.js` |
| `winterSignAtlas` |  | `src/02i-hiver.js` |
| `winterDecalAtlas` |  | `src/02i-hiver.js` |
| `portSignAtlas` |  | `src/02l-port.js` |
| `portDecalAtlas` |  | `src/02l-port.js` |
| `cySignAtlas` |  | `src/02yb-cyclades.js` |
| `cyDecalAtlas` |  | `src/02yb-cyclades.js` |
| `cyFloraAtlas` |  | `src/02yb-cyclades.js` |
| `tpSignAtlas` |  | `src/02yg-tephra-kit.js` |
| `tpDecalAtlas` |  | `src/02yg-tephra-kit.js` |
| `fdSignAtlas` |  | `src/02ym-pavillons-kit.js` |

## Ciels et éclairage

Ciels photographiés (`assets/sky/`, moitié haute d'un panorama Poly Haven, CC0) : `kloofendal_48d`, `kloofendal_misty_morning`, `kloppenheim_02`, `quarry_01`, `qwantani_dawn`, `qwantani_dusk_2`, `sunflowers`, `wasteland_feu`.

HDRI d'éclairage (`assets/vendor/hdri/`, Poly Haven, CC0) : `park`, `sky`, `sunset`.

## Armes

Modèles construits par le code (`src/06c-models.js`), statistiques dans `src/06i-armes.js`.

| Arme | Nom | Catégorie |
| --- | --- | --- |
| `m4` | M4A1 | Fusil d'assaut |
| `mp5` | MP5 | Pistolet-mitrailleur |
| `l96` | L96A1 | Fusil de précision |
| `m1014` | M1014 | Fusil à pompe |
| `m9` | M9 | Pistolet |
| `ak47` | AK-47 | Fusil d'assaut |
| `scarh` | SCAR-H | Fusil d'assaut |
| `famas` | FAMAS F1 | Fusil d'assaut |
| `mp7` | MP7 | Pistolet-mitrailleur |
| `ump45` | UMP-45 | Pistolet-mitrailleur |
| `vector` | Vector | Pistolet-mitrailleur |
| `svd` | Dragunov SVD | Fusil de précision |
| `m82` | Barrett M82 | Fusil de précision |
| `rem870` | Remington 870 | Fusil à pompe |
| `aa12` | AA-12 | Fusil à pompe |
| `usp` | USP .45 | Pistolet |
| `glock18` | Glock 18 | Pistolet |
| `deagle` | Desert Eagle | Pistolet |

## Accessoires

Catalogue `ATT` (`src/06p-accessoires.js`), modèles construits par le code.

| Accessoire | Nom | Emplacement |
| --- | --- | --- |
| `red` | Point rouge | optic |
| `holo` | Holographique | optic |
| `sil` | Silencieux | muzzle |
| `comp` | Compensateur | muzzle |
| `brake` | Frein de bouche | muzzle |
| `choke` | Choke serré | muzzle |
| `long` | Canon long | barrel |
| `short` | Canon court | barrel |
| `vgrip` | Poignée verticale | under |
| `agrip` | Poignée angulaire | under |
| `bipod` | Bipied | under |
| `laser` | Pointeur laser | side |
| `fmag` | Chargeur rapide | mag |
| `xmag` | Chargeur étendu | mag |
| `hstock` | Crosse renforcée | stock |
| `nostock` | Sans crosse | stock |
| `hp` | Pointe creuse | ammo |
| `slug` | Balle unique | ammo |
